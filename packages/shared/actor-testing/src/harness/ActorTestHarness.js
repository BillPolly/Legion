/**
 * ActorTestHarness - Comprehensive testing environment for Actor systems
 *
 * Provides a complete testing setup for Actor-based client-server communication:
 * - Paired MockWebSockets for bidirectional communication
 * - ActorSpace for both client and server
 * - Channel setup and management
 * - JSDOM integration for browser-side actors
 * - Cleanup and teardown
 *
 * Usage:
 * ```javascript
 * const harness = new ActorTestHarness({
 *   serverActor: MyServerActor,
 *   clientActor: MyClientActor,
 *   useDom: true
 * });
 *
 * await harness.setup();
 * // Run tests...
 * await harness.teardown();
 * ```
 */

import { ActorSpace } from '@legion/actors';
import { MockWebSocket } from '../mocks/MockWebSocket.js';
import { JSDOMEnvironment } from '../utils/JSDOMEnvironment.js';

export class ActorTestHarness {
  constructor(options = {}) {
    this.options = {
      serverUrl: options.serverUrl || 'ws://test-server',
      clientUrl: options.clientUrl || 'ws://test-client',
      serverSpaceId: options.serverSpaceId || 'test-server-space',
      clientSpaceId: options.clientSpaceId || 'test-client-space',
      serverActorId: options.serverActorId || 'server-actor',
      clientActorId: options.clientActorId || 'client-actor',
      useDom: options.useDom ?? false,
      domOptions: options.domOptions || {},
      autoConnect: options.autoConnect ?? true,
      connectionDelay: options.connectionDelay ?? 10,
      ...options
    };

    // Component references
    this.serverSpace = null;
    this.clientSpace = null;
    this.serverWs = null;
    this.clientWs = null;
    this.serverChannel = null;
    this.clientChannel = null;
    this.serverActor = null;
    this.clientActor = null;
    this.domEnv = null;

    // State
    this.isSetup = false;
  }

  /**
   * Setup the test harness
   */
  async setup() {
    if (this.isSetup) {
      throw new Error('Harness already setup');
    }

    // Setup JSDOM if requested
    if (this.options.useDom) {
      this.domEnv = new JSDOMEnvironment(this.options.domOptions);
      this.domEnv.setup();
    }

    // Create paired WebSockets
    const { clientWs, serverWs } = MockWebSocket.createPair(
      this.options.clientUrl,
      this.options.serverUrl,
      {
        autoConnect: this.options.autoConnect,
        connectionDelay: this.options.connectionDelay
      }
    );

    this.clientWs = clientWs;
    this.serverWs = serverWs;

    // Create ActorSpaces
    this.serverSpace = new ActorSpace(this.options.serverSpaceId);
    this.clientSpace = new ActorSpace(this.options.clientSpaceId);

    // Create server actor if provided
    if (this.options.serverActor) {
      if (typeof this.options.serverActor === 'function') {
        this.serverActor = new this.options.serverActor(this.options.serverActorOptions);
      } else {
        this.serverActor = this.options.serverActor;
      }
      this.serverSpace.register(this.serverActor, this.options.serverActorId);
    }

    // Create client actor if provided
    if (this.options.clientActor) {
      if (typeof this.options.clientActor === 'function') {
        this.clientActor = new this.options.clientActor(this.options.clientActorOptions);
      } else {
        this.clientActor = this.options.clientActor;
      }
      this.clientSpace.register(this.clientActor, this.options.clientActorId);
    }

    // Setup channels
    this.serverChannel = this.serverSpace.addChannel(this.serverWs, this.serverActor || this.serverSpace);
    this.clientChannel = this.clientSpace.addChannel(this.clientWs, this.clientActor || this.clientSpace);

    // Wait for connections if auto-connecting
    if (this.options.autoConnect) {
      await this.waitForConnections();
    }

    this.isSetup = true;
  }

  /**
   * Wait for WebSocket connections to open
   */
  async waitForConnections(timeout = 1000) {
    const start = Date.now();
    while (
      (this.serverWs.readyState !== MockWebSocket.OPEN ||
       this.clientWs.readyState !== MockWebSocket.OPEN) &&
      Date.now() - start < timeout
    ) {
      await this.wait(10);
    }

    if (this.serverWs.readyState !== MockWebSocket.OPEN) {
      throw new Error('Server WebSocket failed to open');
    }
    if (this.clientWs.readyState !== MockWebSocket.OPEN) {
      throw new Error('Client WebSocket failed to open');
    }
  }

  /**
   * Send message from client to server
   */
  async clientSend(messageType, data) {
    if (!this.clientActor) {
      throw new Error('No client actor configured');
    }
    return await this.clientActor.receive(messageType, data);
  }

  /**
   * Send message from server to client
   */
  async serverSend(messageType, data) {
    if (!this.serverActor) {
      throw new Error('No server actor configured');
    }
    return await this.serverActor.receive(messageType, data);
  }

  /**
   * Get messages sent by server
   */
  getServerSentMessages() {
    return this.serverWs.getSentMessages();
  }

  /**
   * Get messages sent by client
   */
  getClientSentMessages() {
    return this.clientWs.getSentMessages();
  }

  /**
   * Simulate server sending a message to client
   */
  simulateServerMessage(data) {
    this.serverWs.simulateMessage(data);
  }

  /**
   * Simulate client sending a message to server
   */
  simulateClientMessage(data) {
    this.clientWs.simulateMessage(data);
  }

  /**
   * Clear message history
   */
  clearMessageHistory() {
    this.serverWs.clearSentMessages();
    this.clientWs.clearSentMessages();
  }

  /**
   * Get DOM document (if JSDOM is enabled)
   */
  getDocument() {
    if (!this.domEnv) {
      throw new Error('JSDOM not enabled. Set useDom: true in options');
    }
    return this.domEnv.getDocument();
  }

  /**
   * Get DOM window (if JSDOM is enabled)
   */
  getWindow() {
    if (!this.domEnv) {
      throw new Error('JSDOM not enabled. Set useDom: true in options');
    }
    return this.domEnv.getWindow();
  }

  /**
   * Query DOM element (if JSDOM is enabled)
   */
  querySelector(selector) {
    return this.getDocument().querySelector(selector);
  }

  /**
   * Query all DOM elements (if JSDOM is enabled)
   */
  querySelectorAll(selector) {
    return this.getDocument().querySelectorAll(selector);
  }

  /**
   * Utility: wait for specified milliseconds
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Utility: wait for condition to be true
   */
  async waitFor(condition, timeout = 1000, checkInterval = 10) {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await this.wait(checkInterval);
    }
    if (!condition()) {
      throw new Error('Timeout waiting for condition');
    }
  }

  /**
   * Teardown and cleanup
   */
  async teardown() {
    if (!this.isSetup) {
      return;
    }

    // Close WebSockets
    if (this.serverWs) {
      this.serverWs.close();
    }
    if (this.clientWs) {
      this.clientWs.close();
    }

    // Destroy ActorSpaces
    if (this.serverSpace) {
      this.serverSpace.destroy();
    }
    if (this.clientSpace) {
      this.clientSpace.destroy();
    }

    // Cleanup JSDOM
    if (this.domEnv) {
      this.domEnv.teardown();
    }

    // Clear references
    this.serverSpace = null;
    this.clientSpace = null;
    this.serverWs = null;
    this.clientWs = null;
    this.serverChannel = null;
    this.clientChannel = null;
    this.serverActor = null;
    this.clientActor = null;
    this.domEnv = null;

    this.isSetup = false;
  }
}
