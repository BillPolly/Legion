/**
 * Unit tests for WebSocket server module
 */

import { jest } from '@jest/globals';
import { AgentWebSocketServer } from '../../src/websocket-server.js';

// Mock agent for testing
const mockAgent = {
  run: jest.fn()
};

describe('AgentWebSocketServer', () => {
  let server;

  beforeEach(() => {
    mockAgent.run.mockClear();
    server = new AgentWebSocketServer(mockAgent, {
      port: 3005, // Fixed test port to avoid conflicts with integration tests
      host: 'localhost'
    });
  });

  afterEach(async () => {
    if (server && server.wss) {
      await server.stop();
    }
  });

  describe('Initialization', () => {
    it('should create server with default options', () => {
      const defaultServer = new AgentWebSocketServer(mockAgent);
      
      expect(defaultServer.agent).toBe(mockAgent);
      expect(defaultServer.port).toBe(3001);
      expect(defaultServer.host).toBe('localhost');
      expect(defaultServer.server).toBeNull();
      expect(defaultServer.wss).toBeNull();
    });

    it('should create server with custom options', () => {
      const customServer = new AgentWebSocketServer(mockAgent, {
        port: 8080,
        host: '0.0.0.0'
      });
      
      expect(customServer.port).toBe(8080);
      expect(customServer.host).toBe('0.0.0.0');
    });
  });

  describe('Status', () => {
    it('should return correct status when not running', () => {
      const status = server.getStatus();
      
      expect(status.running).toBe(false);
      expect(status.port).toBe(server.port); // Use actual port value
      expect(status.host).toBe('localhost');
      expect(status.connections).toBe(0);
      expect(status.conversations).toBe(0);
    });
  });

  describe('Message Handling', () => {
    it('should handle valid message format', async () => {
      const mockWs = {
        send: jest.fn()
      };

      mockAgent.run.mockResolvedValue({ message: 'Test response' });

      const validMessage = {
        id: 'test-123',
        type: 'message',
        content: 'Hello world',
        conversationId: 'test-conv'
      };

      await server.handleMessage(mockWs, validMessage);

      expect(mockAgent.run).toHaveBeenCalledWith('Hello world', undefined);
      const call = mockWs.send.mock.calls[0][0];
      const response = JSON.parse(call);
      expect(response.id).toBe('test-123');
      expect(response.success).toBe(true);
      expect(response.response).toBe('Test response');
      expect(response.conversationId).toBe('test-conv');
      expect(response.timestamp).toEqual(expect.any(String));
    });

    it('should handle message with image', async () => {
      const mockWs = {
        send: jest.fn()
      };

      mockAgent.run.mockResolvedValue({ message: 'Image processed' });

      const messageWithImage = {
        id: 'test-456',
        type: 'message',
        content: 'Describe this image',
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
      };

      await server.handleMessage(mockWs, messageWithImage);

      expect(mockAgent.run).toHaveBeenCalledWith(
        'Describe this image',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
      );
    });

    it('should handle missing message ID', async () => {
      const mockWs = {
        send: jest.fn()
      };

      const invalidMessage = {
        type: 'message',
        content: 'Hello world'
      };

      await server.handleMessage(mockWs, invalidMessage);

      expect(mockAgent.run).not.toHaveBeenCalled();
      const call = mockWs.send.mock.calls[0][0];
      const response = JSON.parse(call);
      expect(response.id).toBe(null);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Missing message ID');
      expect(response.details).toBe(null);
      expect(response.timestamp).toEqual(expect.any(String));
    });

    it('should handle unsupported message type', async () => {
      const mockWs = {
        send: jest.fn()
      };

      const invalidMessage = {
        id: 'test-789',
        type: 'unknown',
        content: 'Hello world'
      };

      await server.handleMessage(mockWs, invalidMessage);

      expect(mockAgent.run).not.toHaveBeenCalled();
      const call = mockWs.send.mock.calls[0][0];
      const response = JSON.parse(call);
      expect(response.id).toBe('test-789');
      expect(response.success).toBe(false);
      expect(response.error).toBe('Unsupported message type');
      expect(response.details).toBe(null);
      expect(response.timestamp).toEqual(expect.any(String));
    });

    it('should handle agent errors', async () => {
      const mockWs = {
        send: jest.fn()
      };

      mockAgent.run.mockRejectedValue(new Error('Agent processing failed'));

      const validMessage = {
        id: 'test-error',
        type: 'message',
        content: 'Trigger error'
      };

      await server.handleMessage(mockWs, validMessage);

      expect(mockAgent.run).toHaveBeenCalledWith('Trigger error', undefined);
      const call = mockWs.send.mock.calls[0][0];
      const response = JSON.parse(call);
      expect(response.id).toBe('test-error');
      expect(response.success).toBe(false);
      expect(response.error).toBe('Agent processing error');
      expect(response.details).toBe('Agent processing failed');
      expect(response.timestamp).toEqual(expect.any(String));
    });
  });

  describe('Server Lifecycle', () => {
    it('should start and stop server', async () => {
      // Start server
      await server.start();
      expect(server.wss).toBeDefined();
      expect(server.getStatus().running).toBe(true);

      // Stop server
      await server.stop();
      
      // Give a brief moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(server.getStatus().running).toBe(false);
    });
  });

  describe('Static Methods', () => {
    it('should check if server is running when no PID file exists', async () => {
      const result = await AgentWebSocketServer.isRunning('/nonexistent/path/.agent.pid');
      expect(result).toBeNull();
    });
  });
});