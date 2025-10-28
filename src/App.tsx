import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import './App.css';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import LeaveApplication from './pages/LeaveApplication';
import LeaveList from './pages/LeaveList';
import LeaveApproval from './pages/LeaveApproval';
import Profile from './pages/Profile';

// Components
import Layout from './components/Layout';
import PrivateRoute from './components/Auth/PrivateRoute';

// 創建主題
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ display: 'flex' }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } />
              <Route path="leave-application" element={
                <PrivateRoute>
                  <LeaveApplication />
                </PrivateRoute>
              } />
              <Route path="profile" element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              } />
              <Route path="leave-list" element={
                <PrivateRoute>
                  <LeaveList />
                </PrivateRoute>
              } />
              <Route path="leave-approval" element={
                <PrivateRoute>
                  <LeaveApproval />
                </PrivateRoute>
              } />
            </Route>
          </Routes>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
