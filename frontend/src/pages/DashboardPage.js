import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import StatCard from '../components/ui/StatCard';
import ErrorState from '../components/ui/ErrorState';
import { fetchRewardTokenDenominated, fetchUsageFeeTransfersPage } from '../services/mvxPublicApi';
import { MAKEX_USAGE_FEE_ADDRESS, REWARD_TOKEN_ID } from '../constants/mvx';
import {
  aggregateByDay,
  buildChartRows,
  buildPeriodSnapshot,
  fillDailyGaps,
  filterDailyByChartWindow,
  formatDayLabel,
  normalizeUsageTransfers,
} from '../utils/usageFeeAnalytics';

const REWARD_MAX_DIGITS = new Intl.NumberFormat('en-US', {
  maximumSignificantDigits: 8,
  minimumSignificantDigits: 2,
});

const USD_FULL = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD_MICRO = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 6,
});

function formatReward(n) {
  if (n === 0) return '0 REWARD';
  const abs = Math.abs(n);
  const formatted =
    abs >= 1 ? n.toLocaleString('en-US', { maximumFractionDigits: 4 }) : REWARD_MAX_DIGITS.format(n);
  return `${formatted} REWARD`;
}

function formatUsd(n) {
  const abs = Math.abs(n);
  if (abs > 0 && abs < 0.01) return USD_MICRO.format(n);
  return USD_FULL.format(n);
}

const KPI_PERIODS = [
  { key: 'week', label: '7d' },
  { key: 'month', label: '30d' },
  { key: 'quarter', label: '90d' },
  { key: 'year', label: '365d' },
  { key: 'all', label: 'All' },
];

const PAGE_SIZE = 100;
const MAX_PAGES = 250;

const CHART_WINDOWS = [
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: '365d', label: '1y' },
  { key: 'all', label: 'All' },
];

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  const [rawTransfers, setRawTransfers] = useState([]);
  const [priceUsd, setPriceUsd] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [truncated, setTruncated] = useState(false);

  const [kpiPeriod, setKpiPeriod] = useState('month');
  const [chartMetric, setChartMetric] = useState('usd');
  const [chartMode, setChartMode] = useState('daily');
  const [chartWindow, setChartWindow] = useState('90d');

  const loadChainData = useCallback(async () => {
    if (!user?.address) return;
    setLoadError('');
    setLoadingData(true);
    try {
      const [tokenMeta, firstPage] = await Promise.all([
        fetchRewardTokenDenominated(),
        fetchUsageFeeTransfersPage(user.address, { from: 0, size: PAGE_SIZE }),
      ]);

      const price = Number(tokenMeta?.price) || 0;
      setPriceUsd(price);

      let combined = [...firstPage];
      if (firstPage.length === PAGE_SIZE) {
        for (let page = 1; page < MAX_PAGES; page += 1) {
          const batch = await fetchUsageFeeTransfersPage(user.address, {
            from: page * PAGE_SIZE,
            size: PAGE_SIZE,
          });
          combined = combined.concat(batch);
          if (batch.length < PAGE_SIZE) break;
        }
      }
      setTruncated(combined.length >= PAGE_SIZE * MAX_PAGES);
      setRawTransfers(combined);
    } catch {
      setLoadError(
        'Could not load on-chain usage data from MultiversX public API. Try again in a moment.'
      );
      setRawTransfers([]);
      setPriceUsd(0);
    } finally {
      setLoadingData(false);
    }
  }, [user?.address]);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    loadChainData();
  }, [user, navigate, loadChainData]);

  const rows = useMemo(() => normalizeUsageTransfers(rawTransfers), [rawTransfers]);
  const snapshot = useMemo(() => buildPeriodSnapshot(rows, priceUsd), [rows, priceUsd]);
  const dailyAll = useMemo(() => aggregateByDay(rows, priceUsd), [rows, priceUsd]);

  const chartDailyFiltered = useMemo(
    () => filterDailyByChartWindow(dailyAll, chartWindow),
    [dailyAll, chartWindow]
  );

  const chartPadded = useMemo(() => {
    if (!chartDailyFiltered.length) return [];
    const start = chartDailyFiltered[0].day;
    const end = chartDailyFiltered[chartDailyFiltered.length - 1].day;
    return fillDailyGaps(chartDailyFiltered, start, end);
  }, [chartDailyFiltered]);

  const chartData = useMemo(
    () => buildChartRows(chartPadded, chartMode),
    [chartPadded, chartMode]
  );

  const activeKpi = snapshot[kpiPeriod] || snapshot.month;

  const lineDataKey = chartMetric === 'usd' ? 'usd' : 'reward';
  const lineFormatter = chartMetric === 'usd' ? (v) => formatUsd(v) : (v) => formatReward(v);

  if (loading || !user) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 8 }} />;

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        description="Track MakeX usage fees paid in REWARD to the protocol treasury—pulled live from MultiversX."
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <Chip
              size="small"
              label={`${REWARD_TOKEN_ID} @ ${priceUsd ? formatUsd(priceUsd) : '…'} / token`}
              variant="outlined"
              sx={{ borderColor: alpha(theme.palette.primary.main, 0.35) }}
            />
            <Button
              variant="outlined"
              startIcon={<AutorenewRoundedIcon />}
              onClick={loadChainData}
              disabled={loadingData}
            >
              Refresh
            </Button>
            <Button component={Link} to="/subscriptions" variant="contained">
              Subscriptions
            </Button>
          </Stack>
        }
      />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        USD amounts use the latest REWARD price from the public token endpoint (
        <Typography component="span" variant="caption" sx={{ color: 'primary.light' }}>
          denominated=true
        </Typography>
        ). Historical fiat value may differ from spot rates at each transaction.
      </Typography>

      {loadError && (
        <Box sx={{ mb: 2 }}>
          <ErrorState title="Chain data unavailable" message={loadError} onRetry={loadChainData} />
        </Box>
      )}

      <SectionCard
        title="Focus period"
        description="Applies to the primary KPIs below (call count, totals, averages)."
        sx={{ mb: 2 }}
        action={
          <ToggleButtonGroup
            exclusive
            size="small"
            value={kpiPeriod}
            onChange={(_, v) => v && setKpiPeriod(v)}
            sx={{
              flexWrap: 'wrap',
              '& .MuiToggleButton-root': { px: 1.5, py: 0.6, textTransform: 'none' },
            }}
          >
            {KPI_PERIODS.map((p) => (
              <ToggleButton key={p.key} value={p.key}>
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        }
      />

      <Grid container spacing={3} sx={{ mb: 1 }}>
        <Grid item xs={12} sm={6} md={3}>
          {loadingData && !rows.length ? (
            <Skeleton variant="rounded" height={132} />
          ) : (
            <StatCard
              label="Paid transfers (calls)"
              value={activeKpi.count.toLocaleString()}
              caption="Successful REWARD sends to the MakeX usage wallet"
              icon={<ReceiptLongRoundedIcon />}
            />
          )}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {loadingData && !rows.length ? (
            <Skeleton variant="rounded" height={132} />
          ) : (
            <StatCard
              label="Total paid (REWARD)"
              value={formatReward(activeKpi.totalReward)}
              caption="Gross REWARD sent in the selected focus period"
              icon={<SavingsRoundedIcon />}
            />
          )}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {loadingData && !rows.length ? (
            <Skeleton variant="rounded" height={132} />
          ) : (
            <StatCard
              label="Total paid (USD est.)"
              value={formatUsd(activeKpi.totalUsd)}
              caption="Spot REWARD × latest token price"
              icon={<PaidRoundedIcon />}
            />
          )}
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {loadingData && !rows.length ? (
            <Skeleton variant="rounded" height={132} />
          ) : (
            <StatCard
              label="Average per call"
              value={`${formatReward(activeKpi.avgReward)} · ${formatUsd(activeKpi.avgUsd)}`}
              caption="Mean payment size for the focus period"
              icon={<ShowChartRoundedIcon />}
            />
          )}
        </Grid>
      </Grid>

      <SectionCard
        title="Period breakdown"
        description="Quick comparison of totals for standard windows (independent of the focus selector above)."
        sx={{ mt: 3 }}
      >
        <Grid container spacing={2}>
          {[
            { key: 'week', title: 'Last 7 days', s: snapshot.week },
            { key: 'month', title: 'Last 30 days', s: snapshot.month },
            { key: 'quarter', title: 'Last 90 days', s: snapshot.quarter },
            { key: 'year', title: 'Last 365 days', s: snapshot.year },
          ].map(({ key, title, s }) => (
            <Grid item xs={12} sm={6} md={3} key={key}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  background: alpha(theme.palette.background.paper, 0.55),
                }}
              >
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {title}
                </Typography>
                <Typography variant="h6">{s.count.toLocaleString()} payments</Typography>
                <Typography variant="body2" color="primary.light" sx={{ mt: 0.5 }}>
                  {formatReward(s.totalReward)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatUsd(s.totalUsd)} est.
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </SectionCard>

      <SectionCard
        title="Cost over time"
        description="Daily or cumulative series; adjust denomination and horizon with the controls."
        sx={{ mt: 3 }}
        action={
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
            flexWrap="wrap"
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={chartMetric}
              onChange={(_, v) => v && setChartMetric(v)}
            >
              <ToggleButton value="usd">USD (est.)</ToggleButton>
              <ToggleButton value="reward">REWARD</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={chartMode}
              onChange={(_, v) => v && setChartMode(v)}
            >
              <ToggleButton value="daily">Daily</ToggleButton>
              <ToggleButton value="cumulative">Cumulative</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={chartWindow}
              onChange={(_, v) => v && setChartWindow(v)}
            >
              {CHART_WINDOWS.map((w) => (
                <ToggleButton key={w.key} value={w.key}>
                  {w.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
        }
      >
        {loadingData && !chartData.length ? (
          <Skeleton variant="rounded" height={360} />
        ) : chartData.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No REWARD usage payments to{' '}
            <Typography component="span" variant="body2" sx={{ color: 'text.primary' }}>
              {MAKEX_USAGE_FEE_ADDRESS.slice(0, 10)}…
            </Typography>{' '}
            were found for this wallet yet.
          </Typography>
        ) : (
          <Box sx={{ width: '100%', height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke={alpha(theme.palette.text.secondary, 0.14)} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                  tickFormatter={(v) =>
                    chartMetric === 'usd'
                      ? v >= 1000
                        ? `$${(v / 1000).toFixed(1)}k`
                        : formatUsd(v)
                      : v >= 1000
                      ? `${(v / 1000).toFixed(1)}k`
                      : REWARD_MAX_DIGITS.format(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: alpha(theme.palette.background.paper, 0.96),
                    borderColor: alpha(theme.palette.divider, 0.9),
                    borderRadius: 10,
                    color: theme.palette.text.primary,
                  }}
                  formatter={(value) => [lineFormatter(value), chartMetric === 'usd' ? 'USD (est.)' : 'REWARD']}
                  labelFormatter={(_, payload) => {
                    const d = payload?.[0]?.payload?.day;
                    return d ? formatDayLabel(d) : '';
                  }}
                />
                <Line
                  type="monotone"
                  dataKey={lineDataKey}
                  stroke={chartMetric === 'usd' ? theme.palette.secondary.light : theme.palette.primary.light}
                  strokeWidth={2.6}
                  dot={false}
                  activeDot={{ r: 5.2, fill: theme.palette.secondary.main }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
        {truncated && (
          <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
            Results capped at {PAGE_SIZE * MAX_PAGES} transfers. Totals may be incomplete for very active
            wallets.
          </Typography>
        )}
      </SectionCard>

      <SectionCard
        title="Recent payments"
        description="Latest on-chain transfers included in the aggregates above."
        sx={{ mt: 3 }}
      >
        {loadingData && !rows.length ? (
          <Skeleton variant="rounded" height={200} />
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nothing to list yet.
          </Typography>
        ) : (
          <Table size="small" sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>When (UTC)</TableCell>
                <TableCell align="right">REWARD</TableCell>
                <TableCell align="right">USD (est.)</TableCell>
                <TableCell>Transaction</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows
                .slice()
                .reverse()
                .slice(0, 12)
                .map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      {new Date(r.timestamp * 1000).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </TableCell>
                    <TableCell align="right">{formatReward(r.reward)}</TableCell>
                    <TableCell align="right">{formatUsd(r.reward * priceUsd)}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        href={`https://explorer.multiversx.com/transactions/${r.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </Box>
  );
}
