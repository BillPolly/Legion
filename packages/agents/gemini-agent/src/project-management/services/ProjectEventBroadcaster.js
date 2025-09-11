/**
 * ProjectEventBroadcaster - WebSocket-based project event broadcasting
 * Handles real-time project updates through actor framework messaging
 */

export class ProjectEventBroadcaster {
  constructor(config = {}) {
    this.remoteActor = config.remoteActor;
    
    // Event broadcasting state
    this.eventQueue = [];
    this.maxQueueSize = 500;
    this.subscribers = new Map(); // clientId -> subscription info
    
    console.log('📡 [ProjectEventBroadcaster] Initialized with actor framework integration');
  }

  /**
   * Subscribe client to project updates
   * @param {string} clientId - Client identifier
   * @param {string} projectId - Project ID to subscribe to
   * @returns {Promise<Object>} Subscription result
   */
  async subscribe(clientId, projectId) {
    let subscription = this.subscribers.get(clientId);
    
    if (!subscription) {
      subscription = {
        clientId: clientId,
        projectIds: [],
        subscribedAt: new Date(),
        lastActivity: new Date()
      };
      this.subscribers.set(clientId, subscription);
    }

    // Add project to subscription if not already included
    if (!subscription.projectIds.includes(projectId)) {
      subscription.projectIds.push(projectId);
      subscription.lastActivity = new Date();
    }

    console.log(`📡 [ProjectEventBroadcaster] Subscribed ${clientId} to project ${projectId}`);

    return {
      success: true,
      clientId: clientId,
      projectId: projectId,
      totalSubscriptions: subscription.projectIds.length
    };
  }

  /**
   * Unsubscribe client from project updates
   * @param {string} clientId - Client identifier
   * @param {string} projectId - Project ID to unsubscribe from
   * @returns {Promise<Object>} Unsubscription result
   */
  async unsubscribe(clientId, projectId) {
    const subscription = this.subscribers.get(clientId);
    if (!subscription) {
      return {
        success: false,
        error: `Client ${clientId} not found`
      };
    }

    // Remove project from subscription
    const index = subscription.projectIds.indexOf(projectId);
    if (index > -1) {
      subscription.projectIds.splice(index, 1);
      subscription.lastActivity = new Date();
    }

    // Remove client completely if no subscriptions remain
    if (subscription.projectIds.length === 0) {
      this.subscribers.delete(clientId);
    }

    console.log(`📡 [ProjectEventBroadcaster] Unsubscribed ${clientId} from project ${projectId}`);

    return {
      success: true,
      clientId: clientId,
      projectId: projectId,
      remainingSubscriptions: subscription.projectIds.length
    };
  }

  /**
   * Broadcast update through actor framework
   * @param {Object} updateData - Update data to broadcast
   * @returns {Promise<Object>} Broadcast result
   */
  async broadcastUpdate(updateData) {
    const event = {
      id: `broadcast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...updateData
    };

    // Add to event queue
    this.eventQueue.push(event);
    
    // Trim queue if necessary
    if (this.eventQueue.length > this.maxQueueSize) {
      this.eventQueue = this.eventQueue.slice(-this.maxQueueSize);
    }

    // Send through actor framework
    if (this.remoteActor) {
      this.remoteActor.receive('project_update', event);
    }

    console.log(`📡 [ProjectEventBroadcaster] Broadcast update: ${updateData.type} for project ${updateData.projectId}`);

    return {
      success: true,
      eventId: event.id,
      timestamp: event.timestamp,
      broadcastCount: this.getSubscriberCountSync(updateData.projectId)
    };
  }

  /**
   * Broadcast update to specific project subscribers
   * @param {string} projectId - Project ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Broadcast result
   */
  async broadcastToSubscribers(projectId, updateData) {
    // Count subscribers for this project
    let subscriberCount = 0;
    
    for (const subscription of this.subscribers.values()) {
      if (subscription.projectIds.includes(projectId)) {
        subscriberCount++;
      }
    }

    // Create event for broadcasting
    const event = {
      id: `targeted-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      targetProjectId: projectId,
      subscriberCount: subscriberCount,
      ...updateData
    };

    // Add to queue
    this.eventQueue.push(event);

    // Broadcast through actor framework (in real implementation, this would target specific subscribers)
    if (this.remoteActor) {
      this.remoteActor.receive('project_targeted_update', event);
    }

    console.log(`📡 [ProjectEventBroadcaster] Targeted broadcast for project ${projectId} to ${subscriberCount} subscribers`);

    return {
      success: true,
      projectId: projectId,
      subscriberCount: subscriberCount,
      eventId: event.id,
      timestamp: event.timestamp
    };
  }

  /**
   * Get subscriber count for project
   * @param {string} projectId - Project ID
   * @returns {Promise<number>} Number of subscribers
   */
  async getSubscriberCount(projectId) {
    return this.getSubscriberCountSync(projectId);
  }

  /**
   * Get subscriber count synchronously (internal helper)
   * @param {string} projectId - Project ID
   * @returns {number} Number of subscribers
   */
  getSubscriberCountSync(projectId) {
    let count = 0;
    
    for (const subscription of this.subscribers.values()) {
      if (subscription.projectIds.includes(projectId)) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Get event history from queue
   * @param {string} projectId - Optional project filter
   * @param {number} limit - Optional limit (default: all)
   * @returns {Promise<Array<Object>>} Event history
   */
  async getEventHistory(projectId = null, limit = null) {
    let events = [...this.eventQueue];

    if (projectId) {
      events = events.filter(e => 
        e.projectId === projectId || e.targetProjectId === projectId
      );
    }

    if (limit) {
      events = events.slice(-limit);
    }

    return events;
  }

  /**
   * Clear event queue
   * @returns {Promise<void>}
   */
  async clearEventQueue() {
    this.eventQueue = [];
    console.log('📡 [ProjectEventBroadcaster] Cleared event queue');
  }

  /**
   * Get broadcaster statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    const allProjectIds = new Set();
    let totalSubscriptions = 0;

    for (const subscription of this.subscribers.values()) {
      totalSubscriptions += subscription.projectIds.length;
      subscription.projectIds.forEach(id => allProjectIds.add(id));
    }

    return {
      totalSubscribers: this.subscribers.size,
      totalSubscriptions: totalSubscriptions,
      uniqueProjects: allProjectIds.size,
      totalEvents: this.eventQueue.length,
      eventQueueSize: this.eventQueue.length,
      queueCapacity: this.maxQueueSize,
      actorConnected: !!this.remoteActor
    };
  }

  /**
   * Get all active subscribers
   * @returns {Promise<Object>} Subscriber information
   */
  async getActiveSubscribers() {
    const subscriberData = {};
    
    for (const [clientId, subscription] of this.subscribers.entries()) {
      subscriberData[clientId] = {
        projectIds: [...subscription.projectIds],
        subscribedAt: subscription.subscribedAt,
        lastActivity: subscription.lastActivity,
        subscriptionCount: subscription.projectIds.length
      };
    }

    return {
      totalClients: this.subscribers.size,
      clients: subscriberData
    };
  }

  /**
   * Set remote actor for broadcasting (used by actor framework)
   * @param {Object} remoteActor - Actor reference for communication
   */
  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('📡 [ProjectEventBroadcaster] Set remote actor for broadcasting');
  }

  /**
   * Health check for broadcaster
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    return {
      status: 'healthy',
      actorConnected: !!this.remoteActor,
      subscriberCount: this.subscribers.size,
      eventQueueSize: this.eventQueue.length,
      timestamp: new Date()
    };
  }
}