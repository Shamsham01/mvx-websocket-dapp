import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Grid, Skeleton, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import SubscriptionsRoundedIcon from '@mui/icons-material/SubscriptionsRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import CopyableField from '../components/ui/CopyableField';
import ErrorState from '../components/ui/ErrorState';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const fetchStats = React.useCallback(() => {
    setError('');
    authAPI
      .getMe()
      .then((data) => setStats(data.stats))
      .catch(() => setError('Unable to load dashboard stats. Please reconnect and try again.'));
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchStats();
  }, [user, navigate, fetchStats]);

  if (loading || !user) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 8 }} />;

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        description="Monitor your subscription activity and account status."
        actions={
          <Button component={Link} to="/subscriptions/new" variant="contained">
            Create Subscription
          </Button>
        }
      />

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          {stats ? (
            <StatCard
              label="Total Subscriptions"
              value={stats.total_subscriptions ?? 0}
              caption="All subscriptions owned by your wallet"
              icon={<SubscriptionsRoundedIcon />}
            />
          ) : (
            <Skeleton variant="rounded" height={132} />
          )}
        </Grid>
        <Grid item xs={12} md={6}>
          {stats ? (
            <StatCard
              label="Active Subscriptions"
              value={stats.active_subscriptions ?? 0}
              caption="Subscriptions currently receiving live events"
              icon={<VerifiedRoundedIcon />}
            />
          ) : (
            <Skeleton variant="rounded" height={132} />
          )}
        </Grid>
      </Grid>

      {error && (
        <Box sx={{ mt: 2.5 }}>
          <ErrorState title="Dashboard unavailable" message={error} onRetry={fetchStats} />
        </Box>
      )}

      <SectionCard title="Account" sx={{ mt: 3 }}>
        <Stack spacing={1.2}>
          <CopyableField value={user.address} label="Wallet" />
          <Typography variant="body2" color="text.secondary">
            Welcome back. Use the subscriptions panel to manage your webhook automations and event filters.
          </Typography>
        </Stack>
      </SectionCard>
    </Box>
  );
}
