/**
 * JesterReporter - Custom Jest reporter
 * 
 * Captures all Jest events and stores them in the database
 */

import { DatabaseManager } from './DatabaseManager.js';

class JesterReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig;
    this.options = options;
    this.runId = options.runId;
    this.db = new DatabaseManager(options.databasePath);
  }

  /**
   * Called when test run starts
   */
  onRunStart(results, options) {
    // Implementation will be added via TDD
    throw new Error('Not implemented');
  }

  /**
   * Called when a test file starts running
   */
  onTestStart(test) {
    // Implementation will be added via TDD
    throw new Error('Not implemented');
  }

  /**
   * Called when a test file finishes
   */
  onTestResult(test, testResult, aggregatedResult) {
    // Implementation will be added via TDD
    throw new Error('Not implemented');
  }

  /**
   * Called when all tests complete
   */
  onRunComplete(contexts, results) {
    // Implementation will be added via TDD
    throw new Error('Not implemented');
  }

  /**
   * Get the last error (for error reporting)
   */
  getLastError() {
    return this.lastError;
  }
}

export default JesterReporter;