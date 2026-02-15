import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { subscriptionAPI } from '../services/api';

export default function CreateSubscriptionPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [form, setForm] = useState({
    name: '',
    webhook_url: '',
    network: 'mainnet',
    filters: { sender: '', receiver: '', function: '', token: '', address: '' }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (isEdit) {
      subscriptionAPI.getOne(id)
        .then((data) => {
          const sub = data.subscription;
          setForm({
            name: sub.name,
            webhook_url: sub.webhook_url,
            network: sub.network,
            filters: typeof sub.filters === 'object' ? sub.filters : { sender: '', receiver: '', function: '', token: '', address: '' }
          });
        })
        .catch(() => navigate('/subscriptions'));
    }
  }, [user, navigate, id, isEdit]);

  const buildFilters = () => {
    const f = {};
    if (form.filters.sender) f.sender = form.filters.sender;
    if (form.filters.receiver) f.receiver = form.filters.receiver;
    if (form.filters.function) f.function = form.filters.function;
    if (form.filters.token) f.token = form.filters.token;
    if (form.filters.address) f.address = form.filters.address;
    return f;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const filters = buildFilters();
    if (Object.keys(filters).length === 0) {
      setError('At least one filter is required (sender, receiver, function, token, or address)');
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
      } else {
        await subscriptionAPI.create({ ...form, filters });
      }
      navigate('/subscriptions');
    } catch (err) {
      setError(err?.error || err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 4 }} />;

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>{isEdit ? 'Edit' : 'Create'} Subscription</Typography>
      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Webhook URL"
            value={form.webhook_url}
            onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
            placeholder="https://..."
            required
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
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
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Filters (at least one required)</Typography>
          <TextField fullWidth label="Sender" value={form.filters.sender} onChange={(e) => setForm({ ...form, filters: { ...form.filters, sender: e.target.value } })} sx={{ mb: 1 }} />
          <TextField fullWidth label="Receiver" value={form.filters.receiver} onChange={(e) => setForm({ ...form, filters: { ...form.filters, receiver: e.target.value } })} sx={{ mb: 1 }} />
          <TextField fullWidth label="Function" value={form.filters.function} onChange={(e) => setForm({ ...form, filters: { ...form.filters, function: e.target.value } })} sx={{ mb: 1 }} />
          <TextField fullWidth label="Token" value={form.filters.token} onChange={(e) => setForm({ ...form, filters: { ...form.filters, token: e.target.value } })} sx={{ mb: 1 }} />
          <TextField fullWidth label="Address" value={form.filters.address} onChange={(e) => setForm({ ...form, filters: { ...form.filters, address: e.target.value } })} sx={{ mb: 2 }} />
          {error && <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>}
          <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving...' : (isEdit ? 'Update' : 'Create')}</Button>
          <Button sx={{ ml: 1 }} onClick={() => navigate('/subscriptions')}>Cancel</Button>
        </form>
      </Paper>
    </Box>
  );
}
