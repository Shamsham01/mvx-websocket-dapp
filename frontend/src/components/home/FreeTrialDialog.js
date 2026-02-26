import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { useAuth } from '../../context/AuthContext';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const TABLE = 'makex_usage_fee_whitelist';
const TRIAL_DAYS = 30;

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function FreeTrialDialog({ open, onClose }) {
  const { user } = useAuth();
  const walletAddress = user?.address ?? '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const startDate = useMemo(() => new Date(), []);
  const endDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + TRIAL_DAYS);
    return d;
  }, []);

  const resetForm = useCallback(() => {
    setName('');
    setEmail('');
    setError('');
    setSuccess(false);
    setSubmitting(false);
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const body = {
        wallet_address: walletAddress,
        name: name.trim(),
        email: email.trim() || null,
        whitelist_start: startDate.toISOString(),
        whitelist_end: endDate.toISOString(),
        status: 'valid',
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(body),
      });

      if (res.status === 409 || res.status === 23505) {
        setError('This wallet address already has a free trial. Each wallet can only claim one trial.');
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.message || data?.error || '';
        if (msg.includes('unique') || msg.includes('duplicate')) {
          setError('This wallet address already has a free trial. Each wallet can only claim one trial.');
        } else {
          setError(msg || 'Something went wrong. Please try again.');
        }
        setSubmitting(false);
        return;
      }

      setSuccess(true);
    } catch (_) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { backgroundImage: 'none' } }}
    >
      {success ? (
        <>
          <DialogContent sx={{ textAlign: 'center', py: 5 }}>
            <CheckCircleOutlineRoundedIcon
              sx={{ fontSize: 56, color: 'success.main', mb: 2 }}
            />
            <Typography variant="h5" sx={{ mb: 1 }}>
              Free Trial Activated!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Your 30-day free trial is active until:
            </Typography>
            <Typography variant="h6" color="primary.main">
              {formatDate(endDate)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              All MakeX apps are now fee-free for your wallet.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button variant="contained" onClick={handleClose} fullWidth>
              Done
            </Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle>
            Claim Your Free Trial
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              30 days fee-free access to every MakeX app. No credit card required.
            </Typography>
          </DialogTitle>

          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField
                label="Wallet Address"
                value={walletAddress}
                disabled
                helperText="Your connected MultiversX wallet. This cannot be changed."
                InputProps={{
                  sx: {
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                  },
                }}
              />

              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your name or project name"
                helperText="Used to identify your trial. Can be a personal name, team, or project."
                autoFocus
              />

              <TextField
                label="Email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@example.com"
                helperText="Only needed if you want to receive a reminder a few days before your trial expires. We won't use it for anything else."
              />

              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  '& .MuiTextField-root': { flex: 1 },
                }}
              >
                <TextField
                  label="Trial Starts"
                  value={formatDate(startDate)}
                  disabled
                  helperText="Today"
                  InputProps={{
                    sx: {
                      color: (t) => alpha(t.palette.text.primary, 0.5),
                    },
                  }}
                />
                <TextField
                  label="Trial Expires"
                  value={formatDate(endDate)}
                  disabled
                  helperText={`${TRIAL_DAYS}-day free trial period`}
                  InputProps={{
                    sx: {
                      color: (t) => alpha(t.palette.text.primary, 0.5),
                    },
                  }}
                />
              </Box>

              {error && (
                <Alert severity="error" variant="outlined">
                  {error}
                </Alert>
              )}
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || !walletAddress}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {submitting ? 'Claiming\u2026' : 'Claim Free Trial'}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
