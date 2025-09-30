/**
 * ShowMeController
 *
 * Main control object for ShowMe module
 * CLI creates one instance, uses it to open/manage browser windows
 * Returns ShowMeWindow objects that encapsulate each window
 */

import { ShowMeServer } from './server/ShowMeServer.js';
import { ShowMeWindow } from './ShowMeWindow.js';

export class ShowMeController {
  constructor(options = {}) {
    this.port = options.port || 3700;
    this.autoLaunch = options.autoLaunch ?? false;
    this.browserOptions = options.browserOptions || {
      app: true,
      width: 1200,
      height: 800
    };

    // Internal state
    this.server = null;
    this.windows = new Map(); // windowId -> ShowMeWindow
    this.windowCounter = 0;
    this.isInitialized = false;
    this.isRunning = false;
  }

  /**
   * Initialize the ShowMe server
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('ShowMeController already initialized');
      return;
    }

    // Create ShowMeServer
    this.server = new ShowMeServer({
      port: this.port,
      skipLegionPackages: false,
      browserOptions: this.browserOptions
    });

    await this.server.initialize();
    this.isInitialized = true;

    console.log(`ShowMeController initialized on port ${this.port}`);
  }

  /**
   * Start the ShowMe server
   */
  async start() {
    if (!this.isInitialized) {
      throw new Error('ShowMeController not initialized. Call initialize() first.');
    }

    if (this.isRunning) {
      console.log('ShowMeController already running');
      return;
    }

    await this.server.start();
    this.isRunning = true;

    console.log(`ShowMeController started on port ${this.port}`);
  }

  /**
   * Open a new browser window and display a Handle
   * @param {Handle} handle - The Handle to display
   * @param {Object} options - Window options (title, width, height, x, y)
   * @returns {ShowMeWindow} - Window object for controlling this window
   */
  async openWindow(handle, options = {}) {
    if (!this.isRunning) {
      throw new Error('ShowMeController not running. Call start() first.');
    }

    // Generate unique window ID
    const windowId = `window-${++this.windowCounter}-${Date.now()}`;

    // Create ShowMeWindow object
    const window = new ShowMeWindow(windowId, this, {
      title: options.title || handle.toURI?.() || 'ShowMe Window',
      width: options.width || this.browserOptions.width,
      height: options.height || this.browserOptions.height,
      x: options.x,
      y: options.y
    });

    // Track window
    this.windows.set(windowId, window);

    // Launch browser if this is the first window or newWindow requested
    if (this.windows.size === 1 || options.newWindow) {
      await this.server.launchBrowser(window.url, {
        app: this.browserOptions.app,
        width: window.width,
        height: window.height,
        x: window.x,
        y: window.y
      });

      // Wait for browser to connect
      await this._waitForConnection();
    }

    // Display the Handle in the window
    await window.update(handle);

    console.log(`Opened window ${windowId}: ${window.title}`);
    return window;
  }

  /**
   * Get all open windows
   * @returns {Array<ShowMeWindow>}
   */
  getWindows() {
    return Array.from(this.windows.values());
  }

  /**
   * Get a specific window by ID
   * @param {string} windowId
   * @returns {ShowMeWindow|null}
   */
  getWindow(windowId) {
    return this.windows.get(windowId) || null;
  }

  /**
   * Get the server actor for advanced control
   * @returns {ShowMeServerActor|null}
   */
  getServerActor() {
    if (!this.server || !this.server.actorManagers) {
      return null;
    }

    const actorManager = this.server.actorManagers.get(this.port);
    if (!actorManager || actorManager.connections.size === 0) {
      return null;
    }

    // Get first connection's server actor
    const connection = Array.from(actorManager.connections.values())[0];
    const actors = Array.from(connection.actorSpace.guidToObject.values());
    return actors.find(a => a.constructor.name === 'ShowMeServerActor');
  }

  /**
   * Stop the ShowMe server and close all windows
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    // Close all windows
    const closePromises = Array.from(this.windows.values()).map(w => w.close());
    await Promise.all(closePromises);

    // Stop server
    await this.server.stop();
    this.isRunning = false;
    this.windows.clear();

    console.log('ShowMeController stopped');
  }

  /**
   * Internal: Remove window from tracking
   * Called by ShowMeWindow.close()
   * @private
   */
  _removeWindow(windowId) {
    this.windows.delete(windowId);
  }

  /**
   * Wait for browser client to connect
   * @private
   */
  async _waitForConnection(timeout = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const serverActor = this.getServerActor();
      if (serverActor) {
        return; // Connected!
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Browser failed to connect within timeout');
  }

  /**
   * Get controller status
   * @returns {Object}
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      port: this.port,
      openWindows: this.windows.size,
      url: this.isRunning ? `http://localhost:${this.port}` : null
    };
  }
}