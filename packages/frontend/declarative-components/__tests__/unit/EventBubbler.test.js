/**
 * Unit tests for EventBubbler utility class
 * Tests event bubbling setup and management between parent and child components:
 * - Setting up child event routing to parent
 * - Parent event handling delegation
 * - Sibling event routing through parent
 * - Event cleanup on component unmount
 */

import { jest } from '@jest/globals';
import { EventBubbler } from '../../src/utils/EventBubbler.js';
import { HierarchicalEventStream } from '../../src/lifecycle/HierarchicalEventStream.js';

describe('EventBubbler', () => {
  let eventBubbler;
  let mockParentComponent;
  let mockChildComponent;
  let mockEventStream;

  beforeEach(() => {
    mockEventStream = {
      bubbleToParent: jest.fn(),
      subscribeFromParent: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      routeToParentMethod: jest.fn(),
      addEventFilter: jest.fn(),
      addConditionalRoute: jest.fn(),
      cleanup: jest.fn()
    };

    mockChildComponent = {
      id: 'child1',
      eventStream: mockEventStream,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    mockParentComponent = {
      id: 'parent1',
      children: new Map([['child1', mockChildComponent]]),
      eventStream: {
        emit: jest.fn(),
        subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() })
      },
      handleChildEvent: jest.fn(),
      onChildClick: jest.fn(),
      onChildSubmit: jest.fn()
    };

    eventBubbler = new EventBubbler();
  });

  describe('Constructor', () => {
    it('should create EventBubbler instance', () => {
      expect(eventBubbler).toBeInstanceOf(EventBubbler);
    });

    it('should initialize with empty routing configurations', () => {
      expect(eventBubbler.routingConfigurations).toBeInstanceOf(Map);
      expect(eventBubbler.routingConfigurations.size).toBe(0);
    });

    it('should initialize with empty parent subscriptions tracking', () => {
      expect(eventBubbler.parentSubscriptions).toBeInstanceOf(Map);
      expect(eventBubbler.parentSubscriptions.size).toBe(0);
    });
  });

  describe('Setting up Child Event Routing', () => {
    it('should setup basic event bubbling for child component', () => {
      const routingConfig = {
        bubble: ['click', 'change', 'submit']
      };

      eventBubbler.setupChildEventRouting(mockParentComponent, mockChildComponent, routingConfig);

      // Should call bubbleToParent for each event type
      expect(mockEventStream.bubbleToParent).toHaveBeenCalledWith('click');
      expect(mockEventStream.bubbleToParent).toHaveBeenCalledWith('change');
      expect(mockEventStream.bubbleToParent).toHaveBeenCalledWith('submit');
      expect(mockEventStream.bubbleToParent).toHaveBeenCalledTimes(3);
    });

    it('should setup custom method routing for specific events', () => {
      const routingConfig = {
        routes: {
          'click': 'onChildClick',
          'submit': 'onChildSubmit'
        }
      };

      eventBubbler.setupChildEventRouting(mockParentComponent, mockChildComponent, routingConfig);

      expect(mockEventStream.routeToParentMethod).toHaveBeenCalledWith('click', 'onChildClick');
      expect(mockEventStream.routeToParentMethod).toHaveBeenCalledWith('submit', 'onChildSubmit');
    });

    it('should setup event filters for child events', () => {
      const clickFilter = (data) => data.button === 'left';
      const submitFilter = (data) => data.isValid === true;

      const routingConfig = {
        bubble: ['click'],
        filters: {
          'click': clickFilter,
          'submit': submitFilter
        }
      };

      eventBubbler.setupChildEventRouting(mockParentComponent, mockChildComponent, routingConfig);

      expect(mockEventStream.addEventFilter).toHaveBeenCalledWith('click', clickFilter);
      expect(mockEventStream.addEventFilter).toHaveBeenCalledWith('submit', submitFilter);
    });

    it('should setup conditional routing based on event data', () => {
      const errorRouter = (data) => {
        return data.severity === 'critical' ? 'handleCriticalError' : 'handleRegularError';
      };

      const routingConfig = {
        conditionalRoutes: {
          'error': errorRouter
        }
      };

      eventBubbler.setupChildEventRouting(mockParentComponent, mockChildComponent, routingConfig);

      expect(mockEventStream.addConditionalRoute).toHaveBeenCalledWith('error', errorRouter);
    });

    it('should store routing configuration for cleanup tracking', () => {
      const routingConfig = {
        bubble: ['click', 'change']
      };

      eventBubbler.setupChildEventRouting(mockParentComponent, mockChildComponent, routingConfig);

      expect(eventBubbler.routingConfigurations.has('child1')).toBe(true);
      const storedConfig = eventBubbler.routingConfigurations.get('child1');
      expect(storedConfig.parentComponent).toBe(mockParentComponent);
      expect(storedConfig.childComponent).toBe(mockChildComponent);
      expect(storedConfig.config).toBe(routingConfig);
    });

    it('should throw error if child component has no event stream', () => {
      const childWithoutStream = {
        id: 'child2',
        eventStream: null
      };

      expect(() => {
        eventBubbler.setupChildEventRouting(mockParentComponent, childWithoutStream, {});
      }).toThrow('Child component must have an event stream');
    });

    it('should validate routing configuration object', () => {
      expect(() => {
        eventBubbler.setupChildEventRouting(mockParentComponent, mockChildComponent, null);
      }).toThrow('Routing configuration must be an object');

      expect(() => {
        eventBubbler.setupChildEventRouting(mockParentComponent, mockChildComponent, 'invalid');
      }).toThrow('Routing configuration must be an object');
    });
  });

  describe('Parent Event Handling', () => {
    it('should setup parent to handle child events with default handler', () => {
      eventBubbler.setupParentEventHandling(mockParentComponent, 'child1');

      // Should use default handleChildEvent method
      expect(mockParentComponent.handleChildEvent).toBeDefined();
    });

    it('should setup parent with custom event handler', () => {
      const customHandler = jest.fn();
      
      eventBubbler.setupParentEventHandling(mockParentComponent, 'child1', {
        eventHandler: customHandler
      });

      const subscription = eventBubbler.parentSubscriptions.get(mockParentComponent.id);
      expect(subscription).toBeDefined();
      expect(subscription.has('child1')).toBe(true);
    });

    it('should subscribe parent to specific child event types', () => {
      const config = {
        subscriptions: ['validation', 'stateChange', 'error']
      };

      eventBubbler.setupParentEventHandling(mockParentComponent, 'child1', config);

      // Should subscribe to each event type from child
      expect(mockEventStream.subscribeFromParent).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple children subscriptions for same parent', () => {
      const child2 = {
        id: 'child2',
        eventStream: {
          subscribeFromParent: jest.fn().mockReturnValue({ unsubscribe: jest.fn() })
        }
      };

      mockParentComponent.children.set('child2', child2);

      eventBubbler.setupParentEventHandling(mockParentComponent, 'child1');
      eventBubbler.setupParentEventHandling(mockParentComponent, 'child2');

      const parentSubs = eventBubbler.parentSubscriptions.get(mockParentComponent.id);
      expect(parentSubs.has('child1')).toBe(true);
      expect(parentSubs.has('child2')).toBe(true);
    });

    it('should throw error if parent component not found', () => {
      expect(() => {
        eventBubbler.setupParentEventHandling(null, 'child1');
      }).toThrow('Parent component is required');
    });

    it('should throw error if child ID not provided', () => {
      expect(() => {
        eventBubbler.setupParentEventHandling(mockParentComponent, null);
      }).toThrow('Child ID is required');
    });
  });

  describe('Sibling Event Routing Through Parent', () => {
    it('should route events between siblings through parent', () => {
      const child2 = {
        id: 'child2',
        eventStream: {
          emit: jest.fn(),
          subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() })
        }
      };

      mockParentComponent.children.set('child2', child2);

      const siblingConfig = {
        sourceChild: 'child1',
        targetChild: 'child2',
        eventMappings: {
          'dataUpdate': 'refreshData',
          'stateChange': 'syncState'
        }
      };

      eventBubbler.setupSiblingEventRouting(mockParentComponent, siblingConfig);

      // Should setup subscriptions for inter-sibling communication
      expect(mockEventStream.subscribeFromParent).toHaveBeenCalled();
    });

    it('should handle broadcast events to all siblings', () => {
      const child2 = {
        id: 'child2',
        eventStream: { emit: jest.fn() }
      };
      const child3 = {
        id: 'child3', 
        eventStream: { emit: jest.fn() }
      };

      mockParentComponent.children.set('child2', child2);
      mockParentComponent.children.set('child3', child3);

      const broadcastConfig = {
        sourceChild: 'child1',
        broadcast: ['globalUpdate', 'systemNotification']
      };

      eventBubbler.setupSiblingEventRouting(mockParentComponent, broadcastConfig);

      // Should setup broadcast mechanism
      expect(mockEventStream.subscribeFromParent).toHaveBeenCalled();
    });

    it('should filter sibling events based on conditions', () => {
      const child2 = {
        id: 'child2',
        eventStream: { emit: jest.fn() }
      };

      mockParentComponent.children.set('child2', child2);

      const filterConfig = {
        sourceChild: 'child1',
        targetChild: 'child2',
        eventMappings: { 'update': 'refresh' },
        filter: (data) => data.priority === 'high'
      };

      eventBubbler.setupSiblingEventRouting(mockParentComponent, filterConfig);

      // Should setup filtered routing
      expect(mockEventStream.subscribeFromParent).toHaveBeenCalled();
    });

    it('should validate sibling routing configuration', () => {
      expect(() => {
        eventBubbler.setupSiblingEventRouting(mockParentComponent, {});
      }).toThrow('Sibling routing requires sourceChild');

      expect(() => {
        eventBubbler.setupSiblingEventRouting(mockParentComponent, {
          sourceChild: 'child1'
        });
      }).toThrow('Sibling routing requires targetChild or broadcast configuration');
    });

    it('should throw error if source or target child not found', () => {
      const validConfig = {
        sourceChild: 'nonexistent',
        targetChild: 'child1',
        eventMappings: { 'test': 'test' }
      };

      expect(() => {
        eventBubbler.setupSiblingEventRouting(mockParentComponent, validConfig);
      }).toThrow('Source child component not found: nonexistent');
    });
  });

  describe('Event Cleanup on Component Unmount', () => {
    it('should cleanup all event routing for child component', () => {
      const routingConfig = {
        bubble: ['click', 'change']
      };

      eventBubbler.setupChildEventRouting(mockParentComponent, mockChildComponent, routingConfig);
      
      expect(eventBubbler.routingConfigurations.has('child1')).toBe(true);

      eventBubbler.cleanupChildEventRouting('child1');

      expect(mockEventStream.cleanup).toHaveBeenCalled();
      expect(eventBubbler.routingConfigurations.has('child1')).toBe(false);
    });

    it('should cleanup parent subscriptions for specific child', () => {
      eventBubbler.setupParentEventHandling(mockParentComponent, 'child1');
      
      const parentSubs = eventBubbler.parentSubscriptions.get(mockParentComponent.id);
      expect(parentSubs.has('child1')).toBe(true);

      eventBubbler.cleanupParentEventHandling(mockParentComponent.id, 'child1');

      expect(parentSubs.has('child1')).toBe(false);
    });

    it('should cleanup all parent subscriptions when parent unmounts', () => {
      eventBubbler.setupParentEventHandling(mockParentComponent, 'child1');
      
      expect(eventBubbler.parentSubscriptions.has(mockParentComponent.id)).toBe(true);

      eventBubbler.cleanupAllParentEventHandling(mockParentComponent.id);

      expect(eventBubbler.parentSubscriptions.has(mockParentComponent.id)).toBe(false);
    });

    it('should handle cleanup for non-existent routing configurations gracefully', () => {
      // Should not throw error
      expect(() => {
        eventBubbler.cleanupChildEventRouting('nonexistent');
      }).not.toThrow();

      expect(() => {
        eventBubbler.cleanupParentEventHandling('nonexistent', 'child1');
      }).not.toThrow();
    });

    it('should cleanup all event bubbler resources', () => {
      eventBubbler.setupChildEventRouting(mockParentComponent, mockChildComponent, { bubble: ['click'] });
      eventBubbler.setupParentEventHandling(mockParentComponent, 'child1');

      expect(eventBubbler.routingConfigurations.size).toBe(1);
      expect(eventBubbler.parentSubscriptions.size).toBe(1);

      eventBubbler.cleanup();

      expect(eventBubbler.routingConfigurations.size).toBe(0);
      expect(eventBubbler.parentSubscriptions.size).toBe(0);
    });
  });

  describe('Complex Event Routing Scenarios', () => {
    it('should handle mixed routing configuration with all features', () => {
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
          'error': (data) => data.critical ? 'handleCriticalError' : 'handleError'
        }
      };

      eventBubbler.setupChildEventRouting(mockParentComponent, mockChildComponent, complexConfig);

      // Verify all configuration types were applied
      expect(mockEventStream.bubbleToParent).toHaveBeenCalledWith('click');
      expect(mockEventStream.bubbleToParent).toHaveBeenCalledWith('focus');
      expect(mockEventStream.routeToParentMethod).toHaveBeenCalledWith('submit', 'onChildSubmit');
      expect(mockEventStream.routeToParentMethod).toHaveBeenCalledWith('validation', 'onChildValidation');
      expect(mockEventStream.addEventFilter).toHaveBeenCalledTimes(2);
      expect(mockEventStream.addConditionalRoute).toHaveBeenCalledTimes(1);
    });

    it('should support dynamic event routing updates', () => {
      const initialConfig = {
        bubble: ['click']
      };

      eventBubbler.setupChildEventRouting(mockParentComponent, mockChildComponent, initialConfig);

      const updatedConfig = {
        bubble: ['click', 'change'],
        routes: {
          'submit': 'onChildSubmit'
        }
      };

      // Update routing (should cleanup and reapply)
      eventBubbler.updateChildEventRouting('child1', updatedConfig);

      const storedConfig = eventBubbler.routingConfigurations.get('child1');
      expect(storedConfig.config).toBe(updatedConfig);
    });

    it('should handle event routing for dynamically added children', () => {
      const dynamicChild = {
        id: 'dynamic-child',
        eventStream: {
          bubbleToParent: jest.fn(),
          subscribeFromParent: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
          cleanup: jest.fn()
        }
      };

      const routingConfig = {
        bubble: ['dataChange']
      };

      eventBubbler.setupChildEventRouting(mockParentComponent, dynamicChild, routingConfig);

      expect(eventBubbler.routingConfigurations.has('dynamic-child')).toBe(true);
      expect(dynamicChild.eventStream.bubbleToParent).toHaveBeenCalledWith('dataChange');
    });
  });
});