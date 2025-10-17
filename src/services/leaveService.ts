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
      if (data.attachments && data.attachments.length > 0) {
        for (const file of data.attachments) {
          // 驗證檔案類型
          if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
            return { success: false, error: `不支援的檔案類型: ${file.type}` };
          }
          // 驗證檔案大小
          if (file.size > 10 * 1024 * 1024) {
            return { success: false, error: `檔案大小超過限制: ${file.name}` };
          }

          const fileName = `${Date.now()}_${file.name}`;
          const storageRef = ref(storage, `leaves/${user.uid}/${fileName}`);
          try {
            const snapshot = await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(snapshot.ref);
            attachmentUrls.push(downloadUrl);
          } catch (error: any) {
            console.error('檔案上傳錯誤:', error);
            return { success: false, error: error.message || '檔案上傳失敗' };
          }
        }
      }

      // Build a clean payload object (only defined, serializable fields)
  const newLeaveData: Partial<FirestoreLeaveData> = {
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


      // remove undefined fields just in case (use any to avoid TS index errors)
      Object.keys(newLeaveData).forEach(k => {
        if ((newLeaveData as any)[k] === undefined) delete (newLeaveData as any)[k];
      });

      let docRef;
      try {
        docRef = await addDoc(collection(db, 'leaves'), newLeaveData);
      } catch (err: any) {
        // Log detailed error for debugging (Firestore client can return complex errors)
        try {
          console.error('Firestore addDoc error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
        } catch (jsonErr) {
          console.error('Firestore addDoc error (no JSON):', err);
        }
        throw err;
      }

      // read back the created document to build a strongly-typed response
      const createdSnap = await getDoc(docRef);
      const createdData: any = createdSnap.exists() ? createdSnap.data() : {};
      const toDate = (v: any) => (v && typeof v.toDate === 'function' ? v.toDate() : v);
      const leaveApplication: LeaveApplication = {
        id: docRef.id,
        userId: createdData.userId,
        userName: createdData.userName,
        type: createdData.type,
        startDate: toDate(createdData.startDate),
        endDate: toDate(createdData.endDate),
        reason: createdData.reason,
        status: createdData.status,
        attachments: createdData.attachments || [],
        createdAt: toDate(createdData.createdAt),
        updatedAt: toDate(createdData.updatedAt),
        reviewedBy: createdData.reviewedBy,
        reviewedAt: createdData.reviewedAt ? toDate(createdData.reviewedAt) : null,
        reviewComment: createdData.reviewComment,
        department: createdData.department,
        studentId: createdData.studentId,
        course: createdData.course
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

  static async updateLeave(id: string, data: Partial<CreateLeaveRequest> & { status?: string, reviewComment?: string }): Promise<ApiResponse<LeaveApplication>> {
    try {
      const docRef = doc(db, 'leaves', id);
      const updatePayload: any = {
        updatedAt: Timestamp.now()
      };

      if (data.type) updatePayload.type = data.type;
      if (data.startDate) updatePayload.startDate = Timestamp.fromDate(data.startDate);
      if (data.endDate) updatePayload.endDate = Timestamp.fromDate(data.endDate);
      if (data.reason) updatePayload.reason = data.reason;
      if (data.status) updatePayload.status = data.status;
      if (data.reviewComment !== undefined) updatePayload.reviewComment = data.reviewComment;

      await updateDoc(docRef, updatePayload);

      // If attachments were provided, upload and append URLs
      if (data.attachments && data.attachments.length > 0) {
        const user = auth.currentUser;
        if (!user) return { success: false, error: '請先登入' };
        const urls: string[] = [];
        for (const file of data.attachments) {
          const fileName = `${Date.now()}_${file.name}`;
          const storageRef = ref(storage, `leaves/${user.uid}/${fileName}`);
          const snapshot = await uploadBytes(storageRef, file);
          const downloadUrl = await getDownloadURL(snapshot.ref);
          urls.push(downloadUrl);
        }
        // merge with existing attachments (don't overwrite unintentionally)
        const docSnap = await getDoc(docRef);
        const existing: any = docSnap.exists() ? (docSnap.data() as any).attachments || [] : [];
        const merged = existing.concat(urls);
        await updateDoc(docRef, { attachments: merged });
      }

      return await LeaveService.getLeaveById(id);
    } catch (error: any) {
      return { success: false, error: error.message };
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

  static async getUserDoc(uid: string): Promise<any> {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      return userSnap.exists() ? userSnap.data() : null;
    } catch (error: any) {
      console.error('getUserDoc error', error);
      return null;
    }
  }
}