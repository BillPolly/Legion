/**
 * BrowserCLIClientActor
 *
 * Browser-compatible client actor for CLI module using Server Framework
 * Server framework auto-injects remoteActor - NO manual WebSocket!
 */

import { InfiniteCanvas } from '@cli-ui/components/InfiniteCanvas.js';
import { CLIWindow } from '@cli-ui/components/CLIWindow.js';

export default class BrowserCLIClientActor {
  constructor() {
    // Remote actor reference (injected by framework via setRemoteActor)
    this.remoteActor = null;

    // Session info
    this.sessionId = null;

    // UI Components - create immediately
    this.canvas = null;
    this.cliWindow = null;
    this.terminal = null;

    // Create UI
    this.createUI();
  }

  /**
   * Create the UI (canvas, window, terminal)
   */
  createUI() {
    const container = document.getElementById('app');
    if (!container) {
      throw new Error('App container #app not found');
    }

    // Initialize canvas
    this.canvas = new InfiniteCanvas(container);
    this.canvas.initialize();

    // Create CLI floating window
    this.cliWindow = new CLIWindow({
      title: 'Legion CLI',
      x: 100,
      y: 100,
      width: 900,
      height: 600,
      onClose: () => this.handleWindowClose()
    });

    const windowElement = this.cliWindow.initialize();
    this.canvas.addComponent(windowElement, 100, 100);

    // Initialize terminal AFTER window is in DOM
    this.cliWindow.initializeTerminal();
    this.terminal = this.cliWindow.getTerminal();

    // Setup command handler
    this.cliWindow.onCommand(async (command) => {
      await this.handleCommand(command);
    });
  }

  /**
   * Framework injection point - server framework calls this
   */
  setRemoteActor(remoteActor) {
    console.log('[BrowserCLIClientActor] setRemoteActor called');
    this.remoteActor = remoteActor;
  }

  /**
   * Actor protocol method - called by framework
   */
  async receive(messageType, data) {
    console.log('[BrowserCLIClientActor] Received:', messageType, data);

    switch (messageType) {
      case 'session-ready':
        return this.handleSessionReady(data);

      case 'display-response':
        return this.handleDisplayResponse(data);

      case 'display-asset':
        return this.handleDisplayAsset(data);

      default:
        console.warn('Unknown message type:', messageType);
        return { success: false, error: `Unknown message type: ${messageType}` };
    }
  }

  /**
   * Handle session-ready message
   */
  handleSessionReady(data) {
    this.sessionId = data.sessionId;
    console.log(`Session ready: ${this.sessionId}`);

    if (this.terminal) {
      this.terminal.writeLine(`Connected to CLI server`, 'success');
      this.terminal.writeLine(`Session: ${this.sessionId}`, 'info');
      this.terminal.writeLine('Type /help for available commands', 'info');
      this.terminal.writeLine('');
    }

    return { success: true };
  }

  /**
   * Handle command from terminal
   */
  async handleCommand(command) {
    if (!this.terminal) return;

    // Local commands
    if (command === 'clear' || command === '/clear') {
      this.terminal.clear();
      return;
    }

    if (!this.remoteActor) {
      this.terminal.writeLine('Not connected to server', 'error');
      this.terminal.writeLine('');
      return;
    }

    try {
      // Send command to server via remoteActor
      this.remoteActor.receive('execute-command', { command });
      // Note: response comes via display-response message, not as return value
    } catch (error) {
      this.terminal.writeLine(`Error: ${error.message}`, 'error');
      this.terminal.writeLine('');
    }
  }

  /**
   * Handle display-response message (Claude's responses)
   */
  handleDisplayResponse(data) {
    console.log('Display response:', data);

    if (this.terminal && data.content) {
      this.terminal.writeLine(data.content, 'response');
      this.terminal.writeLine('');
    }

    return { success: true };
  }

  /**
   * Handle window close
   */
  handleWindowClose() {
    console.log('CLI window closed');
  }

  /**
   * Handle display-asset message
   */
  handleDisplayAsset(data) {
    console.log('Display asset:', data);

    // TODO: Implement proper asset display windows
    // For now, just show in terminal
    if (this.terminal) {
      this.terminal.writeLine(`[Asset: ${data.title || 'Untitled'} (${data.assetType || 'unknown'})]`, 'info');
      this.terminal.writeLine('');
    }

    return { success: true };
  }
}
