import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, Button, CircularProgress, Grid, Card, CardContent } from '@mui/material';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    authAPI.getMe()
      .then((data) => setStats(data.stats))
      .catch(() => navigate('/login'));
  }, [user, navigate]);

  if (loading || !user) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 4 }} />;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Welcome, {user.address?.slice(0, 12)}...
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Total Subscriptions</Typography>
              <Typography variant="h4">{stats?.total_subscriptions ?? 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Active Subscriptions</Typography>
              <Typography variant="h4">{stats?.active_subscriptions ?? 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Button component={Link} to="/subscriptions/new" variant="contained" sx={{ mt: 3 }}>
        Create Subscription
      </Button>
    </Box>
  );
}
