import React, { useState, useEffect } from 'react';
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
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { LeaveService } from '../services/leaveService';
import { LeaveApplication } from '../types';

const LeaveList: React.FC = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedLeave, setSelectedLeave] = useState<LeaveApplication | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaves = async () => {
      try {
        const response = await LeaveService.getLeaves();
        if (response.success && response.data) {
          setLeaves(response.data);
        } else {
          setError(response.error || '無法獲取請假記錄');
        }
      } catch (err) {
        setError('獲取請假記錄時發生錯誤');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaves();
  }, []);

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
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      ) : (
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
              {leaves
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((leave) => (
                  <TableRow key={leave.id}>
                    <TableCell>{getLeaveTypeText(leave.type)}</TableCell>
                    <TableCell>
                      {format(leave.startDate.toDate(), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                    </TableCell>
                    <TableCell>
                      {format(leave.endDate.toDate(), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                    </TableCell>
                    <TableCell>{getStatusChip(leave.status)}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetails(leave)}
                      >
                        <VisibilityIcon />
                      </IconButton>
                      {leave.status === 'pending' && (
                        <>
                          <IconButton 
                            size="small" 
                            color="primary"
                            onClick={() => {/* TODO: 實現編輯功能 */}}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            color="error"
                            onClick={async () => {
                              if (window.confirm('確定要刪除這筆請假記錄嗎？')) {
                                try {
                                  const response = await LeaveService.deleteLeave(leave.id);
                                  if (response.success) {
                                    setLeaves(leaves.filter(l => l.id !== leave.id));
                                  } else {
                                    setError(response.error || '刪除失敗');
                                  }
                                } catch (err) {
                                  setError('刪除時發生錯誤');
                                }
                              }
                            }}
                          >
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
            count={leaves.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="每頁顯示筆數："
          />
        </TableContainer>
      )}

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
                開始時間：{format(selectedLeave.startDate.toDate(), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                結束時間：{format(selectedLeave.endDate.toDate(), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                請假原因：{selectedLeave.reason}
              </Typography>
              {selectedLeave.attachments?.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    附件：
                  </Typography>
                  {selectedLeave.attachments.map((attachment: string, index: number) => (
                    <Typography key={index} variant="body2">
                      <a href={attachment} target="_blank" rel="noopener noreferrer">
                        附件 {index + 1}
                      </a>
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