import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { zhTW } from 'date-fns/locale';

const LeaveApplication: React.FC = () => {
  const [formData, setFormData] = useState<{
    leaveType: string;
    startDate: Date | null;
    endDate: Date | null;
    reason: string;
    attachments: File[];
  }>({
    leaveType: '',
    startDate: null,
    endDate: null,
    reason: '',
    attachments: [],
  });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (e: any) => {
    setFormData(prev => ({
      ...prev,
      leaveType: e.target.value
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

    try {
      // TODO: 實現提交請假申請的邏輯
      console.log('請假申請資料:', formData);
      // 這裡會加入與後端 API 的整合
    } catch (err) {
      setError('提交失敗，請稍後再試');
    }
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
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
              />
              <Box>
                <Button
                  variant="contained"
                  component="label"
                  sx={{ mr: 2 }}
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
              >
                提交申請
              </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default LeaveApplication;