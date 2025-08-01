/**
 * ServerActorSpace - Server-side actor space for client connections
 */

import { ToolExecutorActor } from './ToolExecutorActor.js';
import { SessionManagerActor } from './SessionManagerActor.js';
import { EventStreamActor } from './EventStreamActor.js';

export class ServerActorSpace {
  constructor(clientId, dependencies = {}) {
    this.clientId = clientId;
    this.spaceId = `ServerSpace-${clientId}-${Date.now()}`;
    this.actors = new Map();
    this.channel = null;
    this.dependencies = dependencies;
    
    this._initializeActors();
  }

  /**
   * Initialize default server actors
   * @private
   */
  _initializeActors() {
    const { toolRegistry, sessionManager, eventEmitter } = this.dependencies;
    
    // Create and register server actors
    if (toolRegistry && sessionManager) {
      const toolExecutor = new ToolExecutorActor(toolRegistry, sessionManager);
      this.register(toolExecutor, 'tool-executor');
    }
    
    if (sessionManager) {
      const sessionActor = new SessionManagerActor(sessionManager);
      this.register(sessionActor, 'session-manager');
    }
    
    if (eventEmitter) {
      const eventStream = new EventStreamActor(eventEmitter);
      this.register(eventStream, 'event-stream');
    }
  }

  /**
   * Register an actor
   * @param {Actor} actor - Actor instance
   * @param {string} key - Actor key
   */
  register(actor, key) {
    this.actors.set(key, actor);
    actor._space = this;
    actor._key = key;
    
    // Set up reply mechanism
    actor.reply = (message) => {
      this.sendToClient(actor._key, message);
    };
    
    // Set up event emission
    actor.emit = (event, data) => {
      this.emitClientEvent(event, data);
    };
  }

  /**
   * Get an actor by key
   * @param {string} key - Actor key
   * @returns {Actor|undefined} Actor instance
   */
  getActor(key) {
    return this.actors.get(key);
  }

  /**
   * Connect WebSocket to this space
   * @param {WebSocket} ws - WebSocket connection
   * @returns {Object} Channel-like interface
   */
  connectWebSocket(ws) {
    // Set up WebSocket handlers
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleIncomingMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log(`Client ${this.clientId} disconnected`);
      this.destroy();
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${this.clientId}:`, error);
    });
    
    // Store channel reference
    this.channel = {
      websocket: ws,
      send: (targetActor, payload) => {
        if (ws.readyState === 1) { // OPEN
          ws.send(JSON.stringify({ targetActor, payload }));
        }
      }
    };
    
    return this.channel;
  }

  /**
   * Handle incoming message from client
   * @param {Object} message - Parsed message
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
   * Send message to client
   * @param {string} fromActor - Source actor key
   * @param {Object} message - Message to send
   */
  sendToClient(fromActor, message) {
    if (this.channel && this.channel.websocket.readyState === 1) {
      this.channel.send('response-actor', message);
    }
  }

  /**
   * Broadcast message to client
   * @param {Object} message - Message to broadcast
   */
  broadcastToClient(message) {
    if (this.channel && this.channel.websocket.readyState === 1) {
      this.channel.send('ui-update-actor', message);
    }
  }

  /**
   * Emit event related to this client
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emitClientEvent(event, data) {
    if (this.dependencies.eventEmitter) {
      this.dependencies.eventEmitter.emit(`client:${event}`, {
        clientId: this.clientId,
        data
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
    
    // Clear channel
    this.channel = null;
  }
}