const MAX_LEN = 500;

/**
 * @param {string} raw - user input; empty after trim stores null in DB
 * @returns {{ value: string | null } | { error: string }}
 */
function normalizeYoutubeUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s) {
    return { value: null };
  }
  if (s.length > MAX_LEN) {
    return { error: `Video URL must be at most ${MAX_LEN} characters` };
  }

  let url;
  try {
    url = new URL(s.includes('://') ? s : `https://${s}`);
  } catch {
    return { error: 'Invalid video URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { error: 'Video URL must use http or https' };
  }

  const host = url.hostname.toLowerCase();
  const isYoutube =
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtu.be' ||
    host === 'www.youtu.be';

  if (!isYoutube) {
    return { error: 'URL must be a YouTube link (youtube.com or youtu.be)' };
  }

  return { value: url.toString() };
}

module.exports = { normalizeYoutubeUrl, MAX_LEN };
