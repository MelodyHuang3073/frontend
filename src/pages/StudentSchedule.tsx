import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Alert,
  TableContainer,
  Stack,
  Divider,
  IconButton,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, query, where, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';

type ScheduleItem = {
  courseName: string;
  courseCode?: string;
  teacherName?: string;
  day: string; // e.g., 'Mon'
  startTime: string; // e.g., '09:00'
  endTime: string; // e.g., '10:20'
  location?: string;
  locationSource?: string;
  weeks?: string; // e.g., '1-16'
};

const sampleSchedule: ScheduleItem[] = [
  { courseCode: 'CS101', courseName: '計算機概論', teacherName: '張老師', weeks: '1-16', day: 'Mon', startTime: '09:00', endTime: '10:30', location: 'A101' },
  { courseCode: 'CS102', courseName: '資料結構', teacherName: '李老師', weeks: '1-16', day: 'Tue', startTime: '10:40', endTime: '12:10', location: 'B202' },
  { courseCode: 'MA201', courseName: '線性代數', teacherName: '王老師', weeks: '1-16', day: 'Wed', startTime: '13:30', endTime: '15:00', location: 'C303' },
];

// helper to display day-of-week in Chinese
const formatWeekday = (d?: string) => {
  if (!d) return '-';
  const key = d.trim().toLowerCase();
  const map: Record<string, string> = {
    mon: '星期一',
    monday: '星期一',
    tue: '星期二',
    tues: '星期二',
    tuesday: '星期二',
    wed: '星期三',
    wednesday: '星期三',
    thu: '星期四',
    thur: '星期四',
    thurs: '星期四',
    thursday: '星期四',
    fri: '星期五',
    friday: '星期五',
    sat: '星期六',
    saturday: '星期六',
    sun: '星期日',
    sunday: '星期日',
  };
  // if string already contains Chinese numerals like '星期一' or '週一'
  if (d.includes('星期') || d.includes('週') || d.includes('周')) return d;
  return map[key] || d;
};

// convert various weekday strings to an order number (Mon=1 .. Sun=7). Unknown => 8
const weekdayOrder = (d?: string) => {
  if (!d) return 8;
  const s = d.trim().toLowerCase();
  // english keys
  if (/^mon(day)?$/.test(s) || s === 'mon') return 1;
  if (/^tue(s(day)?)?$/.test(s) || /^tues?$/.test(s)) return 2;
  if (/^wed(nesday)?$/.test(s) || s === 'wed') return 3;
  if (/^thu(rs(day)?)?$/.test(s) || /^thurs?$/.test(s)) return 4;
  if (/^fri(day)?$/.test(s) || s === 'fri') return 5;
  if (/^sat(urday)?$/.test(s) || s === 'sat') return 6;
  if (/^sun(day)?$/.test(s) || s === 'sun') return 7;
  // chinese keys: 星期一/週一/周一 etc.
  if (s.includes('星期') || s.includes('週') || s.includes('周')) {
    if (s.includes('一')) return 1;
    if (s.includes('二')) return 2;
    if (s.includes('三')) return 3;
    if (s.includes('四')) return 4;
    if (s.includes('五')) return 5;
    if (s.includes('六')) return 6;
    if (s.includes('日') || s.includes('天')) return 7;
  }
  return 8;
};

const toMinutes = (t?: string) => {
  if (!t) return 24 * 60; // end of day
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 24 * 60;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  return hh * 60 + mm;
};

// resolve location from various possible fields on schedule entry, course or enrollment
// returns { value, source } where source indicates which field provided the value
const resolveLocation = (it?: any, courseData?: any, en?: any) => {
  const fields: Array<{ value: any; source: string }> = [
    // schedule entry variants
    { value: it?.location, source: 'schedule.location' },
    { value: it?.locatoin, source: 'schedule.locatoin' },
    { value: it?.locaton, source: 'schedule.locaton' },
    { value: it?.room, source: 'schedule.room' },
    { value: it?.venue, source: 'schedule.venue' },
    { value: it?.classroom, source: 'schedule.classroom' },
    // course document variants
    { value: courseData?.location, source: 'course.location' },
    { value: courseData?.locatoin, source: 'course.locatoin' },
    { value: courseData?.locaton, source: 'course.locaton' },
    { value: courseData?.room, source: 'course.room' },
    { value: courseData?.venue, source: 'course.venue' },
    { value: courseData?.classroom, source: 'course.classroom' },
    { value: courseData?.locationName, source: 'course.locationName' },
    { value: courseData?.place, source: 'course.place' },
    // enrollment variants
    { value: en?.location, source: 'enrollment.location' },
    { value: en?.locatoin, source: 'enrollment.locatoin' },
    { value: en?.locaton, source: 'enrollment.locaton' },
    { value: en?.room, source: 'enrollment.room' },
    { value: en?.venue, source: 'enrollment.venue' },
    { value: en?.classroom, source: 'enrollment.classroom' },
  ];
  for (const f of fields) {
    if (typeof f.value === 'string' && f.value.trim() !== '') return { value: f.value.trim(), source: f.source };
  }
  return { value: '', source: '' };
};

const StudentSchedule: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [hasEnrollments, setHasEnrollments] = useState<boolean | null>(null);

  useEffect(() => {
    let unsub = () => {};

    const init = async () => {
      setLoading(true);
      setError(null);

      unsub = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setError('請先登入以檢視課表');
          setLoading(false);
          return;
        }

        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (!userDoc.exists()) {
            setError('找不到使用者資料');
            setLoading(false);
            return;
          }
          const userData = userDoc.data() as any;

          if (userData.role !== 'student') {
            setError('此頁面僅供學生使用');
            setLoading(false);
            return;
          }

          const studentId = userData.studentId;
          if (!studentId) {
            setError('學生資料中沒有學號，無法取得課表');
            setLoading(false);
            return;
          }

          // 同步抓取學生的選課紀錄 (collection: enrollments, filter by userId)
          let enrollData: any[] = [];
          try {
            const enrollQ = query(collection(db, 'enrollments'), where('userId', '==', user.uid));
            const enrollSnap = await getDocs(enrollQ);
            enrollData = enrollSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
            setHasEnrollments(enrollData.length > 0);
            // if student has no enrollments, show a friendly message instead of sample data
            if (enrollData.length === 0) {
              setSchedule([]);
              setLoading(false);
              return;
            }
          } catch (enErr) {
            console.warn('無法取得選課紀錄:', enErr);
            // 不阻斷主要流程，僅記錄警告
          }

          // Build schedule from enrollments: for each enrollment try to enrich from `courses` collection
          // Use a small in-memory cache and a permission-disabled flag so we don't repeatedly
          // attempt teacher lookups if Firestore rules disallow reading `users` documents.
          const teacherNameCache = new Map<string, string>();
          let teacherLookupDisabled = false;
          try {
            const scheduleItems: ScheduleItem[] = [];

            await Promise.all(enrollData.map(async (en) => {
              // try direct course doc by id (courseCode as id)
              try {
                const courseRef = doc(db, 'course', en.courseCode);
                const courseDoc = await getDoc(courseRef);
                let courseData: any = null;
                if (courseDoc.exists()) {
                  courseData = courseDoc.data();
                } else {
                  // fallback: query courses where courseCode == en.courseCode
                  const cq = query(collection(db, 'course'), where('code', '==', en.courseCode));
                  const cSnap = await getDocs(cq);
                  if (!cSnap.empty) courseData = cSnap.docs[0].data();
                }

                if (courseData) {
                  // try to resolve teacher name from courseData.userId if available
                  let resolvedTeacherName = courseData.teacherName || en.teacherName || '';
                  try {
                    const teacherUid = courseData.userId || courseData.teacherUid || courseData.user || null;
                    if (teacherUid && !teacherLookupDisabled) {
                      // use cache if we already resolved this teacher in this run
                      if (teacherNameCache.has(teacherUid)) {
                        resolvedTeacherName = teacherNameCache.get(teacherUid) || resolvedTeacherName;
                      } else {
                        try {
                          const teacherDoc = await getDoc(doc(db, 'users', teacherUid));
                          if (teacherDoc.exists()) {
                            const tdata: any = teacherDoc.data();
                            const name = tdata.username || tdata.displayName || resolvedTeacherName;
                            teacherNameCache.set(teacherUid, name);
                            resolvedTeacherName = name;
                          }
                        } catch (teacherErr) {
                          console.warn('無法取得授課教師資訊', teacherErr);
                          if ((teacherErr as any)?.code === 'permission-denied') {
                            // stop further attempts for other teachers in this run
                            teacherLookupDisabled = true;
                          }
                        }
                      }
                    }
                  } catch (wrapErr) {
                    console.warn('教師查詢時發生錯誤', wrapErr);
                  }

                  // schedule can be an array or a single string like "Mon 09:00-10:30"
                  if (Array.isArray(courseData.schedule) && courseData.schedule.length > 0) {
                    courseData.schedule.forEach((it: any) => {
                      const loc = resolveLocation(it, courseData, en);
                      scheduleItems.push({
                        courseCode: courseData.code || en.courseCode || '',
                        courseName: courseData.name || en.courseCode,
                        teacherName: it.teacherName || resolvedTeacherName || '',
                        weeks: it.weeks || it.week || courseData.weeks || courseData.week || '',
                        day: it.day || '',
                        startTime: it.startTime || it.start || '',
                        endTime: it.endTime || it.end || '',
                        location: loc.value,
                        locationSource: loc.source,
                      });
                    });
                  } else if (typeof courseData.schedule === 'string' && courseData.schedule.trim() !== '') {
                    // parse simple string format: "Mon 09:00-10:30"
                    const parts = (courseData.schedule as string).split(' ');
                    const day = parts[0] || '';
                    const times = parts[1] || '';
                    const [start, end] = times.split('-').map((t: string) => t || '');
                    const loc2 = resolveLocation(null, courseData, en);
                    scheduleItems.push({
                      courseCode: courseData.code || en.courseCode || '',
                      courseName: courseData.name || en.courseCode,
                      teacherName: resolvedTeacherName || '',
                      weeks: courseData.weeks || courseData.week || '',
                      day,
                      startTime: start,
                      endTime: end,
                      location: loc2.value,
                      locationSource: loc2.source,
                    });
                  } else {
                    // no schedule info available
                    const loc3 = resolveLocation(null, courseData, en);
                    scheduleItems.push({
                      courseCode: courseData.code || en.courseCode || '',
                      courseName: courseData.name || en.courseCode,
                      teacherName: resolvedTeacherName || en.teacherName || '',
                      weeks: courseData.weeks || courseData.week || '',
                      day: '',
                      startTime: '',
                      endTime: '',
                      location: loc3.value,
                      locationSource: loc3.source,
                    });
                  }
                } else {
                  // no course document — add a simple entry showing the course code and enrollment status/time
                  const loc4 = resolveLocation(null, null, en);
                  scheduleItems.push({
                    courseCode: en.courseCode || '',
                    courseName: en.courseCode,
                    teacherName: en.teacherName || '',
                    weeks: en.weeks || en.week || '',
                    day: '',
                    startTime: '',
                    endTime: '',
                    location: loc4.value,
                    locationSource: loc4.source,
                  });
                }
              } catch (innerErr) {
                console.warn('failed to enrich course', en.courseCode, innerErr);
                const loc5 = resolveLocation(null, null, en);
                scheduleItems.push({
                  courseCode: en.courseCode || '',
                  courseName: en.courseCode,
                  teacherName: en.teacherName || '',
                  weeks: en.weeks || en.week || '',
                  day: '',
                  startTime: '',
                  endTime: '',
                  location: loc5.value,
                  locationSource: loc5.source,
                });
              }
            }));

            if (scheduleItems.length > 0) {
              // sort by weekday (Mon..Sun) then by start time
              scheduleItems.sort((a, b) => {
                const da = weekdayOrder(a.day);
                const db = weekdayOrder(b.day);
                if (da !== db) return da - db;
                const ta = toMinutes(a.startTime);
                const tb = toMinutes(b.startTime);
                return ta - tb;
              });
              setSchedule(scheduleItems);
              setLoading(false);
              return;
            }
          } catch (buildErr) {
            console.warn('建立課表時發生錯誤:', buildErr);
          }

          // fallback to sample data
          setSchedule(sampleSchedule);
          setLoading(false);
        } catch (err: any) {
          console.error('取得課表時發生錯誤', err);
          // Firebase 權限錯誤處理
          if (err?.code === 'permission-denied') {
            setError('無權限存取課表資料；若您是學生請通知學校/管理員開啟讀取權限，系統將顯示範例課表。');
            // 顯示範例資料作為 fallback
            setSchedule(sampleSchedule);
            setLoading(false);
            return;
          }

          setError('取得課表失敗，請稍後再試');
          setLoading(false);
        }
      });
    };

    init();

    return () => unsub();
  }, []);

  // Print helper: open a new window with a simple table and call print
  const printSchedule = (rows: ScheduleItem[]) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const style = `
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
      th { background: #f3f6fb; }
    `;
    const html = `
      <html>
      <head>
        <title>我的課表</title>
        <style>${style}</style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>課程代碼</th>
              <th>課程名稱</th>
              <th>授課教師</th>
              <th>星期</th>
              <th>開始</th>
              <th>結束</th>
              <th>地點</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.courseCode||''}</td>
                <td>${r.courseName||''}</td>
                <td>${r.teacherName||''}</td>
                <td>${formatWeekday(r.day)||''}</td>
                <td>${r.startTime||''}</td>
                <td>${r.endTime||''}</td>
                <td>${r.location||''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      w.print();
    }, 300);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        我的課表
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && (
        <>
          {hasEnrollments === false ? (
            <Paper sx={{ mt: 2, p: 4, textAlign: 'center' }} elevation={0}>
              <Typography variant="h6" color="text.secondary">暫無選課資訊</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                系統目前查無您的選課紀錄，請確認選課狀態或聯絡系辦。
              </Typography>
            </Paper>
          ) : (
            <Paper sx={{ mt: 2, p: 2 }} elevation={1}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Stack>
                  <Typography variant="body2" color="text.secondary">顯示本學期選課時間表</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton size="small" onClick={() => printSchedule(schedule)} aria-label="print">
                      <PrintIcon />
                    </IconButton>
                </Stack>
              </Stack>
              <Divider sx={{ mb: 1 }} />
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>課程</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>授課教師</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>星期</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>時間</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>地點</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {schedule.map((s, idx) => (
                      <TableRow
                        key={idx}
                        sx={{
                          '&:nth-of-type(odd)': { backgroundColor: 'action.hover' },
                          '&:hover': { backgroundColor: 'action.selected' },
                        }}
                      >
                        <TableCell>
                          <Stack>
                            <Typography variant="subtitle2">{s.courseCode || '-'}</Typography>
                            <Typography variant="body2" color="text.secondary">{s.courseName || '-'}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{s.teacherName || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{formatWeekday(s.day)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{s.startTime || '-'} — {s.endTime || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{s.location || '-'}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
};

export default StudentSchedule;
