import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { billingAPI } from '../../services/api';
import SectionCard from '../ui/SectionCard';
import {
  REWARD_TOKEN_ID,
  STANDARD_REWARD_FEE_USD,
  STANDARD_USDC_FEE_USD,
  TWITTER_PREMIUM_USDC_FEE_USD,
  USDC_TOKEN_ID,
} from '../../constants/mvx';

export default function BillingPreferencesCard({ walletAddress }) {
  const [feeToken, setFeeToken] = useState('USDC');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadPrefs = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError('');
    try {
      const data = await billingAPI.getPrefs();
      setFeeToken(data?.prefs?.fee_token === 'REWARD' ? 'REWARD' : 'USDC');
    } catch (e) {
      setError(e?.error || e?.message || 'Could not load billing preferences.');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await billingAPI.savePrefs(feeToken);
      setSuccess('Billing preference saved.');
    } catch (e) {
      setError(e?.error || e?.message || 'Could not save billing preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (!walletAddress) return null;

  return (
    <SectionCard
      title="Usage fee token"
      description="Choose how standard MakeX apps charge your wallet after the free trial."
    >
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <Stack spacing={2}>
          <FormControl>
            <RadioGroup
              value={feeToken}
              onChange={(e) => {
                setFeeToken(e.target.value);
                setSuccess('');
              }}
            >
              <FormControlLabel
                value="USDC"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1">USDC (default)</Typography>
                    <Typography variant="body2" color="text.secondary">
                      ~${STANDARD_USDC_FEE_USD.toFixed(2)} per action · {USDC_TOKEN_ID}
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="REWARD"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1">REWARD discount</Typography>
                    <Typography variant="body2" color="text.secondary">
                      ~${STANDARD_REWARD_FEE_USD.toFixed(2)} per action · {REWARD_TOKEN_ID}
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>

          <Alert severity="info" variant="outlined">
            Twitter/X premium is always charged in USDC at ~${TWITTER_PREMIUM_USDC_FEE_USD.toFixed(2)} per action. It is not covered by the free trial or this REWARD discount.
          </Alert>

          {error && (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" variant="outlined">
              {success}
            </Alert>
          )}

          <Box>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save preference'}
            </Button>
          </Box>
        </Stack>
      )}
    </SectionCard>
  );
}
