/**
 * Comprehensive tests for the unified 2-tool design of JesterModule
 * Tests both run_jest_tests and query_jest_results tools with proper Tool wrapper handling
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { JesterModule } from '../../src/JesterModule.js';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';

describe('Unified Tools Design', () => {
  let module;
  let runTestsTool;
  let queryTool;
  let testDbPath;

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    testDbPath = TestDbHelper.getTempDbPath('unified-tools');
    
    // Create module with test database
    module = new JesterModule();
    await module.initialize();
    
    // Override the database path for testing
    module.jestWrapper.config.dbPath = testDbPath;
    module.jestWrapper.storage = new (await import('../../src/storage/StorageEngine.js')).StorageEngine(testDbPath);
    module.jestWrapper.query = new (await import('../../src/storage/QueryEngine.js')).QueryEngine(module.jestWrapper.storage);
    await module.jestWrapper.storage.initialize();
    
    // Get the tools
    const tools = module.getTools();
    runTestsTool = tools.find(t => t.name === 'run_jest_tests');
    queryTool = tools.find(t => t.name === 'query_jest_results');
  });

  afterEach(async () => {
    if (module) {
      await module.cleanup();
      // Small delay to ensure cleanup completes before next test
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    await cleanupTestDb(testDbPath);
  });

  describe('Tool Initialization', () => {
    test('should have exactly 2 tools', () => {
      const tools = module.getTools();
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toEqual(['run_jest_tests', 'query_jest_results']);
    });

    test('should initialize tools with proper metadata', () => {
      expect(runTestsTool).toBeDefined();
      expect(queryTool).toBeDefined();
      
      expect(runTestsTool.name).toBe('run_jest_tests');
      expect(queryTool.name).toBe('query_jest_results');
      
      expect(runTestsTool.description).toContain('Execute Jest tests');
      expect(queryTool.description).toContain('Query, analyze, and report');
    });
  });

  describe('run_jest_tests Tool', () => {
    test('should have comprehensive LLM-friendly description', () => {
      expect(runTestsTool.description).toContain('WHEN TO USE');
      expect(runTestsTool.description).toContain('EXAMPLES');
      expect(runTestsTool.description).toContain('WORKFLOW TIP');
      expect(runTestsTool.description).toContain('Execute Jest tests');
      expect(runTestsTool.description).toContain('session management');
    });

    test('should execute with minimal parameters', async () => {
      const response = await runTestsTool.execute({});
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('sessionId');
      expect(response.data).toHaveProperty('projectPath');
      expect(response.data).toHaveProperty('summary');
      expect(response.data.summary).toHaveProperty('total');
      expect(response.data.summary).toHaveProperty('passed');
      expect(response.data.summary).toHaveProperty('failed');
      expect(response.data.summary).toHaveProperty('success');
      expect(response.data).toHaveProperty('failedTests');
      expect(Array.isArray(response.data.failedTests)).toBe(true);
    });

    test('should handle custom testRunId', async () => {
      const testRunId = 'custom-test-run-123';
      const response = await runTestsTool.execute({
        testRunId: testRunId
      });
      
      expect(response.success).toBe(true);
      expect(response.data.sessionId).toBe(testRunId);
    });

    test('should clear previous data when requested', async () => {
      // Create first session
      await runTestsTool.execute({ testRunId: 'first-session' });
      
      // Clear and create second session
      await runTestsTool.execute({
        testRunId: 'second-session',
        clearPrevious: true
      });
      
      // Verify only second session exists
      const sessions = await module.jestWrapper.getAllSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].id).toBe('second-session');
    });

    test('should preserve history by default', async () => {
      // Create multiple sessions
      await runTestsTool.execute({ testRunId: 'session-1' });
      await runTestsTool.execute({ testRunId: 'session-2' });
      await runTestsTool.execute({ testRunId: 'session-3' });
      
      // Verify all sessions exist
      const sessions = await module.jestWrapper.getAllSessions();
      expect(sessions.length).toBe(3);
      const sessionIds = sessions.map(s => s.id);
      expect(sessionIds).toContain('session-1');
      expect(sessionIds).toContain('session-2');
      expect(sessionIds).toContain('session-3');
    });

    test('should handle coverage configuration', async () => {
      const response = await runTestsTool.execute({
        testRunId: 'coverage-test',
        config: {
          collectCoverage: true
        }
      });
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('coverage');
      if (response.data.coverage) {
        expect(response.data.coverage).toHaveProperty('lines');
        expect(response.data.coverage).toHaveProperty('statements');
        expect(response.data.coverage).toHaveProperty('functions');
        expect(response.data.coverage).toHaveProperty('branches');
      }
    });

    test('should handle custom project path', async () => {
      const customPath = process.cwd();
      const response = await runTestsTool.execute({
        projectPath: customPath,
        testRunId: 'path-test'
      });
      
      expect(response.success).toBe(true);
      expect(response.data.projectPath).toBe(customPath);
    });

    test('should handle test pattern filtering', async () => {
      const response = await runTestsTool.execute({
        pattern: '**/*.test.js',
        testRunId: 'pattern-test'
      });
      
      expect(response.success).toBe(true);
      expect(response.data.sessionId).toBe('pattern-test');
    });

    test('should handle Jest configuration options', async () => {
      const response = await runTestsTool.execute({
        testRunId: 'config-test',
        config: {
          verbose: true,
          bail: false,
          maxWorkers: 1
        }
      });
      
      expect(response.success).toBe(true);
      expect(response.data.sessionId).toBe('config-test');
    });
  });

  describe('query_jest_results Tool', () => {
    beforeEach(async () => {
      // Create test data for query tests
      await runTestsTool.execute({ testRunId: 'query-test-session' });
      
      // Create some test results manually for more predictable testing
      await module.jestWrapper.storage.storeSuite({
        id: 'test-suite-1',
        sessionId: 'query-test-session',
        path: '/test/example.test.js',
        name: 'Example Tests',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed'
      });
      
      // Create passing test
      await module.jestWrapper.storage.storeTestCase({
        id: 'test-pass-1',
        sessionId: 'query-test-session',
        suiteId: 'test-suite-1',
        name: 'should pass',
        fullName: 'Example Tests > should pass',
        startTime: new Date(),
        endTime: new Date(),
        status: 'passed',
        duration: 100
      });
      
      // Create failing test
      await module.jestWrapper.storage.storeTestCase({
        id: 'test-fail-1',
        sessionId: 'query-test-session',
        suiteId: 'test-suite-1',
        name: 'should fail',
        fullName: 'Example Tests > should fail',
        startTime: new Date(),
        endTime: new Date(),
        status: 'failed',
        duration: 200
      });
      
      // Create slow test for performance analysis
      await module.jestWrapper.storage.storeTestCase({
        id: 'test-slow-1',
        sessionId: 'query-test-session',
        suiteId: 'test-suite-1',
        name: 'should be slow',
        fullName: 'Example Tests > should be slow',
        startTime: new Date(),
        endTime: new Date(),
        status: 'passed',
        duration: 5500 // Slow test
      });
    });

    test('should have comprehensive LLM-friendly description', () => {
      expect(queryTool.description).toContain('WHEN TO USE');
      expect(queryTool.description).toContain('EXAMPLES');
      expect(queryTool.description).toContain('WORKFLOW TIP');
      expect(queryTool.description).toContain('Query, analyze, and report');
      expect(queryTool.description).toContain('failures');
      expect(queryTool.description).toContain('performance');
    });

    test('should query failures', async () => {
      const response = await queryTool.execute({
        queryType: 'failures',
        sessionId: 'query-test-session'
      });
      
      expect(response.success).toBe(true);
      expect(response.data.queryType).toBe('failures');
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('totalFailures');
      expect(response.data.data).toHaveProperty('status');
      expect(response.data).toHaveProperty('insights');
      expect(response.data.insights).toHaveProperty('summary');
      expect(response.data.insights).toHaveProperty('recommendations');
      expect(response.data.insights).toHaveProperty('priority');
    });

    test('should generate JSON report', async () => {
      const response = await queryTool.execute({
        queryType: 'report',
        sessionId: 'query-test-session',
        format: 'json'
      });
      
      expect(response.success).toBe(true);
      expect(response.data.queryType).toBe('report');
      expect(response.data.data).toHaveProperty('content');
      expect(response.data.data).toHaveProperty('summary');
      expect(response.data.insights.summary).toContain('Test report generated');
    });

    test('should generate markdown report', async () => {
      const response = await queryTool.execute({
        queryType: 'report',
        sessionId: 'query-test-session',
        format: 'markdown'
      });
      
      expect(response.success).toBe(true);
      expect(response.data.queryType).toBe('report');
      expect(typeof response.data.data).toBe('string');
      expect(response.data.data).toContain('#'); // Markdown headers
    });

    test('should list sessions', async () => {
      // Create additional sessions
      await runTestsTool.execute({ testRunId: 'list-session-1' });
      await runTestsTool.execute({ testRunId: 'list-session-2' });
      
      const response = await queryTool.execute({
        queryType: 'sessions',
        limit: 10
      });
      
      expect(response.success).toBe(true);
      expect(response.data.queryType).toBe('sessions');
      expect(response.data.data.totalSessions).toBeGreaterThanOrEqual(3);
      expect(Array.isArray(response.data.data.sessions)).toBe(true);
      expect(response.data.insights.summary).toContain('test session(s)');
    });

    test('should compare sessions', async () => {
      await runTestsTool.execute({ testRunId: 'compare-session-1' });
      await runTestsTool.execute({ testRunId: 'compare-session-2' });
      
      const response = await queryTool.execute({
        queryType: 'comparison',
        sessionIds: ['compare-session-1', 'compare-session-2']
      });
      
      expect(response.success).toBe(true);
      expect(response.data.queryType).toBe('comparison');
      expect(response.data.data).toHaveProperty('sessions');
      expect(response.data.data).toHaveProperty('delta');
      expect(response.data.data).toHaveProperty('regressions');
      expect(response.data.data).toHaveProperty('improvements');
    });

    test('should analyze trends for specific test', async () => {
      const response = await queryTool.execute({
        queryType: 'trends',
        testName: 'Example Tests > should pass',
        sessionId: 'query-test-session',
        limit: 5
      });
      
      expect(response.success).toBe(true);
      expect(response.data.queryType).toBe('trends');
      expect(response.data.data).toHaveProperty('testName');
      expect(response.data.data).toHaveProperty('history');
      expect(response.data.data).toHaveProperty('pattern');
      expect(response.data.data).toHaveProperty('flakiness');
    });

    test('should search logs', async () => {
      // Store some logs
      await module.jestWrapper.storage.storeLog({
        sessionId: 'query-test-session',
        testId: 'test-fail-1',
        timestamp: new Date(),
        level: 'error',
        message: 'Test error occurred during execution',
        source: 'test',
        metadata: {}
      });
      
      const response = await queryTool.execute({
        queryType: 'logs',
        sessionId: 'query-test-session',
        searchQuery: 'error',
        limit: 10
      });
      
      expect(response.success).toBe(true);
      expect(response.data.queryType).toBe('logs');
      expect(response.data.data).toHaveProperty('totalMatches');
      expect(response.data.data).toHaveProperty('logs');
      expect(response.data.data).toHaveProperty('searchQuery');
      expect(response.data.data.searchQuery).toBe('error');
    });

    test('should analyze performance', async () => {
      const response = await queryTool.execute({
        queryType: 'performance',
        sessionId: 'query-test-session',
        limit: 5
      });
      
      expect(response.success).toBe(true);
      expect(response.data.queryType).toBe('performance');
      expect(response.data.data).toHaveProperty('slowestTests');
      expect(response.data.data).toHaveProperty('bottlenecks');
      expect(response.data.data).toHaveProperty('recommendations');
      expect(response.data.insights).toHaveProperty('summary');
    });

    test('should use latest session when sessionId not specified', async () => {
      await runTestsTool.execute({ testRunId: 'latest-session' });
      
      const response = await queryTool.execute({
        queryType: 'failures'
        // No sessionId specified
      });
      
      expect(response.success).toBe(true);
      expect(response.data.sessionId).toBe('latest-session');
    });

    test('should handle no sessions gracefully', async () => {
      // Clear all sessions
      await module.jestWrapper.clearAllSessions();
      
      const response = await queryTool.execute({
        queryType: 'failures'
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('No test sessions found');
    });

    test('should handle invalid queryType with validation error', async () => {
      const response = await queryTool.execute({
        queryType: 'invalid-type'
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Validation failed');
      expect(response.error).toContain('invalid-type');
    });

    test('should require sessionIds for comparison', async () => {
      const response = await queryTool.execute({
        queryType: 'comparison'
        // No sessionIds provided
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('at least 2 session IDs');
    });

    test('should handle format parameter', async () => {
      const jsonResponse = await queryTool.execute({
        queryType: 'report',
        sessionId: 'query-test-session',
        format: 'json'
      });
      
      const markdownResponse = await queryTool.execute({
        queryType: 'report',
        sessionId: 'query-test-session',
        format: 'markdown'
      });
      
      expect(jsonResponse.success).toBe(true);
      expect(markdownResponse.success).toBe(true);
      
      expect(typeof jsonResponse.data.data).toBe('object');
      expect(typeof markdownResponse.data.data).toBe('string');
    });

    test('should handle limit parameter', async () => {
      const response = await queryTool.execute({
        queryType: 'sessions',
        limit: 2
      });
      
      expect(response.success).toBe(true);
      expect(response.data.data.sessions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Memory Management Integration', () => {
    test('should support database info queries', async () => {
      await runTestsTool.execute({ testRunId: 'memory-test' });
      
      const info = await module.jestWrapper.getDatabaseInfo();
      
      expect(info).toHaveProperty('sessionCount');
      expect(info).toHaveProperty('databasePath');
      expect(info).toHaveProperty('sizeInBytes');
      expect(info).toHaveProperty('sizeInMB');
      expect(info).toHaveProperty('oldestSession');
      expect(info).toHaveProperty('newestSession');
      
      expect(info.sessionCount).toBeGreaterThan(0);
    });

    test('should support session cleanup', async () => {
      // Create multiple sessions
      for (let i = 1; i <= 5; i++) {
        await runTestsTool.execute({ testRunId: `cleanup-session-${i}` });
      }
      
      // Prune to keep only 3
      const deletedCount = await module.jestWrapper.pruneSessions(3);
      
      expect(deletedCount).toBe(2);
      
      const sessions = await module.jestWrapper.getAllSessions();
      expect(sessions.length).toBe(3);
    });

    test('should support old session clearing', async () => {
      // Create old session
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);
      
      await module.jestWrapper.storage.storeSession({
        id: 'old-session',
        startTime: oldDate,
        endTime: oldDate,
        status: 'completed',
        jestConfig: {},
        environment: {},
        summary: {},
        metadata: {}
      });
      
      // Create recent session
      await runTestsTool.execute({ testRunId: 'recent-session' });
      
      // Clear old sessions
      const deletedCount = await module.jestWrapper.clearOldSessions(30);
      
      expect(deletedCount).toBe(1);
      
      const sessions = await module.jestWrapper.getAllSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].id).toBe('recent-session');
    });
  });

  describe('Tool Integration Workflows', () => {
    test('should support TDD cycle workflow', async () => {
      // Step 1: Run tests (red phase)
      const redPhaseResponse = await runTestsTool.execute({
        testRunId: 'tdd-red',
        pattern: 'src/**/*.test.js'
      });
      
      expect(redPhaseResponse.success).toBe(true);
      
      // Step 2: Query failures
      const failuresResponse = await queryTool.execute({
        queryType: 'failures',
        sessionId: 'tdd-red'
      });
      
      expect(failuresResponse.success).toBe(true);
      expect(failuresResponse.data.data).toHaveProperty('status');
      expect(failuresResponse.data.data).toHaveProperty('suggestions');
      expect(failuresResponse.data.data).toHaveProperty('nextActions');
      
      // Step 3: Run tests again (green phase)
      const greenPhaseResponse = await runTestsTool.execute({
        testRunId: 'tdd-green',
        pattern: 'src/**/*.test.js'
      });
      
      expect(greenPhaseResponse.success).toBe(true);
      
      // Step 4: Compare runs
      const comparisonResponse = await queryTool.execute({
        queryType: 'comparison',
        sessionIds: ['tdd-red', 'tdd-green']
      });
      
      expect(comparisonResponse.success).toBe(true);
      expect(comparisonResponse.data.data).toHaveProperty('delta');
      expect(comparisonResponse.data.insights).toHaveProperty('recommendations');
    });

    test('should support debugging workflow', async () => {
      // Step 1: Run tests
      const runResponse = await runTestsTool.execute({
        testRunId: 'debug-session',
        config: { verbose: true }
      });
      
      expect(runResponse.success).toBe(true);
      
      // Step 2: Search logs for errors
      const logsResponse = await queryTool.execute({
        queryType: 'logs',
        sessionId: 'debug-session',
        searchQuery: 'error'
      });
      
      expect(logsResponse.success).toBe(true);
      
      // Step 3: Get performance metrics
      const perfResponse = await queryTool.execute({
        queryType: 'performance',
        sessionId: 'debug-session'
      });
      
      expect(perfResponse.success).toBe(true);
      
      // Step 4: Generate report
      const reportResponse = await queryTool.execute({
        queryType: 'report',
        sessionId: 'debug-session',
        format: 'markdown'
      });
      
      expect(reportResponse.success).toBe(true);
      expect(typeof reportResponse.data.data).toBe('string');
    });

    test('should support CI monitoring workflow', async () => {
      // Create historical runs
      await runTestsTool.execute({ testRunId: 'ci-run-1' });
      await runTestsTool.execute({ testRunId: 'ci-run-2' });
      await runTestsTool.execute({ testRunId: 'ci-run-3' });
      
      // Monitor sessions
      const sessionsResponse = await queryTool.execute({
        queryType: 'sessions',
        limit: 10
      });
      
      expect(sessionsResponse.success).toBe(true);
      expect(sessionsResponse.data.data.totalSessions).toBeGreaterThanOrEqual(3);
      
      // Compare stability
      const comparisonResponse = await queryTool.execute({
        queryType: 'comparison',
        sessionIds: ['ci-run-1', 'ci-run-2', 'ci-run-3']
      });
      
      expect(comparisonResponse.success).toBe(true);
      expect(comparisonResponse.data.data.sessions.length).toBe(3);
    });
  });

  describe('Error Handling', () => {
    test('should handle tool execution errors gracefully', async () => {
      // Test with invalid configuration
      const response = await runTestsTool.execute({
        testRunId: 'error-test',
        config: {
          // Invalid configuration that might cause issues
          maxWorkers: -1
        }
      });
      
      // Should handle gracefully - either succeed or fail with proper error
      expect(response).toHaveProperty('success');
      if (!response.success) {
        expect(response.data).toHaveProperty('errorMessage');
      }
    });

    test('should handle query tool validation errors', async () => {
      const response = await queryTool.execute({
        // Missing required queryType
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Validation failed');
    });

    test('should handle missing session errors', async () => {
      const response = await queryTool.execute({
        queryType: 'failures',
        sessionId: 'non-existent-session'
      });
      
      // Query should succeed but return empty results for non-existent session
      expect(response.success).toBe(true);
      
      // The actual data is nested in response.data.data
      expect(response.data).toBeDefined();
      expect(response.data.data).toBeDefined();
      expect(response.data.data.totalFailures).toBe(0);
      expect(Array.isArray(response.data.data.failures)).toBe(true);
      expect(response.data.data.failures).toEqual([]);
      expect(response.data.data.status).toBe('green');
    });
  });

  describe('Tool Metadata', () => {
    test('should provide comprehensive tool metadata', () => {
      const runMetadata = runTestsTool.getMetadata();
      const queryMetadata = queryTool.getMetadata();
      
      expect(runMetadata).toHaveProperty('description');
      expect(runMetadata).toHaveProperty('input');
      expect(runMetadata).toHaveProperty('output');
      
      expect(queryMetadata).toHaveProperty('description');
      expect(queryMetadata).toHaveProperty('input');
      expect(queryMetadata).toHaveProperty('output');
    });

    test('should support tool parameter validation', async () => {
      // Test with invalid enum value
      const response = await queryTool.execute({
        queryType: 'invalid-enum-value'
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('Validation failed');
    });
  });
});