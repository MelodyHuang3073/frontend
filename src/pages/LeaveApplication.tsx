import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { zhTW } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase/config';
import { LeaveService } from '../services/leaveService';
import { LeaveType } from '../types';
import { useLocation } from 'react-router-dom';

interface FormDataType {
  leaveType: LeaveType;
  startDate: Date | null;
  endDate: Date | null;
  reason: string;
  attachments: File[];
}

const LeaveApplication: React.FC = () => {
  const navigate = useNavigate();
  // role not stored locally; redirect based on userDoc check
  const [formData, setFormData] = useState<FormDataType>({
    leaveType: LeaveType.PERSONAL,
    startDate: null,
    endDate: null,
    reason: '',
    attachments: [],
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const editId = params.get('edit');
  const [isEditMode, setIsEditMode] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (event: SelectChangeEvent) => {
    setFormData(prev => ({
      ...prev,
      leaveType: event.target.value as LeaveType
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      // 檢查文件類型
      const validFiles = files.filter(file => 
        ['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)
      );

      if (validFiles.length !== files.length) {
        setError('只允許上傳 JPG、PNG 或 PDF 文件');
        return;
      }

      // 檢查文件大小（10MB 限制）
      const invalidSize = validFiles.some(file => file.size > 10 * 1024 * 1024);
      if (invalidSize) {
        setError('文件大小不能超過 10MB');
        return;
      }

      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...validFiles]
      }));
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // 檢查用戶是否已登入
    if (!auth.currentUser) {
      setError('請先登入');
      navigate('/login');
      return;
    }
    
    // 基本驗證
    if (!formData.leaveType || !formData.startDate || !formData.endDate || !formData.reason) {
      setError('請填寫所有必填欄位');
      return;
    }

    // 日期驗證
    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      setError('結束時間不能早於開始時間');
      return;
    }

    setLoading(true);

    try {
      let response;
      if (isEditMode && editId) {
        // if editing, use updateLeave; if it was rejected, student can resubmit by setting status to 'pending'
        response = await LeaveService.updateLeave(editId, {
          type: formData.leaveType,
          startDate: formData.startDate!,
          endDate: formData.endDate!,
          reason: formData.reason,
          attachments: formData.attachments,
          status: 'pending',
          reviewComment: undefined
        });
      } else {
        response = await LeaveService.createLeave({
          type: formData.leaveType,
          startDate: formData.startDate!,
          endDate: formData.endDate!,
          reason: formData.reason,
          attachments: formData.attachments
        });
      }

      if (response.success) {
        setFormData({
          leaveType: LeaveType.PERSONAL,
          startDate: null,
          endDate: null,
          reason: '',
          attachments: [],
        });
        navigate('/leave-list');
      } else {
        setError(response.error || '提交失敗，請稍後再試');
      }
    } catch (error: any) {
      console.error('提交請假申請時發生錯誤:', error);
      setError(error.message || '提交失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // Redirect teachers away from the application page
  React.useEffect(() => {
    const checkRole = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userDoc = await LeaveService.getUserDoc(user.uid);
        const userRole = userDoc?.role;
        if (userRole === 'teacher') {
          navigate('/leave-list');
        }
      } catch (err) {
        console.error('無法取得使用者角色', err);
      }
    };
    checkRole();
  }, [navigate]);

  // if editId exists, load existing leave
  React.useEffect(() => {
    const loadEdit = async () => {
      if (!editId) return;
      setIsEditMode(true);
      setLoading(true);
      try {
        const res = await LeaveService.getLeaveById(editId);
        if (res.success && res.data) {
          const d = res.data;
          setFormData({
            leaveType: d.type as LeaveType,
            startDate: d.startDate,
            endDate: d.endDate,
            reason: d.reason,
            attachments: [] // attachments are URLs; editing attachments would require re-upload - keep empty for now
          });
        } else {
          setError(res.error || '無法載入請假紀錄');
        }
      } catch (err) {
        console.error('載入編輯資料失敗', err);
        setError('載入編輯資料失敗');
      } finally {
        setLoading(false);
      }
    };
    loadEdit();
  }, [editId]);

  const removeAttachment = (index: number) => {
    setFormData((prev: FormDataType) => ({
      ...prev,
      attachments: prev.attachments.filter((_: File, i: number) => i !== index)
    }));
  };

  return (
    <Box sx={{ maxWidth: 800, margin: '0 auto', pt: 3 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          請假申請
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ display: 'grid', gap: 3 }}>
              <FormControl fullWidth required>
                <InputLabel id="leave-type-label">請假類型</InputLabel>
                <Select
                  labelId="leave-type-label"
                  id="leaveType"
                  name="leaveType"
                  value={formData.leaveType}
                  label="請假類型"
                  onChange={handleSelectChange}
                  disabled={loading}
                >
                  <MenuItem value="sick">病假</MenuItem>
                  <MenuItem value="personal">事假</MenuItem>
                  <MenuItem value="official">公假</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
                  <DateTimePicker
                    label="開始時間"
                    value={formData.startDate}
                    onChange={(newValue) => {
                      setFormData(prev => ({ ...prev, startDate: newValue }));
                    }}
                    disabled={loading}
                    sx={{ width: '100%' }}
                  />
                </LocalizationProvider>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
                  <DateTimePicker
                    label="結束時間"
                    value={formData.endDate}
                    onChange={(newValue) => {
                      setFormData(prev => ({ ...prev, endDate: newValue }));
                    }}
                    disabled={loading}
                    sx={{ width: '100%' }}
                  />
                </LocalizationProvider>
              </Box>
              <TextField
                required
                fullWidth
                multiline
                rows={4}
                name="reason"
                label="請假原因"
                value={formData.reason}
                onChange={handleChange}
                disabled={loading}
              />
              <Box>
                <Button
                  variant="contained"
                  component="label"
                  sx={{ mr: 2 }}
                  disabled={loading}
                >
                  上傳附件
                  <input
                    type="file"
                    hidden
                    multiple
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={handleFileChange}
                  />
                </Button>
                <Typography variant="body2" color="textSecondary">
                  支援格式：JPG、PNG、PDF，單檔限制 10MB
                </Typography>
              </Box>
              {formData.attachments.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    已上傳的附件：
                  </Typography>
                  {formData.attachments.map((file, index) => (
                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2">
                        {file.name}
                      </Typography>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => removeAttachment(index)}
                        sx={{ ml: 2 }}
                      >
                        移除
                      </Button>
                    </Box>
                  ))}
                </Box>
              )}
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                fullWidth
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : '提交申請'}
              </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default LeaveApplication;