/**
 * Integration tests for Hierarchical Event System
 * Tests complete event bubbling system working with mock components:
 * - Parent-child event communication with real HierarchicalEventStream
 * - Event routing through EventBubbler utility
 * - Sibling communication through parent with real event streams
 * - Complex event scenarios with filtering and conditional routing
 * - Event cleanup when components are destroyed
 */

import { jest } from '@jest/globals';
import { HierarchicalEventStream } from '../../src/lifecycle/HierarchicalEventStream.js';
import { EventBubbler } from '../../src/utils/EventBubbler.js';

describe('Hierarchical Event System Integration', () => {
  let parentComponent;
  let childComponent1;
  let childComponent2;
  let eventBubbler;

  beforeEach(() => {
    // Create parent component mock with event handling capabilities
    parentComponent = {
      id: 'parent',
      children: new Map(),
      handleChildEvent: jest.fn(),
      onChildValidation: jest.fn(),
      handleCriticalError: jest.fn(),
      handleRegularError: jest.fn(),
      onChildSubmit: jest.fn()
    };

    // Create child component mocks
    childComponent1 = {
      id: 'child1',
      parent: null,
      eventStream: null
    };

    childComponent2 = {
      id: 'child2',
      parent: null,
      eventStream: null
    };

    // Set up parent-child relationships in maps
    parentComponent.children.set('child1', childComponent1);
    parentComponent.children.set('child2', childComponent2);
    childComponent1.parent = parentComponent;
    childComponent2.parent = parentComponent;

    // Create hierarchical event streams for children
    childComponent1.eventStream = new HierarchicalEventStream({
      parentComponent: parentComponent,
      childId: 'child1'
    });

    childComponent2.eventStream = new HierarchicalEventStream({
      parentComponent: parentComponent,
      childId: 'child2'
    });

    // Create event bubbler utility
    eventBubbler = new EventBubbler();
  });

  afterEach(() => {
    // Clean up all event resources
    if (childComponent1.eventStream) {
      childComponent1.eventStream.cleanup();
    }
    if (childComponent2.eventStream) {
      childComponent2.eventStream.cleanup();
    }
    if (eventBubbler) {
      eventBubbler.cleanup();
    }
  });

  describe('Parent-Child Event Communication', () => {
    it('should bubble child events to parent through hierarchical event stream', () => {
      // Setup child event bubbling
      childComponent1.eventStream.bubbleToParent('click');
      childComponent1.eventStream.bubbleToParent('submit');

      // Child1 emits click event
      const clickData = { button: 'left', x: 100, y: 150 };
      childComponent1.eventStream.emit('click', clickData);

      expect(parentComponent.handleChildEvent).toHaveBeenCalledWith(
        'click',
        {
          ...clickData,
          sourceChild: 'child1'
        }
      );

      // Child1 emits submit event
      const submitData = { formData: { name: 'test', email: 'test@example.com' } };
      childComponent1.eventStream.emit('submit', submitData);

      expect(parentComponent.handleChildEvent).toHaveBeenCalledWith(
        'submit',
        {
          ...submitData,
          sourceChild: 'child1'
        }
      );

      expect(parentComponent.handleChildEvent).toHaveBeenCalledTimes(2);
    });

    it('should route child events to specific parent methods', () => {
      // Setup custom method routing
      childComponent1.eventStream.routeToParentMethod('validation', 'onChildValidation');

      // Child emits validation event
      const validationData = {
        isValid: false,
        errors: ['Email format invalid', 'Password too short']
      };

      childComponent1.eventStream.emit('validation', validationData);

      expect(parentComponent.onChildValidation).toHaveBeenCalledWith({
        ...validationData,
        sourceChild: 'child1'
      });

      // Should not call default handleChildEvent method
      expect(parentComponent.handleChildEvent).not.toHaveBeenCalled();
    });

    it('should support conditional routing based on event data', () => {
      // Setup conditional routing for error events
      childComponent1.eventStream.addConditionalRoute('error', (data) => {
        return data.severity === 'critical' ? 'handleCriticalError' : 'handleRegularError';
      });

      // Emit critical error
      childComponent1.eventStream.emit('error', {
        severity: 'critical',
        message: 'Database connection lost',
        timestamp: Date.now()
      });

      expect(parentComponent.handleCriticalError).toHaveBeenCalled();
      expect(parentComponent.handleRegularError).not.toHaveBeenCalled();

      // Emit regular error
      childComponent1.eventStream.emit('error', {
        severity: 'warning',
        message: 'Form validation failed',
        timestamp: Date.now()
      });

      expect(parentComponent.handleRegularError).toHaveBeenCalled();
    });

    it('should filter events based on event data', () => {
      // Setup event filter - only left clicks are allowed
      childComponent1.eventStream.addEventFilter('click', (data) => data.button === 'left');
      childComponent1.eventStream.bubbleToParent('click');

      // Left click - should bubble
      childComponent1.eventStream.emit('click', { button: 'left', x: 100, y: 150 });
      expect(parentComponent.handleChildEvent).toHaveBeenCalledTimes(1);

      // Right click - should be filtered out
      childComponent1.eventStream.emit('click', { button: 'right', x: 200, y: 250 });
      expect(parentComponent.handleChildEvent).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('Event Bubbler Utility Integration', () => {
    it('should setup complete child event routing through EventBubbler', () => {
      const routingConfig = {
        bubble: ['click', 'change'],
        routes: {
          'submit': 'onChildSubmit',
          'validation': 'onChildValidation'
        },
        filters: {
          'click': (data) => data.button === 'left'
        },
        conditionalRoutes: {
          'error': (data) => data.critical ? 'handleCriticalError' : 'handleRegularError'
        }
      };

      // Add missing parent methods
      parentComponent.onChildSubmit = jest.fn();

      // Setup routing through EventBubbler
      eventBubbler.setupChildEventRouting(parentComponent, childComponent1, routingConfig);

      // Verify bubble routes were configured
      expect(childComponent1.eventStream.bubbleRoutes.has('click')).toBe(true);
      expect(childComponent1.eventStream.bubbleRoutes.has('change')).toBe(true);

      // Verify method routes were configured
      expect(childComponent1.eventStream.bubbleRoutes.get('submit')).toBe('onChildSubmit');
      expect(childComponent1.eventStream.bubbleRoutes.get('validation')).toBe('onChildValidation');

      // Test routing configuration is stored
      expect(eventBubbler.routingConfigurations.has('child1')).toBe(true);
    });

    it('should setup parent event handling for multiple children', () => {
      const config1 = {
        subscriptions: ['stateChange', 'dataUpdate']
      };

      const config2 = {
        subscriptions: ['validation', 'submit']
      };

      // Setup parent handling for both children
      eventBubbler.setupParentEventHandling(parentComponent, 'child1', config1);
      eventBubbler.setupParentEventHandling(parentComponent, 'child2', config2);

      // Verify parent subscriptions tracking
      const parentSubs = eventBubbler.parentSubscriptions.get('parent');
      expect(parentSubs.has('child1')).toBe(true);
      expect(parentSubs.has('child2')).toBe(true);
    });

    it('should update child event routing dynamically', () => {
      const initialConfig = {
        bubble: ['click']
      };

      const updatedConfig = {
        bubble: ['click', 'change'],
        routes: {
          'submit': 'onChildSubmit'
        }
      };

      // Add missing parent method
      parentComponent.onChildSubmit = jest.fn();

      // Setup initial routing
      eventBubbler.setupChildEventRouting(parentComponent, childComponent1, initialConfig);
      expect(childComponent1.eventStream.bubbleRoutes.size).toBe(1);

      // Update routing configuration
      eventBubbler.updateChildEventRouting('child1', updatedConfig);

      // Verify updated configuration
      expect(childComponent1.eventStream.bubbleRoutes.has('change')).toBe(true);
      expect(childComponent1.eventStream.bubbleRoutes.get('submit')).toBe('onChildSubmit');
    });
  });

  describe('Sibling Component Communication', () => {
    it('should route events between siblings through parent', () => {
      const siblingConfig = {
        sourceChild: 'child1',
        targetChild: 'child2',
        eventMappings: {
          'dataUpdate': 'refreshData',
          'stateChange': 'syncState'
        }
      };

      // Setup sibling routing
      eventBubbler.setupSiblingEventRouting(parentComponent, siblingConfig);

      // Mock child2 event stream for verification
      const child2Handler = jest.fn();
      childComponent2.eventStream.subscribe('refreshData', child2Handler);

      // Child1 emits dataUpdate - should trigger refreshData on child2
      childComponent1.eventStream.emit('dataUpdate', {
        newData: { users: [1, 2, 3] },
        timestamp: Date.now()
      });

      // Verify the event was routed to child2
      expect(child2Handler).toHaveBeenCalledWith(
        expect.objectContaining({
          newData: { users: [1, 2, 3] },
          fromSibling: 'child1'
        })
      );
    });

    it('should broadcast events to all siblings', () => {
      const broadcastConfig = {
        sourceChild: 'child1',
        broadcast: ['globalUpdate', 'systemNotification']
      };

      // Setup broadcast routing
      eventBubbler.setupSiblingEventRouting(parentComponent, broadcastConfig);

      // Mock handlers for child2
      const globalUpdateHandler = jest.fn();
      childComponent2.eventStream.subscribe('globalUpdate', globalUpdateHandler);

      // Child1 broadcasts global update
      childComponent1.eventStream.emit('globalUpdate', {
        updateType: 'theme',
        newTheme: 'dark'
      });

      // Verify child2 received the broadcast
      expect(globalUpdateHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          updateType: 'theme',
          newTheme: 'dark',
          fromSibling: 'child1',
          broadcast: true
        })
      );
    });

    it('should filter sibling events based on conditions', () => {
      const filterConfig = {
        sourceChild: 'child1',
        targetChild: 'child2',
        eventMappings: { 'update': 'refresh' },
        filter: (data) => data.priority === 'high'
      };

      // Setup filtered sibling routing
      eventBubbler.setupSiblingEventRouting(parentComponent, filterConfig);

      // Mock child2 handler
      const refreshHandler = jest.fn();
      childComponent2.eventStream.subscribe('refresh', refreshHandler);

      // High priority update - should pass filter
      childComponent1.eventStream.emit('update', { priority: 'high', data: 'important' });
      expect(refreshHandler).toHaveBeenCalledTimes(1);

      // Low priority update - should be filtered out
      childComponent1.eventStream.emit('update', { priority: 'low', data: 'not important' });
      expect(refreshHandler).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('Complex Event Scenarios', () => {
    it('should handle multiple event types with different routing strategies', () => {
      // Setup complex routing for child1
      const complexConfig = {
        bubble: ['click', 'focus'],
        routes: {
          'submit': 'onChildSubmit',
          'validation': 'onChildValidation'
        },
        filters: {
          'click': (data) => data.button === 'left',
          'submit': (data) => data.isValid
        },
        conditionalRoutes: {
          'error': (data) => data.critical ? 'handleCriticalError' : 'handleRegularError'
        }
      };

      // Add required parent methods
      parentComponent.onChildSubmit = jest.fn();

      eventBubbler.setupChildEventRouting(parentComponent, childComponent1, complexConfig);

      // Test bubbling
      childComponent1.eventStream.emit('focus', { element: 'input' });
      expect(parentComponent.handleChildEvent).toHaveBeenCalledWith('focus', 
        expect.objectContaining({ element: 'input', sourceChild: 'child1' })
      );

      // Test method routing
      childComponent1.eventStream.emit('submit', { isValid: true, formData: {} });
      expect(parentComponent.onChildSubmit).toHaveBeenCalled();

      // Test conditional routing
      childComponent1.eventStream.emit('error', { critical: true, message: 'System failure' });
      expect(parentComponent.handleCriticalError).toHaveBeenCalled();

      // Test filtering
      childComponent1.eventStream.emit('click', { button: 'right', x: 100, y: 150 });
      expect(parentComponent.handleChildEvent).not.toHaveBeenCalledWith('click', expect.anything());
    });

    it('should handle concurrent events from multiple children', () => {
      // Setup routing for both children
      eventBubbler.setupChildEventRouting(parentComponent, childComponent1, {
        bubble: ['action']
      });

      eventBubbler.setupChildEventRouting(parentComponent, childComponent2, {
        bubble: ['action']
      });

      // Both children emit events simultaneously
      childComponent1.eventStream.emit('action', { type: 'save', data: 'data1' });
      childComponent2.eventStream.emit('action', { type: 'load', data: 'data2' });

      // Verify both events were handled
      expect(parentComponent.handleChildEvent).toHaveBeenCalledWith('action',
        expect.objectContaining({ type: 'save', sourceChild: 'child1' })
      );

      expect(parentComponent.handleChildEvent).toHaveBeenCalledWith('action',
        expect.objectContaining({ type: 'load', sourceChild: 'child2' })
      );

      expect(parentComponent.handleChildEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('Event Cleanup and Resource Management', () => {
    it('should cleanup all event resources when components are destroyed', () => {
      // Setup complex event routing
      eventBubbler.setupChildEventRouting(parentComponent, childComponent1, {
        bubble: ['click', 'change']
      });

      eventBubbler.setupParentEventHandling(parentComponent, 'child1', {
        subscriptions: ['stateChange']
      });

      // Verify resources are created
      expect(eventBubbler.routingConfigurations.size).toBe(1);
      expect(eventBubbler.parentSubscriptions.size).toBe(1);
      expect(childComponent1.eventStream.bubbleRoutes.size).toBe(2);

      // Cleanup child routing
      eventBubbler.cleanupChildEventRouting('child1');

      // Verify child resources are cleaned up
      expect(eventBubbler.routingConfigurations.size).toBe(0);
      expect(childComponent1.eventStream.bubbleRoutes.size).toBe(0);

      // Cleanup parent handling
      eventBubbler.cleanupParentEventHandling('parent', 'child1');

      // Verify parent resources are cleaned up
      expect(eventBubbler.parentSubscriptions.size).toBe(0);
    });

    it('should stop event propagation after child component destruction', () => {
      // Setup event routing
      childComponent1.eventStream.bubbleToParent('test');
      const handler = jest.fn();
      childComponent1.eventStream.subscribeFromParent('test', handler);

      // Events work before cleanup
      childComponent1.eventStream.emit('test', { data: 'before' });
      expect(parentComponent.handleChildEvent).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledTimes(1);

      // Cleanup child event stream
      childComponent1.eventStream.cleanup();

      // Events should not work after cleanup
      childComponent1.eventStream.emit('test', { data: 'after' });
      expect(parentComponent.handleChildEvent).toHaveBeenCalledTimes(1); // Still 1
      expect(handler).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should handle graceful cleanup when components are removed', () => {
      // Setup routing
      eventBubbler.setupChildEventRouting(parentComponent, childComponent1, {
        bubble: ['remove']
      });

      // Remove child from parent manually (since we're using mocks)
      parentComponent.children.delete('child1');
      childComponent1.parent = null;

      // Cleanup should not throw errors
      expect(() => {
        eventBubbler.cleanupChildEventRouting('child1');
        eventBubbler.cleanupParentEventHandling('parent', 'child1');
      }).not.toThrow();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing parent methods gracefully', () => {
      childComponent1.eventStream.routeToParentMethod('test', 'nonExistentMethod');

      expect(() => {
        childComponent1.eventStream.emit('test', { data: 'test' });
      }).toThrow('Parent component does not have method: nonExistentMethod');
    });

    it('should handle invalid filter functions gracefully', () => {
      expect(() => {
        childComponent1.eventStream.addEventFilter('test', 'not a function');
      }).toThrow('Event filter must be a function');
    });

    it('should handle errors in event handlers gracefully', () => {
      // Setup handler that throws error
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });

      childComponent1.eventStream.subscribeFromParent('errorTest', errorHandler);

      // Should not crash when handler throws
      expect(() => {
        childComponent1.eventStream.emit('errorTest', { data: 'test' });
      }).not.toThrow();

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle conditional routing errors gracefully', () => {
      // Setup conditional route that throws error
      childComponent1.eventStream.addConditionalRoute('test', () => {
        throw new Error('Route selection error');
      });

      // Should not crash when route selector throws
      expect(() => {
        childComponent1.eventStream.emit('test', { data: 'test' });
      }).not.toThrow();
    });
  });
});