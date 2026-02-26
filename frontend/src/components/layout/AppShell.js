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
  Menu,
  MenuItem,
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
import ApiRoundedIcon from '@mui/icons-material/ApiRounded';
import PowerSettingsNewRoundedIcon from '@mui/icons-material/PowerSettingsNewRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded';
import { alpha, useTheme } from '@mui/material/styles';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/out/react/account/useGetAccountInfo';
import { useGetLoginInfo } from '@multiversx/sdk-dapp/out/react/loginInfo/useGetLoginInfo';
import { getAccountProvider } from '@multiversx/sdk-dapp/out/providers/helpers/accountProvider';
import { useAuth } from '../../context/AuthContext';
import { initWalletConnect, openWalletConnect } from '../../utils/walletConnect';
import { COMMUNITY, DOCS, MEDIA } from '../../constants/links';

const drawerWidth = 260;
const collapsedDrawerWidth = 84;

const appNavItems = [
  { label: 'Home', path: '/', icon: <HomeRoundedIcon /> },
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardRoundedIcon /> },
  { label: 'Subscriptions', path: '/subscriptions', icon: <PlaylistAddCheckRoundedIcon /> },
  { label: 'Create Subscription', path: '/subscriptions/new', icon: <AddRoundedIcon /> },
  { label: 'API Docs', path: '/api-docs', icon: <ApiRoundedIcon /> },
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

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

export default function AppShell({ children }) {
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = React.useState(false);
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);
  const [communityAnchor, setCommunityAnchor] = React.useState(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout, loginWithNativeAuth } = useAuth();
  const { account } = useGetAccountInfo();
  const loginInfo = useGetLoginInfo();
  const nativeAuthToken = loginInfo?.tokenLogin?.nativeAuthToken;

  const isLandingPage = pathname === '/';

  initWalletConnect();

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

  const walletButtons = user ? (
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
      onClick={() => openWalletConnect()}
      disabled={isAuthenticating}
    >
      Connect Wallet
    </Button>
  );

  const communityLinks = [
    { label: 'Discord', href: COMMUNITY.DISCORD },
    { label: 'X (Twitter)', href: COMMUNITY.X },
    { label: 'LinkedIn', href: COMMUNITY.LINKEDIN },
    { label: 'Facebook', href: COMMUNITY.FACEBOOK },
  ];

  /* ── Landing page layout ────────────────────────────────────────────── */
  if (isLandingPage) {
    const landingDrawerContent = (
      <Box sx={{ px: 1.5, py: 2 }}>
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ px: 1, mb: 2 }}>
          <Avatar src={MEDIA.MAKEX_LOGO} alt="MakeX" sx={{ width: 34, height: 34 }} />
          <Typography variant="subtitle2" noWrap>
            MakeX
          </Typography>
        </Stack>
        <List sx={{ py: 0.5 }}>
          {[
            { label: 'Home', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
            { label: 'Apps', action: () => scrollToSection('apps') },
            { label: 'Install', action: () => scrollToSection('install') },
          ].map((item) => (
            <ListItemButton
              key={item.label}
              onClick={() => {
                setMobileOpen(false);
                item.action();
              }}
              sx={{ borderRadius: 2.5, mb: 0.5 }}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
          <ListItemButton
            component={Link}
            to="/subscriptions"
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 2.5, mb: 0.5 }}
          >
            <ListItemText primary="WebSocket Subscriptions" />
          </ListItemButton>
          {[
            { label: 'Litepaper', href: DOCS.LITEPAPER },
            { label: 'Docs', href: DOCS.MAKEX_DOCS },
            ...communityLinks,
          ].map((item) => (
            <ListItemButton
              key={item.label}
              component="a"
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              sx={{ borderRadius: 2.5, mb: 0.5 }}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Box>
    );

    return (
      <Box sx={{ minHeight: '100vh' }}>
        <AppBar position="fixed" color="transparent">
          <Toolbar sx={{ minHeight: 68 }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 1.5, display: { md: 'none' } }}
              aria-label="Open navigation"
            >
              <MenuRoundedIcon />
            </IconButton>

            <Stack direction="row" alignItems="center" spacing={1.2} sx={{ minWidth: 0 }}>
              <Avatar src={MEDIA.MAKEX_LOGO} alt="MakeX" sx={{ width: 30, height: 30 }} />
              <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
                MakeX
              </Typography>
            </Stack>

            {/* Desktop horizontal nav */}
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ ml: 4, display: { xs: 'none', md: 'flex' } }}
            >
              <Button
                size="small"
                color="inherit"
                onClick={() => scrollToSection('apps')}
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                Apps
              </Button>
              <Button
                size="small"
                color="inherit"
                onClick={() => scrollToSection('install')}
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                Install
              </Button>
              <Button
                size="small"
                color="inherit"
                component={Link}
                to="/subscriptions"
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                Subscriptions
              </Button>
              <Button
                size="small"
                color="inherit"
                href={DOCS.LITEPAPER}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                Litepaper
              </Button>
              <Button
                size="small"
                color="inherit"
                href={DOCS.MAKEX_DOCS}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                Docs
              </Button>
              <Button
                size="small"
                color="inherit"
                endIcon={<ArrowDropDownRoundedIcon />}
                onClick={(e) => setCommunityAnchor(e.currentTarget)}
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                Community
              </Button>
              <Menu
                anchorEl={communityAnchor}
                open={Boolean(communityAnchor)}
                onClose={() => setCommunityAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              >
                {communityLinks.map((item) => (
                  <MenuItem
                    key={item.label}
                    component="a"
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setCommunityAnchor(null)}
                  >
                    {item.label}
                  </MenuItem>
                ))}
              </Menu>
            </Stack>

            <Box sx={{ flexGrow: 1 }} />

            <Stack direction="row" alignItems="center" spacing={1.2}>
              <ConnectedStatus connected={Boolean(user)} />
              {walletButtons}
            </Stack>
          </Toolbar>
        </AppBar>

        {/* Mobile drawer for landing page */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {landingDrawerContent}
        </Drawer>

        <Box component="main">
          <Toolbar />
          {children}
        </Box>
      </Box>
    );
  }

  /* ── App pages layout (with sidebar) ────────────────────────────────── */
  const activeDrawerWidth = desktopCollapsed ? collapsedDrawerWidth : drawerWidth;

  const appDrawerContent = (
    <Box sx={{ px: 1.5, py: 2, height: '100%' }}>
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ px: 1, mb: 2 }}>
        <Avatar
          src={MEDIA.MAKEX_LOGO}
          alt="MakeX"
          sx={{ width: 34, height: 34 }}
        />
        <Box sx={{ minWidth: 0, display: desktopCollapsed && !isMobile ? 'none' : 'block' }}>
          <Typography variant="subtitle2" noWrap>
            MakeX Dashboard
          </Typography>
          <Typography variant="caption">Web3 Control Center</Typography>
        </Box>
        {!isMobile && (
          <IconButton
            size="small"
            onClick={() => setDesktopCollapsed((prev) => !prev)}
            aria-label={desktopCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            sx={{ ml: 'auto' }}
          >
            <KeyboardDoubleArrowLeftRoundedIcon
              sx={{
                transform: desktopCollapsed ? 'rotate(180deg)' : 'none',
                transition: 'transform 180ms ease',
              }}
            />
          </IconButton>
        )}
      </Stack>
      <List sx={{ py: 0.5 }}>
        {appNavItems.map((item) => {
          const selected =
            pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
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
            onClick={() => setMobileOpen((o) => !o)}
            sx={{ mr: 1.5, display: { md: 'none' } }}
            aria-label="Open navigation"
          >
            <MenuRoundedIcon />
          </IconButton>
          <Stack direction="row" alignItems="center" spacing={1.2} sx={{ flexGrow: 1, minWidth: 0 }}>
            <Avatar
              src={MEDIA.MAKEX_LOGO}
              alt="MakeX"
              sx={{ width: 30, height: 30 }}
            />
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
              MakeX Web3 Control Center
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.2}>
            <ConnectedStatus connected={Boolean(user)} />
            {walletButtons}
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: activeDrawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {appDrawerContent}
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
          {appDrawerContent}
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
