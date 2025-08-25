/**
 * Tests demonstrating SimpleEmitter usage with Tool and ToolFeasibilityChecker
 */

import { describe, it, expect, jest } from '@jest/globals';
import { ToolFeasibilityChecker } from '../../src/core/informal/ToolFeasibilityChecker.js';
import { Tool } from '@legion/tools-registry';

describe('SimpleEmitter Usage', () => {
  it('should demonstrate Tool event subscription', () => {
    // Create a tool instance
    const tool = new Tool({
      name: 'test-tool',
      description: 'A test tool'
    });
    
    // Track all events through single callback
    const events = [];
    const unsubscribe = tool.subscribe((eventName, eventData) => {
      events.push({ name: eventName, data: eventData });
    });
    
    // Emit various events
    tool.progress('Processing...', 50, { step: 1 });
    tool.info('Information message', { detail: 'some info' });
    tool.warning('Warning message', { code: 'W001' });
    tool.error('Error occurred', { error: new Error('test') });
    
    // Check all events were captured
    expect(events).toHaveLength(4);
    expect(events[0].name).toBe('progress');
    expect(events[0].data.percentage).toBe(50);
    expect(events[1].name).toBe('info');
    expect(events[2].name).toBe('warning');
    expect(events[3].name).toBe('error');
    
    // Unsubscribe
    unsubscribe();
    
    // No more events should be captured
    tool.info('This should not be captured');
    expect(events).toHaveLength(4);
  });
  
  it('should demonstrate ToolFeasibilityChecker event subscription', () => {
    // Mock tool registry
    const mockRegistry = {
      searchTools: jest.fn().mockResolvedValue([]),
      getTool: jest.fn().mockResolvedValue(null)
    };
    
    // Create checker
    const checker = new ToolFeasibilityChecker(mockRegistry, {
      confidenceThreshold: 0.5
    });
    
    // Subscribe to all events with single callback
    const events = [];
    const unsubscribe = checker.subscribe((eventName, eventData) => {
      events.push({ name: eventName, data: eventData });
    });
    
    // Emit some events (these would normally be emitted during tool discovery)
    checker.emit('searchStarted', 'file operations');
    checker.emit('searchCompleted', { 
      query: 'file operations',
      tools: [],
      maxConfidence: 0
    });
    checker.emit('unificationCompleted', { unifiedTools: [] });
    
    // Check events were captured
    expect(events).toHaveLength(3);
    expect(events[0].name).toBe('searchStarted');
    expect(events[0].data).toBe('file operations');
    expect(events[1].name).toBe('searchCompleted');
    expect(events[2].name).toBe('unificationCompleted');
    
    // Cleanup
    unsubscribe();
  });
  
  it('should support multiple subscribers', () => {
    const tool = new Tool({ name: 'multi-sub-tool' });
    
    const subscriber1Events = [];
    const subscriber2Events = [];
    
    const unsub1 = tool.subscribe((name, data) => {
      subscriber1Events.push({ name, data });
    });
    
    const unsub2 = tool.subscribe((name, data) => {
      subscriber2Events.push({ name, data });
    });
    
    tool.progress('Step 1', 25);
    tool.progress('Step 2', 50);
    
    // Both subscribers should receive all events
    expect(subscriber1Events).toHaveLength(2);
    expect(subscriber2Events).toHaveLength(2);
    
    // Unsubscribe first subscriber
    unsub1();
    
    tool.progress('Step 3', 75);
    
    // Only second subscriber should receive new event
    expect(subscriber1Events).toHaveLength(2);
    expect(subscriber2Events).toHaveLength(3);
    
    unsub2();
  });
});