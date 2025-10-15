import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  CardHeader,
} from '@mui/material';

const Dashboard: React.FC = () => {
  // 這裡可以添加實際的統計數據
  const stats = {
    pendingLeaves: 2,
    approvedLeaves: 5,
    rejectedLeaves: 1,
    totalLeaves: 8,
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        儀表板
      </Typography>
      <Box sx={{ display: 'grid', gap: 3 }}>
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
          <Card>
            <CardHeader title="待審核請假" />
            <CardContent>
              <Typography variant="h3" align="center">
                {stats.pendingLeaves}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="已核准請假" />
            <CardContent>
              <Typography variant="h3" align="center">
                {stats.approvedLeaves}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="已拒絕請假" />
            <CardContent>
              <Typography variant="h3" align="center">
                {stats.rejectedLeaves}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="總請假次數" />
            <CardContent>
              <Typography variant="h3" align="center">
                {stats.totalLeaves}
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            最近的請假申請
          </Typography>
          {/* 這裡可以添加最近請假列表 */}
        </Paper>
      </Box>
    </Box>
  );
};

export default Dashboard;