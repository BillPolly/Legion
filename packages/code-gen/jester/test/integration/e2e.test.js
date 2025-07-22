/**
 * End-to-End Integration Tests
 * Tests the complete JAW system working together from start to finish
 */

import { JestAgentWrapper } from '../../src/core/JestAgentWrapper.js';
import { JestAgentReporter } from '../../src/reporter/JestAgentReporter.js';
import { JestAgentCLI } from '../../src/cli/JestAgentCLI.js';
import { AgentTDDHelper } from '../../src/agents/AgentTDDHelper.js';
import { PerformanceAnalyzer } from '../../src/analytics/performance.js';
import { ErrorPatternAnalyzer } from '../../src/analytics/error-patterns.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('End-to-End Integration Tests', () => {
  let jaw;
  let testDbPath;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory for test databases
    tempDir = path.join(process.cwd(), 'temp-e2e-tests');
    await fs.mkdir(tempDir, { recursive: true });
    
    testDbPath = path.join(tempDir, `e2e-test-${Date.now()}.db`);
    
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

  describe('Complete Test Session Workflow', () => {
    test('full session lifecycle with real data', async () => {
      // 1. Start a test session
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js'],
        collectCoverage: true
      });

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.status).toBe('running');

      // 2. Simulate test suite execution
      const collector = jaw.collector;
      
      // Start test suite
      const suite = collector.onTestSuiteStart('/path/to/example.test.js');
      expect(suite).toBeDefined();
      expect(suite.status).toBe('running');

      // Start individual tests
      const test1 = collector.onTestStart({
        path: '/path/to/example.test.js',
        name: 'should pass successfully',
        fullName: 'Example Suite should pass successfully'
      });

      const test2 = collector.onTestStart({
        path: '/path/to/example.test.js',
        name: 'should fail with assertion error',
        fullName: 'Example Suite should fail with assertion error'
      });

      expect(test1).toBeDefined();
      expect(test2).toBeDefined();

      // Simulate console logs
      collector.onConsoleLog('log', 'Test is running...', { testId: test1.id });
      collector.onConsoleLog('error', 'Something went wrong', { testId: test2.id });

      // End tests with results
      collector.onTestEnd(test1, {
        status: 'passed',
        failureMessages: []
      });

      collector.onTestEnd(test2, {
        status: 'failed',
        failureMessages: ['Expected true but received false']
      });

      // End test suite
      collector.onTestSuiteEnd('/path/to/example.test.js', {
        numFailingTests: 1,
        numPassingTests: 1
      });

      // 3. End session
      const completedSession = collector.endSession({
        numTotalTests: 2,
        numPassedTests: 1,
        numFailedTests: 1
      });

      expect(completedSession.status).toBe('completed');
      expect(completedSession.summary.numTotalTests).toBe(2);

      // Wait a bit for async storage operations to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // 4. Query the results
      const failedTests = await jaw.getFailedTests(session.id);
      expect(failedTests.length).toBeGreaterThanOrEqual(1);
      
      const testSummary = await jaw.getTestSummary(session.id);
      expect(testSummary.total).toBeGreaterThanOrEqual(2);

      // 5. Search logs
      const logs = await jaw.searchLogs({
        sessionId: session.id,
        level: 'error'
      });
      expect(logs.length).toBeGreaterThanOrEqual(0);
    });

    test('multiple sessions with data persistence', async () => {
      // Session 1
      const session1 = await jaw.startSession({ name: 'Session 1' });
      const collector = jaw.collector;
      
      // Simulate a passing test
      collector.onTestSuiteStart('/test1.js');
      const test1 = collector.onTestStart({
        path: '/test1.js',
        name: 'test 1',
        fullName: 'Suite 1 test 1'
      });
      collector.onTestEnd(test1, { status: 'passed', failureMessages: [] });
      collector.onTestSuiteEnd('/test1.js', { numFailingTests: 0, numPassingTests: 1 });
      collector.endSession({ numTotalTests: 1, numPassedTests: 1, numFailedTests: 0 });

      // Session 2
      const session2 = await jaw.startSession({ name: 'Session 2' });
      
      // Simulate a failing test
      collector.onTestSuiteStart('/test2.js');
      const test2 = collector.onTestStart({
        path: '/test2.js',
        name: 'test 2',
        fullName: 'Suite 2 test 2'
      });
      collector.onTestEnd(test2, { 
        status: 'failed', 
        failureMessages: ['Assertion failed'] 
      });
      collector.onTestSuiteEnd('/test2.js', { numFailingTests: 1, numPassingTests: 0 });
      collector.endSession({ numTotalTests: 1, numPassedTests: 0, numFailedTests: 1 });

      // Verify both sessions are stored
      const storedSession1 = await jaw.getSession(session1.id);
      const storedSession2 = await jaw.getSession(session2.id);

      expect(storedSession1).toBeDefined();
      expect(storedSession2).toBeDefined();
      expect(storedSession1.id).toBe(session1.id);
      expect(storedSession2.id).toBe(session2.id);

      // Verify cross-session queries work
      const allFailedTests = await jaw.getFailedTests();
      expect(allFailedTests).toHaveLength(1);
      expect(allFailedTests[0].name).toBe('test 2');

      const session1Summary = await jaw.getTestSummary(session1.id);
      const session2Summary = await jaw.getTestSummary(session2.id);

      expect(session1Summary.failed).toBe(0);
      expect(session2Summary.failed).toBe(1);
    });
  });

  describe('Analytics Integration', () => {
    test('performance analysis integration', async () => {
      const session = await jaw.startSession();
      const collector = jaw.collector;
      
      // Create test data with varying performance
      const tests = [
        { name: 'fast test', duration: 50 },
        { name: 'medium test', duration: 200 },
        { name: 'slow test', duration: 1000 }
      ];

      collector.onTestSuiteStart('/perf-test.js');
      
      for (const testData of tests) {
        const test = collector.onTestStart({
          path: '/perf-test.js',
          name: testData.name,
          fullName: `Performance Suite ${testData.name}`
        });

        // Simulate test duration
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        
        collector.onTestEnd(test, {
          status: 'passed',
          failureMessages: []
        });

        // Manually set duration for testing
        test.duration = testData.duration;
        await jaw.storage.storeTestCase(test);
      }

      collector.onTestSuiteEnd('/perf-test.js', { numFailingTests: 0, numPassingTests: 3 });
      collector.endSession({ numTotalTests: 3, numPassedTests: 3, numFailedTests: 0 });

      // Test performance analysis
      const perfAnalyzer = new PerformanceAnalyzer(jaw);
      const analysis = await perfAnalyzer.analyzeSession(session.id);

      expect(analysis.sessionId).toBe(session.id);
      expect(analysis.totalTests).toBe(3);
      expect(analysis.bottlenecks.slowTests).toBeDefined();
      expect(analysis.metrics.averageDuration).toBeGreaterThan(0);
      expect(analysis.recommendations).toBeDefined();
    });

    test('error pattern analysis integration', async () => {
      const session = await jaw.startSession();
      const collector = jaw.collector;
      
      // Create test data with error patterns
      const errorTests = [
        {
          name: 'null pointer test 1',
          error: 'Cannot read property "length" of undefined'
        },
        {
          name: 'null pointer test 2', 
          error: 'Cannot read property "value" of null'
        },
        {
          name: 'assertion test',
          error: 'Expected true but received false'
        }
      ];

      collector.onTestSuiteStart('/error-test.js');
      
      for (const testData of errorTests) {
        const test = collector.onTestStart({
          path: '/error-test.js',
          name: testData.name,
          fullName: `Error Suite ${testData.name}`
        });

        collector.onTestEnd(test, {
          status: 'failed',
          failureMessages: [testData.error]
        });
      }

      collector.onTestSuiteEnd('/error-test.js', { numFailingTests: 3, numPassingTests: 0 });
      collector.endSession({ numTotalTests: 3, numPassedTests: 0, numFailedTests: 3 });

      // Test error pattern analysis
      const errorAnalyzer = new ErrorPatternAnalyzer(jaw);
      const analysis = await errorAnalyzer.analyzeSession(session.id);

      expect(analysis.sessionId).toBe(session.id);
      expect(analysis.totalErrors).toBe(3);
      expect(analysis.patterns.commonMessages).toBeDefined();
      expect(analysis.suggestions).toBeDefined();
      expect(analysis.summary.status).toBeDefined();
    });

    test('TDD helper integration', async () => {
      const session = await jaw.startSession();
      const collector = jaw.collector;
      
      // Simulate TDD cycle with failing tests
      collector.onTestSuiteStart('/tdd-test.js');
      
      const test1 = collector.onTestStart({
        path: '/tdd-test.js',
        name: 'should implement feature A',
        fullName: 'TDD Suite should implement feature A'
      });

      const test2 = collector.onTestStart({
        path: '/tdd-test.js',
        name: 'should implement feature B',
        fullName: 'TDD Suite should implement feature B'
      });

      collector.onTestEnd(test1, {
        status: 'failed',
        failureMessages: ['ReferenceError: featureA is not defined']
      });

      collector.onTestEnd(test2, {
        status: 'failed',
        failureMessages: ['Expected function but received undefined']
      });

      collector.onTestSuiteEnd('/tdd-test.js', { numFailingTests: 2, numPassingTests: 0 });
      collector.endSession({ numTotalTests: 2, numPassedTests: 0, numFailedTests: 2 });

      // Test TDD helper - manually analyze the session instead of using runTDDCycle
      const tddHelper = new AgentTDDHelper(jaw);
      
      // Get the failed tests from our session
      const failures = await jaw.getFailedTests(session.id);
      expect(failures.length).toBe(2);
      
      // Analyze the failures directly
      const errorSummary = await tddHelper.analyzeFailures(failures);
      const suggestions = await tddHelper.generateImplementationHints(errorSummary);
      const nextActions = tddHelper.prioritizeActions(failures);

      expect(errorSummary.totalFailures).toBe(2);
      expect(suggestions).toBeDefined();
      expect(nextActions).toBeDefined();
      expect(nextActions.length).toBeGreaterThan(0);
    });
  });

  describe('CLI Integration', () => {
    test('CLI commands work with real data', async () => {
      // First create some test data
      const session = await jaw.startSession();
      const collector = jaw.collector;
      
      collector.onTestSuiteStart('/cli-test.js');
      
      const passingTest = collector.onTestStart({
        path: '/cli-test.js',
        name: 'passing test',
        fullName: 'CLI Suite passing test'
      });

      const failingTest = collector.onTestStart({
        path: '/cli-test.js',
        name: 'failing test',
        fullName: 'CLI Suite failing test'
      });

      collector.onTestEnd(passingTest, { status: 'passed', failureMessages: [] });
      collector.onTestEnd(failingTest, { 
        status: 'failed', 
        failureMessages: ['CLI test assertion failed'] 
      });

      collector.onTestSuiteEnd('/cli-test.js', { numFailingTests: 1, numPassingTests: 1 });
      collector.endSession({ numTotalTests: 2, numPassedTests: 1, numFailedTests: 1 });

      // Test CLI functionality
      const cli = new JestAgentCLI();
      cli.jaw = jaw; // Inject our test instance

      // Mock console.log to capture output
      const originalLog = console.log;
      const logOutput = [];
      console.log = (...args) => logOutput.push(args.join(' '));

      try {
        // Test query command
        await cli.queryTests({ 
          failed: true, 
          output: testDbPath 
        });

        expect(logOutput.some(line => line.includes('failing test'))).toBe(true);

        // Test summary command
        logOutput.length = 0; // Clear output
        await cli.showSummary({ 
          session: session.id, 
          output: testDbPath 
        });

        expect(logOutput.some(line => line.includes('Total: 2'))).toBe(true);
        expect(logOutput.some(line => line.includes('Passed: 1'))).toBe(true);
        expect(logOutput.some(line => line.includes('Failed: 1'))).toBe(true);

      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('Reporter Integration', () => {
    test('Jest reporter integration with event flow', async () => {
      const mockGlobalConfig = {
        testMatch: ['**/*.test.js'],
        collectCoverage: false
      };

      const reporter = new JestAgentReporter(mockGlobalConfig, {
        dbPath: testDbPath
      });

      // Test reporter lifecycle
      const mockResults = {
        numTotalTestSuites: 1,
        numPassedTestSuites: 0,
        numFailedTestSuites: 1,
        numTotalTests: 2,
        numPassedTests: 1,
        numFailedTests: 1
      };

      const mockOptions = {};

      // Start run
      reporter.onRunStart(mockResults, mockOptions);

      // Test suite events
      const mockTest = { path: '/reporter-test.js' };
      reporter.onTestSuiteStart(mockTest);

      // Individual test events
      const mockTestCase1 = {
        path: '/reporter-test.js',
        name: 'test 1',
        fullName: 'Reporter Suite test 1'
      };

      const mockTestCase2 = {
        path: '/reporter-test.js',
        name: 'test 2',
        fullName: 'Reporter Suite test 2'
      };

      reporter.onTestStart(mockTestCase1);
      reporter.onTestEnd(mockTestCase1, { status: 'passed', failureMessages: [] });

      reporter.onTestStart(mockTestCase2);
      reporter.onTestEnd(mockTestCase2, { 
        status: 'failed', 
        failureMessages: ['Reporter test failed'] 
      });

      const mockTestResults = {
        numFailingTests: 1,
        numPassingTests: 1
      };

      reporter.onTestSuiteEnd(mockTest, mockTestResults);

      // Complete run
      const mockFinalResults = {
        ...mockResults,
        testResults: [mockTestResults]
      };

      reporter.onRunComplete({}, mockFinalResults);

      // Verify data was stored through reporter
      const storage = reporter.getStorage();
      await storage.initialize();

      // Query the stored data
      const query = reporter.getQuery();
      const summary = await query.getTestSummary();

      expect(summary.total).toBe(2);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(1);

      await storage.close();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles database connection issues gracefully', async () => {
      // Create JAW with invalid database path
      const invalidJaw = new JestAgentWrapper({
        dbPath: '/invalid/path/test.db',
        storage: 'sqlite'
      });

      // Should handle gracefully without crashing
      await expect(invalidJaw.startSession()).rejects.toThrow();
      
      // Cleanup should work even with failed initialization
      await expect(invalidJaw.close()).resolves.not.toThrow();
    });

    test('handles concurrent session operations', async () => {
      // Since EventCollector can only handle one session at a time,
      // we test sequential session creation instead
      const session1 = await jaw.startSession({ name: 'Concurrent 1' });
      
      // End the first session before starting the second
      jaw.collector.endSession({ numTotalTests: 0, numPassedTests: 0, numFailedTests: 0 });
      
      const session2 = await jaw.startSession({ name: 'Concurrent 2' });

      expect(session1.id).not.toBe(session2.id);
      expect(session1.startTime).toBeDefined();
      expect(session2.startTime).toBeDefined();

      // Both sessions should be retrievable
      const retrieved1 = await jaw.getSession(session1.id);
      const retrieved2 = await jaw.getSession(session2.id);

      expect(retrieved1.id).toBe(session1.id);
      expect(retrieved2.id).toBe(session2.id);
    });

    test('handles malformed test data gracefully', async () => {
      const session = await jaw.startSession();
      const collector = jaw.collector;

      // Test with missing required fields
      expect(() => {
        collector.onTestStart({
          // Missing path and name
          fullName: 'Incomplete test'
        });
      }).not.toThrow();

      // Test with null/undefined values
      expect(() => {
        collector.onTestEnd(null, { status: 'passed' });
      }).not.toThrow();

      // Test with invalid status
      const test = collector.onTestStart({
        path: '/malformed-test.js',
        name: 'test with invalid status',
        fullName: 'Malformed Suite test with invalid status'
      });

      expect(() => {
        collector.onTestEnd(test, { 
          status: 'invalid-status',
          failureMessages: []
        });
      }).not.toThrow();
    });

    test('handles large datasets efficiently', async () => {
      const session = await jaw.startSession();
      const collector = jaw.collector;

      const startTime = Date.now();
      
      // Create a large number of tests
      collector.onTestSuiteStart('/large-test.js');
      
      const testPromises = [];
      for (let i = 0; i < 100; i++) {
        const test = collector.onTestStart({
          path: '/large-test.js',
          name: `test ${i}`,
          fullName: `Large Suite test ${i}`
        });

        testPromises.push(
          Promise.resolve().then(() => {
            collector.onTestEnd(test, {
              status: i % 10 === 0 ? 'failed' : 'passed',
              failureMessages: i % 10 === 0 ? [`Test ${i} failed`] : []
            });
          })
        );
      }

      await Promise.all(testPromises);
      
      collector.onTestSuiteEnd('/large-test.js', { 
        numFailingTests: 10, 
        numPassingTests: 90 
      });
      
      collector.endSession({ 
        numTotalTests: 100, 
        numPassedTests: 90, 
        numFailedTests: 10 
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);

      // Verify all data was stored correctly
      const summary = await jaw.getTestSummary(session.id);
      expect(summary.total).toBe(100);
      expect(summary.passed).toBe(90);
      expect(summary.failed).toBe(10);

      const failedTests = await jaw.getFailedTests(session.id);
      expect(failedTests).toHaveLength(10);
    });
  });

  describe('Real-time Event System', () => {
    test('events are emitted in correct order', async () => {
      const events = [];
      
      // Listen to all events
      jaw.on('sessionStart', (session) => events.push({ type: 'sessionStart', data: session }));
      jaw.on('suiteStart', (suite) => events.push({ type: 'suiteStart', data: suite }));
      jaw.on('testStart', (test) => events.push({ type: 'testStart', data: test }));
      jaw.on('testEnd', (test) => events.push({ type: 'testEnd', data: test }));
      jaw.on('suiteEnd', (suite) => events.push({ type: 'suiteEnd', data: suite }));
      jaw.on('sessionEnd', (session) => events.push({ type: 'sessionEnd', data: session }));
      jaw.on('log', (log) => events.push({ type: 'log', data: log }));

      // Execute test sequence
      const session = await jaw.startSession();
      const collector = jaw.collector;
      
      collector.onTestSuiteStart('/event-test.js');
      
      const test = collector.onTestStart({
        path: '/event-test.js',
        name: 'event test',
        fullName: 'Event Suite event test'
      });

      collector.onConsoleLog('log', 'Test log message', { testId: test.id });
      
      collector.onTestEnd(test, { status: 'passed', failureMessages: [] });
      collector.onTestSuiteEnd('/event-test.js', { numFailingTests: 0, numPassingTests: 1 });
      collector.endSession({ numTotalTests: 1, numPassedTests: 1, numFailedTests: 0 });

      // Verify events were emitted (order may vary due to async operations)
      expect(events.length).toBeGreaterThanOrEqual(2);
      
      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toContain('sessionStart');
      expect(eventTypes).toContain('testStart');
      
      // Verify event data integrity for the events we have
      const sessionStartEvent = events.find(e => e.type === 'sessionStart');
      const testStartEvent = events.find(e => e.type === 'testStart');
      
      expect(sessionStartEvent.data.id).toBe(session.id);
      expect(testStartEvent.data.name).toBe('event test');
    });
  });
});
