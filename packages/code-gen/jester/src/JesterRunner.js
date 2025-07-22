/**
 * JesterRunner - Main API for Jest execution management
 * 
 * Provides high-level interface for running tests and querying results
 */

import path from 'path';
import { DatabaseManager } from './DatabaseManager.js';
import { JestExecutor } from './JestExecutor.js';
import { ConsoleCapture } from './ConsoleCapture.js';
import { QueryAPI } from './QueryAPI.js';

class JesterRunner {
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.databasePath = options.databasePath || './jester.db';
    
    // Initialize components
    this.db = new DatabaseManager(this.databasePath);
    this.executor = new JestExecutor();
    this.consoleCapture = new ConsoleCapture(this.db);
    this.query = new QueryAPI(this.db);
  }

  /**
   * Run tests with the specified options
   * 
   * @param {Object} options - Test execution options
   * @param {string} options.testPattern - Glob pattern for test files
   * @param {boolean} options.coverage - Enable coverage collection
   * @param {number} options.maxWorkers - Number of worker processes
   * @param {number} options.timeout - Test timeout in milliseconds
   * @returns {Promise<string>} Run ID for querying results
   */
  async runTests(options = {}) {
    // Implementation will be added via TDD
    throw new Error('Not implemented');
  }

  /**
   * Get a summary of the test run
   * 
   * @param {string} runId - Run ID from runTests
   * @returns {Promise<Object>} Run summary with statistics
   */
  async getRunSummary(runId) {
    return this.query.getRunSummary(runId);
  }
}

export { JesterRunner };