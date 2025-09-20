/**
 * WatchCommand - Monitor execution progress in real-time
 * Provides live updates for specific executions
 */

import { ROMACLIActor } from '../actors/ROMACLIActor.js';
import { MessageFormatter } from '../ui/MessageFormatter.js';
import { ProgressRenderer } from '../ui/ProgressRenderer.js';
import chalk from 'chalk';

export class WatchCommand {
  constructor(options = {}) {
    this.resourceManager = options.resourceManager;
    this.formatter = new MessageFormatter();
    this.progressRenderer = new ProgressRenderer({ verbose: true });
    this.actor = null;
    this.isWatching = false;
  }

  /**
   * Execute the command
   * @param {string} executionId - Execution ID to watch
   * @param {Object} options - Command options
   */
  async run(executionId, options = {}) {
    if (!executionId || executionId.trim().length === 0) {
      console.error(chalk.red('❌ Execution ID is required'));
      console.error(chalk.gray('Usage: roma watch <execution-id>'));
      process.exit(1);
    }

    try {
      // Initialize actor
      this.actor = new ROMACLIActor({
        resourceManager: this.resourceManager,
        verbose: false,
        onExecutionProgress: (payload) => this._handleProgress(payload, options.json),
        onExecutionComplete: (payload) => this._handleComplete(payload, options.json),
        onExecutionError: (payload) => this._handleError(payload, options.json)
      });

      await this.actor.initialize();

      // Set up graceful shutdown
      this._setupShutdownHandlers();

      // Start watching
      console.log(chalk.blue(`👁️  Watching execution: ${executionId}`));
      if (!options.json) {
        console.log(chalk.gray('Press Ctrl+C to stop watching'));
        console.log('');
      }

      this.isWatching = true;

      // Check if execution exists and get initial status
      await this._checkExecutionStatus(executionId);

      // Start progress monitoring
      if (!options.json) {
        this.progressRenderer.start(`Watching ${executionId}`);
      }

      // Watch the execution
      await this.actor.watchExecution(executionId);

      // Keep watching until completion or termination
      await this._waitForCompletion(executionId);

    } catch (error) {
      if (this.actor) {
        this.actor.disconnect();
      }

      if (options.json) {
        console.log(this.formatter.formatJSON({
          success: false,
          error: error.message,
          executionId: executionId,
          timestamp: new Date().toISOString()
        }));
      } else {
        console.error(this.formatter.formatError(error));
      }

      process.exit(1);
    }
  }

  /**
   * Check if execution exists and get its current status
   * @private
   */
  async _checkExecutionStatus(executionId) {
    try {
      const history = await this.actor.getHistory({ limit: 100 });
      const execution = history.find(exec => 
        exec.executionId === executionId || 
        exec.executionId?.endsWith(executionId)
      );

      if (!execution) {
        console.log(chalk.yellow(`⚠️  Execution ${executionId} not found in recent history`));
        console.log(chalk.gray('This execution may be very old or the ID may be incorrect'));
        console.log('');
      } else {
        console.log(chalk.cyan('📋 Execution Info:'));
        console.log(`  Status: ${this._formatStatus(execution.status)}`);
        console.log(`  Task: ${execution.task?.description || 'Unknown'}`);
        if (execution.startTime) {
          console.log(`  Started: ${new Date(execution.startTime).toLocaleString()}`);
        }
        console.log('');
      }

    } catch (error) {
      // Non-fatal error, continue watching
      console.log(chalk.yellow(`⚠️  Could not check execution status: ${error.message}`));
      console.log('');
    }
  }

  /**
   * Handle progress updates
   * @private
   */
  _handleProgress(payload, jsonMode) {
    if (jsonMode) {
      console.log(this.formatter.formatJSON({
        type: 'progress',
        ...payload,
        timestamp: new Date().toISOString()
      }));
    } else {
      this.progressRenderer.update(payload);
    }
  }

  /**
   * Handle execution completion
   * @private
   */
  _handleComplete(payload, jsonMode) {
    this.isWatching = false;
    
    if (jsonMode) {
      console.log(this.formatter.formatJSON({
        type: 'complete',
        ...payload,
        timestamp: new Date().toISOString()
      }));
    } else {
      this.progressRenderer.complete(payload);
      console.log('');
      console.log(this.formatter.formatExecutionResult(payload));
    }

    this._shutdown(0);
  }

  /**
   * Handle execution error
   * @private
   */
  _handleError(payload, jsonMode) {
    this.isWatching = false;
    
    if (jsonMode) {
      console.log(this.formatter.formatJSON({
        type: 'error',
        ...payload,
        timestamp: new Date().toISOString()
      }));
    } else {
      this.progressRenderer.fail(payload.error);
      console.log('');
      console.error(this.formatter.formatError(payload.error || 'Execution failed'));
    }

    this._shutdown(1);
  }

  /**
   * Wait for execution completion
   * @private
   */
  async _waitForCompletion(executionId) {
    return new Promise((resolve) => {
      // Set up a timeout (optional)
      const timeout = setTimeout(() => {
        if (this.isWatching) {
          console.log(chalk.yellow('⏱️  Watch timeout reached'));
          this._shutdown(0);
        }
        resolve();
      }, 600000); // 10 minutes timeout

      // Watch for completion
      const checkCompletion = setInterval(() => {
        if (!this.isWatching) {
          clearTimeout(timeout);
          clearInterval(checkCompletion);
          resolve();
        }
      }, 1000);
    });
  }

  /**
   * Set up shutdown handlers
   * @private
   */
  _setupShutdownHandlers() {
    const cleanup = () => {
      console.log(chalk.yellow('\n👋 Stopped watching'));
      this._shutdown(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }

  /**
   * Shutdown and cleanup
   * @private
   */
  _shutdown(exitCode) {
    this.isWatching = false;
    
    if (this.progressRenderer) {
      this.progressRenderer.stop();
    }
    
    if (this.actor) {
      this.actor.disconnect();
    }
    
    process.exit(exitCode);
  }

  /**
   * Format status with colors
   * @private
   */
  _formatStatus(status) {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return chalk.green('✓ Completed');
      case 'running':
      case 'in_progress':
        return chalk.yellow('⏳ Running');
      case 'failed':
      case 'error':
        return chalk.red('✗ Failed');
      case 'cancelled':
        return chalk.gray('⏹ Cancelled');
      default:
        return chalk.gray(status || 'Unknown');
    }
  }
}