/**
 * HierarchicalEventStream - Extends EventStream with hierarchical event capabilities
 * 
 * Provides parent-child event communication, event bubbling, filtering, and routing.
 * Allows child components to emit events that bubble up to parent components.
 */

import { EventStream } from './EventStream.js';

export class HierarchicalEventStream extends EventStream {
  constructor(options) {
    if (!options.parentComponent) {
      throw new Error('Parent component is required for hierarchical event stream');
    }
    
    if (!options.childId) {
      throw new Error('Child ID is required for hierarchical event stream');
    }

    super(options);
    
    this.parentComponent = options.parentComponent;
    this.childId = options.childId;
    
    // Event bubbling configuration
    this.bubbleRoutes = new Map(); // eventType -> 'parent' | methodName
    this.parentSubscriptions = new Map(); // eventType -> Set of parent handlers
    this.eventFilters = new Map(); // eventType -> filter function
    this.conditionalRoutes = new Map(); // eventType -> route selection function
  }

  /**
   * Register an event type to bubble to parent
   * @param {string} eventType - Type of event to bubble
   */
  bubbleToParent(eventType) {
    this.bubbleRoutes.set(eventType, 'parent');
  }

  /**
   * Route specific event type to a parent method
   * @param {string} eventType - Type of event to route
   * @param {string} methodName - Parent method name to call
   */
  routeToParentMethod(eventType, methodName) {
    this.bubbleRoutes.set(eventType, methodName);
  }

  /**
   * Add conditional routing based on event data
   * @param {string} eventType - Type of event to route conditionally
   * @param {Function} routeSelector - Function that returns method name based on event data
   */
  addConditionalRoute(eventType, routeSelector) {
    if (typeof routeSelector !== 'function') {
      throw new Error('Conditional route must be a function');
    }
    this.conditionalRoutes.set(eventType, routeSelector);
  }

  /**
   * Add event filter for specific event type
   * @param {string} eventType - Type of event to filter
   * @param {Function} filterFunction - Function that returns true to allow event
   */
  addEventFilter(eventType, filterFunction) {
    if (typeof filterFunction !== 'function') {
      throw new Error('Event filter must be a function');
    }
    this.eventFilters.set(eventType, filterFunction);
  }

  /**
   * Subscribe to child events from parent component
   * @param {string} eventType - Type of event to listen for
   * @param {Function} handler - Parent handler function
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribeFromParent(eventType, handler) {
    if (!this.parentSubscriptions.has(eventType)) {
      this.parentSubscriptions.set(eventType, new Set());
    }

    const handlers = this.parentSubscriptions.get(eventType);
    handlers.add(handler);

    return {
      unsubscribe: () => {
        if (handlers) {
          handlers.delete(handler);
          // Clean up empty handler sets
          if (handlers.size === 0) {
            this.parentSubscriptions.delete(eventType);
          }
        }
      }
    };
  }

  /**
   * Override emit to handle hierarchical routing and bubbling
   * @param {string} eventType - Type of event to emit
   * @param {any} data - Event data
   */
  emit(eventType, data) {
    if (this.isDestroyed) {
      return;
    }

    // Apply event filter if configured
    const filter = this.eventFilters.get(eventType);
    if (filter && !filter(data)) {
      return; // Event filtered out
    }

    // Add source child information to event data
    const enrichedData = {
      ...data,
      sourceChild: this.childId
    };

    // Call parent subscribers first
    this._notifyParentSubscribers(eventType, enrichedData);

    // Handle bubbling/routing to parent
    this._handleParentRouting(eventType, enrichedData);

    // Call local subscribers (from base EventStream)
    super.emit(eventType, enrichedData);
  }

  /**
   * Notify parent subscribers for this event type
   * @private
   */
  _notifyParentSubscribers(eventType, data) {
    const parentHandlers = this.parentSubscriptions.get(eventType);
    if (parentHandlers) {
      for (const handler of parentHandlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in parent event handler for ${eventType}:`, error);
        }
      }
    }
  }

  /**
   * Handle routing events to parent component
   * @private
   */
  _handleParentRouting(eventType, data) {
    // Check for conditional routing first
    const conditionalRoute = this.conditionalRoutes.get(eventType);
    let targetMethod = null;
    
    if (conditionalRoute) {
      try {
        targetMethod = conditionalRoute(data);
      } catch (error) {
        console.error(`Error in conditional route for ${eventType}:`, error);
        return;
      }
    } else {
      // Check if event should bubble to parent
      const bubbleRoute = this.bubbleRoutes.get(eventType);
      if (!bubbleRoute) {
        return; // No bubbling configured
      }
      targetMethod = bubbleRoute;
    }

    // Route to parent
    this._callParentMethod(targetMethod, eventType, data);
  }

  /**
   * Call appropriate parent method
   * @private
   */
  _callParentMethod(methodName, eventType, data) {
    if (!this.parentComponent) {
      return;
    }

    if (methodName === 'parent') {
      // Use default handleChildEvent method
      if (typeof this.parentComponent.handleChildEvent === 'function') {
        this.parentComponent.handleChildEvent(eventType, data);
      } else {
        throw new Error('Parent component does not implement handleChildEvent method');
      }
    } else {
      // Use specific parent method
      if (typeof this.parentComponent[methodName] === 'function') {
        this.parentComponent[methodName](data);
      } else {
        throw new Error(`Parent component does not have method: ${methodName}`);
      }
    }
  }

  /**
   * Clean up hierarchical event stream resources
   */
  cleanup() {
    // Clear parent subscriptions
    this.parentSubscriptions.clear();
    
    // Clear bubble routes
    this.bubbleRoutes.clear();
    
    // Clear filters and conditional routes
    this.eventFilters.clear();
    this.conditionalRoutes.clear();
    
    // Remove parent reference
    this.parentComponent = null;
    
    // Call parent cleanup
    super.cleanup();
  }
}