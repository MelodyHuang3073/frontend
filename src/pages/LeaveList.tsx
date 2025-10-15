import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TablePagination,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

// 假資料用於展示
const sampleData = [
  {
    id: '1',
    type: 'sick',
    startDate: '2025-10-15T09:00:00',
    endDate: '2025-10-16T17:00:00',
    reason: '感冒發燒',
    status: 'pending',
    attachments: ['病假證明.pdf'],
  },
  {
    id: '2',
    type: 'personal',
    startDate: '2025-10-20T09:00:00',
    endDate: '2025-10-20T17:00:00',
    reason: '個人事務',
    status: 'approved',
    attachments: [],
  },
];

const LeaveList: React.FC = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewDetails = (leave: any) => {
    setSelectedLeave(leave);
    setDetailsOpen(true);
  };

  const getStatusChip = (status: string) => {
    let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
    let label = '';

    switch (status) {
      case 'pending':
        color = 'warning';
        label = '待審核';
        break;
      case 'approved':
        color = 'success';
        label = '已核准';
        break;
      case 'rejected':
        color = 'error';
        label = '已拒絕';
        break;
      default:
        label = '未知狀態';
    }

    return <Chip label={label} color={color} size="small" />;
  };

  const getLeaveTypeText = (type: string) => {
    switch (type) {
      case 'sick':
        return '病假';
      case 'personal':
        return '事假';
      case 'official':
        return '公假';
      default:
        return '其他';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        請假紀錄
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>假別</TableCell>
              <TableCell>開始時間</TableCell>
              <TableCell>結束時間</TableCell>
              <TableCell>狀態</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sampleData
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{getLeaveTypeText(row.type)}</TableCell>
                  <TableCell>
                    {new Date(row.startDate).toLocaleString('zh-TW')}
                  </TableCell>
                  <TableCell>
                    {new Date(row.endDate).toLocaleString('zh-TW')}
                  </TableCell>
                  <TableCell>{getStatusChip(row.status)}</TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleViewDetails(row)}
                    >
                      <VisibilityIcon />
                    </IconButton>
                    {row.status === 'pending' && (
                      <>
                        <IconButton size="small" color="primary">
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" color="error">
                          <DeleteIcon />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={sampleData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      {/* 詳情對話框 */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>請假詳情</DialogTitle>
        <DialogContent>
          {selectedLeave && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                假別：{getLeaveTypeText(selectedLeave.type)}
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                開始時間：{new Date(selectedLeave.startDate).toLocaleString('zh-TW')}
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                結束時間：{new Date(selectedLeave.endDate).toLocaleString('zh-TW')}
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                請假原因：{selectedLeave.reason}
              </Typography>
              {selectedLeave.attachments.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    附件：
                  </Typography>
                  {selectedLeave.attachments.map((attachment: string, index: number) => (
                    <Typography key={index} variant="body2">
                      {attachment}
                    </Typography>
                  ))}
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>關閉</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LeaveList;