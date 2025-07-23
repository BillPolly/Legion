/**
 * Tests for Module Loading Timing Issues
 * 
 * Tests to ensure modules are loaded before server handlers are set
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

describe('Module Loading Timing', () => {
  describe('Problematic Pattern (Current Implementation)', () => {
    test('demonstrates the closure problem with TOOLS array', () => {
      // Simulate current implementation problem
      let TOOLS = ['tool1', 'tool2'];
      
      // Handler captures TOOLS reference at definition time
      const handler = () => ({ tools: TOOLS });
      
      // Later, we add more tools
      TOOLS.push('tool3');
      // Note: Can't reassign const TOOLS, this would be an error
      
      // Handler returns the array with mutations
      const result = handler();
      expect(result.tools).toEqual(['tool1', 'tool2', 'tool3']);
      // Pushing works because we're mutating the array, not reassigning
    });
    
    test('shows how const TOOLS prevents reassignment', () => {
      const TOOLS = ['tool1', 'tool2'];
      
      // This works - modifies the array
      TOOLS.push('tool3');
      expect(TOOLS).toContain('tool3');
      
      // This would cause an error if uncommented:
      // TOOLS = [...TOOLS, 'tool4']; // TypeError: Assignment to constant variable
    });
  });
  
  describe('Solution Patterns', () => {
    test('solution 1: use a function to get current tools', () => {
      let TOOLS = ['tool1', 'tool2'];
      
      // Handler calls function to get current state
      const getTools = () => TOOLS;
      const handler = () => ({ tools: getTools() });
      
      // Add tools later
      TOOLS.push('tool3');
      
      // Handler now returns updated array
      const result = handler();
      expect(result.tools).toEqual(['tool1', 'tool2', 'tool3']);
    });
    
    test('solution 2: use an object wrapper', () => {
      const toolsContainer = {
        tools: ['tool1', 'tool2']
      };
      
      // Handler references the container
      const handler = () => ({ tools: toolsContainer.tools });
      
      // Add tools later
      toolsContainer.tools.push('tool3');
      toolsContainer.tools = [...toolsContainer.tools, 'tool4'];
      
      // Handler returns updated array
      const result = handler();
      expect(result.tools).toEqual(['tool1', 'tool2', 'tool3', 'tool4']);
    });
    
    test('solution 3: load modules before setting handlers', async () => {
      const executionOrder = [];
      
      // Simulate async module loading
      const loadModules = async () => {
        executionOrder.push('load-start');
        await new Promise(resolve => setTimeout(resolve, 10));
        executionOrder.push('load-end');
        return ['file_write', 'file_read'];
      };
      
      // Simulate server setup
      const setupServer = (tools) => {
        executionOrder.push('setup-server');
        return {
          handler: () => ({ tools })
        };
      };
      
      // Correct order: load first, then setup
      const tools = ['context_add', 'context_get'];
      const dynamicTools = await loadModules();
      tools.push(...dynamicTools);
      const server = setupServer(tools);
      
      expect(executionOrder).toEqual(['load-start', 'load-end', 'setup-server']);
      expect(server.handler().tools).toContain('file_write');
    });
  });
  
  describe('Recommended Implementation Pattern', () => {
    test('complete initialization flow', async () => {
      // Step 1: Initialize registries and adapters
      const registries = { initialized: true };
      
      // Step 2: Create base tools array
      const TOOLS = [
        { name: 'context_add', description: 'Add context' },
        { name: 'context_get', description: 'Get context' }
      ];
      
      // Step 3: Load modules and add their tools
      async function loadLegionModules(modulesToLoad) {
        const loadedTools = [];
        
        for (const [module, deps] of modulesToLoad) {
          // Simulate module loading
          await new Promise(resolve => setTimeout(resolve, 5));
          
          if (module === 'FileModule') {
            loadedTools.push(
              { name: 'file_read', description: 'Read file' },
              { name: 'file_write', description: 'Write file' }
            );
          }
        }
        
        return loadedTools;
      }
      
      const modulesToLoad = [
        ['FileModule', { basePath: '/tmp' }]
      ];
      
      const dynamicTools = await loadLegionModules(modulesToLoad);
      TOOLS.push(...dynamicTools);
      
      // Step 4: NOW set up server handlers
      const server = {
        handlers: {},
        setRequestHandler: function(schema, handler) {
          this.handlers[schema] = handler;
        }
      };
      
      server.setRequestHandler('ListToolsRequestSchema', async () => ({
        tools: TOOLS // This now includes all tools
      }));
      
      // Step 5: Start server
      const startServer = () => ({ started: true });
      
      // Verify all tools are available
      const response = await server.handlers['ListToolsRequestSchema']();
      expect(response.tools).toHaveLength(4);
      expect(response.tools.map(t => t.name)).toContain('file_write');
    });
    
    test('generic module loading function', async () => {
      // Generic function that should be in index.js
      async function initializeDynamicModules(adapter, toolRegistry, TOOLS) {
        // Module configuration - easy to add new modules
        const moduleConfigs = [
          {
            module: { default: 'MockFileModule' }, // Mock module for test
            dependencies: {
              basePath: process.cwd(),
              encoding: 'utf8',
              createDirectories: true,
              permissions: 0o755
            }
          }
          // Add more modules here as needed
        ];
        
        for (const config of moduleConfigs) {
          try {
            const result = await adapter.loadModule(
              config.module.default,
              config.dependencies
            );
            
            // Get newly registered tools
            const allTools = toolRegistry.getAllTools();
            const newTools = allTools.filter(tool =>
              tool.tags && 
              tool.tags.includes('legion-module') &&
              !TOOLS.some(t => t.name === tool.name)
            );
            
            // Add to TOOLS array
            newTools.forEach(tool => {
              TOOLS.push({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
              });
            });
            
            console.log(`Loaded module: ${result.moduleName} with ${newTools.length} tools`);
          } catch (error) {
            console.error(`Failed to load module:`, error);
          }
        }
      }
      
      // Mock objects
      const mockAdapter = {
        loadModule: async (module, deps) => ({
          moduleName: 'test-module',
          toolsRegistered: 2
        })
      };
      
      const mockRegistry = {
        getAllTools: () => [
          { name: 'new_tool', description: 'New', inputSchema: {}, tags: ['legion-module'] }
        ]
      };
      
      const TOOLS = [];
      
      // This would be called before server.setRequestHandler
      await initializeDynamicModules(mockAdapter, mockRegistry, TOOLS);
      
      expect(TOOLS).toHaveLength(1);
      expect(TOOLS[0].name).toBe('new_tool');
    });
  });
});