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
import { ListCommand } from '../commands/ListCommand.js';
import { DisplayEngine } from '../display/DisplayEngine.js';
import { OutputHandler } from '../handlers/OutputHandler.js';
import { ClaudeAgentStrategy } from '@legion/claude-agent';
import { Task, ExecutionContext } from '@legion/tasks';

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
    this.handles = []; // Track handles displayed in this session

    // Claude task for non-slash commands (lazily initialized)
    this.claudeTask = null;

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
    const showCommand = new ShowCommand(this.displayEngine, this.resourceManager, this);
    this.commandProcessor.register(showCommand);

    const helpCommand = new HelpCommand(this.commandProcessor);
    this.commandProcessor.register(helpCommand);

    const windowsCommand = new WindowsCommand(this.showme, this.outputHandler);
    this.commandProcessor.register(windowsCommand);

    const listCommand = new ListCommand(this, this.showme);
    this.commandProcessor.register(listCommand);
  }

  /**
   * Initialize Claude task for this session (lazy initialization)
   * @private
   */
  async _initializeClaudeTask() {
    if (this.claudeTask) {
      return; // Already initialized
    }

    // Get toolRegistry from ResourceManager (or create minimal one if missing)
    let toolRegistry = this.resourceManager.get('toolRegistry');
    if (!toolRegistry) {
      // Create minimal toolRegistry when none exists
      // Claude can work without tools - they're optional
      toolRegistry = {
        getTool: () => null,
        listTools: async () => []
      };
    }

    // Create context object for ClaudeAgentStrategy.initialize()
    // Note: ClaudeAgentStrategy expects direct properties, not ExecutionContext
    const initContext = {
      toolRegistry: toolRegistry,
      resourceManager: this.resourceManager
    };

    // Create strategy and initialize (will FAIL FAST if API key missing)
    const strategy = Object.create(ClaudeAgentStrategy);
    await strategy.initialize(initContext);

    // Create ExecutionContext for Task
    const taskContext = new ExecutionContext({
      toolRegistry: toolRegistry,
      resourceManager: this.resourceManager,
      sessionId: this.sessionId
    });

    // Create Task with Claude strategy
    this.claudeTask = new Task(`CLI Session ${this.sessionId}`, null, {
      strategy: strategy,
      context: taskContext
    });

    // Mark task as started
    this.claudeTask.start();
  }

  /**
   * Set remote client actor (for server mode)
   */
  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    // Note: Framework already sends session-ready, no need to send it again

    // Auto-load sample images for demo
    await this.loadSampleImages();
  }

  /**
   * Load sample images into context on startup
   */
  async loadSampleImages() {
    const sampleImages = [
      'file:///Users/maxximus/Documents/max-projects/pocs/Legion/artifacts/dalle3-2025-08-05T08-39-42.png',
      'file:///Users/maxximus/Documents/max-projects/pocs/Legion/artifacts/test-circle-1756463651316.png',
      'file:///Users/maxximus/Documents/max-projects/pocs/Legion/artifacts/test-garden-1756463664107.png',
      'file:///Users/maxximus/Documents/max-projects/pocs/Legion/artifacts/test-panorama-1756463698384.png',
      'file:///Users/maxximus/Documents/max-projects/pocs/Legion/artifacts/test-waterfall-1756463716083.png'
    ];

    // Temporarily disable remote actor to prevent display messages
    const tempRemote = this.remoteActor;
    this.remoteActor = null;

    for (const imageUrl of sampleImages) {
      try {
        // Execute show command to load the image (silently)
        const result = await this.handleExecuteCommand({ command: `/show ${imageUrl}` });
        console.log(`[LoadSampleImages] Loaded ${imageUrl}, result:`, result.success, result.message);
      } catch (error) {
        console.error(`Failed to load sample image: ${imageUrl}`, error);
      }
    }

    // Restore remote actor
    this.remoteActor = tempRemote;

    // Check how many windows exist
    const windows = this.showme.getWindows();
    console.log(`[LoadSampleImages] Total windows after loading: ${windows.length}`);

    // Send notification to client
    if (this.remoteActor) {
      this.remoteActor.receive('display-response', {
        content: `\nLoaded ${sampleImages.length} sample images into context.\nType /list to see them.\n`,
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

        // Track handles in session context
        if (result.handle) {
          this.handles.push({
            handle: result.handle,
            title: result.title || result.handle.title || 'Untitled',
            type: result.assetType || result.handle.resourceType || 'unknown',
            timestamp: Date.now()
          });
        }

        // If result has browser rendering with asset data, send to client for display
        if (result.rendered === 'browser' && result.assetData && this.remoteActor) {
          this.remoteActor.receive('display-asset', {
            asset: result.assetData,
            title: result.title || 'Asset',
            assetType: result.assetType || 'unknown'
          });
        }

        // Send text response to client
        if (this.remoteActor && result.message) {
          this.remoteActor.receive('display-response', {
            content: result.message,
            sessionId: this.sessionId,
            timestamp: Date.now()
          });
        }

        return {
          success: true,
          result,
          message: result.message || null,
          sessionId: this.sessionId
        };
      } else {
        // Non-slash commands - Route to Claude
        await this._initializeClaudeTask();

        // Add user message to conversation
        this.claudeTask.addConversationEntry('user', command);

        // Send message to Claude strategy (fire-and-forget actor model)
        await this.claudeTask.strategy.onMessage(this.claudeTask, null, { type: 'work' });

        // Get Claude's response from conversation
        const responses = this.claudeTask.conversation.filter(
          entry => entry.role === 'assistant' && entry.metadata?.responseType === 'claude-sdk'
        );
        const latestResponse = responses[responses.length - 1];

        // Stream response to client if remote actor exists
        if (this.remoteActor && latestResponse) {
          this.remoteActor.receive('display-response', {
            content: latestResponse.content,
            sessionId: this.sessionId,
            timestamp: latestResponse.timestamp
          });
        }

        return {
          success: true,
          result: {
            message: latestResponse?.content || 'No response from Claude',
            conversationLength: this.claudeTask.conversation.length
          },
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

    // Complete Claude task if exists and is still in progress
    if (this.claudeTask && this.claudeTask.status === 'in-progress') {
      this.claudeTask.complete({ reason: 'Session ended' });
    }
  }
}

export default CLISessionActor;
