import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { getAccountProvider } from '@multiversx/sdk-dapp/out/providers/helpers/accountProvider';
import { UnlockPanelManager } from '@multiversx/sdk-dapp/out/managers/UnlockPanelManager';
import { ProviderTypeEnum } from '@multiversx/sdk-dapp/out/providers/types/providerFactory.types';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/out/react/account/useGetAccountInfo';
import { useGetLoginInfo } from '@multiversx/sdk-dapp/out/react/loginInfo/useGetLoginInfo';

// Hide WalletConnect providers when no project ID is configured.
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

export default function Navbar() {
  const { user, logout, loginWithNativeAuth } = useAuth();
  const navigate = useNavigate();
  const { account } = useGetAccountInfo();
  const loginInfo = useGetLoginInfo();
  const nativeAuthToken = loginInfo?.tokenLogin?.nativeAuthToken;
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);

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
        navigate('/dashboard');
      } catch (e) {
        // Keep the user on current page and allow retry.
      } finally {
        setIsAuthenticating(false);
      }
    };

    authenticate();
  }, [account?.address, nativeAuthToken, user, loginWithNativeAuth, navigate, isAuthenticating]);

  const handleLogout = async () => {
    try {
      const provider = getAccountProvider();
      if (provider && typeof provider.logout === 'function') {
        await provider.logout();
      }
    } catch (e) {
      // Wallet may not be connected
    }
    await logout();
    navigate('/');
  };

  const handleLogin = () => {
    unlockPanelManager?.openUnlockPanel();
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexGrow: 1, textDecoration: 'none', color: 'inherit' }}>
          <Box
            component="img"
            src="https://i.ibb.co/rsPX3fy/Make-X-Logo-Trnasparent-BG.png"
            alt="MakeX Logo"
            sx={{ width: 34, height: 34, objectFit: 'contain' }}
          />
          <Typography variant="h6" sx={{ textDecoration: 'none', color: 'inherit', fontWeight: 600 }}>
            MakeX - MultiversX WebSocker DApp
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {user ? (
            <>
              <Button color="inherit" component={Link} to="/dashboard">Dashboard</Button>
              <Button color="inherit" component={Link} to="/subscriptions">Subscriptions</Button>
              <Typography variant="body2" sx={{ alignSelf: 'center', mr: 1 }}>
                {user.address?.slice(0, 10)}...
              </Typography>
              <Button color="inherit" onClick={handleLogout}>Logout</Button>
            </>
          ) : (
            <Button color="inherit" variant="outlined" onClick={handleLogin} disabled={isAuthenticating}>
              {isAuthenticating ? <CircularProgress size={18} color="inherit" /> : 'Login'}
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
