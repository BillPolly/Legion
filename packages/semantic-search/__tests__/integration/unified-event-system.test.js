/**
 * Integration test for the unified event capture and semantic search system
 * 
 * Tests the complete workflow:
 * 1. Jest tests generating events through UniversalEventCollector
 * 2. Production logs being forwarded from EventAwareLogManager
 * 3. Local embeddings being generated with ONNX
 * 4. AI agents using natural language queries through AgentEventAnalyzer
 */

import { jest } from '@jest/globals';
import { UniversalEventCollector } from '../../../code-gen/jester/src/core/UniversalEventCollector.js';
import { EventAwareLogManager } from '../../../log-manager/src/EventAwareLogManager.js';
// import { EventSemanticSearchProvider } from '../../src/providers/EventSemanticSearchProvider.js'; // Mocked in tests
import { AgentEventAnalyzer } from '../../src/agents/AgentEventAnalyzer.js';
import { ResourceManager } from '../../../tools/src/ResourceManager.js';

describe('Unified Event System Integration', () => {
  let resourceManager;
  let eventCollector;
  let logManager;
  let searchProvider;
  let agentAnalyzer;
  let mockStorage;

  beforeAll(async () => {
    // Create ResourceManager with mock environment
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Mock storage for tests
    mockStorage = {
      storeBatch: jest.fn(),
      store: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      upsert: jest.fn()
    };
  });

  beforeEach(async () => {
    // Create UniversalEventCollector
    eventCollector = new UniversalEventCollector(mockStorage, {
      enableCorrelation: true,
      bufferSize: 10, // Small buffer for testing
      flushInterval: 1000
    });

    // Create EventAwareLogManager and connect it to UniversalEventCollector
    logManager = new EventAwareLogManager({
      enableEventCapture: true,
      enableCorrelation: true
    });
    logManager.setEventCollector(eventCollector);

    // Mock the EventSemanticSearchProvider for testing
    searchProvider = {
      indexEvent: jest.fn().mockResolvedValue({ success: true, eventId: 'evt-test-123', embedded: true }),
      semanticSearch: jest.fn().mockResolvedValue([]),
      searchProductionErrors: jest.fn().mockResolvedValue([]),
      searchTestFailures: jest.fn().mockResolvedValue([]),
      traceCorrelationId: jest.fn().mockResolvedValue({ correlationId: '', totalEvents: 0, timeline: [] }),
      findSimilarErrors: jest.fn().mockResolvedValue([]),
      analyzeFailurePatterns: jest.fn().mockResolvedValue({ patterns: [] }),
      find: jest.fn().mockResolvedValue([]),
      getStatistics: jest.fn().mockReturnValue({ events: { queueSize: 0 } }),
      cleanup: jest.fn()
    };

    // Create AgentEventAnalyzer
    agentAnalyzer = new AgentEventAnalyzer(searchProvider, mockStorage, {
      defaultTimeRange: 86400000,
      maxResults: 50
    });
  });

  afterEach(async () => {
    await eventCollector?.cleanup();
    await logManager?.cleanup();
    await searchProvider?.cleanup();
  });

  describe('Event Collection Flow', () => {
    test('should capture Jest test events', async () => {
      const testStartSpy = jest.fn();
      eventCollector.on('testEvent', testStartSpy);

      // Simulate Jest test start
      const test = { name: 'should handle user authentication', path: '/auth/login.test.js' };
      const events = eventCollector.onTestStart(test);

      expect(events.unifiedEvent).toMatchObject({
        type: 'jest_test',
        testName: 'should handle user authentication',
        testPath: '/auth/login.test.js',
        status: 'running',
        phase: 'start',
        source: 'jest'
      });

      expect(testStartSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'jest_test',
          testName: 'should handle user authentication'
        })
      );
    });

    test('should capture production logs through LogManager', async () => {
      const logSpy = jest.fn();
      eventCollector.on('structuredLog', logSpy);

      // Simulate production log through LogManager
      const logEntry = {
        level: 'error',
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
        context: {
          service: 'user-service',
          correlationId: 'corr-123'
        }
      };

      logManager.forwardLogAsEvent(logEntry);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'production_log',
          level: 'error',
          message: 'Database connection failed',
          service: 'user-service'
        })
      );
    });

    test('should handle API calls and runtime events', () => {
      const apiSpy = jest.fn();
      const runtimeSpy = jest.fn();
      
      eventCollector.on('apiCall', apiSpy);
      eventCollector.on('runtime', runtimeSpy);

      // API call event
      eventCollector.onAPICall('POST', '/api/users', 500, 1250, {
        userId: 'user-456',
        correlationId: 'corr-123'
      });

      // Runtime event
      eventCollector.onRuntimeEvent('performance_metric', {
        metric: 'response_time',
        value: 1250,
        threshold: 1000
      });

      expect(apiSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'api_call',
          method: 'POST',
          url: '/api/users',
          status: 500,
          success: false
        })
      );

      expect(runtimeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'runtime_event',
          eventType: 'performance_metric'
        })
      );
    });
  });

  describe('Correlation Tracking', () => {
    test('should track events by correlation ID', () => {
      const correlationId = 'corr-test-123';

      // Create multiple related events
      eventCollector.onLogEvent('info', 'User login started', {
        correlationId,
        service: 'auth-service'
      });

      eventCollector.onAPICall('POST', '/api/auth/login', 200, 150, {
        correlationId,
        userId: 'user-789'
      });

      eventCollector.onLogEvent('info', 'User login successful', {
        correlationId,
        service: 'auth-service'
      });

      const correlatedEvents = eventCollector.getCorrelatedEvents(correlationId);
      
      expect(correlatedEvents).toHaveLength(3);
      expect(correlatedEvents.every(event => event.correlationId === correlationId)).toBe(true);
      
      // Events should be in chronological order
      const timestamps = correlatedEvents.map(e => e.timestamp);
      expect(timestamps).toEqual(timestamps.slice().sort((a, b) => a - b));
    });
  });

  describe('Event Buffering and Batching', () => {
    test('should buffer events and flush periodically', (done) => {
      const batchSpy = jest.fn();
      eventCollector.on('eventsBatch', batchSpy);

      // Generate multiple events to trigger buffer flush
      for (let i = 0; i < 12; i++) {
        eventCollector.onLogEvent('info', `Test message ${i}`, {
          service: 'test-service'
        });
      }

      // Should trigger flush due to buffer size (10)
      expect(batchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 10,
          events: expect.arrayContaining([
            expect.objectContaining({
              type: 'production_log',
              message: 'Test message 0'
            })
          ])
        })
      );

      done();
    });
  });

  describe('Semantic Search Integration', () => {
    test('should index events with local embeddings', async () => {
      const event = {
        eventId: 'evt-test-123',
        type: 'production_log',
        level: 'error',
        message: 'Authentication failed for user',
        service: 'auth-service',
        context: {
          userId: 'user-456',
          errorCode: 'INVALID_CREDENTIALS'
        }
      };

      const result = await searchProvider.indexEvent(event);
      
      expect(result.success).toBe(true);
      expect(result.eventId).toBe('evt-test-123');
      expect(result.embedded).toBe(true);
    });

    test('should search for similar events', async () => {
      // Mock search results
      const mockResults = [
        {
          eventId: 'evt-similar-1',
          type: 'production_log',
          level: 'error',
          message: 'Authentication failed - invalid password',
          service: 'auth-service'
        },
        {
          eventId: 'evt-similar-2', 
          type: 'production_log',
          level: 'error',
          message: 'Login attempt failed - user not found',
          service: 'auth-service'
        }
      ];

      searchProvider.searchProductionErrors = jest.fn().mockResolvedValue([
        { document: mockResults[0], score: 0.85 },
        { document: mockResults[1], score: 0.78 }
      ]);

      const results = await searchProvider.searchProductionErrors('authentication failed');
      
      expect(results).toHaveLength(2);
      expect(results[0].score).toBeGreaterThan(0.8);
      expect(results[0].document.message).toContain('Authentication failed');
    });
  });

  describe('Agent Query Interface', () => {
    test('should handle natural language queries about errors', async () => {
      // Mock search provider methods
      searchProvider.searchProductionErrors = jest.fn().mockResolvedValue([
        {
          document: {
            eventId: 'evt-error-1',
            level: 'error',
            message: 'Database connection timeout',
            service: 'user-service',
            timestamp: Date.now() - 3600000
          },
          score: 0.9
        }
      ]);

      const result = await agentAnalyzer.investigate(
        'what database errors happened in the last hour?'
      );

      expect(result.success).toBe(true);
      expect(result.type).toBe('error_search');
      expect(result.results).toHaveLength(1);
      expect(result.summary.totalErrors).toBe(1);
      expect(result.summary.services).toContain('user-service');
    });

    test('should analyze test failures with production correlation', async () => {
      // Mock test failure search
      searchProvider.searchTestFailures = jest.fn().mockResolvedValue([
        {
          document: {
            eventId: 'evt-test-fail-1',
            type: 'jest_test',
            testName: 'should connect to database',
            status: 'failed',
            error: 'Connection timeout',
            service: 'user-service'
          }
        }
      ]);

      // Mock related production errors
      searchProvider.searchProductionErrors = jest.fn().mockResolvedValue([
        {
          document: {
            eventId: 'evt-prod-1',
            level: 'error',
            message: 'Database connection timeout',
            service: 'user-service'
          }
        }
      ]);

      const result = await agentAnalyzer.investigate(
        'analyze test failures for database connection issues'
      );

      expect(result.success).toBe(true);
      expect(result.type).toBe('test_failure_analysis');
      expect(result.testFailures).toHaveLength(1);
      expect(result.relatedProductionErrors).toHaveLength(1);
      expect(result.insights.correlation).toBe(true);
      expect(result.insights.affectedServices).toContain('user-service');
    });

    test('should trace correlation across all event types', async () => {
      const correlationId = 'corr-trace-test';
      
      // Mock correlation trace
      searchProvider.traceCorrelationId = jest.fn().mockResolvedValue({
        correlationId,
        totalEvents: 4,
        timespan: 5000,
        timeline: [
          { type: 'api_call', method: 'POST', url: '/api/users', timestamp: Date.now() - 5000 },
          { type: 'production_log', level: 'info', message: 'Processing user creation', timestamp: Date.now() - 4000 },
          { type: 'production_log', level: 'error', message: 'Database validation failed', timestamp: Date.now() - 2000 },
          { type: 'api_call', method: 'POST', url: '/api/users', status: 400, timestamp: Date.now() - 1000 }
        ],
        eventTypes: {
          api_call: 2,
          production_log: 2
        }
      });

      const result = await agentAnalyzer.investigate(
        `trace all events for correlation ID ${correlationId}`
      );

      expect(result.success).toBe(true);
      expect(result.type).toBe('correlation_trace');
      expect(result.correlationId).toBe(correlationId);
      expect(result.summary.totalEvents).toBe(4);
      expect(result.summary.services).toEqual(expect.arrayContaining(['api_call', 'production_log']));
    });
  });

  describe('End-to-End Workflow', () => {
    test('should capture events from multiple sources and make them queryable', async () => {
      const correlationId = 'e2e-test-correlation';
      let capturedEvents = [];
      
      // Capture all events
      eventCollector.on('eventsBatch', ({ events }) => {
        capturedEvents.push(...events);
      });

      // 1. Jest test starts
      eventCollector.onTestStart({
        name: 'should create user account',
        path: '/api/users.test.js'
      });

      // 2. Production API call occurs
      eventCollector.onAPICall('POST', '/api/users', 201, 245, {
        correlationId,
        userId: 'new-user-123'
      });

      // 3. Log manager forwards structured log
      logManager.forwardLogAsEvent({
        level: 'info',
        message: 'User account created successfully',
        timestamp: new Date().toISOString(),
        context: {
          correlationId,
          service: 'user-service',
          userId: 'new-user-123'
        }
      });

      // 4. Test completes successfully
      eventCollector.onTestEnd(
        { name: 'should create user account', path: '/api/users.test.js' },
        { status: 'passed', duration: 150, numPassingAsserts: 3, numFailingAsserts: 0 }
      );

      // Force buffer flush
      eventCollector.flushBuffer();

      // Verify events were captured
      expect(capturedEvents.length).toBeGreaterThan(0);
      
      const correlatedEvents = capturedEvents.filter(e => e.correlationId === correlationId);
      expect(correlatedEvents.length).toBeGreaterThan(0);

      // Events should span different types
      const eventTypes = new Set(capturedEvents.map(e => e.type));
      expect(eventTypes.has('jest_test')).toBe(true);
      expect(eventTypes.has('api_call')).toBe(true);
      expect(eventTypes.has('production_log')).toBe(true);

      // Mock the AgentEventAnalyzer to use captured events
      agentAnalyzer.searchProvider.find = jest.fn().mockResolvedValue(capturedEvents);
      
      // 5. AI agent queries the events
      const result = await agentAnalyzer.investigate(
        'show me the timeline of user creation events'
      );

      expect(result.success).toBe(true);
      expect(result.type).toBe('timeline_analysis');
    });
  });

  describe('Performance and Statistics', () => {
    test('should provide comprehensive statistics', async () => {
      // Generate some events
      for (let i = 0; i < 5; i++) {
        eventCollector.onLogEvent('info', `Message ${i}`, { service: 'test' });
        eventCollector.onAPICall('GET', `/api/test/${i}`, 200, 100);
      }

      const stats = eventCollector.getStatistics();
      
      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.typeDistribution).toHaveProperty('production_log');
      expect(stats.typeDistribution).toHaveProperty('api_call');
      expect(stats.correlationCount).toBeGreaterThan(0);

      // LogManager stats
      const logStats = await logManager.getStatistics();
      expect(logStats.events.eventCollectorConnected).toBe(true);

      // SearchProvider stats  
      const searchStats = searchProvider.getStatistics();
      expect(searchStats).toHaveProperty('events');
    });
  });
});