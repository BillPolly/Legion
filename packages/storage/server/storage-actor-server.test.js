/**
 * Tests for Storage Actor Server
 */

import { jest } from '@jest/globals';
import { WebSocketServer } from 'ws';
import { StorageActorServer } from './storage-actor-server.js';

// Mock WebSocketServer
jest.mock('ws', () => ({
  WebSocketServer: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn((cb) => cb && cb()),
    clients: new Set()
  }))
}));

describe('StorageActorServer', () => {
  let server;
  let mockHttpServer;

  beforeEach(() => {
    mockHttpServer = {
      listen: jest.fn((port, cb) => cb && cb()),
      close: jest.fn((cb) => cb && cb()),
      on: jest.fn()
    };
  });

  afterEach(async () => {
    if (server) {
      await server.shutdown();
    }
  });

  describe('Server Initialization', () => {
    test('should create server with default configuration', () => {
      server = new StorageActorServer();
      expect(server).toBeDefined();
      expect(server.port).toBe(3700);
      expect(server.isRunning).toBe(false);
    });

    test('should accept custom port configuration', () => {
      server = new StorageActorServer({ port: 4000 });
      expect(server.port).toBe(4000);
    });

    test('should initialize WebSocket server on start', async () => {
      server = new StorageActorServer();
      await server.start();
      
      expect(WebSocketServer).toHaveBeenCalledWith({
        port: 3700,
        path: '/storage'
      });
      expect(server.isRunning).toBe(true);
    });

    test('should handle server start errors', async () => {
      const mockError = new Error('Port in use');
      WebSocketServer.mockImplementationOnce(() => {
        throw mockError;
      });

      server = new StorageActorServer();
      await expect(server.start()).rejects.toThrow('Port in use');
      expect(server.isRunning).toBe(false);
    });
  });

  describe('Connection Handling', () => {
    test('should accept WebSocket connections', async () => {
      server = new StorageActorServer();
      const mockWss = {
        on: jest.fn(),
        close: jest.fn((cb) => cb && cb()),
        clients: new Set()
      };
      
      WebSocketServer.mockImplementationOnce(() => mockWss);
      await server.start();

      expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    test('should handle connection errors', async () => {
      server = new StorageActorServer();
      const mockWss = {
        on: jest.fn(),
        close: jest.fn((cb) => cb && cb()),
        clients: new Set()
      };
      
      WebSocketServer.mockImplementationOnce(() => mockWss);
      await server.start();

      expect(mockWss.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Graceful Shutdown', () => {
    test('should close WebSocket server on shutdown', async () => {
      server = new StorageActorServer();
      const mockWss = {
        on: jest.fn(),
        close: jest.fn((cb) => cb && cb()),
        clients: new Set()
      };
      
      WebSocketServer.mockImplementationOnce(() => mockWss);
      await server.start();
      await server.shutdown();

      expect(mockWss.close).toHaveBeenCalled();
      expect(server.isRunning).toBe(false);
    });

    test('should close all client connections on shutdown', async () => {
      server = new StorageActorServer();
      const mockClient = {
        close: jest.fn(),
        terminate: jest.fn()
      };
      const mockWss = {
        on: jest.fn(),
        close: jest.fn((cb) => cb && cb()),
        clients: new Set([mockClient])
      };
      
      WebSocketServer.mockImplementationOnce(() => mockWss);
      await server.start();
      await server.shutdown();

      expect(mockClient.close).toHaveBeenCalled();
    });

    test('should handle shutdown when not running', async () => {
      server = new StorageActorServer();
      await expect(server.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Configuration', () => {
    test('should load ResourceManager configuration', () => {
      const mockResourceManager = {
        get: jest.fn((key) => {
          if (key === 'env.STORAGE_ACTOR_PORT') return 5000;
          if (key === 'env.STORAGE_ACTOR_PATH') return '/actors';
          return null;
        })
      };

      server = new StorageActorServer({ resourceManager: mockResourceManager });
      expect(server.port).toBe(5000);
      expect(server.path).toBe('/actors');
    });

    test('should use defaults when ResourceManager not provided', () => {
      server = new StorageActorServer();
      expect(server.port).toBe(3700);
      expect(server.path).toBe('/storage');
    });
  });
});