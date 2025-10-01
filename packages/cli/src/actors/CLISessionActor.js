/**
 * CLISessionActor - Core session actor for CLI command processing
 *
 * Handles command execution in a stateful session with Actor protocol.
 * Used by all CLI modes: interactive, server, remote client, and web UI.
 */

import { Actor } from '@legion/actors';
import { CommandProcessor } from '../commands/CommandProcessor.js';
import { ShowCommand } from '../commands/ShowCommand.js';
import { HelpCommand } from '../commands/HelpCommand.js';
import { WindowsCommand } from '../commands/WindowsCommand.js';
import { DisplayEngine } from '../display/DisplayEngine.js';
import { OutputHandler } from '../handlers/OutputHandler.js';

export class CLISessionActor extends Actor {
  constructor(services = {}) {
    super();

    // Required services
    this.showme = services.showme;
    this.resourceManager = services.resourceManager;

    if (!this.showme) {
      throw new Error('ShowMeController is required');
    }
    if (!this.resourceManager) {
      throw new Error('ResourceManager is required');
    }

    // Session configuration
    this.sessionId = services.sessionId || `session-${Date.now()}`;
    this.useColors = services.useColors !== false;

    // Session state
    this.commandHistory = [];
    this.contextVariables = new Map(); // For future: $var support

    // Initialize components
    this.outputHandler = new OutputHandler({
      useColors: this.useColors,
      showStackTrace: true
    });

    this.displayEngine = new DisplayEngine(
      this.showme,
      this.outputHandler,
      this.resourceManager
    );

    this.commandProcessor = new CommandProcessor();

    // Register commands
    this.registerCommands();

    // Remote client actor (for server mode)
    this.remoteActor = null;
  }

  /**
   * Register CLI commands
   */
  registerCommands() {
    const showCommand = new ShowCommand(this.displayEngine, this.resourceManager);
    this.commandProcessor.register(showCommand);

    const helpCommand = new HelpCommand(this.commandProcessor);
    this.commandProcessor.register(helpCommand);

    const windowsCommand = new WindowsCommand(this.showme, this.outputHandler);
    this.commandProcessor.register(windowsCommand);
  }

  /**
   * Set remote client actor (for server mode)
   */
  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;

    // Send welcome message
    if (this.remoteActor) {
      this.remoteActor.receive('session-ready', {
        sessionId: this.sessionId,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle incoming messages via Actor protocol
   */
  receive(messageType, data) {
    switch (messageType) {
      case 'execute-command':
        return this.handleExecuteCommand(data);

      case 'get-status':
        return this.handleGetStatus();

      case 'list-windows':
        return this.handleListWindows();

      case 'get-history':
        return this.handleGetHistory();

      case 'ping':
        return this.handlePing(data);

      default:
        return super.receive(messageType, data);
    }
  }

  /**
   * Handle execute-command message
   */
  async handleExecuteCommand(data) {
    const { command } = data;

    if (!command || typeof command !== 'string') {
      return {
        success: false,
        error: 'Command must be a string'
      };
    }

    // Add to history
    this.commandHistory.push({
      command,
      timestamp: Date.now()
    });

    try {
      // Check if it's a slash command
      if (command.startsWith('/')) {
        const result = await this.commandProcessor.execute(command);

        // If result has browser rendering with asset data, send to client for display
        if (result.rendered === 'browser' && result.assetData && this.remoteActor) {
          this.remoteActor.receive('display-asset', {
            asset: result.assetData,
            title: result.title || 'Asset',
            assetType: result.assetType || 'unknown'
          });
        }

        return {
          success: true,
          result,
          message: result.message || null,
          sessionId: this.sessionId
        };
      } else {
        // Non-slash commands - for future natural language processing
        return {
          success: false,
          error: 'Natural language processing not yet implemented. Use slash commands like /show <uri>',
          sessionId: this.sessionId
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
        sessionId: this.sessionId
      };
    }
  }

  /**
   * Handle get-status message
   */
  handleGetStatus() {
    return {
      success: true,
      status: {
        sessionId: this.sessionId,
        showme: this.showme.getStatus(),
        commandsRegistered: this.commandProcessor.getCommandNames(),
        historyLength: this.commandHistory.length
      }
    };
  }

  /**
   * Handle list-windows message
   */
  handleListWindows() {
    const windows = this.showme.getWindows();

    return {
      success: true,
      windows: windows.map(w => ({
        id: w.id,
        title: w.title,
        isOpen: w.isOpen,
        width: w.width,
        height: w.height
      }))
    };
  }

  /**
   * Handle get-history message
   */
  handleGetHistory() {
    return {
      success: true,
      history: this.commandHistory
    };
  }

  /**
   * Handle ping message
   */
  handlePing(data) {
    return {
      success: true,
      pong: true,
      timestamp: Date.now(),
      data
    };
  }

  /**
   * Get protocol definition
   */
  getProtocol() {
    return {
      name: 'CLISession',
      version: '1.0.0',
      description: 'CLI command session with stateful execution',
      messages: [
        {
          name: 'execute-command',
          description: 'Execute a CLI command',
          params: {
            command: 'string - The command to execute (e.g., "/show legion://...")'
          },
          returns: 'Object with success, result, message, or error'
        },
        {
          name: 'get-status',
          description: 'Get current session status',
          returns: 'Object with sessionId, showme status, commands, history'
        },
        {
          name: 'list-windows',
          description: 'List all open windows',
          returns: 'Array of window objects'
        },
        {
          name: 'get-history',
          description: 'Get command history',
          returns: 'Array of command history entries'
        },
        {
          name: 'ping',
          description: 'Ping the session',
          returns: 'Pong response'
        }
      ]
    };
  }

  /**
   * Clean up session resources
   */
  async cleanup() {
    // Close any open windows
    const windows = this.showme.getWindows();
    await Promise.all(windows.map(w => w.close()));
  }
}

export default CLISessionActor;
