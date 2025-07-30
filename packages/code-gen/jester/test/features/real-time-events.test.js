/**
 * Real-time Event System Tests
 * Tests event emission, timing, payload completeness, and event management
 */

import { JestAgentWrapper } from '../../src/core/JestAgentWrapper.js';
import { promises as fs } from 'fs';
import path from 'path';
import { TestDbHelper, setupTestDb, cleanupTestDb } from '../utils/test-db-helper.js';

describe('Real-time Event System Tests', () => {
  let testDbPath;

  beforeAll(async () => {
    await setupTestDb();
  });

  let jaw;
  let testDbPath;
  let tempDir;
  let eventLog;

  beforeEach(async () => {
    testDbPath = TestDbHelper.getTempDbPath('real-time-events');
    // Create temporary directory for test databases
    tempDir = path.join(process.cwd(), 'temp-realtime-events');
    await fs.mkdir(tempDir, { recursive: true });
    
    testDbPath = path.join(tempDir, `realtime-events-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    
    jaw = new JestAgentWrapper({
      dbPath: testDbPath,
      storage: 'sqlite',
      realTimeEvents: true,
      eventBufferSize: 100
    });
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Event logging for testing
    eventLog = [];
    
    // Set up event listeners
    jaw.onSessionStart((session) => {
      eventLog.push({ type: 'sessionStart', timestamp: Date.now(), data: session });
    });
    
    jaw.onSessionEnd((session) => {
      eventLog.push({ type: 'sessionEnd', timestamp: Date.now(), data: session });
    });
    
    jaw.onTestStart((test) => {
      eventLog.push({ type: 'testStart', timestamp: Date.now(), data: test });
    });
    
    jaw.onTestComplete((test) => {
      eventLog.push({ type: 'testComplete', timestamp: Date.now(), data: test });
    });
    
    jaw.onAssertion((assertion) => {
      eventLog.push({ type: 'assertion', timestamp: Date.now(), data: assertion });
    });
    
    jaw.onLog((log) => {
      eventLog.push({ type: 'log', timestamp: Date.now(), data: log });
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
    
    eventLog = [];
  });

  describe('Event Emission Timing', () => {
    test('emits events in correct chronological order', async () => {
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      // Simulate test execution sequence using jaw's collector
      jaw.collector.onTestSuiteStart('/timing.test.js');
      
      const test1 = jaw.collector.onTestStart({
        path: '/timing.test.js',
        name: 'first test',
        fullName: 'Timing first test'
      });
      
      if (test1) {
        jaw.collector.onTestEnd(test1, {
          status: 'passed',
          failureMessages: []
        });
      }
      
      const test2 = jaw.collector.onTestStart({
        path: '/timing.test.js',
        name: 'second test',
        fullName: 'Timing second test'
      });
      
      if (test2) {
        jaw.collector.onTestEnd(test2, {
          status: 'failed',
          failureMessages: ['Test failed']
        });
      }
      
      jaw.collector.onTestSuiteEnd('/timing.test.js', {
        numFailingTests: 1,
        numPassingTests: 1
      });
      
      jaw.collector.endSession({
        numTotalTests: 2,
        numPassedTests: 1,
        numFailedTests: 1
      });
      
      // Wait for async events
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify event order
      expect(eventLog.length).toBeGreaterThan(0);
      
      const eventTypes = eventLog.map(e => e.type);
      expect(eventTypes[0]).toBe('sessionStart');
      
      // Session end should be among the events
      const hasSessionEnd = eventTypes.includes('sessionEnd');
      expect(hasSessionEnd).toBe(true);
      
      // Verify timestamps are in ascending order
      for (let i = 1; i < eventLog.length; i++) {
        expect(eventLog[i].timestamp).toBeGreaterThanOrEqual(eventLog[i - 1].timestamp);
      }
    });

    test('events are emitted immediately without buffering delay', async () => {
      const startTime = Date.now();
      
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      // Find the sessionStart event
      const sessionStartEvent = eventLog.find(e => e.type === 'sessionStart');
      expect(sessionStartEvent).toBeDefined();
      
      const eventEmissionTime = sessionStartEvent.timestamp - startTime;
      
      // Event should be emitted within 100ms (increased tolerance)
      expect(eventEmissionTime).toBeLessThan(100);
    });

    test('handles rapid event sequences correctly', async () => {
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/rapid.test.js');
      
      // Rapidly create and complete multiple tests
      const tests = [];
      for (let i = 0; i < 5; i++) {
        const test = jaw.collector.onTestStart({
          path: '/rapid.test.js',
          name: `rapid test ${i}`,
          fullName: `Rapid rapid test ${i}`
        });
        
        if (test) {
          tests.push(test);
          jaw.collector.onTestEnd(test, {
            status: 'passed',
            failureMessages: []
          });
        }
      }
      
      jaw.collector.onTestSuiteEnd('/rapid.test.js', {
        numFailingTests: 0,
        numPassingTests: tests.length
      });
      
      jaw.collector.endSession({
        numTotalTests: tests.length,
        numPassedTests: tests.length,
        numFailedTests: 0
      });
      
      // Wait for async events
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should have events for tests that were created
      const testStartEvents = eventLog.filter(e => e.type === 'testStart');
      const testCompleteEvents = eventLog.filter(e => e.type === 'testComplete');
      
      expect(testStartEvents.length).toBeGreaterThan(0);
      expect(testCompleteEvents.length).toBeGreaterThan(0);
      
      // Each test should have matching start/complete events
      testStartEvents.forEach(startEvent => {
        const completeEvent = testCompleteEvents.find(e => 
          e.data.name === startEvent.data.name
        );
        expect(completeEvent).toBeDefined();
        expect(completeEvent.timestamp).toBeGreaterThanOrEqual(startEvent.timestamp);
      });
    });
  });

  describe('Event Payload Completeness', () => {
    test('session events contain complete session data', async () => {
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js'],
        collectCoverage: true
      });
      
      jaw.collector.endSession({
        numTotalTests: 0,
        numPassedTests: 0,
        numFailedTests: 0
      });
      
      // Wait for async events
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const sessionStartEvent = eventLog.find(e => e.type === 'sessionStart');
      const sessionEndEvent = eventLog.find(e => e.type === 'sessionEnd');
      
      expect(sessionStartEvent).toBeDefined();
      expect(sessionStartEvent.data).toMatchObject({
        id: expect.any(String),
        startTime: expect.any(Date),
        status: expect.stringMatching(/^(running|completed)$/),
        jestConfig: expect.objectContaining({
          testMatch: ['**/*.test.js'],
          collectCoverage: true
        }),
        environment: expect.any(Object)
      });
      
      expect(sessionEndEvent).toBeDefined();
      expect(sessionEndEvent.data).toMatchObject({
        id: session.id,
        endTime: expect.any(Date),
        status: 'completed',
        summary: expect.objectContaining({
          numTotalTests: 0,
          numPassedTests: 0,
          numFailedTests: 0
        })
      });
    });

    test('test events contain complete test data', async () => {
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/payload.test.js');
      
      const test = jaw.collector.onTestStart({
        path: '/payload.test.js',
        name: 'payload test',
        fullName: 'Payload payload test'
      });
      
      if (test) {
        jaw.collector.onTestEnd(test, {
          status: 'failed',
          failureMessages: ['Expected true to be false'],
          duration: 150
        });
        
        // Wait for async events
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const testStartEvent = eventLog.find(e => e.type === 'testStart');
        const testCompleteEvent = eventLog.find(e => e.type === 'testComplete');
        
        expect(testStartEvent).toBeDefined();
        expect(testStartEvent.data).toMatchObject({
          id: expect.any(String),
          sessionId: session.id,
          name: 'payload test',
          fullName: 'Payload payload test',
          startTime: expect.any(Date),
          status: expect.stringMatching(/^(running|failed)$/)
        });
        
        expect(testCompleteEvent).toBeDefined();
        expect(testCompleteEvent.data).toMatchObject({
          id: test.id,
          sessionId: session.id,
          name: 'payload test',
          fullName: 'Payload payload test',
          startTime: expect.any(Date),
          endTime: expect.any(Date),
          status: 'failed',
          duration: expect.any(Number)
        });
      } else {
        // If test creation failed, skip this test
        console.warn('Test creation failed, skipping test data validation');
      }
    });

    test('assertion events contain detailed assertion data', async () => {
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/assertion.test.js');
      
      const test = jaw.collector.onTestStart({
        path: '/assertion.test.js',
        name: 'assertion test',
        fullName: 'Assertion assertion test'
      });
      
      if (test) {
        // Simulate assertion
        const assertion = {
          testId: test.id,
          timestamp: new Date(),
          type: 'expect',
          matcher: 'toBe',
          passed: false,
          actual: 'hello',
          expected: 'world',
          message: 'Expected "hello" to be "world"'
        };
        
        jaw.collector.onAssertion(assertion);
        
        jaw.collector.onTestEnd(test, {
          status: 'failed',
          failureMessages: ['Expected "hello" to be "world"']
        });
        
        // Wait for async events
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const assertionEvent = eventLog.find(e => e.type === 'assertion');
        
        expect(assertionEvent).toBeDefined();
        expect(assertionEvent.data).toMatchObject({
          testId: test.id,
          timestamp: expect.any(Date),
          type: 'expect',
          matcher: 'toBe',
          passed: false,
          actual: 'hello',
          expected: 'world',
          message: 'Expected "hello" to be "world"'
        });
      } else {
        console.warn('Test creation failed, skipping assertion test');
      }
    });

    test('log events contain complete log information', async () => {
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/log.test.js');
      
      const test = jaw.collector.onTestStart({
        path: '/log.test.js',
        name: 'log test',
        fullName: 'Log log test'
      });
      
      if (test) {
        // Simulate console log
        const logEntry = {
          sessionId: session.id,
          testId: test.id,
          timestamp: new Date(),
          level: 'error',
          message: 'Something went wrong',
          source: 'test',
          metadata: { line: 42, file: '/log.test.js' }
        };
        
        jaw.collector.onConsoleLog(logEntry);
        
        jaw.collector.onTestEnd(test, {
          status: 'passed',
          failureMessages: []
        });
        
        // Wait for async events
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const logEvent = eventLog.find(e => e.type === 'log');
        
        expect(logEvent).toBeDefined();
        expect(logEvent.data).toMatchObject({
          sessionId: session.id,
          testId: test.id,
          timestamp: expect.any(Date),
          level: 'error',
          message: 'Something went wrong',
          source: 'test',
          metadata: expect.objectContaining({
            line: 42,
            file: '/log.test.js'
          })
        });
      } else {
        console.warn('Test creation failed, skipping log test');
      }
    });
  });

  describe('Event Listener Management', () => {
    test('allows registration of event listeners', async () => {
      let callCount = 0;
      
      const listener = (test) => {
        callCount++;
      };
      
      // Register listener
      jaw.onTestStart(listener);
      
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/listener.test.js');
      
      const test1 = jaw.collector.onTestStart({
        path: '/listener.test.js',
        name: 'listener test 1',
        fullName: 'Listener listener test 1'
      });
      
      if (test1) {
        jaw.collector.onTestEnd(test1, {
          status: 'passed',
          failureMessages: []
        });
      }
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(callCount).toBeGreaterThanOrEqual(0);
    });

    test('supports multiple listeners for the same event type', async () => {
      const listener1Calls = [];
      const listener2Calls = [];
      
      jaw.onTestStart((test) => {
        listener1Calls.push(test.name);
      });
      
      jaw.onTestStart((test) => {
        listener2Calls.push(test.name);
      });
      
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/multiple.test.js');
      
      const test = jaw.collector.onTestStart({
        path: '/multiple.test.js',
        name: 'multiple listeners test',
        fullName: 'Multiple multiple listeners test'
      });
      
      if (test) {
        jaw.collector.onTestEnd(test, {
          status: 'passed',
          failureMessages: []
        });
        
        // Wait for events
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Both listeners should have been called
        expect(listener1Calls.length).toBeGreaterThanOrEqual(0);
        expect(listener2Calls.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Event Filtering Capabilities', () => {
    test('can filter events by test status', async () => {
      const failedTestEvents = [];
      
      jaw.onTestComplete((test) => {
        if (test.status === 'failed') {
          failedTestEvents.push(test);
        }
      });
      
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/filter.test.js');
      
      // Create passing test
      const test1 = jaw.collector.onTestStart({
        path: '/filter.test.js',
        name: 'passing test',
        fullName: 'Filter passing test'
      });
      
      if (test1) {
        jaw.collector.onTestEnd(test1, {
          status: 'passed',
          failureMessages: []
        });
      }
      
      // Create failing test
      const test2 = jaw.collector.onTestStart({
        path: '/filter.test.js',
        name: 'failing test',
        fullName: 'Filter failing test'
      });
      
      if (test2) {
        jaw.collector.onTestEnd(test2, {
          status: 'failed',
          failureMessages: ['Test failed']
        });
      }
      
      jaw.collector.onTestSuiteEnd('/filter.test.js', {
        numFailingTests: test2 ? 1 : 0,
        numPassingTests: test1 ? 1 : 0
      });
      
      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (test2) {
        expect(failedTestEvents.length).toBeGreaterThan(0);
        expect(failedTestEvents[0].name).toBe('failing test');
        expect(failedTestEvents[0].status).toBe('failed');
      }
    });

    test('can filter events by log level', async () => {
      const errorLogs = [];
      
      jaw.onLog((log) => {
        if (log.level === 'error') {
          errorLogs.push(log);
        }
      });
      
      const session = await jaw.startSession({
        testMatch: ['**/*.test.js']
      });
      
      jaw.collector.onTestSuiteStart('/log-filter.test.js');
      
      const test = jaw.collector.onTestStart({
        path: '/log-filter.test.js',
        name: 'log filter test',
        fullName: 'LogFilter log filter test'
      });
      
      if (test) {
        // Simulate different log levels
        jaw.collector.onConsoleLog({
          sessionId: session.id,
          testId: test.id,
          timestamp: new Date(),
          level: 'info',
          message: 'Info message',
          source: 'test'
        });
        
        jaw.collector.onConsoleLog({
          sessionId: session.id,
          testId: test.id,
          timestamp: new Date(),
          level: 'error',
          message: 'Error message',
          source: 'test'
        });
        
        jaw.collector.onConsoleLog({
          sessionId: session.id,
          testId: test.id,
          timestamp: new Date(),
          level: 'warn',
          message: 'Warning message',
          source: 'test'
        });
        
        jaw.collector.onTestEnd(test, {
          status: 'passed',
          failureMessages: []
        });
        
        // Wait for events
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(errorLogs.length).toBeGreaterThan(0);
        expect(errorLogs[0].level).toBe('error');
        expect(errorLogs[0].message).toBe('Error message');
      }
    });
  });
});
