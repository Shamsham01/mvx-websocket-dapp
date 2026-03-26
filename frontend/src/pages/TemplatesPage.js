import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
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
import {
  TEMPLATE_CUSTOM_LABEL_VALUE,
  TEMPLATE_FILTER_ALL,
  TEMPLATE_FILTER_OTHER,
  TEMPLATE_LABEL_PRESETS,
  isPresetLabel,
} from '../constants/templateLabels';

/** Show “read full” when description is likely clamped (keeps card layout even). */
function descriptionNeedsExpand(text) {
  return (text || '').trim().length > 140;
}

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
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [labelChoice, setLabelChoice] = useState(TEMPLATE_LABEL_PRESETS[0]);
  const [customLabel, setCustomLabel] = useState('');
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
      setYoutubeUrl(template.youtube_url || '');
      const lbl = template.label || TEMPLATE_LABEL_PRESETS[0];
      if (isPresetLabel(lbl)) {
        setLabelChoice(lbl);
        setCustomLabel('');
      } else {
        setLabelChoice(TEMPLATE_CUSTOM_LABEL_VALUE);
        setCustomLabel(lbl);
      }
    } else {
      setTitle('');
      setDescription('');
      setYoutubeUrl('');
      setLabelChoice(TEMPLATE_LABEL_PRESETS[0]);
      setCustomLabel('');
    }
  }, [open, mode, template]);

  const handleSubmit = async () => {
    if (!isAdmin) return;
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (labelChoice === TEMPLATE_CUSTOM_LABEL_VALUE && !customLabel.trim()) {
      setError('Enter a custom label.');
      return;
    }
    if (mode === 'create' && (!previewFile || !blueprintFile)) {
      setError('Preview image and blueprint JSON are required.');
      return;
    }

    const resolvedLabel =
      labelChoice === TEMPLATE_CUSTOM_LABEL_VALUE ? customLabel.trim() : labelChoice;

    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('label', resolvedLabel);
      fd.append('youtube_url', youtubeUrl.trim());
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
          <FormControl fullWidth>
            <InputLabel id="template-label-select">Label</InputLabel>
            <Select
              labelId="template-label-select"
              label="Label"
              value={labelChoice}
              onChange={(e) => setLabelChoice(e.target.value)}
            >
              {TEMPLATE_LABEL_PRESETS.map((preset) => (
                <MenuItem key={preset} value={preset}>
                  {preset}
                </MenuItem>
              ))}
              <MenuItem value={TEMPLATE_CUSTOM_LABEL_VALUE}>Custom…</MenuItem>
            </Select>
          </FormControl>
          {labelChoice === TEMPLATE_CUSTOM_LABEL_VALUE && (
            <TextField
              label="Custom label"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="e.g. NFT Alerts, Treasury Bot"
              helperText="Shown on the card and used for marketplace browse under Custom filter."
              required
            />
          )}
          <TextField
            label="YouTube video (optional)"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
            helperText="Walkthrough or demo. Leave blank if not ready — you can add it when editing the template later. Clear the field to remove the button from the card."
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
  const [labelFilter, setLabelFilter] = useState(TEMPLATE_FILTER_ALL);
  const [descriptionDetail, setDescriptionDetail] = useState(null);

  const isAdmin = isTemplatesAdmin(user?.address);

  const filteredTemplates = useMemo(() => {
    if (labelFilter === TEMPLATE_FILTER_ALL) return templates;
    if (labelFilter === TEMPLATE_FILTER_OTHER) {
      return templates.filter((t) => !isPresetLabel(t.label));
    }
    return templates.filter((t) => t.label === labelFilter);
  }, [templates, labelFilter]);

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

      <SectionCard
        title="Browse"
        description="Filter by label to narrow the marketplace."
        action={
          <ToggleButtonGroup
            exclusive
            size="small"
            value={labelFilter}
            onChange={(_, v) => v != null && setLabelFilter(v)}
            sx={{
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              '& .MuiToggleButton-root': { px: 1.1, py: 0.5, textTransform: 'none' },
            }}
          >
            <ToggleButton value={TEMPLATE_FILTER_ALL}>All</ToggleButton>
            {TEMPLATE_LABEL_PRESETS.map((preset) => (
              <ToggleButton key={preset} value={preset}>
                {preset}
              </ToggleButton>
            ))}
            <ToggleButton value={TEMPLATE_FILTER_OTHER}>Custom</ToggleButton>
          </ToggleButtonGroup>
        }
      >
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
        ) : filteredTemplates.length === 0 ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 6 }}>
            <Typography variant="body1" color="text.secondary">
              No templates match this label. Try another filter or show all.
            </Typography>
            <Button variant="outlined" onClick={() => setLabelFilter(TEMPLATE_FILTER_ALL)}>
              Show all
            </Button>
          </Stack>
        ) : (
          <Grid container spacing={2.5}>
            {filteredTemplates.map((t) => (
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
                    <Chip
                      label={t.label || '—'}
                      size="small"
                      sx={{
                        mb: 1.25,
                        fontWeight: 600,
                        borderColor: alpha(theme.palette.secondary.main, 0.45),
                      }}
                      variant="outlined"
                      color="secondary"
                    />
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
                    {descriptionNeedsExpand(t.description) && (
                      <Button
                        size="small"
                        startIcon={<UnfoldMoreRoundedIcon />}
                        onClick={() =>
                          setDescriptionDetail({ title: t.title, body: t.description || '' })
                        }
                        sx={{ mt: 1, px: 0, alignSelf: 'flex-start', textTransform: 'none' }}
                      >
                        Full description
                      </Button>
                    )}
                  </CardContent>
                  <CardActions
                    sx={{
                      px: 2,
                      pb: 2,
                      pt: 0,
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: 1.25,
                    }}
                  >
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ width: '100%' }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<DownloadRoundedIcon />}
                        onClick={() => downloadBlueprintFile(t.blueprint_file_url, t.blueprint_filename)}
                      >
                        Download
                      </Button>
                      {t.youtube_url && (
                        <Button
                          variant="outlined"
                          size="small"
                          color="secondary"
                          startIcon={<VideoLibraryRoundedIcon />}
                          endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />}
                          href={t.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          component="a"
                        >
                          Video
                        </Button>
                      )}
                    </Stack>
                    {isAdmin && (
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
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

      <Dialog
        open={Boolean(descriptionDetail)}
        onClose={() => setDescriptionDetail(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { backgroundImage: 'none' } }}
      >
        <DialogTitle>{descriptionDetail?.title || 'Description'}</DialogTitle>
        <DialogContent>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', pt: 0.5 }}
          >
            {descriptionDetail?.body?.trim() ? descriptionDetail.body : '—'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDescriptionDetail(null)}>Close</Button>
        </DialogActions>
      </Dialog>

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
