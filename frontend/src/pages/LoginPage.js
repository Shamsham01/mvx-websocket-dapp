import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/out/react/account/useGetAccountInfo';
import { useGetLoginInfo } from '@multiversx/sdk-dapp/out/react/loginInfo/useGetLoginInfo';
import AuthRecovery from '../components/auth/AuthRecovery';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import { useAuth } from '../context/AuthContext';
import { openWalletConnect } from '../utils/walletConnect';

export default function LoginPage() {
  const { user, authError, isAuthenticating, retryNativeAuth, logout } = useAuth();
  const navigate = useNavigate();
  const { account } = useGetAccountInfo();
  const loginInfo = useGetLoginInfo();
  const nativeAuthToken = loginInfo?.tokenLogin?.nativeAuthToken;
  const isWalletLoggedIn = Boolean(account?.address);

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const handleDisconnect = async () => {
    await logout();
  };

  if (user) return null;

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
          {isAuthenticating && (
            <Stack alignItems="center" spacing={1.2} sx={{ py: 3 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Authenticating with backend...
              </Typography>
            </Stack>
          )}
          {(authError || isWalletLoggedIn) && (
            <AuthRecovery
              error={authError}
              isAuthenticating={isAuthenticating}
              retryDisabled={!nativeAuthToken}
              onRetry={retryNativeAuth}
              onDisconnect={handleDisconnect}
            />
          )}
          {!isWalletLoggedIn && (
            <Button
              variant="contained"
              size="large"
              onClick={() => openWalletConnect()}
              disabled={isAuthenticating}
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
