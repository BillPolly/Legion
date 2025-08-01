/**
 * EventStreamActor - Streams server events to client
 */

export class EventStreamActor {
  constructor(eventEmitter) {
    this.isActor = true;
    this.eventEmitter = eventEmitter;
    this.subscriptions = new Map();
  }

  /**
   * Receive and handle messages
   * @param {Object} message - Incoming message
   */
  receive(message) {
    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(message);
        break;
        
      case 'unsubscribe':
        this.handleUnsubscribe(message);
        break;
        
      default:
        console.warn('EventStreamActor: Unknown message type', message.type);
    }
  }

  /**
   * Handle event subscription
   * @private
   */
  handleSubscribe(message) {
    const { events } = message;
    
    events.forEach(event => {
      if (!this.subscriptions.has(event)) {
        const handler = (data) => {
          this.reply({
            type: 'event',
            event,
            data
          });
        };
        
        this.eventEmitter.on(event, handler);
        this.subscriptions.set(event, handler);
      }
    });
  }

  /**
   * Handle event unsubscription
   * @private
   */
  handleUnsubscribe(message) {
    const { events } = message;
    
    events.forEach(event => {
      const handler = this.subscriptions.get(event);
      if (handler) {
        this.eventEmitter.off(event, handler);
        this.subscriptions.delete(event);
      }
    });
  }

  /**
   * Clean up subscriptions
   */
  destroy() {
    this.subscriptions.forEach((handler, event) => {
      this.eventEmitter.off(event, handler);
    });
    this.subscriptions.clear();
  }

  /**
   * Reply method (set by ActorSpace)
   */
  reply(message) {
    throw new Error('Reply method not initialized');
  }
}