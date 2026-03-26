const logger = require('../utils/logger');

const TABLE = 'makex_make_templates';
const BUCKET = 'make-blueprints';

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  return { url: url.replace(/\/$/, ''), key };
}

function publicObjectUrl(baseUrl, path) {
  const root = baseUrl.replace(/\/$/, '');
  const enc = path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `${root}/storage/v1/object/public/${BUCKET}/${enc}`;
}

/**
 * @param {string} path - path inside bucket (no leading slash)
 * @param {Buffer} buffer
 * @param {string} contentType
 */
function encodeStoragePath(path) {
  return path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

async function uploadObject(path, buffer, contentType) {
  const cfg = getConfig();
  if (!cfg) throw new Error('Supabase is not configured on the server');

  const endpoint = `${cfg.url}/storage/v1/object/${BUCKET}/${encodeStoragePath(path)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error('Supabase upload failed', { status: res.status, text });
    throw new Error(`Upload failed: ${res.status}`);
  }
}

async function removeObjects(paths) {
  const cfg = getConfig();
  if (!cfg || paths.length === 0) return;

  for (const p of paths) {
    const res = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${encodeStoragePath(p)}`, {
      method: 'DELETE',
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn('Supabase storage delete', { path: p, status: res.status, text });
    }
  }
}

async function insertRow(row) {
  const cfg = getConfig();
  if (!cfg) throw new Error('Supabase is not configured on the server');

  const res = await fetch(`${cfg.url}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Insert failed: ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function updateRow(id, patch) {
  const cfg = getConfig();
  if (!cfg) throw new Error('Supabase is not configured on the server');

  const res = await fetch(`${cfg.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Update failed: ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function deleteRow(id) {
  const cfg = getConfig();
  if (!cfg) throw new Error('Supabase is not configured on the server');

  const res = await fetch(`${cfg.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Delete failed: ${res.status}`);
  }
}

async function getRowById(id) {
  const cfg = getConfig();
  if (!cfg) throw new Error('Supabase is not configured on the server');

  const res = await fetch(
    `${cfg.url}/rest/v1/${TABLE}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
    {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Lookup failed: ${res.status}`);
  }
  const rows = await res.json();
  return rows[0] || null;
}

function getAdminWallet() {
  return (
    process.env.MAKEX_TEMPLATES_ADMIN_WALLET
    || 'erd1h9hm0gnkgn888ly9zgnswsjajprk2fkszndwhm28xkcay66xnnesdyzcs6'
  );
}

module.exports = {
  TABLE,
  BUCKET,
  getConfig,
  publicObjectUrl,
  uploadObject,
  removeObjects,
  insertRow,
  updateRow,
  deleteRow,
  getRowById,
  getAdminWallet,
};
