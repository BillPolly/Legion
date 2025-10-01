/**
 * MainPageActor - Top-level page controller
 *
 * This is the main controller for the CLI web UI page. It:
 * - Manages the infinite canvas
 * - Creates and manages the CLI window as a floating component
 * - Handles session-ready from server (new protocol)
 * - Manages views and asset display
 * - Acts as parent controller for all child components
 */

import { ActorSpace } from '@legion/actors';
import { InfiniteCanvas } from '../components/InfiniteCanvas.js';
import { CLIWindow } from '../components/CLIWindow.js';

export class MainPageActor {
  constructor(config = {}) {
    this.isActor = true;

    this.config = {
      container: config.container || document.body,
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

    // Session state
    this.sessionId = null;
    this.serverActorGuid = null;
    this.connected = false;
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

    // Connect to server using new protocol
    await this.connectToServer();
  }

  /**
   * Connect to server using NEW protocol (server sends session-ready first)
   */
  async connectToServer() {
    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(this.config.serverUrl);

        // CRITICAL: Create Channel BEFORE WebSocket opens
        this.channel = this.actorSpace.addChannel(this.websocket, this);

        this.websocket.addEventListener('open', () => {
          console.log('WebSocket connected, waiting for session-ready...');
          this.connected = true;
          resolve();
        });

        this.websocket.addEventListener('error', (error) => {
          console.error('WebSocket error:', error);
          this.connected = false;
          reject(error);
        });

        this.websocket.addEventListener('close', () => {
          console.log('WebSocket closed');
          this.connected = false;
          this.handleDisconnect();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Actor receive method - handles messages from server
   * NEW PROTOCOL: Server sends session-ready first
   */
  async receive(messageType, data) {
    console.log(`MainPageActor received: ${messageType}`, data);

    switch (messageType) {
      case 'session-ready':
        this.handleSessionReady(data);
        break;

      case 'command-result':
        this.handleCommandResult(data);
        break;

      case 'show-asset':
        this.handleShowAsset(data);
        break;

      default:
        console.warn(`Unknown message type: ${messageType}`);
    }
  }

  /**
   * Handle session-ready message from server
   */
  handleSessionReady(data) {
    this.sessionId = data.sessionId;
    this.serverActorGuid = data.serverActor;

    console.log(`Session ready: ${this.sessionId}`);
    console.log(`Server actor: ${this.serverActorGuid}`);

    // Now we can set up CLI command handler
    this.setupCLICommandHandler();

    // Show welcome message
    const terminal = this.cliWindow.getTerminal();
    if (terminal) {
      terminal.writeLine('Connected to Legion CLI server', 'success');
      terminal.writeLine('Type /help for available commands', 'info');
      terminal.writeLine('');
    }
  }

  /**
   * Setup CLI command handler
   */
  setupCLICommandHandler() {
    this.cliWindow.onCommand(async (command) => {
      await this.handleCLICommand(command);
    });
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

    if (!this.connected || !this.serverActorGuid) {
      terminal.writeLine('Not connected to server', 'error');
      return;
    }

    try {
      // Create remote actor reference to server
      const serverActor = this.channel.makeRemote(this.serverActorGuid);

      // Send command to server and await response
      const result = await serverActor.receive('execute-command', { command });

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
    const terminal = this.cliWindow.getTerminal();
    if (!terminal) return;

    if (result.success) {
      if (result.output) {
        terminal.writeResult(result);
      }
    } else {
      terminal.writeLine(result.error || 'Command failed', 'error');
    }

    terminal.writeLine('');
  }

  /**
   * Handle show-asset message (for displaying handles/assets)
   */
  handleShowAsset(data) {
    console.log('Show asset:', data);
    // TODO: Create floating window for asset display
    // This will be used by ShowMe integration
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
