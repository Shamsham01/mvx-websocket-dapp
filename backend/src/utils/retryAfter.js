function parseRetryAfterSeconds(value, now = Date.now()) {
  if (value == null || value === '') return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  const when = Date.parse(String(raw));
  if (Number.isFinite(when)) return Math.max(0, (when - now) / 1000);
  return null;
}

module.exports = { parseRetryAfterSeconds };
