/**
 * Unit tests for JesterReporter
 * 
 * Tests the custom Jest reporter for Jester integration
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock the parent JestAgentReporter
const mockJestAgentReporter = jest.fn();
mockJestAgentReporter.prototype.onRunStart = jest.fn();
mockJestAgentReporter.prototype.onTestSuiteStart = jest.fn();
mockJestAgentReporter.prototype.onTestStart = jest.fn();
mockJestAgentReporter.prototype.onTestEnd = jest.fn();
mockJestAgentReporter.prototype.onTestSuiteEnd = jest.fn();
mockJestAgentReporter.prototype.onRunComplete = jest.fn();

// Mock the jester import
jest.mock('@legion/jester', () => ({
  JestAgentReporter: mockJestAgentReporter
}));

// Mock process.emit
const originalProcessEmit = process.emit;
beforeEach(() => {
  process.emit = jest.fn();
});

afterEach(() => {
  process.emit = originalProcessEmit;
});

// Import after mocking
let JesterReporter;
beforeEach(async () => {
  jest.resetModules();
  const module = await import('../../../src/reporter/JesterReporter.js');
  JesterReporter = module.default;
});

describe('JesterReporter', () => {
  let reporter;
  let globalConfig;
  let options;

  beforeEach(() => {
    jest.clearAllMocks();
    
    globalConfig = {
      rootDir: '/test/project',
      testTimeout: 5000
    };
    
    options = {
      dbPath: './custom-test-results.db',
      collectConsole: true,
      collectCoverage: true,
      realTimeEvents: true
    };
    
    reporter = new JesterReporter(globalConfig, options);
  });

  describe('Constructor', () => {
    test('should create reporter with provided options', () => {
      expect(mockJestAgentReporter).toHaveBeenCalledWith(globalConfig, {
        dbPath: './custom-test-results.db',
        collectConsole: true,
        collectCoverage: true,
        realTimeEvents: true
      });
      expect(reporter.testRunId).toBeNull();
    });

    test('should create reporter with default options', () => {
      const defaultReporter = new JesterReporter(globalConfig, {});
      
      expect(mockJestAgentReporter).toHaveBeenCalledWith(globalConfig, {
        dbPath: './test-results.db',
        collectConsole: true,
        collectCoverage: true,
        realTimeEvents: true
      });
    });

    test('should handle disabled options', () => {
      const disabledOptions = {
        collectConsole: false,
        collectCoverage: false,
        realTimeEvents: false
      };
      
      const disabledReporter = new JesterReporter(globalConfig, disabledOptions);
      
      expect(mockJestAgentReporter).toHaveBeenCalledWith(globalConfig, {
        dbPath: './test-results.db',
        collectConsole: false,
        collectCoverage: false,
        realTimeEvents: false
      });
    });
  });

  describe('onRunStart', () => {
    test('should call parent onRunStart', () => {
      const results = { numTotalTestSuites: 5 };
      const options = { watch: false };
      
      reporter.onRunStart(results, options);
      
      expect(mockJestAgentReporter.prototype.onRunStart).toHaveBeenCalledWith(results, options);
    });

    test('should generate unique test run ID', () => {
      const results = { numTotalTestSuites: 5 };
      
      reporter.onRunStart(results, {});
      
      expect(reporter.testRunId).toBeDefined();
      expect(reporter.testRunId).toMatch(/^[a-z0-9]+$/);
    });

    test('should emit jester:run-start event when realTimeEvents enabled', () => {
      reporter.options = { realTimeEvents: true };
      const results = { numTotalTestSuites: 5 };
      
      reporter.onRunStart(results, {});
      
      expect(process.emit).toHaveBeenCalledWith('jester:run-start', {
        testRunId: reporter.testRunId,
        timestamp: expect.any(Number),
        numTotalTestSuites: 5
      });
    });

    test('should not emit event when realTimeEvents disabled', () => {
      reporter.options = { realTimeEvents: false };
      const results = { numTotalTestSuites: 5 };
      
      reporter.onRunStart(results, {});
      
      expect(process.emit).not.toHaveBeenCalled();
    });
  });

  describe('onTestSuiteStart', () => {
    beforeEach(() => {
      reporter.testRunId = 'test-run-123';
    });

    test('should call parent onTestSuiteStart', () => {
      const test = { path: '/test/file.test.js' };
      
      reporter.onTestSuiteStart(test);
      
      expect(mockJestAgentReporter.prototype.onTestSuiteStart).toHaveBeenCalledWith(test);
    });

    test('should emit jester:suite-start event', () => {
      reporter.options = { realTimeEvents: true };
      const test = { path: '/test/file.test.js' };
      
      reporter.onTestSuiteStart(test);
      
      expect(process.emit).toHaveBeenCalledWith('jester:suite-start', {
        testRunId: 'test-run-123',
        suite: '/test/file.test.js',
        timestamp: expect.any(Number)
      });
    });

    test('should handle null test object', () => {
      reporter.options = { realTimeEvents: true };
      
      reporter.onTestSuiteStart(null);
      
      expect(process.emit).not.toHaveBeenCalled();
    });
  });

  describe('onTestStart', () => {
    beforeEach(() => {
      reporter.testRunId = 'test-run-123';
    });

    test('should call parent onTestStart', () => {
      const test = {
        path: '/test/file.test.js',
        fullName: 'Test Suite > should do something'
      };
      
      reporter.onTestStart(test);
      
      expect(mockJestAgentReporter.prototype.onTestStart).toHaveBeenCalledWith(test);
    });

    test('should emit jester:test-start event', () => {
      reporter.options = { realTimeEvents: true };
      const test = {
        path: '/test/file.test.js',
        fullName: 'Test Suite > should do something'
      };
      
      reporter.onTestStart(test);
      
      expect(process.emit).toHaveBeenCalledWith('jester:test-start', {
        testRunId: 'test-run-123',
        test: '/test/file.test.js',
        fullName: 'Test Suite > should do something',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('onTestEnd', () => {
    beforeEach(() => {
      reporter.testRunId = 'test-run-123';
    });

    test('should call parent onTestEnd', () => {
      const test = {
        path: '/test/file.test.js',
        fullName: 'Test Suite > should do something'
      };
      const testResults = {
        status: 'passed',
        duration: 50,
        failureMessages: []
      };
      
      reporter.onTestEnd(test, testResults);
      
      expect(mockJestAgentReporter.prototype.onTestEnd).toHaveBeenCalledWith(test, testResults);
    });

    test('should emit jester:test-end event with test results', () => {
      reporter.options = { realTimeEvents: true };
      const test = {
        path: '/test/file.test.js',
        fullName: 'Test Suite > should do something'
      };
      const testResults = {
        status: 'failed',
        duration: 150,
        failureMessages: ['Expected true to be false']
      };
      
      reporter.onTestEnd(test, testResults);
      
      expect(process.emit).toHaveBeenCalledWith('jester:test-end', {
        testRunId: 'test-run-123',
        test: '/test/file.test.js',
        fullName: 'Test Suite > should do something',
        status: 'failed',
        duration: 150,
        failureMessages: ['Expected true to be false'],
        timestamp: expect.any(Number)
      });
    });

    test('should handle missing test or results', () => {
      reporter.options = { realTimeEvents: true };
      
      reporter.onTestEnd(null, null);
      
      expect(process.emit).not.toHaveBeenCalled();
    });
  });

  describe('onTestSuiteEnd', () => {
    beforeEach(() => {
      reporter.testRunId = 'test-run-123';
    });

    test('should call parent onTestSuiteEnd', () => {
      const test = { path: '/test/file.test.js' };
      const testResults = {
        numPassingTests: 8,
        numFailingTests: 2,
        numPendingTests: 1,
        perfStats: { runtime: 1234 }
      };
      
      reporter.onTestSuiteEnd(test, testResults);
      
      expect(mockJestAgentReporter.prototype.onTestSuiteEnd).toHaveBeenCalledWith(test, testResults);
    });

    test('should emit jester:suite-end event with statistics', () => {
      reporter.options = { realTimeEvents: true };
      const test = { path: '/test/file.test.js' };
      const testResults = {
        numPassingTests: 8,
        numFailingTests: 2,
        numPendingTests: 1,
        perfStats: { runtime: 1234 }
      };
      
      reporter.onTestSuiteEnd(test, testResults);
      
      expect(process.emit).toHaveBeenCalledWith('jester:suite-end', {
        testRunId: 'test-run-123',
        suite: '/test/file.test.js',
        numPassingTests: 8,
        numFailingTests: 2,
        numPendingTests: 1,
        duration: 1234,
        timestamp: expect.any(Number)
      });
    });

    test('should handle missing perfStats', () => {
      reporter.options = { realTimeEvents: true };
      const test = { path: '/test/file.test.js' };
      const testResults = {
        numPassingTests: 8,
        numFailingTests: 2,
        numPendingTests: 1
      };
      
      reporter.onTestSuiteEnd(test, testResults);
      
      expect(process.emit).toHaveBeenCalledWith('jester:suite-end', {
        testRunId: 'test-run-123',
        suite: '/test/file.test.js',
        numPassingTests: 8,
        numFailingTests: 2,
        numPendingTests: 1,
        duration: 0,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('onRunComplete', () => {
    beforeEach(() => {
      reporter.testRunId = 'test-run-123';
    });

    test('should call parent onRunComplete', () => {
      const contexts = [{ config: globalConfig }];
      const results = {
        numTotalTests: 100,
        numPassedTests: 90,
        numFailedTests: 10,
        numPendingTests: 0,
        success: false
      };
      
      reporter.onRunComplete(contexts, results);
      
      expect(mockJestAgentReporter.prototype.onRunComplete).toHaveBeenCalledWith(contexts, results);
    });

    test('should emit jester:run-complete event with final results', () => {
      reporter.options = { realTimeEvents: true };
      const contexts = [{ config: globalConfig }];
      const results = {
        numTotalTests: 100,
        numPassedTests: 90,
        numFailedTests: 10,
        numPendingTests: 0,
        success: false
      };
      
      reporter.onRunComplete(contexts, results);
      
      expect(process.emit).toHaveBeenCalledWith('jester:run-complete', {
        testRunId: 'test-run-123',
        numTotalTests: 100,
        numPassedTests: 90,
        numFailedTests: 10,
        numPendingTests: 0,
        success: false,
        timestamp: expect.any(Number)
      });
    });

    test('should handle missing results', () => {
      reporter.options = { realTimeEvents: true };
      const contexts = [{ config: globalConfig }];
      
      reporter.onRunComplete(contexts, null);
      
      expect(process.emit).not.toHaveBeenCalled();
    });
  });

  describe('getTestRunId', () => {
    test('should return current test run ID', () => {
      reporter.testRunId = 'test-run-456';
      
      expect(reporter.getTestRunId()).toBe('test-run-456');
    });

    test('should return null when no test run active', () => {
      expect(reporter.getTestRunId()).toBeNull();
    });
  });

  describe('Event Emission Edge Cases', () => {
    test('should handle all events disabled', () => {
      reporter.options = { realTimeEvents: false };
      reporter.testRunId = 'test-run-123';
      
      reporter.onRunStart({ numTotalTestSuites: 5 }, {});
      reporter.onTestSuiteStart({ path: '/test.js' });
      reporter.onTestStart({ path: '/test.js', fullName: 'test' });
      reporter.onTestEnd({ path: '/test.js' }, { status: 'passed' });
      reporter.onTestSuiteEnd({ path: '/test.js' }, { numPassingTests: 1 });
      reporter.onRunComplete([{}], { success: true });
      
      expect(process.emit).not.toHaveBeenCalled();
    });

    test('should generate different test run IDs for different runs', () => {
      const reporter1 = new JesterReporter(globalConfig, options);
      const reporter2 = new JesterReporter(globalConfig, options);
      
      reporter1.onRunStart({ numTotalTestSuites: 1 }, {});
      reporter2.onRunStart({ numTotalTestSuites: 1 }, {});
      
      expect(reporter1.testRunId).toBeDefined();
      expect(reporter2.testRunId).toBeDefined();
      expect(reporter1.testRunId).not.toBe(reporter2.testRunId);
    });
  });
});