/**
 * Integration tests for Agent event system
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { Agent } from '../../src/Agent.js';
import { Module } from '@legion/module-loader';
import Tool from '@legion/module-loader/src/tool/Tool.js';
import { EventEmitter } from 'events';

// Mock Tool class for testing
class MockTool extends Tool {
  constructor(name) {
    super();
    this.name = name;
    this.description = `Mock tool: ${name}`;
  }

  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        },
        output: {
          success: { type: 'object' },
          failure: { type: 'object' }
        }
      }
    };
  }

  async invoke(toolCall) {
    return { success: true, data: { result: 'mock result' } };
  }
}

// Mock Module class for testing
class MockModule extends Module {
  constructor(name) {
    super();
    this.name = name;
    
    // Add some test tools
    const tool1 = new MockTool(`${name}Tool1`);
    const tool2 = new MockTool(`${name}Tool2`);
    
    this.registerTool(`${name}Tool1`, tool1);
    this.registerTool(`${name}Tool2`, tool2);
  }

  async simulateWorkflow() {
    this.emitInfo('Starting workflow', { workflowId: 'test-workflow' });
    
    this.emitProgress('Step 1: Initialization', { step: 1, total: 3 });
    await new Promise(resolve => setTimeout(resolve, 10));
    
    this.emitProgress('Step 2: Processing', { step: 2, total: 3 });
    await new Promise(resolve => setTimeout(resolve, 10));
    
    this.emitProgress('Step 3: Finalization', { step: 3, total: 3 });
    await new Promise(resolve => setTimeout(resolve, 10));
    
    this.emitInfo('Workflow completed successfully', { 
      workflowId: 'test-workflow',
      result: 'success' 
    });
  }

  async simulateError() {
    this.emitInfo('Starting error simulation');
    
    this.emitProgress('Processing...', { step: 1, total: 2 });
    await new Promise(resolve => setTimeout(resolve, 10));
    
    this.emitError('Simulation error occurred', { 
      errorCode: 'SIM_ERROR',
      context: 'error simulation'
    });
  }
}

describe('Agent Event System Integration', () => {
  let agent;
  let moduleEvents;
  let specificEvents;
  
  beforeEach(() => {
    // Create agent with minimal config
    agent = new Agent({
      name: 'TestAgent',
      bio: 'Test agent for event system',
      modelConfig: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key'
      }
    });
    
    // Collect all module events
    moduleEvents = [];
    agent.on('module-event', (event) => moduleEvents.push(event));
    
    // Collect specific event types
    specificEvents = {
      progress: [],
      warning: [],
      error: [],
      info: []
    };
    
    Object.keys(specificEvents).forEach(eventType => {
      agent.on(`module-${eventType}`, (event) => {
        specificEvents[eventType].push(event);
      });
    });
  });

  describe('Agent EventEmitter inheritance', () => {
    test('should extend EventEmitter', () => {
      expect(agent).toBeInstanceOf(EventEmitter);
    });

    test('should be able to emit and listen to custom events', () => {
      const testEvent = { message: 'test' };
      const listener = jest.fn();
      
      agent.on('test-event', listener);
      agent.emit('test-event', testEvent);
      
      expect(listener).toHaveBeenCalledWith(testEvent);
    });

    test('should support multiple listeners for the same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      agent.on('module-event', listener1);
      agent.on('module-event', listener2);
      
      const module = new MockModule('TestModule');
      agent.registerModule(module);
      
      module.emitInfo('Test message');
      
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('Module registration and event relay', () => {
    test('should register module and relay events', () => {
      const module = new MockModule('TestModule');
      
      agent.registerModule(module);
      
      expect(agent.modules).toContain(module);
      expect(agent.modules).toHaveLength(1);
      
      // Emit an event from the module
      module.emitInfo('Test message', { testData: 'value' });
      
      // Check that event was relayed
      expect(moduleEvents).toHaveLength(1);
      expect(moduleEvents[0]).toMatchObject({
        type: 'info',
        module: 'TestModule',
        tool: null,
        message: 'Test message',
        data: { testData: 'value' },
        agentId: 'TestAgent',
        agentName: 'TestAgent'
      });
    });

    test('should register multiple modules', () => {
      const module1 = new MockModule('Module1');
      const module2 = new MockModule('Module2');
      
      agent.registerModules([module1, module2]);
      
      expect(agent.modules).toHaveLength(2);
      expect(agent.modules).toContain(module1);
      expect(agent.modules).toContain(module2);
      
      // Emit events from both modules
      module1.emitInfo('Message from module 1');
      module2.emitWarning('Warning from module 2');
      
      expect(moduleEvents).toHaveLength(2);
      expect(moduleEvents[0].module).toBe('Module1');
      expect(moduleEvents[1].module).toBe('Module2');
    });

    test('should unregister module', () => {
      const module = new MockModule('TestModule');
      
      agent.registerModule(module);
      expect(agent.modules).toHaveLength(1);
      
      agent.unregisterModule(module);
      expect(agent.modules).toHaveLength(0);
      
      // Events should no longer be relayed
      module.emitInfo('Message after unregister');
      expect(moduleEvents).toHaveLength(0);
    });

    test('should handle registration of invalid modules gracefully', () => {
      expect(() => {
        agent.registerModule(null);
        agent.registerModule(undefined);
        agent.registerModule({});
        agent.registerModule({ name: 'invalid' });
      }).not.toThrow();
      
      expect(agent.modules).toHaveLength(0);
    });
  });

  describe('Event enrichment with agent context', () => {
    test('should add agent information to relayed events', () => {
      const module = new MockModule('TestModule');
      agent.registerModule(module);
      
      module.emitProgress('Progress message', { step: 1 });
      
      const event = moduleEvents[0];
      expect(event).toMatchObject({
        type: 'progress',
        module: 'TestModule',
        message: 'Progress message',
        data: { step: 1 },
        agentId: 'TestAgent',
        agentName: 'TestAgent',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      });
    });

    test('should preserve original event structure while adding agent context', () => {
      const module = new MockModule('TestModule');
      agent.registerModule(module);
      
      const originalData = {
        nested: { value: 123 },
        array: [1, 2, 3],
        boolean: true
      };
      
      module.emitError('Test error', originalData);
      
      const event = moduleEvents[0];
      expect(event.data).toEqual(originalData);
      expect(event.agentId).toBe('TestAgent');
      expect(event.agentName).toBe('TestAgent');
    });
  });

  describe('Specific event type handling', () => {
    test('should emit both generic and specific events', () => {
      const module = new MockModule('TestModule');
      agent.registerModule(module);
      
      module.emitProgress('Progress message');
      module.emitWarning('Warning message');
      module.emitError('Error message');
      module.emitInfo('Info message');
      
      // Check generic events
      expect(moduleEvents).toHaveLength(4);
      expect(moduleEvents.map(e => e.type)).toEqual(['progress', 'warning', 'error', 'info']);
      
      // Check specific events
      expect(specificEvents.progress).toHaveLength(1);
      expect(specificEvents.warning).toHaveLength(1);
      expect(specificEvents.error).toHaveLength(1);
      expect(specificEvents.info).toHaveLength(1);
      
      // Verify specific events have agent context
      expect(specificEvents.progress[0]).toMatchObject({
        type: 'progress',
        message: 'Progress message',
        agentId: 'TestAgent',
        agentName: 'TestAgent'
      });
    });
  });

  describe('Tool event propagation through modules', () => {
    test('should relay tool events through module to agent', () => {
      const module = new MockModule('TestModule');
      agent.registerModule(module);
      
      const tool = module.tools[0]; // Get the first tool
      
      // Tool emits event
      tool.emitInfo('Tool message', { toolData: 'value' });
      
      expect(moduleEvents).toHaveLength(1);
      expect(moduleEvents[0]).toMatchObject({
        type: 'info',
        module: 'TestModule',
        tool: 'TestModuleTool1',
        message: 'Tool message',
        data: { toolData: 'value' },
        agentId: 'TestAgent',
        agentName: 'TestAgent'
      });
    });

    test('should handle events from multiple tools in same module', () => {
      const module = new MockModule('TestModule');
      agent.registerModule(module);
      
      const tool1 = module.tools[0];
      const tool2 = module.tools[1];
      
      tool1.emitProgress('Tool 1 progress');
      tool2.emitWarning('Tool 2 warning');
      
      expect(moduleEvents).toHaveLength(2);
      expect(moduleEvents[0].tool).toBe('TestModuleTool1');
      expect(moduleEvents[1].tool).toBe('TestModuleTool2');
    });
  });

  describe('Complex workflow scenarios', () => {
    test('should handle complete workflow with multiple events', async () => {
      const module = new MockModule('WorkflowModule');
      agent.registerModule(module);
      
      await module.simulateWorkflow();
      
      expect(moduleEvents).toHaveLength(5); // 2 info + 3 progress
      
      // Check event sequence
      expect(moduleEvents[0]).toMatchObject({
        type: 'info',
        message: 'Starting workflow',
        data: { workflowId: 'test-workflow' }
      });
      
      expect(moduleEvents[1]).toMatchObject({
        type: 'progress',
        message: 'Step 1: Initialization',
        data: { step: 1, total: 3 }
      });
      
      expect(moduleEvents[4]).toMatchObject({
        type: 'info',
        message: 'Workflow completed successfully',
        data: { workflowId: 'test-workflow', result: 'success' }
      });
    });

    test('should handle error scenarios', async () => {
      const module = new MockModule('ErrorModule');
      agent.registerModule(module);
      
      await module.simulateError();
      
      expect(moduleEvents).toHaveLength(3); // 1 info + 1 progress + 1 error
      
      const errorEvent = moduleEvents.find(e => e.type === 'error');
      expect(errorEvent).toMatchObject({
        type: 'error',
        message: 'Simulation error occurred',
        data: { errorCode: 'SIM_ERROR', context: 'error simulation' }
      });
    });

    test('should handle concurrent workflows from multiple modules', async () => {
      const module1 = new MockModule('Module1');
      const module2 = new MockModule('Module2');
      
      agent.registerModules([module1, module2]);
      
      // Run workflows concurrently
      await Promise.all([
        module1.simulateWorkflow(),
        module2.simulateWorkflow()
      ]);
      
      expect(moduleEvents).toHaveLength(10); // 5 events from each module
      
      // Check that events from both modules are present
      const module1Events = moduleEvents.filter(e => e.module === 'Module1');
      const module2Events = moduleEvents.filter(e => e.module === 'Module2');
      
      expect(module1Events).toHaveLength(5);
      expect(module2Events).toHaveLength(5);
    });
  });

  describe('Event ordering and timing', () => {
    test('should maintain event ordering from single module', async () => {
      const module = new MockModule('OrderModule');
      agent.registerModule(module);
      
      // Emit events in specific order
      module.emitInfo('First event');
      module.emitProgress('Second event');
      module.emitWarning('Third event');
      module.emitError('Fourth event');
      
      expect(moduleEvents).toHaveLength(4);
      expect(moduleEvents[0].message).toBe('First event');
      expect(moduleEvents[1].message).toBe('Second event');
      expect(moduleEvents[2].message).toBe('Third event');
      expect(moduleEvents[3].message).toBe('Fourth event');
    });

    test('should handle rapid event emission', () => {
      const module = new MockModule('RapidModule');
      agent.registerModule(module);
      
      // Emit many events rapidly
      for (let i = 0; i < 100; i++) {
        module.emitInfo(`Event ${i}`, { index: i });
      }
      
      expect(moduleEvents).toHaveLength(100);
      
      // Check that all events are properly ordered
      moduleEvents.forEach((event, index) => {
        expect(event.message).toBe(`Event ${index}`);
        expect(event.data.index).toBe(index);
      });
    });
  });

  describe('Error handling and edge cases', () => {
    test('should handle module that emits invalid events', () => {
      const module = new MockModule('InvalidModule');
      agent.registerModule(module);
      
      expect(() => {
        module.emitEvent('', 'Empty event type');
        module.emitEvent(null, 'Null event type');
        module.emitEvent('info', null);
        module.emitEvent('info', undefined);
      }).not.toThrow();
      
      expect(moduleEvents).toHaveLength(4);
    });

    test('should handle modules that are unregistered during event emission', () => {
      const module = new MockModule('UnregisterModule');
      agent.registerModule(module);
      
      // Start emitting events
      module.emitInfo('Before unregister');
      
      // Unregister module
      agent.unregisterModule(module);
      
      // Try to emit more events (should not be received)
      module.emitInfo('After unregister');
      
      expect(moduleEvents).toHaveLength(1);
      expect(moduleEvents[0].message).toBe('Before unregister');
    });

    test('should handle agent with different name formats', () => {
      const agentWithSpecialName = new Agent({
        name: 'agent-with-special-chars_123',
        bio: 'Test agent',
        modelConfig: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: 'test-key'
        }
      });
      
      const specialEvents = [];
      agentWithSpecialName.on('module-event', (event) => specialEvents.push(event));
      
      const module = new MockModule('SpecialModule');
      agentWithSpecialName.registerModule(module);
      
      module.emitInfo('Special agent event');
      
      expect(specialEvents).toHaveLength(1);
      expect(specialEvents[0].agentId).toBe('agent-with-special-chars_123');
      expect(specialEvents[0].agentName).toBe('agent-with-special-chars_123');
    });
  });

  describe('Memory management and performance', () => {
    test('should not leak memory with many modules', () => {
      const modules = [];
      
      // Register many modules
      for (let i = 0; i < 50; i++) {
        const module = new MockModule(`Module${i}`);
        modules.push(module);
        agent.registerModule(module);
      }
      
      expect(agent.modules).toHaveLength(50);
      
      // Each module emits an event
      modules.forEach((module, index) => {
        module.emitInfo(`Message from module ${index}`);
      });
      
      expect(moduleEvents).toHaveLength(50);
      
      // Unregister all modules
      modules.forEach(module => agent.unregisterModule(module));
      
      expect(agent.modules).toHaveLength(0);
    });

    test('should handle high-frequency event emission efficiently', () => {
      const module = new MockModule('HighFrequencyModule');
      agent.registerModule(module);
      
      const startTime = Date.now();
      
      // Emit many events
      for (let i = 0; i < 1000; i++) {
        module.emitInfo(`High frequency event ${i}`);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(moduleEvents).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Event listener management', () => {
    test('should support adding and removing event listeners', () => {
      const module = new MockModule('ListenerModule');
      agent.registerModule(module);
      
      const customListener = jest.fn();
      agent.on('module-event', customListener);
      
      module.emitInfo('Test message');
      
      expect(customListener).toHaveBeenCalled();
      expect(moduleEvents).toHaveLength(1);
      
      // Remove listener
      agent.removeListener('module-event', customListener);
      
      module.emitInfo('Another test message');
      
      expect(customListener).toHaveBeenCalledTimes(1); // Should not be called again
      expect(moduleEvents).toHaveLength(2); // Original listener still works
    });

    test('should handle listener errors gracefully', () => {
      const module = new MockModule('ErrorListenerModule');
      agent.registerModule(module);
      
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      
      agent.on('module-event', errorListener);
      
      // EventEmitter will throw if a listener throws, so we need to catch it
      expect(() => {
        module.emitInfo('Test message');
      }).toThrow('Listener error');
      
      expect(errorListener).toHaveBeenCalled();
      // The moduleEvents listener should still have captured the event before the error
      expect(moduleEvents).toHaveLength(1);
    });
  });
});