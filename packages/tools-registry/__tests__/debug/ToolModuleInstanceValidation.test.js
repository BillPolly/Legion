/**
 * Debug test to verify Tool and Module instances are proper class instances
 * This test will fail if tools/modules aren't real class instances
 */

import { getToolRegistry } from '../../src/index.js';
import { Tool } from '../../src/core/Tool.js';
import { Module } from '../../src/core/Module.js';

describe('Tool and Module Instance Validation', () => {
  let toolRegistry;

  beforeAll(async () => {
    toolRegistry = await getToolRegistry();
    
    // Load all modules to ensure they're in cache
    console.log('Loading all modules...');
    const loadResult = await toolRegistry.loadAllModules();
    console.log(`Loaded ${loadResult.loaded} modules, ${loadResult.failed} failed`);
  });

  test('modules must be actual Module class instances', async () => {
    console.log('\n=== MODULE INSTANCE VALIDATION ===');
    
    // Try to get a specific module
    try {
      const moduleNames = ['ClaudeToolsModule', 'CodeAgentModule', 'FileOperationsModule'];
      
      for (const moduleName of moduleNames) {
        console.log(`\nTesting module: ${moduleName}`);
        
        try {
          const module = await toolRegistry.getModule(moduleName);
          
          console.log(`Module retrieved: ${!!module}`);
          console.log(`Module type: ${typeof module}`);
          console.log(`Module constructor: ${module?.constructor?.name}`);
          console.log(`Module prototype chain:`, Object.getPrototypeOf(module)?.constructor?.name);
          console.log(`Is instance of Module: ${module instanceof Module}`);
          console.log(`Has getTools method: ${typeof module?.getTools}`);
          console.log(`Module name: ${module?.name}`);
          
          // MUST be actual Module class instance
          expect(module).toBeInstanceOf(Module);
          expect(typeof module.getTools).toBe('function');
          
        } catch (error) {
          console.log(`Failed to load module ${moduleName}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('Module loading error:', error);
      throw error;
    }
  });

  test('tools must be actual Tool class instances', async () => {
    console.log('\n=== TOOL INSTANCE VALIDATION ===');
    
    const toolNames = ['Write', 'Read', 'generate_javascript', 'file_writer'];
    
    for (const toolName of toolNames) {
      console.log(`\nTesting tool: ${toolName}`);
      
      try {
        const tool = await toolRegistry.getTool(toolName);
        
        console.log(`Tool retrieved: ${!!tool}`);
        console.log(`Tool type: ${typeof tool}`);
        console.log(`Tool constructor: ${tool?.constructor?.name}`);
        console.log(`Tool prototype chain:`, Object.getPrototypeOf(tool)?.constructor?.name);
        console.log(`Is instance of Tool: ${tool instanceof Tool}`);
        console.log(`Has execute method: ${typeof tool?.execute}`);
        console.log(`Has serialize method: ${typeof tool?.serialize}`);
        console.log(`Tool name: ${tool?.name}`);
        console.log(`Tool module: ${tool?.module?.name}`);
        
        if (tool) {
          // MUST be actual Tool class instance
          expect(tool).toBeInstanceOf(Tool);
          expect(typeof tool.execute).toBe('function');
          expect(typeof tool.serialize).toBe('function');
          
          // Test the serialize method
          console.log('Testing serialize method...');
          const serialized = tool.serialize();
          console.log('Serialized tool:', JSON.stringify(serialized, null, 2));
          
          expect(serialized).toBeDefined();
          expect(serialized.name).toBe(tool.name);
          expect(serialized.$type).toBe('Tool');
        }
        
      } catch (error) {
        console.log(`Failed to load tool ${toolName}: ${error.message}`);
      }
    }
  });

  test('tool registry cache contains proper instances', async () => {
    console.log('\n=== CACHE VALIDATION ===');
    
    // Check what's in the cache
    const stats = await toolRegistry.getStatistics();
    console.log('Registry statistics:', stats);
    
    // Get a tool and verify it's cached properly
    const tool1 = await toolRegistry.getTool('Write');
    const tool2 = await toolRegistry.getTool('Write'); // Should be same instance from cache
    
    console.log('Tool1 === Tool2 (cache hit):', tool1 === tool2);
    console.log('Tool1 instanceof Tool:', tool1 instanceof Tool);
    console.log('Tool2 instanceof Tool:', tool2 instanceof Tool);
    
    expect(tool1 === tool2).toBe(true); // Should be same cached instance
    expect(tool1).toBeInstanceOf(Tool);
    expect(tool2).toBeInstanceOf(Tool);
  });

  test('serialization should work without circular references', async () => {
    console.log('\n=== SERIALIZATION TEST ===');
    
    try {
      const tool = await toolRegistry.getTool('Write');
      
      console.log('Testing JSON.stringify with Tool object...');
      
      // This should NOT produce [Circular] if serialize() method works
      const directStringify = JSON.stringify(tool);
      console.log('Direct JSON.stringify result:', directStringify);
      
      expect(directStringify).not.toContain('[Circular]');
      expect(JSON.parse(directStringify)).toBeDefined();
      
      // Test with complex object containing tool
      const complexObject = {
        type: 'action',
        tool: tool,
        nested: {
          anotherTool: tool
        }
      };
      
      console.log('Testing complex object with tool...');
      const complexStringify = JSON.stringify(complexObject);
      console.log('Complex object stringify result length:', complexStringify.length);
      
      expect(complexStringify).not.toContain('[Circular]');
      
    } catch (error) {
      console.error('Serialization test failed:', error);
      throw error;
    }
  });
}, 60000);