import React from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import KeyboardDoubleArrowLeftRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowLeftRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import PlaylistAddCheckRoundedIcon from '@mui/icons-material/PlaylistAddCheckRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PowerSettingsNewRoundedIcon from '@mui/icons-material/PowerSettingsNewRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import { alpha, useTheme } from '@mui/material/styles';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/out/react/account/useGetAccountInfo';
import { useGetLoginInfo } from '@multiversx/sdk-dapp/out/react/loginInfo/useGetLoginInfo';
import { ProviderTypeEnum } from '@multiversx/sdk-dapp/out/providers/types/providerFactory.types';
import { getAccountProvider } from '@multiversx/sdk-dapp/out/providers/helpers/accountProvider';
import { UnlockPanelManager } from '@multiversx/sdk-dapp/out/managers/UnlockPanelManager';
import { useAuth } from '../../context/AuthContext';

const drawerWidth = 260;
const collapsedDrawerWidth = 84;
const hasWalletConnectProjectId = Boolean(process.env.REACT_APP_WALLETCONNECT_V2_PROJECT_ID);
const allowedProviders = hasWalletConnectProjectId
  ? undefined
  : [
      ProviderTypeEnum.extension,
      ProviderTypeEnum.crossWindow,
      ProviderTypeEnum.webview,
      ProviderTypeEnum.ledger,
      ProviderTypeEnum.passkey,
      ProviderTypeEnum.metamask,
    ];

let unlockPanelManager;

const navItems = [
  { label: 'Home', path: '/', icon: <HomeRoundedIcon /> },
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardRoundedIcon /> },
  { label: 'Subscriptions', path: '/subscriptions', icon: <PlaylistAddCheckRoundedIcon /> },
  { label: 'Create Subscription', path: '/subscriptions/new', icon: <AddRoundedIcon /> },
];

function ConnectedStatus({ connected }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: connected ? 'success.main' : 'text.disabled',
          boxShadow: connected ? '0 0 0 0 rgba(52, 211, 153, 0.6)' : 'none',
          animation: connected ? 'pulse 1800ms ease-out infinite' : 'none',
          '@keyframes pulse': {
            '0%': { boxShadow: '0 0 0 0 rgba(52, 211, 153, 0.45)' },
            '70%': { boxShadow: '0 0 0 8px rgba(52, 211, 153, 0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(52, 211, 153, 0)' },
          },
          '@media (prefers-reduced-motion: reduce)': {
            animation: 'none',
            boxShadow: 'none',
          },
        }}
      />
      <Typography variant="caption" color={connected ? 'success.main' : 'text.secondary'}>
        {connected ? 'Connected' : 'Not connected'}
      </Typography>
    </Stack>
  );
}

export default function AppShell({ children }) {
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = React.useState(false);
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout, loginWithNativeAuth } = useAuth();
  const { account } = useGetAccountInfo();
  const loginInfo = useGetLoginInfo();
  const nativeAuthToken = loginInfo?.tokenLogin?.nativeAuthToken;

  if (!unlockPanelManager) {
    unlockPanelManager = UnlockPanelManager.init({
      loginHandler: () => {},
      allowedProviders,
    });
  }

  React.useEffect(() => {
    if (user || !account?.address || !nativeAuthToken || isAuthenticating) {
      return;
    }
    const authenticate = async () => {
      setIsAuthenticating(true);
      try {
        await loginWithNativeAuth(nativeAuthToken);
        if (pathname === '/login') {
          navigate('/dashboard');
        }
      } catch (_) {
        // User can retry by reconnecting wallet.
      } finally {
        setIsAuthenticating(false);
      }
    };
    authenticate();
  }, [account?.address, nativeAuthToken, user, loginWithNativeAuth, navigate, pathname, isAuthenticating]);

  const handleDrawerToggle = () => {
    setMobileOpen((open) => !open);
  };

  const handleLogout = async () => {
    try {
      const provider = getAccountProvider();
      if (provider && typeof provider.logout === 'function') {
        await provider.logout();
      }
    } catch (_) {
      // Wallet may already be disconnected.
    }
    await logout();
    navigate('/');
  };

  const activeDrawerWidth = desktopCollapsed ? collapsedDrawerWidth : drawerWidth;

  const drawerContent = (
    <Box sx={{ px: 1.5, py: 2, height: '100%' }}>
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ px: 1, mb: 2 }}>
        <Avatar
          src="https://i.ibb.co/rsPX3fy/Make-X-Logo-Trnasparent-BG.png"
          alt="MakeX"
          sx={{ width: 34, height: 34 }}
        />
        <Box sx={{ minWidth: 0, display: desktopCollapsed && !isMobile ? 'none' : 'block' }}>
          <Typography variant="subtitle2" noWrap>
            MakeX Dashboard
          </Typography>
          <Typography variant="caption">WebSocket DApp</Typography>
        </Box>
        {!isMobile && (
          <IconButton
            size="small"
            onClick={() => setDesktopCollapsed((prev) => !prev)}
            aria-label={desktopCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            sx={{ ml: 'auto' }}
          >
            <KeyboardDoubleArrowLeftRoundedIcon
              sx={{ transform: desktopCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }}
            />
          </IconButton>
        )}
      </Stack>
      <List sx={{ py: 0.5 }}>
        {navItems.map((item) => {
          const selected = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          return (
            <ListItemButton
              key={item.path}
              component={Link}
              to={item.path}
              selected={selected}
              onClick={() => isMobile && setMobileOpen(false)}
              sx={{
                borderRadius: 2.5,
                mb: 0.5,
                '&.Mui-selected': {
                  backgroundColor: alpha('#46d9ff', 0.14),
                  border: '1px solid rgba(70, 217, 255, 0.24)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: selected ? 'primary.main' : 'text.secondary' }}>
                {item.icon}
              </ListItemIcon>
              {!desktopCollapsed || isMobile ? <ListItemText primary={item.label} /> : null}
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      <AppBar position="fixed" color="transparent">
        <Toolbar sx={{ minHeight: 68 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 1.5, display: { md: 'none' } }}
            aria-label="Open navigation"
          >
            <MenuRoundedIcon />
          </IconButton>
          <Stack direction="row" alignItems="center" spacing={1.2} sx={{ flexGrow: 1, minWidth: 0 }}>
            <Avatar
              src="https://i.ibb.co/rsPX3fy/Make-X-Logo-Trnasparent-BG.png"
              alt="MakeX"
              sx={{ width: 30, height: 30 }}
            />
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
              MakeX Web3 Control Center
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.2}>
            <ConnectedStatus connected={Boolean(user)} />
            {user ? (
              <>
                <Tooltip title={user.address}>
                  <Chip
                    label={`${user.address?.slice(0, 8)}...${user.address?.slice(-6)}`}
                    size="small"
                    sx={{ maxWidth: 200 }}
                  />
                </Tooltip>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<PowerSettingsNewRoundedIcon />}
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                startIcon={
                  isAuthenticating ? (
                    <CircularProgress color="inherit" size={14} />
                  ) : (
                    <AccountBalanceWalletRoundedIcon />
                  )
                }
                onClick={() => unlockPanelManager?.openUnlockPanel()}
                disabled={isAuthenticating}
              >
                Connect Wallet
              </Button>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: activeDrawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: activeDrawerWidth,
              transition: 'width 220ms cubic-bezier(0.2, 0, 0, 1)',
              overflowX: 'hidden',
            },
          }}
        >
          <Toolbar />
          {drawerContent}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, width: { md: `calc(100% - ${activeDrawerWidth}px)` } }}>
        <Toolbar />
        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 }, px: { xs: 2, sm: 3 } }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}
