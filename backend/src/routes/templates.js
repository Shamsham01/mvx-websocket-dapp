const express = require('express');
const multer = require('multer');
const { randomUUID } = require('crypto');
const { authenticate } = require('../middleware/authenticate');
const logger = require('../utils/logger');
const {
  getConfig,
  publicObjectUrl,
  uploadObject,
  removeObjects,
  insertRow,
  updateRow,
  deleteRow,
  getRowById,
  getAdminWallet,
} = require('../services/supabaseTemplates');
const { parseTemplateLabel } = require('../constants/templateLabels');
const { normalizeYoutubeUrl } = require('../utils/youtubeUrl');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const twoFiles = upload.fields([
  { name: 'preview', maxCount: 1 },
  { name: 'blueprint', maxCount: 1 },
]);

const optionalFiles = upload.fields([
  { name: 'preview', maxCount: 1 },
  { name: 'blueprint', maxCount: 1 },
]);

function requireAdmin(req, res, next) {
  if (req.user.address !== getAdminWallet()) {
    return res.status(403).json({ error: 'Templates admin only' });
  }
  next();
}

function requireSupabase(res) {
  if (!getConfig()) {
    res.status(503).json({ error: 'Template storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' });
    return false;
  }
  return true;
}

function previewExt(mimetype) {
  if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') return '.jpg';
  if (mimetype === 'image/png') return '.png';
  if (mimetype === 'image/webp') return '.webp';
  if (mimetype === 'image/gif') return '.gif';
  return '.img';
}

function validateImage(mimetype) {
  return Boolean(mimetype && mimetype.startsWith('image/'));
}

function validateBlueprint(file) {
  if (!file) return false;
  const name = (file.originalname || '').toLowerCase();
  const okName = name.endsWith('.json');
  const okMime =
    file.mimetype === 'application/json' ||
    file.mimetype === 'text/json' ||
    file.mimetype === 'text/plain';
  return okName || okMime;
}

router.post('/', authenticate, requireAdmin, twoFiles, async (req, res) => {
  try {
    if (!requireSupabase(res)) return;

    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const labelParsed = parseTemplateLabel(req.body);
    if (labelParsed.error) {
      return res.status(400).json({ error: labelParsed.error });
    }

    let youtubeUrl = null;
    if (req.body.youtube_url !== undefined && req.body.youtube_url !== null) {
      const yt = normalizeYoutubeUrl(req.body.youtube_url);
      if (yt.error) {
        return res.status(400).json({ error: yt.error });
      }
      youtubeUrl = yt.value;
    }

    const previewFile = req.files?.preview?.[0];
    const blueprintFile = req.files?.blueprint?.[0];
    if (!previewFile || !validateImage(previewFile.mimetype)) {
      return res.status(400).json({ error: 'A preview image is required' });
    }
    if (!validateBlueprint(blueprintFile)) {
      return res.status(400).json({ error: 'A blueprint.json file is required' });
    }

    const id = randomUUID();
    const baseUrl = getConfig().url;
    const ext = previewExt(previewFile.mimetype);
    const previewPath = `${id}/preview${ext}`;
    const blueprintFilename =
      blueprintFile.originalname && blueprintFile.originalname.endsWith('.json')
        ? blueprintFile.originalname
        : 'blueprint.json';
    const blueprintPath = `${id}/blueprint.json`;

    await uploadObject(previewPath, previewFile.buffer, previewFile.mimetype);
    await uploadObject(blueprintPath, blueprintFile.buffer, blueprintFile.mimetype || 'application/json');

    const row = {
      id,
      title,
      description,
      label: labelParsed.label,
      youtube_url: youtubeUrl,
      preview_image_url: publicObjectUrl(baseUrl, previewPath),
      blueprint_file_url: publicObjectUrl(baseUrl, blueprintPath),
      blueprint_filename: blueprintFilename,
      storage_preview_path: previewPath,
      storage_blueprint_path: blueprintPath,
    };

    const created = await insertRow(row);
    res.status(201).json({ template: created });
  } catch (e) {
    logger.error('Template create error', e);
    res.status(500).json({ error: e.message || 'Failed to create template' });
  }
});

router.put('/:id', authenticate, requireAdmin, optionalFiles, async (req, res) => {
  try {
    if (!requireSupabase(res)) return;

    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    const title = req.body.title != null ? String(req.body.title).trim() : undefined;
    const description = req.body.description != null ? String(req.body.description).trim() : undefined;
    if (title !== undefined && !title) {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }

    let labelUpdate;
    if (req.body.label !== undefined && req.body.label !== null && String(req.body.label).trim() !== '') {
      const labelParsed = parseTemplateLabel(req.body);
      if (labelParsed.error) {
        return res.status(400).json({ error: labelParsed.error });
      }
      labelUpdate = labelParsed.label;
    }

    let youtubeUpdate;
    if (req.body.youtube_url !== undefined && req.body.youtube_url !== null) {
      const yt = normalizeYoutubeUrl(req.body.youtube_url);
      if (yt.error) {
        return res.status(400).json({ error: yt.error });
      }
      youtubeUpdate = yt.value;
    }

    const previewFile = req.files?.preview?.[0];
    const blueprintFile = req.files?.blueprint?.[0];

    const baseUrl = getConfig().url;

    const existing = await getRowById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    let previewPath = existing.storage_preview_path;
    let blueprintPath = existing.storage_blueprint_path;
    let previewUrl = existing.preview_image_url;
    let blueprintUrl = existing.blueprint_file_url;
    let blueprintFilename = existing.blueprint_filename;

    if (previewFile) {
      if (!validateImage(previewFile.mimetype)) {
        return res.status(400).json({ error: 'Preview must be an image' });
      }
      await removeObjects([previewPath]);
      const ext = previewExt(previewFile.mimetype);
      previewPath = `${id}/preview${ext}`;
      await uploadObject(previewPath, previewFile.buffer, previewFile.mimetype);
      previewUrl = publicObjectUrl(baseUrl, previewPath);
    }

    if (blueprintFile) {
      if (!validateBlueprint(blueprintFile)) {
        return res.status(400).json({ error: 'Blueprint must be a JSON file' });
      }
      await removeObjects([blueprintPath]);
      blueprintPath = `${id}/blueprint.json`;
      await uploadObject(blueprintPath, blueprintFile.buffer, blueprintFile.mimetype || 'application/json');
      blueprintUrl = publicObjectUrl(baseUrl, blueprintPath);
      blueprintFilename =
        blueprintFile.originalname && blueprintFile.originalname.endsWith('.json')
          ? blueprintFile.originalname
          : 'blueprint.json';
    }

    const patch = {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(labelUpdate !== undefined ? { label: labelUpdate } : {}),
      ...(youtubeUpdate !== undefined ? { youtube_url: youtubeUpdate } : {}),
      preview_image_url: previewUrl,
      blueprint_file_url: blueprintUrl,
      blueprint_filename: blueprintFilename,
      storage_preview_path: previewPath,
      storage_blueprint_path: blueprintPath,
    };

    const updated = await updateRow(id, patch);
    res.json({ template: updated });
  } catch (e) {
    logger.error('Template update error', e);
    res.status(500).json({ error: e.message || 'Failed to update template' });
  }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    if (!requireSupabase(res)) return;

    const id = String(req.params.id || '').trim();
    const existing = await getRowById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await removeObjects([existing.storage_preview_path, existing.storage_blueprint_path]);
    await deleteRow(id);
    res.json({ success: true });
  } catch (e) {
    logger.error('Template delete error', e);
    res.status(500).json({ error: e.message || 'Failed to delete template' });
  }
});

module.exports = router;
