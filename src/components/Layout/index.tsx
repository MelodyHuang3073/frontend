import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  Avatar,
} from '@mui/material';
import {
  // Dashboard removed - not used
  Assignment as AssignmentIcon,
  List as ListIcon,
  ExitToApp as ExitToAppIcon,
  // School icon removed because "我的選課紀錄" menu was removed
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';

const drawerWidth = 240;

const Layout: React.FC = () => {
  const navigate = useNavigate();
  interface UserInfo {
    displayName: string | null;
    email: string | null;
    role?: string;
  }
  
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // menu items will be generated based on user role
  const getMenuItems = (role?: string) => {
    const items: { text: string; icon: React.ReactElement; path: string }[] = [];
    // Make leave application the system homepage for students
    if (role !== 'teacher') {
      items.push({ text: '申請請假', icon: <AssignmentIcon />, path: '/leave-application' });
    }
    items.push({ text: '請假列表', icon: <ListIcon />, path: '/leave-list' });
    return items;
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user: User | null) => {
      try {
        if (user) {
          // 從 Firestore 獲取用戶角色
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userData = userDoc.data();
          
          if (userData) {
            setUserInfo({
              displayName: user.displayName,
              email: user.email,
              role: userData.role
            });
          } else {
            console.error('用戶資料不存在');
            await auth.signOut();
            navigate('/login');
          }
        } else {
          setUserInfo(null);
          navigate('/login');
        }
      } catch (error) {
        console.error('獲取用戶資料失敗:', error);
        setUserInfo(null);
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setUserInfo(null);
      navigate('/login');
    } catch (error) {
      console.error('登出失敗:', error);
      // 即使登出失敗，也強制清除本地狀態並導向登入頁
      setUserInfo(null);
      navigate('/login');
    }
  };

  return (
    <>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ cursor: 'pointer' }}
            onClick={() => navigate(userInfo?.role === 'teacher' ? '/leave-list' : '/leave-application')}
          >
            請假管理系統
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton color="inherit" onClick={handleLogout}>
            <ExitToAppIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <List>
            {getMenuItems(userInfo?.role).map((item) => (
              <ListItem
                component="li"
                key={item.text}
                onClick={() => navigate(item.path)}
                sx={{ cursor: 'pointer' }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItem>
            ))}
          </List>
          <Box sx={{ flexGrow: 1 }} />
          {userInfo && (
            <>
              <Divider />
              <Box sx={{ p: 2 }}>
                <ListItem>
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {userInfo.displayName?.[0] || userInfo.email?.[0] || '?'}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText 
                    primary={userInfo.displayName || userInfo.email}
                    secondary={`身份：${userInfo.role === 'student' ? '學生' : '教師'}`}
                  />
                </ListItem>
              </Box>
            </>
          )}
        </Box>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </>
  );
};

export default Layout;