import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useAuth } from '../context/AuthContext';
import { useNotify } from '../context/NotificationContext';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import ViewModuleRoundedIcon from '@mui/icons-material/ViewModuleRounded';
import { fetchMakeTemplates } from '../services/supabaseMakeTemplates';
import { templateAPI } from '../services/api';
import { isTemplatesAdmin } from '../constants/templatesAdmin';

async function downloadBlueprintFile(url, filename) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('failed');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'blueprint.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function TemplateFormDialog({ open, onClose, mode, template, onSaved, notify, isAdmin }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [blueprintFile, setBlueprintFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setPreviewFile(null);
    setBlueprintFile(null);
    if (mode === 'edit' && template) {
      setTitle(template.title || '');
      setDescription(template.description || '');
    } else {
      setTitle('');
      setDescription('');
    }
  }, [open, mode, template]);

  const handleSubmit = async () => {
    if (!isAdmin) return;
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (mode === 'create' && (!previewFile || !blueprintFile)) {
      setError('Preview image and blueprint JSON are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      if (previewFile) fd.append('preview', previewFile);
      if (blueprintFile) fd.append('blueprint', blueprintFile);

      if (mode === 'create') {
        await templateAPI.create(fd);
        notify('Template published', 'success');
      } else {
        await templateAPI.update(template.id, fd);
        notify('Template updated', 'success');
      }
      onSaved();
      onClose();
    } catch (e) {
      const msg = e?.error || e?.message || 'Request failed';
      setError(typeof msg === 'string' ? msg : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'create' ? 'Upload template' : 'Edit template'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.2} sx={{ mt: 1 }}>
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={4}
          />
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
              Preview image {mode === 'edit' ? '(optional — leave blank to keep current)' : ''}
            </Typography>
            <Button variant="outlined" component="label" size="small">
              Choose image
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => setPreviewFile(e.target.files?.[0] || null)}
              />
            </Button>
            {previewFile && (
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                {previewFile.name}
              </Typography>
            )}
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
              Make.com blueprint {mode === 'edit' ? '(optional — JSON file)' : ''}
            </Typography>
            <Button variant="outlined" component="label" size="small">
              Choose blueprint.json
              <input
                type="file"
                hidden
                accept=".json,application/json"
                onChange={(e) => setBlueprintFile(e.target.files?.[0] || null)}
              />
            </Button>
            {blueprintFile && (
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                {blueprintFile.name}
              </Typography>
            )}
          </Box>
          {error && (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving…' : mode === 'create' ? 'Publish' : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function TemplatesPage() {
  const theme = useTheme();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const notify = useNotify();

  const [templates, setTemplates] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [loadingList, setLoadingList] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create');
  const [editing, setEditing] = useState(null);

  const isAdmin = isTemplatesAdmin(user?.address);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setLoadError('');
    try {
      const rows = await fetchMakeTemplates();
      setTemplates(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setLoadError(e?.message || 'Could not load templates.');
      setTemplates([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    loadList();
  }, [user, navigate, loadList]);

  const openCreate = () => {
    setDialogMode('create');
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (t) => {
    setDialogMode('edit');
    setEditing(t);
    setDialogOpen(true);
  };

  const handleDelete = async (t) => {
    if (!isAdmin) return;
    if (!window.confirm(`Delete template “${t.title}”?`)) return;
    try {
      await templateAPI.delete(t.id);
      notify('Template removed', 'success');
      loadList();
    } catch (e) {
      notify(e?.error || 'Delete failed', 'error');
    }
  };

  if (loading || !user) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 8 }} />;

  return (
    <Box>
      <PageHeader
        title="Make.com templates"
        description="Import ready-made blueprints into Make.com. Files are hosted in your Supabase project; only the designated admin wallet can publish or change them."
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            {isAdmin && (
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
                Upload template
              </Button>
            )}
            <Button component={Link} to="/dashboard" variant="outlined">
              Dashboard
            </Button>
          </Stack>
        }
      />

      {loadError && (
        <Box sx={{ mb: 2 }}>
          <ErrorState title="Could not load templates" message={loadError} onRetry={loadList} />
        </Box>
      )}

      {isAdmin && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          Admin mode: you can upload, edit, and delete templates. Other users only see download.
        </Alert>
      )}

      <SectionCard>
        {loadingList ? (
          <Grid container spacing={2.5}>
            {[1, 2, 3].map((k) => (
              <Grid item xs={12} sm={6} md={4} key={k}>
                <Skeleton variant="rounded" height={280} />
              </Grid>
            ))}
          </Grid>
        ) : templates.length === 0 ? (
          <EmptyState
            title="No templates yet"
            description="When an admin publishes Make.com blueprints, they will appear here as cards with one-click download."
            icon={<ViewModuleRoundedIcon fontSize="large" />}
          />
        ) : (
          <Grid container spacing={2.5}>
            {templates.map((t) => (
              <Grid item xs={12} sm={6} md={4} key={t.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                    transition: 'transform 160ms ease, box-shadow 160ms ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 12px 32px rgba(0,0,0,0.35)`,
                    },
                  }}
                >
                  <CardMedia
                    component="img"
                    height="168"
                    image={t.preview_image_url}
                    alt=""
                    sx={{ objectFit: 'cover', bgcolor: alpha(theme.palette.common.black, 0.2) }}
                  />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      {t.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {t.description || '—'}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2, pt: 0, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<DownloadRoundedIcon />}
                      onClick={() => downloadBlueprintFile(t.blueprint_file_url, t.blueprint_filename)}
                    >
                      Download
                    </Button>
                    {isAdmin && (
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Edit">
                          <IconButton size="small" color="primary" onClick={() => openEdit(t)}>
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDelete(t)}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </SectionCard>

      <TemplateFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode={dialogMode}
        template={editing}
        onSaved={loadList}
        notify={notify}
        isAdmin={isAdmin}
      />
    </Box>
  );
}
