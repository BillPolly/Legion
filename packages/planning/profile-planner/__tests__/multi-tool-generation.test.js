/**
 * Test that ProfilePlannerModule generates multiple tools (one per profile)
 */

import { jest } from '@jest/globals';
import { ResourceManager } from '@legion/tool-core';
import { ProfilePlannerModule } from '../src/ProfilePlannerModule.js';

describe('ProfilePlannerModule Multi-Tool Generation', () => {
  let resourceManager;
  let module;
  
  beforeAll(async () => {
    // Setup ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Create module
    module = await ProfilePlannerModule.create(resourceManager);
  });

  test('should create multiple tools from profiles', async () => {
    const tools = module.getTools();
    
    // Should have at least 4 tools (profile_planner + javascript_planner + python_planner + web_planner)
    expect(tools.length).toBeGreaterThanOrEqual(4);
    
    // Find the meta tool
    const metaTool = tools.find(tool => tool.name === 'profile_planner');
    expect(metaTool).toBeDefined();
    
    // Find the javascript profile tool
    const jsTool = tools.find(tool => tool.name === 'javascript_planner');
    expect(jsTool).toBeDefined();
    
    // Find the python profile tool
    const pythonTool = tools.find(tool => tool.name === 'python_planner');
    expect(pythonTool).toBeDefined();
    
    // Find the web profile tool
    const webTool = tools.find(tool => tool.name === 'web_planner');
    expect(webTool).toBeDefined();
    
    // Log all tools for visibility
    console.log('\nGenerated tools:');
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
  });

  test('javascript_planner tool should have correct schema', async () => {
    const tools = module.getTools();
    const jsTool = tools.find(tool => tool.name === 'javascript_planner');
    
    expect(jsTool).toBeDefined();
    
    // Get tool descriptions
    const toolDescriptions = jsTool.getAllToolDescriptions();
    expect(toolDescriptions).toHaveLength(1);
    
    const desc = toolDescriptions[0];
    expect(desc.type).toBe('function');
    expect(desc.function.name).toBe('javascript_planner');
    expect(desc.function.description).toContain('JavaScript');
    expect(desc.function.parameters.properties).toHaveProperty('task');
    expect(desc.function.parameters.required).toContain('task');
  });

  test('each profile tool should be independently callable', async () => {
    const tools = module.getTools();
    const jsTool = tools.find(tool => tool.name === 'javascript_planner');
    
    // Mock the invoke to avoid actual LLM calls
    const originalInvoke = jsTool.invoke.bind(jsTool);
    jsTool.invoke = jest.fn().mockResolvedValue({
      success: true,
      data: {
        profile: 'javascript',
        message: 'Mock plan created'
      }
    });
    
    const result = await jsTool.invoke({
      function: {
        name: 'javascript_planner',
        arguments: JSON.stringify({
          task: 'Create a test function'
        })
      }
    });
    
    expect(result.success).toBe(true);
    expect(jsTool.invoke).toHaveBeenCalledWith({
      function: {
        name: 'javascript_planner',
        arguments: JSON.stringify({
          task: 'Create a test function'
        })
      }
    });
    
    // Restore original method
    jsTool.invoke = originalInvoke;
  });
});