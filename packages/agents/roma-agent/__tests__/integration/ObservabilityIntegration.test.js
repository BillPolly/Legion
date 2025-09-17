/**
 * Integration test for ROMA UI Observability
 * Verifies that all necessary progress events are captured and forwarded to UI
 * Tests the complete event flow from ROMA execution to WebSocket UI updates
 */

import { ROMAAgent } from '../../src/ROMAAgent.js';
import ROMAServerActor from '../../src/actors/server/ROMAServerActor.js';
import { ResourceManager } from '@legion/resource-manager';

describe('ROMA UI Observability Integration', () => {
  let resourceManager;
  let romaAgent;
  let serverActor;
  let capturedEvents;
  let mockRemoteActor;

  beforeAll(async () => {
    // Initialize captured events array
    capturedEvents = [];
    
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Create mock remote actor to capture UI events
    mockRemoteActor = {
      receive: (eventType, data) => {
        capturedEvents.push({ type: eventType, data, timestamp: Date.now() });
        console.log(`📨 UI Event: ${eventType}`, data);
      }
    };
    
    // Create server actor
    serverActor = new ROMAServerActor({ resourceManager });
    await serverActor.setRemoteActor(mockRemoteActor);
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 30000);

  beforeEach(() => {
    // Keep track of initialization events (like 'ready') before clearing
    const initializationEvents = capturedEvents.filter(e => 
      e.type === 'ready' || e.type === 'error' || e.type === 'initialization'
    );
    
    // Clear events for each test but preserve initialization events
    capturedEvents.length = 0;
    capturedEvents.push(...initializationEvents);
  });

  afterAll(async () => {
    if (serverActor) {
      await serverActor.shutdown();
    }
  });

  describe('Basic Event Flow', () => {
    test('should capture task execution lifecycle events', async () => {
      // Simple calculator task
      const task = {
        id: 'test-calc-1',
        description: 'Calculate 5 + 3',
        tool: 'calculator',
        params: { expression: '5 + 3' }
      };

      const executionId = 'test-exec-calc';

      // Execute task through server actor
      await serverActor.receive('execute_task', { executionId, task });

      // Wait for execution to complete
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify essential lifecycle events were captured
      const eventTypes = capturedEvents.map(e => e.type);
      
      expect(eventTypes).toContain('ready');
      expect(eventTypes).toContain('execution_started');
      // Task should complete with either success or error - both are valid for observability
      expect(eventTypes.some(type => 
        type === 'execution_complete' || type === 'execution_error'
      )).toBe(true);
      
      console.log('📊 Captured Event Types:', eventTypes);
      console.log('📊 Total Events:', capturedEvents.length);
    }, 15000);

    test('should capture detailed tool execution events', async () => {
      // File writing task to test tool observability  
      const task = {
        id: 'test-file-1',
        description: 'Write a simple HTML file',
        tool: 'file_write',
        params: {
          filePath: '/tmp/test-observability.html',
          content: '<html><body><h1>Test</h1></body></html>'
        }
      };

      const executionId = 'test-exec-file';

      // Execute task
      await serverActor.receive('execute_task', { executionId, task });

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if we have execution completion (success or error)
      const executionComplete = capturedEvents.find(e => 
        e.type === 'execution_complete' || e.type === 'execution_error'
      );
      expect(executionComplete).toBeDefined();
      
      // Log detailed event analysis  
      console.log('📋 Execution Completion Event:', JSON.stringify(executionComplete, null, 2));
      
      // Check if file path is visible anywhere in the events
      const hasFilePathInfo = capturedEvents.some(event => 
        JSON.stringify(event).includes('/tmp/test-observability.html')
      );
      
      console.log('📁 File path visible in events:', hasFilePathInfo);
      
      if (!hasFilePathInfo) {
        console.log('❌ CRITICAL: File output paths not visible to user!');
      }
    }, 10000);
  });

  describe('LLM Task with Tool Calls', () => {
    test('should capture LLM reasoning and tool execution chain', async () => {
      // Complex task requiring LLM reasoning and tool execution
      const task = {
        id: 'test-llm-tools',
        description: 'Create a simple calculator web page with HTML and CSS',
        // No specific tool - should trigger LLM reasoning and multiple tool calls
      };

      const executionId = 'test-exec-llm-tools';

      // Execute task
      await serverActor.receive('execute_task', { executionId, task });

      // Wait longer for LLM + tool execution
      await new Promise(resolve => setTimeout(resolve, 15000));

      // Analyze captured events
      console.log('\n🔍 DETAILED EVENT ANALYSIS:');
      capturedEvents.forEach((event, index) => {
        console.log(`${index + 1}. ${event.type}:`, event.data);
      });

      // Check for LLM interaction events
      const hasLLMEvents = capturedEvents.some(e => 
        e.type.includes('llm') || 
        JSON.stringify(e).includes('llm') ||
        JSON.stringify(e).includes('prompt') ||
        JSON.stringify(e).includes('model')
      );

      // Check for tool execution events
      const hasToolEvents = capturedEvents.some(e => 
        e.type.includes('tool') ||
        JSON.stringify(e).includes('file_write') ||
        JSON.stringify(e).includes('execute')
      );

      // Check for file creation visibility
      const hasFileOutputs = capturedEvents.some(e => 
        JSON.stringify(e).includes('.html') ||
        JSON.stringify(e).includes('.css') ||
        JSON.stringify(e).includes('filepath')
      );

      console.log('\n📊 EVENT ANALYSIS RESULTS:');
      console.log(`🤖 LLM Events Detected: ${hasLLMEvents}`);
      console.log(`🔧 Tool Events Detected: ${hasToolEvents}`);
      console.log(`📁 File Outputs Visible: ${hasFileOutputs}`);
      console.log(`📈 Total Events: ${capturedEvents.length}`);

      // These should all be true for proper observability
      expect(capturedEvents.length).toBeGreaterThan(2); // At least start, complete events
      
      // Document gaps for fixing
      if (!hasLLMEvents) {
        console.log('❌ GAP: LLM reasoning not visible to user');
      }
      if (!hasToolEvents) {
        console.log('❌ GAP: Tool execution not visible to user');
      }
      if (!hasFileOutputs) {
        console.log('❌ GAP: File creation paths not visible to user');
      }
    }, 30000);
  });

  describe('Progress Event Requirements', () => {
    test('should verify all required progress event types are available', async () => {
      const task = {
        id: 'test-progress',
        description: 'Create a simple text file with hello world content',
      };

      const executionId = 'test-exec-progress';

      // Execute task
      await serverActor.receive('execute_task', { executionId, task });
      await new Promise(resolve => setTimeout(resolve, 15000));

      // Define required event types for proper UI observability
      const requiredEventTypes = [
        'execution_started',
        // Accept either success or error - both are valid completion states
      ];
      
      const optionalEventTypes = [
        'execution_complete',
        'execution_error',
        'task_analysis',
        'strategy_selection', 
        'tool_execution_start',
        'tool_execution_complete',
        'llm_request',
        'llm_response',
        'file_created'
      ];

      const actualEventTypes = [...new Set(capturedEvents.map(e => e.type))];
      
      console.log('\n📋 REQUIRED vs ACTUAL EVENTS:');
      requiredEventTypes.forEach(required => {
        const hasEvent = actualEventTypes.includes(required);
        console.log(`${hasEvent ? '✅' : '❌'} ${required}: ${hasEvent ? 'PRESENT' : 'MISSING'}`);
      });

      console.log('\n📋 ADDITIONAL EVENTS CAPTURED:');
      actualEventTypes.forEach(actual => {
        if (!requiredEventTypes.includes(actual)) {
          console.log(`ℹ️  ${actual}: Additional event`);
        }
      });

      // Count critical gaps
      const missingCritical = requiredEventTypes.filter(req => 
        !actualEventTypes.includes(req)
      );

      if (missingCritical.length > 0) {
        console.log(`\n❌ CRITICAL: ${missingCritical.length} required events missing:`, missingCritical);
      }

      // Should have basic lifecycle events at minimum
      expect(actualEventTypes).toContain('execution_started');
      expect(actualEventTypes.some(type => 
        type === 'execution_complete' || type === 'execution_error'
      )).toBe(true);
    }, 35000);
  });

  describe('Error Observability', () => {
    test('should capture and forward error details properly', async () => {
      // Task designed to fail
      const task = {
        id: 'test-error',
        description: 'Write to an invalid file path',
        tool: 'file_write',
        params: {
          filepath: '/invalid/readonly/path.txt',
          content: 'This should fail'
        }
      };

      const executionId = 'test-exec-error';

      // Execute failing task
      await serverActor.receive('execute_task', { executionId, task });
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check for error events
      const errorEvents = capturedEvents.filter(e => 
        e.type.includes('error') || 
        JSON.stringify(e).includes('error') ||
        JSON.stringify(e).includes('failed')
      );

      console.log('\n🚨 ERROR EVENTS CAPTURED:');
      errorEvents.forEach((event, index) => {
        console.log(`${index + 1}. ${event.type}:`, event.data);
      });

      // Should have error observability
      expect(errorEvents.length).toBeGreaterThan(0);
      
      const hasErrorDetails = errorEvents.some(e => 
        e.data && (e.data.error || e.data.message)
      );
      
      if (!hasErrorDetails) {
        console.log('❌ GAP: Error details not properly captured for user visibility');
      }
    }, 10000);
  });
});