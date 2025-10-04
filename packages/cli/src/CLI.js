/**
 * CLI - Interactive Mode Adapter
 * Provides stdin/readline interface for the Legion CLI
 *
 * This is Mode 1 (Interactive) - uses local CLISessionActor with stdin input.
 *
 * Lifecycle:
 * 1. Construct with ResourceManager
 * 2. initialize() - sets up ShowMe and CLISessionActor
 * 3. start() - starts interactive prompt
 * 4. shutdown() - cleans up resources
 */

import { CLISessionActor } from './actors/CLISessionActor.js';
import { InputHandler } from './handlers/InputHandler.js';
import { OutputHandler } from './handlers/OutputHandler.js';

export class CLI {
  constructor(resourceManager, options = {}) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }

    this.resourceManager = resourceManager;
    this.options = options;
    this.isInitialized = false;
    this.isRunning = false;

    // Components (initialized in initialize())
    this.sessionActor = null;
    this.inputHandler = null;
    this.outputHandler = null;
  }

  /**
   * Initialize CLI - sets up CLISessionActor
   */
  async initialize() {
    if (this.isInitialized) {
      throw new Error('CLI already initialized');
    }

    // Create OutputHandler for local display
    this.outputHandler = new OutputHandler({
      useColors: this.options.useColors !== false,
      showStackTrace: this.options.showStackTrace !== false
    });

    // Create CLISessionActor - handles all command processing
    this.sessionActor = new CLISessionActor({
      resourceManager: this.resourceManager,
      sessionId: `interactive-${Date.now()}`,
      useColors: this.options.useColors !== false
    });

    // Create InputHandler for readline prompt
    this.inputHandler = new InputHandler({
      prompt: this.options.prompt || 'legion> ',
      historySize: this.options.historySize || 1000
    });

    this.isInitialized = true;
  }

  /**
   * Start CLI - begins interactive prompt
   */
  async start() {
    if (!this.isInitialized) {
      throw new Error('CLI must be initialized before starting');
    }

    if (this.isRunning) {
      throw new Error('CLI is already running');
    }

    this.isRunning = true;

    // Display welcome message
    this.outputHandler.blank();
    this.outputHandler.heading('Legion CLI');
    this.outputHandler.info('Type commands or /help for assistance. Press Ctrl+C to exit.');
    this.outputHandler.blank();

    // Start interactive prompt
    this.inputHandler.start(async (input) => {
      await this.processInput(input);
    });
  }

  /**
   * Process user input - delegates to CLISessionActor
   * @param {string} input - User input to process
   */
  async processInput(input) {
    try {
      // Send command to session actor via Actor protocol
      const result = await this.sessionActor.receive('execute-command', { command: input });

      if (result.success) {
        // Display result
        if (result.result) {
          this.outputHandler.commandResult(result.result);
        } else if (result.message) {
          this.outputHandler.success(result.message);
        }
      } else {
        // Display error
        this.outputHandler.error(result.error || 'Command failed');
      }
    } catch (error) {
      this.outputHandler.formatError(error);
    }

    this.outputHandler.blank();
  }

  /**
   * Shutdown CLI - clean up resources
   */
  async shutdown() {
    if (!this.isInitialized) {
      // Nothing to clean up
      this.isRunning = false;
      return;
    }

    this.isRunning = false;

    // Stop InputHandler
    if (this.inputHandler) {
      this.inputHandler.stop();
      this.inputHandler.close();
    }

    // Clean up session actor
    if (this.sessionActor) {
      await this.sessionActor.cleanup();
    }

    // Clean up other components
    this.sessionActor = null;
    this.inputHandler = null;
    this.outputHandler = null;
  }

  /**
   * Get current CLI status
   * @returns {Object} Status object
   */
  getStatus() {
    const status = {
      mode: 'interactive',
      initialized: this.isInitialized,
      running: this.isRunning,
      hasSessionActor: this.sessionActor !== null,
      hasInputHandler: this.inputHandler !== null,
      hasOutputHandler: this.outputHandler !== null
    };

    // Get session actor status if available
    if (this.sessionActor) {
      const sessionStatus = this.sessionActor.receive('get-status');
      status.session = sessionStatus.status;
    }

    return status;
  }
}

export default CLI;