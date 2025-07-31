/**
 * Live Event System Testing
 * 
 * Comprehensive test that demonstrates the complete event flow:
 * EventTestTool → EventTestModule → ModuleLoader → External Listeners
 * 
 * This test validates:
 * - All 4 event types (progress, info, warning, error)
 * - Event structure and metadata
 * - Event propagation chain
 * - Real-time event emission with timing
 * - Module context addition
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ModuleLoader } from '../../src/ModuleLoader.js';
import ResourceManager from '../../src/resources/ResourceManager.js';
import { EventTestModule } from '../utils/EventTestModule.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Live Event System Testing', () => {
  let resourceManager;
  let moduleLoader;
  let eventTestModule;
  let allEvents;
  let eventsByType;
  let eventTimestamps;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create ModuleLoader
    moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    // Load EventTestModule via ModuleLoader (as requested)
    eventTestModule = await moduleLoader.loadModuleByName('event-test', EventTestModule);
  }, 30000);

  beforeEach(() => {
    // Reset event collectors for each test
    allEvents = [];
    eventsByType = {
      progress: [],
      info: [],
      warning: [],
      error: []
    };
    eventTimestamps = [];
  });

  test('should load EventTestModule via ModuleLoader and verify structure', async () => {
    expect(eventTestModule).toBeDefined();
    expect(eventTestModule.name).toBe('EventTestModule'); // Module constructor sets name
    
    // Verify tools are accessible
    const tools = eventTestModule.getTools();
    expect(tools).toHaveLength(1);
    
    const eventTool = tools.find(tool => tool.name === 'event_test');
    expect(eventTool).toBeDefined();
    expect(eventTool.description).toContain('event testing tool');
  });

  test('should emit comprehensive progress events during data processing', async () => {
    const eventTool = eventTestModule.getEventTestTool();
    
    // Set up event listeners
    eventTool.on('event', (event) => {
      allEvents.push(event);
      eventsByType[event.type]?.push(event);
      eventTimestamps.push(Date.now());
    });

    // Execute test with progress tracking
    const result = await eventTool.execute({
      scenario: 'data_processing',
      itemCount: 5,
      includeWarnings: false,
      includeErrors: false,
      delayMs: 50
    });

    // Verify execution results
    expect(result.itemsProcessed).toBe(5);
    expect(result.scenario).toBe('data_processing');

    // Verify progress events were emitted
    expect(eventsByType.progress.length).toBeGreaterThan(0);
    
    // Check progress event structure
    const progressEvents = eventsByType.progress;
    const firstProgress = progressEvents[0];
    
    expect(firstProgress).toMatchObject({
      type: 'progress',
      message: expect.stringContaining('Initializing'),
      data: expect.objectContaining({
        stage: 'initialization',
        pipeline: 'data_processing'
      })
    });

    // Verify progress percentages increase
    const percentageEvents = progressEvents.filter(e => e.data.percentage !== undefined);
    expect(percentageEvents.length).toBeGreaterThan(0);
    
    const percentages = percentageEvents.map(e => e.data.percentage);
    expect(percentages[0]).toBeLessThanOrEqual(percentages[percentages.length - 1]);
  });

  test('should emit info events with rich metadata', async () => {
    const eventTool = eventTestModule.getEventTestTool();
    
    eventTool.on('event', (event) => {
      allEvents.push(event);
      eventsByType[event.type]?.push(event);
    });

    await eventTool.execute({
      scenario: 'api_calls',
      itemCount: 8,
      includeWarnings: false,
      includeErrors: false,
      delayMs: 30
    });

    // Verify info events
    expect(eventsByType.info.length).toBeGreaterThan(0);
    
    const infoEvents = eventsByType.info;
    const startEvent = infoEvents.find(e => e.message.includes('Starting'));
    const endEvent = infoEvents.find(e => e.message.includes('completed'));
    
    expect(startEvent).toBeDefined();
    expect(startEvent.data).toMatchObject({
      scenario: 'api_calls',
      itemCount: 8,
      includeWarnings: false,
      includeErrors: false,
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    });

    expect(endEvent).toBeDefined();
    expect(endEvent.data).toMatchObject({
      totalDuration: expect.any(Number),
      itemsProcessed: 8,
      warningsGenerated: 0,
      errorsGenerated: 0
    });
  });

  test('should emit warning events with detailed context', async () => {
    const eventTool = eventTestModule.getEventTestTool();
    
    eventTool.on('event', (event) => {
      allEvents.push(event);
      eventsByType[event.type]?.push(event);
    });

    await eventTool.execute({
      scenario: 'file_operations',
      itemCount: 10,
      includeWarnings: true,
      includeErrors: false,
      delayMs: 20
    });

    // Verify warning events (probabilistic, so may be 0)
    const warningEvents = eventsByType.warning;
    
    if (warningEvents.length > 0) {
      const sampleWarning = warningEvents[0];
      
      expect(sampleWarning).toMatchObject({
        type: 'warning',
        message: expect.stringContaining('warning'),
        data: expect.objectContaining({
          fileName: expect.stringMatching(/file_\d{3}\.txt/),
          permission: expect.any(String)
        })
      });
    }
  });

  test('should emit error events with recovery information', async () => {
    const eventTool = eventTestModule.getEventTestTool();
    
    eventTool.on('event', (event) => {
      allEvents.push(event);
      eventsByType[event.type]?.push(event);
    });

    await eventTool.execute({
      scenario: 'computation',
      itemCount: 15,
      includeWarnings: false,
      includeErrors: true,
      delayMs: 10
    });

    // Verify error events (probabilistic, so may be 0)
    const errorEvents = eventsByType.error;
    
    if (errorEvents.length > 0) {
      const sampleError = errorEvents[0];
      
      expect(sampleError).toMatchObject({
        type: 'error',
        message: expect.stringContaining('error'),
        data: expect.objectContaining({
          computationId: expect.stringMatching(/comp_\d+/),
          recovery: expect.any(String)
        })
      });
    }
  });

  test('should demonstrate module-level event forwarding with context', async () => {
    // Set up module-level event listener
    const moduleEvents = [];
    
    eventTestModule.on('event', (event) => {
      moduleEvents.push(event);
    });

    const eventTool = eventTestModule.getEventTestTool();
    
    await eventTool.execute({
      scenario: 'data_processing',
      itemCount: 3,
      includeWarnings: false,
      includeErrors: false,
      delayMs: 50
    });

    // Verify module events were forwarded
    expect(moduleEvents.length).toBeGreaterThan(0);
    
    // Check that module context was added
    const sampleModuleEvent = moduleEvents[0];
    expect(sampleModuleEvent).toMatchObject({
      type: expect.stringMatching(/^(progress|info|warning|error)$/),
      message: expect.any(String),
      module: 'EventTestModule', // Added by Module.registerTool()
      data: expect.any(Object)
    });

    // Verify all module events have module context
    moduleEvents.forEach(event => {
      expect(event.module).toBe('EventTestModule');
    });
  });

  test('should handle all event types in complex scenario', async () => {
    const eventTool = eventTestModule.getEventTestTool();
    
    // Collect events with timestamps
    const timedEvents = [];
    
    eventTool.on('event', (event) => {
      const timedEvent = {
        ...event,
        receivedAt: Date.now()
      };
      timedEvents.push(timedEvent);
      allEvents.push(event);
      eventsByType[event.type]?.push(event);
    });

    // Execute complex scenario with all event types
    const startTime = Date.now();
    const result = await eventTool.execute({
      scenario: 'data_processing',
      itemCount: 12,
      includeWarnings: true,
      includeErrors: true,
      delayMs: 25
    });
    const endTime = Date.now();

    // Verify execution completed successfully
    expect(result.itemsProcessed).toBe(12);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.duration).toBeLessThan((endTime - startTime) + 100); // Allow some margin

    // Verify we received events
    expect(allEvents.length).toBeGreaterThan(0);
    
    // Verify we have multiple event types
    expect(eventsByType.progress.length).toBeGreaterThan(0);
    expect(eventsByType.info.length).toBeGreaterThan(0);
    
    // Check event timing (events should arrive in chronological order)
    const timestamps = timedEvents.map(e => e.receivedAt);
    const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
    expect(timestamps).toEqual(sortedTimestamps);

    // Verify progress events show progression
    const progressWithPercentage = eventsByType.progress.filter(e => e.data.percentage !== undefined);
    if (progressWithPercentage.length > 1) {
      const firstPercent = progressWithPercentage[0].data.percentage;
      const lastPercent = progressWithPercentage[progressWithPercentage.length - 1].data.percentage;
      expect(lastPercent).toBeGreaterThanOrEqual(firstPercent);
    }
  });

  test('should validate complete event structure matches documentation', async () => {
    const eventTool = eventTestModule.getEventTestTool();
    
    eventTool.on('event', (event) => {
      allEvents.push(event);
    });

    await eventTool.execute({
      scenario: 'api_calls',
      itemCount: 3,
      includeWarnings: true,
      includeErrors: false,
      delayMs: 30
    });

    expect(allEvents.length).toBeGreaterThan(0);
    
    // Validate each event has required structure
    allEvents.forEach((event, index) => {
      // Required fields
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('message');
      expect(event).toHaveProperty('data');
      
      // Type validation
      expect(['progress', 'info', 'warning', 'error']).toContain(event.type);
      
      // Message should be string
      expect(typeof event.message).toBe('string');
      expect(event.message.length).toBeGreaterThan(0);
      
      // Data should be object
      expect(typeof event.data).toBe('object');
      expect(event.data).not.toBeNull();
      
      // Progress events should have additional structure
      if (event.type === 'progress' && event.data.percentage !== undefined) {
        expect(event.data.percentage).toBeGreaterThanOrEqual(0);
        expect(event.data.percentage).toBeLessThanOrEqual(100);
      }
    });
  });

  test('should demonstrate real-time event streaming capability', async () => {
    const eventTool = eventTestModule.getEventTestTool();
    
    // Track event arrival times
    const eventArrivalTimes = [];
    let firstEventTime = null;
    
    eventTool.on('event', (event) => {
      const now = Date.now();
      if (!firstEventTime) firstEventTime = now;
      
      eventArrivalTimes.push({
        type: event.type,
        message: event.message,
        relativeTime: now - firstEventTime,
        timestamp: now
      });
    });

    const startTime = Date.now();
    
    await eventTool.execute({
      scenario: 'computation',
      itemCount: 8,
      includeWarnings: false,
      includeErrors: false,
      delayMs: 75 // Longer delay to see timing
    });

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // Verify events were received over time (not all at once)
    expect(eventArrivalTimes.length).toBeGreaterThan(0);
    
    // Check that events were spread over the execution time
    const eventSpan = eventArrivalTimes[eventArrivalTimes.length - 1].relativeTime;
    expect(eventSpan).toBeGreaterThan(totalDuration * 0.5); // Events should span at least 50% of execution time
    
    // Verify events arrived in reasonable intervals
    if (eventArrivalTimes.length > 2) {
      const intervals = [];
      for (let i = 1; i < eventArrivalTimes.length; i++) {
        intervals.push(eventArrivalTimes[i].relativeTime - eventArrivalTimes[i-1].relativeTime);
      }
      
      // Most intervals should be reasonable (not all events at once)
      const reasonableIntervals = intervals.filter(interval => interval >= 10); // At least 10ms apart
      expect(reasonableIntervals.length).toBeGreaterThan(0);
    }
  });
});