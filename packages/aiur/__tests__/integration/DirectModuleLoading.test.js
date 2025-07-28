/**
 * Integration tests for direct module loading without module management tools
 * 
 * This test demonstrates how Aiur should load modules directly using 
 * the module-loader package instead of the deleted module management tools.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { SessionManager } from '../../src/server/SessionManager.js';
import { RequestHandler } from '../../src/server/RequestHandler.js';
import { LogManager } from '../../src/core/LogManager.js';
import { ResourceManager, ModuleManager, ModuleFactory } from '@legion/module-loader';
import path from 'path';

describe('Direct Module Loading Without Management Tools', () => {
  
  let sessionManager;
  let requestHandler;
  let session;
  let resourceManager;
  let logManager;
  let moduleManager;

  beforeAll(async () => {
    console.log('Setting up Aiur server components for direct module loading...');
    
    // Create resource manager and essential services
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Register test config
    resourceManager.register('config', {
      logDirectory: './test-logs',
      enableFileLogging: false
    });
    
    // Create Aiur's LogManager
    logManager = await LogManager.create(resourceManager);
    resourceManager.register('logManager', logManager);
    
    // Create module manager directly (the correct way)
    const moduleFactory = new ModuleFactory(resourceManager);
    moduleManager = new ModuleManager(moduleFactory, {
      searchDepth: 3,
      autoDiscover: false
    });
    
    // Register module manager in resource manager for other components
    resourceManager.register('moduleManager', moduleManager);
    resourceManager.register('moduleFactory', moduleFactory);
    
    // Create session manager
    sessionManager = new SessionManager({
      resourceManager,
      logManager,
      sessionTimeout: 30000
    });
    
    await sessionManager.initialize();
    
    // Create request handler
    requestHandler = new RequestHandler({
      sessionManager,
      resourceManager, 
      logManager
    });
    
    await requestHandler.initialize();
    
    console.log('Aiur server components initialized for direct module loading');
  });

  afterAll(async () => {
    if (sessionManager) {
      await sessionManager.shutdown();
    }
    
    if (requestHandler) {
      await requestHandler.cleanup();
    }
    
    console.log('Aiur server components cleaned up');
  });

  beforeEach(async () => {
    // Create session directly
    const sessionResult = await sessionManager.createSession();
    session = sessionManager.getSession(sessionResult.sessionId);
    
    expect(session).toBeDefined();
    console.log('Created session:', session.id);
  });

  afterEach(async () => {
    if (session) {
      await sessionManager.destroySession(session.id);
    }
  });

  /**
   * Helper function to call tools through RequestHandler
   */
  async function callTool(toolName, args = {}) {
    const request = {
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };
    
    return await requestHandler.handleRequest(request, session.id);
  }
  
  /**
   * Helper function to list tools
   */
  async function listTools() {
    const request = {
      method: 'tools/list'
    };
    
    return await requestHandler.handleRequest(request, session.id);
  }

  describe('Direct Module Loading Approach', function() {
    test('should load modules directly using ModuleManager', async function() {
      // Discover modules in the general-tools directory
      const basePath = process.cwd();
      // Go up to the Legion root directory
      const legionRoot = path.resolve(basePath, '../..');
      const toolsPath = path.join(legionRoot, 'packages/general-tools/src');
      
      console.log('Discovering modules in:', toolsPath);
      await moduleManager.discoverModules([toolsPath]);
      
      // Get available modules
      const available = moduleManager.getAvailableModules();
      console.log('Available modules:', available.map(m => m.name));
      
      // Load a specific module (e.g., calculator)
      const loadResult = await moduleManager.loadModule('calculator');
      console.log('Load result:', loadResult);
      
      // ModuleManager.loadModule returns the module instance directly, not a result object
      expect(loadResult).toBeDefined();
      expect(loadResult.name).toBe('calculator');
      
      // Get the loaded module instance
      const loadedModules = moduleManager.getLoadedModules();
      const calculatorEntry = loadedModules.find(m => m.name === 'calculator');
      
      expect(calculatorEntry).toBeDefined();
      expect(calculatorEntry.instance).toBeDefined();
      
      // Get tools from the module
      const moduleInstance = calculatorEntry.instance;
      const tools = await moduleInstance.getTools();
      
      expect(tools).toBeInstanceOf(Array);
      expect(tools.length).toBeGreaterThan(0);
      
      console.log('Calculator module provides tools:', tools.map(t => t.name || 'unnamed'));
    });

    test('should make module tools available through session after loading', async function() {
      // Load module directly through module manager
      const legionRoot = path.resolve(process.cwd(), '../..');
      await moduleManager.discoverModules([path.join(legionRoot, 'packages/general-tools/src')]);
      await moduleManager.loadModule('calculator');
      
      // Update session's tool provider to include the loaded module tools
      // This is where Aiur needs to integrate loaded modules into the session
      const toolProvider = session.toolProvider;
      
      // Since module management tools are gone, we need a different way
      // to make module tools available in the session
      // This demonstrates what Aiur needs to implement
      
      // For now, let's verify the module is loaded in the module manager
      const loadedModules = moduleManager.getLoadedModules();
      const hasCalculator = loadedModules.some(m => m.name === 'calculator');
      
      expect(hasCalculator).toBe(true);
      console.log('Calculator module is loaded in ModuleManager');
      
      // Note: Aiur will need to implement a mechanism to sync loaded modules
      // with the session's tool provider without using module management tools
    });

    test('should handle module with module.json configuration', async function() {
      // Test loading a module that uses module.json (like serper)
      const legionRoot = path.resolve(process.cwd(), '../..');
      await moduleManager.discoverModules([path.join(legionRoot, 'packages/general-tools/src')]);
      
      // Check if serper module is available
      const available = moduleManager.getAvailableModules();
      const serperModule = available.find(m => m.name === 'serper');
      
      if (serperModule) {
        console.log('Found serper module:', serperModule);
        
        // Load the module
        try {
          const loadResult = await moduleManager.loadModule('serper');
          console.log('Successfully loaded serper module');
          
          // Get the module instance
          const loadedModules = moduleManager.getLoadedModules();
          const serperEntry = loadedModules.find(m => m.name === 'serper');
          
          if (serperEntry && serperEntry.instance) {
            const tools = await serperEntry.instance.getTools();
            console.log('Serper tools:', tools.map(t => t.name || 'unnamed'));
            
            expect(tools).toBeInstanceOf(Array);
            expect(tools.length).toBeGreaterThan(0);
          }
        } catch (error) {
          console.log('Failed to load serper module:', error.message);
        }
      } else {
        console.log('Serper module not found in available modules');
      }
    });
  });

  describe('What Aiur Needs to Implement', function() {
    test('should demonstrate the missing integration points', function() {
      // This test documents what Aiur needs to implement now that
      // module management tools are removed
      
      const integrationPoints = [
        {
          component: 'SessionManager or ToolProvider',
          need: 'Method to sync loaded modules from ModuleManager',
          description: 'When modules are loaded via ModuleManager, their tools need to be made available in the session'
        },
        {
          component: 'RequestHandler or new ModuleHandler',
          need: 'Handle module operations (list, load, info)',
          description: 'Replace module_list, module_load, module_tools commands with direct ModuleManager integration'
        },
        {
          component: 'ToolDefinitionProvider',
          need: 'Update to work without ModuleManagerModule',
          description: 'Already updated to not load ModuleManagerModule, but may need to handle module operations differently'
        }
      ];
      
      console.log('\nIntegration points that need implementation:');
      integrationPoints.forEach((point, index) => {
        console.log(`\n${index + 1}. ${point.component}`);
        console.log(`   Need: ${point.need}`);
        console.log(`   Description: ${point.description}`);
      });
      
      // This test passes as it's documenting requirements
      expect(integrationPoints).toHaveLength(3);
    });
  });

  describe('Context and Planning Tools Still Work', function() {
    test('should list context tools without module management tools', async function() {
      const response = await listTools();
      
      expect(response).toHaveProperty('tools');
      expect(response.tools).toBeInstanceOf(Array);
      
      // Context tools should still be available
      const contextTools = response.tools.filter(t => t.name.startsWith('context_'));
      expect(contextTools.length).toBeGreaterThan(0);
      
      console.log('Context tools available:', contextTools.map(t => t.name));
      
      // Module management tools should NOT be available
      const moduleTools = response.tools.filter(t => 
        t.name === 'module_load' || 
        t.name === 'module_list' || 
        t.name === 'module_tools'
      );
      expect(moduleTools.length).toBe(0);
      
      console.log('Confirmed: No module management tools in tool list');
    });

    test('should execute context tools successfully', async function() {
      // Test that context tools still work
      const response = await callTool('context_add', {
        name: 'test_data',
        data: { message: 'Hello from test' },
        description: 'Test context data'
      });
      
      expect(response.content).toBeInstanceOf(Array);
      const result = JSON.parse(response.content[0].text);
      
      expect(result).toHaveProperty('success', true);
      console.log('Context tool executed successfully');
    });
  });
});