import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import { useAuth } from '../context/AuthContext';
import { UnlockPanelManager } from '@multiversx/sdk-dapp/out/managers/UnlockPanelManager';
import { ProviderTypeEnum } from '@multiversx/sdk-dapp/out/providers/types/providerFactory.types';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/out/react/account/useGetAccountInfo';
import { useGetLoginInfo } from '@multiversx/sdk-dapp/out/react/loginInfo/useGetLoginInfo';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';

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
    <Box>
      <PageHeader
        title="Wallet Access"
        description="Authenticate with your MultiversX wallet to access dashboard features."
      />
      <SectionCard>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Supported providers include xPortal, DeFi Wallet, web wallet, Ledger, Passkey, and MetaMask.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {isAuthenticating ? (
            <Stack alignItems="center" spacing={1.2} sx={{ py: 3 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Authenticating with backend...
              </Typography>
            </Stack>
          ) : (
            <Button
              variant="contained"
              size="large"
              onClick={handleOpenUnlockPanel}
              startIcon={<AccountBalanceWalletRoundedIcon />}
              sx={{ width: { xs: '100%', sm: 'fit-content' } }}
            >
              Connect Wallet
            </Button>
          )}
        </Stack>
      </SectionCard>
    </Box>
  );
}
