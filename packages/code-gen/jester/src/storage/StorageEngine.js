/**
 * SQLite-based storage engine for test data
 */

import Database from 'better-sqlite3';
import { generateId } from '../utils/index.js';

export class StorageEngine {
  constructor(dbPath = './test-results.db') {
    this.dbPath = dbPath;
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize the database and create tables
   */
  async initialize() {
    if (this.initialized) return;

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
        summary TEXT
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
        test_id TEXT,
        timestamp DATETIME,
        type TEXT,
        message TEXT,
        stack_trace TEXT,
        location TEXT,
        suggestion TEXT,
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
      (id, start_time, end_time, status, config, environment, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      session.id,
      session.startTime.toISOString(),
      session.endTime?.toISOString(),
      session.status,
      JSON.stringify(session.jestConfig),
      JSON.stringify(session.environment),
      JSON.stringify(session.summary)
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
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO assertions 
      (id, test_id, timestamp, type, matcher, passed, actual, expected, message, stack_trace)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const id = generateId(`${assertion.testId}-${assertion.timestamp}-${assertion.matcher}`);
    
    stmt.run(
      id,
      assertion.testId,
      assertion.timestamp.toISOString(),
      assertion.type,
      assertion.matcher,
      assertion.passed ? 1 : 0, // Convert boolean to integer
      JSON.stringify(assertion.actual),
      JSON.stringify(assertion.expected),
      assertion.message,
      JSON.stringify(assertion.stackTrace)
    );
  }

  /**
   * Store a log entry
   */
  async storeLog(log) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO logs 
      (id, session_id, test_id, timestamp, level, message, source, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const id = generateId(`${log.sessionId}-${log.timestamp}-${log.message}`);
    
    stmt.run(
      id,
      log.sessionId,
      log.testId,
      log.timestamp.toISOString(),
      log.level,
      log.message,
      log.source,
      JSON.stringify(log.metadata)
    );
  }

  /**
   * Store an error
   */
  async storeError(error) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO errors 
      (id, test_id, timestamp, type, message, stack_trace, location, suggestion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const id = generateId(`${error.testId}-${error.timestamp}-${error.type}`);
    
    stmt.run(
      id,
      error.testId,
      error.timestamp.toISOString(),
      error.type,
      error.message,
      JSON.stringify(error.stackTrace),
      JSON.stringify(error.location),
      error.suggestion
    );
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
      summary: JSON.parse(row.summary || '{}')
    };
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
