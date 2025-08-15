/**
 * Integration tests for DecentPlanner
 * 
 * Tests the complete hierarchical decomposition and planning flow
 */

import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import { DecentPlanner } from '../../src/index.js';
import { ResourceManager, ToolRegistry } from '@legion/tools-registry';

describe('DecentPlanner Integration', () => {
  let resourceManager;
  let planner;
  
  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Create mock LLM client for testing
    const mockLLMClient = {
      generateResponse: jest.fn().mockImplementation(async (options) => {
        const message = options.messages[options.messages.length - 1].content;
        
        // Mock decomposition response
        if (message.includes('Break this down into subtasks')) {
          if (message.includes('Create a simple Express API')) {
            return {
              content: JSON.stringify({
                task: 'Create a simple Express API',
                subtasks: [
                  {
                    id: 'subtask-1',
                    description: 'Initialize Node.js project',
                    complexity: 'SIMPLE',
                    reasoning: 'Direct npm commands and file creation',
                    suggestedInputs: ['project_name', 'package_config'],
                    suggestedOutputs: ['package_json', 'project_structure']
                  },
                  {
                    id: 'subtask-2',
                    description: 'Set up Express server',
                    complexity: 'SIMPLE',
                    reasoning: 'Single file with basic Express setup',
                    suggestedInputs: ['package_json', 'port_config'],
                    suggestedOutputs: ['server_file', 'express_app']
                  },
                  {
                    id: 'subtask-3',
                    description: 'Create API endpoints',
                    complexity: 'SIMPLE',
                    reasoning: 'Define routes in a single file',
                    suggestedInputs: ['express_app', 'route_definitions'],
                    suggestedOutputs: ['api_routes', 'route_handlers']
                  }
                ]
              })
            };
          }
        }
        
        // Mock behavior tree generation
        if (message.includes('Create a behavior tree')) {
          return {
            content: JSON.stringify({
              type: 'sequence',
              id: 'root',
              children: [
                {
                  type: 'action',
                  id: 'action-1',
                  tool: 'file_write',
                  params: {
                    filepath: 'test.js',
                    content: 'console.log("test");'
                  }
                }
              ]
            })
          };
        }
        
        return { content: '{}' };
      })
    };
    
    // Set up resources
    resourceManager.set('llmClient', mockLLMClient);
    
    // Create real ToolRegistry singleton with actual tools
    const toolRegistry = new ToolRegistry();
    await toolRegistry.initialize();
    
    // The ToolRegistry automatically loads modules during initialization
    const availableTools = await toolRegistry.listTools();
    console.log('Available tools:', availableTools.map(t => t.name));
    
    // Set up the real tool registry
    resourceManager.set('toolRegistry', toolRegistry);
    
    // Create a simple tool registry provider that uses the real registry
    resourceManager.set('toolRegistryProvider', {
      searchTools: async (query, options = {}) => {
        // Simple keyword matching for testing
        const allTools = await toolRegistry.listTools();
        const results = allTools.filter(tool => 
          tool.name.toLowerCase().includes(query.toLowerCase()) ||
          tool.description.toLowerCase().includes(query.toLowerCase())
        ).slice(0, options.limit || 10);
        
        return results.map(tool => ({ name: tool.name, description: tool.description }));
      },
      listTools: async (options = {}) => {
        const allTools = await toolRegistry.listTools();
        return allTools.slice(0, options.limit || 100).map(tool => ({ 
          name: tool.name, 
          description: tool.description 
        }));
      }
    });
    
    // Create planner
    planner = await DecentPlanner.create(resourceManager);
  });
  
  describe('Basic Planning', () => {
    it('should decompose a simple task', async () => {
      const result = await planner.plan('Create a simple Express API', {
        domain: 'web-development',
        maxDepth: 3,
        debug: true
      });
      
      console.log('Plan success:', result.success);
      console.log('Plan error:', result.error);
      if (result.data) {
        console.log('Data keys:', Object.keys(result.data));
        if (result.data.statistics) {
          console.log('Statistics:', result.data.statistics);
        }
      }
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.hierarchy).toBeDefined();
      expect(result.data.statistics).toBeDefined();
      expect(result.data.statistics.totalTasks).toBeGreaterThan(0);
    });
    
    it('should generate behavior trees for simple tasks', async () => {
      const result = await planner.plan('Create a simple Express API', {
        domain: 'web-development',
        maxDepth: 2
      });
      
      expect(result.success).toBe(true);
      expect(result.data.behaviorTrees).toBeDefined();
      expect(Object.keys(result.data.behaviorTrees).length).toBeGreaterThan(0);
    });
    
    it('should track artifacts through decomposition', async () => {
      const result = await planner.plan('Create a simple Express API', {
        domain: 'web-development'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.artifacts).toBeDefined();
      expect(result.data.artifacts.inputs).toBeInstanceOf(Array);
      expect(result.data.artifacts.outputs).toBeInstanceOf(Array);
      expect(result.data.artifacts.intermediate).toBeInstanceOf(Array);
    });
    
    it('should create an execution plan', async () => {
      const result = await planner.plan('Create a simple Express API', {
        domain: 'web-development'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.executionPlan).toBeInstanceOf(Array);
      expect(result.data.executionPlan.length).toBeGreaterThan(0);
      
      // Check execution plan structure
      const firstTask = result.data.executionPlan[0];
      expect(firstTask).toHaveProperty('taskId');
      expect(firstTask).toHaveProperty('description');
      expect(firstTask).toHaveProperty('dependencies');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle decomposition failures gracefully', async () => {
      // Create planner with failing LLM
      const failingLLM = {
        generateResponse: jest.fn().mockRejectedValue(new Error('LLM error'))
      };
      
      const failingRM = new ResourceManager();
      await failingRM.initialize();
      failingRM.register('llmClient', failingLLM);
      failingRM.register('toolRegistryProvider', resourceManager.get('toolRegistryProvider'));
      
      const failingPlanner = await DecentPlanner.create(failingRM);
      
      const result = await failingPlanner.plan('Test task');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Decomposition failed');
    });
    
    it('should respect max depth limit', async () => {
      const result = await planner.plan('Build complete web application', {
        maxDepth: 1
      });
      
      // Should stop at depth 1 even for complex task
      expect(result.data.statistics.decompositionLevels).toBeLessThanOrEqual(1);
    });
  });
});