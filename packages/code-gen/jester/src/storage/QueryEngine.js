/**
 * Query engine for searching and analyzing test data
 */

export class QueryEngine {
  constructor(storage) {
    this.storage = storage;
  }

  /**
   * Find tests matching criteria
   */
  async findTests(criteria = {}) {
    await this.storage.initialize();
    
    let query = 'SELECT * FROM test_cases WHERE 1=1';
    const params = [];
    
    if (criteria.sessionId) {
      query += ' AND session_id = ?';
      params.push(criteria.sessionId);
    }
    
    if (criteria.status) {
      query += ' AND status = ?';
      params.push(criteria.status);
    }
    
    if (criteria.name) {
      query += ' AND name LIKE ?';
      params.push(`%${criteria.name}%`);
    }
    
    if (criteria.minDuration) {
      query += ' AND duration >= ?';
      params.push(criteria.minDuration);
    }
    
    query += ' ORDER BY start_time DESC';
    
    if (criteria.limit) {
      query += ' LIMIT ?';
      params.push(criteria.limit);
    }
    
    const stmt = this.storage.db.prepare(query);
    const rows = stmt.all(...params);
    
    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      suiteId: row.suite_id,
      name: row.name,
      fullName: row.full_name,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : null,
      status: row.status,
      duration: row.duration
    }));
  }

  /**
   * Get failed tests
   */
  async getFailedTests(sessionId = null) {
    const criteria = { status: 'failed' };
    if (sessionId) criteria.sessionId = sessionId;
    return this.findTests(criteria);
  }

  /**
   * Get tests by file path
   */
  async getTestsByFile(filePath) {
    await this.storage.initialize();
    
    const stmt = this.storage.db.prepare(`
      SELECT tc.* FROM test_cases tc
      JOIN test_suites ts ON tc.suite_id = ts.id
      WHERE ts.path = ?
      ORDER BY tc.start_time DESC
    `);
    
    const rows = stmt.all(filePath);
    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      suiteId: row.suite_id,
      name: row.name,
      fullName: row.full_name,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : null,
      status: row.status,
      duration: row.duration
    }));
  }

  /**
   * Search logs
   */
  async searchLogs(query = {}) {
    await this.storage.initialize();
    
    let sql = 'SELECT * FROM logs WHERE 1=1';
    const params = [];
    
    if (query.sessionId) {
      sql += ' AND session_id = ?';
      params.push(query.sessionId);
    }
    
    if (query.testId) {
      sql += ' AND test_id = ?';
      params.push(query.testId);
    }
    
    if (query.level) {
      sql += ' AND level = ?';
      params.push(query.level);
    }
    
    if (query.message) {
      sql += ' AND message LIKE ?';
      params.push(`%${query.message}%`);
    }
    
    if (query.since) {
      sql += ' AND timestamp >= ?';
      params.push(query.since.toISOString());
    }
    
    sql += ' ORDER BY timestamp DESC';
    
    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }
    
    const stmt = this.storage.db.prepare(sql);
    const rows = stmt.all(...params);
    
    return rows.map(row => ({
      sessionId: row.session_id,
      testId: row.test_id,
      timestamp: new Date(row.timestamp),
      level: row.level,
      message: row.message,
      source: row.source,
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  /**
   * Get errors by type
   */
  async getErrorsByType(errorType) {
    await this.storage.initialize();
    
    const stmt = this.storage.db.prepare(`
      SELECT e.*, tc.name as test_name, tc.full_name 
      FROM errors e
      JOIN test_cases tc ON e.test_id = tc.id
      WHERE e.type = ?
      ORDER BY e.timestamp DESC
    `);
    
    const rows = stmt.all(errorType);
    return rows.map(row => ({
      testId: row.test_id,
      testName: row.test_name,
      testFullName: row.full_name,
      timestamp: new Date(row.timestamp),
      type: row.type,
      message: row.message,
      stackTrace: JSON.parse(row.stack_trace || '[]'),
      location: JSON.parse(row.location || '{}'),
      suggestion: row.suggestion
    }));
  }

  /**
   * Get most common errors
   */
  async getMostCommonErrors(limit = 10) {
    await this.storage.initialize();
    
    const stmt = this.storage.db.prepare(`
      SELECT type, message, COUNT(*) as count
      FROM errors
      GROUP BY type, message
      ORDER BY count DESC
      LIMIT ?
    `);
    
    const rows = stmt.all(limit);
    return rows.map(row => ({
      type: row.type,
      message: row.message,
      count: row.count
    }));
  }

  /**
   * Get slowest tests
   */
  async getSlowestTests(limit = 10) {
    await this.storage.initialize();
    
    const stmt = this.storage.db.prepare(`
      SELECT * FROM test_cases 
      WHERE duration IS NOT NULL 
      ORDER BY duration DESC 
      LIMIT ?
    `);
    
    const rows = stmt.all(limit);
    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      suiteId: row.suite_id,
      name: row.name,
      fullName: row.full_name,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : null,
      status: row.status,
      duration: row.duration
    }));
  }

  /**
   * Get test history for a specific test name
   */
  async getTestHistory(testName) {
    return this.findTests({ name: testName });
  }

  /**
   * Get test summary statistics
   */
  async getTestSummary(sessionId = null) {
    await this.storage.initialize();
    
    let query = 'SELECT status, COUNT(*) as count FROM test_cases';
    const params = [];
    
    if (sessionId) {
      query += ' WHERE session_id = ?';
      params.push(sessionId);
    }
    
    query += ' GROUP BY status';
    
    const stmt = this.storage.db.prepare(query);
    const rows = stmt.all(...params);
    
    const summary = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      todo: 0
    };
    
    rows.forEach(row => {
      summary[row.status] = row.count;
      summary.total += row.count;
    });
    
    return summary;
  }

  /**
   * Get test case with full details including assertions, errors, and logs
   */
  async getTestCase(testId) {
    await this.storage.initialize();
    
    // Get the test case
    const testStmt = this.storage.db.prepare('SELECT * FROM test_cases WHERE id = ?');
    const testRow = testStmt.get(testId);
    
    if (!testRow) return null;
    
    // Get assertions
    const assertionStmt = this.storage.db.prepare('SELECT * FROM assertions WHERE test_id = ?');
    const assertionRows = assertionStmt.all(testId);
    
    // Get errors
    const errorStmt = this.storage.db.prepare('SELECT * FROM errors WHERE test_id = ?');
    const errorRows = errorStmt.all(testId);
    
    // Get logs
    const logStmt = this.storage.db.prepare('SELECT * FROM logs WHERE test_id = ?');
    const logRows = logStmt.all(testId);
    
    return {
      id: testRow.id,
      sessionId: testRow.session_id,
      suiteId: testRow.suite_id,
      name: testRow.name,
      fullName: testRow.full_name,
      startTime: new Date(testRow.start_time),
      endTime: testRow.end_time ? new Date(testRow.end_time) : null,
      status: testRow.status,
      duration: testRow.duration,
      assertions: assertionRows.map(row => ({
        testId: row.test_id,
        timestamp: new Date(row.timestamp),
        type: row.type,
        matcher: row.matcher,
        passed: row.passed,
        actual: JSON.parse(row.actual || 'null'),
        expected: JSON.parse(row.expected || 'null'),
        message: row.message,
        stackTrace: JSON.parse(row.stack_trace || '[]')
      })),
      errors: errorRows.map(row => ({
        testId: row.test_id,
        timestamp: new Date(row.timestamp),
        type: row.type,
        message: row.message,
        stackTrace: JSON.parse(row.stack_trace || '[]'),
        location: JSON.parse(row.location || '{}'),
        suggestion: row.suggestion
      })),
      logs: logRows.map(row => ({
        sessionId: row.session_id,
        testId: row.test_id,
        timestamp: new Date(row.timestamp),
        level: row.level,
        message: row.message,
        source: row.source,
        metadata: JSON.parse(row.metadata || '{}')
      }))
    };
  }
}
