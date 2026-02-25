import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Skeleton,
  Stack,
  Typography,
  useTheme
} from '@mui/material';
import { Link } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import SubscriptionsRoundedIcon from '@mui/icons-material/SubscriptionsRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import FilterAltOffRoundedIcon from '@mui/icons-material/FilterAltOffRounded';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import CopyableField from '../components/ui/CopyableField';
import ErrorState from '../components/ui/ErrorState';

const SHORT_NUMBER = new Intl.NumberFormat('en-US', { notation: 'compact' });

function formatDayLabel(day) {
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function truncateLabel(value, maxLength = 22) {
  if (!value) return 'Subscription';
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function buildTimelineRows(callsPerDay, selectedSubscriptionId) {
  const rows = selectedSubscriptionId
    ? callsPerDay.filter((item) => Number(item.subscription_id) === Number(selectedSubscriptionId))
    : callsPerDay;

  const byDay = new Map();
  rows.forEach((item) => {
    const day = String(item.day || '').slice(0, 10);
    if (!day) return;
    byDay.set(day, (byDay.get(day) || 0) + Number(item.total_calls || 0));
  });

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 29);

  return Array.from({ length: 30 }).map((_, index) => {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + index);
    const key = dayDate.toISOString().slice(0, 10);
    return {
      day: key,
      label: formatDayLabel(key),
      total_calls: byDay.get(key) || 0
    };
  });
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const [dashboard, setDashboard] = useState(null);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState(null);
  const [error, setError] = useState('');

  const fetchDashboard = React.useCallback(() => {
    setError('');
    authAPI
      .getDashboardAnalytics()
      .then((data) => {
        const subscriptions = data?.charts?.subscriptions || [];
        setDashboard(data);
        setSelectedSubscriptionId((previousValue) => {
          if (!previousValue) return previousValue;
          return subscriptions.some((item) => Number(item.id) === Number(previousValue))
            ? previousValue
            : null;
        });
      })
      .catch(() => setError('Unable to load dashboard analytics. Please reconnect and try again.'));
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchDashboard();
  }, [user, navigate, fetchDashboard]);

  if (loading || !user) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 8 }} />;

  const stats = dashboard?.stats;
  const subscriptionChartRows = dashboard?.charts?.subscriptions || [];
  const callsPerDay = dashboard?.charts?.calls_per_day || [];
  const selectedSubscription = subscriptionChartRows.find(
    (item) => Number(item.id) === Number(selectedSubscriptionId)
  );

  const timelineRows = buildTimelineRows(callsPerDay, selectedSubscriptionId);

  const handleBarClick = (event) => {
    const clicked = event?.activePayload?.[0]?.payload;
    if (!clicked?.id) return;
    setSelectedSubscriptionId((current) =>
      Number(current) === Number(clicked.id) ? null : Number(clicked.id)
    );
  };

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        description="Monitor your subscription analytics, webhook usage, and delivery trends."
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button component={Link} to="/subscriptions/new" variant="contained">
              Create Subscription
            </Button>
            <Button component={Link} to="/api-docs" variant="outlined">
              API Docs
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} lg={3}>
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
        <Grid item xs={12} sm={6} lg={3}>
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
        <Grid item xs={12} sm={6} lg={3}>
          {stats ? (
            <StatCard
              label="Total Webhook Calls"
              value={stats.total_webhook_calls ?? 0}
              caption="All webhook deliveries recorded"
              icon={<LinkRoundedIcon />}
            />
          ) : (
            <Skeleton variant="rounded" height={132} />
          )}
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          {stats ? (
            <StatCard
              label="Success Rate"
              value={`${stats.success_rate ?? 0}%`}
              caption={`${stats.failed_webhook_calls ?? 0} failed deliveries`}
              icon={<TrendingUpRoundedIcon />}
            />
          ) : (
            <Skeleton variant="rounded" height={132} />
          )}
        </Grid>
      </Grid>

      {error && (
        <Box sx={{ mt: 2.5 }}>
          <ErrorState title="Dashboard unavailable" message={error} onRetry={fetchDashboard} />
        </Box>
      )}

      <SectionCard
        title="Subscriptions vs Total Webhook Calls"
        description="Click a bar to filter the line chart below by that subscription."
        sx={{ mt: 3 }}
        action={
          selectedSubscriptionId ? (
            <Button
              onClick={() => setSelectedSubscriptionId(null)}
              variant="outlined"
              startIcon={<FilterAltOffRoundedIcon />}
            >
              Clear Filter
            </Button>
          ) : null
        }
      >
        {dashboard ? (
          subscriptionChartRows.length > 0 ? (
            <Box sx={{ width: '100%', height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subscriptionChartRows} onClick={handleBarClick}>
                  <CartesianGrid stroke={alpha(theme.palette.text.secondary, 0.15)} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                    tickFormatter={(value) => truncateLabel(value, 16)}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: alpha(theme.palette.primary.main, 0.08) }}
                    contentStyle={{
                      background: alpha(theme.palette.background.paper, 0.95),
                      borderColor: alpha(theme.palette.divider, 0.9),
                      borderRadius: 10,
                      color: theme.palette.text.primary
                    }}
                    formatter={(value) => [Number(value).toLocaleString(), 'Webhook Calls']}
                    labelFormatter={(value) => `Subscription: ${value}`}
                  />
                  <Bar dataKey="total_webhook_calls" radius={[9, 9, 0, 0]}>
                    {subscriptionChartRows.map((item) => {
                      const isSelected = Number(item.id) === Number(selectedSubscriptionId);
                      return (
                        <Cell
                          key={`subscription-bar-${item.id}`}
                          fill={
                            isSelected
                              ? theme.palette.secondary.main
                              : alpha(theme.palette.primary.main, 0.72)
                          }
                          cursor="pointer"
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Create your first subscription to start tracking webhook performance analytics.
            </Typography>
          )
        ) : (
          <Skeleton variant="rounded" height={340} />
        )}
      </SectionCard>

      <SectionCard
        title="Webhook Calls per Day"
        description={
          selectedSubscription
            ? `Showing daily calls for ${truncateLabel(selectedSubscription.name, 48)}`
            : 'Showing daily calls for all subscriptions'
        }
        sx={{ mt: 3 }}
      >
        {dashboard ? (
          <Box sx={{ width: '100%', height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineRows}>
                <CartesianGrid stroke={alpha(theme.palette.text.secondary, 0.14)} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                  minTickGap={20}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    background: alpha(theme.palette.background.paper, 0.95),
                    borderColor: alpha(theme.palette.divider, 0.9),
                    borderRadius: 10,
                    color: theme.palette.text.primary
                  }}
                  formatter={(value) => [Number(value).toLocaleString(), 'Calls']}
                  labelFormatter={(value, payload) => {
                    const dayKey = payload?.[0]?.payload?.day;
                    return dayKey ? formatDayLabel(dayKey) : value;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="total_calls"
                  stroke={theme.palette.primary.light}
                  strokeWidth={2.6}
                  dot={{ r: 2.6, fill: theme.palette.primary.light }}
                  activeDot={{ r: 5.2, fill: theme.palette.secondary.main }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Skeleton variant="rounded" height={340} />
        )}
      </SectionCard>

      <SectionCard title="Account" sx={{ mt: 3 }}>
        <Stack spacing={1.2}>
          <CopyableField value={user.address} label="Wallet" />
          <Typography variant="body2" color="text.secondary">
            {selectedSubscription
              ? `Filter applied: ${truncateLabel(selectedSubscription.name, 48)} (${SHORT_NUMBER.format(
                  selectedSubscription.total_webhook_calls || 0
                )} total calls).`
              : 'Welcome back. Use the subscriptions panel to manage your webhook automations and event filters.'}
          </Typography>
        </Stack>
      </SectionCard>
    </Box>
  );
}
