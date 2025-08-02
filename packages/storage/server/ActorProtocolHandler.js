/**
 * Actor Protocol Handler
 * Processes Actor protocol messages and manages request/response correlation
 */

export class ActorProtocolHandler {
  constructor() {
    this.subscriptions = new Map();
  }

  /**
   * Process incoming message and return response
   */
  async processMessage(message, actorHost) {
    // Validate message structure
    if (!message.type) {
      throw new Error('Invalid message: missing type');
    }

    // Handle different message types
    switch (message.type) {
      case 'request':
        return await this.handleRequest(message, actorHost);
      
      case 'subscribe':
        return await this.handleSubscribe(message, actorHost);
      
      case 'unsubscribe':
        return await this.handleUnsubscribe(message, actorHost);
      
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle request messages
   */
  async handleRequest(message, actorHost) {
    // Validate request structure
    if (!message.id) {
      throw new Error('Invalid request: missing id');
    }
    if (!message.actor) {
      throw new Error('Invalid request: missing actor');
    }
    if (!message.method) {
      throw new Error('Invalid request: missing method');
    }

    try {
      // Get actor from host
      const actor = actorHost.getActor(message.actor);
      
      if (!actor) {
        return this.createErrorResponse(
          message.id,
          `Actor not found: ${message.actor}`,
          'ACTOR_NOT_FOUND'
        );
      }

      // Call actor method
      const result = await actor.receive(message.method, message.params || {});

      // Create success response
      return {
        type: 'response',
        id: message.id,
        success: true,
        data: result,
        timestamp: Date.now()
      };
    } catch (error) {
      // Create error response
      return this.createErrorResponse(
        message.id,
        error.message,
        'ACTOR_ERROR'
      );
    }
  }

  /**
   * Handle subscribe messages
   */
  async handleSubscribe(message, actorHost) {
    const subscriptionId = message.id;
    
    // Store subscription info
    this.subscriptions.set(subscriptionId, {
      actor: message.actor,
      event: message.event,
      timestamp: Date.now()
    });

    return {
      type: 'response',
      id: message.id,
      success: true,
      data: { subscribed: true },
      timestamp: Date.now()
    };
  }

  /**
   * Handle unsubscribe messages
   */
  async handleUnsubscribe(message, actorHost) {
    const { subscriptionId } = message;
    
    // Remove subscription
    this.subscriptions.delete(subscriptionId);

    return {
      type: 'response',
      id: message.id,
      success: true,
      data: { unsubscribed: true },
      timestamp: Date.now()
    };
  }

  /**
   * Create error response
   */
  createErrorResponse(id, message, code) {
    return {
      type: 'response',
      id,
      success: false,
      error: {
        message,
        code
      },
      timestamp: Date.now()
    };
  }

  /**
   * Send notification to subscribed clients
   */
  createNotification(event, data) {
    return {
      type: 'notification',
      event,
      data,
      timestamp: Date.now()
    };
  }
}