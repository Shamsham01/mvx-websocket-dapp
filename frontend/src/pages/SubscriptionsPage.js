import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { Link } from 'react-router-dom';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SyncProblemRoundedIcon from '@mui/icons-material/SyncProblemRounded';
import { useAuth } from '../context/AuthContext';
import { subscriptionAPI } from '../services/api';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import CopyableField from '../components/ui/CopyableField';
import { useNotify } from '../context/NotificationContext';

export default function SubscriptionsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const notify = useNotify();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [error, setError] = useState('');
  const [dense, setDense] = useState(false);

  const loadSubscriptions = React.useCallback(() => {
    setLoadingSubs(true);
    setError('');
    subscriptionAPI
      .getAll()
      .then((data) => setSubscriptions(data.subscriptions || []))
      .catch(() => setError('Could not fetch subscriptions. Check connection and try again.'))
      .finally(() => setLoadingSubs(false));
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    loadSubscriptions();
  }, [user, navigate, loadSubscriptions]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this subscription?')) return;
    try {
      await subscriptionAPI.delete(id);
      setSubscriptions((s) => s.filter((sub) => sub.id !== id));
      notify('Subscription deleted', 'success');
    } catch (e) {
      notify(e?.error || 'Delete failed', 'error');
    }
  };

  if (loading || !user) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 8 }} />;

  return (
    <Box>
      <PageHeader
        title="Subscriptions"
        description="Manage webhook subscriptions, filters, and target networks."
        actions={
          <Button component={Link} to="/subscriptions/new" variant="contained" startIcon={<AddRoundedIcon />}>
            New Subscription
          </Button>
        }
      />

      {loadingSubs ? (
        <SectionCard>
          <Skeleton variant="rounded" height={52} sx={{ mb: 1.2 }} />
          <Skeleton variant="rounded" height={300} />
        </SectionCard>
      ) : error ? (
        <SectionCard>
          <ErrorState title="Network/WebSocket down" message={error} onRetry={loadSubscriptions} />
        </SectionCard>
      ) : subscriptions.length === 0 ? (
        <EmptyState
          title="No subscriptions yet"
          description="Create your first subscription to stream MultiversX events into your automation stack."
          actionLabel="Create Subscription"
          onAction={() => navigate('/subscriptions/new')}
          icon={<SyncProblemRoundedIcon fontSize="large" />}
        />
      ) : (
        <SectionCard
          action={
            <FormControlLabel
              control={<Switch checked={dense} onChange={(e) => setDense(e.target.checked)} size="small" />}
              label={<Typography variant="caption">Compact density</Typography>}
            />
          }
        >
          <TableContainer sx={{ borderRadius: 2, border: '1px solid rgba(148, 163, 184, 0.16)' }}>
            <Table stickyHeader size={dense ? 'small' : 'medium'}>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Webhook</TableCell>
                  <TableCell>Network</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {subscriptions.map((sub, index) => (
                  <TableRow
                    key={sub.id}
                    hover
                    sx={{
                      '& td': { borderColor: 'divider' },
                      backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(15, 23, 42, 0.26)',
                    }}
                  >
                    <TableCell>{sub.name}</TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <CopyableField value={sub.webhook_url} onCopy={() => notify('Webhook URL copied', 'success')} />
                    </TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{sub.network}</TableCell>
                    <TableCell>
                      <Chip
                        label={sub.is_active ? 'Active' : 'Inactive'}
                        color={sub.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit subscription">
                        <IconButton component={Link} to={`/subscriptions/${sub.id}`} size="small">
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete subscription">
                        <IconButton onClick={() => handleDelete(sub.id)} size="small" color="error">
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </SectionCard>
      )}
    </Box>
  );
}
