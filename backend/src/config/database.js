const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
  constructor() {
    this.dbPath = process.env.DB_PATH || './data/subscriptions.db';
    this.ensureDataDirectory();
    this.db = new sqlite3.Database(this.dbPath);
    this._initPromise = this.initializeDatabase();
  }

  ensureDataDirectory() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async ensureInitialized() {
    return this._initPromise;
  }

  initializeDatabase() {
    return new Promise((resolve, reject) => {
      const run = (sql) => new Promise((res, rej) => {
        this.db.run(sql, (err) => err ? rej(err) : res());
      });

      (async () => {
        try {
          // Create users table
          await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

          // Create subscriptions table
          await run(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        webhook_url TEXT NOT NULL,
        filters JSON NOT NULL,
        network TEXT DEFAULT 'mainnet',
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

          // Create webhook_logs table for tracking deliveries
          await run(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscription_id INTEGER NOT NULL,
        transfer_data JSON NOT NULL,
        status_code INTEGER,
        response_text TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE
      )
    `);

          // Create indexes
          await run('CREATE INDEX IF NOT EXISTS idx_users_address ON users(address)');
          await run('CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)');
          await run('CREATE INDEX IF NOT EXISTS idx_subscriptions_is_active ON subscriptions(is_active)');
          await run('CREATE INDEX IF NOT EXISTS idx_webhook_logs_subscription_id ON webhook_logs(subscription_id)');
          resolve();
        } catch (err) {
          reject(err);
        }
      })();
    });
  }

  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = new Database();