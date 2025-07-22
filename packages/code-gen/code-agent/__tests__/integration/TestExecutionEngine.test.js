/**
 * Integration tests for TestExecutionEngine with Jester integration
 * 
 * Tests the test execution engine with Jester enhancements
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestExecutionEngine } from '../../src/execution/TestExecutionEngine.js';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock JesterIntegration
jest.mock('../../src/integration/JesterIntegration.js', () => ({
  JesterIntegration: jest.fn().mockImplementation(function(config) {
    this.config = config;
    this.isInitialized = false;
    this.initialize = jest.fn().mockResolvedValue();
    this.isEnabled = jest.fn().mockReturnValue(true);
    this.startSession = jest.fn().mockResolvedValue({ id: 'jester-session-456' });
    this.endSession = jest.fn().mockResolvedValue();
    this.on = jest.fn();
    this.emit = jest.fn();
    this.removeAllListeners = jest.fn();
    this.analyzeTestResults = jest.fn().mockResolvedValue({
      failureSuggestions: ['Fix assertion logic', 'Check test data'],
      performanceInsights: ['Test suite taking too long'],
      coverageGaps: ['Missing tests for error cases']
    });
  })
}));

// Mock TestLogManager
jest.mock('../../src/logging/TestLogManager.js', () => ({
  TestLogManager: jest.fn().mockImplementation(function(config) {
    this.config = config;
    this.initialize = jest.fn().mockResolvedValue();
    this.captureLogs = jest.fn();
    this.retrieveLogs = jest.fn().mockResolvedValue([]);
  })
}));

// Mock spawn
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args) => mockSpawn(...args)
}));

describe('TestExecutionEngine Integration Tests', () => {
  let engine;
  let testDir;
  let config;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create test directory
    testDir = path.join(__dirname, 'temp', `test-engine-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    config = {
      workingDirectory: testDir,
      logManager: {
        logLevel: 'info'
      },
      jester: {
        enabled: true,
        dbPath: path.join(testDir, 'test-results.db'),
        collectConsole: true,
        collectCoverage: true,
        realTimeEvents: true
      }
    };
    
    engine = new TestExecutionEngine(config);
  });

  afterEach(async () => {
    // Cleanup
    if (engine) {
      await engine.cleanup();
    }
    
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization with Jester', () => {
    test('should initialize with jester integration when enabled', async () => {
      await engine.initialize();
      
      expect(engine.isInitialized).toBe(true);
      expect(engine.jesterIntegration).toBeDefined();
      expect(engine.jesterIntegration.initialize).toHaveBeenCalled();
    });

    test('should not initialize jester when disabled', async () => {
      const disabledConfig = {
        ...config,
        jester: { enabled: false }
      };
      
      const disabledEngine = new TestExecutionEngine(disabledConfig);
      await disabledEngine.initialize();
      
      expect(disabledEngine.jesterIntegration).toBeNull();
    });

    test('should setup jester event forwarding', async () => {
      await engine.initialize();
      
      // Verify event forwarding is set up
      const setupMethod = engine.setupJesterEventForwarding;
      expect(setupMethod).toBeDefined();
      
      // Check that jester events are being listened to
      const events = [
        'jester:sessionStart', 'jester:sessionEnd',
        'jester:suiteStart', 'jester:suiteEnd',
        'jester:testStart', 'jester:testEnd',
        'jester:log', 'jester:assertion'
      ];
      
      events.forEach(eventName => {
        expect(engine.jesterIntegration.on).toHaveBeenCalledWith(
          eventName,
          expect.any(Function)
        );
      });
    });
  });

  describe('Jest Arguments Building', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should include jester reporter in Jest args when enabled', async () => {
      const options = {
        testPath: 'test.js',
        coverage: true
      };
      
      const args = await engine.buildJestArgs(testDir, options);
      
      // Should include reporter arguments
      const reporterIndex = args.indexOf('--reporters');
      expect(reporterIndex).toBeGreaterThan(-1);
      
      // Should have default reporter
      expect(args[reporterIndex + 1]).toBe('default');
      
      // Should have jester reporter path
      const jesterReporterArg = args.find(arg => arg.includes('JesterReporter.js'));
      expect(jesterReporterArg).toBeDefined();
    });

    test('should not include jester reporter when disabled', async () => {
      engine.jesterIntegration.isEnabled.mockReturnValue(false);
      
      const options = {
        testPath: 'test.js'
      };
      
      const args = await engine.buildJestArgs(testDir, options);
      
      expect(args).not.toContain('--reporters');
    });

    test('should preserve other Jest arguments with jester', async () => {
      const options = {
        testPath: 'specific.test.js',
        coverage: true,
        watch: true,
        updateSnapshot: true
      };
      
      const args = await engine.buildJestArgs(testDir, options);
      
      expect(args).toContain('--coverage');
      expect(args).toContain('--watch');
      expect(args).toContain('--updateSnapshot');
      expect(args).toContain('specific.test.js');
    });
  });

  describe('Test Execution with Jester', () => {
    let mockProcess;

    beforeEach(async () => {
      await engine.initialize();
      
      // Mock spawn process
      mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false,
        pid: 12345
      };
      
      mockSpawn.mockReturnValue(mockProcess);
    });

    test('should start jester session during test run', async () => {
      // Simulate successful test run
      setTimeout(() => {
        mockProcess.on.mock.calls.find(c => c[0] === 'close')?.[1](0);
      }, 50);
      
      const result = await engine.runJestTests(testDir, { testPath: 'test.js' });
      
      expect(engine.jesterIntegration.startSession).toHaveBeenCalled();
    });

    test('should emit jester-enhanced events', async () => {
      const testStartHandler = jest.fn();
      const testEndHandler = jest.fn();
      
      engine.on('test-start', testStartHandler);
      engine.on('test-end', testEndHandler);
      
      // Simulate test execution
      setTimeout(() => {
        // Simulate stdout with test results
        const output = JSON.stringify({
          success: true,
          numTotalTests: 5,
          numPassedTests: 5
        });
        mockProcess.stdout.on.mock.calls[0]?.[1](Buffer.from(output));
        mockProcess.on.mock.calls.find(c => c[0] === 'close')?.[1](0);
      }, 50);
      
      await engine.runJestTests(testDir);
      
      expect(testStartHandler).toHaveBeenCalled();
      expect(testEndHandler).toHaveBeenCalled();
    });

    test('should handle parallel test execution with jester', async () => {
      const testPaths = ['test1.js', 'test2.js', 'test3.js'];
      
      // Simulate all processes completing
      setTimeout(() => {
        mockProcess.on.mock.calls.find(c => c[0] === 'close')?.[1](0);
      }, 50);
      
      const results = await engine.runParallelTests(testDir, testPaths, { maxWorkers: 2 });
      
      expect(results).toHaveLength(3);
      expect(engine.jesterIntegration.startSession).toHaveBeenCalled();
    });
  });

  describe('Failure Analysis Enhancement', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should enhance failure analysis with jester insights', async () => {
      const testResults = {
        success: false,
        testResults: [
          {
            testFilePath: 'test.js',
            testResults: [
              {
                title: 'failing test',
                status: 'failed',
                failureMessages: ['Assertion failed']
              }
            ]
          }
        ]
      };
      
      const analysis = await engine.analyzeTestFailures(testResults);
      
      expect(analysis).toHaveProperty('categories');
      expect(analysis).toHaveProperty('patterns');
      expect(analysis).toHaveProperty('suggestions');
      expect(analysis).toHaveProperty('jesterInsights');
      
      expect(analysis.jesterInsights).toEqual({
        failureSuggestions: ['Fix assertion logic', 'Check test data'],
        performanceInsights: ['Test suite taking too long'],
        coverageGaps: ['Missing tests for error cases']
      });
    });

    test('should categorize failures with jester help', async () => {
      const testResults = {
        testResults: [
          {
            testResults: [
              {
                status: 'failed',
                failureMessages: ['Expected value to be true']
              },
              {
                status: 'failed',
                failureMessages: ['Timeout exceeded']
              }
            ]
          }
        ]
      };
      
      const analysis = await engine.analyzeTestFailures(testResults);
      
      expect(analysis.categories).toHaveProperty('assertion');
      expect(analysis.categories).toHaveProperty('timeout');
      expect(analysis.categories.assertion).toBeGreaterThan(0);
      expect(analysis.categories.timeout).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should track performance metrics with jester', async () => {
      // Mock process
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        pid: 12345
      };
      mockSpawn.mockReturnValue(mockProcess);
      
      setTimeout(() => {
        const output = JSON.stringify({
          success: true,
          numTotalTests: 10,
          numPassedTests: 10,
          testResults: []
        });
        mockProcess.stdout.on.mock.calls[0]?.[1](Buffer.from(output));
        mockProcess.on.mock.calls.find(c => c[0] === 'close')?.[1](0);
      }, 100);
      
      await engine.runJestTests(testDir);
      
      expect(engine.metrics.totalTestRuns).toBe(1);
      expect(engine.metrics.totalTests).toBe(10);
      expect(engine.metrics.totalPassedTests).toBe(10);
    });

    test('should identify slow tests', async () => {
      const testResults = {
        testResults: [
          {
            testResults: [
              { title: 'fast test', duration: 50, status: 'passed' },
              { title: 'slow test', duration: 2000, status: 'passed' },
              { title: 'very slow test', duration: 6000, status: 'passed' }
            ]
          }
        ]
      };
      
      const slowTests = await engine.identifySlowTests(testResults);
      
      expect(slowTests).toHaveLength(2);
      expect(slowTests[0].name).toBe('very slow test');
      expect(slowTests[1].name).toBe('slow test');
    });
  });

  describe('Coverage Analysis', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should analyze coverage with jester insights', async () => {
      const coverageData = {
        'src/file1.js': {
          lines: { total: 100, covered: 85 },
          functions: { total: 20, covered: 18 },
          branches: { total: 30, covered: 25 }
        },
        'src/file2.js': {
          lines: { total: 50, covered: 30 },
          functions: { total: 10, covered: 6 },
          branches: { total: 15, covered: 8 }
        }
      };
      
      const analysis = await engine.analyzeCoverage(coverageData);
      
      expect(analysis).toHaveProperty('summary');
      expect(analysis).toHaveProperty('uncoveredFiles');
      expect(analysis).toHaveProperty('suggestions');
      
      expect(analysis.uncoveredFiles).toHaveLength(1);
      expect(analysis.uncoveredFiles[0].file).toBe('src/file2.js');
    });
  });

  describe('Report Generation', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should generate comprehensive report with jester data', async () => {
      const testResults = {
        success: true,
        numTotalTests: 20,
        numPassedTests: 18,
        numFailedTests: 2,
        executionTime: 5000,
        coverage: {
          lines: { pct: 85 },
          functions: { pct: 90 },
          branches: { pct: 80 }
        }
      };
      
      const report = await engine.generateTestReport(testResults);
      
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('performance');
      expect(report).toHaveProperty('failures');
      expect(report).toHaveProperty('coverage');
      expect(report).toHaveProperty('suggestions');
      expect(report).toHaveProperty('jesterAnalysis');
    });
  });

  describe('Event System', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should emit lifecycle events with jester data', async () => {
      const events = [];
      const handler = (event) => events.push(event);
      
      engine.on('test-run-start', handler);
      engine.on('test-file-start', handler);
      engine.on('test-file-end', handler);
      engine.on('test-run-end', handler);
      
      // Mock process
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        pid: 12345
      };
      mockSpawn.mockReturnValue(mockProcess);
      
      setTimeout(() => {
        mockProcess.on.mock.calls.find(c => c[0] === 'close')?.[1](0);
      }, 50);
      
      await engine.runJestTests(testDir);
      
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'test-run-start')).toBe(true);
      expect(events.some(e => e.type === 'test-run-end')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should handle jester initialization errors', async () => {
      const errorEngine = new TestExecutionEngine(config);
      errorEngine.jesterIntegration = {
        initialize: jest.fn().mockRejectedValue(new Error('Jester init failed'))
      };
      
      const errorHandler = jest.fn();
      errorEngine.on('initialization-error', errorHandler);
      
      await expect(errorEngine.initialize()).rejects.toThrow('Jester init failed');
    });

    test('should handle test execution errors with jester', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });
      
      const result = await engine.runJestTests(testDir);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Spawn failed');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup jester integration', async () => {
      await engine.initialize();
      
      await engine.cleanup();
      
      expect(engine.jesterIntegration).toBeNull();
      expect(engine.isInitialized).toBe(false);
    });

    test('should cancel active tests on cleanup', async () => {
      await engine.initialize();
      
      // Start a test
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false,
        pid: 12345
      };
      mockSpawn.mockReturnValue(mockProcess);
      
      // Start test but don't wait
      const testPromise = engine.runJestTests(testDir);
      
      // Cleanup should cancel the test
      await engine.cleanup();
      
      expect(mockProcess.kill).toHaveBeenCalled();
    });
  });
});