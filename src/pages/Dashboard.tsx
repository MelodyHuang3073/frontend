import React, { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase/config';
import { LeaveService } from '../services/leaveService';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const userDoc = await LeaveService.getUserDoc(user.uid);
      setRole(userDoc?.role || null);
    };
    load();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>歡迎使用請假管理系統</Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        {role !== 'teacher' && (
          <Button variant="contained" onClick={() => navigate('/leave-application')}>申請請假</Button>
        )}
        <Button variant="outlined" onClick={() => navigate('/leave-list')}>查看請假列表</Button>
      </Box>
    </Box>
  );
};

export default Dashboard;

// ensure this file is treated as a module under isolatedModules
export {};
