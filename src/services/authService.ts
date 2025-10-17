import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, ApiResponse } from '../types';

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  role: 'student' | 'teacher';
  studentId?: string;
}

export class AuthService {
  static async login({ email, password }: LoginCredentials): Promise<ApiResponse<User>> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        // 如果用戶文檔不存在，創建一個新的
        const newUserData: User = {
          uid: userCredential.user.uid,
          username: userCredential.user.displayName || email.split('@')[0],
          email: email,
          role: 'student', // 默認角色
          createdAt: new Date(),
          lastLoginAt: new Date(),
          loginCount: 1
        };
        
        await setDoc(doc(db, 'users', userCredential.user.uid), newUserData);
        return {
          success: true,
          data: newUserData
        };
      }

      // 如果用戶文檔存在，更新登入資訊
      const userData = userDoc.data() as User;
      const updatedUserData = {
        ...userData,
        lastLoginAt: new Date(),
        loginCount: (userData.loginCount || 0) + 1
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), updatedUserData);
      
      return {
        success: true,
        data: updatedUserData
      };
    } catch (error: any) {
      console.error('Login error:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code) || error.message
      };
    }
  }

  private static getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/invalid-email':
        return '無效的電子郵件格式';
      case 'auth/user-disabled':
        return '此帳號已被停用';
      case 'auth/user-not-found':
        return '找不到此帳號';
      case 'auth/wrong-password':
        return '密碼錯誤';
      case 'auth/too-many-requests':
        return '登入嘗試次數過多，請稍後再試';
      default:
        return '登入失敗，請稍後再試';
    }
  }

  static async register(data: RegisterData): Promise<ApiResponse<User>> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      
      const newUser: User = {
        uid: userCredential.user.uid,
        username: data.username,
        email: data.email,
        role: data.role as 'student' | 'teacher',
        studentId: data.studentId,
        createdAt: new Date()
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);

      return {
        success: true,
        data: newUser
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async logout(): Promise<ApiResponse<void>> {
    try {
      await signOut(auth);
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

  static async getCurrentUser(): Promise<ApiResponse<User | null>> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userData = userDoc.data() as User;
          resolve({
            success: true,
            data: userData
          });
        } else {
          resolve({
            success: true,
            data: null
          });
        }
      });
    });
  }
}