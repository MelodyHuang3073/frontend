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
  lastLoginAt?: Date;
  loginCount?: number;
  updatedAt?: Date;
  status?: 'active' | 'inactive' | 'suspended';
  avatarUrl?: string;
  department?: string;
}

// 請假類型定義
export enum LeaveType {
  SICK = 'sick',
  PERSONAL = 'personal',
  OFFICIAL = 'official'
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

// Firestore 中的請假申請資料結構
export interface LeaveApplicationFirestore {
  id: string;
  userId: string;
  userName: string;
  type: LeaveType;
  startDate: Timestamp;
  endDate: Timestamp;
  reason: string;
  status: LeaveStatus;
  attachments: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  reviewComment?: string;
  department?: string;
  studentId?: string;
}

// 前端使用的請假申請資料結構
export interface LeaveApplication {
  id: string;
  userId: string;
  userName: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: LeaveStatus;
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date | null;
  reviewComment?: string;
  department?: string;
  studentId?: string;
  course?: string;
}

// 前端使用的請假申請資料結構
export interface LeaveApplication {
  id: string;
  userId: string;
  userName: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: LeaveStatus;
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date | null;
  reviewComment?: string;
  department?: string;
  studentId?: string;
  course?: string;
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