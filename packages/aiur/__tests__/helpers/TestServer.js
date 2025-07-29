/**
 * TestServer - Simple wrapper for AiurServer in tests
 * 
 * Provides a clean interface for starting/stopping server instances
 * with proper cleanup and port management.
 */

import { AiurServer } from '../../src/server/AiurServer.js';

export class TestServer {
  constructor(options = {}) {
    // Use random port to avoid conflicts
    this.port = options.port || (9000 + Math.floor(Math.random() * 1000));
    this.host = options.host || 'localhost';
    
    this.config = {
      port: this.port,
      host: this.host,
      sessionTimeout: options.sessionTimeout || 60000,
      enableFileLogging: false, // Disable file logging in tests
      ...options
    };
    
    this.server = null;
    this.isRunning = false;
  }

  /**
   * Start the test server
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    this.server = new AiurServer(this.config);
    await this.server.start();
    this.isRunning = true;
    
    console.log(`Test server started on ${this.host}:${this.port}`);
    return this.getUrl();
  }

  /**
   * Stop the test server
   */
  async stop() {
    if (!this.isRunning || !this.server) {
      return;
    }

    await this.server.stop();
    this.server = null;
    this.isRunning = false;
    
    console.log(`Test server stopped on ${this.host}:${this.port}`);
  }

  /**
   * Get the WebSocket URL for this server
   */
  getWebSocketUrl() {
    return `ws://${this.host}:${this.port}/ws`;
  }

  /**
   * Get the HTTP URL for this server
   */
  getHttpUrl() {
    return `http://${this.host}:${this.port}`;
  }

  /**
   * Get the base URL (same as HTTP)
   */
  getUrl() {
    return this.getHttpUrl();
  }

  /**
   * Check if server is running
   */
  isServerRunning() {
    return this.isRunning;
  }

  /**
   * Get server config
   */
  getConfig() {
    return { ...this.config };
  }
}