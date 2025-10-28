import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import { Assignment as AssignmentIcon, HourglassEmpty as HourglassIcon, CheckCircle as CheckIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase/config';
import { LeaveService } from '../services/leaveService';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const formatTs = (v: any) => {
    if (!v) return '—';
    try {
      if (typeof v.toDate === 'function') v = v.toDate();
      if (v && typeof v.seconds === 'number') v = new Date(v.seconds * 1000);
      if (!(v instanceof Date)) v = new Date(v);
      return format(v, 'yyyy/MM/dd HH:mm', { locale: zhTW });
    } catch (e) {
      return '—';
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const user = auth.currentUser;
        if (!user) return;
        const userDoc = await LeaveService.getUserDoc(user.uid);
        setRole(userDoc?.role || null);
        setUserName(userDoc?.username || user.displayName || user.email || null);

        const res = await LeaveService.getLeaves();
        if (res.success && res.data) {
          setLeaves(res.data);
        }
      } catch (err) {
        console.error('Dashboard load error', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const total = leaves.length;
  const pending = leaves.filter(l => l.status === 'pending').length;
  const approved = leaves.filter(l => l.status === 'approved').length;

  const recent = leaves.slice(0, 5);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>歡迎，{userName || '使用者'}</Typography>
      <Typography variant="subtitle1" sx={{ mb: 2, color: 'text.secondary' }}>請假管理系統儀表板</Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
        <Box>
          <Card>
            <CardHeader avatar={<Avatar sx={{ bgcolor: 'primary.main' }}><AssignmentIcon /></Avatar>} title="總申請數" />
            <CardContent>
              <Typography variant="h5">{loading ? '—' : total}</Typography>
              <Typography variant="body2" color="text.secondary">從您的視角統計的請假數</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box>
          <Card>
            <CardHeader avatar={<Avatar sx={{ bgcolor: 'warning.main' }}><HourglassIcon /></Avatar>} title="待審核" />
            <CardContent>
              <Typography variant="h5">{loading ? '—' : pending}</Typography>
              <Typography variant="body2" color="text.secondary">目前待審核的請假</Typography>
            </CardContent>
          </Card>
        </Box>
        <Box>
          <Card>
            <CardHeader avatar={<Avatar sx={{ bgcolor: 'success.main' }}><CheckIcon /></Avatar>} title="已核准" />
            <CardContent>
              <Typography variant="h5">{loading ? '—' : approved}</Typography>
              <Typography variant="body2" color="text.secondary">已核准的請假數量</Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2, mb: 3 }}>
        <Box>
          <Card>
            <CardHeader title="最近的請假紀錄" />
            <Divider />
            <CardContent>
              {recent.length === 0 ? (
                <Typography color="text.secondary">尚無請假紀錄</Typography>
              ) : (
                <List>
                  {recent.map((r, idx) => (
                    <ListItem key={r.id || idx} divider>
                      <ListItemText
                        primary={`${r.userName || r.userId} - ${typeof r.course === 'string' ? r.course : (r.course?.code ? r.course.code + (r.course.teacherName ? '-' + r.course.teacherName : (r.course.name && r.course.name !== r.course.code ? '-' + r.course.name : '')) : (r.course?.name || '—'))}`}
                        secondary={`${r.type} · ${r.status} · ${formatTs(r.createdAt)}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Box>
        <Box>
          <Card>
            <CardHeader title="快速動作" />
            <CardContent>
              {role !== 'teacher' && (
                <Button variant="contained" fullWidth sx={{ mb: 1 }} onClick={() => navigate('/leave-application')}>申請請假</Button>
              )}
              <Button variant="outlined" fullWidth onClick={() => navigate('/leave-list')}>查看請假紀錄</Button>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
