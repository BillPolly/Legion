/**
 * Integration test for LLM event forwarding in DecentPlanner
 */

import { DecentPlanner } from '../../src/DecentPlanner.js';
import { ResourceManager } from '@legion/resource-manager';

describe('LLM Event Forwarding Integration', () => {
  let planner;
  let capturedEvents;
  let eventCallback;

  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    
    planner = new DecentPlanner({
      maxDepth: 2,
      confidenceThreshold: 0.5,
      enableFormalPlanning: true,
      validateBehaviorTrees: true,
      logLevel: 'info'
    });

    capturedEvents = [];
    eventCallback = (event) => {
      capturedEvents.push(event);
      console.log(`[TEST] Captured LLM event: ${event.type} - ${event.id}`);
    };

    planner.setLLMEventForwardingCallback(eventCallback);
    await planner.initialize();
  }, 30000);

  beforeEach(() => {
    capturedEvents = [];
  });

  test('should capture LLM events during task decomposition without duplicates', async () => {
    const goal = 'Create a simple Node.js HTTP server';

    console.log('[TEST] Starting planning...');
    const result = await planner.planTaskDecompositionOnly(goal);

    console.log(`[TEST] Planning result: ${result.success}`);
    console.log(`[TEST] Captured ${capturedEvents.length} events`);
    
    capturedEvents.forEach((event, i) => {
      console.log(`[TEST] Event ${i + 1}: type=${event.type}, id=${event.id}, hasPrompt=${!!event.prompt}, hasResponse=${!!event.response}`);
    });

    expect(result.success).toBe(true);
    expect(capturedEvents.length).toBeGreaterThan(0);

    console.log(`[TEST] Captured ${capturedEvents.length} complete LLM interactions`);

    // All events should be complete interactions with both prompt and response
    for (const event of capturedEvents) {
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('prompt');
      expect(event).toHaveProperty('response');
      expect(event).toHaveProperty('model');
      expect(event).toHaveProperty('provider');
      console.log(`[TEST] Complete interaction ${event.id}: prompt=${event.prompt?.length}chars, response=${event.response?.length}chars`);
    }

    // Verify no duplicates by checking unique IDs
    const allIds = capturedEvents.map(e => e.id);
    const uniqueIds = [...new Set(allIds)];
    expect(allIds.length).toBe(uniqueIds.length);
  }, 60000);

  test('should capture LLM events during tool discovery', async () => {
    const goal = 'Create a simple Node.js HTTP server';

    await planner.planTaskDecompositionOnly(goal);
    capturedEvents = [];

    const result = await planner.discoverToolsForCurrentPlan();

    expect(result.success).toBe(true);
    
    console.log(`[TEST] Tool discovery captured ${capturedEvents.length} events`);
  }, 60000);

  test('should capture LLM events during full formal planning', async () => {
    const goal = 'Write a simple hello world program';

    const result = await planner.plan(goal);

    expect(result.success).toBe(true);
    expect(capturedEvents.length).toBeGreaterThan(0);

    const requestEvents = capturedEvents.filter(e => e.type === 'request');
    const responseEvents = capturedEvents.filter(e => e.type === 'response');

    expect(requestEvents.length).toBeGreaterThan(0);
    expect(responseEvents.length).toBeGreaterThan(0);

    console.log(`[TEST] Full planning captured ${capturedEvents.length} total events`);
    console.log(`[TEST] Requests: ${requestEvents.length}, Responses: ${responseEvents.length}`);

    requestEvents.forEach((event, i) => {
      console.log(`[TEST] Request ${i + 1}: ${event.prompt.substring(0, 100)}...`);
    });
  }, 120000);
});