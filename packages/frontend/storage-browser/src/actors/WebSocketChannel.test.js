/**
 * Tests for WebSocket Channel
 */

describe('WebSocketChannel', () => {
  let channel;
  let mockWebSocket;

  beforeEach(() => {
    // Mock WebSocket
    mockWebSocket = {
      readyState: 0, // CONNECTING
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    global.WebSocket = jest.fn(() => mockWebSocket);
  });

  afterEach(() => {
    if (channel) {
      channel.disconnect();
    }
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    test('should create WebSocket connection', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700');
      
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:3700');
      expect(channel.url).toBe('ws://localhost:3700');
      expect(channel.isConnected()).toBe(false);
    });

    test('should handle connection open event', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700');
      
      const onConnect = jest.fn();
      channel.on('connect', onConnect);
      
      // Simulate connection open
      mockWebSocket.readyState = 1;
      const openHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'open')[1];
      openHandler();
      
      expect(onConnect).toHaveBeenCalled();
      expect(channel.isConnected()).toBe(true);
    });

    test('should handle connection close event', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700');
      
      const onDisconnect = jest.fn();
      channel.on('disconnect', onDisconnect);
      
      // Simulate connection close
      mockWebSocket.readyState = 3;
      const closeHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'close')[1];
      closeHandler({ code: 1000, reason: 'Normal closure' });
      
      expect(onDisconnect).toHaveBeenCalledWith({
        code: 1000,
        reason: 'Normal closure'
      });
      expect(channel.isConnected()).toBe(false);
    });

    test('should handle connection errors', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700');
      
      const onError = jest.fn();
      channel.on('error', onError);
      
      // Simulate error
      const errorHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'error')[1];
      const error = new Error('Connection failed');
      errorHandler(error);
      
      expect(onError).toHaveBeenCalledWith(error);
    });

    test('should disconnect cleanly', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700');
      
      mockWebSocket.readyState = 1;
      channel.disconnect();
      
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('Auto-reconnection Logic', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should attempt reconnection after disconnect', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700', {
        autoReconnect: true,
        reconnectDelay: 1000
      });
      
      // Simulate unexpected disconnect
      mockWebSocket.readyState = 3;
      const closeHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'close')[1];
      closeHandler({ code: 1006, reason: 'Abnormal closure' });
      
      // Should schedule reconnection
      expect(global.WebSocket).toHaveBeenCalledTimes(1);
      
      // Fast-forward time
      jest.advanceTimersByTime(1000);
      
      // Should create new connection
      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });

    test('should use exponential backoff for reconnection', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700', {
        autoReconnect: true,
        reconnectDelay: 1000,
        maxReconnectDelay: 30000
      });
      
      const closeHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'close')[1];
      
      // First disconnect - 1 second delay
      closeHandler({ code: 1006 });
      jest.advanceTimersByTime(1000);
      expect(global.WebSocket).toHaveBeenCalledTimes(2);
      
      // Second disconnect - 2 second delay
      closeHandler({ code: 1006 });
      jest.advanceTimersByTime(2000);
      expect(global.WebSocket).toHaveBeenCalledTimes(3);
      
      // Third disconnect - 4 second delay
      closeHandler({ code: 1006 });
      jest.advanceTimersByTime(4000);
      expect(global.WebSocket).toHaveBeenCalledTimes(4);
    });

    test('should stop reconnection when manually disconnected', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700', {
        autoReconnect: true
      });
      
      // Manual disconnect
      channel.disconnect();
      
      // Should not attempt reconnection
      jest.advanceTimersByTime(10000);
      expect(global.WebSocket).toHaveBeenCalledTimes(1);
    });

    test('should limit reconnection attempts', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700', {
        autoReconnect: true,
        maxReconnectAttempts: 3,
        reconnectDelay: 100
      });
      
      const closeHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'close')[1];
      
      // Simulate multiple failures
      for (let i = 0; i < 5; i++) {
        closeHandler({ code: 1006 });
        jest.advanceTimersByTime(100 * Math.pow(2, i));
      }
      
      // Should stop after max attempts
      expect(global.WebSocket).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('Message Queuing During Disconnection', () => {
    test('should queue messages when disconnected', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700');
      
      mockWebSocket.readyState = 0; // CONNECTING
      
      channel.send({ type: 'request', data: 'test1' });
      channel.send({ type: 'request', data: 'test2' });
      
      expect(mockWebSocket.send).not.toHaveBeenCalled();
      expect(channel.getQueueSize()).toBe(2);
    });

    test('should send queued messages on reconnection', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700');
      
      // Queue messages while disconnected
      mockWebSocket.readyState = 0;
      channel.send({ type: 'request', data: 'test1' });
      channel.send({ type: 'request', data: 'test2' });
      
      // Simulate connection open
      mockWebSocket.readyState = 1;
      const openHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'open')[1];
      openHandler();
      
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'request', data: 'test1' })
      );
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'request', data: 'test2' })
      );
      expect(channel.getQueueSize()).toBe(0);
    });

    test('should limit queue size', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700', {
        maxQueueSize: 3
      });
      
      mockWebSocket.readyState = 0;
      
      // Try to queue more than limit
      for (let i = 0; i < 5; i++) {
        channel.send({ id: i });
      }
      
      expect(channel.getQueueSize()).toBe(3);
    });

    test('should clear queue on disconnect', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700');
      
      mockWebSocket.readyState = 0;
      channel.send({ type: 'request' });
      
      channel.disconnect();
      expect(channel.getQueueSize()).toBe(0);
    });
  });

  describe('Serialization', () => {
    test('should serialize JSON messages', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700');
      
      mockWebSocket.readyState = 1;
      
      const message = { type: 'request', id: '123', data: { test: true } };
      channel.send(message);
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    test('should handle binary data', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700', {
        binaryType: 'arraybuffer'
      });
      
      mockWebSocket.readyState = 1;
      
      const buffer = new ArrayBuffer(8);
      channel.sendBinary(buffer);
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(buffer);
    });

    test('should deserialize incoming messages', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700');
      
      const onMessage = jest.fn();
      channel.on('message', onMessage);
      
      // Simulate incoming message
      const messageHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')[1];
      
      const data = JSON.stringify({ type: 'response', data: 'test' });
      messageHandler({ data });
      
      expect(onMessage).toHaveBeenCalledWith({
        type: 'response',
        data: 'test'
      });
    });

    test('should handle malformed messages', () => {
      const { WebSocketChannel } = require('./WebSocketChannel.js');
      channel = new WebSocketChannel('ws://localhost:3700');
      
      const onError = jest.fn();
      channel.on('error', onError);
      
      const messageHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')[1];
      
      messageHandler({ data: 'invalid json {' });
      
      expect(onError).toHaveBeenCalled();
    });
  });
});