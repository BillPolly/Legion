/**
 * InteractivePrompt - REPL-style interface for ROMA CLI
 * Provides persistent command prompt with real-time feedback and command history
 */

import readline from 'readline';
import chalk from 'chalk';
import { ROMACLIActor } from '../actors/ROMACLIActor.js';
import { MessageFormatter } from './MessageFormatter.js';

export class InteractivePrompt {
  constructor(options = {}) {
    this.resourceManager = options.resourceManager;
    this.actor = null;
    this.formatter = new MessageFormatter();
    
    this.rl = null;
    this.isRunning = false;
    this.commandHistory = [];
    
    // Slash command handlers
    this.slashCommands = new Map([
      ['/status', this._handleStatus.bind(this)],
      ['/s', this._handleStatus.bind(this)],
      ['/history', this._handleHistory.bind(this)],
      ['/h', this._handleHistory.bind(this)],
      ['/watch', this._handleWatch.bind(this)],
      ['/w', this._handleWatch.bind(this)],
      ['/clear', this._handleClear.bind(this)],
      ['/help', this._handleHelp.bind(this)],
      ['/exit', this._handleExit.bind(this)],
      ['/quit', this._handleExit.bind(this)],
      ['/q', this._handleExit.bind(this)]
    ]);
  }

  /**
   * Start the interactive prompt
   * @returns {Promise<void>}
   */
  async start() {
    console.log(chalk.gray('Connecting to ROMA server...'));
    
    try {
      // Initialize actor
      this.actor = new ROMACLIActor({
        resourceManager: this.resourceManager,
        verbose: false,
        onReady: () => {
          console.log(chalk.green('✅ Connected to ROMA server'));
          console.log(chalk.gray('💬 Type your task or use /help for commands'));
          console.log('');
        },
        onDisconnected: () => {
          console.log(chalk.yellow('\n⚠️  Disconnected from server'));
          if (this.isRunning) {
            console.log(chalk.gray('Attempting to reconnect...'));
          }
        },
        onError: (error) => {
          console.log(chalk.red('\n❌ Connection error:'), error.message);
        }
      });

      await this.actor.initialize();

      // Create readline interface
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.blue('roma> '),
        history: this.commandHistory
      });

      // Set up readline handlers
      this._setupReadlineHandlers();

      this.isRunning = true;
      this._showPrompt();

    } catch (error) {
      console.error(chalk.red('❌ Failed to start interactive prompt:'), error.message);
      throw error;
    }
  }

  /**
   * Stop the interactive prompt
   */
  stop() {
    this.isRunning = false;
    
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    
    if (this.actor) {
      this.actor.disconnect();
      this.actor = null;
    }
  }

  /**
   * Set up readline event handlers
   * @private
   */
  _setupReadlineHandlers() {
    this.rl.on('line', async (input) => {
      await this._processCommand(input.trim());
      this._showPrompt();
    });

    this.rl.on('close', () => {
      console.log(chalk.yellow('\n👋 Goodbye!'));
      this.stop();
      process.exit(0);
    });

    this.rl.on('SIGINT', () => {
      console.log(chalk.yellow('\n👋 Goodbye!'));
      this.stop();
      process.exit(0);
    });

    // Handle history navigation
    this.rl.on('history', (history) => {
      this.commandHistory = history;
    });
  }

  /**
   * Show the command prompt
   * @private
   */
  _showPrompt() {
    if (this.isRunning && this.rl) {
      this.rl.prompt();
    }
  }

  /**
   * Process a command input
   * @private
   */
  async _processCommand(input) {
    if (!input) {
      return;
    }

    // Check if it's a slash command
    if (input.startsWith('/')) {
      await this._processSlashCommand(input);
    } else {
      // Default: treat input as a task to execute
      await this._executeDirectTask(input);
    }
  }

  /**
   * Process a slash command
   * @private
   */
  async _processSlashCommand(input) {
    // Parse slash command and arguments
    const parts = this._parseCommand(input);
    const command = parts.command.toLowerCase();
    const args = parts.args;

    // Find and execute slash command handler
    if (this.slashCommands.has(command)) {
      try {
        await this.slashCommands.get(command)(args);
      } catch (error) {
        console.log(this.formatter.formatError(error));
      }
    } else {
      console.log(chalk.red(`Unknown command: ${command}`));
      console.log(chalk.gray('Use /help for available commands'));
    }
  }

  /**
   * Execute task directly from input
   * @private
   */
  async _executeDirectTask(input) {
    try {
      console.log(''); // Add spacing
      const result = await this.actor.executeTask(input, { watch: true });
      console.log('');
      console.log(this.formatter.formatExecutionResult(result));
    } catch (error) {
      console.log('');
      console.log(this.formatter.formatError(error));
    }
  }

  /**
   * Parse command input into command and arguments
   * @private
   */
  _parseCommand(input) {
    // Handle quoted arguments
    const matches = input.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const tokens = matches.map(token => 
      token.startsWith('"') && token.endsWith('"') 
        ? token.slice(1, -1) 
        : token
    );

    return {
      command: tokens[0] || '',
      args: tokens.slice(1)
    };
  }


  /**
   * Handle status command
   * @private
   */
  async _handleStatus(args) {
    try {
      console.log(''); // Add spacing
      
      // Get both connection and server status
      const connectionStatus = this.actor.getConnectionStatus();
      const serverStatus = await this.actor.getStatus();
      
      console.log(this.formatter.formatConnectionStatus(connectionStatus));
      console.log('');
      console.log(this.formatter.formatStatus(serverStatus));
      
    } catch (error) {
      console.log(this.formatter.formatError(error));
    }
  }

  /**
   * Handle history command
   * @private
   */
  async _handleHistory(args) {
    try {
      const limit = args.length > 0 ? parseInt(args[0]) : 10;
      
      if (isNaN(limit) || limit <= 0) {
        console.log(chalk.red('Invalid limit. Please provide a positive number.'));
        return;
      }

      console.log(''); // Add spacing
      const history = await this.actor.getHistory({ limit });
      console.log(this.formatter.formatHistory(history, { limit }));
      
    } catch (error) {
      console.log(this.formatter.formatError(error));
    }
  }

  /**
   * Handle watch command
   * @private
   */
  async _handleWatch(args) {
    if (args.length === 0) {
      console.log(chalk.red('Usage: /watch <execution-id>'));
      console.log(chalk.gray('Example: /watch exec_1234567890'));
      return;
    }

    const executionId = args[0];
    
    try {
      console.log(''); // Add spacing
      await this.actor.watchExecution(executionId);
      
    } catch (error) {
      console.log(this.formatter.formatError(error));
    }
  }

  /**
   * Handle clear command
   * @private
   */
  async _handleClear(args) {
    console.clear();
    console.log(chalk.blue.bold('🧠 ROMA CLI - Interactive Mode'));
    console.log(chalk.gray('💬 Type your task or use /help for commands\n'));
  }

  /**
   * Handle help command
   * @private
   */
  async _handleHelp(args) {
    console.log('');
    console.log(this.formatter.formatHelp());
  }

  /**
   * Handle exit command
   * @private
   */
  async _handleExit(args) {
    console.log(chalk.yellow('\n👋 Goodbye!'));
    this.stop();
    process.exit(0);
  }
}