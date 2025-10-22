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
import { db, storage, auth } from '../../firebase';
import { LeaveApplication, LeaveApplicationFirestore, LeaveType, ApiResponse } from '../../types';

interface CreateLeaveRequest {
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
  attachments?: File[];
}

export const LeaveService = {
  createLeave: async (data: CreateLeaveRequest): Promise<ApiResponse<LeaveApplication>> => {
    try {
      const user = auth.currentUser;
      if (!user) {
        return {
          success: false,
          error: 'User not authenticated'
        };
      }

      // Upload attachments if any
      const attachmentUrls: string[] = [];
      if (data.attachments) {
        for (const file of data.attachments) {
          const storageRef = ref(storage, `leaves/${user.uid}/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const downloadUrl = await getDownloadURL(storageRef);
          attachmentUrls.push(downloadUrl);
        }
      }

      const newLeave: LeaveApplicationFirestore = {
        id: '', // Will be set after document creation
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

      const docRef = await addDoc(collection(db, 'leaves'), newLeave);
      const leaveApplication: LeaveApplication = {
        id: docRef.id,
        userId: newLeave.userId,
        userName: newLeave.userName,
        type: newLeave.type,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: newLeave.reason,
        status: newLeave.status,
        attachments: newLeave.attachments,
        createdAt: new Date(),
        updatedAt: new Date(),
        reviewedBy: undefined,
        reviewedAt: null,
        reviewComment: undefined,
        department: undefined,
        studentId: undefined
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
  },

  getLeaves: async (): Promise<ApiResponse<LeaveApplication[]>> => {
    try {
      const user = auth.currentUser;
      if (!user) {
        return {
          success: false,
          error: 'User not authenticated'
        };
      }

      // Determine user role and query accordingly
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      if (!userData) {
        console.warn(`LeaveService.getLeaves: no users/${user.uid} document found — assuming student role`);
      }

      const role = (userData && userData.role) ? userData.role : 'student';

      let q;
      if (role === 'teacher') {
        // teachers see all leaves
        q = query(collection(db, 'leaves'), orderBy('createdAt', 'desc'));
      } else {
        // students see only their own leaves
        q = query(
          collection(db, 'leaves'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);
      const leaves = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data() as any;
        const toDate = (v: any) => (v && typeof v.toDate === 'function' ? v.toDate() : v);
        return {
          id: docSnap.id,
          userId: data.userId,
          userName: data.userName,
          type: data.type,
          startDate: toDate(data.startDate),
          endDate: toDate(data.endDate),
          reason: data.reason,
          status: data.status,
          attachments: data.attachments || [],
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
          reviewedBy: data.reviewedBy,
          reviewedAt: data.reviewedAt ? toDate(data.reviewedAt) : null,
          reviewComment: data.reviewComment,
          department: data.department,
          studentId: data.studentId,
          course: data.course
        } as LeaveApplication;
      });

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
  },

  getLeaveById: async (id: string): Promise<ApiResponse<LeaveApplication>> => {
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
  },

  updateLeaveStatus: async (
    id: string,
    status: 'approved' | 'rejected',
    comment?: string
  ): Promise<ApiResponse<LeaveApplication>> => {
    try {
      const docRef = doc(db, 'leaves', id);
      await updateDoc(docRef, {
        status,
        reviewComment: comment,
        updatedAt: Timestamp.now()
      });

      // create a notification document so a backend worker / cloud function can send an email
      try {
        const leaveSnap = await getDoc(docRef);
        if (leaveSnap.exists()) {
          const leaveData: any = leaveSnap.data();
          const recipientUid = leaveData.userId;
          const recipientEmail = leaveData.userEmail || leaveData.userName || null;
          await addDoc(collection(db, 'notifications'), {
            toUid: recipientUid,
            toEmail: recipientEmail,
            leaveId: id,
            status,
            comment,
            createdAt: Timestamp.now(),
            sent: false
          });
        }
      } catch (notifyErr) {
        console.warn('建立通知文件失敗（非致命）:', notifyErr);
      }

      return await LeaveService.getLeaveById(id);
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  deleteLeave: async (id: string): Promise<ApiResponse<void>> => {
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
  },

  updateLeave: async (id: string, data: Partial<CreateLeaveRequest> & { status?: string, reviewComment?: string }): Promise<ApiResponse<LeaveApplication>> => {
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

      if (data.attachments && data.attachments.length > 0) {
        const user = auth.currentUser;
        if (!user) return { success: false, error: 'User not authenticated' };
        const urls: string[] = [];
        for (const file of data.attachments) {
          const storageRef = ref(storage, `leaves/${user.uid}/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          const downloadUrl = await getDownloadURL(snapshot.ref);
          urls.push(downloadUrl);
        }
        await updateDoc(docRef, { attachments: urls });
      }

      // return fresh doc
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return { success: false, error: 'Leave not found after update' };
      const dataSnap: any = docSnap.data();
      const toDate = (v: any) => (v && typeof v.toDate === 'function' ? v.toDate() : v);
      const leave: LeaveApplication = {
        id: docSnap.id,
        userId: dataSnap.userId,
        userName: dataSnap.userName,
        type: dataSnap.type,
        startDate: toDate(dataSnap.startDate),
        endDate: toDate(dataSnap.endDate),
        reason: dataSnap.reason,
        status: dataSnap.status,
        attachments: dataSnap.attachments || [],
        createdAt: toDate(dataSnap.createdAt),
        updatedAt: toDate(dataSnap.updatedAt),
        reviewedBy: dataSnap.reviewedBy,
        reviewedAt: dataSnap.reviewedAt ? toDate(dataSnap.reviewedAt) : null,
        reviewComment: dataSnap.reviewComment,
        department: dataSnap.department,
        studentId: dataSnap.studentId,
        course: dataSnap.course
      };

      return { success: true, data: leave };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  getPendingLeaves: async (): Promise<ApiResponse<LeaveApplication[]>> => {
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
  ,
  getUserDoc: async (uid: string): Promise<any> => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      return userSnap.exists() ? userSnap.data() : null;
    } catch (error: any) {
      console.error('getUserDoc error', error);
      return null;
    }
  }
};