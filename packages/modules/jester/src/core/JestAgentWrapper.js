/**
 * Main Jest Agent Wrapper class
 */

import { EventEmitter } from 'events';
import { EventCollector } from './EventCollector.js';
import { StorageEngine } from '../storage/StorageEngine.js';
import { QueryEngine } from '../storage/QueryEngine.js';
import { promises as fs } from 'fs';
import path from 'path';

export class JestAgentWrapper extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Increase max listeners to handle legitimate test scenarios with many listeners
    // Tests like memory.test.js and real-time-events.test.js legitimately add 50+ listeners
    this.setMaxListeners(100);
    
    // Track listeners for debugging memory leaks (development/test mode only)
    this._listenerTrackingEnabled = process.env.NODE_ENV === 'test' || process.env.JAW_DEBUG_LISTENERS;
    this._listenerStats = this._listenerTrackingEnabled ? new Map() : null;
    
    this.config = {
      storage: 'sqlite',
      dbPath: config.dbPath || './test-results.db',  // Default to fixed path for persistence
      testRunId: config.testRunId || null,  // Optional test run ID
      clearPrevious: config.clearPrevious !== undefined ? config.clearPrevious : false,  // Default: keep history
      collectConsole: true,
      collectCoverage: true,
      collectPerformance: true,
      realTimeEvents: true,
      ...config
    };

    this.storage = new StorageEngine(this.config.dbPath);
    this.query = new QueryEngine(this.storage);
    this.collector = new EventCollector(this.storage);
    this.reporter = null;
    this.currentSession = null;

    // Only clean up if explicitly requested
    const initPromise = this.config.clearPrevious 
      ? this.clearDatabase().then(() => this.initializeStorage())
      : this.initializeStorage();
    
    initPromise.catch(err => console.warn('Initialization warning:', err.message));
    this.setupEventForwarding();
  }

  /**
   * Clear the database - only when explicitly requested
   */
  async clearDatabase() {
    try {
      // Close existing connection first
      await this.storage.close();
      
      // Only delete the specific database file, not all databases
      const dbPath = path.resolve(this.config.dbPath);
      
      try {
        // Delete the main database file and SQLite auxiliary files
        await fs.unlink(dbPath).catch(() => {});
        await fs.unlink(dbPath + '-shm').catch(() => {});
        await fs.unlink(dbPath + '-wal').catch(() => {});
        
        console.log(`🧹 Cleared database: ${path.basename(dbPath)}`);
      } catch (error) {
        // File might not exist, that's fine
      }
      
      // Recreate storage engine after clearing
      this.storage = new StorageEngine(this.config.dbPath);
      this.query = new QueryEngine(this.storage);
    } catch (error) {
      console.warn('Database clear warning:', error.message);
    }
  }
  
  /**
   * Clean up old database files in the dbs directory
   * @deprecated Use clearDatabase() or clearSession() instead
   */
  async cleanupDatabases() {
    console.warn('cleanupDatabases() is deprecated. Use clearDatabase() for clearing all data or clearSession() for specific sessions.');
    if (this.config.clearPrevious) {
      return this.clearDatabase();
    }
  }

  /**
   * Initialize storage
   */
  async initializeStorage() {
    try {
      await this.storage.initialize();
    } catch (error) {
      console.warn('Failed to initialize storage:', error.message);
    }
  }

  /**
   * Setup event forwarding from collector to wrapper
   */
  setupEventForwarding() {
    // Forward events and handle storage
    this.collector.on('sessionStart', async (session) => {
      try {
        await this.storage.storeSession(session);
      } catch (error) {
        console.warn('Failed to store session:', error.message);
      }
      this.emit('sessionStart', session);
    });

    this.collector.on('sessionEnd', async (session) => {
      try {
        await this.storage.storeSession(session);
      } catch (error) {
        console.warn('Failed to store session end:', error.message);
      }
      this.emit('sessionEnd', session);
    });

    this.collector.on('suiteStart', async (suite) => {
      try {
        await this.storage.storeSuite(suite);
      } catch (error) {
        console.warn('Failed to store suite start:', error.message);
      }
      this.emit('suiteStart', suite);
    });

    this.collector.on('suiteEnd', async (suite) => {
      try {
        await this.storage.storeSuite(suite);
      } catch (error) {
        console.warn('Failed to store suite end:', error.message);
      }
      this.emit('suiteEnd', suite);
    });

    this.collector.on('testStart', (test) => {
      this.emit('testStart', test);
    });

    this.collector.on('testEnd', async (test) => {
      try {
        await this.storage.storeTestCase(test);
      } catch (error) {
        console.warn('Failed to store test case:', error.message);
      }
      this.emit('testEnd', test);
    });

    this.collector.on('log', async (log) => {
      try {
        await this.storage.storeLog(log);
      } catch (error) {
        console.warn('Failed to store log:', error.message);
      }
      this.emit('log', log);
    });

    this.collector.on('assertion', async (assertion) => {
      try {
        await this.storage.storeAssertion(assertion);
      } catch (error) {
        console.warn('Failed to store assertion:', error.message);
      }
      this.emit('assertion', assertion);
    });
  }

  /**
   * Start a new test session
   */
  async startSession(jestConfig = {}) {
    // Pass testRunId to collector - jestConfig overrides constructor config
    const sessionConfig = {
      testRunId: this.config.testRunId,
      ...jestConfig
    };
    this.currentSession = this.collector.startSession(sessionConfig);
    await this.storage.storeSession(this.currentSession);
    return this.currentSession;
  }

  /**
   * Run tests programmatically
   */
  async runTests(pattern = '', jestConfig = {}) {
    // This would integrate with Jest's programmatic API
    // For now, return a mock session
    const session = await this.startSession(jestConfig);
    
    // In a real implementation, this would:
    // 1. Configure Jest with custom reporter
    // 2. Run Jest with the specified pattern
    // 3. Wait for completion
    // 4. Return the session with results
    
    return session;
  }

  /**
   * Stop the current session
   */
  async stopSession() {
    if (this.currentSession) {
      const session = this.collector.endSession();
      if (session) {
        await this.storage.storeSession(session);
      }
      this.currentSession = null;
    }
  }

  /**
   * Get a specific session
   */
  async getSession(sessionId) {
    return this.storage.getSession(sessionId);
  }

  /**
   * Get all sessions
   */
  async getAllSessions() {
    return this.storage.getAllSessions();
  }

  /**
   * Clear a specific session and all its data
   */
  async clearSession(sessionId) {
    return this.storage.clearSession(sessionId);
  }

  /**
   * Clear all sessions from the database
   */
  async clearAllSessions() {
    return this.storage.clearAllSessions();
  }

  /**
   * Clear old sessions to manage storage
   * @param {number} daysToKeep - Number of days of sessions to keep
   * @returns {number} Number of sessions deleted
   */
  async clearOldSessions(daysToKeep = 30) {
    const sessions = await this.storage.getAllSessions();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let deletedCount = 0;
    for (const session of sessions) {
      if (session.startTime < cutoffDate) {
        await this.storage.clearSession(session.id);
        deletedCount++;
      }
    }
    
    console.log(`🧹 Cleared ${deletedCount} sessions older than ${daysToKeep} days`);
    return deletedCount;
  }

  /**
   * Prune sessions to keep only the most recent N sessions
   * @param {number} maxSessions - Maximum number of sessions to keep
   * @returns {number} Number of sessions deleted
   */
  async pruneSessions(maxSessions = 100) {
    const sessions = await this.storage.getAllSessions();
    
    if (sessions.length <= maxSessions) {
      return 0;
    }
    
    // Sessions are already sorted by start_time DESC
    const sessionsToDelete = sessions.slice(maxSessions);
    let deletedCount = 0;
    
    for (const session of sessionsToDelete) {
      await this.storage.clearSession(session.id);
      deletedCount++;
    }
    
    console.log(`🧹 Pruned ${deletedCount} old sessions (kept ${maxSessions} most recent)`);
    return deletedCount;
  }

  /**
   * Get database size information
   * @returns {Object} Database size metrics
   */
  async getDatabaseInfo() {
    const sessions = await this.storage.getAllSessions();
    const dbPath = path.resolve(this.config.dbPath);
    
    let fileSize = 0;
    try {
      const stats = await fs.stat(dbPath);
      fileSize = stats.size;
    } catch (error) {
      // File might not exist yet
    }
    
    return {
      sessionCount: sessions.length,
      databasePath: dbPath,
      sizeInBytes: fileSize,
      sizeInMB: (fileSize / (1024 * 1024)).toFixed(2),
      oldestSession: sessions.length > 0 ? sessions[sessions.length - 1].startTime : null,
      newestSession: sessions.length > 0 ? sessions[0].startTime : null
    };
  }

  /**
   * Get failed tests
   */
  async getFailedTests(sessionId = null) {
    return this.query.getFailedTests(sessionId);
  }

  /**
   * Search logs
   */
  async searchLogs(query) {
    return this.query.searchLogs(query);
  }

  /**
   * Get test history
   */
  async getTestHistory(testName) {
    return this.query.getTestHistory(testName);
  }

  /**
   * Get errors by type
   */
  async getErrorsByType(errorType) {
    return this.query.getErrorsByType(errorType);
  }

  /**
   * Get test summary
   */
  async getTestSummary(sessionId = null) {
    return this.query.getTestSummary(sessionId);
  }

  /**
   * Find tests matching criteria
   */
  async findTests(criteria) {
    return this.query.findTests(criteria);
  }

  /**
   * Compare test results across multiple sessions
   */
  async compareSessions(sessionIds) {
    return this.query.compareSessions(sessionIds);
  }

  /**
   * Get test trends across sessions
   */
  async getTestTrends(testName, limit = 10) {
    return this.query.getTestTrends(testName, limit);
  }

  /**
   * Get slowest tests
   */
  async getSlowestTests(limit = 10) {
    return this.query.getSlowestTests(limit);
  }

  /**
   * Get most common errors
   */
  async getMostCommonErrors(limit = 10) {
    return this.query.getMostCommonErrors(limit);
  }

  /**
   * Get test case with full details
   */
  async getTestCase(testId) {
    return this.query.getTestCase(testId);
  }

  /**
   * Get tests by file path
   */
  async getTestsByFile(filePath) {
    return this.query.getTestsByFile(filePath);
  }

  /**
   * Event listener convenience methods
   */
  
  /**
   * Listen for session start events
   */
  onSessionStart(callback) {
    this._trackListenerAdd('sessionStart');
    this.on('sessionStart', callback);
  }

  /**
   * Listen for session end events
   */
  onSessionEnd(callback) {
    this._trackListenerAdd('sessionEnd');
    this.on('sessionEnd', callback);
  }

  /**
   * Listen for test start events
   */
  onTestStart(callback) {
    this._trackListenerAdd('testStart');
    this.on('testStart', callback);
  }

  /**
   * Listen for test completion events
   */
  onTestComplete(callback) {
    this._trackListenerAdd('testEnd');
    this.on('testEnd', callback);
  }

  /**
   * Listen for assertion events
   */
  onAssertion(callback) {
    this._trackListenerAdd('assertion');
    this.on('assertion', callback);
  }

  /**
   * Listen for log events
   */
  onLog(callback) {
    this._trackListenerAdd('log');
    this.on('log', callback);
  }

  /**
   * Listen for suite start events
   */
  onSuiteStart(callback) {
    this._trackListenerAdd('suiteStart');
    this.on('suiteStart', callback);
  }

  /**
   * Listen for suite end events
   */
  onSuiteEnd(callback) {
    this._trackListenerAdd('suiteEnd');
    this.on('suiteEnd', callback);
  }

  /**
   * Remove listener convenience methods
   */
  
  /**
   * Remove listener for session start events
   */
  offSessionStart(callback) {
    this._trackListenerRemove('sessionStart');
    this.off('sessionStart', callback);
  }

  /**
   * Remove listener for session end events
   */
  offSessionEnd(callback) {
    this._trackListenerRemove('sessionEnd');
    this.off('sessionEnd', callback);
  }

  /**
   * Remove listener for test start events
   */
  offTestStart(callback) {
    this._trackListenerRemove('testStart');
    this.off('testStart', callback);
  }

  /**
   * Remove listener for test completion events
   */
  offTestComplete(callback) {
    this._trackListenerRemove('testEnd');
    this.off('testEnd', callback);
  }

  /**
   * Remove listener for assertion events
   */
  offAssertion(callback) {
    this._trackListenerRemove('assertion');
    this.off('assertion', callback);
  }

  /**
   * Remove listener for log events
   */
  offLog(callback) {
    this._trackListenerRemove('log');
    this.off('log', callback);
  }

  /**
   * Remove listener for suite start events
   */
  offSuiteStart(callback) {
    this._trackListenerRemove('suiteStart');
    this.off('suiteStart', callback);
  }

  /**
   * Remove listener for suite end events
   */
  offSuiteEnd(callback) {
    this._trackListenerRemove('suiteEnd');
    this.off('suiteEnd', callback);
  }

  /**
   * Listener tracking and debugging methods
   */
  
  /**
   * Track listener addition for debugging
   */
  _trackListenerAdd(eventName) {
    if (this._listenerTrackingEnabled && this._listenerStats) {
      const current = this._listenerStats.get(eventName) || 0;
      this._listenerStats.set(eventName, current + 1);
    }
  }

  /**
   * Track listener removal for debugging
   */
  _trackListenerRemove(eventName) {
    if (this._listenerTrackingEnabled && this._listenerStats) {
      const current = this._listenerStats.get(eventName) || 0;
      this._listenerStats.set(eventName, Math.max(0, current - 1));
    }
  }

  /**
   * Get listener statistics for debugging
   */
  getListenerStats() {
    if (!this._listenerTrackingEnabled || !this._listenerStats) {
      return null;
    }
    return Object.fromEntries(this._listenerStats.entries());
  }

  /**
   * Log current listener counts for debugging
   */
  logListenerCounts() {
    if (!this._listenerTrackingEnabled) return;
    
    const events = ['sessionStart', 'sessionEnd', 'testStart', 'testEnd', 'suiteStart', 'suiteEnd', 'assertion', 'log'];
    console.log('JestAgentWrapper Listener Counts:');
    events.forEach(event => {
      const count = this.listenerCount(event);
      if (count > 0) {
        console.log(`  ${event}: ${count}`);
      }
    });
  }

  /**
   * Close the wrapper and cleanup resources
   */
  async close() {
    // Clean up event listeners first to prevent any new events during shutdown
    this.removeAllListeners();
    
    try {
      await this.stopSession();
    } catch (error) {
      console.warn('Failed to stop session during close:', error.message);
    }
    
    try {
      // Clean up collector listeners as well
      if (this.collector && this.collector.removeAllListeners) {
        this.collector.removeAllListeners();
      }
    } catch (error) {
      console.warn('Failed to cleanup collector during close:', error.message);
    }
    
    try {
      if (this.storage && typeof this.storage.close === 'function') {
        await this.storage.close();
      }
    } catch (error) {
      console.warn('Failed to close storage during close:', error.message);
    }
    
    // Null out references to help garbage collection
    this.currentSession = null;
    this.collector = null;
    this.storage = null;
    this.query = null;
  }
}
