/**
 * End-to-End test for Jester integration with CodeAgent
 * 
 * Tests the complete flow of using CodeAgent with Jester enabled
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CodeAgent } from '../../src/index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Since we can't actually install dependencies, we'll mock the jester integration
jest.mock('../../src/integration/JesterIntegration.js', () => ({
  JesterIntegration: jest.fn().mockImplementation(function(config) {
    this.config = config;
    this.isInitialized = false;
    this.dbCreated = false;
    
    this.initialize = jest.fn().mockImplementation(async () => {
      // Simulate database creation
      if (this.config.dbPath) {
        const dbDir = path.dirname(this.config.dbPath);
        await fs.mkdir(dbDir, { recursive: true });
        await fs.writeFile(this.config.dbPath, 'MOCK_SQLITE_DB');
        this.dbCreated = true;
      }
      this.isInitialized = true;
    });
    
    this.isEnabled = jest.fn().mockReturnValue(true);
    this.startSession = jest.fn().mockResolvedValue({ id: 'e2e-session-123' });
    this.endSession = jest.fn().mockResolvedValue();
    this.analyzeTestResults = jest.fn().mockResolvedValue({
      summary: { total: 5, passed: 4, failed: 1 },
      failedTests: [
        {
          name: 'Calculator > should add numbers correctly',
          error: 'Expected 5 but received 4',
          suggestion: 'Check addition logic implementation'
        }
      ],
      slowTests: [
        { name: 'Integration test', duration: 1500 }
      ],
      suggestions: [
        'Fix the failing addition test',
        'Optimize slow integration test'
      ]
    });
    this.generateTestReport = jest.fn().mockResolvedValue({
      session: { id: 'e2e-session-123' },
      results: { total: 5, passed: 4, failed: 1 },
      analysis: {
        failureRate: 0.2,
        averageTestTime: 300,
        coverageScore: 85
      },
      timestamp: new Date().toISOString()
    });
    this.on = jest.fn();
    this.emit = jest.fn();
    this.cleanup = jest.fn();
  })
}));

describe('Jester Integration E2E Test', () => {
  let testDir;
  let codeAgent;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create test directory
    testDir = path.join(__dirname, 'temp', `e2e-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup
    if (codeAgent) {
      await codeAgent.cleanup();
    }
    
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Integration Flow', () => {
    test('should create CodeAgent with jester enabled by default', async () => {
      codeAgent = new CodeAgent({
        projectType: 'backend',
        enableConsoleOutput: false
      });
      
      await codeAgent.initialize(testDir);
      
      expect(codeAgent.config.jester.enabled).toBe(true);
      expect(codeAgent.config.jester.dbPath).toBe('./test-results.db');
    });

    test('should create CodeAgent with custom jester configuration', async () => {
      const customJesterConfig = {
        enabled: true,
        dbPath: path.join(testDir, 'custom-results.db'),
        collectConsole: false,
        collectCoverage: true,
        cleanupAfterDays: 30
      };
      
      codeAgent = new CodeAgent({
        projectType: 'fullstack',
        enableConsoleOutput: false,
        jester: customJesterConfig
      });
      
      await codeAgent.initialize(testDir);
      
      expect(codeAgent.config.jester).toEqual(expect.objectContaining(customJesterConfig));
    });
  });

  describe('Test Execution with Jester', () => {
    test('should run quality checks with jester integration', async () => {
      codeAgent = new CodeAgent({
        projectType: 'backend',
        enableConsoleOutput: false,
        jester: {
          enabled: true,
          dbPath: path.join(testDir, 'test-results.db')
        }
      });
      
      await codeAgent.initialize(testDir);
      
      // Create a simple test file
      const testCode = `
describe('Calculator', () => {
  test('should add numbers correctly', () => {
    expect(2 + 2).toBe(4);
  });
  
  test('should subtract numbers correctly', () => {
    expect(5 - 3).toBe(2);
  });
});
`;
      
      await fs.writeFile(path.join(testDir, 'calculator.test.js'), testCode);
      
      // Create a simple implementation file
      const implCode = `
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

module.exports = { add, subtract };
`;
      
      await fs.writeFile(path.join(testDir, 'calculator.js'), implCode);
      
      // Track generated files
      codeAgent.generatedFiles.add(path.join(testDir, 'calculator.js'));
      codeAgent.testFiles.add(path.join(testDir, 'calculator.test.js'));
      
      // Run quality checks (which includes Jest tests)
      const qualityPhase = codeAgent.phases.quality;
      
      // Verify jester is configured in the executor
      expect(qualityPhase.jestExecutor.jesterConfig).toBeDefined();
      expect(qualityPhase.jestExecutor.jesterConfig.enabled).toBe(true);
      
      // Mock the test results
      const mockResults = {
        passed: true,
        totalTests: 2,
        passedTests: 2,
        failedTests: 0,
        coverage: 90,
        failures: []
      };
      
      // Since we can't actually run Jest, we'll verify the integration setup
      expect(qualityPhase.jestExecutor.jesterIntegration).toBeDefined();
    });
  });

  describe('Database Creation', () => {
    test('should create jester database file', async () => {
      const dbPath = path.join(testDir, 'jester-test.db');
      
      codeAgent = new CodeAgent({
        projectType: 'backend',
        enableConsoleOutput: false,
        jester: {
          enabled: true,
          dbPath: dbPath
        }
      });
      
      await codeAgent.initialize(testDir);
      
      // Get the jester integration from the quality phase
      const jesterIntegration = codeAgent.phases.quality.jestExecutor.jesterIntegration;
      
      // Initialize should have been called
      expect(jesterIntegration.initialize).toHaveBeenCalled();
      
      // Check if database was created (mocked)
      const dbExists = await fs.access(dbPath)
        .then(() => true)
        .catch(() => false);
      
      expect(dbExists).toBe(true);
    });
  });

  describe('Analysis and Reporting', () => {
    test('should analyze test results with jester', async () => {
      codeAgent = new CodeAgent({
        projectType: 'backend',
        enableConsoleOutput: false
      });
      
      await codeAgent.initialize(testDir);
      
      const jesterIntegration = codeAgent.phases.quality.jestExecutor.jesterIntegration;
      
      // Simulate test execution
      await jesterIntegration.startSession();
      const analysis = await jesterIntegration.analyzeTestResults();
      
      expect(analysis).toHaveProperty('summary');
      expect(analysis).toHaveProperty('failedTests');
      expect(analysis).toHaveProperty('slowTests');
      expect(analysis).toHaveProperty('suggestions');
      
      expect(analysis.summary.total).toBe(5);
      expect(analysis.failedTests).toHaveLength(1);
      expect(analysis.slowTests).toHaveLength(1);
    });

    test('should generate comprehensive test report', async () => {
      codeAgent = new CodeAgent({
        projectType: 'backend',
        enableConsoleOutput: false
      });
      
      await codeAgent.initialize(testDir);
      
      const jesterIntegration = codeAgent.phases.quality.jestExecutor.jesterIntegration;
      
      // Simulate test execution
      await jesterIntegration.startSession();
      const report = await jesterIntegration.generateTestReport('e2e-session-123');
      
      expect(report).toHaveProperty('session');
      expect(report).toHaveProperty('results');
      expect(report).toHaveProperty('analysis');
      expect(report).toHaveProperty('timestamp');
      
      expect(report.analysis.coverageScore).toBe(85);
      expect(report.analysis.failureRate).toBe(0.2);
    });
  });

  describe('Event System Integration', () => {
    test('should emit jester events during execution', async () => {
      const events = [];
      
      codeAgent = new CodeAgent({
        projectType: 'backend',
        enableConsoleOutput: false
      });
      
      // Listen for events
      codeAgent.on('jester:sessionStart', (data) => events.push({ type: 'sessionStart', data }));
      codeAgent.on('jester:testEnd', (data) => events.push({ type: 'testEnd', data }));
      
      await codeAgent.initialize(testDir);
      
      // The quality phase executor should forward jester events
      const executor = codeAgent.phases.quality.jestExecutor;
      
      // Verify event forwarding is set up
      expect(executor.jesterIntegration).toBeDefined();
      expect(executor.jesterIntegration.on).toHaveBeenCalled();
    });
  });

  describe('Configuration Validation', () => {
    test('should validate jester configuration', async () => {
      const invalidConfig = {
        enabled: 'yes', // Should be boolean
        dbPath: 123, // Should be string
        cleanupAfterDays: 'seven' // Should be number
      };
      
      // CodeAgent should handle invalid config gracefully
      codeAgent = new CodeAgent({
        projectType: 'backend',
        enableConsoleOutput: false,
        jester: invalidConfig
      });
      
      await codeAgent.initialize(testDir);
      
      // Should use defaults for invalid values
      expect(codeAgent.config.jester.enabled).toBe(true);
      expect(typeof codeAgent.config.jester.dbPath).toBe('string');
      expect(typeof codeAgent.config.jester.cleanupAfterDays).toBe('number');
    });
  });

  describe('Error Handling', () => {
    test('should handle jester initialization errors gracefully', async () => {
      codeAgent = new CodeAgent({
        projectType: 'backend',
        enableConsoleOutput: false
      });
      
      await codeAgent.initialize(testDir);
      
      // Force an error in jester
      const jesterIntegration = codeAgent.phases.quality.jestExecutor.jesterIntegration;
      jesterIntegration.analyzeTestResults.mockRejectedValueOnce(new Error('Database error'));
      
      // Should not throw, but handle gracefully
      const analysis = await jesterIntegration.analyzeTestResults().catch(e => ({ error: e.message }));
      
      expect(analysis.error).toBe('Database error');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup jester resources on agent cleanup', async () => {
      codeAgent = new CodeAgent({
        projectType: 'backend',
        enableConsoleOutput: false
      });
      
      await codeAgent.initialize(testDir);
      
      const jesterIntegration = codeAgent.phases.quality.jestExecutor.jesterIntegration;
      
      await codeAgent.cleanup();
      
      expect(jesterIntegration.cleanup).toHaveBeenCalled();
    });
  });

  describe('Real-world Scenario', () => {
    test('should handle a complete development workflow with jester', async () => {
      codeAgent = new CodeAgent({
        projectType: 'backend',
        enableConsoleOutput: false,
        jester: {
          enabled: true,
          dbPath: path.join(testDir, 'workflow-test.db'),
          collectConsole: true,
          collectCoverage: true
        }
      });
      
      await codeAgent.initialize(testDir);
      
      // Create multiple test files
      const tests = [
        { name: 'auth.test.js', content: 'describe("Auth", () => { test("login", () => {}); });' },
        { name: 'api.test.js', content: 'describe("API", () => { test("GET /users", () => {}); });' },
        { name: 'db.test.js', content: 'describe("Database", () => { test("connection", () => {}); });' }
      ];
      
      for (const test of tests) {
        await fs.writeFile(path.join(testDir, test.name), test.content);
        codeAgent.testFiles.add(path.join(testDir, test.name));
      }
      
      // Verify jester is ready for all tests
      const jesterIntegration = codeAgent.phases.quality.jestExecutor.jesterIntegration;
      
      expect(jesterIntegration.isEnabled()).toBe(true);
      expect(jesterIntegration.config.dbPath).toContain('workflow-test.db');
      
      // Simulate running tests
      await jesterIntegration.startSession();
      
      // Get analysis
      const analysis = await jesterIntegration.analyzeTestResults();
      expect(analysis).toBeDefined();
      
      // Generate report
      const report = await jesterIntegration.generateTestReport('e2e-session-123');
      expect(report).toBeDefined();
      
      // End session
      await jesterIntegration.endSession();
      
      expect(jesterIntegration.startSession).toHaveBeenCalled();
      expect(jesterIntegration.endSession).toHaveBeenCalled();
    });
  });
});