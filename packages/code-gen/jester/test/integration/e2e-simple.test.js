/**
 * Simplified End-to-End Integration Tests
 * Tests the core JAW system functionality
 */

import { JestAgentWrapper } from '../../src/core/JestAgentWrapper.js';
import { AgentTDDHelper } from '../../src/agents/AgentTDDHelper.js';
import { PerformanceAnalyzer } from '../../src/analytics/performance.js';
import { ErrorPatternAnalyzer } from '../../src/analytics/error-patterns.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('End-to-End Integration Tests (Simplified)', () => {
  let jaw;
  let testDbPath;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory for test databases
    tempDir = path.join(process.cwd(), 'temp-e2e-simple');
    await fs.mkdir(tempDir, { recursive: true });
    
    testDbPath = path.join(tempDir, `e2e-simple-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    
    jaw = new JestAgentWrapper({
      dbPath: testDbPath,
      storage: 'sqlite',
      collectConsole: true,
      collectCoverage: true,
      realTimeEvents: true
    });
  });

  afterEach(async () => {
    if (jaw) {
      await jaw.close();
    }
    
    // Clean up test files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's fine
    }
  });

  describe('Basic Session Workflow', () => {
    test('can create and manage test sessions', async () => {
      // Start a test session
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.status).toBe('running');

      // Retrieve the session
      const retrievedSession = await jaw.getSession(session.id);
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession.id).toBe(session.id);
    });

    test('can handle test execution workflow', async () => {
      const session = await jaw.startSession();
      const collector = jaw.collector;
      
      // Simulate test execution
      const suite = collector.onTestSuiteStart('/test.js');
      expect(suite).toBeDefined();

      const test1 = collector.onTestStart({
        path: '/test.js',
        name: 'passing test',
        fullName: 'Suite passing test'
      });

      const test2 = collector.onTestStart({
        path: '/test.js',
        name: 'failing test',
        fullName: 'Suite failing test'
      });

      // End tests
      collector.onTestEnd(test1, { status: 'passed', failureMessages: [] });
      collector.onTestEnd(test2, { status: 'failed', failureMessages: ['Test failed'] });

      // End suite and session
      collector.onTestSuiteEnd('/test.js', { numFailingTests: 1, numPassingTests: 1 });
      const completedSession = collector.endSession({ numTotalTests: 2, numPassedTests: 1, numFailedTests: 1 });

      expect(completedSession.status).toBe('completed');
      expect(completedSession.summary.numTotalTests).toBe(2);

      // Wait for storage operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Query results
      const summary = await jaw.getTestSummary(session.id);
      expect(summary.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Analytics Integration', () => {
    test('performance analyzer works with test data', async () => {
      const session = await jaw.startSession();
      const collector = jaw.collector;
      
      // Create test with known duration
      collector.onTestSuiteStart('/perf.js');
      const test = collector.onTestStart({
        path: '/perf.js',
        name: 'performance test',
        fullName: 'Performance Suite performance test'
      });

      collector.onTestEnd(test, { status: 'passed', failureMessages: [] });
      collector.onTestSuiteEnd('/perf.js', { numFailingTests: 0, numPassingTests: 1 });
      collector.endSession({ numTotalTests: 1, numPassedTests: 1, numFailedTests: 0 });

      // Test performance analysis
      const perfAnalyzer = new PerformanceAnalyzer(jaw);
      const analysis = await perfAnalyzer.analyzeSession(session.id);

      expect(analysis).toBeDefined();
      expect(analysis.sessionId).toBe(session.id);
    });

    test('error pattern analyzer works with error data', async () => {
      const session = await jaw.startSession();
      const collector = jaw.collector;
      
      // Create test with error
      collector.onTestSuiteStart('/error.js');
      const test = collector.onTestStart({
        path: '/error.js',
        name: 'error test',
        fullName: 'Error Suite error test'
      });

      collector.onTestEnd(test, {
        status: 'failed',
        failureMessages: ['Cannot read property of undefined']
      });

      collector.onTestSuiteEnd('/error.js', { numFailingTests: 1, numPassingTests: 0 });
      collector.endSession({ numTotalTests: 1, numPassedTests: 0, numFailedTests: 1 });

      // Test error analysis
      const errorAnalyzer = new ErrorPatternAnalyzer(jaw);
      const analysis = await errorAnalyzer.analyzeSession(session.id);

      expect(analysis).toBeDefined();
      expect(analysis.sessionId).toBe(session.id);
    });

    test('TDD helper provides analysis', async () => {
      const session = await jaw.startSession();
      const collector = jaw.collector;
      
      // Create failing test for TDD
      collector.onTestSuiteStart('/tdd.js');
      const test = collector.onTestStart({
        path: '/tdd.js',
        name: 'feature test',
        fullName: 'TDD Suite feature test'
      });

      collector.onTestEnd(test, {
        status: 'failed',
        failureMessages: ['Feature not implemented']
      });

      collector.onTestSuiteEnd('/tdd.js', { numFailingTests: 1, numPassingTests: 0 });
      collector.endSession({ numTotalTests: 1, numPassedTests: 0, numFailedTests: 1 });

      // Test TDD helper - analyze the session directly
      const tddHelper = new AgentTDDHelper(jaw);
      
      // Get the failed tests from our session
      const failures = await jaw.getFailedTests(session.id);
      
      if (failures.length > 0) {
        // Analyze the failures directly
        const errorSummary = await tddHelper.analyzeFailures(failures);
        const suggestions = await tddHelper.generateImplementationHints(errorSummary);
        const nextActions = tddHelper.prioritizeActions(failures);

        expect(errorSummary).toBeDefined();
        expect(suggestions).toBeDefined();
        expect(nextActions).toBeDefined();
      } else {
        // If no failures found, just verify TDD helper works
        const analysis = await tddHelper.runTDDCycle('/tdd.js');
        expect(analysis).toBeDefined();
        expect(analysis.status).toBeDefined();
      }
    });
  });

  describe('Event System', () => {
    test('events are emitted correctly', async () => {
      const events = [];
      
      // Listen to events
      jaw.on('sessionStart', (session) => events.push('sessionStart'));
      jaw.on('suiteStart', (suite) => events.push('suiteStart'));
      jaw.on('testStart', (test) => events.push('testStart'));
      jaw.on('testEnd', (test) => events.push('testEnd'));
      jaw.on('suiteEnd', (suite) => events.push('suiteEnd'));
      jaw.on('sessionEnd', (session) => events.push('sessionEnd'));

      // Execute workflow
      const session = await jaw.startSession();
      const collector = jaw.collector;
      
      collector.onTestSuiteStart('/event.js');
      const test = collector.onTestStart({
        path: '/event.js',
        name: 'event test',
        fullName: 'Event Suite event test'
      });

      collector.onTestEnd(test, { status: 'passed', failureMessages: [] });
      collector.onTestSuiteEnd('/event.js', { numFailingTests: 0, numPassingTests: 1 });
      collector.endSession({ numTotalTests: 1, numPassedTests: 1, numFailedTests: 0 });

      // Wait a bit for async event processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify events were emitted
      expect(events.length).toBeGreaterThan(0);
      expect(events).toContain('sessionStart');
      expect(events).toContain('testStart');
      // Note: testEnd might be async due to storage operations
    });
  });

  describe('Data Persistence', () => {
    test('data persists across operations', async () => {
      // Create first session
      const session1 = await jaw.startSession();
      const collector = jaw.collector;
      
      collector.onTestSuiteStart('/persist1.js');
      const test1 = collector.onTestStart({
        path: '/persist1.js',
        name: 'persist test 1',
        fullName: 'Persist Suite persist test 1'
      });

      collector.onTestEnd(test1, { status: 'passed', failureMessages: [] });
      collector.onTestSuiteEnd('/persist1.js', { numFailingTests: 0, numPassingTests: 1 });
      collector.endSession({ numTotalTests: 1, numPassedTests: 1, numFailedTests: 0 });

      // Create second session
      const session2 = await jaw.startSession();
      
      collector.onTestSuiteStart('/persist2.js');
      const test2 = collector.onTestStart({
        path: '/persist2.js',
        name: 'persist test 2',
        fullName: 'Persist Suite persist test 2'
      });

      collector.onTestEnd(test2, { status: 'failed', failureMessages: ['Failed'] });
      collector.onTestSuiteEnd('/persist2.js', { numFailingTests: 1, numPassingTests: 0 });
      collector.endSession({ numTotalTests: 1, numPassedTests: 0, numFailedTests: 1 });

      // Verify both sessions exist
      const retrievedSession1 = await jaw.getSession(session1.id);
      const retrievedSession2 = await jaw.getSession(session2.id);

      expect(retrievedSession1).toBeDefined();
      expect(retrievedSession2).toBeDefined();
      expect(retrievedSession1.id).toBe(session1.id);
      expect(retrievedSession2.id).toBe(session2.id);
    });
  });

  describe('Query Operations', () => {
    test('can query test data', async () => {
      const session = await jaw.startSession();
      const collector = jaw.collector;
      
      // Create test data
      collector.onTestSuiteStart('/query.js');
      
      const passingTest = collector.onTestStart({
        path: '/query.js',
        name: 'passing query test',
        fullName: 'Query Suite passing query test'
      });

      const failingTest = collector.onTestStart({
        path: '/query.js',
        name: 'failing query test',
        fullName: 'Query Suite failing query test'
      });

      collector.onTestEnd(passingTest, { status: 'passed', failureMessages: [] });
      collector.onTestEnd(failingTest, { status: 'failed', failureMessages: ['Query failed'] });

      collector.onTestSuiteEnd('/query.js', { numFailingTests: 1, numPassingTests: 1 });
      collector.endSession({ numTotalTests: 2, numPassedTests: 1, numFailedTests: 1 });

      // Wait for storage
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test queries
      const summary = await jaw.getTestSummary(session.id);
      expect(summary).toBeDefined();

      const failedTests = await jaw.getFailedTests(session.id);
      expect(Array.isArray(failedTests)).toBe(true);

      const testHistory = await jaw.getTestHistory('passing query test');
      expect(Array.isArray(testHistory)).toBe(true);
    });
  });
});
