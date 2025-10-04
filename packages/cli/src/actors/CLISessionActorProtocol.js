/**
 * CLISessionActor with Protocol Definition
 *
 * Protocol-based version of CLISessionActor that extends ProtocolActor
 * for automatic validation and testing support.
 */

import { ProtocolActor } from '@legion/actors';
import { CommandProcessor } from '../commands/CommandProcessor.js';
import { ShowCommand } from '../commands/ShowCommand.js';
import { HelpCommand } from '../commands/HelpCommand.js';
import { WindowsCommand } from '../commands/WindowsCommand.js';
import { DisplayEngine } from '../display/DisplayEngine.js';
import { OutputHandler } from '../handlers/OutputHandler.js';
import { ClaudeAgentStrategy } from '@legion/claude-agent';
import { Task, ExecutionContext } from '@legion/tasks';

export class CLISessionActor extends ProtocolActor {
  constructor(services = {}) {
    super();

    // Required services
    this.showme = services.showme;
    this.resourceManager = services.resourceManager;
    this.toolRegistry = services.toolRegistry;

    if (!this.showme) {
      throw new Error('ShowMeController is required');
    }
    if (!this.resourceManager) {
      throw new Error('ResourceManager is required');
    }
    if (!this.toolRegistry) {
      throw new Error('toolRegistry is required');
    }

    // Session configuration
    this.sessionId = services.sessionId || `session-${Date.now()}`;
    this.state.sessionId = this.sessionId;  // Update state with actual sessionId
    this.useColors = services.useColors !== false;

    // Session state (in addition to protocol state)
    this.commandHistory = [];
    this.contextVariables = new Map();
    this.claudeStrategy = null;
    this.remoteActor = null;

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
    this.registerCommands();
  }

  /**
   * Define protocol for CLISessionActor
   */
  getProtocol() {
    return {
      name: 'CLISessionActor',
      version: '1.0.0',
      state: {
        schema: {
          sessionId: { type: 'string', required: true },
          connected: { type: 'boolean', required: true },
          commandCount: { type: 'integer', required: true },
          hasClaudeTask: { type: 'boolean', required: true }
        },
        initial: {
          sessionId: '',  // Will be set in constructor
          connected: false,
          commandCount: 0,
          hasClaudeTask: false
        }
      },
      messages: {
        receives: {
          'execute-command': {
            schema: {
              command: { type: 'string', minLength: 1, required: true }
            },
            preconditions: ['state.connected === true'],
            postconditions: ['state.commandCount > 0']
          },
          'get-status': {
            schema: {},
            preconditions: []
          },
          'list-windows': {
            schema: {},
            preconditions: []
          },
          'get-history': {
            schema: {},
            preconditions: []
          },
          'ping': {
            schema: {
              timestamp: { type: 'number', required: false }
            },
            preconditions: []
          }
        },
        sends: {
          'session-ready': {
            schema: {
              sessionId: { type: 'string', required: true },
              timestamp: { type: 'number', required: true }
            },
            preconditions: [],
            triggers: ['execute-command']
          },
          'display-asset': {
            schema: {
              assetData: { type: 'object', required: true },
              title: { type: 'string', required: false },
              assetType: { type: 'string', required: false }
            },
            preconditions: ['state.connected === true']
          },
          'command-result': {
            schema: {
              success: { type: 'boolean', required: true },
              output: { type: 'string', required: false },
              error: { type: 'string', required: false },
              rendered: { type: 'string', required: false }
            },
            preconditions: ['state.connected === true']
          }
        }
      }
    };
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
   * Initialize Claude strategy (lazy)
   */
  async _initializeClaudeStrategy() {
    if (this.claudeStrategy) {
      return;
    }

    // List of Claude tools that CLI should have access to
    const cliToolNames = [
      'bash',
      'read',
      'write',
      'edit',
      'glob',
      'grep',
      'ls',
      'webfetch',
      'websearch',
      'task',
      'todowrite'
    ];

    // Store tool names so ClaudeAgentStrategy can request specific tools
    const initContext = {
      toolRegistry: this.toolRegistry,
      resourceManager: this.resourceManager,
      toolNames: cliToolNames  // Pass specific tool names
    };

    this.claudeStrategy = Object.create(ClaudeAgentStrategy);
    await this.claudeStrategy.initialize(initContext);

    this.state.hasClaudeTask = true;
  }

  /**
   * Set remote actor and send session-ready
   */
  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    this.state.connected = true;

    if (this.remoteActor) {
      await this.send('session-ready', {
        sessionId: this.sessionId,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Protocol message handler (called by ProtocolActor.receive)
   */
  handleMessage(messageType, data) {
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
        throw new Error(`Unknown message type: ${messageType}`);
    }
  }

  /**
   * Send message implementation (called by ProtocolActor.send)
   */
  doSend(messageType, data) {
    if (this.remoteActor) {
      return this.remoteActor.receive(messageType, data);
    }
    return Promise.resolve({ sent: false, reason: 'No remote actor' });
  }

  /**
   * Handle execute-command
   */
  async handleExecuteCommand(data) {
    const { command } = data;

    // Add to history
    this.commandHistory.push({
      command,
      timestamp: Date.now()
    });

    this.state.commandCount = this.commandHistory.length;

    try {
      // Slash command
      if (command.startsWith('/')) {
        const result = await this.commandProcessor.execute(command);

        // Send asset display if needed
        if (result.rendered === 'browser' && result.assetData && this.remoteActor) {
          await this.send('display-asset', {
            assetData: result.assetData,  // Changed from 'asset' to match ImageViewer expectations
            title: result.title || 'Asset',
            assetType: result.assetType || 'unknown'
          });
        }

        return {
          success: true,
          output: result.output || result.message || '',
          rendered: result.rendered
        };
      }

      // Non-slash command - use Claude
      await this._initializeClaudeStrategy();

      // Create task for this command
      let taskCompleted = false;
      let taskResponse = null;

      const task = {
        id: `command-${Date.now()}`,
        description: 'Process user command',
        conversation: [
          { role: 'user', content: command }
        ],
        context: {
          systemPrompt: 'You are a helpful AI assistant. Answer questions concisely.',
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096
        },
        addResponse: function(content, source) {
          this.conversation.push({
            role: 'assistant',
            content: content,
            metadata: { source: source }
          });
          taskResponse = content;
        },
        addConversationEntry: function(role, content, metadata) {
          this.conversation.push({
            role: role,
            content: content,
            metadata: metadata
          });
        },
        getAllArtifacts: () => ({}),
        complete: function() {
          taskCompleted = true;
        }
      };

      // Execute with Claude
      await this.claudeStrategy.onMessage(task, null, { type: 'start' });

      return {
        success: taskCompleted,
        output: taskResponse || 'No response from Claude',
        sessionId: this.sessionId
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        sessionId: this.sessionId
      };
    }
  }

  /**
   * Handle get-status
   */
  handleGetStatus() {
    return {
      success: true,
      status: {
        sessionId: this.sessionId,
        commandCount: this.commandHistory.length,
        hasClaudeTask: this.claudeTask !== null,
        connected: this.state.connected
      }
    };
  }

  /**
   * Handle list-windows
   */
  handleListWindows() {
    try {
      const windows = this.showme.server.getActiveWindows();
      return {
        success: true,
        windows: windows.map(w => ({
          id: w.id,
          title: w.title || 'Untitled',
          assetId: w.assetId
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle get-history
   */
  handleGetHistory() {
    return {
      success: true,
      history: this.commandHistory
    };
  }

  /**
   * Handle ping
   */
  handlePing(data) {
    return {
      success: true,
      pong: true,
      timestamp: Date.now(),
      received: data.timestamp
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    // Strategy doesn't need cleanup - it's just a prototype
    this.claudeStrategy = null;
  }
}
