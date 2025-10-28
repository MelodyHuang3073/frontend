import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, TextField, Button, Alert, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { LeaveService } from '../services/leaveService';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [userDoc, setUserDoc] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const u = auth.currentUser;
      if (!u) {
        navigate('/login');
        return;
      }
      try {
        const doc = await LeaveService.getUserDoc(u.uid);
        setUserDoc({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          ...(doc || {})
        });
      } catch (err) {
        console.error('Failed to load user doc', err);
        setError('無法取得使用者資料');
      }
    };
    load();
  }, [navigate]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPwd || !newPwd || !confirmPwd) {
      setError('請填寫所有欄位');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError('新密碼與確認密碼不相符');
      return;
    }
    if (newPwd.length < 8) {
      setError('新密碼需至少 8 個字元');
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) {
      setError('使用者未登入或無有效電子郵件');
      return;
    }

    setPwLoading(true);
    try {
      // Reauthenticate with current password
      const cred = EmailAuthProvider.credential(user.email, currentPwd);
      await reauthenticateWithCredential(user, cred);
      // Update password
      await updatePassword(user, newPwd);
      setSuccess('密碼已更新');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err: any) {
      console.error('change password error', err);
      // Map common Firebase errors to friendly messages
      switch (err?.code) {
        case 'auth/wrong-password':
          setError('舊密碼錯誤');
          break;
        case 'auth/weak-password':
          setError('新密碼強度不足，請選擇更強的密碼');
          break;
        case 'auth/requires-recent-login':
          setError('請重新登入後再嘗試修改密碼');
          break;
        default:
          setError(err?.message || '修改密碼失敗');
      }
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, margin: '0 auto', pt: 3 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>個人資訊</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {userDoc ? (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2">學號 / 教職員編號</Typography>
              <Typography>{userDoc.studentId || userDoc.staffId || userDoc.studentID || userDoc.staffID || '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">姓名</Typography>
              <Typography>{userDoc.username || userDoc.name || '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">信箱</Typography>
              <Typography>{userDoc.email || '—'}</Typography>
            </Box>

            <Box component="form" onSubmit={handleChangePassword} sx={{ mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>修改密碼</Typography>
              <TextField
                label="舊密碼"
                type="password"
                fullWidth
                margin="dense"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
              />
              <TextField
                label="新密碼"
                type="password"
                fullWidth
                margin="dense"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                helperText="至少 8 個字元"
              />
              <TextField
                label="確認新密碼"
                type="password"
                fullWidth
                margin="dense"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
              />
              <Box sx={{ mt: 2 }}>
                <Button type="submit" variant="contained" disabled={pwLoading}>
                  {pwLoading ? <CircularProgress size={20} /> : '修改密碼'}
                </Button>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default Profile;
