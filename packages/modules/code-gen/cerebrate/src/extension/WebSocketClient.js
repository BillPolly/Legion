import { EventEmitter } from 'events';

/**
 * WebSocket Client for Cerebrate Chrome Extension
 * Manages WebSocket connection to debug server with reconnection logic
 */
export class WebSocketClient extends EventEmitter {

  constructor() {
    super();
    
    this.ws = null;
    this.url = null;
    this.state = 'disconnected';
    this.messageQueue = [];
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.connectionTimeout = null;
    
    this.config = {
      reconnectAttempts: 3,
      reconnectDelay: 1000,
      exponentialBackoff: false,
      maxBackoffDelay: 30000,
      timeout: 30000,
      queueMessages: true,
      maxQueueSize: 100
    };
  }

  /**
   * Connect to WebSocket server
   * @param {string} url - WebSocket server URL
   * @param {Object} options - Connection options
   * @returns {Promise<boolean>} - True if connected successfully
   */
  async connect(url, options = {}) {
    if (this.state === 'connected' || this.state === 'connecting') {
      throw new Error('Already connected or connecting');
    }

    this.url = url;
    this.config = { ...this.config, ...options };
    this.reconnectAttempt = 0;

    return this.attemptConnection();
  }

  /**
   * Attempt WebSocket connection
   * @private
   * @returns {Promise<boolean>} - True if connected
   */
  async attemptConnection() {
    return new Promise((resolve, reject) => {
      this.setState('connecting');
      
      // Track if promise has been resolved/rejected
      let settled = false;

      try {
        this.ws = new WebSocket(this.url);
      } catch (error) {
        this.setState('disconnected');
        return reject(error);
      }

      // Setup connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.state === 'connecting' && !settled) {
          settled = true;
          this.ws.close();
          this.setState('disconnected');
          reject(new Error('Connection timeout'));
        }
      }, this.config.timeout);

      // WebSocket event handlers
      this.ws.onopen = () => {
        if (!settled) {
          settled = true;
          clearTimeout(this.connectionTimeout);
          this.setState('connected');
          this.reconnectAttempt = 0;
          this.processMessageQueue();
          this.emit('connected');
          resolve(true);
        }
      };

      this.ws.onclose = (event) => {
        clearTimeout(this.connectionTimeout);
        const wasConnected = this.state === 'connected';
        const wasConnecting = this.state === 'connecting';
        this.setState('disconnected');
        
        this.emit('disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });

        // Handle connection rejection
        if (wasConnecting && !settled) {
          settled = true;
          reject(new Error('Connection closed'));
        }
        // Attempt reconnection if it was an unexpected disconnect
        else if (wasConnected && !event.wasClean && this.config.reconnectAttempts > 0) {
          this.scheduleReconnection();
        }
      };

      this.ws.onerror = (error) => {
        this.emit('error', error);
        // Don't reject here - let onclose handle it
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.emit('message', message);
        } catch (error) {
          this.emit('error', new Error(`Failed to parse message: ${error.message}`));
        }
      };
    });
  }

  /**
   * Schedule reconnection attempt
   * @private
   */
  scheduleReconnection() {
    if (this.reconnectAttempt >= this.config.reconnectAttempts) {
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempt++;
    
    let delay = this.config.reconnectDelay;
    if (this.config.exponentialBackoff) {
      delay = Math.min(
        this.config.reconnectDelay * Math.pow(2, this.reconnectAttempt - 1),
        this.config.maxBackoffDelay
      );
    }

    this.emit('reconnecting', {
      attempt: this.reconnectAttempt,
      maxAttempts: this.config.reconnectAttempts,
      delay
    });

    this.reconnectTimer = setTimeout(() => {
      this.attemptConnection().catch(() => {
        // Reconnection failed, schedule another attempt if we haven't reached the limit
        this.scheduleReconnection();
      });
    }, delay);
  }

  /**
   * Disconnect from WebSocket server
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  disconnect(code = 1000, reason = 'Normal closure') {
    // Store original reconnect attempts to restore later
    const originalReconnectAttempts = this.config.reconnectAttempts;
    
    // Prevent reconnection on intentional disconnect
    this.config.reconnectAttempts = 0;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.setState('disconnecting');
      
      // Remove close handler temporarily to avoid triggering reconnect
      const originalOnClose = this.ws.onclose;
      this.ws.onclose = (event) => {
        this.setState('disconnected');
        this.emit('disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        // Restore config
        this.config.reconnectAttempts = originalReconnectAttempts;
      };
      
      this.ws.close(code, reason);
    } else {
      this.setState('disconnected');
      // Restore config
      this.config.reconnectAttempts = originalReconnectAttempts;
    }
  }

  /**
   * Send message through WebSocket
   * @param {Object} message - Message to send
   * @returns {boolean} - True if sent immediately, false if queued
   */
  send(message) {
    if (this.state === 'connected' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        this.emit('error', error);
        return false;
      }
    } else if (this.config.queueMessages) {
      if (this.messageQueue.length < this.config.maxQueueSize) {
        this.messageQueue.push(message);
        return false;
      } else {
        throw new Error('Message queue is full');
      }
    } else {
      throw new Error('Not connected');
    }
  }

  /**
   * Process queued messages
   * @private
   */
  processMessageQueue() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Process queue after connection is established
    setTimeout(() => {
      const queue = [...this.messageQueue];
      this.messageQueue = [];

      queue.forEach(message => {
        try {
          this.ws.send(JSON.stringify(message));
        } catch (error) {
          this.emit('error', error);
          // Re-queue the message
          if (this.messageQueue.length < this.config.maxQueueSize) {
            this.messageQueue.push(message);
          }
        }
      });
    }, 10);
  }

  /**
   * Set connection state
   * @param {string} newState - New state
   * @private
   */
  setState(newState) {
    if (this.state !== newState) {
      this.state = newState;
      this.emit('stateChange', newState);
    }
  }

  /**
   * Check if connected
   * @returns {boolean} - True if connected
   */
  isConnected() {
    return this.state === 'connected' && 
           this.ws && 
           this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current state
   * @returns {string} - Current state
   */
  getState() {
    return this.state;
  }

  /**
   * Get WebSocket instance
   * @returns {WebSocket|null} - WebSocket instance or null
   */
  getWebSocket() {
    return this.ws;
  }

  /**
   * Get configuration
   * @returns {Object} - Current configuration
   */
  getConfiguration() {
    return { ...this.config };
  }

  /**
   * Get queued message count
   * @returns {number} - Number of queued messages
   */
  getQueuedMessageCount() {
    return this.messageQueue.length;
  }

  /**
   * Clear message queue
   */
  clearMessageQueue() {
    this.messageQueue = [];
  }

  /**
   * Destroy client and cleanup resources
   */
  destroy() {
    // Immediately set state to disconnected
    this.setState('disconnected');
    
    // Cancel any pending reconnections
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // Force disconnect without triggering reconnection
    this.config.reconnectAttempts = 0;
    
    if (this.ws) {
      // Remove event handlers before closing
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
    }

    this.messageQueue = [];
    this.removeAllListeners();
    this.ws = null;
    this.url = null;
    this.reconnectAttempt = 0;
  }
}