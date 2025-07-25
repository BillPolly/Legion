/**
 * Tests for WebSocket proxy server
 */

import { createWebSocketServer } from '../../../src/server/websocket.js';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { jest } from '@jest/globals';

// Mock ws module
jest.mock('ws');

describe('WebSocket Proxy Server', () => {
  let mockHttpServer;
  let config;
  let logger;
  let wss;
  let mockClient;
  let mockMcpClient;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock HTTP server
    mockHttpServer = new EventEmitter();
    
    // Create test config and logger
    config = global.testUtils.createTestConfig();
    logger = global.testUtils.createMockLogger();
    
    // Mock WebSocket server
    WebSocketServer.mockImplementation(() => {
      const mockWss = new EventEmitter();
      mockWss.close = jest.fn();
      return mockWss;
    });
    
    // Mock WebSocket client
    mockClient = createMockWebSocket();
    mockMcpClient = createMockWebSocket();
    
    // Mock WebSocket constructor for MCP connections
    WebSocket.mockImplementation(() => mockMcpClient);
  });

  afterEach(() => {
    if (wss) {
      wss.close();
    }
  });

  function createMockWebSocket() {
    const ws = new EventEmitter();
    ws.send = jest.fn();
    ws.close = jest.fn();
    ws.readyState = 1; // OPEN
    ws.on = ws.on.bind(ws);
    ws.emit = ws.emit.bind(ws);
    return ws;
  }

  describe('Server Creation', () => {
    it('should create WebSocket server with correct path', () => {
      wss = createWebSocketServer(mockHttpServer, config, logger);
      
      expect(WebSocketServer).toHaveBeenCalledWith({
        server: mockHttpServer,
        path: '/ws'
      });
    });

    it('should return WebSocket server instance', () => {
      wss = createWebSocketServer(mockHttpServer, config, logger);
      
      expect(wss).toBeDefined();
      expect(wss.close).toBeDefined();
    });
  });

  describe('Client Connection', () => {
    beforeEach(() => {
      wss = createWebSocketServer(mockHttpServer, config, logger);
    });

    it('should handle new client connections', () => {
      const mockReq = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test-agent' }
      };
      
      wss.emit('connection', mockClient, mockReq);
      
      expect(logger.child).toHaveBeenCalledWith({ clientId: expect.any(String) });
      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"welcome"')
      );
    });

    it('should send welcome message with configuration', () => {
      wss.emit('connection', mockClient, {});
      
      const welcomeMessage = JSON.parse(mockClient.send.mock.calls[0][0]);
      
      expect(welcomeMessage).toMatchObject({
        type: 'welcome',
        data: {
          clientId: expect.any(String),
          defaultMcpUrl: config.mcp.defaultUrl,
          config: {
            reconnectInterval: config.mcp.reconnectInterval,
            maxReconnectAttempts: config.mcp.maxReconnectAttempts
          }
        }
      });
    });

    it('should handle client disconnection', () => {
      wss.emit('connection', mockClient, {});
      
      mockClient.emit('close');
      
      expect(logger.child().info).toHaveBeenCalledWith('Debug UI client disconnected');
    });

    it('should handle client errors', () => {
      wss.emit('connection', mockClient, {});
      
      const error = new Error('Connection error');
      mockClient.emit('error', error);
      
      expect(logger.child().error).toHaveBeenCalledWith('WebSocket error:', error);
    });
  });

  describe('Message Handling', () => {
    let clientLogger;

    beforeEach(() => {
      wss = createWebSocketServer(mockHttpServer, config, logger);
      clientLogger = logger.child();
      wss.emit('connection', mockClient, {});
    });

    it('should handle connect message', async () => {
      const connectMessage = {
        type: 'connect',
        data: { url: 'ws://test-mcp:8080/ws' }
      };
      
      mockClient.emit('message', Buffer.from(JSON.stringify(connectMessage)));
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(WebSocket).toHaveBeenCalledWith('ws://test-mcp:8080/ws');
      expect(clientLogger.info).toHaveBeenCalledWith(
        'Connecting to MCP server:',
        'ws://test-mcp:8080/ws'
      );
    });

    it('should use default URL if not provided', async () => {
      const connectMessage = { type: 'connect', data: {} };
      
      mockClient.emit('message', Buffer.from(JSON.stringify(connectMessage)));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(WebSocket).toHaveBeenCalledWith(config.mcp.defaultUrl);
    });

    it('should handle disconnect message', () => {
      const disconnectMessage = { type: 'disconnect' };
      
      mockClient.emit('message', Buffer.from(JSON.stringify(disconnectMessage)));
      
      expect(clientLogger.info).toHaveBeenCalledWith('Disconnecting from MCP server');
    });

    it('should handle ping message', () => {
      const pingMessage = { type: 'ping' };
      
      mockClient.emit('message', Buffer.from(JSON.stringify(pingMessage)));
      
      expect(mockClient.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'pong' })
      );
    });

    it('should handle invalid JSON messages', () => {
      mockClient.emit('message', Buffer.from('invalid json'));
      
      expect(clientLogger.error).toHaveBeenCalledWith(
        'Failed to handle client message:',
        expect.any(Error)
      );
      
      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    it('should handle unknown message types', () => {
      const unknownMessage = { type: 'unknown', data: {} };
      
      mockClient.emit('message', Buffer.from(JSON.stringify(unknownMessage)));
      
      expect(clientLogger.warn).toHaveBeenCalledWith('Unknown message type:', 'unknown');
    });
  });

  describe('MCP Connection', () => {
    beforeEach(() => {
      wss = createWebSocketServer(mockHttpServer, config, logger);
      wss.emit('connection', mockClient, {});
    });

    it('should establish connection to MCP server', async () => {
      const connectMessage = {
        type: 'connect',
        data: { url: 'ws://mcp:8080/ws' }
      };
      
      mockClient.emit('message', Buffer.from(JSON.stringify(connectMessage)));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Simulate MCP connection open
      mockMcpClient.emit('open');
      
      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"connected"')
      );
    });

    it('should forward MCP messages to client', async () => {
      // Connect to MCP
      mockClient.emit('message', Buffer.from(JSON.stringify({
        type: 'connect',
        data: {}
      })));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      mockMcpClient.emit('open');
      
      // Simulate MCP message
      const mcpMessage = { jsonrpc: '2.0', result: { tools: [] } };
      mockMcpClient.emit('message', Buffer.from(JSON.stringify(mcpMessage)));
      
      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"mcp-response"')
      );
      
      const forwardedMessage = JSON.parse(
        mockClient.send.mock.calls.find(call => 
          call[0].includes('mcp-response')
        )[0]
      );
      
      expect(forwardedMessage.data).toEqual(mcpMessage);
    });

    it('should handle MCP connection close', async () => {
      // Connect to MCP
      mockClient.emit('message', Buffer.from(JSON.stringify({
        type: 'connect',
        data: {}
      })));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      mockMcpClient.emit('open');
      
      // Simulate MCP close
      mockMcpClient.emit('close');
      
      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"disconnected"')
      );
    });

    it('should handle MCP connection errors', async () => {
      mockClient.emit('message', Buffer.from(JSON.stringify({
        type: 'connect',
        data: {}
      })));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const error = new Error('MCP connection failed');
      mockMcpClient.emit('error', error);
      
      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });
  });

  describe('MCP Request Forwarding', () => {
    beforeEach(async () => {
      wss = createWebSocketServer(mockHttpServer, config, logger);
      wss.emit('connection', mockClient, {});
      
      // Establish MCP connection
      mockClient.emit('message', Buffer.from(JSON.stringify({
        type: 'connect',
        data: {}
      })));
      
      await new Promise(resolve => setTimeout(resolve, 10));
      mockMcpClient.emit('open');
    });

    it('should forward MCP requests when connected', () => {
      const mcpRequest = {
        type: 'mcp-request',
        data: {
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: 'req_1'
        }
      };
      
      mockClient.emit('message', Buffer.from(JSON.stringify(mcpRequest)));
      
      expect(mockMcpClient.send).toHaveBeenCalledWith(
        JSON.stringify(mcpRequest.data)
      );
    });

    it('should queue requests when reconnecting', async () => {
      // Disconnect MCP
      mockMcpClient.emit('close');
      
      // Send request while disconnected
      const mcpRequest = {
        type: 'mcp-request',
        data: { method: 'tools/list' }
      };
      
      mockClient.emit('message', Buffer.from(JSON.stringify(mcpRequest)));
      
      // Should not send immediately
      expect(mockMcpClient.send).not.toHaveBeenCalled();
    });

    it('should reject requests when not connected', () => {
      // Disconnect and don't reconnect
      mockMcpClient.emit('close');
      config.mcp.maxReconnectAttempts = 0;
      
      const mcpRequest = {
        type: 'mcp-request',
        data: { method: 'tools/list' }
      };
      
      mockClient.emit('message', Buffer.from(JSON.stringify(mcpRequest)));
      
      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });
  });

  describe('Auto-Reconnection', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      
      wss = createWebSocketServer(mockHttpServer, config, logger);
      wss.emit('connection', mockClient, {});
      
      // Establish initial connection
      mockClient.emit('message', Buffer.from(JSON.stringify({
        type: 'connect',
        data: {}
      })));
      
      await Promise.resolve();
      mockMcpClient.emit('open');
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should attempt reconnection on disconnect', () => {
      mockMcpClient.emit('close');
      
      expect(mockClient.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"reconnecting"')
      );
      
      const reconnectMessage = JSON.parse(
        mockClient.send.mock.calls.find(call => 
          call[0].includes('reconnecting')
        )[0]
      );
      
      expect(reconnectMessage.data).toMatchObject({
        attempt: 1,
        maxAttempts: config.mcp.maxReconnectAttempts,
        delay: expect.any(Number)
      });
    });

    it('should use exponential backoff for reconnection', () => {
      // First reconnection
      mockMcpClient.emit('close');
      jest.advanceTimersByTime(config.mcp.reconnectInterval);
      
      // Second reconnection
      mockMcpClient.emit('close');
      
      const secondReconnectMessage = JSON.parse(
        mockClient.send.mock.calls.find(call => 
          call[0].includes('"attempt":2')
        )[0]
      );
      
      // Delay should double
      expect(secondReconnectMessage.data.delay).toBe(
        config.mcp.reconnectInterval * 2
      );
    });

    it('should stop reconnecting after max attempts', () => {
      config.mcp.maxReconnectAttempts = 2;
      
      // Fail twice
      mockMcpClient.emit('close');
      jest.advanceTimersByTime(config.mcp.reconnectInterval);
      
      mockMcpClient.emit('close');
      jest.advanceTimersByTime(config.mcp.reconnectInterval * 2);
      
      // Third failure should not trigger reconnection
      mockMcpClient.emit('close');
      
      const messages = mockClient.send.mock.calls.map(call => 
        JSON.parse(call[0])
      );
      
      const reconnectingMessages = messages.filter(m => 
        m.type === 'reconnecting'
      );
      
      expect(reconnectingMessages.length).toBe(2);
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      wss = createWebSocketServer(mockHttpServer, config, logger);
    });

    it('should clean up resources on client disconnect', () => {
      // Connect client and MCP
      wss.emit('connection', mockClient, {});
      mockClient.emit('message', Buffer.from(JSON.stringify({
        type: 'connect',
        data: {}
      })));
      
      // Disconnect client
      mockClient.emit('close');
      
      expect(mockMcpClient.close).toHaveBeenCalled();
    });

    it('should cancel reconnection timers on disconnect', () => {
      jest.useFakeTimers();
      
      wss.emit('connection', mockClient, {});
      mockClient.emit('message', Buffer.from(JSON.stringify({
        type: 'connect',
        data: {}
      })));
      
      // Trigger reconnection
      mockMcpClient.emit('close');
      
      // Disconnect before reconnection
      mockClient.emit('message', Buffer.from(JSON.stringify({
        type: 'disconnect'
      })));
      
      // Advance time - should not attempt reconnection
      jest.advanceTimersByTime(config.mcp.reconnectInterval * 2);
      
      expect(WebSocket).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });
  });
});