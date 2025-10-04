/**
 * BrowserCLIClientActor
 *
 * Browser-compatible client actor for CLI module using Server Framework
 * Server framework auto-injects remoteActor - NO manual WebSocket!
 */

import { InfiniteCanvas } from '@cli-ui/components/InfiniteCanvas.js';
import { CLIWindow } from '@cli-ui/components/CLIWindow.js';
import { AssetWindow } from '@cli-ui/components/AssetWindow.js';
import { logSafely, errorSafely } from '@cli-ui/utils/logger.js';

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

    // Asset windows tracking
    this.assetWindows = [];
    this.nextWindowPosition = { x: 200, y: 150 };

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
    logSafely('[BrowserCLIClientActor] Received:', messageType, data);

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
  async handleDisplayAsset(data) {
    logSafely('Display asset:', data);

    try {
      console.log('[BrowserCLIClientActor] handleDisplayAsset - step 1: calculating position');
      // Calculate window position (cascade new windows)
      const position = this.getNextWindowPosition();
      console.log('[BrowserCLIClientActor] handleDisplayAsset - step 2: position =', position);

      // Create asset window
      console.log('[BrowserCLIClientActor] handleDisplayAsset - step 3: creating AssetWindow');
      const assetWindow = new AssetWindow(data, {
        title: data.title || 'Asset',
        x: position.x,
        y: position.y,
        width: 900,
        height: 700,
        onClose: () => this.handleAssetWindowClose(assetWindow),
        onSave: async (saveData) => this.handleAssetSave(saveData)
      });
      console.log('[BrowserCLIClientActor] handleDisplayAsset - step 4: AssetWindow created');

      // Initialize window
      console.log('[BrowserCLIClientActor] handleDisplayAsset - step 5: initializing window');
      const windowElement = assetWindow.initialize();
      console.log('[BrowserCLIClientActor] handleDisplayAsset - step 6: adding to canvas');
      this.canvas.addComponent(windowElement, position.x, position.y);

      // Initialize renderer AFTER window is in DOM
      console.log('[BrowserCLIClientActor] handleDisplayAsset - step 7: initializing renderer');
      await assetWindow.initializeRenderer();
      console.log('[BrowserCLIClientActor] handleDisplayAsset - step 8: renderer initialized');

      // Track window
      this.assetWindows.push(assetWindow);

      // Show confirmation in terminal
      if (this.terminal) {
        this.terminal.writeLine(`Opened: ${data.title || 'Asset'} (${data.assetType || 'unknown'})`, 'info');
        this.terminal.writeLine('');
      }

      return { success: true };
    } catch (error) {
      console.error('[BrowserCLIClientActor] handleDisplayAsset - ERROR at line:', error);
      errorSafely('Failed to display asset:', error);

      if (this.terminal) {
        this.terminal.writeLine(`Error displaying asset: ${error.message}`, 'error');
        this.terminal.writeLine('');
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Get next window position (cascade effect)
   */
  getNextWindowPosition() {
    const position = { ...this.nextWindowPosition };

    // Increment position for next window
    this.nextWindowPosition.x += 30;
    this.nextWindowPosition.y += 30;

    // Reset if off screen
    if (this.nextWindowPosition.x > window.innerWidth - 400) {
      this.nextWindowPosition.x = 200;
    }
    if (this.nextWindowPosition.y > window.innerHeight - 300) {
      this.nextWindowPosition.y = 150;
    }

    return position;
  }

  /**
   * Handle asset window close
   */
  handleAssetWindowClose(assetWindow) {
    // Remove from tracking
    const index = this.assetWindows.indexOf(assetWindow);
    if (index !== -1) {
      this.assetWindows.splice(index, 1);
    }
  }

  /**
   * Handle asset save
   */
  async handleAssetSave(saveData) {
    logSafely('Save asset:', saveData);

    if (!this.remoteActor) {
      throw new Error('Not connected to server');
    }

    // Send save request to server
    try {
      await this.remoteActor.receive('save-asset', saveData);

      if (this.terminal) {
        this.terminal.writeLine(`Saved: ${saveData.filePath || 'asset'}`, 'success');
        this.terminal.writeLine('');
      }
    } catch (error) {
      errorSafely('Save failed:', error);
      throw error;
    }
  }
}
