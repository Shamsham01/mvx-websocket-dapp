import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { getAccountProvider } from '@multiversx/sdk-dapp/out/providers/helpers/accountProvider';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
    navigate('/login');
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component={Link} to="/" sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit' }}>
          MVX WebSocket DApp
        </Typography>
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
            <Button color="inherit" component={Link} to="/login">Login</Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
