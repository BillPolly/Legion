/**
 * Unit tests for HierarchicalEventStream class
 * Tests hierarchical event system with parent-child event bubbling:
 * - Event bubbling from child to parent
 * - Event subscription and unsubscription management
 * - Event filtering and routing capabilities
 * - Parent event handling delegation
 */

import { jest } from '@jest/globals';
import { HierarchicalEventStream } from '../../src/lifecycle/HierarchicalEventStream.js';
import { EventStream } from '../../src/lifecycle/EventStream.js';

describe('HierarchicalEventStream', () => {
  let eventStream;
  let mockParentComponent;
  let mockEventHandler;

  beforeEach(() => {
    mockParentComponent = {
      id: 'parent1',
      children: new Map(),
      handleChildEvent: jest.fn()
    };

    mockEventHandler = jest.fn();

    eventStream = new HierarchicalEventStream({
      parentComponent: mockParentComponent,
      childId: 'child1'
    });
  });

  describe('Constructor', () => {
    it('should extend EventStream', () => {
      expect(eventStream).toBeInstanceOf(EventStream);
    });

    it('should initialize with parent component reference', () => {
      expect(eventStream.parentComponent).toBe(mockParentComponent);
    });

    it('should initialize with child ID', () => {
      expect(eventStream.childId).toBe('child1');
    });

    it('should initialize with empty bubble routes map', () => {
      expect(eventStream.bubbleRoutes).toBeInstanceOf(Map);
      expect(eventStream.bubbleRoutes.size).toBe(0);
    });

    it('should initialize with empty parent subscriptions map', () => {
      expect(eventStream.parentSubscriptions).toBeInstanceOf(Map);
      expect(eventStream.parentSubscriptions.size).toBe(0);
    });

    it('should throw error if parentComponent not provided', () => {
      expect(() => {
        new HierarchicalEventStream({ childId: 'test' });
      }).toThrow('Parent component is required for hierarchical event stream');
    });

    it('should throw error if childId not provided', () => {
      expect(() => {
        new HierarchicalEventStream({ parentComponent: mockParentComponent });
      }).toThrow('Child ID is required for hierarchical event stream');
    });
  });

  describe('Event Bubbling to Parent', () => {
    it('should register event type for bubbling to parent', () => {
      eventStream.bubbleToParent('click');

      expect(eventStream.bubbleRoutes.has('click')).toBe(true);
      expect(eventStream.bubbleRoutes.get('click')).toBe('parent');
    });

    it('should emit child events to parent when bubbling enabled', () => {
      eventStream.bubbleToParent('submit');
      
      const eventData = { 
        target: 'form', 
        value: 'test data',
        childId: 'child1'
      };

      eventStream.emit('submit', eventData);

      expect(mockParentComponent.handleChildEvent).toHaveBeenCalledWith(
        'submit',
        {
          ...eventData,
          sourceChild: 'child1'
        }
      );
    });

    it('should handle multiple event types for bubbling', () => {
      eventStream.bubbleToParent('click');
      eventStream.bubbleToParent('change');
      eventStream.bubbleToParent('submit');

      expect(eventStream.bubbleRoutes.has('click')).toBe(true);
      expect(eventStream.bubbleRoutes.has('change')).toBe(true);
      expect(eventStream.bubbleRoutes.has('submit')).toBe(true);
    });

    it('should not bubble events that are not registered for bubbling', () => {
      eventStream.bubbleToParent('click');
      
      // Emit a non-bubbling event
      eventStream.emit('keypress', { key: 'Enter' });

      expect(mockParentComponent.handleChildEvent).not.toHaveBeenCalled();
    });

    it('should include source child information in bubbled events', () => {
      eventStream.bubbleToParent('custom');
      
      const originalData = { 
        action: 'save',
        payload: { id: 123 }
      };

      eventStream.emit('custom', originalData);

      expect(mockParentComponent.handleChildEvent).toHaveBeenCalledWith(
        'custom',
        {
          ...originalData,
          sourceChild: 'child1'
        }
      );
    });
  });

  describe('Event Subscription Management', () => {
    it('should allow subscribing to child events from parent', () => {
      const subscription = eventStream.subscribeFromParent('dataChange', mockEventHandler);

      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      expect(eventStream.parentSubscriptions.has('dataChange')).toBe(true);
    });

    it('should call parent subscriber when child event is emitted', () => {
      eventStream.subscribeFromParent('dataChange', mockEventHandler);
      
      const eventData = { 
        newValue: 'updated data',
        timestamp: Date.now()
      };

      eventStream.emit('dataChange', eventData);

      expect(mockEventHandler).toHaveBeenCalledWith({
        ...eventData,
        sourceChild: 'child1'
      });
    });

    it('should support multiple subscribers for same event type', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventStream.subscribeFromParent('stateChange', handler1);
      eventStream.subscribeFromParent('stateChange', handler2);

      const eventData = { state: 'active' };
      eventStream.emit('stateChange', eventData);

      expect(handler1).toHaveBeenCalledWith({
        ...eventData,
        sourceChild: 'child1'
      });
      expect(handler2).toHaveBeenCalledWith({
        ...eventData,
        sourceChild: 'child1'
      });
    });

    it('should unsubscribe parent handlers correctly', () => {
      const subscription = eventStream.subscribeFromParent('update', mockEventHandler);
      
      // Emit event - should call handler
      eventStream.emit('update', { value: 'test1' });
      expect(mockEventHandler).toHaveBeenCalledTimes(1);

      // Unsubscribe
      subscription.unsubscribe();

      // Emit event again - should not call handler
      eventStream.emit('update', { value: 'test2' });
      expect(mockEventHandler).toHaveBeenCalledTimes(1);
    });

    it('should clean up subscription from parentSubscriptions map on unsubscribe', () => {
      const subscription = eventStream.subscribeFromParent('cleanup', mockEventHandler);
      
      expect(eventStream.parentSubscriptions.has('cleanup')).toBe(true);
      
      subscription.unsubscribe();
      
      // Check if subscription set is empty or event type is removed
      const subscriptions = eventStream.parentSubscriptions.get('cleanup');
      expect(subscriptions?.size || 0).toBe(0);
    });
  });

  describe('Event Filtering and Routing', () => {
    it('should filter events by event type', () => {
      eventStream.addEventFilter('click', (data) => data.button === 'left');
      eventStream.subscribeFromParent('click', mockEventHandler);

      // Event that passes filter
      eventStream.emit('click', { button: 'left', x: 100, y: 200 });
      expect(mockEventHandler).toHaveBeenCalledTimes(1);

      // Event that fails filter
      eventStream.emit('click', { button: 'right', x: 150, y: 250 });
      expect(mockEventHandler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should route events to specific parent methods', () => {
      const customHandler = jest.fn();
      mockParentComponent.onChildValidation = customHandler;

      eventStream.routeToParentMethod('validation', 'onChildValidation');
      
      const validationData = { 
        isValid: false, 
        errors: ['Required field missing'] 
      };

      eventStream.emit('validation', validationData);

      expect(customHandler).toHaveBeenCalledWith({
        ...validationData,
        sourceChild: 'child1'
      });
    });

    it('should support conditional routing based on event data', () => {
      eventStream.addConditionalRoute('error', (data) => {
        return data.severity === 'critical' ? 'handleCriticalError' : 'handleRegularError';
      });

      mockParentComponent.handleCriticalError = jest.fn();
      mockParentComponent.handleRegularError = jest.fn();

      // Critical error
      eventStream.emit('error', { severity: 'critical', message: 'System failure' });
      expect(mockParentComponent.handleCriticalError).toHaveBeenCalled();
      expect(mockParentComponent.handleRegularError).not.toHaveBeenCalled();

      // Regular error
      eventStream.emit('error', { severity: 'warning', message: 'Minor issue' });
      expect(mockParentComponent.handleRegularError).toHaveBeenCalled();
    });

    it('should prevent event bubbling when filter returns false', () => {
      eventStream.addEventFilter('submit', (data) => data.isValid === true);
      eventStream.bubbleToParent('submit');

      // Invalid form submission - should not bubble
      eventStream.emit('submit', { isValid: false, formData: {} });
      expect(mockParentComponent.handleChildEvent).not.toHaveBeenCalled();

      // Valid form submission - should bubble
      eventStream.emit('submit', { isValid: true, formData: { name: 'test' } });
      expect(mockParentComponent.handleChildEvent).toHaveBeenCalled();
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should clean up all parent subscriptions on destroy', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventStream.subscribeFromParent('event1', handler1);
      eventStream.subscribeFromParent('event2', handler2);

      expect(eventStream.parentSubscriptions.size).toBe(2);

      eventStream.cleanup();

      expect(eventStream.parentSubscriptions.size).toBe(0);
    });

    it('should clear all bubble routes on destroy', () => {
      eventStream.bubbleToParent('click');
      eventStream.bubbleToParent('change');

      expect(eventStream.bubbleRoutes.size).toBe(2);

      eventStream.cleanup();

      expect(eventStream.bubbleRoutes.size).toBe(0);
    });

    it('should stop parent event handling after cleanup', () => {
      eventStream.subscribeFromParent('test', mockEventHandler);
      eventStream.bubbleToParent('test');

      // Before cleanup - should work
      eventStream.emit('test', { data: 'before' });
      expect(mockEventHandler).toHaveBeenCalledTimes(1);
      expect(mockParentComponent.handleChildEvent).toHaveBeenCalledTimes(1);

      eventStream.cleanup();

      // After cleanup - should not work
      eventStream.emit('test', { data: 'after' });
      expect(mockEventHandler).toHaveBeenCalledTimes(1); // Still 1
      expect(mockParentComponent.handleChildEvent).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should remove parent component reference on cleanup', () => {
      expect(eventStream.parentComponent).toBe(mockParentComponent);
      
      eventStream.cleanup();
      
      expect(eventStream.parentComponent).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle parent component without handleChildEvent method gracefully', () => {
      const parentWithoutHandler = { 
        id: 'parent2', 
        children: new Map() 
      };

      const streamWithoutHandler = new HierarchicalEventStream({
        parentComponent: parentWithoutHandler,
        childId: 'child2'
      });

      streamWithoutHandler.bubbleToParent('click');

      expect(() => {
        streamWithoutHandler.emit('click', { data: 'test' });
      }).toThrow('Parent component does not implement handleChildEvent method');
    });

    it('should handle missing parent method for routing gracefully', () => {
      eventStream.routeToParentMethod('custom', 'nonExistentMethod');

      expect(() => {
        eventStream.emit('custom', { data: 'test' });
      }).toThrow('Parent component does not have method: nonExistentMethod');
    });

    it('should validate event filter functions', () => {
      expect(() => {
        eventStream.addEventFilter('test', 'not a function');
      }).toThrow('Event filter must be a function');
    });

    it('should validate conditional route functions', () => {
      expect(() => {
        eventStream.addConditionalRoute('test', 'not a function');
      }).toThrow('Conditional route must be a function');
    });
  });
});