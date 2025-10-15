import { Timestamp } from 'firebase/firestore';

// API Response 類型定義
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 使用者類型定義
export interface User {
  uid: string;
  username: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  studentId?: string;
  teacherId?: string;
  createdAt: Date;
}

// 請假類型定義
export interface LeaveApplication {
  id: string;
  userId: string;
  userName: string;
  type: string;
  startDate: Timestamp;
  endDate: Timestamp;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  attachments: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
}