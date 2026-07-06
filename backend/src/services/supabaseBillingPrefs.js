const logger = require('../utils/logger');

const TABLE = 'makex_wallet_billing_prefs';

const TOKEN_MAP = {
  USDC: 'USDC-c76f1f',
  REWARD: 'REWARD-cf6eac',
};

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  return { url: url.replace(/\/$/, ''), key };
}

async function getBillingPrefs(walletAddress) {
  const cfg = getConfig();
  if (!cfg) {
    throw new Error('Supabase is not configured on the server');
  }

  const res = await fetch(
    `${cfg.url}/rest/v1/${TABLE}?wallet_address=eq.${encodeURIComponent(walletAddress)}&select=fee_token,fee_token_identifier,updated_at`,
    {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Lookup failed: ${res.status}`);
  }

  const rows = await res.json();
  if (!rows.length) {
    return {
      wallet_address: walletAddress,
      fee_token: 'USDC',
      fee_token_identifier: TOKEN_MAP.USDC,
      updated_at: null,
    };
  }

  return rows[0];
}

async function upsertBillingPrefs(walletAddress, feeToken) {
  const cfg = getConfig();
  if (!cfg) {
    throw new Error('Supabase is not configured on the server');
  }

  const normalized = feeToken === 'REWARD' ? 'REWARD' : 'USDC';
  const row = {
    wallet_address: walletAddress,
    fee_token: normalized,
    fee_token_identifier: TOKEN_MAP[normalized],
    updated_at: new Date().toISOString(),
  };

  const res = await fetch(`${cfg.url}/rest/v1/${TABLE}?on_conflict=wallet_address`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error('Billing prefs upsert failed', { status: res.status, text });
    throw new Error(text || `Upsert failed: ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

module.exports = {
  TABLE,
  TOKEN_MAP,
  getConfig,
  getBillingPrefs,
  upsertBillingPrefs,
};
