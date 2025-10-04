/**
 * Mock WebSocket for testing
 * Creates a pair of connected WebSockets that can send messages to each other
 */

export class MockWebSocket {
  constructor() {
    this.onmessage = null;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.readyState = 1; // OPEN
    this.partner = null;
  }

  send(data) {
    if (this.partner && this.partner.onmessage) {
      // Simulate async message delivery
      setTimeout(() => {
        this.partner.onmessage({ data });
      }, 0);
    }
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose();
    }
    if (this.partner) {
      this.partner.readyState = 3;
      if (this.partner.onclose) {
        this.partner.onclose();
      }
    }
  }

  /**
   * Manually trigger the open event for testing
   */
  simulateOpen() {
    this.readyState = 1; // OPEN
    if (this.onopen) {
      setTimeout(() => {
        this.onopen();
      }, 0);
    }
  }

  /**
   * Create a connected pair of mock WebSockets
   */
  static createPair() {
    const serverWs = new MockWebSocket();
    const clientWs = new MockWebSocket();

    serverWs.partner = clientWs;
    clientWs.partner = serverWs;

    // Trigger open event
    setTimeout(() => {
      if (serverWs.onopen) serverWs.onopen();
      if (clientWs.onopen) clientWs.onopen();
    }, 0);

    return { serverWs, clientWs };
  }
}