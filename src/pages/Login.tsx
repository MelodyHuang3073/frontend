import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Paper,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { AuthService } from '../services';
import { useNavigate, useLocation } from 'react-router-dom';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const location = useLocation();
  const registeredEmail = (location.state as any)?.email;
  const justRegistered = (location.state as any)?.registered;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await AuthService.login(formData);
      // If AuthService returns ApiResponse style
      if ((res as any)?.success === false) {
        throw new Error((res as any).error || '登入失敗');
      }
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('登入失敗，請檢查信箱密碼');
      }
    }
  };

  // forgot password dialog state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState(registeredEmail || formData.email || '');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const openReset = () => {
    setResetEmail(formData.email || registeredEmail || '');
    setResetError('');
    setResetSuccess('');
    setResetOpen(true);
  };

  const handleSendReset = async () => {
    setResetError('');
    setResetSuccess('');
    if (!resetEmail) {
      setResetError('請輸入註冊用的電子郵件');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSuccess('已發送重設密碼郵件，請到電子郵件收件匣查看。');
    } catch (err: any) {
      console.error('sendPasswordResetEmail error', err);
      switch (err?.code) {
        case 'auth/user-not-found':
          setResetError('找不到此電子郵件註冊的帳號');
          break;
        case 'auth/invalid-email':
          setResetError('電子郵件格式錯誤');
          break;
        default:
          setResetError(err?.message || '發送重設郵件失敗，請稍後再試');
      }
    } finally {
      setResetLoading(false);
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
            請假系統登入
          </Typography>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
            {justRegistered && registeredEmail && (
              <Alert severity="info" sx={{ mb: 2 }}>
                帳號已建立，系統已發送驗證郵件至 {registeredEmail}，請先完成電子郵件驗證再登入。
              </Alert>
            )}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="電子郵件"
              name="email"
              autoComplete="email"
              autoFocus
              type="email"
              value={formData.email}
              onChange={handleChange}
            />
            <Box sx={{ textAlign: 'right', mt: 1 }}>
              <Button variant="text" onClick={openReset}>忘記密碼？</Button>
            </Box>
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="密碼"
              type="password"
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              登入
            </Button>
            <Button
              fullWidth
              variant="text"
              onClick={() => navigate('/register')}
            >
              還沒有帳號？立即註冊
            </Button>
          </Box>
        </Paper>
      </Box>
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
        <DialogTitle>重設密碼</DialogTitle>
        <DialogContent>
          {resetError && <Alert severity="error" sx={{ mb: 1 }}>{resetError}</Alert>}
          {resetSuccess && <Alert severity="success" sx={{ mb: 1 }}>{resetSuccess}</Alert>}
          <TextField
            margin="normal"
            fullWidth
            label="電子郵件"
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)} disabled={resetLoading}>取消</Button>
          <Button onClick={handleSendReset} disabled={resetLoading} variant="contained">
            {resetLoading ? <CircularProgress size={18} /> : '發送重設郵件'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Login;