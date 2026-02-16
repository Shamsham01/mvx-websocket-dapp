/**
 * Safely parse JSON - handles both SQLite (returns string) and PostgreSQL (returns object)
 */
function parseJson(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object') return val; // Already parsed (PostgreSQL JSONB)
  if (typeof val === 'string') return JSON.parse(val); // SQLite stores as text
  return val;
}

module.exports = { parseJson };
