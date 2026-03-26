const TABLE = 'makex_make_templates';

/**
 * Public read via Supabase anon key (same pattern as free-trial whitelist).
 * @returns {Promise<Array>}
 */
export async function fetchMakeTemplates() {
  const url = process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Configure REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY to load templates.');
  }

  const res = await fetch(
    `${url.replace(/\/$/, '')}/rest/v1/${TABLE}?select=id,title,description,label,preview_image_url,blueprint_file_url,blueprint_filename,created_at&order=created_at.desc`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    }
  );

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `Templates request failed (${res.status})`);
  }

  return res.json();
}
