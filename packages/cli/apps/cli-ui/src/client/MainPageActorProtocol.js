/**
 * MainPageActor with Protocol Definition
 *
 * Protocol-based version of MainPageActor for the CLI web UI.
 * Manages the infinite canvas and CLI window using the ProtocolActor pattern.
 */

import { ProtocolActor, ActorSpace } from '@legion/actors';
import { InfiniteCanvas } from '@cli-ui/components/InfiniteCanvas.js';
import { CLIWindow } from '@cli-ui/components/CLIWindow.js';
import { logSafely } from '@cli-ui/utils/logger.js';

export class MainPageActor extends ProtocolActor {
  constructor(config = {}) {
    super();

    this.config = {
      container: config.container || (typeof document !== 'undefined' ? document.body : null),
      serverUrl: config.serverUrl || 'ws://localhost:4000/ws?route=/cli',
      ...config
    };

    // Components
    this.canvas = null;
    this.cliWindow = null;

    // Actor system
    this.actorSpace = null;
    this.channel = null;
    this.websocket = null;

    // Server actor reference
    this.serverActorGuid = null;
  }

  /**
   * Define protocol for MainPageActor
   */
  getProtocol() {
    return {
      name: 'MainPageActor',
      version: '1.0.0',
      state: {
        schema: {
          connected: { type: 'boolean', required: true },
          sessionId: { type: 'string', required: false },
          serverActor: { type: 'string', required: false },
          commandCount: { type: 'integer', required: true }
        },
        initial: {
          connected: false,
          sessionId: null,
          serverActor: null,
          commandCount: 0
        }
      },
      messages: {
        receives: {
          'session-ready': {
            schema: {
              sessionId: { type: 'string', required: true },
              serverActor: { type: 'string', required: false },
              timestamp: { type: 'number', required: false }
            },
            preconditions: ['state.connected === false'],
            postconditions: ['state.connected === true', 'state.sessionId !== null']
          },
          'command-result': {
            schema: {
              success: { type: 'boolean', required: true },
              output: { type: 'string', required: false },
              error: { type: 'string', required: false }
            },
            preconditions: ['state.connected === true']
          },
          'display-asset': {
            schema: {
              asset: { type: 'object', required: true },
              title: { type: 'string', required: false },
              assetType: { type: 'string', required: false }
            },
            preconditions: ['state.connected === true']
          }
        },
        sends: {
          'execute-command': {
            schema: {
              command: { type: 'string', minLength: 1, required: true }
            },
            preconditions: ['state.connected === true'],
            triggers: ['command-result']
          }
        }
      }
    };
  }

  /**
   * Initialize the main page actor
   */
  async initialize() {
    // Create ActorSpace
    this.actorSpace = new ActorSpace('cli-main-page');
    this.actorSpace.register(this, 'client-root');

    // Initialize canvas
    this.canvas = new InfiniteCanvas(this.config.container);
    this.canvas.initialize();

    // Create CLI floating window
    this.cliWindow = new CLIWindow({
      title: 'Legion CLI',
      x: 100,
      y: 100,
      width: 900,
      height: 600,
      onClose: () => this.handleCLIWindowClose()
    });

    const windowElement = this.cliWindow.initialize();
    this.canvas.addComponent(windowElement, 100, 100);

    // Initialize terminal AFTER window is in DOM
    this.cliWindow.initializeTerminal();

    // Connect to server
    await this.connectToServer();
  }

  /**
   * Connect to server using WebSocket
   */
  async connectToServer() {
    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(this.config.serverUrl);

        // CRITICAL: Create Channel BEFORE WebSocket opens
        this.channel = this.actorSpace.addChannel(this.websocket, this);

        this.websocket.addEventListener('open', () => {
          console.log('WebSocket connected, waiting for session-ready...');
          // Update state (but don't set connected=true until session-ready)
          resolve();
        });

        this.websocket.addEventListener('error', (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        });

        this.websocket.addEventListener('close', () => {
          console.log('WebSocket closed');
          this.state.connected = false;
          this.handleDisconnect();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Protocol message handler (called by ProtocolActor.receive)
   */
  handleMessage(messageType, data) {
    switch (messageType) {
      case 'session-ready':
        return this.handleSessionReady(data);

      case 'command-result':
        return this.handleCommandResult(data);

      case 'display-asset':
        return this.handleDisplayAsset(data);

      default:
        throw new Error(`Unknown message type: ${messageType}`);
    }
  }

  /**
   * Send message implementation (called by ProtocolActor.send)
   */
  async doSend(messageType, data) {
    if (!this.channel || !this.serverActorGuid) {
      throw new Error('Not connected to server');
    }

    const serverActor = this.channel.makeRemote(this.serverActorGuid);
    return await serverActor.receive(messageType, data);
  }

  /**
   * Handle session-ready from server
   */
  handleSessionReady(data) {
    this.state.sessionId = data.sessionId;
    this.state.serverActor = data.serverActor;
    this.state.connected = true;
    this.serverActorGuid = data.serverActor;

    console.log(`Session ready: ${this.state.sessionId}`);
    console.log(`Server actor: ${this.serverActorGuid}`);

    // Setup CLI command handler (only if cliWindow exists)
    if (this.cliWindow) {
      this.setupCLICommandHandler();

      // Show welcome message
      const terminal = this.cliWindow.getTerminal();
      if (terminal) {
        terminal.writeLine('Connected to Legion CLI server', 'success');
        terminal.writeLine('Type /help for available commands', 'info');
        terminal.writeLine('');
      }
    }

    return { success: true };
  }

  /**
   * Setup CLI command handler
   */
  setupCLICommandHandler() {
    if (this.cliWindow) {
      this.cliWindow.onCommand(async (command) => {
        await this.handleCLICommand(command);
      });
    }
  }

  /**
   * Handle command from CLI window
   */
  async handleCLICommand(command) {
    const terminal = this.cliWindow.getTerminal();

    if (!terminal) return;

    // Local commands
    if (command === 'clear' || command === '/clear') {
      terminal.clear();
      return;
    }

    if (!this.state.connected) {
      terminal.writeLine('Not connected to server', 'error');
      return;
    }

    try {
      // Send command to server via protocol
      const result = await this.send('execute-command', { command });

      this.state.commandCount++;

      // Display result
      if (result) {
        this.handleCommandResult(result);
      }

    } catch (error) {
      terminal.writeLine(`Error: ${error.message}`, 'error');
      terminal.writeLine('');
    }
  }

  /**
   * Handle command result from server
   */
  handleCommandResult(result) {
    if (!this.cliWindow) return { success: true };

    const terminal = this.cliWindow.getTerminal();
    if (!terminal) return { success: true };

    if (result.success) {
      if (result.output) {
        terminal.writeResult(result);
      }
    } else {
      terminal.writeLine(result.error || 'Command failed', 'error');
    }

    terminal.writeLine('');
    return { success: true };
  }

  /**
   * Handle display-asset message (for displaying handles/assets)
   */
  handleDisplayAsset(data) {
    logSafely('Display asset:', data);
    // TODO: Create floating window for asset display
    // This will be used by ShowMe integration
    return { success: true };
  }

  /**
   * Handle CLI window close
   */
  handleCLIWindowClose() {
    console.log('CLI window closed');
    // Could minimize instead of close, or recreate window
  }

  /**
   * Handle disconnect from server
   */
  handleDisconnect() {
    const terminal = this.cliWindow?.getTerminal();
    if (terminal) {
      terminal.writeLine('\n[Disconnected from server]', 'error');
    }
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    if (this.websocket) {
      this.websocket.close();
    }

    if (this.cliWindow) {
      this.cliWindow.destroy();
    }

    if (this.canvas) {
      this.canvas.destroy();
    }

    if (this.actorSpace) {
      this.actorSpace.destroy();
    }
  }
}
