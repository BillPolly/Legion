/**
 * JesterReporter - Custom Jest reporter for Jester integration
 * 
 * This reporter acts as a bridge between Jest and the Jester system,
 * forwarding test events to Jester for enhanced reporting and analytics.
 */

import { JestAgentReporter } from '@legion/jester';

/**
 * Custom Jest reporter that extends JestAgentReporter
 */
class JesterReporter extends JestAgentReporter {
  constructor(globalConfig, options = {}) {
    // Pass options to parent JestAgentReporter
    super(globalConfig, {
      dbPath: options.dbPath || './test-results.db',
      collectConsole: options.collectConsole !== false,
      collectCoverage: options.collectCoverage !== false,
      realTimeEvents: options.realTimeEvents !== false,
      ...options
    });
    
    this.testRunId = null;
  }

  /**
   * Called when Jest starts running tests
   */
  onRunStart(results, options) {
    super.onRunStart(results, options);
    
    // Generate a unique test run ID
    this.testRunId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    // Emit custom event for code-agent integration
    if (this.options.realTimeEvents) {
      process.emit('jester:run-start', {
        testRunId: this.testRunId,
        timestamp: Date.now(),
        numTotalTestSuites: results.numTotalTestSuites || 0
      });
    }
  }

  /**
   * Called when a test suite starts
   */
  onTestSuiteStart(test) {
    super.onTestSuiteStart(test);
    
    if (this.options.realTimeEvents && test) {
      process.emit('jester:suite-start', {
        testRunId: this.testRunId,
        suite: test.path,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Called when an individual test starts
   */
  onTestStart(test) {
    super.onTestStart(test);
    
    if (this.options.realTimeEvents && test) {
      process.emit('jester:test-start', {
        testRunId: this.testRunId,
        test: test.path,
        fullName: test.fullName,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Called when an individual test ends
   */
  onTestEnd(test, testResults) {
    super.onTestEnd(test, testResults);
    
    if (this.options.realTimeEvents && test && testResults) {
      process.emit('jester:test-end', {
        testRunId: this.testRunId,
        test: test.path,
        fullName: test.fullName,
        status: testResults.status,
        duration: testResults.duration,
        failureMessages: testResults.failureMessages,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Called when a test suite ends
   */
  onTestSuiteEnd(test, testResults) {
    super.onTestSuiteEnd(test, testResults);
    
    if (this.options.realTimeEvents && test && testResults) {
      process.emit('jester:suite-end', {
        testRunId: this.testRunId,
        suite: test.path,
        numPassingTests: testResults.numPassingTests,
        numFailingTests: testResults.numFailingTests,
        numPendingTests: testResults.numPendingTests,
        duration: testResults.perfStats ? testResults.perfStats.runtime : 0,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Called when Jest finishes running all tests
   */
  onRunComplete(contexts, results) {
    super.onRunComplete(contexts, results);
    
    if (this.options.realTimeEvents && results) {
      process.emit('jester:run-complete', {
        testRunId: this.testRunId,
        numTotalTests: results.numTotalTests,
        numPassedTests: results.numPassedTests,
        numFailedTests: results.numFailedTests,
        numPendingTests: results.numPendingTests,
        success: results.success,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get test run ID for external reference
   */
  getTestRunId() {
    return this.testRunId;
  }
}

// Export as default for Jest to use
export default JesterReporter;