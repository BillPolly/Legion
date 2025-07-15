/**
 * Unit tests for Tool event system
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import Tool from '../../src/tool/Tool.js';
import { Module } from '../../src/module/Module.js';

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

describe('Tool Event System', () => {
  let tool;
  let module;
  let events;
  
  beforeEach(() => {
    // Create tool and module
    tool = new MockTool('TestTool');
    module = new Module();
    module.name = 'TestModule';
    
    // Collect events from the module
    events = [];
    module.on('event', (e) => events.push(e));
    
    // Add error event listener to prevent unhandled error exceptions
    module.on('error', (e) => {
      // Error events are also captured by the generic 'event' listener
    });
    
    // Register tool with module
    module.registerTool('TestTool', tool);
  });

  describe('Tool initialization and module reference', () => {
    test('should have null module reference by default', () => {
      const newTool = new MockTool('NewTool');
      expect(newTool.module).toBeNull();
    });

    test('should set module reference when setModule is called', () => {
      const newTool = new MockTool('NewTool');
      const newModule = new Module();
      newModule.name = 'NewModule';
      
      newTool.setModule(newModule);
      expect(newTool.module).toBe(newModule);
    });

    test('should have module reference after registration', () => {
      expect(tool.module).toBe(module);
    });
  });

  describe('emitEvent method', () => {
    test('should emit events through parent module', () => {
      tool.emitEvent('progress', 'Test progress message', { step: 1 }, 'high');
      
      expect(events).toHaveLength(1);
      
      const event = events[0];
      expect(event).toMatchObject({
        type: 'progress',
        module: 'TestModule',
        tool: 'TestTool',
        message: 'Test progress message',
        data: { step: 1 },
        level: 'high',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      });
    });

    test('should use default level when not specified', () => {
      tool.emitEvent('info', 'Default level test', { key: 'value' });
      
      const event = events[0];
      expect(event.level).toBe('medium');
    });

    test('should handle empty data object', () => {
      tool.emitEvent('warning', 'Empty data test');
      
      const event = events[0];
      expect(event.data).toEqual({});
    });

    test('should not emit if no module reference', () => {
      const orphanTool = new MockTool('OrphanTool');
      
      // Should not throw error
      expect(() => {
        orphanTool.emitEvent('error', 'Orphan error');
      }).not.toThrow();
      
      // No events should be emitted
      expect(events).toHaveLength(0);
    });

    test('should not emit if module does not have emitEvent method', () => {
      const invalidModule = { name: 'InvalidModule' };
      tool.setModule(invalidModule);
      
      // Should not throw error
      expect(() => {
        tool.emitEvent('error', 'Invalid module error');
      }).not.toThrow();
      
      // No events should be emitted
      expect(events).toHaveLength(0);
    });

    test('should include tool name in emitted event', () => {
      tool.emitEvent('info', 'Tool name test');
      
      const event = events[0];
      expect(event.tool).toBe('TestTool');
    });

    test('should preserve complex data structures', () => {
      const complexData = {
        nested: { value: 123 },
        array: [1, 2, 3],
        function: () => 'test',
        date: new Date('2023-01-01'),
        regex: /test/g
      };
      
      tool.emitEvent('info', 'Complex data test', complexData);
      
      const event = events[0];
      expect(event.data).toEqual(complexData);
    });
  });

  describe('convenience event methods', () => {
    test('emitProgress should emit progress event with low priority', () => {
      const progressData = { percentage: 75, stage: 'processing' };
      tool.emitProgress('Processing data', progressData);
      
      const event = events[0];
      expect(event).toMatchObject({
        type: 'progress',
        module: 'TestModule',
        tool: 'TestTool',
        message: 'Processing data',
        data: progressData,
        level: 'low'
      });
    });

    test('emitWarning should emit warning event with medium priority', () => {
      const warningData = { code: 'WARN_001', context: 'validation' };
      tool.emitWarning('Validation warning', warningData);
      
      const event = events[0];
      expect(event).toMatchObject({
        type: 'warning',
        module: 'TestModule',
        tool: 'TestTool',
        message: 'Validation warning',
        data: warningData,
        level: 'medium'
      });
    });

    test('emitError should emit error event with high priority', () => {
      const errorData = { 
        errorCode: 'ERR_001', 
        context: 'execution',
        stack: 'Error stack trace'
      };
      tool.emitError('Execution failed', errorData);
      
      const event = events[0];
      expect(event).toMatchObject({
        type: 'error',
        module: 'TestModule',
        tool: 'TestTool',
        message: 'Execution failed',
        data: errorData,
        level: 'high'
      });
    });

    test('emitInfo should emit info event with low priority', () => {
      const infoData = { 
        status: 'completed', 
        duration: 1250,
        itemsProcessed: 42
      };
      tool.emitInfo('Processing completed', infoData);
      
      const event = events[0];
      expect(event).toMatchObject({
        type: 'info',
        module: 'TestModule',
        tool: 'TestTool',
        message: 'Processing completed',
        data: infoData,
        level: 'low'
      });
    });

    test('convenience methods should use default empty data when not provided', () => {
      tool.emitProgress('Progress without data');
      tool.emitWarning('Warning without data');
      tool.emitError('Error without data');
      tool.emitInfo('Info without data');
      
      expect(events).toHaveLength(4);
      
      events.forEach(event => {
        expect(event.data).toEqual({});
      });
    });

    test('convenience methods should work without module reference', () => {
      const orphanTool = new MockTool('OrphanTool');
      
      // Should not throw errors
      expect(() => {
        orphanTool.emitProgress('Orphan progress');
        orphanTool.emitWarning('Orphan warning');
        orphanTool.emitError('Orphan error');
        orphanTool.emitInfo('Orphan info');
      }).not.toThrow();
      
      // No events should be emitted
      expect(events).toHaveLength(0);
    });
  });

  describe('event emission during tool execution', () => {
    class ReportingTool extends Tool {
      constructor() {
        super();
        this.name = 'ReportingTool';
        this.description = 'Tool that reports progress during execution';
      }

      getToolDescription() {
        return {
          type: 'function',
          function: {
            name: 'reportingTool',
            description: this.description,
            parameters: {
              type: 'object',
              properties: {
                steps: { type: 'number' }
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
        const args = this.parseArguments(toolCall.function.arguments);
        const steps = args.steps || 3;
        
        this.emitInfo('Starting task execution', { totalSteps: steps });
        
        for (let i = 1; i <= steps; i++) {
          this.emitProgress(`Step ${i} of ${steps}`, { 
            step: i, 
            totalSteps: steps,
            percentage: Math.round((i / steps) * 100)
          });
          
          // Simulate some work
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        this.emitInfo('Task completed successfully', { stepsCompleted: steps });
        
        return { success: true, data: { result: 'Task completed' } };
      }
    }

    test('should emit events during tool execution', async () => {
      const reportingTool = new ReportingTool();
      module.registerTool('ReportingTool', reportingTool);
      
      const toolCall = {
        id: 'test-call-1',
        type: 'function',
        function: {
          name: 'reportingTool',
          arguments: JSON.stringify({ steps: 2 })
        }
      };
      
      await reportingTool.invoke(toolCall);
      
      expect(events).toHaveLength(4); // 1 start + 2 progress + 1 complete
      
      expect(events[0]).toMatchObject({
        type: 'info',
        message: 'Starting task execution',
        data: { totalSteps: 2 }
      });
      
      expect(events[1]).toMatchObject({
        type: 'progress',
        message: 'Step 1 of 2',
        data: { step: 1, totalSteps: 2, percentage: 50 }
      });
      
      expect(events[2]).toMatchObject({
        type: 'progress',
        message: 'Step 2 of 2',
        data: { step: 2, totalSteps: 2, percentage: 100 }
      });
      
      expect(events[3]).toMatchObject({
        type: 'info',
        message: 'Task completed successfully',
        data: { stepsCompleted: 2 }
      });
    });
  });

  describe('error handling and edge cases', () => {
    test('should handle null messages gracefully', () => {
      expect(() => {
        tool.emitEvent('info', null);
      }).not.toThrow();
      
      const event = events[0];
      expect(event.message).toBeNull();
    });

    test('should handle undefined messages gracefully', () => {
      expect(() => {
        tool.emitEvent('info', undefined);
      }).not.toThrow();
      
      const event = events[0];
      expect(event.message).toBeUndefined();
    });

    test('should handle non-string messages gracefully', () => {
      expect(() => {
        tool.emitEvent('info', 123);
        tool.emitEvent('info', { message: 'object' });
        tool.emitEvent('info', ['array', 'message']);
      }).not.toThrow();
      
      expect(events).toHaveLength(3);
      expect(events[0].message).toBe(123);
      expect(events[1].message).toEqual({ message: 'object' });
      expect(events[2].message).toEqual(['array', 'message']);
    });

    test('should handle circular references in data', () => {
      const circularData = { name: 'test' };
      circularData.self = circularData;
      
      expect(() => {
        tool.emitEvent('info', 'Circular reference test', circularData);
      }).not.toThrow();
      
      const event = events[0];
      expect(event.data).toBe(circularData);
    });

    test('should handle invalid event types gracefully', () => {
      expect(() => {
        tool.emitEvent('', 'Empty event type');
        tool.emitEvent(null, 'Null event type');
        tool.emitEvent(undefined, 'Undefined event type');
      }).not.toThrow();
      
      expect(events).toHaveLength(3);
    });

    test('should handle invalid level values gracefully', () => {
      expect(() => {
        tool.emitEvent('info', 'Invalid level', {}, 'invalid');
        tool.emitEvent('info', 'Null level', {}, null);
        tool.emitEvent('info', 'Undefined level', {}, undefined);
      }).not.toThrow();
      
      expect(events).toHaveLength(3);
      expect(events[0].level).toBe('invalid');
      expect(events[1].level).toBeNull();
      expect(events[2].level).toBe('medium'); // undefined defaults to 'medium'
    });
  });

  describe('multiple tools interaction', () => {
    test('should maintain separate event contexts for multiple tools', () => {
      const tool1 = new MockTool('Tool1');
      const tool2 = new MockTool('Tool2');
      
      module.registerTool('Tool1', tool1);
      module.registerTool('Tool2', tool2);
      
      tool1.emitInfo('Message from tool 1', { source: 'tool1' });
      tool2.emitWarning('Message from tool 2', { source: 'tool2' });
      
      expect(events).toHaveLength(2);
      
      expect(events[0]).toMatchObject({
        type: 'info',
        tool: 'Tool1',
        message: 'Message from tool 1',
        data: { source: 'tool1' }
      });
      
      expect(events[1]).toMatchObject({
        type: 'warning',
        tool: 'Tool2',
        message: 'Message from tool 2',
        data: { source: 'tool2' }
      });
    });

    test('should handle rapid event emission from multiple tools', () => {
      const tool1 = new MockTool('RapidTool1');
      const tool2 = new MockTool('RapidTool2');
      
      module.registerTool('RapidTool1', tool1);
      module.registerTool('RapidTool2', tool2);
      
      // Emit events rapidly
      for (let i = 0; i < 10; i++) {
        tool1.emitInfo(`Tool1 message ${i}`, { iteration: i });
        tool2.emitInfo(`Tool2 message ${i}`, { iteration: i });
      }
      
      expect(events).toHaveLength(20);
      
      // Check that events are properly attributed
      const tool1Events = events.filter(e => e.tool === 'RapidTool1');
      const tool2Events = events.filter(e => e.tool === 'RapidTool2');
      
      expect(tool1Events).toHaveLength(10);
      expect(tool2Events).toHaveLength(10);
      
      // Check that data is preserved correctly
      tool1Events.forEach((event, index) => {
        expect(event.data.iteration).toBe(index);
      });
      
      tool2Events.forEach((event, index) => {
        expect(event.data.iteration).toBe(index);
      });
    });
  });

  describe('tool lifecycle and cleanup', () => {
    test('should continue to emit events after module cleanup', () => {
      tool.emitInfo('Before cleanup');
      
      // Simulate module cleanup
      module.removeAllListeners();
      
      // Tool should still be able to emit (though no one is listening)
      expect(() => {
        tool.emitInfo('After cleanup');
      }).not.toThrow();
      
      // Only the first event should be recorded
      expect(events).toHaveLength(1);
      expect(events[0].message).toBe('Before cleanup');
    });

    test('should handle module reference change', () => {
      const newModule = new Module();
      newModule.name = 'NewModule';
      
      const newEvents = [];
      newModule.on('event', (e) => newEvents.push(e));
      newModule.on('error', (e) => {}); // Prevent unhandled errors
      
      tool.emitInfo('Original module message');
      
      // Change module reference
      tool.setModule(newModule);
      
      tool.emitInfo('New module message');
      
      expect(events).toHaveLength(1);
      expect(events[0].message).toBe('Original module message');
      expect(events[0].module).toBe('TestModule');
      
      expect(newEvents).toHaveLength(1);
      expect(newEvents[0].message).toBe('New module message');
      expect(newEvents[0].module).toBe('NewModule');
    });
  });

  describe('performance and memory', () => {
    test('should handle large number of events efficiently', () => {
      const startTime = Date.now();
      
      // Emit many events
      for (let i = 0; i < 1000; i++) {
        tool.emitInfo(`Event ${i}`, { index: i });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(events).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      
      // Verify all events were captured correctly
      events.forEach((event, index) => {
        expect(event.message).toBe(`Event ${index}`);
        expect(event.data.index).toBe(index);
      });
    });

    test('should not leak memory with event emission', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Emit events with large data
      for (let i = 0; i < 100; i++) {
        const largeData = {
          index: i,
          largeArray: new Array(1000).fill(i),
          largeString: 'x'.repeat(1000)
        };
        tool.emitInfo(`Large event ${i}`, largeData);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      expect(events).toHaveLength(100);
    });
  });
});