import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Button, Alert } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const handleDevLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!address || address.length < 20) {
      setError('Please enter a valid MultiversX address (erd1...)');
      return;
    }
    try {
      await login(address, 'dev-signature', 'dev-message');
      navigate('/dashboard');
    } catch (err) {
      setError(err?.error || err?.message || 'Login failed');
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Login</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Connect with your MultiversX wallet or use dev login for testing.
        </Typography>
        <form onSubmit={handleDevLogin}>
          <TextField
            fullWidth
            label="MultiversX Address (erd1...)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="erd1..."
            sx={{ mb: 2 }}
          />
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Button type="submit" variant="contained" fullWidth>
            Dev Login (Testing)
          </Button>
        </form>
        <Typography variant="caption" display="block" sx={{ mt: 2 }} color="text.secondary">
          Note: Wallet connect (xPortal) can be added. For now, paste any erd1 address to test.
        </Typography>
      </Paper>
    </Box>
  );
}
