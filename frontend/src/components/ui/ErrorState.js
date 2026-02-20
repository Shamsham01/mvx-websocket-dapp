import React from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';

export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <Stack spacing={2.2} sx={{ py: 3 }}>
      <Alert severity="error" variant="outlined">
        <Typography variant="subtitle2">{title}</Typography>
        {message && (
          <Typography variant="body2" sx={{ mt: 0.6 }}>
            {message}
          </Typography>
        )}
      </Alert>
      {onRetry && (
        <Button variant="outlined" color="error" onClick={onRetry} sx={{ width: 'fit-content' }}>
          Retry
        </Button>
      )}
    </Stack>
  );
}
