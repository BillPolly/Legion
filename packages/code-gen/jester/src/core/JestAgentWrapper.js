/**
 * Main Jest Agent Wrapper class
 */

import { EventEmitter } from 'events';
import { EventCollector } from './EventCollector.js';
import { StorageEngine } from '../storage/StorageEngine.js';
import { QueryEngine } from '../storage/QueryEngine.js';

export class JestAgentWrapper extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      storage: 'sqlite',
      dbPath: './test-results.db',
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

    // Initialize storage
    this.initializeStorage();
    this.setupEventForwarding();
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
    this.currentSession = this.collector.startSession(jestConfig);
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
    this.on('sessionStart', callback);
  }

  /**
   * Listen for session end events
   */
  onSessionEnd(callback) {
    this.on('sessionEnd', callback);
  }

  /**
   * Listen for test start events
   */
  onTestStart(callback) {
    this.on('testStart', callback);
  }

  /**
   * Listen for test completion events
   */
  onTestComplete(callback) {
    this.on('testEnd', callback);
  }

  /**
   * Listen for assertion events
   */
  onAssertion(callback) {
    this.on('assertion', callback);
  }

  /**
   * Listen for log events
   */
  onLog(callback) {
    this.on('log', callback);
  }

  /**
   * Listen for suite start events
   */
  onSuiteStart(callback) {
    this.on('suiteStart', callback);
  }

  /**
   * Listen for suite end events
   */
  onSuiteEnd(callback) {
    this.on('suiteEnd', callback);
  }

  /**
   * Close the wrapper and cleanup resources
   */
  async close() {
    try {
      await this.stopSession();
    } catch (error) {
      console.warn('Failed to stop session during close:', error.message);
    }
    
    try {
      await this.storage.close();
    } catch (error) {
      console.warn('Failed to close storage during close:', error.message);
    }
    
    // Clean up all event listeners
    this.removeAllListeners();
  }
}
