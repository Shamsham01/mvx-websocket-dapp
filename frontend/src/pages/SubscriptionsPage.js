import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Chip, CircularProgress
} from '@mui/material';
import { Link } from 'react-router-dom';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAuth } from '../context/AuthContext';
import { subscriptionAPI } from '../services/api';

export default function SubscriptionsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    subscriptionAPI.getAll()
      .then((data) => setSubscriptions(data.subscriptions || []))
      .catch(() => navigate('/'))
      .finally(() => setLoadingSubs(false));
  }, [user, navigate]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this subscription?')) return;
    try {
      await subscriptionAPI.delete(id);
      setSubscriptions((s) => s.filter((sub) => sub.id !== id));
    } catch (e) {
      alert(e?.error || 'Delete failed');
    }
  };

  if (loading || !user) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 4 }} />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Subscriptions</Typography>
        <Button component={Link} to="/subscriptions/new" variant="contained">
          New Subscription
        </Button>
      </Box>
      {loadingSubs ? (
        <CircularProgress />
      ) : subscriptions.length === 0 ? (
        <Typography color="text.secondary">No subscriptions yet. Create one to get started.</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
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
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>{sub.name}</TableCell>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sub.webhook_url}
                  </TableCell>
                  <TableCell>{sub.network}</TableCell>
                  <TableCell>
                    <Chip label={sub.is_active ? 'Active' : 'Inactive'} color={sub.is_active ? 'success' : 'default'} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton component={Link} to={`/subscriptions/${sub.id}`} size="small">
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(sub.id)} size="small" color="error">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
