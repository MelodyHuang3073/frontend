import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#9c27b0',
    },
    background: {
      default: '#f7f9fc',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: ['Noto Sans TC', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
    h6: {
      fontWeight: 600,
    },
    subtitle2: {
      fontSize: 12,
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        variant: 'contained',
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

export default theme;
