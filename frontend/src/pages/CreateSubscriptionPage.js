import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useAuth } from '../context/AuthContext';
import { subscriptionAPI } from '../services/api';
import { useNotify } from '../context/NotificationContext';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import ErrorState from '../components/ui/ErrorState';
import { DEFAULT_MAX_SUBSCRIPTIONS_PER_USER } from '../constants/subscriptionLimits';

export default function CreateSubscriptionPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const notify = useNotify();

  const [form, setForm] = useState({
    name: '',
    webhook_url: '',
    network: 'mainnet',
    filters: {
      sender: '',
      receiver: '',
      address: '',
      egldOnly: false,
      function: '',
      matchTopLevelOnly: false,
      transactionType: '',
      tokenIdentifier: '',
      collectionIdentifier: '',
      amountMin: '',
      amountMax: '',
      onlyConfirmed: false
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [loadError, setLoadError] = useState('');
  /** Existing subscriptions count + server limit (create flow only). */
  const [subscriptionQuota, setSubscriptionQuota] = useState(null);

  useEffect(() => {
    if (!user || isEdit) return;
    subscriptionAPI
      .getAll()
      .then((data) => {
        const list = data.subscriptions || [];
        setSubscriptionQuota({
          count: list.length,
          limit:
            typeof data.maxSubscriptionsPerUser === 'number'
              ? data.maxSubscriptionsPerUser
              : DEFAULT_MAX_SUBSCRIPTIONS_PER_USER,
        });
      })
      .catch(() =>
        setSubscriptionQuota({
          count: null,
          limit: DEFAULT_MAX_SUBSCRIPTIONS_PER_USER,
        })
      );
  }, [user, isEdit]);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    if (isEdit) {
      setLoadingExisting(true);
      setLoadError('');
      subscriptionAPI
        .getOne(id)
        .then((data) => {
          const sub = data.subscription;
          const f = typeof sub.filters === 'object' ? sub.filters : {};
          setForm({
            name: sub.name,
            webhook_url: sub.webhook_url,
            network: sub.network,
            filters: {
              sender: f.sender || '',
              receiver: f.receiver || '',
              address: f.address || '',
              egldOnly: !!(f.egldOnly || f.token === 'EGLD' || f.token === 'EGLD-000000'),
              function: f.function || '',
              matchTopLevelOnly: !!f.matchTopLevelOnly,
              transactionType: f.transactionType || '',
              tokenIdentifier: f.tokenIdentifier || '',
              collectionIdentifier: f.collectionIdentifier || '',
              amountMin: f.amountMin ?? '',
              amountMax: f.amountMax ?? '',
              onlyConfirmed: !!f.onlyConfirmed
            }
          });
        })
        .catch(() => setLoadError('Unable to load this subscription.'))
        .finally(() => setLoadingExisting(false));
    }
  }, [user, navigate, id, isEdit]);

  const buildFilters = () => {
    const f = {};
    if (form.filters.sender) f.sender = form.filters.sender;
    if (form.filters.receiver) f.receiver = form.filters.receiver;
    if (form.filters.address) f.address = form.filters.address;
    if (form.filters.egldOnly) f.egldOnly = true;
    if (form.filters.function) f.function = form.filters.function;
    if (form.filters.matchTopLevelOnly) f.matchTopLevelOnly = true;
    if (form.filters.transactionType) f.transactionType = form.filters.transactionType;
    if (form.filters.tokenIdentifier) f.tokenIdentifier = form.filters.tokenIdentifier;
    if (form.filters.collectionIdentifier) f.collectionIdentifier = form.filters.collectionIdentifier;
    if (form.filters.amountMin !== '') f.amountMin = form.filters.amountMin;
    if (form.filters.amountMax !== '') f.amountMax = form.filters.amountMax;
    if (form.filters.onlyConfirmed) f.onlyConfirmed = true;
    return f;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const filters = buildFilters();
    if (Object.keys(filters).length === 0) {
      setError(
        'At least one filter is required (sender, receiver, address, function, token identifier, collection, EGLD-only, or amount).'
      );
      return;
    }
    if (!form.name || !form.webhook_url) {
      setError('Name and webhook URL are required');
      return;
    }

    const atLimit =
      !isEdit &&
      subscriptionQuota &&
      subscriptionQuota.count != null &&
      subscriptionQuota.count >= subscriptionQuota.limit;
    if (atLimit) {
      setError(
        `Maximum of ${subscriptionQuota.limit} subscriptions per wallet. Remove one on the Subscriptions page first.`
      );
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await subscriptionAPI.update(id, { ...form, filters });
        notify('Subscription updated', 'success');
      } else {
        await subscriptionAPI.create({ ...form, filters });
        notify('Subscription created', 'success');
      }
      navigate('/subscriptions');
    } catch (err) {
      const msg = err?.details || err?.error || err?.message || 'Failed to save';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 8 }} />;
  if (loadingExisting) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 8 }} />;

  const atLimitCreate =
    !isEdit &&
    subscriptionQuota &&
    subscriptionQuota.count != null &&
    subscriptionQuota.count >= subscriptionQuota.limit;

  const subscriptionQuotaLoading = !isEdit && subscriptionQuota === null;

  return (
    <Box>
      <PageHeader
        title={isEdit ? 'Edit Subscription' : 'Create Subscription'}
        description="Define event filters and destination webhook for real-time delivery."
      />

      {loadError ? (
        <SectionCard>
          <ErrorState title="Subscription not available" message={loadError} onRetry={() => navigate('/subscriptions')} />
        </SectionCard>
      ) : (
        <SectionCard>
          <form onSubmit={handleSubmit}>
            {!isEdit && subscriptionQuota && subscriptionQuota.count != null && (
              <Alert severity={atLimitCreate ? 'warning' : 'info'} sx={{ mb: 2 }}>
                Subscriptions: {subscriptionQuota.count} of {subscriptionQuota.limit} used for your wallet.
                {atLimitCreate && ' Delete one on the Subscriptions page before creating another.'}
              </Alert>
            )}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Webhook URL"
                  value={form.webhook_url}
                  onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                  placeholder="https://your-endpoint.com/webhook"
                  required
                  helperText="Use an HTTPS endpoint for secure production delivery."
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Network</InputLabel>
                  <Select
                    value={form.network}
                    label="Network"
                    onChange={(e) => setForm({ ...form, network: e.target.value })}
                  >
                    <MenuItem value="mainnet">Mainnet</MenuItem>
                    <MenuItem value="testnet">Testnet</MenuItem>
                    <MenuItem value="devnet">Devnet</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Filters (at least one required)
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  API filters (sent to MultiversX WebSocket)
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                  Narrow what the chain streams before client-side filters run. ESDT and NFT rules belong in the section below.
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Sender"
                  value={form.filters.sender}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, sender: e.target.value } })}
                  placeholder="erd1..."
                  helperText="Account that signed the transaction. For marketplaces, prefer Address so user buy calls are included (buy lists the wallet as sender, contract as receiver)."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Receiver"
                  value={form.filters.receiver}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, receiver: e.target.value } })}
                  placeholder="erd1..."
                  helperText="Destination account on the WebSocket row. Pair with Function for contract calls (e.g. marketplace receiver + buy)."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Address"
                  value={form.filters.address}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, address: e.target.value } })}
                  placeholder="erd1qqqq... (OOX marketplace)"
                  helperText="Matches sender OR receiver OR relayer on the streamed row. Best for smart contracts (e.g. OOX marketplace erd1…jnflg)."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!form.filters.egldOnly}
                      onChange={(e) =>
                        setForm({ ...form, filters: { ...form.filters, egldOnly: e.target.checked } })
                      }
                    />
                  }
                  label="EGLD transfers only (API)"
                />
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5, ml: 4.5 }}>
                  ON: MultiversX filters native EGLD legs only. OFF: no token filter at API level. ESDT (e.g. REWARD-cf6eac) — use Token identifier below; USDC-style API token filters are unreliable.
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
                  Client-side filters (applied after WebSocket)
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                  Applied per WebSocket row. One logical action (e.g. marketplace buy) can produce multiple rows (buy + SmartContractResult).
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Function"
                  value={form.filters.function}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, function: e.target.value } })}
                  placeholder="ESDTNFTTransfer, buy, ESDTTransfer"
                  helperText="Endpoint or event name on this row (e.g. ESDTNFTTransfer for NFT delivery, buy for marketplace purchase)."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Transaction type</InputLabel>
                  <Select
                    value={form.filters.transactionType}
                    label="Transaction type"
                    onChange={(e) =>
                      setForm({ ...form, filters: { ...form.filters, transactionType: e.target.value } })
                    }
                  >
                    <MenuItem value="">Any</MenuItem>
                    <MenuItem value="normal">normal (user / contract call)</MenuItem>
                    <MenuItem value="SmartContractResult">SmartContractResult (inner result tx)</MenuItem>
                  </Select>
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.75 }}>
                    SmartContractResult includes MVX rows typed unsigned with an originalTxHash (common for NFT delivery SCRs). Pair with ESDTNFTTransfer to skip parent buy txs.
                  </Typography>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!form.filters.matchTopLevelOnly}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          filters: { ...form.filters, matchTopLevelOnly: e.target.checked },
                        })
                      }
                    />
                  }
                  label="Match top-level fields only"
                />
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5, ml: 4.5 }}>
                  ON: Function, sender, receiver, token, and collection must match this row only — not nested results/operations/logs.
                  Example: Function ESDTNFTTransfer + ON avoids matching a parent buy that contains ESDTNFTTransfer inside.
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Token identifier (ESDT)"
                  value={form.filters.tokenIdentifier}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, tokenIdentifier: e.target.value } })}
                  placeholder="REWARD-cf6eac"
                  helperText="Fungible ESDT on this row (e.g. farm reward REWARD-cf6eac). Not for EGLD — use EGLD transfers only (API) or amount min/max."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Collection identifier (NFT)"
                  value={form.filters.collectionIdentifier}
                  onChange={(e) =>
                    setForm({ ...form, filters: { ...form.filters, collectionIdentifier: e.target.value } })
                  }
                  placeholder="EMP-897b49"
                  helperText="NFT collection on this row (e.g. Empyreans EMP-897b49). Matches identifiers like EMP-897b49-3c."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Amount min"
                  value={form.filters.amountMin}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, amountMin: e.target.value } })}
                  placeholder={form.filters.tokenIdentifier ? '100' : '0.35'}
                  helperText={
                    form.filters.tokenIdentifier
                      ? `Minimum ${form.filters.tokenIdentifier} (human-readable). Decimals are loaded from MultiversX on save (REWARD-cf6eac uses 8, EGLD uses 18, etc.) and compared to atomic WebSocket values.`
                      : 'Minimum native EGLD on this row (human-readable, 18 decimals). Example: 0.35. Set Token identifier (e.g. REWARD-cf6eac) for ESDT amount filters.'
                  }
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Amount max"
                  value={form.filters.amountMax}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, amountMax: e.target.value } })}
                  placeholder={form.filters.tokenIdentifier ? '10000' : '5'}
                  helperText={
                    form.filters.tokenIdentifier
                      ? `Maximum ${form.filters.tokenIdentifier} (human-readable; chain decimals applied automatically).`
                      : 'Maximum native EGLD on this row. Set Token identifier to apply min/max to that ESDT instead of EGLD.'
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
                  Delivery options
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!form.filters.onlyConfirmed}
                      onChange={(e) =>
                        setForm({ ...form, filters: { ...form.filters, onlyConfirmed: e.target.checked } })
                      }
                    />
                  }
                  label="Only confirmed (1 webhook per tx)"
                />
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                  ON: Skip pending, only deliver when on-chain (success/fail). Best for payments and asset flows.
                  OFF: Deliver pending + confirmed. May get 2 webhooks per tx.
                </Typography>
              </Grid>

              {error && (
                <Grid item xs={12}>
                  <Alert severity="error">{error}</Alert>
                </Grid>
              )}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, pt: 1 }}>
                  <Tooltip
                    title={
                      atLimitCreate
                        ? `Limit reached (${subscriptionQuota.limit}). Delete a subscription first.`
                        : subscriptionQuotaLoading
                          ? 'Loading subscription quota…'
                          : ''
                    }
                  >
                    <span>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={saving || atLimitCreate || subscriptionQuotaLoading}
                        startIcon={<SaveRoundedIcon />}
                      >
                        {saving ? 'Saving...' : isEdit ? 'Update Subscription' : 'Create Subscription'}
                      </Button>
                    </span>
                  </Tooltip>
                  <Button variant="outlined" onClick={() => navigate('/subscriptions')}>
                    Cancel
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </SectionCard>
      )}
    </Box>
  );
}
