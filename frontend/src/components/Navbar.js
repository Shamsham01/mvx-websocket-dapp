import { Link, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { openWalletConnect } from '../utils/walletConnect';

export default function Navbar() {
  const { user, logout, isAuthenticating } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleLogin = () => {
    openWalletConnect();
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        background: 'rgba(10, 12, 18, 0.72)',
        borderBottom: '1px solid rgba(35, 247, 221, 0.18)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <Toolbar sx={{ minHeight: 72 }}>
        <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexGrow: 1, textDecoration: 'none', color: 'inherit' }}>
          <Box
            component="img"
            src="https://i.ibb.co/rsPX3fy/Make-X-Logo-Trnasparent-BG.png"
            alt="MakeX Logo"
            sx={{ width: 36, height: 36, objectFit: 'contain' }}
          />
          <Typography
            variant="h6"
            sx={{
              textDecoration: 'none',
              color: 'inherit',
              fontWeight: 700,
              letterSpacing: 0.2,
              display: { xs: 'none', sm: 'block' },
            }}
          >
            MakeX - MultiversX WebSocket DApp
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.2, alignItems: 'center' }}>
          {user ? (
            <>
              <Button
                color="inherit"
                component={Link}
                to="/dashboard"
                sx={{ borderRadius: 20, px: 2, textTransform: 'none', fontWeight: 600 }}
              >
                Dashboard
              </Button>
              <Button
                color="inherit"
                component={Link}
                to="/templates"
                sx={{ borderRadius: 20, px: 2, textTransform: 'none', fontWeight: 600 }}
              >
                Templates
              </Button>
              <Button
                color="inherit"
                component={Link}
                to="/subscriptions"
                sx={{ borderRadius: 20, px: 2, textTransform: 'none', fontWeight: 600 }}
              >
                Subscriptions
              </Button>
              <Typography variant="body2" sx={{ alignSelf: 'center', mr: 1, color: 'rgba(255,255,255,0.75)' }}>
                {user.address?.slice(0, 10)}...
              </Typography>
              <Button
                color="inherit"
                onClick={handleLogout}
                sx={{ borderRadius: 20, px: 2, textTransform: 'none', fontWeight: 600 }}
              >
                Logout
              </Button>
            </>
          ) : (
            <Button
              color="inherit"
              variant="outlined"
              onClick={handleLogin}
              disabled={isAuthenticating}
              sx={{
                borderRadius: 999,
                px: 2.5,
                textTransform: 'none',
                fontWeight: 700,
                borderColor: 'rgba(35, 247, 221, 0.6)',
                boxShadow: '0 0 18px rgba(35,247,221,0.2)',
              }}
            >
              {isAuthenticating ? <CircularProgress size={18} color="inherit" /> : 'Login'}
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
