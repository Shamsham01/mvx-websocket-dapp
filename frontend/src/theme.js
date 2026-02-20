import { alpha, createTheme } from '@mui/material/styles';

const baseBackground = '#070b14';
const surface = '#0f1628';
const surfaceRaised = '#141d33';
const borderColor = 'rgba(148, 163, 184, 0.16)';
const ease = 'cubic-bezier(0.2, 0, 0, 1)';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#46d9ff', light: '#86ebff', dark: '#1eb5dc', contrastText: '#05111d' },
    secondary: { main: '#8a7cff', light: '#b7aeff', dark: '#6656f5' },
    success: { main: '#34d399' },
    warning: { main: '#f59e0b' },
    error: { main: '#f87171' },
    background: { default: baseBackground, paper: surface },
    text: { primary: '#ecf2ff', secondary: '#94a3b8' },
    divider: borderColor,
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Inter", "Roboto", "Segoe UI", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.12, letterSpacing: '-0.02em' },
    h2: { fontSize: '2rem', fontWeight: 700, lineHeight: 1.16, letterSpacing: '-0.015em' },
    h3: { fontSize: '1.625rem', fontWeight: 700, lineHeight: 1.2 },
    h4: { fontSize: '1.375rem', fontWeight: 650, lineHeight: 1.28 },
    h5: { fontSize: '1.125rem', fontWeight: 650, lineHeight: 1.32 },
    h6: { fontSize: '1rem', fontWeight: 650, lineHeight: 1.36 },
    body1: { fontSize: '0.975rem', lineHeight: 1.65 },
    body2: { fontSize: '0.875rem', lineHeight: 1.6 },
    caption: { fontSize: '0.75rem', lineHeight: 1.5, color: '#94a3b8' },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0.2 },
  },
  shadows: [
    'none', '0 1px 2px rgba(3, 7, 18, 0.3)', '0 6px 20px rgba(2, 8, 20, 0.35)', '0 10px 28px rgba(2, 8, 20, 0.38)',
    '0 14px 34px rgba(2, 8, 20, 0.42)', '0 20px 46px rgba(2, 8, 20, 0.46)', '0 24px 52px rgba(2, 8, 20, 0.5)',
    '0 28px 58px rgba(2, 8, 20, 0.54)', '0 30px 66px rgba(2, 8, 20, 0.56)', '0 36px 74px rgba(2, 8, 20, 0.58)',
    '0 40px 84px rgba(2, 8, 20, 0.6)', '0 44px 92px rgba(2, 8, 20, 0.62)', '0 48px 96px rgba(2, 8, 20, 0.64)',
    '0 52px 102px rgba(2, 8, 20, 0.66)', '0 56px 112px rgba(2, 8, 20, 0.68)', '0 60px 120px rgba(2, 8, 20, 0.7)',
    '0 64px 128px rgba(2, 8, 20, 0.72)', '0 70px 136px rgba(2, 8, 20, 0.74)', '0 76px 146px rgba(2, 8, 20, 0.76)',
    '0 82px 156px rgba(2, 8, 20, 0.78)', '0 88px 168px rgba(2, 8, 20, 0.8)', '0 94px 176px rgba(2, 8, 20, 0.82)',
    '0 100px 186px rgba(2, 8, 20, 0.84)', '0 106px 194px rgba(2, 8, 20, 0.86)', '0 112px 204px rgba(2, 8, 20, 0.88)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            'radial-gradient(900px 520px at 16% -10%, rgba(70, 217, 255, 0.12), transparent 65%), radial-gradient(760px 480px at 94% -6%, rgba(138, 124, 255, 0.14), transparent 62%), linear-gradient(180deg, #070b14 0%, #070c17 100%)',
          minHeight: '100vh',
        },
        '#root': { minHeight: '100vh' },
        '@media (prefers-reduced-motion: reduce)': {
          '*': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#0b1324', 0.86),
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${borderColor}`,
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'linear-gradient(180deg, rgba(15, 22, 40, 0.92), rgba(10, 17, 31, 0.95))',
          borderRight: `1px solid ${borderColor}`,
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: `1px solid ${borderColor}`,
          background: `linear-gradient(180deg, ${alpha(surfaceRaised, 0.92)}, ${alpha(surface, 0.94)})`,
          transition: `transform 200ms ${ease}, box-shadow 200ms ${ease}, border-color 200ms ${ease}`,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 40,
          borderRadius: 11,
          transition: `transform 150ms ${ease}, box-shadow 180ms ${ease}, background-color 180ms ${ease}, border-color 180ms ${ease}`,
          '&:hover': { transform: 'translateY(-1px)' },
          '&:active': { transform: 'translateY(0)' },
        },
        containedPrimary: { boxShadow: '0 10px 24px rgba(70, 217, 255, 0.22)' },
      },
    },
    MuiTextField: {
      defaultProps: { fullWidth: true, variant: 'outlined' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#0f172a', 0.6),
          '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#94a3b8', 0.24) },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#94a3b8', 0.38) },
          '&.Mui-focused': { boxShadow: '0 0 0 4px rgba(70, 217, 255, 0.16)' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#46d9ff', 0.82) },
          '&.Mui-disabled': { opacity: 0.62 },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 10, border: `1px solid ${alpha('#94a3b8', 0.22)}` },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 999,
          background: 'linear-gradient(90deg, #46d9ff 0%, #8a7cff 100%)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          border: `1px solid ${borderColor}`,
          background: alpha('#0b1324', 0.96),
          color: '#e2e8f0',
          fontSize: '0.75rem',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          border: `1px solid ${borderColor}`,
          backgroundImage: 'none',
          backgroundColor: alpha(surface, 0.98),
        },
      },
    },
  },
});

export default theme;
