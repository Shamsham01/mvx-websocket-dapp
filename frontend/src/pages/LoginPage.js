import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, Alert, CircularProgress, Button } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { UnlockPanelManager } from '@multiversx/sdk-dapp/out/managers/UnlockPanelManager';
import { ProviderTypeEnum } from '@multiversx/sdk-dapp/out/providers/types/providerFactory.types';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/out/react/account/useGetAccountInfo';
import { useGetLoginInfo } from '@multiversx/sdk-dapp/out/react/loginInfo/useGetLoginInfo';

// Hide WalletConnect (xPortal, drfi) when no project ID - prevents "Invalid WalletConnect setup" error
const hasWalletConnectProjectId = Boolean(process.env.REACT_APP_WALLETCONNECT_V2_PROJECT_ID);
const allowedProviders = hasWalletConnectProjectId
  ? undefined // show all providers
  : [
      ProviderTypeEnum.extension,
      ProviderTypeEnum.crossWindow,
      ProviderTypeEnum.webview,
      ProviderTypeEnum.ledger,
      ProviderTypeEnum.passkey,
      ProviderTypeEnum.metamask,
    ];

export default function LoginPage() {
  const { user, loginWithNativeAuth } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const unlockPanelManagerRef = useRef(null);

  const { account } = useGetAccountInfo();
  const loginInfo = useGetLoginInfo();
  const nativeAuthToken = loginInfo?.tokenLogin?.nativeAuthToken;

  const isWalletLoggedIn = Boolean(account?.address);

  // Initialize UnlockPanelManager once
  if (!unlockPanelManagerRef.current) {
    unlockPanelManagerRef.current = UnlockPanelManager.init({
      loginHandler: () => {
        // Called after successful wallet login - will navigate when backend auth completes
      },
      onClose: () => {
        navigate('/dashboard');
      },
      allowedProviders,
    });
  }

  const handleOpenUnlockPanel = () => {
    unlockPanelManagerRef.current?.openUnlockPanel();
  };

  // When wallet is connected with Native Auth, authenticate with our backend
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
      return;
    }
    if (!isWalletLoggedIn || !nativeAuthToken || isAuthenticating) {
      return;
    }

    const authenticateWithBackend = async () => {
      setIsAuthenticating(true);
      setError('');
      try {
        await loginWithNativeAuth(nativeAuthToken);
        navigate('/dashboard');
      } catch (err) {
        setError(err?.error || err?.message || 'Backend authentication failed');
      } finally {
        setIsAuthenticating(false);
      }
    };

    authenticateWithBackend();
  }, [isWalletLoggedIn, nativeAuthToken, user, loginWithNativeAuth, navigate, isAuthenticating]);

  // Redirect if already logged in
  if (user) {
    return null;
  }

  return (
    <Box sx={{ maxWidth: 420, mx: 'auto', mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Connect Wallet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Connect your MultiversX wallet to sign in securely. Supports xPortal, DeFi Wallet, Web Wallet, Ledger, and more.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {isAuthenticating ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Authenticating...
            </Typography>
          </Box>
        ) : (
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleOpenUnlockPanel}
            sx={{ mt: 2 }}
          >
            Connect Wallet
          </Button>
        )}
      </Paper>
    </Box>
  );
}
