/**
 * Tests for UIUpdateActor
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('UIUpdateActor', () => {
  let UIUpdateActor;
  let mockActorSpace;
  let mockCommandActor;
  let mockServerQueryActor;
  let uiUpdateActor;
  
  beforeEach(async () => {
    ({ UIUpdateActor } = await import('../../../src/actors/UIUpdateActor.js'));
    
    mockCommandActor = {
      isActor: true,
      receive: jest.fn()
    };
    
    mockServerQueryActor = {
      isActor: true,
      receive: jest.fn()
    };
    
    mockActorSpace = {
      spaceId: 'TestSpace',
      getActor: jest.fn((key) => {
        if (key === 'command-actor') return mockCommandActor;
        if (key === 'server-query-actor') return mockServerQueryActor;
        return null;
      }),
      emit: jest.fn()
    };
    
    uiUpdateActor = new UIUpdateActor();
    uiUpdateActor._space = mockActorSpace;
  });

  test('should be a valid actor', () => {
    expect(uiUpdateActor).toBeActor();
  });

  test('should handle command_input message', () => {
    const message = {
      type: 'command_input',
      command: 'file_read',
      args: { path: '/test.txt' }
    };
    
    uiUpdateActor.receive(message);
    
    expect(mockCommandActor.receive).toHaveBeenCalledWith({
      type: 'execute',
      tool: 'file_read',
      args: { path: '/test.txt' },
      requestId: expect.stringMatching(/^ui-cmd-/)
    });
  });

  test('should handle refresh_tools message', () => {
    const message = {
      type: 'refresh_tools'
    };
    
    uiUpdateActor.receive(message);
    
    expect(mockServerQueryActor.receive).toHaveBeenCalledWith({
      type: 'get_tools'
    });
  });

  test('should handle refresh_sessions message', () => {
    const message = {
      type: 'refresh_sessions'
    };
    
    uiUpdateActor.receive(message);
    
    expect(mockServerQueryActor.receive).toHaveBeenCalledWith({
      type: 'get_sessions'
    });
  });

  test('should handle refresh_variables message', () => {
    const message = {
      type: 'refresh_variables',
      sessionId: 'session-123'
    };
    
    uiUpdateActor.receive(message);
    
    expect(mockServerQueryActor.receive).toHaveBeenCalledWith({
      type: 'get_variables',
      sessionId: 'session-123'
    });
  });

  test('should handle state_update message', () => {
    const subscribers = new Set();
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    
    subscribers.add(callback1);
    subscribers.add(callback2);
    
    uiUpdateActor.subscribers.set('tools_updated', subscribers);
    
    const message = {
      type: 'state_update',
      stateType: 'tools_updated',
      data: { tools: ['tool1', 'tool2'] }
    };
    
    uiUpdateActor.receive(message);
    
    expect(callback1).toHaveBeenCalledWith({
      tools: ['tool1', 'tool2']
    });
    expect(callback2).toHaveBeenCalledWith({
      tools: ['tool1', 'tool2']
    });
  });

  test('should subscribe to events', () => {
    const callback = jest.fn();
    
    uiUpdateActor.subscribe('test_event', callback);
    
    expect(uiUpdateActor.subscribers.has('test_event')).toBe(true);
    expect(uiUpdateActor.subscribers.get('test_event').has(callback)).toBe(true);
  });

  test('should unsubscribe from events', () => {
    const callback = jest.fn();
    
    uiUpdateActor.subscribe('test_event', callback);
    uiUpdateActor.unsubscribe('test_event', callback);
    
    expect(uiUpdateActor.subscribers.get('test_event').has(callback)).toBe(false);
  });

  test('should handle component registration', () => {
    const mockComponent = {
      name: 'TestComponent',
      onUIUpdate: jest.fn()
    };
    
    uiUpdateActor.registerComponent(mockComponent);
    
    expect(uiUpdateActor.components.has('TestComponent')).toBe(true);
    
    // Send update to component
    uiUpdateActor.receive({
      type: 'component_update',
      component: 'TestComponent',
      data: { value: 42 }
    });
    
    expect(mockComponent.onUIUpdate).toHaveBeenCalledWith({
      value: 42
    });
  });

  test('should handle component unregistration', () => {
    const mockComponent = {
      name: 'TestComponent',
      onUIUpdate: jest.fn()
    };
    
    uiUpdateActor.registerComponent(mockComponent);
    uiUpdateActor.unregisterComponent('TestComponent');
    
    expect(uiUpdateActor.components.has('TestComponent')).toBe(false);
  });

  test('should emit error for unknown message type', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    
    const message = {
      type: 'unknown',
      data: 'test'
    };
    
    uiUpdateActor.receive(message);
    
    expect(consoleWarn).toHaveBeenCalledWith(
      'UIUpdateActor: Unknown message type',
      'unknown'
    );
    
    consoleWarn.mockRestore();
  });

  test('should broadcast to all components', () => {
    const component1 = {
      name: 'Component1',
      onUIUpdate: jest.fn()
    };
    
    const component2 = {
      name: 'Component2',
      onUIUpdate: jest.fn()
    };
    
    uiUpdateActor.registerComponent(component1);
    uiUpdateActor.registerComponent(component2);
    
    uiUpdateActor.broadcastToComponents({
      type: 'global_update',
      data: 'test'
    });
    
    expect(component1.onUIUpdate).toHaveBeenCalledWith({
      type: 'global_update',
      data: 'test'
    });
    expect(component2.onUIUpdate).toHaveBeenCalledWith({
      type: 'global_update',
      data: 'test'
    });
  });

  test('should clean up on destroy', () => {
    const callback = jest.fn();
    const component = {
      name: 'TestComponent',
      onUIUpdate: jest.fn()
    };
    
    uiUpdateActor.subscribe('event1', callback);
    uiUpdateActor.registerComponent(component);
    
    uiUpdateActor.destroy();
    
    expect(uiUpdateActor.subscribers.size).toBe(0);
    expect(uiUpdateActor.components.size).toBe(0);
  });
});