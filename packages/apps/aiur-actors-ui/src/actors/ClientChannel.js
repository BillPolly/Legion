/**
 * ClientChannel - WebSocket channel adapter for client-side actors
 */

export class ClientChannel {
  constructor(actorSpace, websocket) {
    this.actorSpace = actorSpace;
    this.websocket = websocket;
    this.isConnected = false;
    this.messageQueue = [];
    
    this._setupWebSocketHandlers();
  }

  /**
   * Set up WebSocket event handlers
   * @private
   */
  _setupWebSocketHandlers() {
    this.websocket.onopen = (event) => {
      this.isConnected = true;
      console.log('Channel connected');
      this._flushMessageQueue();
    };
    
    this.websocket.onclose = (event) => {
      this.isConnected = false;
      console.log('Channel disconnected');
    };
    
    this.websocket.onerror = (event) => {
      console.error('Channel error:', event.error);
    };
    
    this.websocket.onmessage = (event) => {
      try {
        const decoded = this.actorSpace.decode(event.data, this);
        this.actorSpace.handleIncomingMessage(decoded);
      } catch (error) {
        console.error('Error handling message:', error);
      }
    };
  }

  /**
   * Send a message to a target actor
   * @param {string} targetGuid - Target actor GUID
   * @param {*} payload - Message payload
   */
  send(targetGuid, payload) {
    const message = { targetGuid, payload };
    
    if (this.isConnected && this.websocket.readyState === 1) { // WebSocket.OPEN = 1
      const encoded = this.actorSpace.encode(message);
      this.websocket.send(encoded);
    } else {
      // Queue message if not connected
      this.messageQueue.push(message);
    }
  }

  /**
   * Flush queued messages
   * @private
   */
  _flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      this.send(message.targetGuid, message.payload);
    }
  }

  /**
   * Create a remote actor proxy
   * @param {string} guid - Remote actor GUID
   * @returns {RemoteActor} Remote actor proxy
   */
  makeRemote(guid) {
    return {
      isActor: true,
      isRemote: true,
      guid: guid,
      _channel: this,
      
      receive(payload) {
        this._channel.send(this.guid, payload);
      }
    };
  }

  /**
   * Close the channel
   */
  close() {
    this.isConnected = false;
    if (this.websocket.readyState === 1) { // WebSocket.OPEN = 1
      this.websocket.close();
    }
  }

  /**
   * Reconnect with a new WebSocket
   * @param {WebSocket} newWebSocket - New WebSocket connection
   */
  reconnect(newWebSocket) {
    this.close();
    this.websocket = newWebSocket;
    this._setupWebSocketHandlers();
  }
}