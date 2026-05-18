import { alpha, createTheme } from '@mui/material/styles';

/** Single saturated accent (<80% saturation feel on dark canvas), muted emerald — avoids cyan + purple gradients. */
const accent = '#5cbb9f';
const accentRgb = '92, 187, 159';

const baseBackground = '#0c1017';
const surface = '#121a24';
const surfaceRaised = '#161f2d';
const borderColor = 'rgba(148, 163, 184, 0.14)';
const easeOut = 'cubic-bezier(0.16, 1, 0.3, 1)';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: accent,
      light: '#82d4b8',
      dark: '#3f8f77',
      contrastText: '#081210',
    },
    secondary: {
      main: '#8b98a8',
      light: '#a8b4c2',
      dark: '#5f6b78',
      contrastText: '#0c1017',
    },
    success: { main: '#4ade95' },
    warning: { main: '#e8a849' },
    error: { main: '#ea8a82' },
    background: {
      default: baseBackground,
      paper: surface,
    },
    text: {
      primary: '#eef2f6',
      secondary: '#94a3b8',
    },
    divider: borderColor,
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Outfit", "Segoe UI", "Helvetica Neue", "Arial", sans-serif',
    fontVariantNumeric: 'tabular-nums',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.06,
      letterSpacing: '-0.03em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 650,
      lineHeight: 1.12,
      letterSpacing: '-0.025em',
    },
    h3: {
      fontSize: '1.625rem',
      fontWeight: 650,
      lineHeight: 1.18,
      letterSpacing: '-0.02em',
    },
    h4: { fontSize: '1.375rem', fontWeight: 600, lineHeight: 1.24 },
    h5: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.28 },
    h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.32 },
    body1: { fontSize: '0.975rem', lineHeight: 1.65 },
    body2: { fontSize: '0.875rem', lineHeight: 1.62 },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.48,
      color: '#94a3b8',
      letterSpacing: '0.01em',
    },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0.02 },
  },
  shadows: [
    'none',
    `0 1px 2px rgba(8, 12, 16, 0.45)`,
    `0 6px 20px rgba(8, 12, 16, 0.48)`,
    `0 10px 28px rgba(8, 12, 16, 0.5)`,
    `0 14px 34px rgba(8, 12, 16, 0.52)`,
    `0 20px 46px rgba(8, 12, 16, 0.54)`,
    `0 24px 52px rgba(8, 12, 16, 0.56)`,
    `0 28px 58px rgba(8, 12, 16, 0.58)`,
    `0 30px 66px rgba(8, 12, 16, 0.6)`,
    `0 36px 74px rgba(8, 12, 16, 0.62)`,
    `0 40px 84px rgba(8, 12, 16, 0.64)`,
    `0 44px 92px rgba(8, 12, 16, 0.66)`,
    `0 48px 96px rgba(8, 12, 16, 0.68)`,
    `0 52px 102px rgba(8, 12, 16, 0.7)`,
    `0 56px 112px rgba(8, 12, 16, 0.72)`,
    `0 60px 120px rgba(8, 12, 16, 0.73)`,
    `0 64px 128px rgba(8, 12, 16, 0.74)`,
    `0 70px 136px rgba(8, 12, 16, 0.75)`,
    `0 76px 146px rgba(8, 12, 16, 0.76)`,
    `0 82px 156px rgba(8, 12, 16, 0.77)`,
    `0 88px 168px rgba(8, 12, 16, 0.78)`,
    `0 94px 176px rgba(8, 12, 16, 0.79)`,
    `0 100px 186px rgba(8, 12, 16, 0.8)`,
    `0 106px 194px rgba(8, 12, 16, 0.81)`,
    `0 112px 204px rgba(8, 12, 16, 0.82)`,
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          scrollBehavior: 'smooth',
        },
        body: {
          backgroundImage:
            `radial-gradient(880px 500px at 12% -8%, rgba(${accentRgb}, 0.09), transparent 62%), radial-gradient(640px 420px at 88% 0%, rgba(${accentRgb}, 0.05), transparent 58%), radial-gradient(520px 360px at 50% 100%, rgba(148, 163, 184, 0.04), transparent 55%), linear-gradient(180deg, ${baseBackground} 0%, #0a0e13 100%)`,
          backgroundAttachment: 'fixed',
          minHeight: '100dvh',
          textRendering: 'optimizeLegibility',
        },
        '#root': { minHeight: '100dvh' },
        '@media (prefers-reduced-motion: reduce)': {
          html: { scrollBehavior: 'auto' },
          '*': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#111820', 0.82),
          backdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${borderColor}`,
          boxShadow: 'none',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: `linear-gradient(180deg, ${alpha(surface, 0.94)}, ${alpha(baseBackground, 0.96)})`,
          borderRight: `1px solid ${borderColor}`,
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: `1px solid ${borderColor}`,
          background: alpha(surfaceRaised, 0.55),
          backgroundImage:
            `linear-gradient(165deg, ${alpha(surfaceRaised, 0.95)} 0%, ${alpha(surface, 0.88)} 100%)`,
          boxShadow: `
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 12px 42px rgba(6, 10, 14, 0.35)
          `,
          transition: `transform 220ms ${easeOut}, box-shadow 220ms ${easeOut}, border-color 220ms ${easeOut}`,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 40,
          borderRadius: 12,
          transition: `transform 180ms ${easeOut}, box-shadow 220ms ${easeOut}, background-color 200ms ${easeOut}, border-color 200ms ${easeOut}, color 180ms ${easeOut}`,
          '&:hover': { transform: 'translateY(-1px)' },
          '&:active': { transform: 'translateY(0) scale(0.98)' },
        },
        containedPrimary: {
          boxShadow: `0 12px 28px rgba(${accentRgb}, 0.22)`,
          '&:hover': {
            boxShadow: `0 14px 34px rgba(${accentRgb}, 0.26)`,
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: { fullWidth: true, variant: 'outlined' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(surface, 0.55),
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#94a3b8', 0.22),
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#94a3b8', 0.35),
          },
          '&.Mui-focused': {
            boxShadow: `0 0 0 3px rgba(${accentRgb}, 0.22)`,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(accent, 0.75),
          },
          '&.Mui-disabled': { opacity: 0.62 },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 11,
          border: `1px solid ${alpha('#94a3b8', 0.2)}`,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 999,
          backgroundColor: accent,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          border: `1px solid ${borderColor}`,
          backgroundColor: alpha('#111820', 0.94),
          backdropFilter: 'blur(8px)',
          color: '#e2e8f0',
          fontSize: '0.75rem',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          border: `1px solid ${borderColor}`,
          backgroundImage: 'none',
          backgroundColor: alpha(surface, 0.98),
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        },
      },
    },
  },
});

export default theme;
