import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useAuth } from '../context/AuthContext';
import { subscriptionAPI } from '../services/api';
import { useNotify } from '../context/NotificationContext';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import ErrorState from '../components/ui/ErrorState';

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
      function: '',
      token: '',
      tokenIdentifier: '',
      address: '',
      collectionIdentifier: '',
      amountMin: '',
      amountMax: ''
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [loadError, setLoadError] = useState('');

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
              function: f.function || '',
              token: f.token || '',
              tokenIdentifier: f.tokenIdentifier || '',
              address: f.address || '',
              collectionIdentifier: f.collectionIdentifier || '',
              amountMin: f.amountMin ?? '',
              amountMax: f.amountMax ?? ''
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
    if (form.filters.function) f.function = form.filters.function;
    if (form.filters.token) f.token = form.filters.token;
    if (form.filters.tokenIdentifier) f.tokenIdentifier = form.filters.tokenIdentifier;
    if (form.filters.address) f.address = form.filters.address;
    if (form.filters.collectionIdentifier) f.collectionIdentifier = form.filters.collectionIdentifier;
    if (form.filters.amountMin !== '') f.amountMin = form.filters.amountMin;
    if (form.filters.amountMax !== '') f.amountMax = form.filters.amountMax;
    return f;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const filters = buildFilters();
    if (Object.keys(filters).length === 0) {
      setError('At least one filter is required (sender, receiver, function, token, tokenIdentifier, or address)');
      return;
    }
    if (!form.name || !form.webhook_url) {
      setError('Name and webhook URL are required');
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
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Sender"
                  value={form.filters.sender}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, sender: e.target.value } })}
                  placeholder="erd1..."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Receiver"
                  value={form.filters.receiver}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, receiver: e.target.value } })}
                  placeholder="erd1..."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Token"
                  value={form.filters.token}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, token: e.target.value } })}
                  placeholder="EGLD or USDC-c76f1f"
                  helperText="EGLD or ESDT (e.g. USDC-c76f1f)."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Address"
                  value={form.filters.address}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, address: e.target.value } })}
                  placeholder="erd1..."
                  helperText="Matches sender OR receiver OR relayer."
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
                  Client-side filters (applied after WebSocket)
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Function"
                  value={form.filters.function}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, function: e.target.value } })}
                  placeholder="swap, buy, ESDTTransfer"
                  helperText="Smart contract function (e.g. swap, buy)."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Token identifier"
                  value={form.filters.tokenIdentifier}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, tokenIdentifier: e.target.value } })}
                  placeholder="REWARD-cf6eac"
                  helperText="ESDT in action.arguments.transfers (e.g. REWARD-cf6eac)."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Collection identifier"
                  value={form.filters.collectionIdentifier}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, collectionIdentifier: e.target.value } })}
                  placeholder="MADC-d03f58"
                  helperText="NFT collection (e.g. MADC-d03f58)."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Amount min (EGLD)"
                  value={form.filters.amountMin}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, amountMin: e.target.value } })}
                  placeholder="1000"
                  helperText="Min EGLD (e.g. 1000 for whale moves)."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Amount max (EGLD)"
                  value={form.filters.amountMax}
                  onChange={(e) => setForm({ ...form, filters: { ...form.filters, amountMax: e.target.value } })}
                  placeholder=""
                  helperText="Max EGLD (e.g. 5000)."
                />
              </Grid>
              {error && (
                <Grid item xs={12}>
                  <Alert severity="error">{error}</Alert>
                </Grid>
              )}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, pt: 1 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={saving}
                    startIcon={<SaveRoundedIcon />}
                  >
                    {saving ? 'Saving...' : isEdit ? 'Update Subscription' : 'Create Subscription'}
                  </Button>
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
