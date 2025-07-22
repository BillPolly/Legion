/**
 * Integration tests for RealJestExecutor with Jester integration
 * 
 * Tests the real Jest execution with Jester enhancements
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RealJestExecutor } from '../../src/execution/RealJestExecutor.js';
import { TestLogManager } from '../../src/logging/TestLogManager.js';
import { LogAnalysisEngine } from '../../src/logging/LogAnalysisEngine.js';
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
    this.startSession = jest.fn().mockResolvedValue({ id: 'jester-session-123' });
    this.endSession = jest.fn().mockResolvedValue();
    this.analyzeTestResults = jest.fn().mockResolvedValue({
      summary: { total: 10, passed: 8, failed: 2 },
      failedTests: [
        { name: 'test 1', error: 'assertion failed' }
      ],
      slowTests: [
        { name: 'slow test', duration: 2000 }
      ],
      suggestions: ['Improve test assertions']
    });
    this.generateTestReport = jest.fn().mockResolvedValue({
      session: { id: 'jester-session-123' },
      results: { total: 10, passed: 8, failed: 2 },
      timestamp: new Date().toISOString()
    });
    this.on = jest.fn();
    this.emit = jest.fn();
    this.removeAllListeners = jest.fn();
  })
}));

// Mock spawn for Jest execution
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args) => mockSpawn(...args)
}));

describe('RealJestExecutor Integration Tests', () => {
  let executor;
  let logManager;
  let logAnalyzer;
  let testDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create test directory
    testDir = path.join(__dirname, 'temp', `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test instances
    logManager = new TestLogManager();
    logAnalyzer = new LogAnalysisEngine();
    
    const config = {
      workingDirectory: testDir,
      coverage: true,
      coverageThreshold: 80,
      jester: {
        enabled: true,
        dbPath: path.join(testDir, 'test-results.db'),
        collectConsole: true,
        collectCoverage: true,
        realTimeEvents: true
      }
    };
    
    executor = new RealJestExecutor(config, logManager, logAnalyzer);
  });

  afterEach(async () => {
    // Cleanup
    if (executor) {
      await executor.cleanup();
    }
    
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization with Jester', () => {
    test('should initialize with jester integration when enabled', async () => {
      await executor.initialize();
      
      expect(executor.isInitialized).toBe(true);
      expect(executor.jesterIntegration).toBeDefined();
      expect(executor.jesterIntegration.initialize).toHaveBeenCalled();
    });

    test('should not initialize jester when disabled', async () => {
      const disabledConfig = {
        workingDirectory: testDir,
        jester: { enabled: false }
      };
      
      const disabledExecutor = new RealJestExecutor(disabledConfig, logManager, logAnalyzer);
      await disabledExecutor.initialize();
      
      expect(disabledExecutor.jesterIntegration).toBeNull();
    });

    test('should setup jester event forwarding', async () => {
      await executor.initialize();
      
      const events = [
        'jester:sessionStart', 'jester:sessionEnd',
        'jester:suiteStart', 'jester:suiteEnd',
        'jester:testStart', 'jester:testEnd',
        'jester:log', 'jester:assertion'
      ];
      
      events.forEach(eventName => {
        expect(executor.jesterIntegration.on).toHaveBeenCalledWith(
          eventName,
          expect.any(Function)
        );
      });
    });

    test('should forward jester events with execution ID', async () => {
      await executor.initialize();
      
      // Get the event handler for jester:testStart
      const onCalls = executor.jesterIntegration.on.mock.calls;
      const testStartCall = onCalls.find(call => call[0] === 'jester:testStart');
      const handler = testStartCall[1];
      
      // Set up event listener
      const eventHandler = jest.fn();
      executor.on('jester:testStart', eventHandler);
      
      // Trigger the event
      const testData = { test: 'data' };
      handler(testData);
      
      expect(eventHandler).toHaveBeenCalledWith({
        test: 'data',
        executionId: executor.executionId
      });
    });
  });

  describe('Test Execution with Jester', () => {
    beforeEach(async () => {
      await executor.initialize();
      
      // Mock spawn to simulate Jest execution
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false
      };
      
      mockSpawn.mockReturnValue(mockProcess);
      
      // Simulate successful Jest run
      setTimeout(() => {
        const jestOutput = JSON.stringify({
          success: true,
          numTotalTests: 10,
          numPassedTests: 8,
          numFailedTests: 2,
          numPendingTests: 0,
          testResults: [
            {
              name: 'test-file.js',
              assertionResults: [
                { title: 'test 1', status: 'passed', duration: 50 },
                { title: 'test 2', status: 'failed', duration: 100, failureMessages: ['Error'] }
              ]
            }
          ]
        });
        
        mockProcess.stdout.on.mock.calls.forEach(call => {
          if (call[0] === 'data') call[1](Buffer.from(jestOutput));
        });
        
        mockProcess.on.mock.calls.forEach(call => {
          if (call[0] === 'close') call[1](0);
        });
      }, 100);
    });

    test('should start jester session when executing tests', async () => {
      const result = await executor.executeJest(testDir);
      
      expect(executor.jesterIntegration.startSession).toHaveBeenCalled();
      expect(result.jesterAnalysis).toBeDefined();
      expect(result.jesterReport).toBeDefined();
    });

    test('should analyze test results with jester', async () => {
      const result = await executor.executeJest(testDir);
      
      expect(executor.jesterIntegration.analyzeTestResults).toHaveBeenCalledWith('jester-session-123');
      expect(result.jesterAnalysis).toEqual({
        summary: { total: 10, passed: 8, failed: 2 },
        failedTests: [
          { name: 'test 1', error: 'assertion failed' }
        ],
        slowTests: [
          { name: 'slow test', duration: 2000 }
        ],
        suggestions: ['Improve test assertions']
      });
    });

    test('should generate jester report', async () => {
      const result = await executor.executeJest(testDir);
      
      expect(executor.jesterIntegration.generateTestReport).toHaveBeenCalledWith('jester-session-123');
      expect(result.jesterReport).toHaveProperty('session');
      expect(result.jesterReport).toHaveProperty('results');
      expect(result.jesterReport).toHaveProperty('timestamp');
    });

    test('should handle jester analysis errors gracefully', async () => {
      executor.jesterIntegration.analyzeTestResults.mockRejectedValueOnce(new Error('Analysis failed'));
      
      const errorHandler = jest.fn();
      executor.on('jester-analysis-error', errorHandler);
      
      const result = await executor.executeJest(testDir);
      
      expect(errorHandler).toHaveBeenCalledWith({
        error: 'Analysis failed',
        executionId: expect.any(String)
      });
      expect(result.jesterAnalysis).toBeNull();
      expect(result.jesterReport).toBeNull();
    });

    test('should include jester data in execution history', async () => {
      const result = await executor.executeJest(testDir);
      
      expect(executor.executionHistory).toHaveLength(1);
      expect(executor.executionHistory[0]).toHaveProperty('jesterAnalysis');
      expect(executor.executionHistory[0]).toHaveProperty('jesterReport');
    });
  });

  describe('Performance and Coverage Tracking', () => {
    beforeEach(async () => {
      await executor.initialize();
    });

    test('should update performance metrics with jester data', async () => {
      // Mock spawn for test execution
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn()
      };
      mockSpawn.mockReturnValue(mockProcess);
      
      // Simulate test completion
      setTimeout(() => {
        const output = JSON.stringify({
          numTotalTests: 10,
          numPassedTests: 8,
          numFailedTests: 2,
          testResults: []
        });
        mockProcess.stdout.on.mock.calls[0][1](Buffer.from(output));
        mockProcess.on.mock.calls.find(c => c[0] === 'close')[1](0);
      }, 50);
      
      await executor.executeJest(testDir);
      
      expect(executor.performanceMetrics.totalExecutions).toBe(1);
      expect(executor.performanceMetrics.performanceHistory).toHaveLength(1);
    });

    test('should track coverage trends', async () => {
      // Mock spawn
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn()
      };
      mockSpawn.mockReturnValue(mockProcess);
      
      // Simulate coverage data
      setTimeout(() => {
        const output = JSON.stringify({
          numTotalTests: 10,
          numPassedTests: 10,
          coverageMap: {
            'file.js': {
              s: { '1': 1, '2': 1, '3': 0 }
            }
          }
        });
        mockProcess.stdout.on.mock.calls[0][1](Buffer.from(output));
        mockProcess.on.mock.calls.find(c => c[0] === 'close')[1](0);
      }, 50);
      
      await executor.executeJest(testDir);
      
      expect(executor.coverageTrends.totalRuns).toBe(1);
      expect(executor.coverageTrends.coverageHistory).toHaveLength(1);
    });
  });

  describe('Failure Analysis Enhancement', () => {
    beforeEach(async () => {
      await executor.initialize();
    });

    test('should enhance failure analysis with jester insights', async () => {
      const testResult = {
        executionId: 'test-123',
        numFailedTests: 2,
        testResults: [
          {
            testFilePath: 'test.js',
            numFailingTests: 2,
            testResults: [
              {
                title: 'failing test',
                status: 'failed',
                failureMessages: ['Expected true but got false']
              }
            ]
          }
        ],
        jesterAnalysis: {
          failedTests: [
            { name: 'failing test', error: 'assertion', suggestion: 'Check logic' }
          ],
          commonErrors: [
            { type: 'assertion', count: 5 }
          ]
        }
      };
      
      const analysis = await executor.analyzeFailures(testResult);
      
      expect(analysis.byType.assertion).toBeGreaterThan(0);
      expect(analysis.commonPatterns).toContain('Multiple assertion failures detected');
    });
  });

  describe('Report Generation with Jester', () => {
    beforeEach(async () => {
      await executor.initialize();
    });

    test('should include jester analysis in generated report', async () => {
      const result = {
        executionId: 'test-123',
        numTotalTests: 10,
        numPassedTests: 8,
        numFailedTests: 2,
        numPendingTests: 0,
        coverage: {
          global: {
            lines: { pct: 85 },
            statements: { pct: 85 },
            functions: { pct: 90 },
            branches: { pct: 80 }
          }
        },
        executionTime: 1000,
        performance: { executionTime: 1000 },
        jesterAnalysis: {
          summary: { total: 10, passed: 8, failed: 2 },
          suggestions: ['Improve test coverage']
        },
        jesterReport: {
          timestamp: '2024-01-01T00:00:00Z'
        },
        timestamp: Date.now()
      };
      
      const report = await executor.generateReport(result);
      
      expect(report.details).toHaveProperty('failureAnalysis');
      expect(report.details).toHaveProperty('coverageAnalysis');
      expect(report.recommendations).toBeDefined();
    });
  });

  describe('Event Emission', () => {
    beforeEach(async () => {
      await executor.initialize();
    });

    test('should emit jester-specific events', async () => {
      const handlers = {
        sessionStart: jest.fn(),
        testStart: jest.fn(),
        testEnd: jest.fn()
      };
      
      executor.on('jester:sessionStart', handlers.sessionStart);
      executor.on('jester:testStart', handlers.testStart);
      executor.on('jester:testEnd', handlers.testEnd);
      
      // Trigger events through the forwarding mechanism
      const onCalls = executor.jesterIntegration.on.mock.calls;
      
      // Trigger sessionStart
      const sessionStartCall = onCalls.find(c => c[0] === 'jester:sessionStart');
      if (sessionStartCall) {
        sessionStartCall[1]({ sessionId: 'test-session' });
      }
      
      expect(handlers.sessionStart).toHaveBeenCalledWith({
        sessionId: 'test-session',
        executionId: executor.executionId
      });
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should cleanup jester integration on executor cleanup', async () => {
      await executor.initialize();
      
      await executor.cleanup();
      
      expect(executor.jesterIntegration).toBeNull();
      expect(executor.isInitialized).toBe(false);
    });

    test('should handle cleanup errors gracefully', async () => {
      await executor.initialize();
      
      const errorHandler = jest.fn();
      executor.on('cleanup-error', errorHandler);
      
      // Force an error during cleanup
      executor.jesterIntegration.endSession.mockRejectedValueOnce(new Error('Cleanup failed'));
      
      await executor.cleanup();
      
      expect(errorHandler).not.toHaveBeenCalled(); // Errors are handled internally
      expect(executor.isInitialized).toBe(false);
    });
  });
});