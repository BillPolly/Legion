/**
 * EventBubbler - Utility class for managing hierarchical event routing
 * 
 * Handles setup and management of event communication between parent and child components,
 * including event bubbling, sibling routing, filtering, and cleanup.
 */

export class EventBubbler {
  constructor() {
    // Track routing configurations for cleanup
    this.routingConfigurations = new Map(); // childId -> { parentComponent, childComponent, config }
    
    // Track parent subscriptions for cleanup
    this.parentSubscriptions = new Map(); // parentId -> Map(childId -> Set<subscriptions>)
  }

  /**
   * Setup event routing from child to parent component
   * @param {HierarchicalComponent} parentComponent - Parent component
   * @param {HierarchicalComponent} childComponent - Child component
   * @param {Object} routingConfig - Event routing configuration
   */
  setupChildEventRouting(parentComponent, childComponent, routingConfig) {
    if (!routingConfig || typeof routingConfig !== 'object') {
      throw new Error('Routing configuration must be an object');
    }

    if (!childComponent.eventStream) {
      throw new Error('Child component must have an event stream');
    }

    const eventStream = childComponent.eventStream;

    // Setup basic event bubbling
    if (routingConfig.bubble && Array.isArray(routingConfig.bubble)) {
      for (const eventType of routingConfig.bubble) {
        eventStream.bubbleToParent(eventType);
      }
    }

    // Setup custom method routing
    if (routingConfig.routes && typeof routingConfig.routes === 'object') {
      for (const [eventType, methodName] of Object.entries(routingConfig.routes)) {
        eventStream.routeToParentMethod(eventType, methodName);
      }
    }

    // Setup event filters
    if (routingConfig.filters && typeof routingConfig.filters === 'object') {
      for (const [eventType, filterFunction] of Object.entries(routingConfig.filters)) {
        eventStream.addEventFilter(eventType, filterFunction);
      }
    }

    // Setup conditional routing
    if (routingConfig.conditionalRoutes && typeof routingConfig.conditionalRoutes === 'object') {
      for (const [eventType, routeSelector] of Object.entries(routingConfig.conditionalRoutes)) {
        eventStream.addConditionalRoute(eventType, routeSelector);
      }
    }

    // Store configuration for cleanup tracking
    this.routingConfigurations.set(childComponent.id, {
      parentComponent,
      childComponent,
      config: routingConfig
    });
  }

  /**
   * Update existing child event routing configuration
   * @param {string} childId - Child component ID
   * @param {Object} newConfig - New routing configuration
   */
  updateChildEventRouting(childId, newConfig) {
    const existingConfig = this.routingConfigurations.get(childId);
    if (!existingConfig) {
      throw new Error(`No existing routing configuration found for child: ${childId}`);
    }

    // Cleanup existing routing
    this.cleanupChildEventRouting(childId);

    // Setup new routing
    this.setupChildEventRouting(
      existingConfig.parentComponent,
      existingConfig.childComponent,
      newConfig
    );
  }

  /**
   * Setup parent component to handle child events
   * @param {HierarchicalComponent} parentComponent - Parent component
   * @param {string} childId - Child component ID
   * @param {Object} config - Parent event handling configuration
   */
  setupParentEventHandling(parentComponent, childId, config = {}) {
    if (!parentComponent) {
      throw new Error('Parent component is required');
    }

    if (!childId) {
      throw new Error('Child ID is required');
    }

    const childComponent = parentComponent.children.get(childId);
    if (!childComponent || !childComponent.eventStream) {
      return; // Child not found or no event stream
    }

    // Initialize parent subscriptions tracking
    if (!this.parentSubscriptions.has(parentComponent.id)) {
      this.parentSubscriptions.set(parentComponent.id, new Map());
    }

    const parentSubs = this.parentSubscriptions.get(parentComponent.id);
    if (!parentSubs.has(childId)) {
      parentSubs.set(childId, new Set());
    }

    const childSubscriptions = parentSubs.get(childId);

    // Setup specific event subscriptions
    if (config.subscriptions && Array.isArray(config.subscriptions)) {
      for (const eventType of config.subscriptions) {
        const subscription = childComponent.eventStream.subscribeFromParent(
          eventType,
          config.eventHandler || parentComponent.handleChildEvent.bind(parentComponent)
        );
        childSubscriptions.add(subscription);
      }
    }

    // Setup custom event handler if provided
    if (config.eventHandler && typeof config.eventHandler === 'function') {
      // The event handler is already bound in the subscriptions above
    }
  }

  /**
   * Setup event routing between sibling components through parent
   * @param {HierarchicalComponent} parentComponent - Parent component managing siblings
   * @param {Object} siblingConfig - Sibling routing configuration
   */
  setupSiblingEventRouting(parentComponent, siblingConfig) {
    if (!siblingConfig.sourceChild) {
      throw new Error('Sibling routing requires sourceChild');
    }

    if (!siblingConfig.targetChild && !siblingConfig.broadcast) {
      throw new Error('Sibling routing requires targetChild or broadcast configuration');
    }

    const sourceChild = parentComponent.children.get(siblingConfig.sourceChild);
    if (!sourceChild) {
      throw new Error(`Source child component not found: ${siblingConfig.sourceChild}`);
    }

    if (siblingConfig.targetChild) {
      // Point-to-point sibling routing
      const targetChild = parentComponent.children.get(siblingConfig.targetChild);
      if (!targetChild) {
        throw new Error(`Target child component not found: ${siblingConfig.targetChild}`);
      }

      this._setupPointToPointSiblingRouting(sourceChild, targetChild, siblingConfig);
    }

    if (siblingConfig.broadcast) {
      // Broadcast to all siblings
      this._setupBroadcastSiblingRouting(parentComponent, sourceChild, siblingConfig);
    }
  }

  /**
   * Setup point-to-point sibling event routing
   * @private
   */
  _setupPointToPointSiblingRouting(sourceChild, targetChild, config) {
    if (config.eventMappings && typeof config.eventMappings === 'object') {
      for (const [sourceEvent, targetEvent] of Object.entries(config.eventMappings)) {
        const subscription = sourceChild.eventStream.subscribeFromParent(
          sourceEvent,
          (data) => {
            // Apply filter if configured
            if (config.filter && !config.filter(data)) {
              return;
            }

            // Route to target sibling
            targetChild.eventStream.emit(targetEvent, {
              ...data,
              fromSibling: sourceChild.id
            });
          }
        );

        // Track subscription for cleanup
        this._trackSiblingSubscription(sourceChild.id, targetChild.id, subscription);
      }
    }
  }

  /**
   * Setup broadcast sibling event routing
   * @private
   */
  _setupBroadcastSiblingRouting(parentComponent, sourceChild, config) {
    if (config.broadcast && Array.isArray(config.broadcast)) {
      for (const eventType of config.broadcast) {
        const subscription = sourceChild.eventStream.subscribeFromParent(
          eventType,
          (data) => {
            // Apply filter if configured
            if (config.filter && !config.filter(data)) {
              return;
            }

            // Broadcast to all other children
            for (const [childId, childComponent] of parentComponent.children) {
              if (childId !== sourceChild.id && childComponent.eventStream) {
                childComponent.eventStream.emit(eventType, {
                  ...data,
                  fromSibling: sourceChild.id,
                  broadcast: true
                });
              }
            }
          }
        );

        // Track subscription for cleanup
        this._trackSiblingSubscription(sourceChild.id, 'broadcast', subscription);
      }
    }
  }

  /**
   * Track sibling subscriptions for cleanup
   * @private
   */
  _trackSiblingSubscription(sourceChildId, targetId, subscription) {
    const key = `${sourceChildId}->${targetId}`;
    if (!this.siblingSubscriptions) {
      this.siblingSubscriptions = new Map();
    }
    
    if (!this.siblingSubscriptions.has(key)) {
      this.siblingSubscriptions.set(key, new Set());
    }
    
    this.siblingSubscriptions.get(key).add(subscription);
  }

  /**
   * Cleanup event routing for a child component
   * @param {string} childId - Child component ID
   */
  cleanupChildEventRouting(childId) {
    const routingConfig = this.routingConfigurations.get(childId);
    if (routingConfig) {
      // Cleanup child's event stream
      if (routingConfig.childComponent.eventStream) {
        routingConfig.childComponent.eventStream.cleanup();
      }

      // Remove from tracking
      this.routingConfigurations.delete(childId);
    }
  }

  /**
   * Cleanup parent event handling for specific child
   * @param {string} parentId - Parent component ID
   * @param {string} childId - Child component ID
   */
  cleanupParentEventHandling(parentId, childId) {
    const parentSubs = this.parentSubscriptions.get(parentId);
    if (parentSubs && parentSubs.has(childId)) {
      const childSubscriptions = parentSubs.get(childId);
      
      // Unsubscribe all child subscriptions
      for (const subscription of childSubscriptions) {
        subscription.unsubscribe();
      }

      // Remove child from parent subscriptions
      parentSubs.delete(childId);

      // Clean up parent entry if no more children
      if (parentSubs.size === 0) {
        this.parentSubscriptions.delete(parentId);
      }
    }
  }

  /**
   * Cleanup all parent event handling
   * @param {string} parentId - Parent component ID
   */
  cleanupAllParentEventHandling(parentId) {
    const parentSubs = this.parentSubscriptions.get(parentId);
    if (parentSubs) {
      // Cleanup all child subscriptions
      for (const [childId, childSubscriptions] of parentSubs) {
        for (const subscription of childSubscriptions) {
          subscription.unsubscribe();
        }
      }

      // Remove parent from tracking
      this.parentSubscriptions.delete(parentId);
    }
  }

  /**
   * Cleanup all event bubbler resources
   */
  cleanup() {
    // Cleanup all child routing configurations
    for (const childId of this.routingConfigurations.keys()) {
      this.cleanupChildEventRouting(childId);
    }

    // Cleanup all parent subscriptions
    for (const parentId of this.parentSubscriptions.keys()) {
      this.cleanupAllParentEventHandling(parentId);
    }

    // Cleanup sibling subscriptions
    if (this.siblingSubscriptions) {
      for (const [key, subscriptions] of this.siblingSubscriptions) {
        for (const subscription of subscriptions) {
          subscription.unsubscribe();
        }
      }
      this.siblingSubscriptions.clear();
    }

    // Clear all tracking maps
    this.routingConfigurations.clear();
    this.parentSubscriptions.clear();
  }
}