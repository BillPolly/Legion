/**
 * MessageHandlerNode - Routes incoming messages to appropriate workflows
 * 
 * Acts as the entry point for agent message processing, routing different
 * message types to their corresponding workflow branches in the BT.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class MessageHandlerNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'message_handler';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    // Message routing configuration
    this.routes = config.routes || {};
    this.defaultRoute = config.defaultRoute || null;
    this.routingStrategy = config.routingStrategy || 'exact_match';
  }

  async executeNode(context) {
    try {
      const message = context.message;
      const messageType = context.messageType || message?.type;
      
      if (!messageType) {
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: 'No message type found in context',
            message: message
          }
        };
      }
      
      // Find the appropriate route
      const route = this.findRoute(messageType, message);
      
      if (!route) {
        return await this.handleUnroutedMessage(messageType, message, context);
      }
      
      // Execute the route workflow
      return await this.executeRoute(route, context);
      
    } catch (error) {
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: error.message,
          stackTrace: error.stack
        }
      };
    }
  }
  
  /**
   * Find the appropriate route for a message type
   */
  findRoute(messageType, message) {
    // Try exact match first
    if (this.routes[messageType]) {
      return this.routes[messageType];
    }
    
    // Try pattern matching if enabled
    if (this.routingStrategy === 'pattern_match') {
      for (const [pattern, route] of Object.entries(this.routes)) {
        if (this.matchesPattern(pattern, messageType)) {
          return route;
        }
      }
    }
    
    // Try conditional routing
    if (this.routingStrategy === 'conditional') {
      for (const [routeKey, route] of Object.entries(this.routes)) {
        if (route.condition && this.evaluateCondition(route.condition, messageType, message)) {
          return route;
        }
      }
    }
    
    // Fallback to default route
    return this.defaultRoute;
  }
  
  /**
   * Check if message type matches a pattern
   */
  matchesPattern(pattern, messageType) {
    // Simple glob-style pattern matching
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(messageType);
  }
  
  /**
   * Evaluate a routing condition
   */
  evaluateCondition(condition, messageType, message) {
    try {
      // Simple condition evaluation - in production would use safer evaluator
      if (typeof condition === 'string') {
        // Replace placeholders
        const expr = condition
          .replace(/\bmessageType\b/g, JSON.stringify(messageType))
          .replace(/\bmessage\.(\w+)\b/g, (match, prop) => {
            return JSON.stringify(message?.[prop]);
          });
        
        // Basic evaluation (unsafe - for demo only)
        return eval(expr);
      } else if (typeof condition === 'function') {
        return condition(messageType, message);
      }
      
      return false;
    } catch (error) {
      console.warn('MessageHandlerNode: Condition evaluation failed:', error);
      return false;
    }
  }
  
  /**
   * Execute a route workflow
   */
  async executeRoute(route, context) {
    try {
      if (this.config.debugMode) {
        console.log(`MessageHandlerNode: Executing route for ${context.messageType}:`, route);
      }
      
      // Create a child node from the route configuration
      const routeNode = this.executor.createNode(route);
      
      // Execute the route workflow
      const result = await routeNode.execute({
        ...context,
        route: route,
        routingInfo: {
          messageType: context.messageType,
          routeMatched: true,
          routeConfig: route
        }
      });
      
      // Add routing metadata to the result
      if (result.data) {
        result.data.routing = {
          messageType: context.messageType,
          routeExecuted: route.name || route.type,
          success: result.status === NodeStatus.SUCCESS
        };
      }
      
      return result;
      
    } catch (error) {
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: `Route execution failed: ${error.message}`,
          route: route,
          messageType: context.messageType
        }
      };
    }
  }
  
  /**
   * Handle messages that don't match any route
   */
  async handleUnroutedMessage(messageType, message, context) {
    if (this.config.logUnroutedMessages) {
      console.log(`MessageHandlerNode: Unrouted message type: ${messageType}`, message);
    }
    
    // Check if there's a fallback configuration
    if (this.config.fallbackBehavior === 'ignore') {
      return {
        status: NodeStatus.SUCCESS,
        data: {
          message: 'Message ignored - no matching route',
          messageType: messageType,
          routed: false
        }
      };
    } else if (this.config.fallbackBehavior === 'error') {
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: `No route found for message type: ${messageType}`,
          messageType: messageType,
          availableRoutes: Object.keys(this.routes)
        }
      };
    }
    
    // Default: try to send back an error response
    const errorResponse = {
      type: 'error',
      error: `Unknown message type: ${messageType}`,
      messageType: messageType,
      requestId: message?.requestId
    };
    
    // Send error response if we have a remote actor
    if (context.remoteActor) {
      context.remoteActor.receive(errorResponse);
    }
    
    return {
      status: NodeStatus.SUCCESS, // Success because we handled the error
      data: {
        message: 'Sent error response for unrouted message',
        messageType: messageType,
        response: errorResponse
      }
    };
  }
  
  /**
   * Handle messages from children (route executions)
   */
  handleChildMessage(child, message) {
    super.handleChildMessage(child, message);
    
    switch (message.type) {
      case 'ROUTE_COMPLETED':
        // Route execution completed successfully
        this.sendToParent({
          type: 'MESSAGE_ROUTED',
          messageType: message.messageType,
          routeResult: message.result
        });
        break;
        
      case 'ROUTE_FAILED':
        // Route execution failed
        this.sendToParent({
          type: 'ROUTING_FAILED',
          messageType: message.messageType,
          error: message.error
        });
        break;
    }
  }
  
  /**
   * Add a route dynamically
   */
  addRoute(messageType, routeConfig) {
    this.routes[messageType] = routeConfig;
    
    if (this.config.debugMode) {
      console.log(`MessageHandlerNode: Added route for ${messageType}:`, routeConfig);
    }
  }
  
  /**
   * Remove a route
   */
  removeRoute(messageType) {
    delete this.routes[messageType];
    
    if (this.config.debugMode) {
      console.log(`MessageHandlerNode: Removed route for ${messageType}`);
    }
  }
  
  /**
   * Update routing configuration
   */
  updateRoutes(newRoutes) {
    this.routes = { ...this.routes, ...newRoutes };
    
    if (this.config.debugMode) {
      console.log('MessageHandlerNode: Updated routes:', Object.keys(this.routes));
    }
  }
  
  /**
   * Get routing statistics
   */
  getRoutingStats() {
    return {
      totalRoutes: Object.keys(this.routes).length,
      routeTypes: Object.keys(this.routes),
      hasDefaultRoute: !!this.defaultRoute,
      routingStrategy: this.routingStrategy
    };
  }
  
  /**
   * Get metadata about this message handler
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      coordinationPattern: 'message_routing',
      routesCount: Object.keys(this.routes).length,
      routingStrategy: this.routingStrategy,
      supportedMessageTypes: Object.keys(this.routes),
      fallbackBehavior: this.config.fallbackBehavior || 'error_response'
    };
  }
}