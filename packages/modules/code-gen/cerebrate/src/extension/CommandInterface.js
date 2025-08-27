import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Command Interface for Cerebrate Chrome Extension
 * Manages command execution, queueing, and response correlation
 */
export class CommandInterface extends EventEmitter {

  constructor(webSocketClient) {
    super();
    
    this.wsClient = webSocketClient;
    this.pendingCommands = new Map(); // commandId -> { promise, timeout, metadata }
    this.commandQueue = [];
    this.commandHistory = [];
    this.historyEnabled = false;
    this.maxHistorySize = 100;
    this.maxQueueSize = 50;
    this.defaultTimeout = 30000; // 30 seconds
    
    this.retryConfig = {
      maxRetries: 0,
      retryDelay: 1000
    };

    this.setupEventListeners();
  }

  /**
   * Setup WebSocket event listeners
   * @private
   */
  setupEventListeners() {
    if (this.wsClient) {
      this.wsClient.on('message', this.handleMessage.bind(this));
      this.wsClient.on('disconnected', this.handleDisconnect.bind(this));
      this.wsClient.on('connected', this.handleConnect.bind(this));
      this.wsClient.on('error', this.handleError.bind(this));
    }
  }

  /**
   * Create a command object
   * @param {string} commandName - Name of the command
   * @param {Object} payload - Command payload
   * @param {Object} metadata - Optional metadata
   * @returns {Object} - Command object
   */
  createCommand(commandName, payload, metadata = {}) {
    if (!commandName) {
      throw new Error('Command name is required');
    }

    if (typeof commandName !== 'string') {
      throw new Error('Command name must be a string');
    }

    if (payload === null || typeof payload !== 'object') {
      throw new Error('Payload must be an object');
    }

    const command = {
      id: `cmd-${uuidv4()}`,
      type: 'command',
      command: commandName,
      payload: payload,
      timestamp: Date.now()
    };

    if (Object.keys(metadata).length > 0) {
      command.metadata = metadata;
    }

    return command;
  }

  /**
   * Execute a command
   * @param {string} commandName - Command name
   * @param {Object} payload - Command payload
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Command response
   */
  async execute(commandName, payload, options = {}) {
    const command = this.createCommand(commandName, payload, options.metadata);
    const timeout = options.timeout || this.defaultTimeout;
    const retry = options.retry || false;

    // Check if we should queue the command
    if (!this.wsClient.isConnected()) {
      if (this.commandQueue.length >= this.maxQueueSize) {
        throw new Error('Command queue is full');
      }

      return new Promise((resolve, reject) => {
        this.commandQueue.push({
          command,
          resolve,
          reject,
          options: { timeout, retry }
        });
      });
    }

    // Execute immediately
    return this.executeCommand(command, timeout, retry);
  }

  /**
   * Execute a command immediately
   * @param {Object} command - Command object
   * @param {number} timeout - Timeout in milliseconds
   * @param {boolean} retry - Whether to retry on failure
   * @param {number} attemptNumber - Current attempt number
   * @returns {Promise<Object>} - Command response
   * @private
   */
  async executeCommand(command, timeout, retry, attemptNumber = 1) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      // Setup timeout
      const timeoutId = setTimeout(() => {
        this.pendingCommands.delete(command.id);
        reject(new Error('Command timeout'));
      }, timeout);

      // Store pending command
      this.pendingCommands.set(command.id, {
        resolve: (response) => {
          clearTimeout(timeoutId);
          this.pendingCommands.delete(command.id);
          
          if (this.historyEnabled) {
            this._recordHistory(command.command, command.payload, true, Date.now() - startTime);
          }
          
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          this.pendingCommands.delete(command.id);
          
          // Check if we should retry
          if (retry && attemptNumber < this.retryConfig.maxRetries + 1) {
            setTimeout(() => {
              this.executeCommand(command, timeout, retry, attemptNumber + 1)
                .then(resolve)
                .catch(reject);
            }, this.retryConfig.retryDelay);
          } else {
            if (this.historyEnabled) {
              this._recordHistory(command.command, command.payload, false, Date.now() - startTime);
            }
            reject(error);
          }
        },
        timeout: timeoutId,
        metadata: { startTime, attemptNumber }
      });

      // Send the command
      const sent = this.wsClient.send(command);
      if (!sent) {
        clearTimeout(timeoutId);
        this.pendingCommands.delete(command.id);
        reject(new Error('Failed to send command'));
      }
    });
  }

  /**
   * Process queued commands
   */
  async processQueue() {
    if (!this.wsClient.isConnected()) {
      return;
    }

    const queue = [...this.commandQueue];
    this.commandQueue = [];

    for (const item of queue) {
      try {
        const response = await this.executeCommand(
          item.command,
          item.options.timeout,
          item.options.retry
        );
        item.resolve(response);
      } catch (error) {
        item.reject(error);
      }
    }
  }

  /**
   * Handle incoming messages
   * @param {Object} message - WebSocket message
   * @private
   */
  handleMessage(message) {
    if (message.type === 'response' && message.command_id) {
      const pending = this.pendingCommands.get(message.command_id);
      if (pending) {
        if (message.success) {
          pending.resolve({
            success: true,
            data: message.data || {}
          });
        } else {
          pending.reject(new Error(message.error || 'Command failed'));
        }
      }
    }
  }

  /**
   * Handle disconnection
   * @private
   */
  handleDisconnect() {
    // Reject all pending commands
    this.pendingCommands.forEach((pending, commandId) => {
      pending.reject(new Error('Connection lost'));
    });
    this.pendingCommands.clear();
  }

  /**
   * Handle connection established
   * @private
   */
  handleConnect() {
    // Process queued commands
    this.processQueue();
  }

  /**
   * Handle WebSocket errors
   * @param {Error} error - Error object
   * @private
   */
  handleError(error) {
    // Clear all pending commands
    this.pendingCommands.forEach((pending) => {
      pending.reject(error);
    });
    this.pendingCommands.clear();
  }

  /**
   * Record command in history
   * @param {string} command - Command name
   * @param {Object} payload - Command payload
   * @param {boolean} success - Whether command succeeded
   * @param {number} duration - Execution duration
   * @private
   */
  _recordHistory(command, payload, success, duration) {
    this.commandHistory.push({
      command,
      payload,
      success,
      duration,
      timestamp: Date.now()
    });

    // Trim history if needed
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory = this.commandHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get queue size
   * @returns {number} - Number of queued commands
   */
  getQueueSize() {
    return this.commandQueue.length;
  }

  /**
   * Get pending command count
   * @returns {number} - Number of pending commands
   */
  getPendingCount() {
    return this.pendingCommands.size;
  }

  /**
   * Clear command queue
   */
  clearQueue() {
    this.commandQueue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.commandQueue = [];
  }

  /**
   * Set default timeout
   * @param {number} timeout - Timeout in milliseconds
   */
  setDefaultTimeout(timeout) {
    this.defaultTimeout = timeout;
  }

  /**
   * Set maximum queue size
   * @param {number} size - Maximum queue size
   */
  setMaxQueueSize(size) {
    this.maxQueueSize = size;
  }

  /**
   * Set retry configuration
   * @param {Object} config - Retry configuration
   */
  setRetryConfig(config) {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  /**
   * Enable command history
   * @param {number} maxSize - Maximum history size
   */
  enableHistory(maxSize) {
    this.historyEnabled = true;
    this.maxHistorySize = maxSize;
  }

  /**
   * Get command history
   * @returns {Array} - Command history
   */
  getHistory() {
    return [...this.commandHistory];
  }

  /**
   * Get command statistics
   * @returns {Object} - Command statistics
   */
  getStatistics() {
    const stats = {
      totalCommands: this.commandHistory.length,
      successCount: 0,
      failureCount: 0,
      averageDuration: 0,
      commandCounts: {}
    };

    let totalDuration = 0;

    this.commandHistory.forEach(record => {
      if (record.success) {
        stats.successCount++;
      } else {
        stats.failureCount++;
      }

      totalDuration += record.duration;

      if (!stats.commandCounts[record.command]) {
        stats.commandCounts[record.command] = 0;
      }
      stats.commandCounts[record.command]++;
    });

    if (stats.totalCommands > 0) {
      stats.averageDuration = totalDuration / stats.totalCommands;
    }

    return stats;
  }

  /**
   * Destroy command interface
   */
  destroy() {
    // Clear all pending commands
    this.pendingCommands.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('CommandInterface destroyed'));
    });
    this.pendingCommands.clear();

    // Clear queue
    this.clearQueue();

    // Remove event listeners
    if (this.wsClient) {
      this.wsClient.off('message', this.handleMessage.bind(this));
      this.wsClient.off('disconnected', this.handleDisconnect.bind(this));
      this.wsClient.off('connected', this.handleConnect.bind(this));
      this.wsClient.off('error', this.handleError.bind(this));
    }

    // Clear history
    this.commandHistory = [];
  }
}