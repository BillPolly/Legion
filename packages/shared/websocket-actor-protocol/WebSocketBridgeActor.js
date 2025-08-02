/**
 * Generic WebSocket Bridge Actor
 * 
 * Bridges between actor-based UI components and any WebSocket server
 * using a pluggable protocol implementation.
 */
export class WebSocketBridgeActor {
  constructor(config = {}) {
    this.isActor = true;
    this.protocol = config.protocol;
    this.websocket = config.websocket;
    this.actorSpace = config.actorSpace;
    this.name = config.name || 'WebSocketBridge';
    
    if (!this.protocol) {
      throw new Error('Protocol implementation required');
    }
    
    this.pendingRequests = new Map();
    this.isConnected = false;
    
    if (this.websocket) {
      this.attachWebSocket(this.websocket);
    }
  }

  /**
   * Attach WebSocket and set up handlers
   */
  attachWebSocket(websocket) {
    this.websocket = websocket;
    
    // Set up WebSocket event handlers
    this.websocket.onopen = () => this.handleOpen();
    this.websocket.onmessage = (event) => this.handleMessage(event);
    this.websocket.onclose = () => this.handleClose();
    this.websocket.onerror = (error) => this.handleError(error);
  }

  /**
   * Handle WebSocket connection opened
   */
  handleOpen() {
    console.log(`${this.name}: WebSocket connected`);
    this.isConnected = true;
    
    // Send handshake if protocol requires it
    const handshake = this.protocol.getHandshakeMessage();
    if (handshake) {
      this.sendToServer(handshake);
    }
    
    // Notify other actors
    this.broadcast({
      type: 'connectionStateChanged',
      payload: { connected: true }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(event) {
    try {
      // Decode message using protocol
      const protocolMessage = this.protocol.decode(event.data);
      
      // Validate message
      if (!this.protocol.validate(protocolMessage)) {
        console.warn(`${this.name}: Invalid message received`, protocolMessage);
        return;
      }
      
      // Transform to actor message
      const actorMessage = this.protocol.protocolToActor(protocolMessage);
      
      // Handle connection establishment
      if (!this.isFullyConnected && protocolMessage.type === 'welcome') {
        this.isFullyConnected = true;
        const followUpMessages = this.protocol.handleConnectionEstablished(protocolMessage);
        followUpMessages.forEach(msg => this.sendToServer(msg));
      }
      
      // Route to appropriate actor
      this.routeMessage(actorMessage);
      
    } catch (error) {
      console.error(`${this.name}: Error handling message`, error);
    }
  }

  /**
   * Handle WebSocket closed
   */
  handleClose() {
    console.log(`${this.name}: WebSocket disconnected`);
    this.isConnected = false;
    this.isFullyConnected = false;
    
    // Notify other actors
    this.broadcast({
      type: 'connectionStateChanged',
      payload: { connected: false }
    });
    
    // Reject all pending requests
    this.pendingRequests.forEach((handler, requestId) => {
      handler.reject(new Error('Connection closed'));
    });
    this.pendingRequests.clear();
  }

  /**
   * Handle WebSocket error
   */
  handleError(error) {
    console.error(`${this.name}: WebSocket error`, error);
    
    // Notify other actors
    this.broadcast({
      type: 'connectionError',
      payload: { error: error.message || 'Connection error' }
    });
  }

  /**
   * Receive message from other actors
   */
  receive(message) {
    if (!this.isConnected) {
      console.warn(`${this.name}: Not connected, cannot send message`);
      return;
    }
    
    try {
      // Transform to protocol message
      const protocolMessage = this.protocol.actorToProtocol(message);
      
      // Track request if it has a requestId
      if (message.requestId && message.resolve) {
        this.pendingRequests.set(message.requestId, {
          resolve: message.resolve,
          reject: message.reject,
          timestamp: Date.now()
        });
      }
      
      // Send to server
      this.sendToServer(protocolMessage);
      
    } catch (error) {
      console.error(`${this.name}: Error sending message`, error);
      if (message.reject) {
        message.reject(error);
      }
    }
  }

  /**
   * Send message to server
   */
  sendToServer(message) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      const encoded = this.protocol.encode(message);
      this.websocket.send(encoded);
    } else {
      console.warn(`${this.name}: WebSocket not ready, cannot send`, message);
    }
  }

  /**
   * Route actor message to appropriate destination
   */
  routeMessage(actorMessage) {
    const { type, payload, requestId } = actorMessage;
    
    // Check if this is a response to a pending request
    if (requestId && this.pendingRequests.has(requestId)) {
      const handler = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);
      
      if (type === 'error' || type === 'toolError') {
        handler.reject(new Error(payload.error?.message || 'Request failed'));
      } else {
        handler.resolve(payload);
      }
      return;
    }
    
    // Route based on message type
    switch (type) {
      case 'toolsList':
        this.sendToActor('tools-actor', {
          type: 'toolsList',
          payload: payload
        });
        break;
        
      case 'toolResult':
        this.sendToActor('terminal-actor', {
          type: 'toolResult',
          payload: payload,
          requestId: requestId
        });
        break;
        
      case 'sessionCreated':
        this.sendToActor('session-actor', {
          type: 'sessionCreated',
          payload: payload
        });
        break;
        
      case 'error':
      case 'toolError':
        this.sendToActor('ui-actor', {
          type: type, // Keep original type
          payload: payload,
          requestId: requestId
        });
        break;
        
      default:
        // Broadcast unknown messages
        this.broadcast(actorMessage);
    }
  }

  /**
   * Send message to a specific actor
   */
  sendToActor(actorKey, message) {
    if (this.actorSpace) {
      const actor = this.actorSpace.getActor(actorKey);
      if (actor) {
        actor.receive(message);
      } else {
        console.warn(`${this.name}: Actor not found: ${actorKey}`);
      }
    }
  }

  /**
   * Broadcast message to all actors
   */
  broadcast(message) {
    if (this.actorSpace) {
      // Broadcast to all registered actors
      this.actorSpace.actors.forEach((actor, key) => {
        if (key !== this._key) { // Don't send to self
          actor.receive(message);
        }
      });
    }
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.pendingRequests.clear();
  }
}