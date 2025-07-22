import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Agent Controller for Cerebrate
 * Manages Legion Agent integration and command execution
 */
export class AgentController extends EventEmitter {

  constructor(options = {}) {
    super();

    this.config = {
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 0,
      retryDelayMs: options.retryDelayMs || 1000,
      enrichContext: options.enrichContext || false,
      ...options.config
    };

    this.agent = options.agent;
    this.resourceManager = options.resourceManager;
    this.controllerId = uuidv4();
    this.initialized = false;

    // Statistics tracking
    this.statistics = {
      commands_executed: 0,
      commands_failed: 0,
      total_execution_time: 0,
      average_execution_time: 0,
      retries_attempted: 0
    };
  }

  /**
   * Initialize the agent controller and Legion Agent
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize resource manager if provided
      if (this.resourceManager && !this.resourceManager.initialized) {
        await this.resourceManager.initialize();
      }

      // Configure the agent
      if (this.agent.setConfiguration) {
        this.agent.setConfiguration(this.config);
      }

      // Initialize the Legion Agent
      await this.agent.initialize();

      // Register agent with resource manager
      if (this.resourceManager) {
        this.resourceManager.register('agent', this.agent);
      }

      this.initialized = true;
      this.emit('initialized');

    } catch (error) {
      this.emit('initialization-failed', error);
      throw error;
    }
  }

  /**
   * Execute command through Legion Agent
   * @param {string} command - Command name
   * @param {*} parameters - Command parameters
   * @param {Object} context - Execution context
   * @returns {Promise<*>} - Command result
   */
  async executeCommand(command, parameters, context) {
    if (!this.initialized) {
      throw new Error('Agent controller not initialized');
    }

    const startTime = Date.now();
    let retries = 0;
    let lastError = null;

    // Enrich context if enabled
    const enrichedContext = this.config.enrichContext ? {
      ...context,
      controllerId: this.controllerId,
      timestamp: new Date()
    } : context;

    const maxAttempts = 1 + this.config.maxRetries;

    while (retries < maxAttempts) {
      try {
        const result = await this.agent.execute({
          command,
          parameters,
          context: enrichedContext
        });

        // Update success statistics
        this.updateExecutionStatistics(Date.now() - startTime, true);

        return result;

      } catch (error) {
        lastError = error;
        retries++;
        this.statistics.retries_attempted++;

        // If we have more retries available, wait and retry
        if (retries < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs));
        }
      }
    }

    // Update failure statistics
    this.updateExecutionStatistics(Date.now() - startTime, false);
    
    // All retries exhausted
    throw lastError;
  }

  /**
   * Check if agent is available
   * @returns {boolean} - True if agent is available
   */
  isAvailable() {
    if (!this.initialized) {
      return false;
    }

    return this.agent.isIdle();
  }

  /**
   * Get agent status
   * @returns {Object} - Agent status information
   */
  getStatus() {
    if (!this.initialized) {
      return { status: 'not_initialized' };
    }

    return this.agent.getStatus();
  }

  /**
   * Check if controller is initialized
   * @returns {boolean} - True if initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Update agent configuration
   * @param {Object} configUpdate - Configuration updates
   */
  updateConfiguration(configUpdate) {
    this.config = { ...this.config, ...configUpdate };

    if (this.agent.setConfiguration) {
      this.agent.setConfiguration(configUpdate);
    }

    this.emit('configuration-updated', this.config);
  }

  /**
   * Get current configuration
   * @returns {Object} - Current configuration
   */
  getConfiguration() {
    return { ...this.config };
  }

  /**
   * Get execution statistics
   * @returns {Object} - Execution statistics
   */
  getStatistics() {
    return { ...this.statistics };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.statistics = {
      commands_executed: 0,
      commands_failed: 0,
      total_execution_time: 0,
      average_execution_time: 0,
      retries_attempted: 0
    };
  }

  /**
   * Shutdown agent gracefully
   */
  async shutdown() {
    if (!this.initialized) {
      return;
    }

    try {
      await this.agent.shutdown();
      this.initialized = false;
      this.emit('shutdown');
    } catch (error) {
      this.emit('shutdown-failed', error);
      throw error;
    }
  }

  /**
   * Destroy controller and cleanup resources
   */
  destroy() {
    if (this.initialized) {
      // Attempt graceful shutdown without waiting
      this.agent.shutdown().catch(() => {
        // Ignore shutdown errors during destroy
      });
      this.initialized = false;
    }

    this.emit('cleanup');
    this.removeAllListeners();
  }

  /**
   * Update execution statistics
   * @param {number} executionTime - Execution time in milliseconds
   * @param {boolean} success - Whether execution was successful
   * @private
   */
  updateExecutionStatistics(executionTime, success) {
    this.statistics.total_execution_time += executionTime;

    if (success) {
      this.statistics.commands_executed++;
    } else {
      this.statistics.commands_failed++;
    }

    const totalCommands = this.statistics.commands_executed + this.statistics.commands_failed;
    if (totalCommands > 0) {
      this.statistics.average_execution_time = this.statistics.total_execution_time / totalCommands;
    }
  }
}