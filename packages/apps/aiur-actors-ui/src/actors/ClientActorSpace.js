/**
 * ClientActorSpace - Client-side actor space implementation
 * Extends the base ActorSpace with client-specific functionality
 */
import { ActorMessage } from './ActorMessage.js';

let clientSpaceCounter = 0;

export class ClientActorSpace {
  constructor(spaceId = null) {
    this.spaceId = spaceId || `ClientSpace-${++clientSpaceCounter}`;
    this.actors = new Map();
    this.channels = new Map();
    this.eventListeners = new Map();
    this.ActorMessage = ActorMessage;
  }

  /**
   * Register an actor in this space
   * @param {Actor} actor - The actor to register
   * @param {string} key - Unique key for the actor
   */
  register(actor, key) {
    if (!actor.isActor) {
      throw new Error('Object must be an actor (isActor: true)');
    }
    
    this.actors.set(key, actor);
    actor._space = this;
    actor._key = key;
  }

  /**
   * Get an actor by key
   * @param {string} key - Actor key
   * @returns {Actor|undefined} The actor or undefined
   */
  getActor(key) {
    return this.actors.get(key);
  }

  /**
   * Add a WebSocket channel
   * @param {WebSocket} websocket - WebSocket connection
   * @returns {ClientChannel} The created channel
   */
  addChannel(websocket) {
    // Dynamic import to avoid circular dependencies
    const ClientChannel = this._getClientChannel();
    const channel = new ClientChannel(this, websocket);
    this.channels.set(websocket, channel);
    return channel;
  }

  /**
   * Get ClientChannel class (lazy loading)
   * @private
   */
  _getClientChannel() {
    if (!this._ClientChannel) {
      // We'll set this during initialization
      throw new Error('ClientChannel not initialized. Use setClientChannel() first.');
    }
    return this._ClientChannel;
  }

  /**
   * Set the ClientChannel class
   * @param {Class} ClientChannel - ClientChannel class
   */
  setClientChannel(ClientChannel) {
    this._ClientChannel = ClientChannel;
  }

  /**
   * Encode an object for transmission
   * @param {*} obj - Object to encode
   * @returns {string} JSON string
   */
  encode(obj) {
    try {
      // If it's already an ActorMessage, serialize it
      if (obj && obj.serialize) {
        return obj.serialize();
      }
      
      // If it's a plain object with a type, wrap it in ActorMessage
      if (obj && typeof obj === 'object' && obj.type) {
        const message = this.ActorMessage.create(obj);
        return message.serialize();
      }
      
      // Fallback to direct JSON serialization
      return JSON.stringify(obj);
    } catch (error) {
      console.warn('Failed to encode message with ActorMessage protocol, falling back to JSON:', error);
      return JSON.stringify(obj);
    }
  }

  /**
   * Decode a received message
   * @param {string} str - JSON string
   * @param {ClientChannel} channel - Source channel
   * @returns {*} Decoded object
   */
  decode(str, channel = null) {
    try {
      // Try to deserialize as ActorMessage
      const message = this.ActorMessage.deserialize(str);
      
      // Validate the message
      if (!message.isValid()) {
        console.warn('Received invalid message:', message.getValidationErrors());
        // Still return the message for debugging
        return message.toObject();
      }
      
      // Return the message as a plain object for compatibility
      return message.toObject();
    } catch (error) {
      console.warn('Failed to decode message with ActorMessage protocol, falling back to JSON:', error);
      try {
        return JSON.parse(str);
      } catch (jsonError) {
        console.error('Failed to parse JSON:', jsonError);
        return { type: 'parseError', error: jsonError.message, originalMessage: str };
      }
    }
  }

  /**
   * Handle incoming message from a channel
   * @param {Object} message - Decoded message
   */
  handleIncomingMessage(message) {
    const { targetActor, payload } = message;
    
    const actor = this.actors.get(targetActor);
    if (actor) {
      actor.receive(payload);
    } else {
      console.warn(`No actor found for key: ${targetActor}`);
    }
  }

  /**
   * Subscribe to events
   * @param {string} event - Event name
   * @param {Function} listener - Event listener
   */
  on(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(listener);
  }

  /**
   * Unsubscribe from events
   * @param {string} event - Event name
   * @param {Function} listener - Event listener
   */
  off(event, listener) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Clean up the actor space
   */
  destroy() {
    // Destroy all actors
    this.actors.forEach(actor => {
      if (typeof actor.destroy === 'function') {
        actor.destroy();
      }
    });
    this.actors.clear();
    
    // Close all channels
    this.channels.forEach(channel => {
      channel.close();
    });
    this.channels.clear();
    
    // Clear event listeners
    this.eventListeners.clear();
  }
}