/**
 * HandleSubscriptions - Generic event subscription system for handles
 * 
 * Manages both local and remote event subscriptions with automatic forwarding
 * across actor boundaries. Provides subscription introspection and cleanup.
 */

export class HandleSubscriptions {
  constructor(handle) {
    this.handle = handle;
    this.localSubscribers = new Map(); // event -> Set of callbacks
    this.remoteSubscribers = new Map(); // event -> Set of actor GUIDs
  }

  /**
   * Subscribe to an event locally
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(event, callback) {
    if (!this.localSubscribers.has(event)) {
      this.localSubscribers.set(event, new Set());
    }
    
    this.localSubscribers.get(event).add(callback);
    
    // Return unsubscribe function
    return () => this.unsubscribe(event, callback);
  }

  /**
   * Unsubscribe from an event locally
   * @param {string} event - Event name
   * @param {Function} callback - Callback to remove
   */
  unsubscribe(event, callback) {
    const eventSubscribers = this.localSubscribers.get(event);
    if (eventSubscribers) {
      eventSubscribers.delete(callback);
      
      // Clean up empty event sets
      if (eventSubscribers.size === 0) {
        this.localSubscribers.delete(event);
      }
    }
  }

  /**
   * Subscribe to an event from a remote actor
   * @param {string} event - Event name
   * @param {string} remoteActorGuid - GUID of remote actor to notify
   */
  subscribeRemote(event, remoteActorGuid) {
    if (!this.remoteSubscribers.has(event)) {
      this.remoteSubscribers.set(event, new Set());
    }
    
    this.remoteSubscribers.get(event).add(remoteActorGuid);
  }

  /**
   * Unsubscribe remote actor from an event
   * @param {string} event - Event name
   * @param {string} remoteActorGuid - GUID of remote actor to remove
   */
  unsubscribeRemote(event, remoteActorGuid) {
    const remoteSubscribers = this.remoteSubscribers.get(event);
    if (remoteSubscribers) {
      remoteSubscribers.delete(remoteActorGuid);
      
      // Clean up empty remote sets
      if (remoteSubscribers.size === 0) {
        this.remoteSubscribers.delete(event);
      }
    }
  }

  /**
   * Emit event to all local and remote subscribers
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  emit(event, data) {
    // Emit to local subscribers
    const localSubscribers = this.localSubscribers.get(event);
    if (localSubscribers) {
      localSubscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error);
        }
      });
    }

    // Forward to remote subscribers
    const remoteSubscribers = this.remoteSubscribers.get(event);
    if (remoteSubscribers) {
      remoteSubscribers.forEach(remoteGuid => {
        try {
          this.handle.sendToActor(remoteGuid, 'handle-event', {
            handleId: this.handle.getGuid(),
            event,
            data
          });
        } catch (error) {
          console.error(`Error forwarding event ${event} to remote actor ${remoteGuid}:`, error);
        }
      });
    }
  }

  /**
   * Check if event has local subscriptions
   * @param {string} event - Event name
   * @returns {boolean} True if event has local subscribers
   */
  hasSubscriptions(event) {
    const localSubs = this.localSubscribers.get(event);
    return !!(localSubs && localSubs.size > 0);
  }

  /**
   * Check if event has remote subscriptions
   * @param {string} event - Event name
   * @returns {boolean} True if event has remote subscribers
   */
  hasRemoteSubscriptions(event) {
    const remoteSubs = this.remoteSubscribers.get(event);
    return !!(remoteSubs && remoteSubs.size > 0);
  }

  /**
   * List all event names with subscriptions
   * @returns {Array<string>} Event names
   */
  listEvents() {
    const localEvents = Array.from(this.localSubscribers.keys());
    const remoteEvents = Array.from(this.remoteSubscribers.keys());
    
    // Combine and deduplicate
    return [...new Set([...localEvents, ...remoteEvents])];
  }

  /**
   * Get subscription count for an event
   * @param {string} event - Event name
   * @returns {Object} Subscription counts
   */
  getSubscriptionCount(event) {
    const local = this.localSubscribers.get(event)?.size || 0;
    const remote = this.remoteSubscribers.get(event)?.size || 0;
    
    return {
      local,
      remote,
      total: local + remote
    };
  }

  /**
   * Get complete subscription statistics
   * @returns {Object} Subscription statistics
   */
  getStats() {
    let totalLocal = 0;
    let totalRemote = 0;
    let eventsWithBoth = 0;
    
    const allEvents = this.listEvents();
    
    allEvents.forEach(event => {
      const hasLocal = this.hasSubscriptions(event);
      const hasRemote = this.hasRemoteSubscriptions(event);
      
      if (hasLocal && hasRemote) {
        eventsWithBoth++;
      }
      
      totalLocal += this.localSubscribers.get(event)?.size || 0;
      totalRemote += this.remoteSubscribers.get(event)?.size || 0;
    });
    
    return {
      totalEvents: allEvents.length,
      totalLocalSubscriptions: totalLocal,
      totalRemoteSubscriptions: totalRemote,
      eventsWithBothLocalAndRemote: eventsWithBoth
    };
  }

  /**
   * Clear all subscriptions for a specific event
   * @param {string} event - Event name
   */
  clearEvent(event) {
    this.localSubscribers.delete(event);
    this.remoteSubscribers.delete(event);
  }

  /**
   * Clear all subscriptions
   */
  clear() {
    this.localSubscribers.clear();
    this.remoteSubscribers.clear();
  }

  /**
   * Handle incoming remote subscription requests
   * @param {string} event - Event name
   * @param {string} remoteGuid - Remote actor GUID
   */
  handleRemoteSubscribeRequest(event, remoteGuid) {
    this.subscribeRemote(event, remoteGuid);
  }

  /**
   * Handle incoming remote unsubscription requests
   * @param {string} event - Event name
   * @param {string} remoteGuid - Remote actor GUID  
   */
  handleRemoteUnsubscribeRequest(event, remoteGuid) {
    this.unsubscribeRemote(event, remoteGuid);
  }
}