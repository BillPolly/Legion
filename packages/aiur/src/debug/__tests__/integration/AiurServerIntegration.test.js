/**
 * Integration tests for DebugTool with Aiur MCP Server
 */

import { ToolDefinitionProvider } from '../../../core/ToolDefinitionProvider.js';
import { DebugTool } from '../../DebugTool.js';
import { WebDebugServer } from '../../WebDebugServer.js';
import { HandleRegistry } from '../../../handles/HandleRegistry.js';
import { HandleResolver } from '../../../handles/HandleResolver.js';
import { ToolRegistry } from '../../../tools/ToolRegistry.js';
import { getSharedWebDebugServer, waitForAsync } from '../fixtures/testSetup.js';

describe('Aiur Server Integration', () => {
  let resourceManager;
  let toolDefinitionProvider;
  let debugTool;
  let webDebugServer;

  beforeAll(async () => {
    // Create ResourceManager similar to Aiur server
    resourceManager = {
      resources: new Map(),
      
      get(key) {
        const value = this.resources.get(key);
        if (!value) throw new Error(`Resource '${key}' not found`);
        return value;
      },
      
      register(key, value) {
        this.resources.set(key, value);
      }
    };

    // Initialize core Aiur systems
    const handleRegistry = new HandleRegistry();
    const toolRegistry = new ToolRegistry(handleRegistry);
    const handleResolver = new HandleResolver(handleRegistry);

    // Register systems in ResourceManager
    resourceManager.register('handleRegistry', handleRegistry);
    resourceManager.register('toolRegistry', toolRegistry);
    resourceManager.register('handleResolver', handleResolver);

    // Create and initialize ToolDefinitionProvider
    toolDefinitionProvider = await ToolDefinitionProvider.create(resourceManager);
    await toolDefinitionProvider.initialize();

    // Register ToolDefinitionProvider and its contextManager first
    resourceManager.register('toolDefinitionProvider', toolDefinitionProvider);
    resourceManager.register('contextManager', toolDefinitionProvider.contextManager);
    
    // Create mock monitoring system if it doesn't exist
    const monitoringSystem = {
      on: () => {},
      recordMetric: () => {},
      getDashboardData: () => ({ systemHealth: { score: 95 } })
    };
    resourceManager.register('monitoringSystem', monitoringSystem);

    // Now create WebDebugServer with all dependencies available
    webDebugServer = await WebDebugServer.create(resourceManager);
    resourceManager.register('webDebugServer', webDebugServer);

    // Create and register DebugTool to extend the ToolDefinitionProvider
    debugTool = await DebugTool.create(resourceManager);
    
    // Add debug tools to the provider's tool list
    const debugToolDefinitions = debugTool.getToolDefinitions();
    toolDefinitionProvider._debugTools = debugToolDefinitions;
    toolDefinitionProvider.setDebugTool(debugTool);
  });

  afterAll(async () => {
    if (webDebugServer && webDebugServer.isRunning) {
      await webDebugServer.stop();
    }
  });

  describe('DebugTool integration with ToolDefinitionProvider', () => {
    test('should be registered in tool definitions', () => {
      const allTools = toolDefinitionProvider.getAllToolDefinitions();
      const debugToolNames = ['web_debug_start', 'web_debug_stop', 'web_debug_status'];
      
      debugToolNames.forEach(toolName => {
        const toolDef = allTools.find(tool => tool.name === toolName);
        expect(toolDef).toBeDefined();
        expect(toolDef.name).toBe(toolName);
        expect(toolDef.description).toBeDefined();
        expect(toolDef.inputSchema).toBeDefined();
      });
    });

    test('should execute debug tools through ToolDefinitionProvider', async () => {
      // Test web_debug_status
      const statusResult = await toolDefinitionProvider.executeTool('web_debug_status', {});
      
      expect(statusResult.isError).toBe(false);
      expect(statusResult.content).toHaveLength(1);
      expect(statusResult.content[0].type).toBe('text');
      
      const statusData = JSON.parse(statusResult.content[0].text);
      expect(statusData.success).toBe(true);
      expect(statusData.status).toBeDefined();
      expect(statusData.status.serverId).toBeDefined();
    });

    test('should start debug server through ToolDefinitionProvider', async () => {
      const startResult = await toolDefinitionProvider.executeTool('web_debug_start', {
        port: 3005,
        openBrowser: false
      });
      
      expect(startResult.isError).toBe(false);
      const startData = JSON.parse(startResult.content[0].text);
      expect(startData.success).toBe(true);
      expect(startData.port).toBe(3005);
      expect(startData.url).toContain('3005');

      // Verify server is actually running
      expect(webDebugServer.isRunning).toBe(true);
      expect(webDebugServer.port).toBe(3005);

      // Stop the server
      const stopResult = await toolDefinitionProvider.executeTool('web_debug_stop', {});
      expect(stopResult.isError).toBe(false);
      
      await waitForAsync(100); // Allow server to stop
      expect(webDebugServer.isRunning).toBe(false);
    });

    test('should handle tool execution through MCP flow', async () => {
      // This simulates the full MCP server request flow
      const toolExists = toolDefinitionProvider.toolExists('web_debug_status');
      expect(toolExists).toBe(true);

      // Execute tool as MCP server would
      const result = await toolDefinitionProvider.executeTool('web_debug_status', {});
      
      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe('text');
      
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.status.capabilities).toContain('real-time-monitoring');
    });
  });

  describe('WebDebugServer integration with Aiur systems', () => {
    beforeEach(async () => {
      if (!webDebugServer.isRunning) {
        await webDebugServer.start({ openBrowser: false });
      }
    });

    afterEach(async () => {
      if (webDebugServer.isRunning) {
        await webDebugServer.stop();
      }
    });

    test('should have access to all Aiur systems', () => {
      expect(webDebugServer.contextManager).toBeDefined();
      expect(webDebugServer.toolDefinitionProvider).toBeDefined();
      expect(webDebugServer.monitoringSystem).toBeDefined();
    });

    test('should serve web interface with server information', async () => {
      const serverInfo = webDebugServer.getServerInfo();
      
      expect(serverInfo.serverId).toBeDefined();
      expect(serverInfo.port).toBeDefined();
      expect(serverInfo.url).toBeDefined();
      expect(serverInfo.status).toBe('running');
      expect(serverInfo.version).toBe('1.0.0');
    });

    test('should provide tool statistics', () => {
      const stats = webDebugServer.toolDefinitionProvider.getToolStatistics();
      
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.context).toBeGreaterThan(0);
      expect(stats.modules).toBeGreaterThan(0);
      expect(stats.loadedModules).toBeGreaterThan(0);
    });

    test('should list all available tools', () => {
      const tools = webDebugServer.toolDefinitionProvider.getAllToolDefinitions();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // Should include context tools
      const contextTools = tools.filter(tool => tool.name.startsWith('context_'));
      expect(contextTools.length).toBeGreaterThan(0);
      
      // Should include debug tools
      const debugTools = tools.filter(tool => tool.name.startsWith('web_debug_'));
      expect(debugTools.length).toBe(3); // start, stop, status
    });
  });

  describe('ResourceManager pattern compliance', () => {
    test('should follow Async Resource Manager pattern', async () => {
      // Verify all components follow the pattern
      expect(typeof DebugTool.create).toBe('function');
      expect(typeof WebDebugServer.create).toBe('function');
      expect(typeof ToolDefinitionProvider.create).toBe('function');
      
      // Verify they accept ResourceManager
      const testRM = {
        get: () => ({}),
        register: () => {}
      };
      
      // Should not throw when creating with proper ResourceManager
      expect(async () => {
        await DebugTool.create(resourceManager);
      }).not.toThrow();
    });

    test('should properly inject dependencies through ResourceManager', () => {
      // Verify dependencies are properly injected
      expect(debugTool.webDebugServer).toBe(webDebugServer);
      expect(debugTool.contextManager).toBe(toolDefinitionProvider.contextManager);
      
      expect(webDebugServer.contextManager).toBe(toolDefinitionProvider.contextManager);
      expect(webDebugServer.toolDefinitionProvider).toBe(toolDefinitionProvider);
    });

    test('should handle missing dependencies gracefully', async () => {
      const incompleteRM = {
        resources: new Map(),
        get(key) {
          throw new Error(`Resource '${key}' not found`);
        },
        register(key, value) {
          this.resources.set(key, value);
        }
      };

      await expect(DebugTool.create(incompleteRM)).rejects.toThrow();
      await expect(WebDebugServer.create(incompleteRM)).rejects.toThrow();
    });
  });

  describe('Context integration', () => {
    test('should store debug server info in context', async () => {
      // Start server to trigger context storage
      await toolDefinitionProvider.executeTool('web_debug_start', {
        openBrowser: false
      });

      // The server should have stored its info in context
      const contextResult = await toolDefinitionProvider.executeTool('context_get', {
        name: 'debug_server'
      });

      expect(contextResult.isError).toBe(false);
      const contextData = JSON.parse(contextResult.content[0].text);
      expect(contextData.success).toBe(true);
      expect(contextData.data.serverId).toBeDefined();
      expect(contextData.data.port).toBeDefined();

      // Clean up
      await toolDefinitionProvider.executeTool('web_debug_stop', {});
    });

    test('should handle context operations through web interface', async () => {
      // Add test context
      const addResult = await toolDefinitionProvider.executeTool('context_add', {
        name: 'test_debug_context',
        data: { test: 'debug_integration', value: 42 },
        description: 'Test context for debug integration'
      });

      expect(addResult.isError).toBe(false);

      // List contexts to verify it was added
      const listResult = await toolDefinitionProvider.executeTool('context_list', {});
      expect(listResult.isError).toBe(false);
      
      const listData = JSON.parse(listResult.content[0].text);
      expect(listData.success).toBe(true);
      
      const testContext = listData.contexts.find(ctx => ctx.name === 'test_debug_context');
      expect(testContext).toBeDefined();
      expect(testContext.data.test).toBe('debug_integration');
    });
  });

  describe('Error handling and resilience', () => {
    test('should handle invalid tool execution gracefully', async () => {
      const result = await toolDefinitionProvider.executeTool('nonexistent_tool', {});
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool');
    });

    test('should handle debug tool errors gracefully', async () => {
      // Try to start server on an invalid port
      const result = await toolDefinitionProvider.executeTool('web_debug_start', {
        port: 'invalid_port'
      });

      // Should handle error gracefully
      expect(result.isError).toBe(true);
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(false);
      expect(resultData.error).toBeDefined();
    });

    test('should handle server lifecycle errors', async () => {
      // Try to stop server when it's not running
      const stopResult = await toolDefinitionProvider.executeTool('web_debug_stop', {});
      
      // Should not error, but indicate server wasn't running
      expect(stopResult.isError).toBe(false);
      const stopData = JSON.parse(stopResult.content[0].text);
      expect(stopData.success).toBe(true);
    });
  });

  describe('Tool statistics and monitoring', () => {
    test('should provide accurate tool statistics', () => {
      const stats = toolDefinitionProvider.getToolStatistics();
      
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.context).toBeGreaterThan(0);
      expect(stats.modules).toBeGreaterThan(0);
      expect(typeof stats.loadedModules).toBe('number');
      
      // Debug tools should be included in the count
      const allTools = toolDefinitionProvider.getAllToolDefinitions();
      expect(allTools.length).toBe(stats.total);
    });

    test('should identify debug tools correctly', () => {
      expect(debugTool.isDebugTool('web_debug_start')).toBe(true);
      expect(debugTool.isDebugTool('web_debug_stop')).toBe(true);
      expect(debugTool.isDebugTool('web_debug_status')).toBe(true);
      expect(debugTool.isDebugTool('context_add')).toBe(false);
      expect(debugTool.isDebugTool('plan_execute')).toBe(false);
    });

    test('should provide comprehensive tool definitions', () => {
      const debugToolDefs = debugTool.getToolDefinitions();
      
      expect(debugToolDefs).toHaveLength(3);
      
      debugToolDefs.forEach(toolDef => {
        expect(toolDef.name).toBeDefined();
        expect(toolDef.description).toBeDefined();
        expect(toolDef.inputSchema).toBeDefined();
        expect(toolDef.inputSchema.type).toBe('object');
        expect(toolDef.inputSchema.properties).toBeDefined();
      });
    });
  });
});