/**
 * HistoryCommand - Display execution history
 * Supports filtering and different output formats
 */

import { ROMACLIActor } from '../actors/ROMACLIActor.js';
import { MessageFormatter } from '../ui/MessageFormatter.js';
import chalk from 'chalk';

export class HistoryCommand {
  constructor(options = {}) {
    this.resourceManager = options.resourceManager;
    this.formatter = new MessageFormatter();
    this.actor = null;
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

      // Parse options
      const limit = parseInt(options.limit) || 10;
      if (isNaN(limit) || limit <= 0) {
        console.error(chalk.red('❌ Invalid limit. Must be a positive number.'));
        process.exit(1);
      }

      const filter = options.filter ? options.filter.toLowerCase() : null;
      
      // Validate filter
      if (filter && !['completed', 'failed', 'running', 'cancelled'].includes(filter)) {
        console.error(chalk.red('❌ Invalid filter. Use: completed, failed, running, or cancelled'));
        process.exit(1);
      }

      // Get history
      const history = await this._getFilteredHistory(limit, filter);

      // Display results
      if (options.json) {
        const result = {
          history: history,
          total: history.length,
          limit: limit,
          filter: filter,
          timestamp: new Date().toISOString()
        };
        console.log(this.formatter.formatJSON(result));
      } else {
        if (history.length === 0) {
          console.log(chalk.gray('📚 No execution history found'));
          if (filter) {
            console.log(chalk.gray(`   (filtered by status: ${filter})`));
          }
        } else {
          console.log(this.formatter.formatHistory(history, { limit }));
          if (filter) {
            console.log(chalk.gray(`\nFiltered by status: ${filter}`));
          }
        }
      }

      this.actor.disconnect();
      process.exit(0);

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
   * Get filtered history
   * @private
   */
  async _getFilteredHistory(limit, filter) {
    try {
      // Get raw history from server
      const rawHistory = await this.actor.getHistory({ limit: limit * 2 }); // Get more to allow for filtering
      
      let filteredHistory = rawHistory;

      // Apply status filter
      if (filter) {
        filteredHistory = rawHistory.filter(execution => {
          const status = execution.status?.toLowerCase();
          
          switch (filter) {
            case 'completed':
              return status === 'completed' || status === 'success';
            case 'failed':
              return status === 'failed' || status === 'error';
            case 'running':
              return status === 'running' || status === 'in_progress';
            case 'cancelled':
              return status === 'cancelled';
            default:
              return true;
          }
        });
      }

      // Apply limit after filtering
      return filteredHistory.slice(0, limit);

    } catch (error) {
      throw new Error(`Failed to get history: ${error.message}`);
    }
  }
}