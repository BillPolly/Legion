/**
 * MockWebSocket - Simulates WebSocket connections for testing ActorSpace
 *
 * Provides a pair of connected WebSockets that can communicate in the same process.
 * This allows testing frontend-backend actor communication without real network connections.
 */

export class MockWebSocket {
  constructor() {
    this._readyState = 0; // CONNECTING
    this._listeners = new Map();
    this._partner = null;

    // Support direct property assignment (for Channel's endpoint.onmessage pattern)
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    this.onopen = null;
  }

  // WebSocket constants
  static get CONNECTING() { return 0; }
  static get OPEN() { return 1; }
  static get CLOSING() { return 2; }
  static get CLOSED() { return 3; }

  get CONNECTING() { return 0; }
  get OPEN() { return 1; }
  get CLOSING() { return 2; }
  get CLOSED() { return 3; }

  get readyState() {
    return this._readyState;
  }

  /**
   * Set the partner WebSocket that this one is connected to
   * @param {MockWebSocket} partner
   */
  _setPair(partner) {
    this._partner = partner;
  }

  /**
   * Open the connection (simulate connection establishment)
   */
  _open() {
    this._readyState = 1; // OPEN
    this._emit('open', {});
  }

  /**
   * Send a message to the partner WebSocket
   * @param {string} data - Data to send
   */
  send(data) {
    if (this._readyState !== 1) {
      throw new Error('WebSocket is not open');
    }

    // Simulate async message delivery
    setImmediate(() => {
      if (this._partner && this._partner._readyState === 1) {
        this._partner._emit('message', { data });
      }
    });
  }

  /**
   * Close the WebSocket connection
   */
  close() {
    if (this._readyState === 2 || this._readyState === 3) {
      return; // Already closing or closed
    }

    this._readyState = 2; // CLOSING

    setImmediate(() => {
      this._readyState = 3; // CLOSED
      this._emit('close', {});

      // Notify partner
      if (this._partner && this._partner._readyState === 1) {
        this._partner._readyState = 3;
        this._partner._emit('close', {});
      }
    });
  }

  /**
   * Add event listener (supports both addEventListener and on)
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   * @param {Object} options - Options (once, etc.)
   */
  addEventListener(event, callback, options = {}) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push({ callback, once: options.once || false });
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event handler to remove
   */
  removeEventListener(event, callback) {
    if (!this._listeners.has(event)) return;

    const listeners = this._listeners.get(event);
    const index = listeners.findIndex(l => l.callback === callback);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Add event listener (Node.js style 'on')
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  on(event, callback) {
    this.addEventListener(event, callback);
  }

  /**
   * Emit an event to all listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @private
   */
  _emit(event, data) {
    // Call direct property handler first (onmessage, onerror, etc.)
    const directHandler = this[`on${event}`];
    if (directHandler && typeof directHandler === 'function') {
      directHandler(data);
    }

    // Then call addEventListener listeners
    if (!this._listeners.has(event)) return;

    const listeners = this._listeners.get(event);
    const listenersToCall = [...listeners]; // Copy array in case listeners modify it

    for (const listener of listenersToCall) {
      listener.callback(data);

      if (listener.once) {
        this.removeEventListener(event, listener.callback);
      }
    }
  }

  /**
   * Create a pair of connected MockWebSockets
   * @returns {{ serverWs: MockWebSocket, clientWs: MockWebSocket }}
   */
  static createPair() {
    const serverWs = new MockWebSocket();
    const clientWs = new MockWebSocket();

    serverWs._setPair(clientWs);
    clientWs._setPair(serverWs);

    // Simulate connection establishment asynchronously
    setImmediate(() => {
      serverWs._open();
      clientWs._open();
    });

    return { serverWs, clientWs };
  }
}
