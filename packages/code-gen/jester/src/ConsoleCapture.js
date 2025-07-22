/**
 * ConsoleCapture - Intercepts and correlates console output
 * 
 * Uses AsyncLocalStorage to maintain test context across console calls
 */

import { AsyncLocalStorage } from 'async_hooks';
import util from 'util';

class ConsoleCapture {
  constructor(databaseManager) {
    this.db = databaseManager;
    this.originalConsole = {};
    this.asyncLocalStorage = new AsyncLocalStorage();
    this.isActive = false;
    this.runId = null;
  }

  /**
   * Setup console interception
   * 
   * @param {string} runId - Current run ID
   */
  async setup(runId) {
    if (this.isActive) {
      return;
    }

    this.runId = runId;
    this.isActive = true;

    const methods = ['log', 'error', 'warn', 'info', 'debug'];
    
    methods.forEach(method => {
      // Save original method
      this.originalConsole[method] = console[method];
      
      // Replace with interceptor
      console[method] = (...args) => {
        const timestamp = Date.now();
        const context = this.asyncLocalStorage.getStore();
        
        try {
          // Format message
          const message = util.format(...args);
          
          // Record to database
          this.db.recordConsole({
            runId: this.runId,
            level: method,
            timestamp,
            message,
            testPath: context?.testPath,
            testName: context?.testName,
            stackTrace: new Error().stack
          }).catch(err => {
            // Silently handle errors to avoid breaking tests
            if (this.originalConsole.error && method !== 'error') {
              this.originalConsole.error('Failed to record console:', err);
            }
          });
        } catch (error) {
          // Ensure we don't break console even on error
        }
        
        // Call original method
        this.originalConsole[method](...args);
      };
    });
  }

  /**
   * Restore original console methods
   */
  async teardown() {
    if (!this.isActive) {
      return;
    }

    const methods = ['log', 'error', 'warn', 'info', 'debug'];
    
    methods.forEach(method => {
      if (this.originalConsole[method]) {
        console[method] = this.originalConsole[method];
      }
    });

    this.originalConsole = {};
    this.isActive = false;
    this.runId = null;
  }

  /**
   * Run code with test context
   * 
   * @param {Object} context - Test context (testPath, testName, etc)
   * @param {Function} fn - Function to run with context
   */
  runWithContext(context, fn) {
    return this.asyncLocalStorage.run(context, fn);
  }

  /**
   * Get current test context
   * 
   * @returns {Object|undefined} Current context or undefined
   */
  getContext() {
    return this.asyncLocalStorage.getStore();
  }
}

export { ConsoleCapture };