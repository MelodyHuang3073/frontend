import { 
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { LeaveApplication, ApiResponse, LeaveType } from '../types';

type FirestoreLeaveData = {
  userId: string;
  userName: string;
  type: LeaveType;
  startDate: Timestamp;
  endDate: Timestamp;
  reason: string;
  status: string;
  attachments: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp | null;
  reviewComment?: string;
  department?: string;
  studentId?: string;
  course?: string;
};

interface CreateLeaveRequest {
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
  attachments?: File[];
}

export class LeaveService {
  static async createLeave(data: CreateLeaveRequest): Promise<ApiResponse<LeaveApplication>> {
    try {
      const user = auth.currentUser;
      if (!user) {
        return {
          success: false,
          error: '請先登入系統'
        };
      }

      // 驗證請假類型
      if (!['sick', 'personal', 'official'].includes(data.type)) {
        return {
          success: false,
          error: '無效的請假類型'
        };
      }

      // Upload attachments if any
      const attachmentUrls: string[] = [];
      if (data.attachments) {
        for (const file of data.attachments) {
          try {
            // 驗證檔案類型
            if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
              throw new Error(`不支援的檔案類型: ${file.type}`);
            }

            // 驗證檔案大小
            if (file.size > 10 * 1024 * 1024) {
              throw new Error(`檔案大小超過限制: ${file.name}`);
            }

            const fileName = `${Date.now()}_${file.name}`;
            const storageRef = ref(storage, `leaves/${user.uid}/${fileName}`);
            
            console.log('開始上傳檔案:', fileName);
            console.log('檔案類型:', file.type);
            console.log('檔案大小:', file.size);
            
            const metadata = {
              contentType: file.type,
              customMetadata: {
                'originalName': file.name
              }
            };
            
            const snapshot = await uploadBytes(storageRef, file, metadata);
            console.log('檔案上傳成功');
            const downloadUrl = await getDownloadURL(snapshot.ref);
            attachmentUrls.push(downloadUrl);
          } catch (error: any) {
            console.error('檔案上傳錯誤:', error);
            if (error.code === 'storage/unauthorized') {
              throw new Error('沒有權限上傳檔案，請確認您已登入');
            } else if (error.code === 'storage/canceled') {
              throw new Error('檔案上傳被取消');
            } else if (error.code === 'storage/unknown') {
              throw new Error(`檔案上傳失敗: ${error.message}`);
            }
            throw new Error(`檔案 ${file.name} 上傳失敗: ${error.message}`);
          }
        }
      }

      const newLeaveData: FirestoreLeaveData = {
        userId: user.uid,
        userName: user.displayName || user.email || 'Unknown',
        type: data.type,
        startDate: Timestamp.fromDate(data.startDate),
        endDate: Timestamp.fromDate(data.endDate),
        reason: data.reason,
        status: 'pending',
        attachments: attachmentUrls,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'leaves'), newLeaveData);
      
      // 轉換為前端使用的格式
      const leaveApplication: LeaveApplication = {
        id: docRef.id,
        userId: newLeaveData.userId,
        userName: newLeaveData.userName,
        type: newLeaveData.type,
        startDate: newLeaveData.startDate.toDate(),
        endDate: newLeaveData.endDate.toDate(),
        reason: newLeaveData.reason,
        status: newLeaveData.status as any,
        attachments: newLeaveData.attachments,
        createdAt: newLeaveData.createdAt.toDate(),
        updatedAt: newLeaveData.updatedAt.toDate(),
        reviewedBy: newLeaveData.reviewedBy,
        reviewedAt: newLeaveData.reviewedAt ? newLeaveData.reviewedAt.toDate() : null,
        reviewComment: newLeaveData.reviewComment,
        department: newLeaveData.department,
        studentId: newLeaveData.studentId,
        course: newLeaveData.course
      };

      return {
        success: true,
        data: leaveApplication
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async getLeaves(): Promise<ApiResponse<LeaveApplication[]>> {
    try {
      const user = auth.currentUser;
      if (!user) {
        return {
          success: false,
          error: '請先登入系統'
        };
      }

      // 獲取當前用戶的角色
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      
      if (!userData) {
        return {
          success: false,
          error: '無法獲取用戶資訊'
        };
      }

      let q;
      if (userData.role === 'teacher') {
        // 教師可以看到所有請假申請
        q = query(
          collection(db, 'leaves'),
          orderBy('createdAt', 'desc')
        );
      } else {
        // 學生只能看到自己的請假申請
        q = query(
          collection(db, 'leaves'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
      }
      
      const querySnapshot = await getDocs(q);
      const leaves = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // 確保日期欄位正確轉換
          startDate: data.startDate.toDate(),
          endDate: data.endDate.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        };
      }) as LeaveApplication[];

      return {
        success: true,
        data: leaves
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async getLeaveById(id: string): Promise<ApiResponse<LeaveApplication>> {
    try {
      const docRef = doc(db, 'leaves', id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return {
          success: false,
          error: 'Leave application not found'
        };
      }

      const leaveApplication = {
        id: docSnap.id,
        ...docSnap.data()
      } as LeaveApplication;

      return {
        success: true,
        data: leaveApplication
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async updateLeaveStatus(
    id: string,
    status: 'approved' | 'rejected',
    comment?: string
  ): Promise<ApiResponse<LeaveApplication>> {
    try {
      const docRef = doc(db, 'leaves', id);
      await updateDoc(docRef, {
        status,
        comment,
        updatedAt: Timestamp.now()
      });

      return await LeaveService.getLeaveById(id);
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async deleteLeave(id: string): Promise<ApiResponse<void>> {
    try {
      const docRef = doc(db, 'leaves', id);
      await deleteDoc(docRef);
      return {
        success: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async getPendingLeaves(): Promise<ApiResponse<LeaveApplication[]>> {
    try {
      const q = query(
        collection(db, 'leaves'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const leaves = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeaveApplication[];

      return {
        success: true,
        data: leaves
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}