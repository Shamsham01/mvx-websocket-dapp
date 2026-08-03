import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import TollRoundedIcon from '@mui/icons-material/TollRounded';
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useAuth } from '../context/AuthContext';
import { subscriptionAPI } from '../services/api';
import { useNotify } from '../context/NotificationContext';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import ErrorState from '../components/ui/ErrorState';
import { DEFAULT_MAX_SUBSCRIPTIONS_PER_USER } from '../constants/subscriptionLimits';
import {
  NFT_GOALS,
  SUBSCRIPTION_PRESETS,
  SUBSCRIPTION_TYPE_IDS,
  SUBSCRIPTION_TYPES,
  applyNftGoal,
  buildApiFilters,
  buildSubscriptionSummary,
  emptyFilters,
  filtersForWatchType,
  inferSubscriptionType,
  parseFiltersFromSubscription,
  validateFiltersForType,
} from '../constants/subscriptionTypes';

const TYPE_ICONS = {
  [SUBSCRIPTION_TYPE_IDS.EGLD]: TollRoundedIcon,
  [SUBSCRIPTION_TYPE_IDS.TOKEN]: LocalOfferRoundedIcon,
  [SUBSCRIPTION_TYPE_IDS.NFT]: CollectionsRoundedIcon,
  [SUBSCRIPTION_TYPE_IDS.WALLET]: AccountBalanceWalletRoundedIcon,
  [SUBSCRIPTION_TYPE_IDS.CUSTOM]: TuneRoundedIcon,
};

function TypeCard({ type, selected, onSelect }) {
  const theme = useTheme();
  const Icon = TYPE_ICONS[type.id] || TuneRoundedIcon;
  return (
    <Box
      component="button"
      type="button"
      onClick={() => onSelect(type.id)}
      aria-pressed={selected}
      sx={{
        all: 'unset',
        cursor: 'pointer',
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        p: 1.75,
        borderRadius: 2,
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        backgroundColor: selected ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.common.white, 0.02),
        boxShadow: selected ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.45)}` : 'none',
        transition: 'border-color 160ms ease, background-color 160ms ease, transform 120ms ease',
        '&:hover': {
          borderColor: selected ? 'primary.main' : alpha(theme.palette.primary.main, 0.45),
          backgroundColor: selected
            ? alpha(theme.palette.primary.main, 0.14)
            : alpha(theme.palette.common.white, 0.04),
        },
        '&:active': { transform: 'scale(0.985)' },
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            bgcolor: selected ? alpha(theme.palette.primary.main, 0.2) : alpha(theme.palette.common.white, 0.05),
            color: selected ? 'primary.light' : 'text.secondary',
          }}
        >
          <Icon fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ lineHeight: 1.25 }}>
            {type.label}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.4 }}>
            {type.description}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

function FieldHint({ children }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
      {children}
    </Typography>
  );
}

function AdvancedFilters({ form, setFilters, classified }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <TextField
          label="Sender"
          value={form.filters.sender}
          onChange={(e) => setFilters({ sender: e.target.value })}
          placeholder="erd1..."
          fullWidth
          helperText="Account that signed the transaction."
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          label="Receiver"
          value={form.filters.receiver}
          onChange={(e) => setFilters({ receiver: e.target.value })}
          placeholder="erd1..."
          fullWidth
          helperText="Destination on the streamed row."
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          label="Function"
          value={form.filters.function}
          onChange={(e) => setFilters({ function: e.target.value })}
          placeholder="ESDTNFTTransfer, buy, auctionToken"
          fullWidth
          helperText="Contract function on this WebSocket row."
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Transaction type</InputLabel>
          <Select
            value={form.filters.transactionType}
            label="Transaction type"
            onChange={(e) => setFilters({ transactionType: e.target.value })}
          >
            <MenuItem value="">Any</MenuItem>
            <MenuItem value="normal">normal (user / contract call)</MenuItem>
            <MenuItem value="SmartContractResult">SmartContractResult (inner result)</MenuItem>
          </Select>
          <FieldHint>Use SmartContractResult for marketplace NFT delivery rows.</FieldHint>
        </FormControl>
      </Grid>
      <Grid item xs={12}>
        <FormControlLabel
          control={
            <Switch
              checked={!!form.filters.matchTopLevelOnly}
              onChange={(e) => setFilters({ matchTopLevelOnly: e.target.checked })}
            />
          }
          label="Match top-level fields only"
        />
        <FieldHint>
          When on, function and asset filters apply to this row only — not nested results inside a parent
          transaction.
        </FieldHint>
      </Grid>
      {!classified && (
        <>
          <Grid item xs={12} md={6}>
            <TextField
              label="Token identifier (ESDT)"
              value={form.filters.tokenIdentifier}
              onChange={(e) => setFilters({ tokenIdentifier: e.target.value })}
              placeholder="REWARD-cf6eac"
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Collection identifier (NFT)"
              value={form.filters.collectionIdentifier}
              onChange={(e) => setFilters({ collectionIdentifier: e.target.value })}
              placeholder="EMP-897b49"
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={!!form.filters.egldOnly}
                  onChange={(e) => setFilters({ egldOnly: e.target.checked })}
                />
              }
              label="EGLD transfers only"
            />
          </Grid>
        </>
      )}
    </Grid>
  );
}

export default function CreateSubscriptionPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const notify = useNotify();
  const theme = useTheme();

  const [form, setForm] = useState({
    name: '',
    webhook_url: '',
    network: 'mainnet',
    filters: filtersForWatchType(SUBSCRIPTION_TYPE_IDS.NFT, emptyFilters()),
  });
  const [watchType, setWatchType] = useState(SUBSCRIPTION_TYPE_IDS.NFT);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [subscriptionQuota, setSubscriptionQuota] = useState(null);

  const setFilters = (patch) => {
    setForm((prev) => ({ ...prev, filters: { ...prev.filters, ...patch } }));
  };

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
    if (!isEdit) return;

    setLoadingExisting(true);
    setLoadError('');
    subscriptionAPI
      .getOne(id)
      .then((data) => {
        const sub = data.subscription;
        const filters = parseFiltersFromSubscription(
          typeof sub.filters === 'object' ? sub.filters : {}
        );
        const inferred = inferSubscriptionType(filters);
        setWatchType(inferred);
        setForm({
          name: sub.name,
          webhook_url: sub.webhook_url,
          network: sub.network,
          filters,
        });
        if (inferred === SUBSCRIPTION_TYPE_IDS.CUSTOM) setAdvancedOpen(true);
      })
      .catch(() => setLoadError('Unable to load this subscription.'))
      .finally(() => setLoadingExisting(false));
  }, [user, navigate, id, isEdit]);

  const classified = form.filters.movementMode === 'classified';

  const summaryLines = useMemo(
    () =>
      buildSubscriptionSummary({
        watchType,
        filters: form.filters,
        network: form.network,
      }),
    [watchType, form.filters, form.network]
  );

  const handleWatchTypeChange = (typeId) => {
    setWatchType(typeId);
    setForm((prev) => ({
      ...prev,
      filters: filtersForWatchType(typeId, prev.filters),
    }));
    setAdvancedOpen(typeId === SUBSCRIPTION_TYPE_IDS.CUSTOM);
    setError('');
  };

  const applyPreset = (preset) => {
    setWatchType(preset.type);
    setForm((prev) => ({
      ...prev,
      name: prev.name?.trim() ? prev.name : preset.suggestedName,
      filters: { ...emptyFilters(), ...preset.filters },
    }));
    setAdvancedOpen(false);
    setError('');
    notify(`Applied preset: ${preset.label}`, 'info');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name || !form.webhook_url) {
      setError('Name and webhook URL are required');
      return;
    }

    const validationError = validateFiltersForType(watchType, form.filters);
    if (validationError) {
      setError(validationError);
      return;
    }

    const filters = buildApiFilters(form.filters, watchType);
    if (Object.keys(filters).length === 0) {
      setError('At least one filter is required.');
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
        description="Choose what to watch, then set a webhook. Advanced chain filters stay optional."
      />

      {loadError ? (
        <SectionCard>
          <ErrorState
            title="Subscription not available"
            message={loadError}
            onRetry={() => navigate('/subscriptions')}
          />
        </SectionCard>
      ) : (
        <Grid container spacing={2.5}>
          <Grid item xs={12} lg={8}>
            <SectionCard>
              <form onSubmit={handleSubmit}>
                {!isEdit && subscriptionQuota && subscriptionQuota.count != null && (
                  <Alert severity={atLimitCreate ? 'warning' : 'info'} sx={{ mb: 2.5 }}>
                    Subscriptions: {subscriptionQuota.count} of {subscriptionQuota.limit} used for your
                    wallet.
                    {atLimitCreate && ' Delete one on the Subscriptions page before creating another.'}
                  </Alert>
                )}

                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Basics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="Name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      fullWidth
                      placeholder="e.g. OOX PITTZ Sales"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Webhook URL"
                      value={form.webhook_url}
                      onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                      placeholder="https://hook.make.com/..."
                      required
                      fullWidth
                      helperText="HTTPS endpoint that receives events (Make.com, Zapier, your API)."
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
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
                </Grid>

                {!isEdit && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                      Quick start
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                      Optional presets fill sensible defaults. You can edit everything afterward.
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mb: 1 }}>
                      {SUBSCRIPTION_PRESETS.map((preset) => (
                        <Chip
                          key={preset.id}
                          label={preset.label}
                          onClick={() => applyPreset(preset)}
                          variant="outlined"
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Stack>
                  </>
                )}

                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                  What do you want to watch?
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Pick a type. Only the fields you need will appear.
                </Typography>
                <Grid container spacing={1.25} sx={{ mb: 2.5 }}>
                  {SUBSCRIPTION_TYPES.map((type) => (
                    <Grid item xs={12} sm={6} md={4} key={type.id}>
                      <TypeCard
                        type={type}
                        selected={watchType === type.id}
                        onSelect={handleWatchTypeChange}
                      />
                    </Grid>
                  ))}
                </Grid>

                {/* Type-specific simple fields */}
                {watchType === SUBSCRIPTION_TYPE_IDS.EGLD && (
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        label="Address (optional)"
                        value={form.filters.address}
                        onChange={(e) => setFilters({ address: e.target.value })}
                        placeholder="erd1..."
                        fullWidth
                        helperText="Leave empty for all EGLD legs matching your other filters; usually set your wallet or contract."
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Minimum EGLD"
                        value={form.filters.amountMin}
                        onChange={(e) => setFilters({ amountMin: e.target.value })}
                        placeholder="0.35"
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Maximum EGLD"
                        value={form.filters.amountMax}
                        onChange={(e) => setFilters({ amountMax: e.target.value })}
                        placeholder="5"
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                )}

                {watchType === SUBSCRIPTION_TYPE_IDS.TOKEN && (
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Token identifier"
                        value={form.filters.tokenIdentifier}
                        onChange={(e) => setFilters({ tokenIdentifier: e.target.value })}
                        placeholder="REWARD-cf6eac"
                        required
                        fullWidth
                        helperText="Fungible ESDT id from the explorer (not EGLD)."
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Related address (optional)"
                        value={form.filters.address}
                        onChange={(e) => setFilters({ address: e.target.value })}
                        placeholder="erd1..."
                        fullWidth
                        helperText="Limit to a wallet, DEX, or contract."
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Delivery mode</InputLabel>
                        <Select
                          value={form.filters.movementMode}
                          label="Delivery mode"
                          onChange={(e) => {
                            const enabled = e.target.value === 'classified';
                            setFilters({
                              movementMode: e.target.value,
                              movementTypes:
                                enabled && !form.filters.movementTypes.length
                                  ? ['BUY', 'SELL']
                                  : form.filters.movementTypes,
                              movementAmountMin:
                                enabled && !form.filters.movementAmountMin
                                  ? form.filters.amountMin
                                  : form.filters.movementAmountMin,
                              movementAmountMax:
                                enabled && !form.filters.movementAmountMax
                                  ? form.filters.amountMax
                                  : form.filters.movementAmountMax,
                              onlyConfirmed: enabled ? true : form.filters.onlyConfirmed,
                            });
                          }}
                        >
                          <MenuItem value="">Every transfer (raw)</MenuItem>
                          <MenuItem value="classified">Buys & sells (classified)</MenuItem>
                        </Select>
                        <FieldHint>
                          Classified mode resolves the full swap and sends one BUY/SELL/OTHER event.
                        </FieldHint>
                      </FormControl>
                    </Grid>
                    {classified ? (
                      <>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth required>
                            <InputLabel>Movement types</InputLabel>
                            <Select
                              multiple
                              value={form.filters.movementTypes}
                              label="Movement types"
                              onChange={(e) => setFilters({ movementTypes: e.target.value })}
                              renderValue={(selected) => selected.join(', ')}
                            >
                              {['BUY', 'SELL', 'OTHER'].map((type) => (
                                <MenuItem key={type} value={type}>
                                  <Checkbox checked={form.filters.movementTypes.includes(type)} />
                                  <ListItemText primary={type} />
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Min amount"
                            value={form.filters.movementAmountMin}
                            onChange={(e) => setFilters({ movementAmountMin: e.target.value })}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Max amount"
                            value={form.filters.movementAmountMax}
                            onChange={(e) => setFilters({ movementAmountMax: e.target.value })}
                            fullWidth
                          />
                        </Grid>
                      </>
                    ) : (
                      <>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Min amount"
                            value={form.filters.amountMin}
                            onChange={(e) => setFilters({ amountMin: e.target.value })}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="Max amount"
                            value={form.filters.amountMax}
                            onChange={(e) => setFilters({ amountMax: e.target.value })}
                            fullWidth
                          />
                        </Grid>
                      </>
                    )}
                  </Grid>
                )}

                {watchType === SUBSCRIPTION_TYPE_IDS.NFT && (
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Goal
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
                        {NFT_GOALS.map((goal) => (
                          <Chip
                            key={goal.id}
                            label={goal.label}
                            color={form.filters.nftGoal === goal.id ? 'primary' : 'default'}
                            variant={form.filters.nftGoal === goal.id ? 'filled' : 'outlined'}
                            onClick={() => setFilters(applyNftGoal(form.filters, goal.id))}
                            sx={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Stack>
                      <FieldHint>
                        {(NFT_GOALS.find((g) => g.id === form.filters.nftGoal) || NFT_GOALS[0]).description}
                      </FieldHint>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Collection identifier"
                        value={form.filters.collectionIdentifier}
                        onChange={(e) => setFilters({ collectionIdentifier: e.target.value })}
                        placeholder="PITTZ-1a4c2d"
                        required
                        fullWidth
                        helperText="NFT collection id from the MultiversX explorer."
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Marketplace / contract (optional)"
                        value={form.filters.address}
                        onChange={(e) => setFilters({ address: e.target.value })}
                        placeholder="erd1qqqq... (marketplace)"
                        fullWidth
                        helperText="Narrow to a marketplace contract. Use Quick start → OOX NFT sales to prefill OOX."
                      />
                    </Grid>
                  </Grid>
                )}

                {watchType === SUBSCRIPTION_TYPE_IDS.WALLET && (
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        label="Wallet or contract address"
                        value={form.filters.address}
                        onChange={(e) => setFilters({ address: e.target.value })}
                        placeholder="erd1..."
                        required
                        fullWidth
                        helperText="Matches when this address is sender, receiver, or relayer."
                      />
                    </Grid>
                  </Grid>
                )}

                {watchType === SUBSCRIPTION_TYPE_IDS.CUSTOM && (
                  <Box sx={{ mb: 1 }}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Custom mode exposes every filter. Prefer a simpler type above unless you need a special
                      combination.
                    </Alert>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Address"
                          value={form.filters.address}
                          onChange={(e) => setFilters({ address: e.target.value })}
                          placeholder="erd1..."
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Token identifier"
                          value={form.filters.tokenIdentifier}
                          onChange={(e) => setFilters({ tokenIdentifier: e.target.value })}
                          placeholder="REWARD-cf6eac"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Collection identifier"
                          value={form.filters.collectionIdentifier}
                          onChange={(e) => setFilters({ collectionIdentifier: e.target.value })}
                          placeholder="EMP-897b49"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={!!form.filters.egldOnly}
                              onChange={(e) => setFilters({ egldOnly: e.target.checked })}
                            />
                          }
                          label="EGLD transfers only"
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Amount min"
                          value={form.filters.amountMin}
                          onChange={(e) => setFilters({ amountMin: e.target.value })}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Amount max"
                          value={form.filters.amountMax}
                          onChange={(e) => setFilters({ amountMax: e.target.value })}
                          fullWidth
                        />
                      </Grid>
                    </Grid>
                    <AdvancedFilters form={form} setFilters={setFilters} classified={classified} />
                  </Box>
                )}

                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  When to notify
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!form.filters.onlyConfirmed || classified}
                      disabled={classified}
                      onChange={(e) => setFilters({ onlyConfirmed: e.target.checked })}
                    />
                  }
                  label="Only confirmed events"
                />
                <FieldHint>
                  {classified
                    ? 'Classified token movements always wait for confirmation.'
                    : 'Recommended for automations. Skips pending noise and sends one webhook when the transaction is final.'}
                </FieldHint>

                {watchType !== SUBSCRIPTION_TYPE_IDS.CUSTOM && (
                  <Accordion
                    disableGutters
                    elevation={0}
                    expanded={advancedOpen}
                    onChange={(_, open) => setAdvancedOpen(open)}
                    sx={{
                      mt: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: '12px !important',
                      '&:before': { display: 'none' },
                      bgcolor: alpha(theme.palette.common.white, 0.02),
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                      <Box>
                        <Typography variant="subtitle2">Advanced filters</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Function, transaction type, sender/receiver — optional power-user controls
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <AdvancedFilters form={form} setFilters={setFilters} classified={classified} />
                    </AccordionDetails>
                  </Accordion>
                )}

                {error && (
                  <Alert severity="error" sx={{ mt: 2.5 }}>
                    {error}
                  </Alert>
                )}

                <Box sx={{ display: 'flex', gap: 1, pt: 3, flexWrap: 'wrap' }}>
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
              </form>
            </SectionCard>
          </Grid>

          <Grid item xs={12} lg={4}>
            <SectionCard
              title="Summary"
              description="Plain-language view of what this subscription will deliver."
              sx={{
                position: { lg: 'sticky' },
                top: { lg: 88 },
              }}
            >
              <Stack spacing={1.1} sx={{ mb: 2 }}>
                {summaryLines.map((line) => (
                  <Typography
                    key={line}
                    variant="body2"
                    sx={{
                      pl: 1.25,
                      borderLeft: '2px solid',
                      borderColor: 'primary.dark',
                      color: 'text.secondary',
                    }}
                  >
                    {line}
                  </Typography>
                ))}
              </Stack>
              <Alert severity="info" sx={{ py: 1 }}>
                Tip: start with a Quick start chip or NFT Sales, then refine the collection id.
              </Alert>
            </SectionCard>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
