/**
 * SQLite-based storage engine for test data
 */

import Database from 'better-sqlite3';
import { generateId } from '../utils/index.js';
import fs from 'fs';
import path from 'path';

export class StorageEngine {
  constructor(dbPath = './tmp/dbs/test-results.db') {
    this.dbPath = dbPath;
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize the database and create tables
   */
  async initialize() {
    if (this.initialized) return;

    // Create directory if it doesn't exist
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    
    // Enable foreign keys and WAL mode for better performance
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');

    // Create tables
    this.createTables();
    this.initialized = true;
  }

  /**
   * Create database tables
   */
  createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        start_time DATETIME,
        end_time DATETIME,
        status TEXT,
        config TEXT,
        environment TEXT,
        summary TEXT,
        metadata TEXT
      )`,
      
      `CREATE TABLE IF NOT EXISTS test_suites (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        path TEXT,
        name TEXT,
        start_time DATETIME,
        end_time DATETIME,
        status TEXT,
        setup_duration INTEGER,
        teardown_duration INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS test_cases (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        suite_id TEXT,
        name TEXT,
        full_name TEXT,
        start_time DATETIME,
        end_time DATETIME,
        status TEXT,
        duration INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions(id),
        FOREIGN KEY (suite_id) REFERENCES test_suites(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS assertions (
        id TEXT PRIMARY KEY,
        test_id TEXT,
        timestamp DATETIME,
        type TEXT,
        matcher TEXT,
        passed BOOLEAN,
        actual TEXT,
        expected TEXT,
        message TEXT,
        stack_trace TEXT,
        FOREIGN KEY (test_id) REFERENCES test_cases(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        test_id TEXT,
        timestamp DATETIME,
        level TEXT,
        message TEXT,
        source TEXT,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id),
        FOREIGN KEY (test_id) REFERENCES test_cases(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS errors (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        test_id TEXT,
        timestamp DATETIME,
        type TEXT,
        message TEXT,
        stack_trace TEXT,
        location TEXT,
        suggestion TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id),
        FOREIGN KEY (test_id) REFERENCES test_cases(id)
      )`
    ];

    tables.forEach(sql => this.db.exec(sql));

    // Create indexes for better query performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time)',
      'CREATE INDEX IF NOT EXISTS idx_test_cases_status ON test_cases(status)',
      'CREATE INDEX IF NOT EXISTS idx_test_cases_session ON test_cases(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)',
      'CREATE INDEX IF NOT EXISTS idx_errors_type ON errors(type)'
    ];

    indexes.forEach(sql => this.db.exec(sql));
  }

  /**
   * Store a test session
   */
  async storeSession(session) {
    await this.initialize();
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions 
      (id, start_time, end_time, status, config, environment, summary, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      session.id,
      session.startTime.toISOString(),
      session.endTime?.toISOString(),
      session.status,
      JSON.stringify(session.jestConfig),
      JSON.stringify(session.environment),
      JSON.stringify(session.summary),
      JSON.stringify(session.metadata || {})
    );
  }

  /**
   * Store a test suite
   */
  async storeSuite(suite) {
    await this.initialize();
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO test_suites 
      (id, session_id, path, name, start_time, end_time, status, setup_duration, teardown_duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      suite.id,
      suite.sessionId,
      suite.path,
      suite.name,
      suite.startTime.toISOString(),
      suite.endTime?.toISOString(),
      suite.status,
      suite.setupDuration,
      suite.teardownDuration
    );
  }

  /**
   * Store a test case
   */
  async storeTestCase(testCase) {
    await this.initialize();
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO test_cases 
      (id, session_id, suite_id, name, full_name, start_time, end_time, status, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      testCase.id,
      testCase.sessionId,
      testCase.suiteId,
      testCase.name,
      testCase.fullName,
      testCase.startTime.toISOString(),
      testCase.endTime?.toISOString(),
      testCase.status,
      testCase.duration
    );

    // Store assertions
    for (const assertion of testCase.assertions || []) {
      await this.storeAssertion(assertion);
    }

    // Store errors
    for (const error of testCase.errors || []) {
      await this.storeError(error);
    }

    // Store logs
    for (const log of testCase.logs || []) {
      await this.storeLog(log);
    }
  }

  /**
   * Store an assertion
   */
  async storeAssertion(assertion) {
    if (!assertion.testId || !assertion.timestamp) {
      console.warn('Invalid assertion data provided to storeAssertion:', assertion);
      return;
    }

    // Check if the test exists before inserting assertion
    const testExists = this.db.prepare('SELECT id FROM test_cases WHERE id = ?').get(assertion.testId);
    if (!testExists) {
      console.warn(`Cannot store assertion for non-existent test: ${assertion.testId}`);
      return;
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO assertions 
      (id, test_id, timestamp, type, matcher, passed, actual, expected, message, stack_trace)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const id = generateId(`${assertion.testId}-${assertion.timestamp}-${assertion.matcher || 'unknown'}`);
    
    try {
      stmt.run(
        id,
        assertion.testId,
        assertion.timestamp.toISOString(),
        assertion.type || null,
        assertion.matcher || null,
        assertion.passed ? 1 : 0, // Convert boolean to integer
        JSON.stringify(assertion.actual || null),
        JSON.stringify(assertion.expected || null),
        assertion.message || null,
        JSON.stringify(assertion.stackTrace || null)
      );
    } catch (dbError) {
      console.warn('Failed to store assertion:', dbError.message);
    }
  }

  /**
   * Store a log entry
   */
  async storeLog(log) {
    if (!log.sessionId || !log.timestamp || !log.message) {
      console.warn('Invalid log data provided to storeLog:', log);
      return;
    }

    // Check if session exists
    const sessionExists = this.db.prepare('SELECT id FROM sessions WHERE id = ?').get(log.sessionId);
    if (!sessionExists) {
      console.warn(`Cannot store log for non-existent session: ${log.sessionId}`);
      return;
    }

    // If testId is provided, check if test exists
    if (log.testId) {
      const testExists = this.db.prepare('SELECT id FROM test_cases WHERE id = ?').get(log.testId);
      if (!testExists) {
        console.warn(`Cannot store log for non-existent test: ${log.testId}`);
        return;
      }
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO logs 
      (id, session_id, test_id, timestamp, level, message, source, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const id = generateId(`${log.sessionId}-${log.timestamp}-${log.message}`);
    
    try {
      stmt.run(
        id,
        log.sessionId,
        log.testId || null,
        log.timestamp.toISOString(),
        log.level || 'info',
        log.message,
        log.source || null,
        JSON.stringify(log.metadata || {})
      );
    } catch (dbError) {
      console.warn('Failed to store log:', dbError.message);
    }
  }

  /**
   * Store an error
   */
  async storeError(error) {
    if (!error.testId || !error.timestamp || !error.type) {
      console.warn('Invalid error data provided to storeError:', error);
      return;
    }

    // Check if the test exists before inserting error
    const testExists = this.db.prepare('SELECT id FROM test_cases WHERE id = ?').get(error.testId);
    if (!testExists) {
      console.warn(`Cannot store error for non-existent test: ${error.testId}`);
      return;
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO errors 
      (id, test_id, timestamp, type, message, stack_trace, location, suggestion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const id = generateId(`${error.testId}-${error.timestamp}-${error.type}`);
    
    try {
      stmt.run(
        id,
        error.testId,
        error.timestamp.toISOString(),
        error.type,
        error.message,
        JSON.stringify(error.stackTrace || null),
        JSON.stringify(error.location || null),
        error.suggestion || null
      );
    } catch (dbError) {
      console.warn('Failed to store error:', dbError.message);
    }
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId) {
    await this.initialize();
    
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(sessionId);
    
    if (!row) return null;
    
    return {
      id: row.id,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : null,
      status: row.status,
      jestConfig: JSON.parse(row.config || '{}'),
      environment: JSON.parse(row.environment || '{}'),
      summary: JSON.parse(row.summary || '{}'),
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  /**
   * Get all sessions
   */
  async getAllSessions() {
    await this.initialize();
    
    const stmt = this.db.prepare('SELECT * FROM sessions ORDER BY start_time DESC');
    const rows = stmt.all();
    
    return rows.map(row => ({
      id: row.id,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : null,
      status: row.status,
      jestConfig: JSON.parse(row.config || '{}'),
      environment: JSON.parse(row.environment || '{}'),
      summary: JSON.parse(row.summary || '{}'),
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  /**
   * Clear a specific session and all its related data
   */
  async clearSession(sessionId) {
    await this.initialize();
    
    // Use transaction to ensure atomicity
    const deleteSession = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    const deleteSuites = this.db.prepare('DELETE FROM test_suites WHERE session_id = ?');
    const deleteTests = this.db.prepare('DELETE FROM test_cases WHERE session_id = ?');
    const deleteLogs = this.db.prepare('DELETE FROM logs WHERE session_id = ?');
    // Delete errors based on test_id from test_cases in this session
    const deleteErrors = this.db.prepare(`
      DELETE FROM errors WHERE test_id IN (
        SELECT id FROM test_cases WHERE session_id = ?
      )
    `);
    
    const transaction = this.db.transaction((id) => {
      // Delete in order of dependencies
      deleteLogs.run(id);
      deleteErrors.run(id);
      deleteTests.run(id);
      deleteSuites.run(id);
      deleteSession.run(id);
    });
    
    transaction(sessionId);
    
    console.log(`🗑️ Cleared session: ${sessionId}`);
    return true;
  }

  /**
   * Clear all sessions from the database
   */
  async clearAllSessions() {
    await this.initialize();
    
    // Delete all data from all tables
    this.db.exec('DELETE FROM logs');
    this.db.exec('DELETE FROM assertions');
    this.db.exec('DELETE FROM errors');
    this.db.exec('DELETE FROM test_cases');
    this.db.exec('DELETE FROM test_suites');
    this.db.exec('DELETE FROM sessions');
    
    console.log('🗑️ Cleared all sessions from database');
    return true;
  }

  /**
   * Close the database connection
   */
  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}
