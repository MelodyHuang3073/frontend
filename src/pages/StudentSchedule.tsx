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
} from '@mui/material';
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
                      scheduleItems.push({
                        courseCode: courseData.code || en.courseCode || '',
                        courseName: courseData.name || en.courseCode,
                        teacherName: it.teacherName || resolvedTeacherName || '',
                        weeks: it.weeks || it.week || courseData.weeks || courseData.week || '',
                        day: it.day || '',
                        startTime: it.startTime || it.start || '',
                        endTime: it.endTime || it.end || '',
                        location: it.location || courseData.location || '',
                      });
                    });
                  } else if (typeof courseData.schedule === 'string' && courseData.schedule.trim() !== '') {
                    // parse simple string format: "Mon 09:00-10:30"
                    const parts = (courseData.schedule as string).split(' ');
                    const day = parts[0] || '';
                    const times = parts[1] || '';
                    const [start, end] = times.split('-').map((t: string) => t || '');
                    scheduleItems.push({
                      courseCode: courseData.code || en.courseCode || '',
                      courseName: courseData.name || en.courseCode,
                      teacherName: resolvedTeacherName || '',
                      weeks: courseData.weeks || courseData.week || '',
                      day,
                      startTime: start,
                      endTime: end,
                      location: courseData.location || en.location || '',
                    });
                  } else {
                    // no schedule info available
                    scheduleItems.push({
                      courseCode: courseData.code || en.courseCode || '',
                      courseName: courseData.name || en.courseCode,
                      teacherName: resolvedTeacherName || en.teacherName || '',
                      weeks: courseData.weeks || courseData.week || '',
                      day: '',
                      startTime: '',
                      endTime: '',
                      location: courseData.location || en.location || '',
                    });
                  }
                } else {
                  // no course document — add a simple entry showing the course code and enrollment status/time
                  scheduleItems.push({
                    courseCode: en.courseCode || '',
                    courseName: en.courseCode,
                    teacherName: en.teacherName || '',
                    weeks: en.weeks || en.week || '',
                    day: '',
                    startTime: '',
                    endTime: '',
                    location: en.location || '',
                  });
                }
              } catch (innerErr) {
                console.warn('failed to enrich course', en.courseCode, innerErr);
                scheduleItems.push({
                  courseCode: en.courseCode || '',
                  courseName: en.courseCode,
                  teacherName: en.teacherName || '',
                  weeks: en.weeks || en.week || '',
                  day: '',
                  startTime: '',
                  endTime: '',
                  location: en.location || '',
                });
              }
            }));

            if (scheduleItems.length > 0) {
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
            <Paper sx={{ mt: 2, p: 2 }}>
              <Typography color="text.secondary">暫無選課資訊</Typography>
            </Paper>
          ) : (
            <Paper sx={{ mt: 2, p: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>課程代碼</TableCell>
                    <TableCell>課程名稱</TableCell>
                    <TableCell>授課教師</TableCell>
                    <TableCell>星期</TableCell>
                    <TableCell>開始時間</TableCell>
                    <TableCell>結束時間</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {schedule.map((s, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{s.courseCode || '-'}</TableCell>
                      <TableCell>{s.courseName || '-'}</TableCell>
                      <TableCell>{s.teacherName || '-'}</TableCell>
                      <TableCell>{formatWeekday(s.day)}</TableCell>
                      <TableCell>{s.startTime || '-'}</TableCell>
                      <TableCell>{s.endTime || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
};

export default StudentSchedule;
