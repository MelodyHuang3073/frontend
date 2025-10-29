import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { zhTW } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { LeaveService } from '../services/leaveService';
import { LeaveType } from '../types';
import { useLocation } from 'react-router-dom';

// Map short weekday names to JS getDay() numbers
const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

interface FormDataType {
  leaveType: LeaveType;
  startDate: Date | null;
  endDate: Date | null;
  reason: string;
  attachments: File[];
}

const LeaveApplication: React.FC = () => {
  const navigate = useNavigate();
  // role not stored locally; redirect based on userDoc check
  const [formData, setFormData] = useState<FormDataType>({
    leaveType: LeaveType.PERSONAL,
    startDate: null,
    endDate: null,
    reason: '',
    attachments: [],
  });
  const [error, setError] = useState('');
  const alertRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const editId = params.get('edit');
  const [isEditMode, setIsEditMode] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<string[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<
    Array<{
      code: string;
      name: string;
      teacherUid?: string;
      teacherName?: string;
      schedule?: string | { date: string; starttime: string; endtime: string };
    }>
  >([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState<string | null>(null);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (event: SelectChangeEvent) => {
    setFormData(prev => ({
      ...prev,
      leaveType: event.target.value as LeaveType
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      // 檢查文件類型
      const validFiles = files.filter(file => 
        ['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)
      );

      if (validFiles.length !== files.length) {
        setError('只允許上傳 JPG、PNG 或 PDF 文件');
        return;
      }

      // 檢查文件大小（10MB 限制）
      const invalidSize = validFiles.some(file => file.size > 10 * 1024 * 1024);
      if (invalidSize) {
        setError('文件大小不能超過 10MB');
        return;
      }

      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...validFiles]
      }));
      setError('');
    }
  };

  const [availableCourses, setAvailableCourses] = useState<typeof enrolledCourses>([]);

  // Helpers to parse schedule like 'Mon 09:00-10:30'
  const parseSchedule = React.useCallback((s?: any) => {
    console.debug('[LeaveApplication] parseSchedule input:', s);
    if (!s) return null;
    try {
      if (typeof s === 'object') {
        // Firestore: { date: 'Mon', starttime: '9:00', endtime: '10:30' }
        const wd = s.date || s.day || '';
        const startStr = s.starttime || s.startTime;
        const endStr = s.endtime || s.endTime;
        const toMinutes = (t?: string) => {
          if (!t) return null;
          const [hh, mm] = t.split(':').map(Number);
          return hh * 60 + mm;
        };
        const out = {
          weekday: WEEKDAY_MAP[wd] ?? null,
          startMin: toMinutes(startStr),
          endMin: toMinutes(endStr)
        };
        console.debug('[LeaveApplication] parseSchedule output (object):', out);
        return out;
      }

      // fallback: string format like 'Mon 09:00-10:30'
      const parts = s.split(' ');
      const wd = parts[0];
      const times = parts[1] || '';
      const [startStr, endStr] = times.split('-');
      const toMinutes = (t: string) => {
        if (!t) return null;
        const [hh, mm] = t.split(':').map(x => parseInt(x, 10));
        return hh * 60 + mm;
      };
      const out = {
        weekday: WEEKDAY_MAP[wd] ?? null,
        startMin: toMinutes(startStr),
        endMin: toMinutes(endStr)
      };
      console.debug('[LeaveApplication] parseSchedule output (fallback):', out);
      return out;
    } catch (err) {
      console.warn('parseSchedule failed for', s, err);
      return null;
    }
  }, []);

  const { startDate, endDate } = formData;

  const MAX_LEAVE_DAYS = 7;
  const addDays = (d: Date, days: number) => {
    const n = new Date(d);
    n.setDate(n.getDate() + days);
    return n;
  };

  const [rangeWarning, setRangeWarning] = useState<string | null>(null);

  const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

  // Given a course schedule (string or object) and the selected start/end range,
  // return concrete Date objects for the class start and end that fall within the range.
  const getCourseDateRange = (schedule: any, rangeStart: Date, rangeEnd: Date): { classStart: Date; classEnd: Date } | null => {
    if (!schedule || !rangeStart || !rangeEnd) return null;
    const parsed = parseSchedule(schedule);
    if (!parsed || parsed.weekday === null || parsed.startMin == null || parsed.endMin == null) return null;

    // find the first date in the range that matches the weekday
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      const cur = new Date(d);
      if (cur.getDay() !== parsed.weekday) continue;
      // build start/end Date using that date but with class times
      const classStart = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), Math.floor(parsed.startMin / 60), parsed.startMin % 60, 0, 0);
      const classEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), Math.floor(parsed.endMin / 60), parsed.endMin % 60, 0, 0);
      return { classStart, classEnd };
    }
    return null;
  };

  // Compute available courses for the selected time range when user confirms
  const computeAvailableCourses = async () => {
    setMatching(true);
    try {
      setError('');
      // defensive: ensure dates are proper
      if (!startDate || !endDate) {
        setAvailableCourses([]);
        setError('請先選擇開始與結束時間');
        return [] as any;
      }

      console.debug('[LeaveApplication] computeAvailableCourses, auth uid=', auth.currentUser?.uid, 'enrolledCourses=', enrolledCourses.length);

      // If enrollments not yet loaded, try fetching now (ensure DB read happens when button clicked)
      let coursesToCheck = enrolledCourses;
      if ((!enrolledCourses || enrolledCourses.length === 0) && auth.currentUser) {
        console.debug('[LeaveApplication] enrolledCourses empty — fetching from Firestore now');
        const fresh = await fetchEnrollments(auth.currentUser.uid);
        coursesToCheck = fresh && fresh.length ? fresh : enrolledCourses;
      }

      const matches: typeof enrolledCourses = [];

      // iterate through each calendar day in the range (inclusive)
      const days: Date[] = [];
      const s = new Date(startDate);
      const e = new Date(endDate);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }
      console.debug('[LeaveApplication] expanded days for range:', days.map(dd => dd.toDateString()));

      console.debug('[LeaveApplication] coursesToCheck (summary):', coursesToCheck.map(x => ({ code: x.code, schedule: x.schedule })));

      for (const c of coursesToCheck) {
        if (!c.schedule) {
          console.debug('[LeaveApplication] skipping course (no schedule):', c.code, c);
          continue;
        }
        const parsed = parseSchedule(c.schedule);
        console.debug('[LeaveApplication] parsed schedule for', c.code, parsed);
        if (!parsed || parsed.weekday === null) {
          console.debug('[LeaveApplication] parsed schedule invalid or missing weekday for', c.code);
          continue;
        }

        // check each day in the selected range for weekday match and time overlap
        let matched = false;
        for (const day of days) {
          if (day.getDay() !== parsed.weekday) continue;

          // 當日請假起訖時間
          let leaveStartMin = 0;
          let leaveEndMin = 24 * 60;

          if (day.toDateString() === new Date(startDate).toDateString()) {
            leaveStartMin = minutesOfDay(new Date(startDate));
          }
          if (day.toDateString() === new Date(endDate).toDateString()) {
            leaveEndMin = minutesOfDay(new Date(endDate));
          }

          const classStart = parsed.startMin ?? 0;
          const classEnd = parsed.endMin ?? 24 * 60;
          // overlap: leaveStart <= classEnd && leaveEnd >= classStart
          if (leaveStartMin <= classEnd && leaveEndMin >= classStart) {
            matched = true;
            break;
          }
        }

        if (matched) matches.push(c);
      }

      setAvailableCourses(matches);
      console.debug('[LeaveApplication] matched courses=', matches.map(m => m.code));
      if (matches.length === 1) setSelectedCourseCode(matches[0].code);
      if (matches.length === 0) {
        // Provide helpful context so admin/user can see what enrollments exist and why no match
        const enrolledInfo = coursesToCheck.map(c => `${c.code}${c.schedule ? ` (${c.schedule})` : ''}`).join(', ');
        const msg = enrolledInfo
          ? `系統未在您選擇的時間內找到對應的課程。您目前註冊的課程：${enrolledInfo}。請確認課程代碼或排程是否正確。`
          : '系統未在您選擇的時間內找到對應的課程。請確認時間或聯絡管理員。';
        setError(msg);
      }
      return matches;
    } finally {
      setMatching(false);
    }
  };

  // if enrollments change, clear previously computed matches so user must re-confirm
  // but when editing an existing leave we want to keep the prefilled selection,
  // so don't clear while in edit mode.
  useEffect(() => {
    if (isEditMode) return;
    setAvailableCourses([]);
    setSelectedCourseCode(null);
  }, [enrolledCourses, isEditMode]);

  const [matching, setMatching] = useState(false);

  // fetch enrollments helper (used by auth listener and on-demand)
  // fetch enrollments helper (used by auth listener and on-demand)
const fetchEnrollments = async (uid: string) => {
  try {
    console.debug('[LeaveApplication] fetchEnrollments for uid=', uid);

    let snap = await getDocs(query(collection(db, 'enrollments'), where('studentUid', '==', uid)));
    if (snap.empty) {
      console.debug('[LeaveApplication] no enrollments under studentUid, trying userId');
      snap = await getDocs(query(collection(db, 'enrollments'), where('userId', '==', uid)));
    }

    console.debug('[LeaveApplication] enrollments query snapshot size=', snap.size);
    const items = await Promise.all(snap.docs.map(async (d) => {
      const data: any = d.data();
      console.debug('[LeaveApplication] enrollment raw doc:', data);
      const code = data.courseCode;
      let courseName = data.courseName || '';
      let teacherUid: string | undefined;
      let teacherName: string | undefined;
  let schedule: any = data.schedule || undefined;

      let c: any = undefined;
      try {
        // course 表名為 "course"
        const courseRef = doc(db, 'course', code);
        const courseSnap = await getDoc(courseRef);
        if (courseSnap.exists()) {
          c = courseSnap.data();
        } else {
          // 如果找不到，就用 where 查欄位
          const q = query(collection(db, 'course'), where('code', '==', code));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            c = qSnap.docs[0].data();
          } else {
            console.warn(`[LeaveApplication] course not found: ${code}`);
          }
        }
      } catch (err) {
        console.error(`Failed to load course ${code}`, err);
      }

      // If we found a course doc, prefer its values for display and scheduling
      if (c) {
        console.debug('[LeaveApplication] found course doc for', code, c);
        courseName = courseName || c.name || c.courseName || courseName;

        // course may reference the teacher by a user id field (userId, teacherUid, etc.)
        const courseTeacherUid = c.userId || c.userUid || c.teacherUid || c.teacherId;
        teacherUid = teacherUid || courseTeacherUid;

        // try to get teacherName from the course doc first
        teacherName = teacherName || c.teacherName || c.instructor || teacherName;

        // if teacherName still missing but we have a user id, fetch users/{userId}.username
        if (!teacherName && courseTeacherUid) {
          try {
            const userRef = doc(db, 'users', courseTeacherUid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const ud: any = userSnap.data();
              teacherName = ud.username || ud.displayName || ud.name || teacherName;
              console.debug('[LeaveApplication] resolved teacherName from users doc', courseTeacherUid, teacherName);
            } else {
              console.debug('[LeaveApplication] users doc not found for', courseTeacherUid);
            }
          } catch (err: any) {
            // If Firestore rules prevent reading the `users` doc, treat as non-fatal and continue.
            if (err?.code === 'permission-denied' || /permission/i.test(err?.message || '')) {
              console.debug('[LeaveApplication] no permission to read users doc for', courseTeacherUid, '- skipping teacher username resolution');
            } else {
              console.error('[LeaveApplication] failed to load user for teacher uid', courseTeacherUid, err);
            }
          }
        }

        schedule = schedule || c.schedule || c.time || c.timeslot || schedule;
      }

      const merged = {
        code,
        name: courseName,
        teacherUid,
        teacherName,
        schedule
      };
      console.debug('[LeaveApplication] enrollment merged item:', merged);
      return merged;
    }));

    setEnrolledCourses(items);
    if (items.length === 1) setSelectedCourseCode(items[0].code);
    return items;
  } catch (err: any) {
    console.error('載入選課資料失敗', err);
    if (err?.code === 'permission-denied' || /permission/i.test(err?.message || '')) {
      setError('讀取選課資料時權限不足，請確認是否已登入或 Firestore 規則允許讀取。');
    }
    return [] as any;
  }
};

  // wire auth listener to load enrollments when a user becomes available
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        void fetchEnrollments(user.uid);
      } else {
        // not signed in yet - clear enrollments
        setEnrolledCourses([]);
      }
    });

    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // 檢查用戶是否已登入
    if (!auth.currentUser) {
      setError('請先登入');
      navigate('/login');
      return;
    }
    
    // 基本驗證
    if (!formData.leaveType || !formData.startDate || !formData.endDate || !formData.reason) {
      setError('請填寫所有必填欄位');
      return;
    }

    // require selecting a course if the system found matching courses for the time range
    if (!selectedCourseCode && availableCourses.length > 0) {
      setError('請選擇要請假的課程');
      return;
    }

    // 日期驗證
    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      setError('結束時間不能早於開始時間');
      return;
    }

    // 限制：新增請假時（非編輯）期間不得超過 MAX_LEAVE_DAYS
    if (!isEditMode && formData.startDate && formData.endDate) {
      const diffMs = (new Date(formData.endDate)).getTime() - (new Date(formData.startDate)).getTime();
      if (diffMs > MAX_LEAVE_DAYS * 24 * 60 * 60 * 1000) {
        setError(`請假期間不得超過 ${MAX_LEAVE_DAYS} 天`);
        return;
      }
    }

    setLoading(true);

    try {
      let response;
      // determine selected course (from available matches first, then enrolled list)
      const selectedCourse = availableCourses.find(c => c.code === selectedCourseCode) || enrolledCourses.find(c => c.code === selectedCourseCode) || null;

      // If a course is selected and has schedule info, compute concrete class start/end within the selected range
      let useStartDate: Date | null = formData.startDate;
      let useEndDate: Date | null = formData.endDate;
      if (selectedCourse && formData.startDate && formData.endDate) {
        const classRange = getCourseDateRange(selectedCourse.schedule, formData.startDate, formData.endDate);
        if (classRange) {
          useStartDate = classRange.classStart;
          useEndDate = classRange.classEnd;
          console.debug('[LeaveApplication] overriding leave start/end with course times', useStartDate, useEndDate);
        }
      }

      if (isEditMode && editId) {
        // if editing, use updateLeave; if it was rejected, student can resubmit by setting status to 'pending'
        response = await LeaveService.updateLeave(editId, {
          type: formData.leaveType,
          startDate: useStartDate!,
          endDate: useEndDate!,
          reason: formData.reason,
          attachments: formData.attachments,
          status: 'pending',
          reviewComment: undefined
        });
      } else {
        // Build course payload but omit any undefined fields to avoid Firestore addDoc() invalid data errors
        let coursePayload: { code: string; teacherUid?: string; teacherName?: string } | undefined = undefined;
        if (selectedCourse) {
          coursePayload = { code: selectedCourse.code };
          if (selectedCourse.teacherUid) coursePayload.teacherUid = selectedCourse.teacherUid;
          if (selectedCourse.teacherName) coursePayload.teacherName = selectedCourse.teacherName;
        }

        response = await LeaveService.createLeave({
          type: formData.leaveType,
          startDate: useStartDate!,
          endDate: useEndDate!,
          reason: formData.reason,
          attachments: formData.attachments,
          course: coursePayload
        });
      }

      if (response.success) {
        setFormData({
          leaveType: LeaveType.PERSONAL,
          startDate: null,
          endDate: null,
          reason: '',
          attachments: [],
        });
        navigate('/leave-list');
      } else {
        setError(response.error || '提交失敗，請稍後再試');
      }
    } catch (error: any) {
      console.error('提交請假申請時發生錯誤:', error);
      setError(error.message || '提交失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const removeExistingAttachment = (index: number) => {
    setExistingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Redirect teachers away from the application page
  React.useEffect(() => {
    const checkRole = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userDoc = await LeaveService.getUserDoc(user.uid);
        const userRole = userDoc?.role;
        if (userRole === 'teacher') {
          navigate('/leave-list');
        }
      } catch (err) {
        console.error('無法取得使用者角色', err);
      }
    };
    checkRole();
  }, [navigate]);

  // if editId exists, load existing leave
  React.useEffect(() => {
    const loadEdit = async () => {
      if (!editId) return;
      setIsEditMode(true);
      setLoading(true);
      try {
        const res = await LeaveService.getLeaveById(editId);
        if (res.success && res.data) {
          const d = res.data;
          const ensureDate = (v: any): Date | null => {
            if (!v) return null;
            if (v instanceof Date) return v;
            if (typeof v.toDate === 'function') return v.toDate();
            if (v.seconds) return new Date(v.seconds * 1000);
            try {
              return new Date(v);
            } catch (e) {
              return null;
            }
          };

          setFormData({
            leaveType: d.type as LeaveType,
            startDate: ensureDate(d.startDate),
            endDate: ensureDate(d.endDate),
            reason: d.reason,
            attachments: [] // new uploads (Files) go here; existing attachments (URLs) are shown separately
          });
          // populate existing attachment URLs so the editor can view them
          setExistingAttachments(Array.isArray(d.attachments) ? d.attachments : []);
          // If the loaded leave contains a course, prefill the selected course so the editor
          // sees the course selected immediately when editing.
          try {
            if (d.course) {
              let leaveCourseCode: string | undefined;
              let courseObj: any = undefined;
              if (typeof d.course === 'string') {
                leaveCourseCode = d.course;
                courseObj = { code: d.course, name: '', teacherUid: undefined, teacherName: undefined, schedule: undefined };
              } else if (d.course.code) {
                leaveCourseCode = d.course.code;
                courseObj = { code: d.course.code, name: d.course.name || '', teacherUid: d.course.teacherUid, teacherName: d.course.teacherName, schedule: (d.course as any).schedule } as any;
              }

              if (leaveCourseCode) {
                setSelectedCourseCode(leaveCourseCode);
                // ensure the availableCourses dropdown contains this course so it is visible to the user
                setAvailableCourses(prev => {
                  const exists = prev.find((p: any) => p.code === leaveCourseCode);
                  if (exists) return prev;
                  return courseObj ? [courseObj, ...prev] : prev;
                });
              }
            }
          } catch (e) {
            console.warn('prefilling selected course failed', e);
          }
        } else {
          setError(res.error || '無法載入請假紀錄');
        }
      } catch (err) {
        console.error('載入編輯資料失敗', err);
        setError('載入編輯資料失敗');
      } finally {
        setLoading(false);
      }
    };
    loadEdit();
  }, [editId]);

  const removeAttachment = (index: number) => {
    setFormData((prev: FormDataType) => ({
      ...prev,
      attachments: prev.attachments.filter((_: File, i: number) => i !== index)
    }));
  };

  return (
    <Box sx={{ maxWidth: 800, margin: '0 auto', pt: 3 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          請假申請
        </Typography>
        {error && (
          <div ref={alertRef}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          </div>
        )}
        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ display: 'grid', gap: 3 }}>
              <FormControl fullWidth required>
                <InputLabel id="leave-type-label">請假類型</InputLabel>
                <Select
                  labelId="leave-type-label"
                  id="leaveType"
                  name="leaveType"
                  value={formData.leaveType}
                  label="請假類型"
                  onChange={handleSelectChange}
                  disabled={loading}
                >
                  <MenuItem value="sick">病假</MenuItem>
                  <MenuItem value="personal">事假</MenuItem>
                  <MenuItem value="official">公假</MenuItem>
                </Select>
              </FormControl>
              {/* Course selection will appear after the leave time is chosen */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
                  <DateTimePicker
                    label="開始時間"
                    value={formData.startDate}
                    onChange={(newValue) => {
                      setRangeWarning(null);
                      setFormData(prev => {
                        const next = { ...prev, startDate: newValue };
                        if (!isEditMode && newValue && prev.endDate) {
                          const s = new Date(newValue as Date);
                          const e = new Date(prev.endDate as Date);
                          const maxEnd = addDays(s, MAX_LEAVE_DAYS);
                          if (e > maxEnd) {
                            setRangeWarning(`請假期間不得超過 ${MAX_LEAVE_DAYS} 天，結束時間已調整`);
                            next.endDate = maxEnd;
                          }
                        }
                        return next;
                      });
                    }}
                    disabled={loading || isEditMode}
                    slotProps={{ textField: { placeholder: '年/月/日', fullWidth: true } }}
                    sx={{ width: '100%' }}
                  />
                </LocalizationProvider>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
                  <DateTimePicker
                    label="結束時間"
                    value={formData.endDate}
                    onChange={(newValue) => {
                      setRangeWarning(null);
                      setFormData(prev => {
                        const next = { ...prev, endDate: newValue };
                        if (!isEditMode && prev.startDate && newValue) {
                          const s = new Date(prev.startDate as Date);
                          const e = new Date(newValue as Date);
                          const maxEnd = addDays(s, MAX_LEAVE_DAYS);
                          if (e > maxEnd) {
                            setRangeWarning(`請假期間不得超過 ${MAX_LEAVE_DAYS} 天，已自動調整至 ${maxEnd.toLocaleString()}`);
                            next.endDate = maxEnd;
                          }
                        }
                        return next;
                      });
                    }}
                    disabled={loading || isEditMode}
                    minDateTime={formData.startDate || undefined}
                    maxDateTime={formData.startDate ? addDays(formData.startDate, MAX_LEAVE_DAYS) : undefined}
                    slotProps={{ textField: { placeholder: '年/月/日', fullWidth: true } }}
                    sx={{ width: '100%' }}
                  />
                </LocalizationProvider>
                {rangeWarning && (
                  <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>{rangeWarning}</Typography>
                )}
              </Box>
              {/* After student selects start/end time, allow explicit confirmation to compute matching courses */}
              {!formData.startDate || !formData.endDate ? (
                <Typography variant="caption" color="textSecondary">
                  請先選擇請假時間後，按「確認時段」以列出在該時間內您所修的課程。
                </Typography>
              ) : (
                  <Box>
                    {isEditMode ? (
                      (() => {
                        // show read-only course info when editing
                        const sc = availableCourses.find(c => c.code === selectedCourseCode) || enrolledCourses.find(c => c.code === selectedCourseCode) || null;
                        return (
                          <Box>
                            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>已選課程</Typography>
                            <Typography sx={{ fontWeight: 700 }}>
                              {sc ? (
                                sc.code + (
                                  sc.name && sc.name !== sc.code ? '-' + sc.name : (
                                    sc.teacherName ? '-' + sc.teacherName : ''
                                  )
                                )
                              ) : (selectedCourseCode || '—')}
                            </Typography>
                            {sc?.schedule && (
                              <Typography variant="body2" color="textSecondary">
                                {typeof sc.schedule === 'string' ? sc.schedule : `${(sc.schedule as any).date} ${(sc.schedule as any).starttime}-${(sc.schedule as any).endtime}`}
                              </Typography>
                            )}
                            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>編輯模式：課程與請假時間不可變更</Typography>
                          </Box>
                        );
                      })()
                    ) : (
                      <>
                        <Box sx={{ mb: 1 }}>
                          <Button
                            variant="outlined"
                            onClick={async () => {
                              console.debug('[LeaveApplication] 確認時段 button clicked', { startDate, endDate, enrolledCount: enrolledCourses.length });
                              try {
                                setMatching(true);
                                const matches = await computeAvailableCourses();
                                console.debug('[LeaveApplication] computeAvailableCourses returned', matches?.length, matches);
                                if (!matches || matches.length === 0) {
                                  setError('系統未在您選擇的時間內找到對應的課程。');
                                  // scroll the alert into view so user notices the message
                                  setTimeout(() => {
                                    try { alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){}
                                  }, 50);
                                } else {
                                  setError('');
                                }
                              } catch (err) {
                                console.error('computeAvailableCourses failed', err);
                                setError('比對時發生錯誤，請稍後重試');
                              } finally {
                                setMatching(false);
                              }
                            }}
                            disabled={loading || matching}
                          >
                            {matching ? <CircularProgress size={16} /> : '確認時段'}
                          </Button>
                        </Box>
                        {availableCourses.length === 0 ? (
                          <Typography variant="caption" color="textSecondary">
                            在您按下確認後，若仍未找到任何已選課程，請確認時間或聯絡管理員。
                          </Typography>
                        ) : (
                          <FormControl fullWidth required>
                            <InputLabel id="course-select-label">選擇課程</InputLabel>
                            <Select
                              labelId="course-select-label"
                              id="courseSelect"
                              value={selectedCourseCode || ''}
                              label="選擇課程"
                              onChange={(e) => setSelectedCourseCode(e.target.value as string)}
                              disabled={loading || isEditMode}
                            >
                              {availableCourses.map((c) => (
                                <MenuItem key={c.code} value={c.code}>
                                  {c.code + (c.teacherName ? ' - ' + c.teacherName : (c.name && c.name !== c.code ? ' - ' + c.name : ''))} {c.schedule ? `(${c.schedule})` : ''}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      </>
                    )}
                  </Box>
              )}
              <TextField
                required
                fullWidth
                multiline
                rows={4}
                name="reason"
                label="請假原因"
                value={formData.reason}
                onChange={handleChange}
                disabled={loading}
              />
              <Box>
                <Button
                  variant="contained"
                  component="label"
                  sx={{ mr: 2 }}
                  disabled={loading}
                >
                  上傳附件
                  <input
                    type="file"
                    hidden
                    multiple
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={handleFileChange}
                  />
                </Button>
                <Typography variant="body2" color="textSecondary">
                  支援格式：JPG、PNG、PDF，單檔限制 10MB
                </Typography>
              </Box>
              {/* Show existing attachments (URLs) when editing */}
              {existingAttachments.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>已存在的附件：</Typography>
                  {existingAttachments.map((url, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, marginRight: 12 }}>請假證明 {idx + 1}</a>
                      <Button size="small" color="error" onClick={() => removeExistingAttachment(idx)}>移除</Button>
                    </Box>
                  ))}
                </Box>
              )}
              {formData.attachments.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    已上傳的附件：
                  </Typography>
                  {formData.attachments.map((file, index) => (
                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2">
                        {file.name}
                      </Typography>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => removeAttachment(index)}
                        sx={{ ml: 2 }}
                      >
                        移除
                      </Button>
                    </Box>
                  ))}
                </Box>
              )}
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : '提交申請'}
              </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default LeaveApplication;