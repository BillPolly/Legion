/**
 * MockWebSocket - Comprehensive WebSocket mock for testing
 *
 * Provides a full WebSocket implementation suitable for testing Actor communication.
 * Supports:
 * - Event-based API (addEventListener, dispatchEvent)
 * - WebSocket ready states (CONNECTING, OPEN, CLOSING, CLOSED)
 * - Message sending and receiving
 * - Paired mode for bidirectional communication
 * - Configurable delays and behaviors
 */

export class MockWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url, protocols = [], options = {}) {
    super();

    this.url = url;
    this.protocols = protocols;
    this.readyState = MockWebSocket.CONNECTING;
    this.bufferedAmount = 0;
    this.extensions = '';
    this.protocol = '';
    this.binaryType = 'blob';

    // Configuration
    this.config = {
      autoConnect: options.autoConnect !== false,
      connectionDelay: options.connectionDelay ?? 10,
      sendDelay: options.sendDelay ?? 0,
      closeDelay: options.closeDelay ?? 10,
      simulateErrors: options.simulateErrors ?? false,
      ...options
    };

    // Internal state
    this.sentMessages = [];
    this.partner = null;
    this._handlers = {
      open: [],
      close: [],
      error: [],
      message: []
    };

    // Auto-connect if enabled
    if (this.config.autoConnect) {
      setTimeout(() => this.simulateOpen(), this.config.connectionDelay);
    }
  }

  /**
   * Send data through the WebSocket
   */
  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new DOMException(
        'WebSocket is not open: readyState ' + this.readyState + ' (' +
        ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.readyState] + ')',
        'InvalidStateError'
      );
    }

    // Store message
    this.sentMessages.push(data);

    // Send to partner if in paired mode
    if (this.partner && this.partner.readyState === MockWebSocket.OPEN) {
      const sendToPartner = () => {
        this.partner.simulateMessage(data);
      };

      if (this.config.sendDelay > 0) {
        setTimeout(sendToPartner, this.config.sendDelay);
      } else {
        sendToPartner();
      }
    }
  }

  /**
   * Close the WebSocket connection
   */
  close(code = 1000, reason = '') {
    if (this.readyState === MockWebSocket.CLOSING || this.readyState === MockWebSocket.CLOSED) {
      return;
    }

    this.readyState = MockWebSocket.CLOSING;

    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      const closeEvent = new CloseEvent('close', {
        code,
        reason,
        wasClean: code === 1000
      });
      this.dispatchEvent(closeEvent);

      // Close partner if paired
      if (this.partner && this.partner.readyState !== MockWebSocket.CLOSED) {
        this.partner.close(code, reason);
      }
    }, this.config.closeDelay);
  }

  /**
   * Simulate opening the connection
   */
  simulateOpen() {
    if (this.readyState !== MockWebSocket.CONNECTING) {
      return;
    }

    this.readyState = MockWebSocket.OPEN;
    const openEvent = new Event('open');
    this.dispatchEvent(openEvent);
  }

  /**
   * Simulate receiving a message
   */
  simulateMessage(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      console.warn('Attempted to simulate message on non-open WebSocket');
      return;
    }

    const messageEvent = new MessageEvent('message', { data });
    this.dispatchEvent(messageEvent);
  }

  /**
   * Simulate an error
   */
  simulateError(message = 'WebSocket error') {
    const errorEvent = new Event('error');
    errorEvent.message = message;
    this.dispatchEvent(errorEvent);
  }

  /**
   * Get all sent messages
   */
  getSentMessages() {
    return [...this.sentMessages];
  }

  /**
   * Get the last sent message
   */
  getLastSentMessage() {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  /**
   * Clear sent messages history
   */
  clearSentMessages() {
    this.sentMessages = [];
  }

  /**
   * Pair two WebSockets for bidirectional communication
   */
  static createPair(urlA = 'ws://test-a', urlB = 'ws://test-b', options = {}) {
    const wsA = new MockWebSocket(urlA, [], { ...options, autoConnect: false });
    const wsB = new MockWebSocket(urlB, [], { ...options, autoConnect: false });

    wsA.partner = wsB;
    wsB.partner = wsA;

    // Open both connections
    setTimeout(() => {
      wsA.simulateOpen();
      wsB.simulateOpen();
    }, options.connectionDelay ?? 10);

    return { clientWs: wsA, serverWs: wsB };
  }

  /**
   * Legacy addEventListener for compatibility
   */
  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options);
    if (!this._handlers[type]) {
      this._handlers[type] = [];
    }
    this._handlers[type].push(listener);
  }

  /**
   * Legacy removeEventListener for compatibility
   */
  removeEventListener(type, listener, options) {
    super.removeEventListener(type, listener, options);
    if (this._handlers[type]) {
      this._handlers[type] = this._handlers[type].filter(l => l !== listener);
    }
  }
}

// CloseEvent polyfill for environments that don't have it
class CloseEvent extends Event {
  constructor(type, init = {}) {
    super(type);
    this.code = init.code ?? 1000;
    this.reason = init.reason ?? '';
    this.wasClean = init.wasClean ?? true;
  }
}

// Export CloseEvent for testing
export { CloseEvent };
