/**
 * Integration tests for module discovery and tool execution
 * Tests that all modules can be loaded and their tools can be exercised
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager, ModuleFactory } from '@legion/tools';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Module Discovery and Tool Execution', () => {
  let resourceManager;
  let moduleFactory;
  let discoveredModules = [];
  
  // Helper function to load a module
  const loadModule = async (moduleInfo) => {
    const moduleJsonPath = path.join(moduleInfo.path, 'module.json');
    return await moduleFactory.createJsonModule(moduleJsonPath);
  };

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create ModuleFactory
    moduleFactory = new ModuleFactory(resourceManager);

    // Discover all modules in the src directory
    const srcDir = path.join(__dirname, '../../src');
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const modulePath = path.join(srcDir, entry.name);
        const moduleJsonPath = path.join(modulePath, 'module.json');
        
        try {
          await fs.access(moduleJsonPath);
          const moduleConfig = JSON.parse(await fs.readFile(moduleJsonPath, 'utf8'));
          discoveredModules.push({
            name: entry.name,
            path: modulePath,
            config: moduleConfig
          });
        } catch (error) {
          // Skip directories without module.json
          console.log(`Skipping ${entry.name} - no module.json found`);
        }
      }
    }

    console.log(`Discovered ${discoveredModules.length} modules:`, discoveredModules.map(m => m.name));
  });

  afterAll(async () => {
    // Cleanup any resources
    if (resourceManager) {
      // Add cleanup if ResourceManager has cleanup methods
    }
  });

  describe('Module Discovery', () => {
    test('should discover modules with module.json files', () => {
      expect(discoveredModules.length).toBeGreaterThan(0);
      
      // Check that we found some expected modules
      const moduleNames = discoveredModules.map(m => m.name);
      expect(moduleNames).toContain('lodash');
      expect(moduleNames).toContain('moment');
      expect(moduleNames).toContain('serper');
      expect(moduleNames).toContain('crawler');
    });

    test('each discovered module should have valid configuration', () => {
      for (const module of discoveredModules) {
        expect(module.config).toHaveProperty('name');
        expect(module.config).toHaveProperty('description');
        expect(module.config).toHaveProperty('tools');
        expect(Array.isArray(module.config.tools)).toBe(true);
        expect(module.config.tools.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Module Loading', () => {
    test('should load all discovered modules', async () => {
      for (const moduleInfo of discoveredModules) {
        try {
          const loadedModule = await loadModule(moduleInfo);
          
          expect(loadedModule).toBeDefined();
          expect(loadedModule.name).toBe(moduleInfo.config.name);
          expect(loadedModule.config.description).toBe(moduleInfo.config.description);
          
          // Check that tools are properly loaded
          const tools = await loadedModule.getTools();
          expect(Array.isArray(tools)).toBe(true);
          expect(tools.length).toBe(moduleInfo.config.tools.length);
          
          // Each tool should have required properties
          for (const tool of tools) {
            expect(tool).toHaveProperty('name');
            expect(tool).toHaveProperty('description');
            expect(typeof tool.getToolDescription).toBe('function');
            
            const toolDesc = tool.getToolDescription();
            expect(toolDesc).toHaveProperty('type', 'function');
            expect(toolDesc).toHaveProperty('function');
            expect(toolDesc.function).toHaveProperty('name');
            expect(toolDesc.function).toHaveProperty('description');
            expect(toolDesc.function).toHaveProperty('parameters');
          }
        } catch (error) {
          console.error(`Failed to load module ${moduleInfo.name}:`, error);
          throw error;
        }
      }
    });
  });

  describe('Tool Execution - Safe Tools', () => {
    // Test safe tools that don't require external dependencies or API keys
    
    test('lodash tools should execute successfully', async () => {
      const lodashModule = discoveredModules.find(m => m.name === 'lodash');
      if (!lodashModule) {
        console.log('Lodash module not found, skipping test');
        return;
      }

      const loadedModule = await loadModule(lodashModule);
      const tools = await loadedModule.getTools();
      
      // Test array_chunk tool
      const chunkTool = tools.find(t => t.name === 'array_chunk');
      if (chunkTool) {
        const result = await chunkTool.invoke({
          function: {
            name: 'array_chunk',
            arguments: JSON.stringify({
              array: [1, 2, 3, 4, 5, 6],
              size: 2
            })
          }
        });
        
        expect(result.success).toBe(true);
        expect(result.data).toEqual([[1, 2], [3, 4], [5, 6]]);
      }

      // Test string_camelcase tool
      const camelTool = tools.find(t => t.name === 'string_camelcase');
      if (camelTool) {
        const result = await camelTool.invoke({
          function: {
            name: 'string_camelcase',
            arguments: JSON.stringify({
              string: 'hello world test'
            })
          }
        });
        
        expect(result.success).toBe(true);
        expect(result.data).toBe('helloWorldTest');
      }
    });

    test('moment tools should execute successfully', async () => {
      const momentModule = discoveredModules.find(m => m.name === 'moment');
      if (!momentModule) {
        console.log('Moment module not found, skipping test');
        return;
      }

      const loadedModule = await loadModule(momentModule);
      const tools = await loadedModule.getTools();
      
      // Test format_date tool
      const formatTool = tools.find(t => t.name === 'format_date');
      if (formatTool) {
        const result = await formatTool.invoke({
          function: {
            name: 'format_date',
            arguments: JSON.stringify({
              date: '2023-12-25',
              format: 'YYYY-MM-DD'
            })
          }
        });
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('formatted');
        expect(result.data.formatted).toBe('2023-12-25');
      }

      // Test is_valid_date tool
      const validTool = tools.find(t => t.name === 'is_valid_date');
      if (validTool) {
        const result = await validTool.invoke({
          function: {
            name: 'is_valid_date',
            arguments: JSON.stringify({
              date: '2023-12-25'
            })
          }
        });
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('isValid');
        expect(result.data.isValid).toBe(true);
      }
    });
  });

  describe('Tool Execution - Command Executor', () => {
    test('command executor should handle safe commands', async () => {
      const commandModule = discoveredModules.find(m => m.name === 'command-executor');
      if (!commandModule) {
        console.log('Command executor module not found, skipping test');
        return;
      }

      const loadedModule = await loadModule(commandModule);
      const tools = await loadedModule.getTools();
      
      const execTool = tools.find(t => t.name === 'command_execute');
      if (execTool) {
        // Test safe command
        const result = await execTool.invoke({
          function: {
            name: 'command_execute',
            arguments: JSON.stringify({
              command: 'echo "Hello World"'
            })
          }
        });
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('stdout');
        expect(result.data.stdout.trim()).toBe('Hello World');
        expect(result.data).toHaveProperty('exitCode', 0);
      }
    });

    test('command executor should block dangerous commands', async () => {
      const commandModule = discoveredModules.find(m => m.name === 'command-executor');
      if (!commandModule) return;

      const loadedModule = await loadModule(commandModule);
      const tools = await loadedModule.getTools();
      
      const execTool = tools.find(t => t.name === 'command_execute');
      if (execTool) {
        // Test dangerous command blocking
        const result = await execTool.invoke({
          function: {
            name: 'command_execute',
            arguments: JSON.stringify({
              command: 'rm -rf /'
            })
          }
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('blocked for safety');
      }
    });
  });

  describe('Tool Execution - Network Tools (Mock/Skip)', () => {
    // These tests check that tools are properly structured but skip actual network calls
    
    test('serper module tools should be properly structured', async () => {
      const serperModule = discoveredModules.find(m => m.name === 'serper');
      if (!serperModule) return;

      const loadedModule = await loadModule(serperModule);
      const tools = await loadedModule.getTools();
      
      const searchTool = tools.find(t => t.name === 'google_search');
      expect(searchTool).toBeDefined();
      
      const toolDesc = searchTool.getToolDescription();
      expect(toolDesc.function.parameters.required).toContain('query');
      expect(toolDesc.function.parameters.properties).toHaveProperty('query');
      
      // Don't actually call the API without credentials
      console.log('Serper tool structure validated (skipping API call)');
    });

    test('webpage tools should be properly structured', async () => {
      const modules = ['crawler', 'webpage-to-markdown', 'page-screenshoter'];
      
      for (const moduleName of modules) {
        const moduleInfo = discoveredModules.find(m => m.name === moduleName);
        if (!moduleInfo) continue;

        const loadedModule = await loadModule(moduleInfo);
        const tools = await loadedModule.getTools();
        
        expect(tools.length).toBeGreaterThan(0);
        
        for (const tool of tools) {
          const toolDesc = tool.getToolDescription();
          expect(toolDesc.function.parameters.required).toContain('url');
          expect(toolDesc.function.parameters.properties).toHaveProperty('url');
        }
        
        console.log(`${moduleName} tool structure validated (skipping browser automation)`);
      }
    });

    test('youtube transcript tool should be properly structured', async () => {
      const youtubeModule = discoveredModules.find(m => m.name === 'youtube-transcript');
      if (!youtubeModule) return;

      const loadedModule = await loadModule(youtubeModule);
      const tools = await loadedModule.getTools();
      
      const transcriptTool = tools.find(t => t.name === 'youtube_get_transcript');
      expect(transcriptTool).toBeDefined();
      
      const toolDesc = transcriptTool.getToolDescription();
      expect(toolDesc.function.parameters.required).toContain('videoUrl');
      expect(toolDesc.function.parameters.properties).toHaveProperty('videoUrl');
      
      console.log('YouTube transcript tool structure validated (skipping API call)');
    });

    test('server starter tool should be properly structured', async () => {
      const serverModule = discoveredModules.find(m => m.name === 'server-starter');
      if (!serverModule) return;

      const loadedModule = await loadModule(serverModule);
      const tools = await loadedModule.getTools();
      
      // Should have multiple tools (start, stop, read_output)
      expect(tools.length).toBeGreaterThanOrEqual(3);
      
      const startTool = tools.find(t => t.name === 'server_start');
      const stopTool = tools.find(t => t.name === 'server_stop');
      const readTool = tools.find(t => t.name === 'server_read_output');
      
      expect(startTool).toBeDefined();
      expect(stopTool).toBeDefined();
      expect(readTool).toBeDefined();
      
      console.log('Server starter multi-tool structure validated');
    });
  });

  describe('Module Metadata Validation', () => {
    test('all modules should have consistent metadata', () => {
      for (const module of discoveredModules) {
        const config = module.config;
        
        // Required fields
        expect(config.name).toBeTruthy();
        expect(config.description).toBeTruthy();
        expect(config.version).toBeTruthy();
        expect(config.package).toBeTruthy();
        expect(config.type).toBeTruthy();
        
        // Tools validation
        expect(Array.isArray(config.tools)).toBe(true);
        expect(config.tools.length).toBeGreaterThan(0);
        
        for (const tool of config.tools) {
          expect(tool.name).toBeTruthy();
          expect(tool.description).toBeTruthy();
          expect(tool.function).toBeTruthy();
          expect(tool.parameters).toBeTruthy();
          expect(tool.parameters.type).toBe('object');
          expect(tool.parameters.properties).toBeTruthy();
        }
      }
    });

    test('module names should be unique', () => {
      const names = discoveredModules.map(m => m.config.name);
      const uniqueNames = [...new Set(names)];
      expect(names.length).toBe(uniqueNames.length);
    });

    test('tool names within modules should be unique', () => {
      for (const module of discoveredModules) {
        const toolNames = module.config.tools.map(t => t.name);
        const uniqueToolNames = [...new Set(toolNames)];
        expect(toolNames.length).toBe(uniqueToolNames.length, 
          `Module ${module.name} has duplicate tool names`);
      }
    });
  });

  describe('Error Handling', () => {
    test('tools should handle invalid parameters gracefully', async () => {
      const lodashModule = discoveredModules.find(m => m.name === 'lodash');
      if (!lodashModule) return;

      const loadedModule = await loadModule(lodashModule);
      const tools = await loadedModule.getTools();
      
      const chunkTool = tools.find(t => t.name === 'array_chunk');
      if (chunkTool) {
        // Test with missing required parameter
        const result = await chunkTool.invoke({
          function: {
            name: 'array_chunk',
            arguments: JSON.stringify({
              size: 2
              // missing 'array' parameter
            })
          }
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('array');
      }
    });

    test('tools should handle malformed JSON arguments', async () => {
      const lodashModule = discoveredModules.find(m => m.name === 'lodash');
      if (!lodashModule) return;

      const loadedModule = await loadModule(lodashModule);
      const tools = await loadedModule.getTools();
      
      const chunkTool = tools.find(t => t.name === 'array_chunk');
      if (chunkTool) {
        // Test with malformed JSON
        const result = await chunkTool.invoke({
          function: {
            name: 'array_chunk',
            arguments: '{ invalid json'
          }
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
      }
    });
  });
});