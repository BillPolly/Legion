/**
 * CLIWebApp
 *
 * Main application class for CLI Web Terminal UI
 * Uses BrowserCLIClientActor for command execution via remote CLISessionActor
 * Integrates ShowMe for displaying assets in floating windows
 */

import { BrowserCLIClientActor } from './client/BrowserCLIClientActor.js';
import { Terminal } from './components/Terminal.js';
import { ImageDisplayActor } from './client/ImageDisplayActor.js';
import { ActorSpace } from '@legion/actors';

export class CLIWebApp {
  constructor(config = {}) {
    // Auto-detect ShowMe server URL (port + 1 from current page)
    let defaultShowmeUrl = 'ws://localhost:3701/ws?route=/showme';
    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const hostname = window.location.hostname;
      const port = parseInt(window.location.port || '80') + 1; // ShowMe typically runs on port+1
      defaultShowmeUrl = `${protocol}//${hostname}:${port}/ws?route=/showme`;
    }

    this.config = {
      container: config.container || document.body,
      serverUrl: config.serverUrl || 'ws://localhost:4000/ws?route=/cli',
      showmeServerUrl: config.showmeServerUrl || defaultShowmeUrl,
      ...config
    };

    // Core components
    this.terminal = null;
    this.clientActor = null;
    this.showmeClientActor = null;
    this.displayManager = null;

    // State
    this.connected = false;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    // Create terminal
    this.terminal = new Terminal(this.config.container);
    this.terminal.initialize();

    // Show connecting message
    this.terminal.writeLine('Connecting to CLI server...', 'info');
    this.terminal.writeLine('');

    // Create and register ImageDisplayActor
    const actorSpace = new ActorSpace('cli-web-ui');
    const imageDisplayActor = new ImageDisplayActor();
    actorSpace.register(imageDisplayActor, 'image-display');

    // Create client actor with terminal reference
    this.clientActor = new BrowserCLIClientActor({
      terminal: this.terminal,
      serverUrl: this.config.serverUrl,
      actorSpace,
      imageDisplayActor
    });

    // Connect to CLI server
    try {
      await this.clientActor.initialize();
      this.connected = true;

      // Set up command handler
      this.terminal.onCommand = async (command) => {
        await this.handleCommand(command);
      };

      this.terminal.writeLine('Type /help for available commands', 'info');
      this.terminal.writeLine('');

    } catch (error) {
      this.terminal.writeLine(`Failed to connect: ${error.message}`, 'error');
      this.terminal.writeLine('');
      this.connected = false;
    }

    // Initialize ShowMe for displaying assets in floating windows
    await this.initializeShowMe();
  }

  /**
   * Initialize ShowMe client for asset display
   */
  async initializeShowMe() {
    try {
      // Import ShowMe components using @legion imports (server will rewrite to /legion/*)
      const { DisplayManager } = await import('@legion/showme/src/client/display/DisplayManager.js');
      const { BrowserShowMeClientActor } = await import('@legion/showme/apps/showme-ui/src/client/BrowserShowMeClientActor.js');

      // Create display manager for floating windows
      this.displayManager = new DisplayManager(this.config.container);

      // Create ShowMe client actor
      this.showmeClientActor = new BrowserShowMeClientActor({
        displayManager: this.displayManager,
        serverUrl: this.config.showmeServerUrl
      });

      // Connect to ShowMe server
      await this.showmeClientActor.initialize();

      console.log('ShowMe client initialized - floating windows enabled');

    } catch (error) {
      console.warn('ShowMe initialization failed - floating windows disabled:', error);
      console.error('ShowMe error details:', error);
      // Not critical - commands will still work, just no window display
    }
  }

  /**
   * Handle command from terminal
   */
  async handleCommand(command) {
    if (!this.connected || !this.clientActor) {
      this.terminal.writeLine('Not connected to server', 'error');
      return;
    }

    try {
      // Special commands
      if (command === 'clear' || command === '/clear') {
        this.terminal.clear();
        return;
      }

      if (command === 'exit' || command === '/exit') {
        this.terminal.writeLine('Disconnecting...', 'info');
        this.clientActor.disconnect();
        this.connected = false;
        return;
      }

      if (command === 'reconnect' || command === '/reconnect') {
        this.terminal.writeLine('Reconnecting...', 'info');
        await this.clientActor.initialize();
        this.connected = true;
        return;
      }

      // Execute command on remote server
      const result = await this.clientActor.executeCommand(command);

      // Display result
      this.terminal.writeResult(result);
      this.terminal.writeLine('');

    } catch (error) {
      this.terminal.writeLine(`Error: ${error.message}`, 'error');
      this.terminal.writeLine('');
    }
  }

  /**
   * Cleanup and destroy app
   */
  destroy() {
    // Disconnect client actor
    if (this.clientActor) {
      this.clientActor.disconnect();
    }

    // Disconnect ShowMe client actor
    if (this.showmeClientActor && this.showmeClientActor.websocket) {
      this.showmeClientActor.websocket.close();
    }

    // Destroy display manager (closes all windows)
    if (this.displayManager) {
      this.displayManager.destroy();
    }

    // Destroy terminal
    if (this.terminal) {
      this.terminal.destroy();
    }

    // Clear container
    if (this.config.container) {
      this.config.container.innerHTML = '';
    }
  }
}
