/**
 * Live integration tests for Jester Module
 * Tests actual module loading and tool execution
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager, ModuleFactory } from '@legion/module-loader';
import { JesterModule } from '../../jester/src/JesterModule.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Live Jester Module Tests', () => {
  let resourceManager;
  let moduleFactory;
  let jesterModule;
  let testDir;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create module factory
    moduleFactory = new ModuleFactory(resourceManager);

    // Create test directory
    testDir = path.join(tmpdir(), `jester-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create and initialize Jester Module
    jesterModule = await JesterModule.create(resourceManager);
  }, 30000); // Longer timeout for initialization

  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error.message);
    }

    // Cleanup Jester module
    if (jesterModule) {
      await jesterModule.cleanup();
    }
  });

  describe('Module Loading', () => {
    test('should load JesterModule with proper name and initialization', () => {
      expect(jesterModule).toBeDefined();
      expect(jesterModule.name).toBe('JesterModule');
      expect(jesterModule.initialized).toBe(true);
      expect(jesterModule.description).toContain('Advanced Jest testing');
    });

    test('should have all expected tools', () => {
      const tools = jesterModule.getTools();
      expect(tools).toBeDefined();
      expect(tools.length).toBe(6);

      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('run_tests');
      expect(toolNames).toContain('analyze_failures');
      expect(toolNames).toContain('get_test_history');
      expect(toolNames).toContain('search_logs');
      expect(toolNames).toContain('get_slowest_tests');
      expect(toolNames).toContain('get_common_errors');
    });

    test('should provide module metadata', () => {
      const metadata = jesterModule.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('JesterModule');
      expect(metadata.tools).toBe(6);
      expect(metadata.capabilities).toContain('Advanced Jest test execution');
      expect(metadata.capabilities).toContain('TDD cycle analysis');
    });
  });

  describe('RunTestsTool', () => {
    let runTestsTool;

    beforeAll(() => {
      runTestsTool = jesterModule.getTool('run_tests');
      expect(runTestsTool).toBeDefined();
    });

    test('should execute basic test run', async () => {
      // Create a simple test file
      const testFilePath = path.join(testDir, 'sample.test.js');
      await fs.writeFile(testFilePath, `
        const { describe, test, expect } = require('@jest/globals');
        
        describe('Sample Test', () => {
          test('should pass', () => {
            expect(1 + 1).toBe(2);
          });
          
          test('should also pass', () => {
            expect('hello').toBe('hello');
          });
        });
      `);

      const result = await runTestsTool.execute({
        pattern: testFilePath,
        config: {
          verbose: true,
          collectCoverage: false
        }
      });

      expect(result).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.totalTests).toBeGreaterThanOrEqual(0);
      expect(typeof result.summary.success).toBe('boolean');
    }, 15000);

    test('should handle test run with coverage', async () => {
      const result = await runTestsTool.execute({
        config: {
          collectCoverage: true,
          verbose: false
        }
      });

      expect(result).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.summary).toBeDefined();
      // Coverage might be included if enabled
      if (result.coverage) {
        expect(typeof result.coverage).toBe('object');
      }
    }, 15000);
  });

  describe('AnalyzeFailuresTool', () => {
    let analyzeFailuresTool;

    beforeAll(() => {
      analyzeFailuresTool = jesterModule.getTool('analyze_failures');
      expect(analyzeFailuresTool).toBeDefined();
    });

    test('should analyze test failures and provide TDD insights', async () => {
      const result = await analyzeFailuresTool.execute({
        // Use latest session if no sessionId provided
      });

      expect(result).toBeDefined();
      expect(result.status).toMatch(/green|red/);
      expect(typeof result.failures).toBe('number');
      expect(result.errorSummary).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
      expect(Array.isArray(result.nextActions)).toBe(true);
      expect(Array.isArray(result.detailedFailures)).toBe(true);
    }, 10000);

    test('should handle analysis with specific session ID', async () => {
      // First run a test to get a session ID
      const runTestsTool = jesterModule.getTool('run_tests');
      const testResult = await runTestsTool.execute({
        config: { verbose: false }
      });

      const result = await analyzeFailuresTool.execute({
        sessionId: testResult.sessionId
      });

      expect(result).toBeDefined();
      expect(result.status).toMatch(/green|red/);
    }, 15000);
  });

  describe('GetTestHistoryTool', () => {
    let getTestHistoryTool;

    beforeAll(() => {
      getTestHistoryTool = jesterModule.getTool('get_test_history');
      expect(getTestHistoryTool).toBeDefined();
    });

    test('should get test history for a specific test', async () => {
      const result = await getTestHistoryTool.execute({
        testName: 'Sample Test should pass'
      });

      expect(result).toBeDefined();
      expect(typeof result.totalRuns).toBe('number');
      expect(typeof result.successRate).toBe('number');
      expect(typeof result.averageDuration).toBe('number');
      expect(typeof result.trend).toBe('string');
      expect(typeof result.recommendation).toBe('string');
    }, 10000);
  });

  describe('SearchLogsTool', () => {
    let searchLogsTool;

    beforeAll(() => {
      searchLogsTool = jesterModule.getTool('search_logs');
      expect(searchLogsTool).toBeDefined();
    });

    test('should search through test logs', async () => {
      const result = await searchLogsTool.execute({
        query: 'test'
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
      expect(typeof result.totalMatches).toBe('number');
    }, 10000);

    test('should search logs with session filter', async () => {
      // Run a test first to generate logs
      const runTestsTool = jesterModule.getTool('run_tests');
      const testResult = await runTestsTool.execute({
        config: { verbose: true }
      });

      const result = await searchLogsTool.execute({
        query: 'jest',
        sessionId: testResult.sessionId
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
      expect(typeof result.totalMatches).toBe('number');
    }, 15000);
  });

  describe('GetSlowestTestsTool', () => {
    let getSlowestTestsTool;

    beforeAll(() => {
      getSlowestTestsTool = jesterModule.getTool('get_slowest_tests');
      expect(getSlowestTestsTool).toBeDefined();
    });

    test('should get slowest tests with default limit', async () => {
      const result = await getSlowestTestsTool.execute({});

      expect(result).toBeDefined();
      expect(Array.isArray(result.tests)).toBe(true);
      expect(result.tests.length).toBeLessThanOrEqual(10); // Default limit
    }, 10000);

    test('should get slowest tests with custom limit', async () => {
      const result = await getSlowestTestsTool.execute({
        limit: 5
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.tests)).toBe(true);
      expect(result.tests.length).toBeLessThanOrEqual(5);
    }, 10000);
  });

  describe('GetCommonErrorsTool', () => {
    let getCommonErrorsTool;

    beforeAll(() => {
      getCommonErrorsTool = jesterModule.getTool('get_common_errors');
      expect(getCommonErrorsTool).toBeDefined();
    });

    test('should get common errors with default limit', async () => {
      const result = await getCommonErrorsTool.execute({});

      expect(result).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeLessThanOrEqual(10); // Default limit
    }, 10000);

    test('should get common errors with custom limit', async () => {
      const result = await getCommonErrorsTool.execute({
        limit: 3
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeLessThanOrEqual(3);
    }, 10000);
  });

  describe('End-to-End Testing Workflow', () => {
    test('should support complete TDD workflow', async () => {
      // 1. Run tests
      const runTestsTool = jesterModule.getTool('run_tests');
      const testResult = await runTestsTool.execute({
        config: {
          verbose: true,
          collectCoverage: true
        }
      });

      expect(testResult.sessionId).toBeDefined();

      // 2. Analyze failures
      const analyzeFailuresTool = jesterModule.getTool('analyze_failures');
      const analysis = await analyzeFailuresTool.execute({
        sessionId: testResult.sessionId
      });

      expect(analysis.status).toMatch(/green|red/);

      // 3. Get performance data
      const getSlowestTestsTool = jesterModule.getTool('get_slowest_tests');
      const slowTests = await getSlowestTestsTool.execute({ limit: 5 });

      expect(Array.isArray(slowTests.tests)).toBe(true);

      // 4. Search for specific information
      const searchLogsTool = jesterModule.getTool('search_logs');
      const searchResults = await searchLogsTool.execute({
        query: 'pass',
        sessionId: testResult.sessionId
      });

      expect(Array.isArray(searchResults.matches)).toBe(true);

      // 5. Get error patterns
      const getCommonErrorsTool = jesterModule.getTool('get_common_errors');
      const errors = await getCommonErrorsTool.execute({ limit: 5 });

      expect(Array.isArray(errors.errors)).toBe(true);
    }, 30000);
  });

  describe('Error Handling', () => {
    test('should handle invalid test patterns gracefully', async () => {
      const runTestsTool = jesterModule.getTool('run_tests');
      
      try {
        const result = await runTestsTool.execute({
          pattern: '/nonexistent/path/**/*.test.js',
          config: { verbose: false }
        });
        
        // Should still return a valid result even if no tests found
        expect(result).toBeDefined();
        expect(result.sessionId).toBeDefined();
      } catch (error) {
        // Or should handle error gracefully
        expect(error.message).toBeDefined();
      }
    }, 10000);

    test('should handle invalid search queries', async () => {
      const searchLogsTool = jesterModule.getTool('search_logs');
      
      const result = await searchLogsTool.execute({
        query: 'nonexistent_unique_string_12345'
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
      expect(result.totalMatches).toBe(0);
    });
  });
});