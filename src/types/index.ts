// 使用者類型定義
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  studentId?: string;
  teacherId?: string;
}

// 請假類型定義
export interface LeaveApplication {
  id: string;
  studentId: string;
  studentName: string;
  type: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  attachments: string[];
  affectedCourses: Course[];
  createdAt: Date;
  updatedAt: Date;
}

// 課程類型定義
export interface Course {
  id: string;
  name: string;
  teacherId: string;
  teacherName: string;
  schedule: CourseSchedule[];
}

// 課程時間表類型定義
export interface CourseSchedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  period: number;
}

// 認證相關類型定義
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

// API 響應類型定義
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}