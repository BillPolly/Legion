/**
 * StatusCommand - Display agent status and statistics
 * Supports auto-refresh mode for monitoring
 */

import { ROMACLIActor } from '../actors/ROMACLIActor.js';
import { MessageFormatter } from '../ui/MessageFormatter.js';
import chalk from 'chalk';

export class StatusCommand {
  constructor(options = {}) {
    this.resourceManager = options.resourceManager;
    this.formatter = new MessageFormatter();
    this.actor = null;
    this.refreshInterval = null;
  }

  /**
   * Execute the command
   * @param {Object} options - Command options
   */
  async run(options = {}) {
    try {
      // Initialize actor
      this.actor = new ROMACLIActor({
        resourceManager: this.resourceManager,
        verbose: false
      });

      await this.actor.initialize();

      // Check for refresh mode
      if (options.refresh) {
        const interval = parseInt(options.refresh);
        if (isNaN(interval) || interval <= 0) {
          console.error(chalk.red('❌ Invalid refresh interval. Must be a positive number.'));
          process.exit(1);
        }

        await this._startRefreshMode(interval, options.json);
      } else {
        // Single status check
        await this._displayStatus(options.json);
        this.actor.disconnect();
        process.exit(0);
      }

    } catch (error) {
      if (this.actor) {
        this.actor.disconnect();
      }

      if (options.json) {
        console.log(this.formatter.formatJSON({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }));
      } else {
        console.error(this.formatter.formatError(error));
      }

      process.exit(1);
    }
  }

  /**
   * Display current status
   * @private
   */
  async _displayStatus(jsonMode = false) {
    try {
      // Get both connection and server status
      const connectionStatus = this.actor.getConnectionStatus();
      const serverStatus = await this.actor.getStatus();
      const statistics = await this.actor.getStatistics();

      const statusData = {
        connection: connectionStatus,
        server: serverStatus,
        statistics: statistics,
        timestamp: new Date().toISOString()
      };

      if (jsonMode) {
        console.log(this.formatter.formatJSON(statusData));
      } else {
        console.log(this.formatter.formatConnectionStatus(connectionStatus));
        console.log('');
        console.log(this.formatter.formatStatus(serverStatus));
        console.log('');
        console.log(this.formatter.formatStatistics(statistics));
      }

    } catch (error) {
      throw new Error(`Failed to get status: ${error.message}`);
    }
  }

  /**
   * Start auto-refresh mode
   * @private
   */
  async _startRefreshMode(intervalSeconds, jsonMode = false) {
    console.log(chalk.blue(`🔄 Auto-refresh mode enabled (${intervalSeconds}s intervals)`));
    console.log(chalk.gray('Press Ctrl+C to stop'));
    console.log('');

    // Handle graceful shutdown
    const cleanup = () => {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
      if (this.actor) {
        this.actor.disconnect();
      }
      console.log(chalk.yellow('\n👋 Status monitoring stopped'));
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Initial display
    await this._displayStatus(jsonMode);

    // Set up refresh interval
    this.refreshInterval = setInterval(async () => {
      try {
        if (!jsonMode) {
          console.clear();
          console.log(chalk.blue(`🔄 ROMA Status (refreshing every ${intervalSeconds}s)`));
          console.log('');
        }
        
        await this._displayStatus(jsonMode);
        
      } catch (error) {
        console.error(this.formatter.formatError(error));
      }
    }, intervalSeconds * 1000);

    // Keep process alive
    await new Promise(() => {}); // Wait indefinitely
  }
}