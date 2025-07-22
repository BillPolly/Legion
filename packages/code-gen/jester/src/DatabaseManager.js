/**
 * DatabaseManager - Handles all database operations
 * 
 * Manages SQLite database for storing test execution data
 */

import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

class DatabaseManager {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * Initialize database connection and schema
   */
  async initialize() {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, async (err) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          // Enable WAL mode for better concurrency
          await this.run('PRAGMA journal_mode = WAL');
          
          // Create schema
          await this.createSchema();
          
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Create database schema
   */
  async createSchema() {
    const queries = [
      // Schema version
      `CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )`,

      // Runs table
      `CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        completed_at INTEGER,
        options TEXT,
        status TEXT DEFAULT 'pending',
        summary TEXT
      )`,

      // Events table
      `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT,
        type TEXT,
        timestamp INTEGER,
        data TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      )`,

      // Tests table
      `CREATE TABLE IF NOT EXISTS tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT,
        test_path TEXT,
        test_name TEXT,
        suite_name TEXT,
        started_at INTEGER,
        completed_at INTEGER,
        duration INTEGER,
        status TEXT,
        retry_count INTEGER DEFAULT 0,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      )`,

      // Failures table
      `CREATE TABLE IF NOT EXISTS failures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id INTEGER,
        error_message TEXT,
        stack_trace TEXT,
        diff TEXT,
        FOREIGN KEY (test_id) REFERENCES tests(id)
      )`,

      // Console logs table
      `CREATE TABLE IF NOT EXISTS console_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT,
        test_path TEXT,
        test_name TEXT,
        timestamp INTEGER,
        level TEXT,
        message TEXT,
        stack_trace TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      )`,

      // Open handles table
      `CREATE TABLE IF NOT EXISTS open_handles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT,
        test_path TEXT,
        type TEXT,
        stack_trace TEXT,
        details TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      )`,

      // Create indexes
      'CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_events_run_timestamp ON events(run_id, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_tests_run_status ON tests(run_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_console_run_test ON console_logs(run_id, test_path)'
    ];

    for (const query of queries) {
      await this.run(query);
    }

    // Set schema version
    await this.run('INSERT OR IGNORE INTO schema_version (version) VALUES (1)');
  }

  /**
   * Create a new test run
   * 
   * @param {Object} options - Run configuration
   * @returns {Promise<string>} Run ID
   */
  async createRun(options) {
    const runId = uuidv4();
    await this.run(
      `INSERT INTO runs (id, options) VALUES (?, ?)`,
      [runId, JSON.stringify(options)]
    );
    return runId;
  }

  /**
   * Get run by ID
   */
  async getRun(runId) {
    const row = await this.get('SELECT * FROM runs WHERE id = ?', [runId]);
    if (row) {
      row.options = JSON.parse(row.options || '{}');
      row.summary = JSON.parse(row.summary || '{}');
    }
    return row;
  }

  /**
   * Update run status
   */
  async updateRunStatus(runId, status) {
    await this.run('UPDATE runs SET status = ? WHERE id = ?', [status, runId]);
  }

  /**
   * Complete a run with summary
   */
  async completeRun(runId, summary) {
    await this.run(
      `UPDATE runs SET 
        status = 'completed',
        completed_at = ?,
        summary = ?
      WHERE id = ?`,
      [Date.now(), JSON.stringify(summary), runId]
    );
  }

  /**
   * Record a test event
   * 
   * @param {Object} event - Event data
   */
  async recordEvent(event) {
    await this.run(
      `INSERT INTO events (run_id, type, timestamp, data) VALUES (?, ?, ?, ?)`,
      [event.runId, event.type, event.timestamp, JSON.stringify(event.data || {})]
    );
  }

  /**
   * Get events for a run
   */
  async getEvents(runId) {
    const rows = await this.all(
      'SELECT * FROM events WHERE run_id = ? ORDER BY timestamp',
      [runId]
    );
    return rows.map(row => ({
      ...row,
      data: JSON.parse(row.data || '{}')
    }));
  }

  /**
   * Record console output
   * 
   * @param {Object} logData - Console log data
   */
  async recordConsole(logData) {
    await this.run(
      `INSERT INTO console_logs 
        (run_id, test_path, test_name, timestamp, level, message, stack_trace)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        logData.runId,
        logData.testPath,
        logData.testName,
        logData.timestamp,
        logData.level,
        logData.message,
        logData.stackTrace
      ]
    );
  }

  /**
   * Get all tables
   */
  async getTables() {
    const rows = await this.all(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
    );
    return rows.map(row => row.name);
  }

  /**
   * Get all indexes
   */
  async getIndexes() {
    const rows = await this.all(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'`
    );
    return rows.map(row => row.name);
  }

  /**
   * Get schema version
   */
  async getSchemaVersion() {
    const row = await this.get('SELECT version FROM schema_version LIMIT 1');
    return row ? row.version : 0;
  }

  /**
   * Close database connection
   */
  async close() {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // Helper methods for promisified database operations
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
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

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

export { DatabaseManager };