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
import { LeaveApplication, ApiResponse } from '../../types';

interface CreateLeaveRequest {
  type: string;
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

      const newLeave: Omit<LeaveApplication, 'id'> = {
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
        ...newLeave
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

      const q = query(
        collection(db, 'leaves'),
        where('userId', '==', user.uid),
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
};