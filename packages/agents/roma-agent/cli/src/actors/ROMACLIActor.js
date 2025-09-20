/**
 * ROMACLIActor - Client-side actor for ROMA CLI
 * Mirrors the web UI actor pattern, handles server communication and CLI-specific formatting
 */

import { ROMAWebSocketClient } from '../client/ROMAWebSocketClient.js';
import { ProgressRenderer } from '../ui/ProgressRenderer.js';
import { MessageFormatter } from '../ui/MessageFormatter.js';
import chalk from 'chalk';

export class ROMACLIActor {
  constructor(options = {}) {
    this.resourceManager = options.resourceManager;
    this.client = null;
    this.progressRenderer = new ProgressRenderer();
    this.formatter = new MessageFormatter();
    
    this.isConnected = false;
    this.isReady = false;
    this.verbose = options.verbose || false;
    
    // Current execution tracking
    this.currentExecution = null;
    this.executionHistory = [];
    
    // Event callbacks
    this.callbacks = {
      onReady: options.onReady || (() => {}),
      onConnected: options.onConnected || (() => {}),
      onDisconnected: options.onDisconnected || (() => {}),
      onError: options.onError || (() => {}),
      onExecutionStarted: options.onExecutionStarted || (() => {}),
      onExecutionProgress: options.onExecutionProgress || (() => {}),
      onExecutionComplete: options.onExecutionComplete || (() => {}),
      onExecutionError: options.onExecutionError || (() => {})
    };
  }

  /**
   * Initialize the actor and connect to server
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.verbose) {
      console.log(chalk.gray('🎭 Initializing ROMA CLI Actor...'));
    }

    try {
      // Create WebSocket client
      this.client = new ROMAWebSocketClient({
        host: 'localhost',
        port: 4020,
        verbose: this.verbose
      });

      // Set up event handlers
      this._setupEventHandlers();

      // Connect to server
      await this.client.connect();
      
      // Wait for server to be ready
      await this.client.waitForReady();

      if (this.verbose) {
        console.log(chalk.green('✅ ROMA CLI Actor initialized and ready'));
      }

    } catch (error) {
      if (this.verbose) {
        console.error(chalk.red('❌ Failed to initialize ROMA CLI Actor:'), error.message);
      }
      throw error;
    }
  }

  /**
   * Execute a task
   * @param {string} description - Task description
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeTask(description, options = {}) {
    if (!this.isReady) {
      throw new Error('Actor not ready. Call initialize() first.');
    }

    const task = {
      id: `task_${Date.now()}`,
      description: description.trim()
    };

    // Add optional parameters
    if (options.tool) {
      task.tool = options.tool;
    }
    
    if (options.params) {
      try {
        task.params = typeof options.params === 'string' 
          ? JSON.parse(options.params) 
          : options.params;
      } catch (error) {
        throw new Error(`Invalid JSON parameters: ${error.message}`);
      }
    }

    try {
      // Start progress tracking
      if (options.watch !== false) {
        this.progressRenderer.start(description);
      }

      // Execute task
      const result = await this.client.executeTask(task);
      
      // Stop progress tracking
      if (options.watch !== false) {
        this.progressRenderer.stop();
      }

      return result;

    } catch (error) {
      // Stop progress tracking on error
      if (options.watch !== false) {
        this.progressRenderer.stop();
      }
      throw error;
    }
  }

  /**
   * Get server status
   * @returns {Promise<Object>} Server status
   */
  async getStatus() {
    if (!this.isReady) {
      throw new Error('Actor not ready. Call initialize() first.');
    }

    try {
      const response = await this.client.sendRequest('get_status');
      return response.status;
    } catch (error) {
      throw new Error(`Failed to get status: ${error.message}`);
    }
  }

  /**
   * Get execution statistics
   * @returns {Promise<Object>} Execution statistics
   */
  async getStatistics() {
    if (!this.isReady) {
      throw new Error('Actor not ready. Call initialize() first.');
    }

    try {
      const response = await this.client.sendRequest('get_statistics');
      return response.statistics;
    } catch (error) {
      throw new Error(`Failed to get statistics: ${error.message}`);
    }
  }

  /**
   * Get execution history
   * @param {Object} options - History options
   * @returns {Promise<Array>} Execution history
   */
  async getHistory(options = {}) {
    if (!this.isReady) {
      throw new Error('Actor not ready. Call initialize() first.');
    }

    try {
      const response = await this.client.sendRequest('get_execution_history', options);
      return response.history;
    } catch (error) {
      throw new Error(`Failed to get history: ${error.message}`);
    }
  }

  /**
   * Watch a specific execution
   * @param {string} executionId - Execution ID to watch
   * @returns {Promise<void>}
   */
  async watchExecution(executionId) {
    if (!this.isReady) {
      throw new Error('Actor not ready. Call initialize() first.');
    }

    console.log(chalk.blue(`👁️  Watching execution: ${executionId}`));
    this.progressRenderer.start(`Watching ${executionId}`);
    
    // Set up listeners for this execution
    const onProgress = (payload) => {
      if (payload.executionId === executionId) {
        this.progressRenderer.update(payload.progress || {});
      }
    };

    const onComplete = (payload) => {
      if (payload.executionId === executionId) {
        this.progressRenderer.stop();
        console.log(chalk.green('✅ Execution completed'));
        this.client.removeListener('task_progress', onProgress);
        this.client.removeListener('execution_complete', onComplete);
        this.client.removeListener('execution_error', onError);
      }
    };

    const onError = (payload) => {
      if (payload.executionId === executionId) {
        this.progressRenderer.stop();
        console.log(chalk.red('❌ Execution failed:', payload.error));
        this.client.removeListener('task_progress', onProgress);
        this.client.removeListener('execution_complete', onComplete);
        this.client.removeListener('execution_error', onError);
      }
    };

    this.client.on('task_progress', onProgress);
    this.client.on('execution_complete', onComplete);
    this.client.on('execution_error', onError);
  }

  /**
   * Get connection status
   * @returns {Object} Connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      isReady: this.isReady,
      clientStatus: this.client ? this.client.getStatus() : null
    };
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.client) {
      this.client.disconnect();
    }
    this.isConnected = false;
    this.isReady = false;
  }

  /**
   * Set up WebSocket event handlers
   * @private
   */
  _setupEventHandlers() {
    this.client.on('connected', () => {
      this.isConnected = true;
      if (this.verbose) {
        console.log(chalk.green('🔗 Connected to ROMA server'));
      }
      this.callbacks.onConnected();
    });

    this.client.on('disconnected', ({ code, reason }) => {
      this.isConnected = false;
      this.isReady = false;
      if (this.verbose) {
        console.log(chalk.yellow(`🔌 Disconnected from ROMA server (${code}: ${reason})`));
      }
      this.callbacks.onDisconnected({ code, reason });
    });

    this.client.on('ready', (payload) => {
      this.isReady = true;
      if (this.verbose) {
        console.log(chalk.green('✅ ROMA server is ready'));
      }
      this.callbacks.onReady(payload);
    });

    this.client.on('error', (error) => {
      if (this.verbose) {
        console.error(chalk.red('❌ Client error:'), error.message);
      }
      this.callbacks.onError(error);
    });

    this.client.on('execution_started', (payload) => {
      this.currentExecution = {
        executionId: payload.executionId,
        task: payload.task,
        startTime: payload.timestamp,
        status: 'running'
      };
      
      if (this.verbose) {
        console.log(chalk.blue('🚀 Execution started:'), payload.executionId);
      }
      
      this.callbacks.onExecutionStarted(payload);
    });

    this.client.on('task_progress', (payload) => {
      if (this.currentExecution && 
          this.currentExecution.executionId === payload.executionId) {
        this.progressRenderer.update(payload);
      }
      
      this.callbacks.onExecutionProgress(payload);
    });

    this.client.on('execution_complete', (payload) => {
      if (this.currentExecution && 
          this.currentExecution.executionId === payload.executionId) {
        this.currentExecution.status = 'completed';
        this.currentExecution.endTime = payload.timestamp;
        this.currentExecution.result = payload.result;
        
        this.executionHistory.unshift({ ...this.currentExecution });
        this.currentExecution = null;
      }
      
      if (this.verbose) {
        console.log(chalk.green('✅ Execution completed:'), payload.executionId);
      }
      
      this.callbacks.onExecutionComplete(payload);
    });

    this.client.on('execution_error', (payload) => {
      if (this.currentExecution && 
          this.currentExecution.executionId === payload.executionId) {
        this.currentExecution.status = 'failed';
        this.currentExecution.endTime = payload.timestamp;
        this.currentExecution.error = payload.error;
        
        this.executionHistory.unshift({ ...this.currentExecution });
        this.currentExecution = null;
      }
      
      if (this.verbose) {
        console.log(chalk.red('❌ Execution failed:'), payload.executionId, payload.error);
      }
      
      this.callbacks.onExecutionError(payload);
    });
  }
}