const { Pool } = require('pg');

/**
 * Converts SQLite-style ? placeholders to PostgreSQL $1, $2, $3...
 */
function convertPlaceholders(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

class Database {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
    }

    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    this._initPromise = this.initializeDatabase();
  }

  async ensureInitialized() {
    return this._initPromise;
  }

  async initializeDatabase() {
    const client = await this.pool.connect();
    try {
      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          address TEXT UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create subscriptions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          webhook_url TEXT NOT NULL,
          filters JSONB NOT NULL,
          network TEXT DEFAULT 'mainnet',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create webhook_logs table for tracking deliveries
      await client.query(`
        CREATE TABLE IF NOT EXISTS webhook_logs (
          id SERIAL PRIMARY KEY,
          subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
          transfer_data JSONB NOT NULL,
          status_code INTEGER,
          response_text TEXT,
          error_message TEXT,
          retry_count INTEGER DEFAULT 0,
          delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_users_address ON users(address)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_is_active ON subscriptions(is_active)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_webhook_logs_subscription_id ON webhook_logs(subscription_id)');
    } finally {
      client.release();
    }
  }

  async query(sql, params = []) {
    const pgSql = convertPlaceholders(sql);
    const result = await this.pool.query(pgSql, params);
    return result.rows;
  }

  async run(sql, params = []) {
    const pgSql = convertPlaceholders(sql);

    // For INSERT, append RETURNING id to get the new row's id
    const isInsert = /^\s*INSERT\s+/i.test(sql.trim());
    const hasReturning = /RETURNING\s+\w+/i.test(sql);
    const finalSql = isInsert && !hasReturning ? `${pgSql.trimEnd().replace(/;\s*$/, '')} RETURNING id` : pgSql;

    const result = await this.pool.query(finalSql, params);

    return {
      id: result.rows[0]?.id,
      changes: result.rowCount ?? 0
    };
  }

  async get(sql, params = []) {
    const pgSql = convertPlaceholders(sql);
    const result = await this.pool.query(pgSql, params);
    return result.rows[0] || null;
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = new Database();
