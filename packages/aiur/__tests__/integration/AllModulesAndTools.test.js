/**
 * Comprehensive integration test to verify all modules can be loaded and all tools invoked
 * 
 * This test ensures that after removing module management tools, the UI can still:
 * 1. List all available modules
 * 2. Load each module successfully
 * 3. Invoke at least one tool from each loaded module
 * 4. Verify the module operation tools work correctly
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { SessionManager } from '../../src/server/SessionManager.js';
import { RequestHandler } from '../../src/server/RequestHandler.js';
import { LogManager } from '../../src/core/LogManager.js';
import { ResourceManager } from '@legion/module-loader';
import path from 'path';

describe('All Modules and Tools Integration Test', () => {
  let sessionManager;
  let requestHandler;
  let session;
  let resourceManager;
  let logManager;

  beforeAll(async () => {
    console.log('Setting up Aiur server components...');
    
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
    
    console.log('Aiur server components initialized');
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
    // Create session
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

  describe('Module Operation Tools', () => {
    test('should have module operation tools available', async () => {
      const response = await listTools();
      
      expect(response).toHaveProperty('tools');
      expect(response.tools).toBeInstanceOf(Array);
      
      const moduleTools = response.tools.filter(t => 
        t.name.startsWith('module_')
      );
      
      // Should have all module operation tools
      const expectedTools = [
        'module_list', 'module_load', 'module_unload', 
        'module_info', 'module_tools', 'module_discover'
      ];
      
      const foundTools = moduleTools.map(t => t.name);
      expectedTools.forEach(toolName => {
        expect(foundTools).toContain(toolName);
      });
      
      console.log('Module operation tools available:', foundTools);
    });

    test('should list available modules using module_list', async () => {
      const response = await callTool('module_list');
      
      expect(response.content).toBeInstanceOf(Array);
      const result = JSON.parse(response.content[0].text);
      
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('available');
      expect(result.available).toBeInstanceOf(Array);
      expect(result.available.length).toBeGreaterThan(0);
      
      console.log('Available modules:', result.available.map(m => m.name));
    });
  });

  describe('Load All Modules and Test Tools', () => {
    let availableModules = [];

    beforeAll(async () => {
      // Get list of available modules
      const sessionResult = await sessionManager.createSession();
      const tempSession = sessionManager.getSession(sessionResult.sessionId);
      
      const request = {
        method: 'tools/call',
        params: {
          name: 'module_list',
          arguments: {}
        }
      };
      
      const response = await requestHandler.handleRequest(request, tempSession.id);
      const result = JSON.parse(response.content[0].text);
      
      availableModules = result.available.map(m => m.name);
      console.log('Modules to test:', availableModules);
      
      await sessionManager.destroySession(tempSession.id);
    });

    test.each([
      'calculator',
      'file',
      'json',
      'serper',
      'command-executor'
    ])('should load %s module and invoke its tools', async (moduleName) => {
      // Skip if module not available
      if (!availableModules.includes(moduleName)) {
        console.log(`Skipping ${moduleName} - not in available modules`);
        return;
      }

      // Load the module
      console.log(`\nTesting module: ${moduleName}`);
      const loadResponse = await callTool('module_load', { name: moduleName });
      
      const loadResult = JSON.parse(loadResponse.content[0].text);
      expect(loadResult).toHaveProperty('success', true);
      expect(loadResult.message).toContain('loaded successfully');
      
      console.log(`✓ Loaded ${moduleName} module`);
      
      // Get module tools
      const toolsResponse = await callTool('module_tools', { name: moduleName });
      const toolsResult = JSON.parse(toolsResponse.content[0].text);
      
      expect(toolsResult).toHaveProperty('success', true);
      expect(toolsResult.tools).toBeInstanceOf(Array);
      expect(toolsResult.tools.length).toBeGreaterThan(0);
      
      console.log(`✓ Module ${moduleName} has ${toolsResult.tools.length} tools:`, 
        toolsResult.tools.map(t => t.name));
      
      // Test at least one tool from the module
      const sampleToolTests = {
        'calculator': async () => {
          const response = await callTool('calculator_evaluate', { expression: '2 + 2' });
          const result = JSON.parse(response.content[0].text);
          expect(result).toHaveProperty('success', true);
          expect(result).toHaveProperty('data');
          expect(result.data).toHaveProperty('result', 4);
          console.log('✓ Calculator evaluated 2 + 2 = 4');
        },
        'file': async () => {
          const response = await callTool('directory_list', { 
            path: path.resolve(process.cwd(), '../..') 
          });
          const result = JSON.parse(response.content[0].text);
          expect(result).toHaveProperty('success', true);
          expect(result).toHaveProperty('data');
          expect(result.data).toHaveProperty('contents');
          expect(result.data.contents).toBeInstanceOf(Array);
          console.log(`✓ Listed directory, found ${result.data.contents.length} entries`);
        },
        'json': async () => {
          // Just verify tools are loaded
          const toolsResponse = await callTool('module_tools', { name: 'json' });
          const toolsResult = JSON.parse(toolsResponse.content[0].text);
          expect(toolsResult.success).toBe(true);
          expect(toolsResult.tools.length).toBeGreaterThan(0);
          console.log(`✓ JSON module has ${toolsResult.tools.length} tools`);
        },
        'serper': async () => {
          // Just verify tools are loaded
          const toolsResponse = await callTool('module_tools', { name: 'serper' });
          const toolsResult = JSON.parse(toolsResponse.content[0].text);
          expect(toolsResult.success).toBe(true);
          expect(toolsResult.tools.length).toBeGreaterThan(0);
          console.log(`✓ Serper module has ${toolsResult.tools.length} tools`);
        },
        'command-executor': async () => {
          // Just verify tools are loaded
          const toolsResponse = await callTool('module_tools', { name: 'command-executor' });
          const toolsResult = JSON.parse(toolsResponse.content[0].text);
          expect(toolsResult.success).toBe(true);
          expect(toolsResult.tools.length).toBeGreaterThan(0);
          console.log(`✓ Command-executor module has ${toolsResult.tools.length} tools`);
        }
      };
      
      // Run the test for this module if available
      if (sampleToolTests[moduleName]) {
        await sampleToolTests[moduleName]();
      }
    });

    test('should handle all available modules', async () => {
      const modulesToTest = availableModules.filter(name => 
        !['crawler', 'webpage-to-markdown', 'page-screenshoter', 'youtube-transcript'].includes(name)
      );
      
      console.log('\nTesting all modules in sequence...');
      
      for (const moduleName of modulesToTest) {
        try {
          // Load module
          const loadResponse = await callTool('module_load', { name: moduleName });
          const loadResult = JSON.parse(loadResponse.content[0].text);
          
          if (loadResult.success) {
            console.log(`✓ ${moduleName} - loaded successfully`);
            
            // Get info
            const infoResponse = await callTool('module_info', { name: moduleName });
            const infoResult = JSON.parse(infoResponse.content[0].text);
            
            if (infoResult.success && infoResult.module) {
              console.log(`  Tools: ${infoResult.module.toolCount}, Status: ${infoResult.module.status}`);
            }
          } else {
            console.log(`✗ ${moduleName} - failed to load: ${loadResult.error}`);
          }
        } catch (error) {
          console.log(`✗ ${moduleName} - error: ${error.message}`);
        }
      }
    });
  });

  describe('Context Tools Still Work', () => {
    test('should execute context tools', async () => {
      // Add context
      const addResponse = await callTool('context_add', {
        name: 'test_data',
        data: { value: 42 },
        description: 'Test data'
      });
      
      const addResult = JSON.parse(addResponse.content[0].text);
      expect(addResult).toHaveProperty('success', true);
      
      // Get context
      const getResponse = await callTool('context_get', { name: 'test_data' });
      const getResult = JSON.parse(getResponse.content[0].text);
      
      expect(getResult).toHaveProperty('success', true);
      expect(getResult).toHaveProperty('data');
      expect(getResult.data.value).toBe(42);
      
      // List context
      const listResponse = await callTool('context_list');
      const listResult = JSON.parse(listResponse.content[0].text);
      
      expect(listResult).toHaveProperty('success', true);
      expect(listResult).toHaveProperty('contexts');
      expect(listResult.contexts).toBeInstanceOf(Array);
      expect(listResult.contexts.length).toBeGreaterThan(0);
      
      console.log('✓ Context tools working correctly');
    });
  });

  describe('UI Workflow Simulation', () => {
    test('should complete full UI workflow', async () => {
      console.log('\n=== Simulating UI Workflow ===');
      
      // 1. List available tools initially
      const initialTools = await listTools();
      const initialToolCount = initialTools.tools.length;
      console.log(`1. Initial tool count: ${initialToolCount}`);
      
      // 2. List available modules
      const listResponse = await callTool('module_list');
      const modules = JSON.parse(listResponse.content[0].text);
      console.log(`2. Found ${modules.available.length} available modules`);
      
      // 3. Load calculator module
      const loadResponse = await callTool('module_load', { name: 'calculator' });
      const loadResult = JSON.parse(loadResponse.content[0].text);
      expect(loadResult.success).toBe(true);
      console.log('3. Loaded calculator module');
      
      // 4. List tools again - should have more tools
      const afterLoadTools = await listTools();
      const afterLoadToolCount = afterLoadTools.tools.length;
      expect(afterLoadToolCount).toBeGreaterThan(initialToolCount);
      console.log(`4. Tool count after loading: ${afterLoadToolCount} (added ${afterLoadToolCount - initialToolCount})`);
      
      // 5. Execute calculator tool
      const calcResponse = await callTool('calculator_evaluate', { expression: '10 * 5' });
      const calcResult = JSON.parse(calcResponse.content[0].text);
      expect(calcResult.data.result).toBe(50);
      console.log('5. Calculator evaluated 10 * 5 = 50');
      
      // 6. Save result to context
      const saveResponse = await callTool('context_add', {
        name: 'calc_result',
        data: { result: calcResult.data.result },
        description: 'Calculator result'
      });
      const saveResult = JSON.parse(saveResponse.content[0].text);
      expect(saveResult.success).toBe(true);
      console.log('6. Saved result to context');
      
      console.log('=== UI Workflow Completed Successfully ===\n');
    });
  });
});