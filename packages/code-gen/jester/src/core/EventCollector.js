/**
 * Collects and transforms Jest events into structured data
 */

import { EventEmitter } from 'events';
import path from 'path';
import { generateId, parseStackTrace, extractLocation } from '../utils/index.js';

export class EventCollector extends EventEmitter {
  constructor(storage = null) {
    super();
    this.storage = storage;
    this.currentSession = null;
    this.currentSuites = new Map();
    this.currentTests = new Map();
    this.consoleBuffer = [];
  }

  /**
   * Start a new test session
   */
  startSession(config = {}) {
    // Use provided testRunId or generate one
    const sessionId = config.testRunId || generateId('session');
    
    this.currentSession = {
      id: sessionId,
      startTime: new Date(),
      endTime: null,
      status: 'running',
      jestConfig: config,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cwd: process.cwd(),
        jestVersion: process.env.npm_package_devDependencies_jest || 'unknown'
      },
      summary: {},
      metadata: {
        testRunId: config.testRunId || null,
        name: config.name || null,
        description: config.description || null,
        tags: config.tags || [],
        projectPath: process.cwd(),
        testPattern: config.testMatch || config.testRegex || null
      }
    };

    this.emit('sessionStart', this.currentSession);
    return this.currentSession;
  }

  /**
   * End the current test session
   */
  endSession(summary = {}) {
    if (!this.currentSession) return null;

    this.currentSession.endTime = new Date();
    this.currentSession.status = 'completed';
    this.currentSession.summary = summary;

    this.emit('sessionEnd', this.currentSession);
    
    const session = this.currentSession;
    this.currentSession = null;
    this.currentSuites.clear();
    this.currentTests.clear();
    this.consoleBuffer = [];
    
    return session;
  }

  /**
   * Handle test suite start
   */
  onTestSuiteStart(testPath) {
    if (!this.currentSession) return null;

    const suite = {
      id: generateId(`suite-${testPath}`),
      sessionId: this.currentSession.id,
      path: testPath,
      name: path.basename(testPath),
      startTime: new Date(),
      endTime: null,
      status: 'running',
      setupDuration: 0,
      teardownDuration: 0
    };

    this.currentSuites.set(testPath, suite);
    this.emit('suiteStart', suite);
    return suite;
  }

  /**
   * Handle test suite end
   */
  onTestSuiteEnd(testPath, results = {}) {
    const suite = this.currentSuites.get(testPath);
    if (!suite) return null;

    suite.endTime = new Date();
    suite.status = (results.numFailingTests && results.numFailingTests > 0) ? 'failed' : 'passed';
    
    // Remove from current suites
    this.currentSuites.delete(testPath);
    
    this.emit('suiteEnd', suite);
    return suite;
  }

  /**
   * Handle individual test start
   */
  onTestStart(test) {
    if (!this.currentSession) return null;

    const suite = this.currentSuites.get(test.path);
    if (!suite) return null;

    const testCase = {
      id: generateId(`test-${test.path}-${test.name}`),
      sessionId: this.currentSession.id,
      suiteId: suite.id,
      name: test.name,
      fullName: test.fullName || test.name,
      startTime: new Date(),
      endTime: null,
      status: 'running',
      duration: 0,
      assertions: [],
      errors: [],
      logs: []
    };

    this.currentTests.set(test.fullName, testCase);
    this.emit('testStart', testCase);
    return testCase;
  }

  /**
   * Handle individual test end
   */
  onTestEnd(test, results) {
    if (!test || !test.fullName) return null;
    
    const testCase = this.currentTests.get(test.fullName);
    if (!testCase) return null;

    testCase.endTime = new Date();
    testCase.duration = testCase.endTime - testCase.startTime;
    testCase.status = results.status;

    // Process test results
    if (results.failureMessages && results.failureMessages.length > 0) {
      testCase.errors = results.failureMessages.map(message => ({
        testId: testCase.id,
        timestamp: new Date(),
        type: 'assertion',
        message: message,
        stackTrace: parseStackTrace(message),
        location: extractLocation(new Error(message)),
        suggestion: this.generateSuggestion(message)
      }));
    }

    // Add any buffered console logs for this test
    testCase.logs = this.consoleBuffer.filter(log => 
      log.testId === testCase.id || 
      (log.timestamp >= testCase.startTime && log.timestamp <= testCase.endTime)
    );

    // Update session summary
    if (this.currentSession) {
      if (!this.currentSession.summary.total) {
        this.currentSession.summary = {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          todo: 0,
          success: true
        };
      }
      
      this.currentSession.summary.total++;
      if (results.status === 'passed') {
        this.currentSession.summary.passed++;
      } else if (results.status === 'failed') {
        this.currentSession.summary.failed++;
        this.currentSession.summary.success = false;
      } else if (results.status === 'skipped') {
        this.currentSession.summary.skipped++;
      } else if (results.status === 'todo') {
        this.currentSession.summary.todo++;
      }
    }

    // Remove from current tests
    this.currentTests.delete(test.fullName);

    this.emit('testEnd', testCase);
    return testCase;
  }

  /**
   * Handle console output
   */
  onConsoleLog(logEntry) {
    if (!this.currentSession) return;

    // Support both old and new API
    let log;
    if (typeof logEntry === 'object' && logEntry.sessionId) {
      log = logEntry;
    } else {
      // Legacy API support
      const [type, message, origin] = arguments;
      log = {
        sessionId: this.currentSession.id,
        testId: this.getCurrentTestId(origin),
        timestamp: new Date(),
        level: type,
        message: message,
        source: 'test',
        metadata: { origin }
      };
    }

    this.consoleBuffer.push(log);
    this.emit('log', log);
  }

  /**
   * Handle assertion events
   */
  onAssertion(assertion) {
    if (!this.currentSession) return;

    this.emit('assertion', assertion);
  }

  /**
   * Get current test ID based on origin
   */
  getCurrentTestId(origin) {
    // Try to match console output to current test
    for (const [fullName, testCase] of this.currentTests) {
      if (testCase.status === 'running') {
        return testCase.id;
      }
    }
    return null;
  }

  /**
   * Generate suggestion for error message
   */
  generateSuggestion(errorMessage) {
    if (errorMessage.includes('expect(received).toBe(expected)')) {
      return 'Consider using .toEqual() for object comparisons or check if the values are of the same type';
    }
    if (errorMessage.includes('Cannot read property')) {
      return 'Check if the object or variable is properly initialized before accessing its properties';
    }
    if (errorMessage.includes('is not a function')) {
      return 'Verify that the method exists and is properly imported or defined';
    }
    if (errorMessage.includes('timeout')) {
      return 'Consider increasing the timeout value or optimizing async operations';
    }
    return 'Review the error message and stack trace for specific guidance';
  }
}
