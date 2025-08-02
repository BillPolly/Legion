/**
 * ClientCommandActor - Handles command execution requests from UI
 * Now inherits from BaseActor for consistent message handling
 */
import { BaseActor } from './BaseActor.js';

export class ClientCommandActor extends BaseActor {
  constructor() {
    super('ClientCommandActor');
    this.messageQueue = [];
    this.pendingRequests = new Map();
    this.requestTimeout = 30000; // 30 seconds default
    this._requestCounter = 0;
    
    // Register additional handlers specific to this actor
    this.registerHandler('execute', this.handleExecute.bind(this));
    this.registerHandler('response', this.handleResponse.bind(this));
  }

  /**
   * Override connection state change to flush queue
   */
  onConnectionStateChanged(connected) {
    if (connected && this.messageQueue.length > 0) {
      this.flushQueue();
    }
  }

  /**
   * Override command result to handle responses
   */
  onCommandResult(result, requestId) {
    this.handleResponse({
      requestId,
      result
    });
  }

  /**
   * Override tool result to handle responses
   */
  onToolResult(result, requestId) {
    this.handleResponse({
      requestId,
      result
    });
  }

  /**
   * Override error handlers to handle responses
   */
  onToolError(error, requestId) {
    if (requestId) {
      this.handleResponse({
        requestId,
        error
      });
    }
  }

  onError(error, requestId) {
    if (requestId) {
      this.handleResponse({
        requestId,
        error
      });
    }
  }

  /**
   * Handle execute command message
   * @private
   */
  handleExecute(message) {
    const { tool, args, requestId } = message;
    
    if (!this.isConnected()) {
      this.messageQueue.push(message);
      console.log(`${this.name}: Queued command - not connected`);
      return;
    }
    
    const outgoingMessage = {
      type: 'tool_execution',
      tool,
      args,
      requestId
    };
    
    // Track pending request
    const timeoutTimer = setTimeout(() => {
      this.handleTimeout(requestId, tool);
    }, this.requestTimeout);
    
    this.pendingRequests.set(requestId, {
      tool,
      timer: timeoutTimer,
      timestamp: Date.now()
    });
    
    // Send to server
    this.sendToServer(outgoingMessage);
  }

  /**
   * Handle response from server
   * @private
   */
  handleResponse(message) {
    const { requestId, result, error } = message;
    
    // Clear pending request
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(requestId);
      console.log(`${this.name}: Request ${requestId} completed`);
    }
    
    // Forward to response actor
    const responseActor = this._space?.getActor('response-actor');
    if (responseActor) {
      responseActor.receive({
        type: error ? 'command_error' : 'command_result',
        requestId,
        result,
        error
      });
    }
  }

  /**
   * Handle request timeout
   * @private
   */
  handleTimeout(requestId, tool) {
    this.pendingRequests.delete(requestId);
    console.error(`${this.name}: Request ${requestId} timed out for tool '${tool}'`);
    
    if (this._space) {
      this._space.emit('request_timeout', {
        requestId,
        tool
      });
    }
  }

  /**
   * Send message to server through channel or bridge
   * @private
   */
  sendToServer(message) {
    // Try to send through websocket bridge first
    const bridge = this._space?.getActor('websocket-bridge');
    if (bridge) {
      bridge.receive(message);
    } else {
      // Fallback to channel if available
      const channel = this.getChannel();
      if (channel) {
        channel.send('tool-executor', message);
      } else {
        console.error(`${this.name}: No way to send message to server`);
      }
    }
  }

  /**
   * Get the primary channel
   * @private
   */
  getChannel() {
    if (!this._space) return null;
    
    // Get first available channel
    const channels = Array.from(this._space.channels.values());
    return channels[0] || null;
  }

  /**
   * Flush queued messages
   */
  flushQueue() {
    console.log(`${this.name}: Flushing ${this.messageQueue.length} queued messages`);
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift();
      this.receive(message);
    }
  }

  /**
   * Generate unique request ID
   * @returns {string} Request ID
   */
  generateRequestId() {
    return `cmd-${++this._requestCounter}-${Date.now()}`;
  }

  /**
   * Clean up actor
   */
  destroy() {
    // Clear all pending requests
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timer);
    });
    this.pendingRequests.clear();
    
    // Clear message queue
    this.messageQueue = [];
    
    // Call parent cleanup
    super.destroy();
  }
}