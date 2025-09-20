/**
 * ExecuteCommand - Handle task execution requests
 * Supports both real-time watching and one-shot execution
 */

import { ROMACLIActor } from '../actors/ROMACLIActor.js';
import { MessageFormatter } from '../ui/MessageFormatter.js';
import chalk from 'chalk';

export class ExecuteCommand {
  constructor(options = {}) {
    this.resourceManager = options.resourceManager;
    this.formatter = new MessageFormatter();
    this.actor = null;
  }

  /**
   * Execute the command
   * @param {string} taskDescription - Task to execute
   * @param {Object} options - Command options
   */
  async run(taskDescription, options = {}) {
    if (!taskDescription || taskDescription.trim().length === 0) {
      console.error(chalk.red('❌ Task description is required'));
      process.exit(1);
    }

    try {
      // Initialize actor
      this.actor = new ROMACLIActor({
        resourceManager: this.resourceManager,
        verbose: options.verbose || false
      });

      await this.actor.initialize();

      // Parse options
      const executionOptions = {
        watch: options.watch || false
      };

      // Add tool if specified
      if (options.tool) {
        executionOptions.tool = options.tool;
      }

      // Parse parameters if provided
      if (options.params) {
        try {
          executionOptions.params = JSON.parse(options.params);
        } catch (error) {
          console.error(chalk.red('❌ Invalid JSON parameters:'), error.message);
          process.exit(1);
        }
      }

      // Set up timeout
      const timeout = parseInt(options.timeout) * 1000 || 300000; // Default 5 minutes
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Execution timeout')), timeout);
      });

      // Execute task
      console.log(chalk.blue(`🚀 Executing: ${taskDescription}`));
      console.log('');

      const executionPromise = this.actor.executeTask(taskDescription, executionOptions);
      const result = await Promise.race([executionPromise, timeoutPromise]);

      // Format and display result
      if (options.json) {
        console.log(this.formatter.formatJSON(result));
      } else {
        console.log(this.formatter.formatExecutionResult(result));
      }

      // Disconnect and exit
      this.actor.disconnect();
      process.exit(result.success ? 0 : 1);

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
}