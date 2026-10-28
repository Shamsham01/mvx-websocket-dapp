/**
 * In-process cache for NativeAuthServer block timestamps.
 * Block hashes are immutable. The latest block entry uses the short TTL
 * supplied by the SDK (about 6 seconds).
 */
class MemoryNativeAuthCache {
  constructor(maxEntries = 2000) {
    this.maxEntries = maxEntries;
    this.store = new Map();
  }

  async getValue(key) {
    const row = this.store.get(key);
    if (!row) return undefined;
    if (row.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, row);
    return row.value;
  }

  async setValue(key, value, ttlSeconds) {
    const ttl = Number(ttlSeconds);
    if (!Number.isFinite(ttl) || ttl <= 0) return;
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, {
      value: Number(value),
      expiresAt: Date.now() + ttl * 1000,
    });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
    }
  }

  clear() {
    this.store.clear();
  }
}

module.exports = { MemoryNativeAuthCache };
