import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  role: string;
  studentId?: string;
}

export const AuthService = {
  login: async ({ email, password }: LoginCredentials): Promise<FirebaseUser> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // 檢查是否已驗證電子郵件
      if (!userCredential.user.emailVerified) {
        // 主動登出，並回報錯誤，要求使用者驗證電子郵件
        await auth.signOut();
        throw new Error('請先完成電子郵件驗證，才可登入');
      }
      return userCredential.user;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  register: async (data: RegisterData): Promise<FirebaseUser> => {
    try {
      // 創建 Firebase Auth 使用者
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      // 更新使用者資料
      await updateProfile(userCredential.user, {
        displayName: data.username
      });

      // 在 Firestore 中儲存額外的使用者資料
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        username: data.username,
        email: data.email,
        role: data.role,
        studentId: data.studentId,
        createdAt: new Date(),
      });

      return userCredential.user;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  logout: async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  getCurrentUser: (): FirebaseUser | null => {
    return auth.currentUser;
  },
};