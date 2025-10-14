/**
 * Database connection and setup
 * Uses better-sqlite3 for synchronous SQLite operations
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

/**
 * Get or create database connection
 */
export function getDatabase(dbPath = process.env.DB_PATH || './data/todos.db') {
  if (db) return db;

  // Create data directory if it doesn't exist
  const dataDir = join(dirname(dbPath));
  try {
    mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  return db;
}

/**
 * Initialize database schema
 */
export function initializeSchema() {
  const db = getDatabase();

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Todos table
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

  console.log('Database schema initialized');
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Reset database connection (for testing)
 */
export function resetDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Clear all data (for testing)
 */
export function clearDatabase() {
  const db = getDatabase();
  db.exec('DELETE FROM todos');
  db.exec('DELETE FROM users');
}

export default { getDatabase, initializeSchema, closeDatabase, resetDatabase, clearDatabase };
