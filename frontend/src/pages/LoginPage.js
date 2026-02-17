import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, Alert, CircularProgress, Stack } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import {
  ExtensionLoginButton,
  WalletConnectLoginButton,
  WebWalletLoginButton,
  LedgerLoginButton,
} from '@multiversx/sdk-dapp/UI';
import { useGetIsLoggedIn, useGetLoginInfo } from '@multiversx/sdk-dapp/hooks/account';

const nativeAuthConfig = {
  expirySeconds: 86400,
  tokenExpirationToastWarningSeconds: 300,
};

export default function LoginPage() {
  const { user, loginWithNativeAuth } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const isWalletLoggedIn = useGetIsLoggedIn();
  const loginInfo = useGetLoginInfo();
  const nativeAuthToken = loginInfo?.tokenLogin?.nativeAuthToken;

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

  // Already logged in to our backend
  if (user) {
    return null; // Will redirect
  }

  const commonLoginProps = {
    callbackRoute: '/login',
    nativeAuth: nativeAuthConfig,
  };

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
          <Stack spacing={2} sx={{ mt: 2 }}>
            <ExtensionLoginButton
              {...commonLoginProps}
              loginButtonText="MultiversX DeFi Wallet"
            />
            <WalletConnectLoginButton
              {...commonLoginProps}
              loginButtonText="xPortal App"
              isWalletConnectV2
            />
            <WebWalletLoginButton
              {...commonLoginProps}
              loginButtonText="Web Wallet"
            />
            <LedgerLoginButton
              {...commonLoginProps}
              loginButtonText="Ledger Hardware Wallet"
            />
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
