/**
 * Unit tests for Module event system
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { Module } from '../../src/module/Module.js';
import Tool from '../../src/tool/Tool.js';
import { EventEmitter } from 'events';

// Mock Tool class for testing
class MockTool extends Tool {
  constructor(name) {
    super({
      name: name,
      description: `Mock tool: ${name}`
    });
    this.module = null; // Tools need to track their module for backward compatibility
  }

  async execute(params) {
    return { success: true, data: { result: 'mock result' } };
  }

  // Legacy method support
  setModule(module) {
    this.module = module;
  }

  // Legacy method support
  emitProgress(message, data) {
    if (this.module) {
      this.module.emitProgress(message, data, this.name);
    }
  }

  emitInfo(message, data) {
    if (this.module) {
      this.module.emitInfo(message, data, this.name);
    }
  }

  emitError(message, data) {
    if (this.module) {
      this.module.emitError(message, data, this.name);
    }
  }
}

describe('Module Event System', () => {
  let module;
  let events;
  
  beforeEach(() => {
    module = new Module();
    module.name = 'TestModule';
    
    // Collect events from the generic 'event' listener for simplicity
    events = [];
    module.on('event', (e) => events.push(e));
    
    // Add error event listener to prevent unhandled error exceptions
    module.on('error', (e) => {
      // Error events are also captured by the generic 'event' listener
      // so this is just to prevent Node.js from throwing unhandled errors
    });
  });

  describe('EventEmitter inheritance', () => {
    test('should extend EventEmitter', () => {
      expect(module).toBeInstanceOf(EventEmitter);
    });

    test('should be able to emit and listen to events', () => {
      const testEvent = { message: 'test' };
      module.emit('test-event', testEvent);
      
      const listener = jest.fn();
      module.on('test-event', listener);
      module.emit('test-event', testEvent);
      
      expect(listener).toHaveBeenCalledWith(testEvent);
    });

    test('should support multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      module.on('test-event', listener1);
      module.on('test-event', listener2);
      
      module.emit('test-event', { data: 'test' });
      
      expect(listener1).toHaveBeenCalledWith({ data: 'test' });
      expect(listener2).toHaveBeenCalledWith({ data: 'test' });
    });
  });

  describe('emitEvent method', () => {
    test('should emit standardized event structure', () => {
      const testData = { key: 'value' };
      module.emitEvent('progress', 'Test message', testData, 'TestTool', 'high');
      
      expect(events).toHaveLength(1);
      
      const event = events[0];
      expect(event).toMatchObject({
        type: 'progress',
        module: 'TestModule',
        tool: 'TestTool',
        message: 'Test message',
        data: testData,
        level: 'high',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      });
    });

    test('should use default values for optional parameters', () => {
      module.emitEvent('info', 'Test message');
      
      const infoEvent = events[0];
      expect(infoEvent).toMatchObject({
        type: 'info',
        module: 'TestModule',
        tool: null,
        message: 'Test message',
        data: {},
        level: 'medium'
      });
    });

    test('should handle empty data object', () => {
      module.emitEvent('warning', 'Warning message', {});
      
      const warningEvent = events[0];
      expect(warningEvent.data).toEqual({});
    });

    test('should preserve complex data structures', () => {
      const complexData = {
        nested: { value: 123 },
        array: [1, 2, 3],
        boolean: true,
        null: null
      };
      
      module.emitEvent('error', 'Error message', complexData);
      
      const errorEvent = events[0];
      expect(errorEvent.data).toEqual(complexData);
    });
  });

  describe('convenience event methods', () => {
    test('emitProgress should emit progress event with low priority', () => {
      const progressData = { percentage: 50, step: 'processing' };
      module.emitProgress('Processing data', progressData, 'DataTool');
      
      const progressEvent = events[0];
      expect(progressEvent).toMatchObject({
        type: 'progress',
        module: 'TestModule',
        tool: 'DataTool',
        message: 'Processing data',
        data: progressData,
        level: 'low'
      });
    });

    test('emitWarning should emit warning event with medium priority', () => {
      const warningData = { code: 'WARN001', details: 'Deprecated API' };
      module.emitWarning('Using deprecated API', warningData, 'ApiTool');
      
      const warningEvent = events[0];
      expect(warningEvent).toMatchObject({
        type: 'warning',
        module: 'TestModule',
        tool: 'ApiTool',
        message: 'Using deprecated API',
        data: warningData,
        level: 'medium'
      });
    });

    test('emitError should emit error event with high priority', () => {
      const errorData = { errorCode: 'ERR001', stack: 'Error stack trace' };
      module.emitError('Operation failed', errorData, 'FailTool');
      
      const errorEvent = events[0];
      expect(errorEvent).toMatchObject({
        type: 'error',
        module: 'TestModule',
        tool: 'FailTool',
        message: 'Operation failed',
        data: errorData,
        level: 'high'
      });
    });

    test('emitInfo should emit info event with low priority', () => {
      const infoData = { status: 'complete', count: 10 };
      module.emitInfo('Task completed', infoData, 'TaskTool');
      
      const infoEvent = events[0];
      expect(infoEvent).toMatchObject({
        type: 'info',
        module: 'TestModule',
        tool: 'TaskTool',
        message: 'Task completed',
        data: infoData,
        level: 'low'
      });
    });

    test('convenience methods should use default values when tool is not provided', () => {
      module.emitProgress('Progress without tool');
      module.emitWarning('Warning without tool');
      module.emitError('Error without tool');
      module.emitInfo('Info without tool');
      
      expect(events).toHaveLength(4);
      
      events.forEach(event => {
        expect(event.tool).toBeNull();
      });
    });
  });

  describe('tool registration and event propagation', () => {
    test('should set module reference when registering tool', () => {
      const tool = new MockTool('TestTool');
      expect(tool.module).toBeNull();
      
      module.registerTool('TestTool', tool);
      
      expect(tool.module).toBe(module);
      expect(module.getTools()).toContain(tool);
    });

    test('should not fail if tool does not have setModule method', () => {
      const basicTool = {
        name: 'BasicTool',
        description: 'Basic tool without setModule'
      };
      
      expect(() => {
        module.registerTool('BasicTool', basicTool);
      }).not.toThrow();
      
      expect(module.getTools()).toContain(basicTool);
    });

    test('should propagate events from tool to module', () => {
      const tool = new MockTool('EventTool');
      module.registerTool('EventTool', tool);
      
      // Tool emits event through module
      tool.emitProgress('Tool progress', { step: 1 });
      
      const progressEvent = events[0];
      expect(progressEvent).toMatchObject({
        type: 'progress',
        module: 'TestModule',
        tool: 'EventTool',
        message: 'Tool progress',
        data: { step: 1 },
        level: 'low'
      });
    });

    test('should handle multiple tools emitting events', () => {
      const tool1 = new MockTool('Tool1');
      const tool2 = new MockTool('Tool2');
      
      module.registerTool('Tool1', tool1);
      module.registerTool('Tool2', tool2);
      
      tool1.emitInfo('Info from tool 1');
      tool2.emitError('Error from tool 2');
      
      expect(events).toHaveLength(2);
      
      const infoEvent = events[0];
      const errorEvent = events[1];
      
      expect(infoEvent).toMatchObject({
        type: 'info',
        tool: 'Tool1',
        message: 'Info from tool 1'
      });
      
      expect(errorEvent).toMatchObject({
        type: 'error',
        tool: 'Tool2',
        message: 'Error from tool 2'
      });
    });
  });

  describe('event timing and ordering', () => {
    test('should emit events in correct order', () => {
      const startTime = Date.now();
      
      module.emitProgress('First event');
      module.emitWarning('Second event');
      module.emitError('Third event');
      
      const endTime = Date.now();
      
      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('progress');
      expect(events[1].type).toBe('warning');
      expect(events[2].type).toBe('error');
      
      // Check timestamps are in order and within reasonable bounds
      const timestamps = events.map(e => new Date(e.timestamp).getTime());
      expect(timestamps[0]).toBeGreaterThanOrEqual(startTime);
      expect(timestamps[1]).toBeGreaterThanOrEqual(timestamps[0]);
      expect(timestamps[2]).toBeGreaterThanOrEqual(timestamps[1]);
      expect(timestamps[2]).toBeLessThanOrEqual(endTime);
    });

    test('should generate valid timestamps for rapid events', () => {
      // Emit events in rapid succession
      for (let i = 0; i < 5; i++) {
        module.emitInfo(`Event ${i}`);
      }
      
      const timestamps = events.map(e => e.timestamp);
      
      // All timestamps should be valid ISO strings
      timestamps.forEach(ts => {
        expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(new Date(ts).getTime()).toBeGreaterThan(0);
      });
      
      // Should have 5 events
      expect(events).toHaveLength(5);
    });
  });

  describe('backward compatibility', () => {
    test('should not break existing module functionality', () => {
      // Test basic module operations still work
      expect(module.name).toBe('TestModule');
      expect(module.getTools()).toEqual([]);
      
      const tool = new MockTool('CompatTool');
      module.registerTool('CompatTool', tool);
      
      expect(module.getTools()).toContain(tool);
    });

    test('should handle modules without event system gracefully', () => {
      // Create a module that doesn't use events
      const simpleModule = new Module();
      simpleModule.name = 'SimpleModule';
      
      const tool = new MockTool('SimpleTool');
      simpleModule.registerTool('SimpleTool', tool);
      
      expect(simpleModule.getTools()).toContain(tool);
      expect(tool.module).toBe(simpleModule);
    });
  });

  describe('error handling', () => {
    test('should handle invalid event types gracefully', () => {
      expect(() => {
        module.emitEvent('', 'Empty event type');
      }).not.toThrow();
      
      expect(() => {
        module.emitEvent(null, 'Null event type');
      }).not.toThrow();
      
      expect(() => {
        module.emitEvent(undefined, 'Undefined event type');
      }).not.toThrow();
    });

    test('should handle invalid messages gracefully', () => {
      expect(() => {
        module.emitEvent('info', null);
      }).not.toThrow();
      
      expect(() => {
        module.emitEvent('info', undefined);
      }).not.toThrow();
      
      expect(() => {
        module.emitEvent('info', 123);
      }).not.toThrow();
    });

    test('should handle circular references in data', () => {
      const circularData = { name: 'test' };
      circularData.self = circularData;
      
      expect(() => {
        module.emitEvent('info', 'Circular data test', circularData);
      }).not.toThrow();
      
      const infoEvent = events[0];
      expect(infoEvent.data).toBe(circularData);
    });
  });

  describe('memory management', () => {
    test('should not leak memory with many events', () => {
      const initialListeners = module.listenerCount('event');
      
      // Emit many events
      for (let i = 0; i < 100; i++) {
        module.emitProgress(`Event ${i}`);
      }
      
      // Listener count should remain the same
      expect(module.listenerCount('event')).toBe(initialListeners);
      
      // Events should be collected properly
      expect(events).toHaveLength(100);
    });

    test('should handle listener removal correctly', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      module.on('test-event', listener1);
      module.on('test-event', listener2);
      
      expect(module.listenerCount('test-event')).toBe(2);
      
      module.removeListener('test-event', listener1);
      expect(module.listenerCount('test-event')).toBe(1);
      
      module.emit('test-event', { data: 'test' });
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith({ data: 'test' });
    });
  });
});