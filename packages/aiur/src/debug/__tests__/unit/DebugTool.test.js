/**
 * Unit tests for DebugTool MCP interface
 */

import { DebugTool } from '../../DebugTool.js';
import { mockResourceManager, createMockFn } from '../fixtures/mockData.js';
import { getSharedDebugTool, getSharedWebDebugServer } from '../fixtures/testSetup.js';

describe('DebugTool', () => {
  let debugTool;
  let mockWebDebugServer;
  let mockContextManager;
  let mockRM;

  beforeAll(async () => {
    // Get shared server instance to avoid excessive console logs
    await getSharedWebDebugServer();
  });

  beforeEach(async () => {
    // Mock WebDebugServer
    mockWebDebugServer = {
      start: createMockFn(),
      stop: createMockFn(),
      getServerInfo: createMockFn(),
      isRunning: false
    };

    // Mock ContextManager
    mockContextManager = {
      executeContextTool: createMockFn()
    };

    mockRM = {
      ...mockResourceManager,
      get: createMockFn().mockImplementation((key) => {
        switch (key) {
          case 'webDebugServer':
            return mockWebDebugServer;
          case 'contextManager':
            return mockContextManager;
          default:
            return mockResourceManager.get(key);
        }
      })
    };

    debugTool = await DebugTool.create(mockRM);
  });

  describe('constructor and factory method', () => {
    test('should create DebugTool instance via factory method', async () => {
      expect(debugTool).toBeInstanceOf(DebugTool);
      expect(debugTool.webDebugServer).toBe(mockWebDebugServer);
      expect(debugTool.contextManager).toBe(mockContextManager);
    });

    test('should call ResourceManager.get with correct keys', async () => {
      await DebugTool.create(mockRM);
      
      const calls = mockRM.get.mock.calls.map(call => call[0]);
      expect(calls).toContain('webDebugServer');
      expect(calls).toContain('contextManager');
    });
  });

  describe('MCP tool definition generation', () => {
    test('should return correct tool definitions', () => {
      const toolDefs = debugTool.getToolDefinitions();
      
      expect(toolDefs).toHaveLength(3);
      
      const toolNames = toolDefs.map(tool => tool.name);
      expect(toolNames).toContain('web_debug_start');
      expect(toolNames).toContain('web_debug_stop');
      expect(toolNames).toContain('web_debug_status');
    });

    test('should have correct web_debug_start tool definition', () => {
      const toolDefs = debugTool.getToolDefinitions();
      const startTool = toolDefs.find(tool => tool.name === 'web_debug_start');
      
      expect(startTool).toBeDefined();
      expect(startTool.description).toContain('Start web debugging interface');
      expect(startTool.inputSchema.type).toBe('object');
      expect(startTool.inputSchema.properties.port).toBeDefined();
      expect(startTool.inputSchema.properties.openBrowser).toBeDefined();
      expect(startTool.inputSchema.properties.host).toBeDefined();
    });

    test('should have correct web_debug_stop tool definition', () => {
      const toolDefs = debugTool.getToolDefinitions();
      const stopTool = toolDefs.find(tool => tool.name === 'web_debug_stop');
      
      expect(stopTool).toBeDefined();
      expect(stopTool.description).toContain('Stop web debugging interface');
      expect(stopTool.inputSchema.type).toBe('object');
    });

    test('should have correct web_debug_status tool definition', () => {
      const toolDefs = debugTool.getToolDefinitions();
      const statusTool = toolDefs.find(tool => tool.name === 'web_debug_status');
      
      expect(statusTool).toBeDefined();
      expect(statusTool.description).toContain('Get web debugging interface status');
      expect(statusTool.inputSchema.type).toBe('object');
    });

    test('should identify debug tools correctly', () => {
      expect(debugTool.isDebugTool('web_debug_start')).toBe(true);
      expect(debugTool.isDebugTool('web_debug_stop')).toBe(true);
      expect(debugTool.isDebugTool('web_debug_status')).toBe(true);
      expect(debugTool.isDebugTool('context_add')).toBe(false);
      expect(debugTool.isDebugTool('unknown_tool')).toBe(false);
    });
  });

  describe('web_debug_start tool implementation', () => {
    test('should start debug server with default options', async () => {
      const serverInfo = {
        serverId: 'test-server-123',
        port: 3001,
        url: 'http://localhost:3001',
        status: 'running',
        startedAt: new Date().toISOString()
      };

      mockWebDebugServer.start.mockResolvedValue(serverInfo);

      const result = await debugTool.executeDebugTool('web_debug_start', {});

      expect(mockWebDebugServer.start).toHaveBeenCalledWith({
        port: undefined,
        host: undefined,
        openBrowser: undefined
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.serverInfo).toEqual(serverInfo);
      expect(response.url).toBe('http://localhost:3001');
      expect(response.port).toBe(3001);
      expect(Array.isArray(response.instructions)).toBe(true);
    });

    test('should start debug server with custom options', async () => {
      const serverInfo = {
        serverId: 'test-server-456',
        port: 3002,
        url: 'http://localhost:3002',
        status: 'running',
        startedAt: new Date().toISOString()
      };

      mockWebDebugServer.start.mockResolvedValue(serverInfo);

      const result = await debugTool.executeDebugTool('web_debug_start', {
        port: 3002,
        host: 'localhost',
        openBrowser: false
      });

      expect(mockWebDebugServer.start).toHaveBeenCalledWith({
        port: 3002,
        host: 'localhost',
        openBrowser: false
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.port).toBe(3002);
    });

    test('should handle start server failure', async () => {
      mockWebDebugServer.start.mockRejectedValue(new Error('Port already in use'));

      const result = await debugTool.executeDebugTool('web_debug_start', {});

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('Port already in use');
    });

    test('should include helpful instructions in response', async () => {
      const serverInfo = {
        serverId: 'test-server-789',
        port: 3003,
        url: 'http://localhost:3003',
        status: 'running'
      };

      mockWebDebugServer.start.mockResolvedValue(serverInfo);

      const result = await debugTool.executeDebugTool('web_debug_start', {});
      const response = JSON.parse(result.content[0].text);

      expect(response.instructions).toContain('Debug interface is running at http://localhost:3003');
      expect(response.instructions).toContain('Use the web interface to execute tools, view context, and monitor events');
      expect(response.instructions).toContain("Server information has been saved to context as 'debug_server'");
    });
  });

  describe('web_debug_stop tool implementation', () => {
    test('should stop debug server successfully', async () => {
      mockWebDebugServer.stop.mockResolvedValue();
      mockContextManager.executeContextTool.mockResolvedValue({
        content: [{ type: "text", text: '{"success": true}' }],
        isError: false
      });

      const result = await debugTool.executeDebugTool('web_debug_stop', {});

      expect(mockWebDebugServer.stop).toHaveBeenCalled();
      // Check that context tool was called with correct parameters
      const contextCalls = mockContextManager.executeContextTool.mock.calls;
      expect(contextCalls.length).toBe(1);
      const [toolName, args] = contextCalls[0];
      expect(toolName).toBe('context_add');
      expect(args.name).toBe('debug_server');
      expect(args.data.status).toBe('stopped');
      expect(typeof args.data.stoppedAt).toBe('string');
      expect(args.description).toBe('Web debug interface server information (stopped)');

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.message).toContain('stopped successfully');
    });

    test('should handle stop server failure', async () => {
      mockWebDebugServer.stop.mockRejectedValue(new Error('Server not running'));

      const result = await debugTool.executeDebugTool('web_debug_stop', {});

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('Server not running');
    });

    test('should continue even if context update fails', async () => {
      mockWebDebugServer.stop.mockResolvedValue();
      mockContextManager.executeContextTool.mockRejectedValue(new Error('Context error'));

      const result = await debugTool.executeDebugTool('web_debug_stop', {});

      expect(result.isError).toBe(false);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });
  });

  describe('web_debug_status tool implementation', () => {
    test('should return status for running server', async () => {
      const serverInfo = {
        serverId: 'test-server-abc',
        port: 3001,
        url: 'http://localhost:3001',
        status: 'running',
        startedAt: '2024-01-15T10:30:00.000Z',
        connectedClients: 2,
        version: '1.0.0'
      };

      mockWebDebugServer.getServerInfo.mockReturnValue(serverInfo);

      const result = await debugTool.executeDebugTool('web_debug_status', {});

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.status.serverId).toBe('test-server-abc');
      expect(response.status.status).toBe('running');
      expect(response.status.capabilities).toContain('real-time-monitoring');
      expect(response.status.capabilities).toContain('tool-execution');
      expect(response.status.systemInfo).toBeDefined();
      expect(response.status.systemInfo.nodeVersion).toBeDefined();
      expect(response.status.systemInfo.platform).toBeDefined();

      expect(response.instructions).toContain('Access debug interface at http://localhost:3001');
      expect(response.instructions).toContain('2 client(s) currently connected');
    });

    test('should return status for stopped server', async () => {
      const serverInfo = {
        serverId: 'test-server-def',
        port: null,
        url: null,
        status: 'stopped',
        startedAt: null,
        connectedClients: 0,
        version: '1.0.0'
      };

      mockWebDebugServer.getServerInfo.mockReturnValue(serverInfo);

      const result = await debugTool.executeDebugTool('web_debug_status', {});

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.status.status).toBe('stopped');
      
      expect(response.instructions).toContain('Debug interface is not running');
      expect(response.instructions).toContain('Use web_debug_start to start the interface');
    });

    test('should include system information', async () => {
      const serverInfo = {
        serverId: 'test-server-xyz',
        status: 'running',
        port: 3001,
        connectedClients: 0
      };

      mockWebDebugServer.getServerInfo.mockReturnValue(serverInfo);

      const result = await debugTool.executeDebugTool('web_debug_status', {});
      const response = JSON.parse(result.content[0].text);

      expect(response.status.systemInfo).toBeDefined();
      expect(response.status.systemInfo.nodeVersion).toBe(process.version);
      expect(response.status.systemInfo.platform).toBe(process.platform);
      expect(typeof response.status.systemInfo.uptime).toBe('number');
      expect(response.status.systemInfo.memoryUsage).toBeDefined();
    });

    test('should include comprehensive capabilities list', async () => {
      mockWebDebugServer.getServerInfo.mockReturnValue({ status: 'running' });

      const result = await debugTool.executeDebugTool('web_debug_status', {});
      const response = JSON.parse(result.content[0].text);

      const expectedCapabilities = [
        'real-time-monitoring',
        'tool-execution',
        'context-management',
        'event-streaming',
        'log-viewing'
      ];

      expectedCapabilities.forEach(capability => {
        expect(response.status.capabilities).toContain(capability);
      });
    });
  });

  describe('error handling', () => {
    test('should handle unknown debug tool', async () => {
      const result = await debugTool.executeDebugTool('unknown_debug_tool', {});

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('Unknown debug tool');
    });

    test('should format all errors consistently', async () => {
      mockWebDebugServer.start.mockRejectedValue(new Error('Test error'));

      const result = await debugTool.executeDebugTool('web_debug_start', {});

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    test('should handle JSON parsing errors gracefully', async () => {
      // Mock a scenario where server info has circular references
      const circularObj = {};
      circularObj.self = circularObj;
      mockWebDebugServer.getServerInfo.mockReturnValue(circularObj);

      const result = await debugTool.executeDebugTool('web_debug_status', {});

      // Should still return a valid response even if JSON stringification fails
      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);
    });
  });

  describe('tool execution routing', () => {
    test('should route to correct tool implementation', async () => {
      mockWebDebugServer.start.mockResolvedValue({ status: 'running' });
      mockWebDebugServer.stop.mockResolvedValue();
      mockWebDebugServer.getServerInfo.mockReturnValue({ status: 'stopped' });

      // Test all tool routes
      await debugTool.executeDebugTool('web_debug_start', {});
      expect(mockWebDebugServer.start).toHaveBeenCalled();

      await debugTool.executeDebugTool('web_debug_stop', {});
      expect(mockWebDebugServer.stop).toHaveBeenCalled();

      await debugTool.executeDebugTool('web_debug_status', {});
      expect(mockWebDebugServer.getServerInfo).toHaveBeenCalled();
    });

    test('should pass arguments correctly to implementations', async () => {
      mockWebDebugServer.start.mockResolvedValue({ status: 'running' });

      const args = { port: 3005, host: '0.0.0.0', openBrowser: false };
      await debugTool.executeDebugTool('web_debug_start', args);

      expect(mockWebDebugServer.start).toHaveBeenCalledWith(args);
    });
  });
});

