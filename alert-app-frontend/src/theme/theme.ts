import { createTheme } from '@mui/material/styles';

// Single source of truth for colors, typography and spacing.
// `cssVariables: true` exposes these as CSS variables (e.g. var(--mui-palette-primary-main),
// var(--mui-spacing)) so SASS modules can reuse them.
export const theme = createTheme({
  cssVariables: true,
  palette: {
    primary: { main: '#1565c0' },
    secondary: { main: '#ef6c00' },
    background: { default: '#f5f7fa' },
  },
  typography: {
    fontFamily: [
      'system-ui',
      '-apple-system',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  shape: {
    borderRadius: 8,
  },
});
