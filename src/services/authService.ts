import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
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
  role: string;
  studentId?: string;
}

export class AuthService {
  static async login({ email, password }: LoginCredentials): Promise<ApiResponse<User>> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      const userData = userDoc.data() as User;
      
      return {
        success: true,
        data: userData
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async register(data: RegisterData): Promise<ApiResponse<User>> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      
      const newUser: User = {
        uid: userCredential.user.uid,
        username: data.username,
        email: data.email,
        role: data.role as 'student' | 'teacher' | 'admin',
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