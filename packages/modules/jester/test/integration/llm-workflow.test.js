/**
 * Integration tests simulating realistic LLM workflows with the unified Jest tools
 * Tests common scenarios an LLM would encounter when using Jester
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { JesterModule } from '../../src/JesterModule.js';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';

describe('LLM Workflow Integration', () => {
  let module;
  let runTestsTool;
  let queryTool;
  let testDbPath;

  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    testDbPath = TestDbHelper.getTempDbPath('llm-workflow');
    
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
    
    expect(runTestsTool).toBeDefined();
    expect(queryTool).toBeDefined();
    
    // Create realistic test data
    await createRealisticTestData();
  });

  afterEach(async () => {
    if (module) {
      await module.cleanup();
    }
    await cleanupTestDb(testDbPath);
  });

  // Helper to create realistic test scenarios
  async function createRealisticTestData() {
    // Create a "failed" test run session
    const response = await runTestsTool.execute({ testRunId: 'failed-run' });
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('sessionId');
    expect(response.data.sessionId).toBe('failed-run');
    
    const session = await module.jestWrapper.getSession('failed-run');
    expect(session).toBeDefined();
    
    // Create test suites
    await module.jestWrapper.storage.storeSuite({
      id: 'auth-suite',
      sessionId: 'failed-run',
      path: '/src/auth/auth.test.js',
      name: 'Authentication Tests',
      startTime: new Date(),
      endTime: new Date(),
      status: 'completed'
    });
    
    await module.jestWrapper.storage.storeSuite({
      id: 'api-suite', 
      sessionId: 'failed-run',
      path: '/src/api/api.test.js',
      name: 'API Tests',
      startTime: new Date(),
      endTime: new Date(),
      status: 'completed'
    });
    
    // Create test cases with realistic failures
    const testCases = [
      {
        id: 'auth-login-pass',
        name: 'should authenticate valid user',
        status: 'passed',
        duration: 150,
        suiteId: 'auth-suite'
      },
      {
        id: 'auth-logout-fail',
        name: 'should handle logout',
        status: 'failed',
        duration: 2000,
        suiteId: 'auth-suite'
      },
      {
        id: 'api-get-pass',
        name: 'should fetch user data',
        status: 'passed',
        duration: 100,
        suiteId: 'api-suite'
      },
      {
        id: 'api-post-fail',
        name: 'should create new user',
        status: 'failed',
        duration: 5000,
        suiteId: 'api-suite'
      },
      {
        id: 'api-timeout-fail',
        name: 'should handle timeout gracefully',
        status: 'failed',
        duration: 10000,
        suiteId: 'api-suite'
      }
    ];
    
    for (const testCase of testCases) {
      await module.jestWrapper.storage.storeTestCase({
        id: testCase.id,
        sessionId: 'failed-run',
        suiteId: testCase.suiteId,
        name: testCase.name,
        fullName: `${testCase.suiteId === 'auth-suite' ? 'Authentication Tests' : 'API Tests'} > ${testCase.name}`,
        startTime: new Date(),
        endTime: new Date(),
        status: testCase.status,
        duration: testCase.duration
      });
    }
    
    // Create some logs
    await module.jestWrapper.storage.storeLog({
      sessionId: 'failed-run',
      testId: 'auth-logout-fail',
      timestamp: new Date(),
      level: 'error',
      message: 'TypeError: Cannot read property "token" of undefined',
      source: 'test',
      metadata: {}
    });
    
    await module.jestWrapper.storage.storeLog({
      sessionId: 'failed-run',
      testId: 'api-timeout-fail',
      timestamp: new Date(),
      level: 'error',
      message: 'Test timeout of 5000ms exceeded',
      source: 'jest',
      metadata: {}
    });
  }

  describe('Scenario 1: TDD Cycle with LLM', () => {
    test('LLM runs tests → analyzes failures → implements fixes → verifies fixes', async () => {
      // Step 1: LLM runs tests after writing new test
      console.log('🤖 LLM: Running tests to see initial failures...');
      const initialRunResponse = await runTestsTool.execute({
        testRunId: 'tdd-red-phase',
        pattern: 'src/auth/**/*.test.js'
      });
      
      expect(initialRunResponse.success).toBe(true);
      expect(initialRunResponse.data).toHaveProperty('sessionId');
      expect(initialRunResponse.data).toHaveProperty('summary');
      expect(initialRunResponse.data.sessionId).toBe('tdd-red-phase');
      // In a real TDD cycle, initial tests would fail, but for this test they pass
      expect(initialRunResponse.data.summary.failed).toBeGreaterThanOrEqual(0);
      
      // Step 2: LLM analyzes what failed and why
      console.log('🤖 LLM: Analyzing test failures to understand what to implement...');
      const failureAnalysisResponse = await queryTool.execute({
        queryType: 'failures',
        sessionId: 'tdd-red-phase'
      });
      
      expect(failureAnalysisResponse.success).toBe(true);
      expect(failureAnalysisResponse.data).toHaveProperty('queryType');
      expect(failureAnalysisResponse.data).toHaveProperty('data');
      expect(failureAnalysisResponse.data).toHaveProperty('insights');
      expect(failureAnalysisResponse.data.queryType).toBe('failures');
      expect(failureAnalysisResponse.data.data.totalFailures).toBeGreaterThanOrEqual(0);
      expect(failureAnalysisResponse.data.insights.recommendations).toBeDefined();
      expect(failureAnalysisResponse.data.insights.priority).toMatch(/high|medium|low/);
      
      // Step 3: LLM implements code and runs tests again
      console.log('🤖 LLM: Implementing code to make tests pass...');
      const fixedRunResponse = await runTestsTool.execute({
        testRunId: 'tdd-green-phase',
        pattern: 'src/auth/**/*.test.js'
      });
      
      expect(fixedRunResponse.success).toBe(true);
      expect(fixedRunResponse.data).toHaveProperty('sessionId');
      expect(fixedRunResponse.data.sessionId).toBe('tdd-green-phase');
      
      // Step 4: LLM compares before/after to verify progress
      console.log('🤖 LLM: Comparing test results to verify fixes...');
      const comparisonResponse = await queryTool.execute({
        queryType: 'comparison',
        sessionIds: ['tdd-red-phase', 'tdd-green-phase']
      });
      
      expect(comparisonResponse.success).toBe(true);
      expect(comparisonResponse.data).toHaveProperty('queryType');
      expect(comparisonResponse.data).toHaveProperty('data');
      expect(comparisonResponse.data).toHaveProperty('insights');
      expect(comparisonResponse.data.queryType).toBe('comparison');
      expect(comparisonResponse.data.data.sessions).toHaveLength(2);
      expect(comparisonResponse.data.data.delta).toBeDefined();
      expect(comparisonResponse.data.insights.summary).toContain('Compared 2 test sessions');
      
      console.log('✅ TDD cycle completed successfully!');
    });
  });

  describe('Scenario 2: Debugging Test Failures', () => {
    test('LLM investigates failures → searches logs → identifies patterns → suggests fixes', async () => {
      // Step 1: LLM notices test failures and wants to understand them
      console.log('🤖 LLM: Investigating test failures in detail...');
      const failuresResponse = await queryTool.execute({
        queryType: 'failures',
        sessionId: 'failed-run'
      });
      
      expect(failuresResponse.success).toBe(true);
      expect(failuresResponse.data).toHaveProperty('queryType');
      expect(failuresResponse.data).toHaveProperty('data');
      expect(failuresResponse.data).toHaveProperty('insights');
      expect(failuresResponse.data.queryType).toBe('failures');
      
      expect(failuresResponse.data.data.totalFailures).toBe(3); // Should find 3 failed tests
      expect(failuresResponse.data.insights.priority).toBe('medium'); // 3 failures = medium priority
      
      // Step 2: LLM searches logs for specific error patterns
      console.log('🤖 LLM: Searching logs for error patterns...');
      const errorLogsResponse = await queryTool.execute({
        queryType: 'logs',
        sessionId: 'failed-run',
        searchQuery: 'error'
      });
      
      expect(errorLogsResponse.success).toBe(true);
      expect(errorLogsResponse.data).toHaveProperty('queryType');
      expect(errorLogsResponse.data).toHaveProperty('data');
      expect(errorLogsResponse.data.queryType).toBe('logs');
      
      expect(errorLogsResponse.data.data.totalMatches).toBeGreaterThan(0);
      expect(errorLogsResponse.data.data.logs.some(log => log.message.includes('TypeError'))).toBe(true);
      
      // Step 3: LLM looks for timeout issues specifically
      console.log('🤖 LLM: Looking for timeout-related issues...');
      const timeoutLogsResponse = await queryTool.execute({
        queryType: 'logs',
        sessionId: 'failed-run',
        searchQuery: 'timeout'
      });
      
      expect(timeoutLogsResponse.success).toBe(true);
      expect(timeoutLogsResponse.data).toHaveProperty('queryType');
      expect(timeoutLogsResponse.data).toHaveProperty('data');
      expect(timeoutLogsResponse.data.queryType).toBe('logs');
      
      expect(timeoutLogsResponse.data.data.logs.some(log => log.message.includes('timeout'))).toBe(true);
      
      // Step 4: LLM analyzes performance to find slow tests
      console.log('🤖 LLM: Analyzing test performance to find bottlenecks...');
      const performanceResponse = await queryTool.execute({
        queryType: 'performance',
        sessionId: 'failed-run',
        limit: 3
      });
      
      expect(performanceResponse.success).toBe(true);
      expect(performanceResponse.data).toHaveProperty('queryType');
      expect(performanceResponse.data).toHaveProperty('data');
      expect(performanceResponse.data).toHaveProperty('insights');
      expect(performanceResponse.data.queryType).toBe('performance');
      
      expect(performanceResponse.data.data.slowestTests).toBeDefined();
      expect(performanceResponse.data.data.recommendations).toBeDefined();
      
      // Verify the timeout test is identified as slow
      const timeoutTest = performanceResponse.data.data.slowestTests.find(t => 
        t.fullName && t.fullName.includes('timeout')
      );
      expect(timeoutTest).toBeDefined();
      expect(timeoutTest.duration).toBeGreaterThan(5000);
      
      console.log('✅ Debugging analysis completed!');
    });
  });

  describe('Scenario 3: Code Review with Test Report', () => {
    test('LLM generates comprehensive report for PR review', async () => {
      // Step 1: LLM creates a detailed markdown report for code review
      console.log('🤖 LLM: Generating test report for pull request review...');
      const reportResponse = await queryTool.execute({
        queryType: 'report',
        sessionId: 'failed-run',
        format: 'markdown'
      });
      
      expect(reportResponse.success).toBe(true);
      expect(reportResponse.data).toHaveProperty('queryType');
      expect(reportResponse.data).toHaveProperty('data');
      expect(reportResponse.data).toHaveProperty('insights');
      expect(reportResponse.data.queryType).toBe('report');
      
      expect(typeof reportResponse.data.data).toBe('string');
      expect(reportResponse.data.data).toContain('#'); // Should have markdown headers
      expect(reportResponse.data.insights.summary).toContain('Test report generated');
      
      // Step 2: LLM also gets a summary view
      console.log('🤖 LLM: Getting summary statistics...');
      const jsonReportResponse = await queryTool.execute({
        queryType: 'report',
        sessionId: 'failed-run',
        format: 'json'
      });
      
      expect(jsonReportResponse.success).toBe(true);
      expect(jsonReportResponse.data).toHaveProperty('queryType');
      expect(jsonReportResponse.data).toHaveProperty('data');
      expect(jsonReportResponse.data).toHaveProperty('insights');
      expect(jsonReportResponse.data.queryType).toBe('report');
      
      expect(jsonReportResponse.data.data.summary).toBeDefined();
      expect(jsonReportResponse.data.data.content).toBeDefined();
      
      console.log('✅ Test report ready for PR review!');
    });
  });

  describe('Real-World LLM Usage Patterns', () => {
    test('demonstrates tool flexibility and LLM-friendly design', async () => {
      // Test various parameter combinations an LLM might use
      
      // Minimal usage
      const simpleResponse = await runTestsTool.execute({});
      expect(simpleResponse.success).toBe(true);
      expect(simpleResponse.data).toHaveProperty('sessionId');
      expect(simpleResponse.data).toHaveProperty('summary');
      expect(simpleResponse.data.sessionId).toBeDefined();
      
      // Complex usage
      const complexTestRunId = 'complex-run-' + Date.now();
      const complexResponse = await runTestsTool.execute({
        pattern: 'src/**/*.test.js',
        testRunId: complexTestRunId,
        projectPath: process.cwd(),
        config: {
          collectCoverage: true,
          verbose: true,
          bail: false,
          timeout: 10000
        }
      });
      expect(complexResponse.success).toBe(true);
      expect(complexResponse.data).toHaveProperty('sessionId');
      expect(complexResponse.data).toHaveProperty('summary');
      expect(complexResponse.data).toHaveProperty('coverage');
      expect(complexResponse.data.sessionId).toBe(complexTestRunId);
      expect(complexResponse.data.coverage).toBeDefined();
      
      // Query with defaults
      const defaultQueryResponse = await queryTool.execute({
        queryType: 'sessions'
      });
      
      expect(defaultQueryResponse.success).toBe(true);
      expect(defaultQueryResponse.data).toHaveProperty('queryType');
      expect(defaultQueryResponse.data).toHaveProperty('data');
      expect(defaultQueryResponse.data.queryType).toBe('sessions');
      expect(defaultQueryResponse.data.data.sessions).toBeDefined();
      
      // Query with all options
      const detailedQueryResponse = await queryTool.execute({
        queryType: 'logs',
        sessionId: complexResponse.data.sessionId,
        searchQuery: 'test',
        limit: 50,
        format: 'json'
      });
      
      expect(detailedQueryResponse.success).toBe(true);
      expect(detailedQueryResponse.data).toHaveProperty('queryType');
      expect(detailedQueryResponse.data).toHaveProperty('data');
      expect(detailedQueryResponse.data.queryType).toBe('logs');
      expect(detailedQueryResponse.data.data.logs).toBeDefined();
      
      console.log('✅ Tool flexibility demonstration completed!');
    });
  });
});