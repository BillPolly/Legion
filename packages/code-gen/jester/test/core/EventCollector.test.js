/**
 * Event Collector Tests
 * Tests for Jest event collection and transformation into structured data
 */

import { EventCollector } from '../../src/core/EventCollector.js';

describe('EventCollector', () => {
  let collector;

  beforeEach(() => {
    collector = new EventCollector();
  });

  afterEach(() => {
    // Clean up any event listeners
    collector.removeAllListeners();
  });

  describe('Session Management', () => {
    test('startSession creates session with unique ID', () => {
      const session1 = collector.startSession();
      const session2 = collector.startSession();
      
      expect(session1.id).toBeDefined();
      expect(session2.id).toBeDefined();
      expect(session1.id).not.toBe(session2.id);
      expect(typeof session1.id).toBe('string');
      expect(session1.id.length).toBe(16);
    });

    test('startSession captures environment information', () => {
      const session = collector.startSession();
      
      expect(session.environment).toBeDefined();
      expect(session.environment.nodeVersion).toBe(process.version);
      expect(session.environment.platform).toBe(process.platform);
      expect(session.environment.cwd).toBe(process.cwd());
    });

    test('startSession emits sessionStart event', (done) => {
      collector.on('sessionStart', (session) => {
        expect(session.id).toBeDefined();
        expect(session.status).toBe('running');
        expect(session.startTime).toBeInstanceOf(Date);
        expect(session.endTime).toBeNull();
        done();
      });
      
      collector.startSession();
    });

    test('startSession accepts custom config', () => {
      const config = { testMatch: ['**/*.test.js'], verbose: true };
      const session = collector.startSession(config);
      
      expect(session.jestConfig).toEqual(config);
    });

    test('endSession updates session end time', () => {
      const session = collector.startSession();
      const summary = { totalTests: 5, passed: 3, failed: 2 };
      
      const endedSession = collector.endSession(summary);
      
      expect(endedSession.endTime).toBeInstanceOf(Date);
      expect(endedSession.endTime.getTime()).toBeGreaterThanOrEqual(session.startTime.getTime());
      expect(endedSession.status).toBe('completed');
      expect(endedSession.summary).toEqual(summary);
    });

    test('endSession emits sessionEnd event', (done) => {
      collector.startSession();
      
      collector.on('sessionEnd', (session) => {
        expect(session.status).toBe('completed');
        expect(session.endTime).toBeInstanceOf(Date);
        done();
      });
      
      collector.endSession();
    });

    test('endSession cleans up internal state', () => {
      collector.startSession();
      collector.onTestSuiteStart('/path/to/test.js');
      collector.onTestStart({ path: '/path/to/test.js', name: 'test', fullName: 'test' });
      
      expect(collector.currentSession).toBeDefined();
      expect(collector.currentSuites.size).toBe(1);
      expect(collector.currentTests.size).toBe(1);
      
      collector.endSession();
      
      expect(collector.currentSession).toBeNull();
      expect(collector.currentSuites.size).toBe(0);
      expect(collector.currentTests.size).toBe(0);
      expect(collector.consoleBuffer.length).toBe(0);
    });

    test('endSession returns null when no active session', () => {
      const result = collector.endSession();
      expect(result).toBeNull();
    });
  });

  describe('Test Suite Management', () => {
    beforeEach(() => {
      collector.startSession();
    });

    test('onTestSuiteStart creates suite record', () => {
      const suite = collector.onTestSuiteStart('/path/to/test.js');
      
      expect(suite).toBeDefined();
      expect(suite.id).toBeDefined();
      expect(suite.sessionId).toBe(collector.currentSession.id);
      expect(suite.path).toBe('/path/to/test.js');
      expect(suite.name).toBe('test.js');
      expect(suite.startTime).toBeInstanceOf(Date);
      expect(suite.status).toBe('running');
    });

    test('onTestSuiteStart emits suiteStart event', (done) => {
      collector.on('suiteStart', (suite) => {
        expect(suite.path).toBe('/path/to/test.js');
        expect(suite.status).toBe('running');
        done();
      });
      
      collector.onTestSuiteStart('/path/to/test.js');
    });

    test('onTestSuiteEnd updates suite status', () => {
      collector.onTestSuiteStart('/path/to/test.js');
      const results = { numFailingTests: 0, numPassingTests: 3 };
      
      const suite = collector.onTestSuiteEnd('/path/to/test.js', results);
      
      expect(suite.endTime).toBeInstanceOf(Date);
      expect(suite.status).toBe('passed');
    });

    test('onTestSuiteEnd sets failed status when tests fail', () => {
      collector.onTestSuiteStart('/path/to/test.js');
      const results = { numFailingTests: 2, numPassingTests: 1 };
      
      const suite = collector.onTestSuiteEnd('/path/to/test.js', results);
      
      expect(suite.status).toBe('failed');
    });

    test('onTestSuiteEnd emits suiteEnd event', (done) => {
      collector.onTestSuiteStart('/path/to/test.js');
      
      collector.on('suiteEnd', (suite) => {
        expect(suite.endTime).toBeInstanceOf(Date);
        expect(suite.status).toBe('passed');
        done();
      });
      
      collector.onTestSuiteEnd('/path/to/test.js', { numFailingTests: 0 });
    });

    test('onTestSuiteEnd returns null for non-existent suite', () => {
      const result = collector.onTestSuiteEnd('/non/existent/test.js', {});
      expect(result).toBeNull();
    });

    test('onTestSuiteStart returns null when no active session', () => {
      collector.endSession();
      const result = collector.onTestSuiteStart('/path/to/test.js');
      expect(result).toBeNull();
    });
  });

  describe('Test Case Management', () => {
    beforeEach(() => {
      collector.startSession();
      collector.onTestSuiteStart('/path/to/test.js');
    });

    test('onTestStart creates test case record', () => {
      const test = {
        path: '/path/to/test.js',
        name: 'should work',
        fullName: 'MyComponent should work'
      };
      
      const testCase = collector.onTestStart(test);
      
      expect(testCase).toBeDefined();
      expect(testCase.id).toBeDefined();
      expect(testCase.sessionId).toBe(collector.currentSession.id);
      expect(testCase.name).toBe('should work');
      expect(testCase.fullName).toBe('MyComponent should work');
      expect(testCase.startTime).toBeInstanceOf(Date);
      expect(testCase.status).toBe('running');
      expect(testCase.duration).toBe(0);
    });

    test('onTestStart links to correct suite', () => {
      const suite = collector.onTestSuiteStart('/path/to/test.js');
      const test = { path: '/path/to/test.js', name: 'test', fullName: 'test' };
      
      const testCase = collector.onTestStart(test);
      
      expect(testCase.suiteId).toBe(suite.id);
    });

    test('onTestStart emits testStart event', (done) => {
      const test = { path: '/path/to/test.js', name: 'test', fullName: 'test' };
      
      collector.on('testStart', (testCase) => {
        expect(testCase.name).toBe('test');
        expect(testCase.status).toBe('running');
        done();
      });
      
      collector.onTestStart(test);
    });

    test('onTestEnd calculates duration correctly', () => {
      const test = { path: '/path/to/test.js', name: 'test', fullName: 'test' };
      const testCase = collector.onTestStart(test);
      
      // Simulate some time passing
      const startTime = testCase.startTime.getTime();
      
      const results = { status: 'passed' };
      const endedTestCase = collector.onTestEnd(test, results);
      
      expect(endedTestCase.endTime).toBeInstanceOf(Date);
      expect(endedTestCase.duration).toBeGreaterThanOrEqual(0);
      expect(endedTestCase.status).toBe('passed');
    });

    test('onTestEnd processes failure messages', () => {
      const test = { path: '/path/to/test.js', name: 'test', fullName: 'test' };
      collector.onTestStart(test);
      
      const results = {
        status: 'failed',
        failureMessages: [
          'Expected true to be false',
          'Cannot read property of undefined'
        ]
      };
      
      const testCase = collector.onTestEnd(test, results);
      
      expect(testCase.errors).toHaveLength(2);
      expect(testCase.errors[0].type).toBe('assertion');
      expect(testCase.errors[0].message).toBe('Expected true to be false');
      expect(testCase.errors[1].message).toBe('Cannot read property of undefined');
    });

    test('onTestEnd generates error suggestions', () => {
      const test = { path: '/path/to/test.js', name: 'test', fullName: 'test' };
      collector.onTestStart(test);
      
      const results = {
        status: 'failed',
        failureMessages: ['expect(received).toBe(expected)']
      };
      
      const testCase = collector.onTestEnd(test, results);
      
      expect(testCase.errors[0].suggestion).toContain('toEqual');
    });

    test('onTestEnd emits testEnd event', (done) => {
      const test = { path: '/path/to/test.js', name: 'test', fullName: 'test' };
      collector.onTestStart(test);
      
      collector.on('testEnd', (testCase) => {
        expect(testCase.status).toBe('passed');
        expect(testCase.endTime).toBeInstanceOf(Date);
        done();
      });
      
      collector.onTestEnd(test, { status: 'passed' });
    });

    test('onTestEnd returns null for non-existent test', () => {
      const test = { path: '/path/to/test.js', name: 'nonexistent', fullName: 'nonexistent' };
      const result = collector.onTestEnd(test, { status: 'passed' });
      expect(result).toBeNull();
    });

    test('onTestStart returns null when no active session', () => {
      collector.endSession();
      const test = { path: '/path/to/test.js', name: 'test', fullName: 'test' };
      const result = collector.onTestStart(test);
      expect(result).toBeNull();
    });

    test('onTestStart returns null when no matching suite', () => {
      const test = { path: '/different/path.js', name: 'test', fullName: 'test' };
      const result = collector.onTestStart(test);
      expect(result).toBeNull();
    });
  });

  describe('Console Log Handling', () => {
    beforeEach(() => {
      collector.startSession();
      collector.onTestSuiteStart('/path/to/test.js');
    });

    test('onConsoleLog buffers console output', () => {
      collector.onConsoleLog('info', 'Test message', { file: '/path/to/test.js' });
      
      expect(collector.consoleBuffer).toHaveLength(1);
      expect(collector.consoleBuffer[0].level).toBe('info');
      expect(collector.consoleBuffer[0].message).toBe('Test message');
      expect(collector.consoleBuffer[0].source).toBe('test');
    });

    test('onConsoleLog emits log event', (done) => {
      collector.on('log', (log) => {
        expect(log.level).toBe('warn');
        expect(log.message).toBe('Warning message');
        expect(log.sessionId).toBe(collector.currentSession.id);
        done();
      });
      
      collector.onConsoleLog('warn', 'Warning message', {});
    });

    test('onConsoleLog associates with current test', () => {
      const test = { path: '/path/to/test.js', name: 'test', fullName: 'test' };
      const testCase = collector.onTestStart(test);
      
      collector.onConsoleLog('error', 'Error message', {});
      
      expect(collector.consoleBuffer[0].testId).toBe(testCase.id);
    });

    test('onConsoleLog handles no active session gracefully', () => {
      collector.endSession();
      
      // Should not throw
      collector.onConsoleLog('info', 'Message', {});
      expect(collector.consoleBuffer).toHaveLength(0);
    });

    test('getCurrentTestId returns null when no running tests', () => {
      const testId = collector.getCurrentTestId({});
      expect(testId).toBeNull();
    });

    test('getCurrentTestId returns running test ID', () => {
      const test = { path: '/path/to/test.js', name: 'test', fullName: 'test' };
      const testCase = collector.onTestStart(test);
      
      const testId = collector.getCurrentTestId({});
      expect(testId).toBe(testCase.id);
    });
  });

  describe('Error Suggestion Generation', () => {
    test('generateSuggestion for toBe vs toEqual', () => {
      const suggestion = collector.generateSuggestion('expect(received).toBe(expected)');
      expect(suggestion).toContain('toEqual');
      expect(suggestion).toContain('object comparisons');
    });

    test('generateSuggestion for property access errors', () => {
      const suggestion = collector.generateSuggestion('Cannot read property "foo" of undefined');
      expect(suggestion).toContain('initialized');
      expect(suggestion).toContain('properties');
    });

    test('generateSuggestion for function errors', () => {
      const suggestion = collector.generateSuggestion('myFunction is not a function');
      expect(suggestion).toContain('method exists');
      expect(suggestion).toContain('imported');
    });

    test('generateSuggestion for timeout errors', () => {
      const suggestion = collector.generateSuggestion('Test timeout exceeded');
      expect(suggestion).toContain('timeout');
      expect(suggestion).toContain('async');
    });

    test('generateSuggestion for unknown errors', () => {
      const suggestion = collector.generateSuggestion('Some unknown error');
      expect(suggestion).toContain('Review the error message');
      expect(suggestion).toContain('stack trace');
    });
  });

  describe('Event Emission', () => {
    test('all events are properly emitted', (done) => {
      const events = [];
      const expectedEvents = ['sessionStart', 'suiteStart', 'testStart', 'testEnd', 'suiteEnd', 'sessionEnd'];
      
      expectedEvents.forEach(event => {
        collector.on(event, () => {
          events.push(event);
          if (events.length === expectedEvents.length) {
            expect(events).toEqual(expectedEvents);
            done();
          }
        });
      });
      
      // Trigger all events in sequence
      collector.startSession();
      collector.onTestSuiteStart('/path/to/test.js');
      const test = { path: '/path/to/test.js', name: 'test', fullName: 'test' };
      collector.onTestStart(test);
      collector.onTestEnd(test, { status: 'passed' });
      collector.onTestSuiteEnd('/path/to/test.js', { numFailingTests: 0 });
      collector.endSession();
    });

    test('log events are emitted independently', (done) => {
      let logCount = 0;
      
      collector.on('log', () => {
        logCount++;
        if (logCount === 2) {
          done();
        }
      });
      
      collector.startSession();
      collector.onConsoleLog('info', 'Message 1', {});
      collector.onConsoleLog('warn', 'Message 2', {});
    });
  });

  describe('Edge Cases', () => {
    test('handles test with missing fullName', () => {
      collector.startSession();
      collector.onTestSuiteStart('/path/to/test.js');
      
      const test = { path: '/path/to/test.js', name: 'test' }; // No fullName
      const testCase = collector.onTestStart(test);
      
      expect(testCase.fullName).toBe('test'); // Should default to name
    });

    test('handles empty failure messages', () => {
      collector.startSession();
      collector.onTestSuiteStart('/path/to/test.js');
      const test = { path: '/path/to/test.js', name: 'test', fullName: 'test' };
      collector.onTestStart(test);
      
      const results = { status: 'failed', failureMessages: [] };
      const testCase = collector.onTestEnd(test, results);
      
      expect(testCase.errors).toHaveLength(0);
    });

    test('handles missing failure messages', () => {
      collector.startSession();
      collector.onTestSuiteStart('/path/to/test.js');
      const test = { path: '/path/to/test.js', name: 'test', fullName: 'test' };
      collector.onTestStart(test);
      
      const results = { status: 'failed' }; // No failureMessages
      const testCase = collector.onTestEnd(test, results);
      
      expect(testCase.errors).toHaveLength(0);
    });

    test('handles multiple sessions sequentially', () => {
      const session1 = collector.startSession();
      collector.endSession();
      
      const session2 = collector.startSession();
      
      expect(session1.id).not.toBe(session2.id);
      expect(collector.currentSession.id).toBe(session2.id);
    });

    test('handles console logs with buffering and test association', () => {
      collector.startSession();
      collector.onTestSuiteStart('/path/to/test.js');
      
      const test = { path: '/path/to/test.js', name: 'test', fullName: 'test' };
      const testCase = collector.onTestStart(test);
      
      collector.onConsoleLog('info', 'During test', {});
      
      const results = { status: 'passed' };
      const endedTestCase = collector.onTestEnd(test, results);
      
      expect(endedTestCase.logs).toHaveLength(1);
      expect(endedTestCase.logs[0].message).toBe('During test');
      expect(endedTestCase.logs[0].testId).toBe(testCase.id);
    });
  });
});
