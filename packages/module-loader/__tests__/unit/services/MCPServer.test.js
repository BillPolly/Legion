/**
 * MCPServer Service Tests
 * 
 * Tests for the MCPServer service and ResourceManager integration
 */

import { jest } from '@jest/globals';
import { ResourceManager } from '../../../src/resources/ResourceManager.js';
import { MCPServer } from '../../../src/services/MCPServer.js';
import { createMCPServer, getMCPServer, stopMCPServer, createAiurMCPServer } from '../../../src/services/MCPServerFactory.js';

// Mock external dependencies
jest.mock('ws', () => ({
  WebSocketServer: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
}));

jest.mock('http', () => ({
  createServer: jest.fn().mockReturnValue({
    listen: jest.fn((port, host, callback) => {
      setTimeout(() => callback(null), 10);
      return {
        address: () => ({ address: host, port })
      };
    }),
    close: jest.fn((callback) => {
      setTimeout(() => callback(), 10);
    }),
    address: () => ({ address: 'localhost', port: 8080 })
  })
}));

describe('MCPServer', () => {
  let resourceManager;
  let mockLogger;

  beforeEach(async () => {
    // Create fresh ResourceManager for each test
    resourceManager = new ResourceManager({ loadEnv: false });
    await resourceManager.initialize();

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    resourceManager.register('logger', mockLogger);

    // Ensure MCPServer factory is registered for tests
    resourceManager.registerFactory('MCPServer', createMCPServer);
  });

  afterEach(async () => {
    // Clean up any servers
    if (resourceManager.has('MCPServer')) {
      const server = resourceManager.get('MCPServer');
      await server.stop();
      resourceManager.unregister('MCPServer');
    }
  });

  describe('MCPServer.create()', () => {
    test('should create MCPServer with default config', async () => {
      const server = await MCPServer.create({}, resourceManager);

      expect(server).toBeInstanceOf(MCPServer);
      expect(server.config.server.port).toBe(8080);
      expect(server.config.server.host).toBe('localhost');
      expect(server.config.session.enableSessionMode).toBe(true);
    });

    test('should create MCPServer with custom config', async () => {
      const config = {
        server: { port: 9999, host: '0.0.0.0' },
        session: { enableSessionMode: false },
        tools: { enableContext: false }
      };

      const server = await MCPServer.create(config, resourceManager);

      expect(server.config.server.port).toBe(9999);
      expect(server.config.server.host).toBe('0.0.0.0');
      expect(server.config.session.enableSessionMode).toBe(false);
      expect(server.config.tools.enableContext).toBe(false);
    });

    test('should handle missing logger gracefully', async () => {
      const rmWithoutLogger = new ResourceManager({ loadEnv: false });
      await rmWithoutLogger.initialize();

      const server = await MCPServer.create({}, rmWithoutLogger);
      expect(server).toBeInstanceOf(MCPServer);
    });
  });

  describe('MCPServer lifecycle', () => {
    let server;

    beforeEach(async () => {
      server = await MCPServer.create({ server: { port: 8081 } }, resourceManager);
    });

    test('should start and stop server', async () => {
      expect(server.isRunning).toBe(false);

      await server.start();
      expect(server.isRunning).toBe(true);

      await server.stop();
      expect(server.isRunning).toBe(false);
    });

    test('should return server status', async () => {
      const status = server.getStatus();

      expect(status).toEqual({
        running: false,
        port: 8081,
        host: 'localhost',
        sessionMode: true,
        activeSessions: 0,
        activeConnections: 0,
        address: null
      });
    });

    test('should handle multiple start calls gracefully', async () => {
      await server.start();
      await server.start(); // Second start should be ignored

      expect(mockLogger.warn).toHaveBeenCalledWith('MCP server is already running');
    });
  });

  describe('ResourceManager integration', () => {
    test('should create MCPServer through ResourceManager factory', async () => {
      const config = { server: { port: 8082 } };
      const server = await resourceManager.getOrCreate('MCPServer', config);

      expect(server).toBeInstanceOf(MCPServer);
      expect(server.config.server.port).toBe(8082);
      expect(resourceManager.has('MCPServer')).toBe(true);
    });

    test('should enforce singleton behavior', async () => {
      const config1 = { server: { port: 8083 } };
      const config2 = { server: { port: 9999 } }; // Different config

      // First call creates the server
      const server1 = await resourceManager.getOrCreate('MCPServer', config1);
      
      // Second call should return the same instance without calling factory again
      const server2 = await resourceManager.getOrCreate('MCPServer', config2);

      expect(server1).toBe(server2); // Same instance
      expect(server1.config.server.port).toBe(8083); // Original config preserved
      
      // Verify factory was only called once (for first creation)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Creating new MCPServer instance', 
        expect.objectContaining({
          port: 8083,
          host: undefined,
          sessionMode: true,
          tools: []
        })
      );
      
      // Verify factory was not called twice
      expect(mockLogger.debug).toHaveBeenCalledTimes(7); // Total debug calls (creation + components)
    });
  });

  describe('MCPServerFactory functions', () => {
    test('createMCPServer should create and register server', async () => {
      const config = { server: { port: 8084 } };
      const server = await createMCPServer(config, resourceManager);

      expect(server).toBeInstanceOf(MCPServer);
      expect(resourceManager.has('MCPServer')).toBe(true);
      expect(resourceManager.get('MCPServer')).toBe(server);
    });

    test('getMCPServer should return existing server', async () => {
      const config = { server: { port: 8085 } };
      const originalServer = await createMCPServer(config, resourceManager);
      const retrievedServer = getMCPServer(resourceManager);

      expect(retrievedServer).toBe(originalServer);
    });

    test('getMCPServer should throw if no server exists', () => {
      expect(() => getMCPServer(resourceManager)).toThrow(
        'No MCPServer instance found. Call createMCPServer() first.'
      );
    });

    test('stopMCPServer should stop and unregister server', async () => {
      const config = { server: { port: 8086 } };
      const server = await createMCPServer(config, resourceManager);
      
      expect(resourceManager.has('MCPServer')).toBe(true);

      await stopMCPServer(resourceManager);

      expect(resourceManager.has('MCPServer')).toBeFalsy();
      expect(server.isRunning).toBe(false);
    });

    test('stopMCPServer should handle no server gracefully', async () => {
      // Should not throw
      await expect(stopMCPServer(resourceManager)).resolves.toBeUndefined();
    });
  });

  describe('createAiurMCPServer', () => {
    test('should create server with Aiur-specific defaults', async () => {
      const server = await createAiurMCPServer({}, resourceManager);

      expect(server).toBeInstanceOf(MCPServer);
      expect(server.config.session.enableSessionMode).toBe(true);
      expect(server.config.tools.enableContext).toBe(true);
      expect(server.config.tools.enablePlanning).toBe(true);
      expect(server.config.tools.enableFile).toBe(true);
      expect(server.config.logging.enableFile).toBe(true);
    });

    test('should respect environment variables', async () => {
      // Mock environment variables
      const originalEnv = process.env;
      process.env.AIUR_SERVER_PORT = '9000';
      process.env.AIUR_SERVER_HOST = '127.0.0.1';
      process.env.AIUR_SESSION_TIMEOUT = '7200000';

      try {
        const server = await createAiurMCPServer({}, resourceManager);

        expect(server.config.server.port).toBe(9000);
        expect(server.config.server.host).toBe('127.0.0.1');
        expect(server.config.session.timeout).toBe(7200000);
      } finally {
        process.env = originalEnv;
      }
    });

    test('should allow config overrides', async () => {
      const config = {
        server: { port: 8888 },
        session: { enableSessionMode: false },
        tools: { enableContext: false }
      };

      const server = await createAiurMCPServer(config, resourceManager);

      expect(server.config.server.port).toBe(8888);
      expect(server.config.session.enableSessionMode).toBe(false);
      expect(server.config.tools.enableContext).toBe(false);
    });
  });

  describe('Tool management', () => {
    let server;

    beforeEach(async () => {
      server = await MCPServer.create({}, resourceManager);
    });

    test('should handle addTool when request handler supports it', () => {
      // Mock request handler with addTool support
      server.requestHandler = {
        addTool: jest.fn()
      };

      const tool = { name: 'test_tool', description: 'Test tool' };
      server.addTool(tool);

      expect(server.requestHandler.addTool).toHaveBeenCalledWith(tool);
      expect(mockLogger.debug).toHaveBeenCalledWith('Added custom tool: test_tool');
    });

    test('should handle addTool when request handler does not support it', () => {
      // Mock request handler without addTool support
      server.requestHandler = {};

      const tool = { name: 'test_tool', description: 'Test tool' };
      server.addTool(tool);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot add tool: RequestHandler not available or does not support addTool'
      );
    });

    test('should get tools from request handler', () => {
      const mockTools = [{ name: 'tool1' }, { name: 'tool2' }];
      server.requestHandler = {
        getTools: jest.fn().mockReturnValue(mockTools)
      };

      const tools = server.getTools();
      expect(tools).toEqual(mockTools);
    });

    test('should return empty array when request handler does not support getTools', () => {
      server.requestHandler = {};
      const tools = server.getTools();
      expect(tools).toEqual([]);
    });
  });
});