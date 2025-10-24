import React from 'react';
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
  IconButton,
  TablePagination,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

const LeaveApproval: React.FC = () => {
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [selectedLeave, setSelectedLeave] = React.useState<any>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  // 假資料用於展示
  const pendingLeaves = [
    {
      id: '1',
      studentName: '王小明',
      type: 'sick',
      startDate: '2025-10-15T09:00:00',
      endDate: '2025-10-16T17:00:00',
      reason: '感冒發燒',
      attachments: ['病假證明.pdf'],
    },
  ];

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

  const handleApprove = (id: string) => {
    // TODO: 實現核准邏輯
    console.log('核准請假:', id);
  };

  const handleReject = (id: string) => {
    // TODO: 實現拒絕邏輯
    console.log('拒絕請假:', id);
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
        請假審核
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>學生</TableCell>
              <TableCell>假別</TableCell>
              <TableCell>開始時間</TableCell>
              <TableCell>結束時間</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pendingLeaves
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.studentName}</TableCell>
                  <TableCell>{getLeaveTypeText(row.type)}</TableCell>
                  <TableCell>
                    {new Date(row.startDate).toLocaleString('zh-TW')}
                  </TableCell>
                  <TableCell>
                    {new Date(row.endDate).toLocaleString('zh-TW')}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleViewDetails(row)}
                    >
                      <VisibilityIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="success"
                      onClick={() => handleApprove(row.id)}
                    >
                      <CheckCircleIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleReject(row.id)}
                    >
                      <CancelIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={pendingLeaves.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </TableContainer>

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
                學生：{selectedLeave.studentName}
              </Typography>
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
                      請假證明 {index + 1}: {attachment}
                    </Typography>
                  ))}
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleApprove(selectedLeave?.id)} color="success">
            核准
          </Button>
          <Button onClick={() => handleReject(selectedLeave?.id)} color="error">
            拒絕
          </Button>
          <Button onClick={() => setDetailsOpen(false)}>關閉</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LeaveApproval;