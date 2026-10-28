import React, { useEffect, useState } from 'react';
import { Alert, Button, Stack } from '@mui/material';

export default function AuthRecovery({
  error,
  isAuthenticating = false,
  retryDisabled = false,
  onRetry,
  onDisconnect,
}) {
  const retryAt = error?.retryAt || 0;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!retryAt || retryAt <= Date.now()) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [retryAt]);

  const secondsLeft = retryAt > now ? Math.ceil((retryAt - now) / 1000) : 0;
  const busy = error?.code === 'upstream_rate_limited' || error?.code === 'upstream_unavailable';

  return (
    <Stack spacing={1.5}>
      {error?.message && (
        <Alert severity={busy ? 'warning' : 'error'}>
          {error.message}
          {secondsLeft > 0 ? ` Retry will be available in ${secondsLeft}s.` : ''}
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button
          variant="contained"
          onClick={onRetry}
          disabled={Boolean(retryDisabled) || isAuthenticating || secondsLeft > 0}
        >
          Retry Login
        </Button>
        <Button variant="outlined" color="inherit" onClick={onDisconnect}>
          Disconnect / Reset Wallet Session
        </Button>
      </Stack>
    </Stack>
  );
}
