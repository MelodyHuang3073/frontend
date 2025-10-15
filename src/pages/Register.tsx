import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Paper,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  SelectChangeEvent,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    studentId: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // 如果從學生改為教師，清除學號
      ...(name === 'role' && value !== 'student' ? { studentId: '' } : {})
    }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // 基本驗證
    if (!formData.username || !formData.email || !formData.password || !formData.role) {
      setError('請填寫所有必填欄位');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('密碼與確認密碼不符');
      return;
    }

    if (formData.password.length < 6) {
      setError('密碼長度至少需要6個字元');
      return;
    }

    if (formData.role === 'student' && !formData.studentId) {
      setError('學生必須填寫學號');
      return;
    }

    setLoading(true);

    try {
      // 郵箱格式驗證
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('請輸入有效的電子郵件地址');
        return;
      }

      // 密碼強度驗證
      if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/.test(formData.password)) {
        setError('密碼必須至少包含6個字符，包括字母和數字');
        return;
      }

      // 創建 Firebase Auth 用戶
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // 更新用戶顯示名稱
      await updateProfile(userCredential.user, {
        displayName: formData.username
      });

      // 在 Firestore 中創建用戶檔案
      const userData = {
        uid: userCredential.user.uid,
        username: formData.username,
        email: formData.email,
        role: formData.role,
        studentId: formData.role === 'student' ? formData.studentId : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), userData);

      // 註冊成功，導航到登入頁面
      navigate('/login');
    } catch (err: any) {
      console.error('註冊錯誤:', err);
      console.log('Firebase error code:', err.code); // 添加錯誤碼日誌
      switch (err.code) {
        case 'auth/email-already-in-use':
          setError('此電子郵件已被註冊');
          break;
        case 'auth/invalid-email':
          setError('無效的電子郵件格式');
          break;
        case 'auth/operation-not-allowed':
          setError('電子郵件/密碼註冊功能尚未啟用，請聯繫系統管理員');
          console.error('需要在 Firebase Console 中啟用 Email/Password 驗證方式');
          break;
        case 'auth/weak-password':
          setError('密碼強度不足');
          break;
        case 'auth/network-request-failed':
          setError('網路連接失敗，請檢查網路連接');
          break;
        case 'auth/configuration-not-found':
          setError('Firebase 配置錯誤，請確認專案設定');
          console.error('請確認 Firebase 配置是否正確，並且已啟用必要的服務');
          break;
        default:
          console.error('Unexpected error:', err);
          setError(err.message || '註冊失敗，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Typography component="h1" variant="h5">
            註冊帳號
          </Typography>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="使用者名稱"
              name="username"
              autoFocus
              value={formData.username}
              onChange={handleInputChange}
              disabled={loading}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="電子郵件"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              disabled={loading}
            />
            <FormControl fullWidth margin="normal" required>
              <InputLabel id="role-label">角色</InputLabel>
              <Select
                labelId="role-label"
                id="role"
                name="role"
                value={formData.role}
                label="角色"
                onChange={handleSelectChange}
                disabled={loading}
                error={formData.role === '' && Boolean(error)}
              >
                <MenuItem value="student">學生</MenuItem>
                <MenuItem value="teacher">教師</MenuItem>
              </Select>
            </FormControl>
            {formData.role === 'student' && (
              <TextField
                margin="normal"
                required
                fullWidth
                id="studentId"
                label="學號"
                name="studentId"
                value={formData.studentId}
                onChange={handleInputChange}
                disabled={loading}
              />
            )}
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="密碼"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              disabled={loading}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="確認密碼"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              disabled={loading}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : '註冊'}
            </Button>
            <Button
              fullWidth
              variant="text"
              onClick={() => navigate('/login')}
              disabled={loading}
            >
              已有帳號？前往登入
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Register;