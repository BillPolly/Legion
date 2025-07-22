/**
 * Custom Jest reporter that integrates with the JAW system
 */

import { EventCollector } from '../core/EventCollector.js';
import { StorageEngine } from '../storage/StorageEngine.js';
import { QueryEngine } from '../storage/QueryEngine.js';

export class JestAgentReporter {
  constructor(globalConfig, options = {}) {
    this.globalConfig = globalConfig;
    this.options = {
      dbPath: './test-results.db',
      collectConsole: true,
      collectCoverage: true,
      realTimeEvents: true,
      ...options
    };
    this.collector = new EventCollector();
    this.storage = new StorageEngine(this.options.dbPath);
    this.query = new QueryEngine(this.storage);
    
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.collector.on('sessionStart', session => this.storage.storeSession(session));
    this.collector.on('sessionEnd', session => this.storage.storeSession(session));
    this.collector.on('suiteStart', suite => this.storage.storeSuite(suite));
    this.collector.on('suiteEnd', suite => this.storage.storeSuite(suite));
    this.collector.on('testStart', testCase => {
      // Store basic test info immediately
    });
    this.collector.on('testEnd', testCase => this.storage.storeTestCase(testCase));
    this.collector.on('log', log => this.storage.storeLog(log));
  }

  /**
   * Called when Jest starts running tests
   */
  onRunStart(results, options) {
    this.session = this.collector.startSession(this.globalConfig);
  }

  /**
   * Called when a test suite starts
   */
  onTestSuiteStart(test) {
    if (test && test.path) {
      this.collector.onTestSuiteStart(test.path);
    }
  }

  /**
   * Called when a test suite ends
   */
  onTestSuiteEnd(test, testResults) {
    if (test && test.path && testResults) {
      this.collector.onTestSuiteEnd(test.path, testResults);
    }
  }

  /**
   * Called when an individual test starts
   */
  onTestStart(test) {
    if (test) {
      this.collector.onTestStart(test);
    }
  }

  /**
   * Called when an individual test ends
   */
  onTestEnd(test, testResults) {
    if (test && testResults) {
      this.collector.onTestEnd(test, testResults);
    }
  }

  /**
   * Called when Jest finishes running all tests
   */
  onRunComplete(contexts, results) {
    if (!results) {
      this.collector.endSession({});
      return;
    }

    const summary = {
      numTotalTestSuites: results.numTotalTestSuites || 0,
      numPassedTestSuites: results.numPassedTestSuites || 0,
      numFailedTestSuites: results.numFailedTestSuites || 0,
      numTotalTests: results.numTotalTests || 0,
      numPassedTests: results.numPassedTests || 0,
      numFailedTests: results.numFailedTests || 0,
      numPendingTests: results.numPendingTests || 0,
      testResults: results.testResults || []
    };

    this.collector.endSession(summary);
  }

  /**
   * Get collector instance for external access
   */
  getCollector() {
    return this.collector;
  }

  /**
   * Get storage instance for external access
   */
  getStorage() {
    return this.storage;
  }

  /**
   * Get query engine for external access
   */
  getQuery() {
    return this.query;
  }
}
