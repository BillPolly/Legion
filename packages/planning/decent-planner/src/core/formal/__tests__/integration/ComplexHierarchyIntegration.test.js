/**
 * Integration test for complex hierarchy scenarios
 * Tests edge cases and complex branching in the formal planner
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { FormalPlanner } from '../../FormalPlanner.js';
import { SyntheticToolFactory } from '../../SyntheticToolFactory.js';
import { ArtifactMapping } from '../../ArtifactMapping.js';
import { PlannerAdapter } from '../../PlannerAdapter.js';
import { Planner } from '@legion/planner';
import { BTValidator } from '@legion/bt-validator';
import { ResourceManager } from '@legion/resource-manager';
import { Anthropic } from '@anthropic-ai/sdk';

describe('Complex Hierarchy Integration', () => {
  let formalPlanner;
  let resourceManager;
  let llmClient;

  beforeAll(async () => {
    // NEW API: getInstance() is now async and returns fully initialized instance
    resourceManager = await ResourceManager.getInstance();
    
    // Get API key and create LLM client
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      console.log('Skipping integration test - no ANTHROPIC_API_KEY');
      return;
    }
    
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    llmClient = {
      complete: async (prompt) => {
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }]
        });
        return response.content[0].text;
      }
    };
    
    // Initialize real components
    const realPlanner = new Planner({ llmClient });
    const plannerAdapter = new PlannerAdapter(realPlanner);
    const validator = new BTValidator();
    const toolFactory = new SyntheticToolFactory();
    const artifactMapper = new ArtifactMapping();
    
    // Simple tool registry for testing
    const toolRegistry = {
      searchTools: async (query) => {
        return [
          { name: 'file_write', confidence: 0.9, description: 'Write to file' },
          { name: 'file_read', confidence: 0.8, description: 'Read from file' },
          { name: 'api_call', confidence: 0.7, description: 'Make API call' },
          { name: 'data_process', confidence: 0.7, description: 'Process data' },
          { name: 'validate', confidence: 0.6, description: 'Validate data' }
        ].filter(t => !query || t.name.includes(query) || t.description.toLowerCase().includes(query.toLowerCase()));
      },
      getTool: async (name) => ({ 
        name, 
        execute: async () => ({ success: true }) 
      })
    };
    
    formalPlanner = new FormalPlanner({
      planner: plannerAdapter,
      validator,
      toolFactory,
      artifactMapper,
      toolRegistry
    });
  });

  it('should handle multiple COMPLEX nodes at same level', async () => {
    if (!llmClient) {
      console.log('Test skipped - no LLM available');
      return;
    }
    
    // Hierarchy with multiple COMPLEX children
    const hierarchy = {
      id: 'root',
      description: 'Build complete application',
      complexity: 'COMPLEX',
      level: 0,
      children: [
        {
          id: 'backend',
          description: 'Build backend API',
          complexity: 'COMPLEX',
          level: 1,
          children: [
            {
              id: 'api-routes',
              description: 'Create API routes',
              complexity: 'SIMPLE',
              level: 2,
              tools: ['api_call', 'validate']
            },
            {
              id: 'database',
              description: 'Set up database',
              complexity: 'SIMPLE',
              level: 2,
              tools: ['file_write']
            }
          ]
        },
        {
          id: 'frontend',
          description: 'Build frontend UI',
          complexity: 'COMPLEX',
          level: 1,
          children: [
            {
              id: 'components',
              description: 'Create UI components',
              complexity: 'SIMPLE',
              level: 2,
              tools: ['file_write']
            },
            {
              id: 'styling',
              description: 'Add styling',
              complexity: 'SIMPLE',
              level: 2,
              tools: ['file_write']
            }
          ]
        },
        {
          id: 'testing',
          description: 'Add tests',
          complexity: 'SIMPLE',
          level: 1,
          tools: ['file_write', 'validate']
        }
      ]
    };
    
    console.log('Testing complex branching with multiple COMPLEX nodes...');
    const result = await formalPlanner.synthesize(hierarchy);
    
    console.log('Result:', {
      success: result.success,
      errors: result.errors,
      syntheticToolCount: Object.keys(result.syntheticTools || {}).length
    });
    
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    
    // Should have synthetic tools for all leaf tasks AND complex nodes
    const syntheticTools = Object.values(result.syntheticTools || {});
    expect(syntheticTools.length).toBeGreaterThanOrEqual(5); // At least 5 leaf tasks (complex nodes may or may not become tools)
    
    // Check that backend and frontend became synthetic tools
    const toolNames = syntheticTools.map(t => t.name);
    expect(toolNames.some(name => name.includes('backend'))).toBe(true);
    expect(toolNames.some(name => name.includes('frontend'))).toBe(true);
    
    // Root BT should reference synthetic tools
    expect(result.rootBT).toBeDefined();
    expect(result.rootBT.type).toBeDefined();
  }, 60000);

  it('should handle mixed SIMPLE and COMPLEX at same level', async () => {
    if (!llmClient) {
      console.log('Test skipped - no LLM available');
      return;
    }
    
    // Hierarchy with mixed complexity at same level
    const hierarchy = {
      id: 'root',
      description: 'Process and store data',
      complexity: 'COMPLEX',
      level: 0,
      children: [
        {
          id: 'fetch-data',
          description: 'Fetch data from API',
          complexity: 'SIMPLE',
          level: 1,
          tools: ['api_call']
        },
        {
          id: 'process-data',
          description: 'Process and transform data',
          complexity: 'COMPLEX',
          level: 1,
          children: [
            {
              id: 'validate',
              description: 'Validate data format',
              complexity: 'SIMPLE',
              level: 2,
              tools: ['validate']
            },
            {
              id: 'transform',
              description: 'Transform data structure',
              complexity: 'SIMPLE',
              level: 2,
              tools: ['data_process']
            }
          ]
        },
        {
          id: 'store-data',
          description: 'Store processed data',
          complexity: 'SIMPLE',
          level: 1,
          tools: ['file_write']
        }
      ]
    };
    
    console.log('Testing mixed complexity at same level...');
    const result = await formalPlanner.synthesize(hierarchy);
    
    console.log('Mixed complexity result:', {
      success: result.success,
      syntheticToolCount: Object.keys(result.syntheticTools || {}).length
    });
    
    expect(result.success).toBe(true);
    
    // Should handle both SIMPLE and COMPLEX at level 1
    const syntheticTools = Object.values(result.syntheticTools || {});
    
    // process-data (COMPLEX) should become a synthetic tool
    const processDataTool = syntheticTools.find(t => t.name.includes('process-data'));
    expect(processDataTool).toBeDefined();
    
    // Root BT should exist
    expect(result.rootBT).toBeDefined();
  }, 60000);

  it('should handle deeply nested hierarchy', async () => {
    if (!llmClient) {
      console.log('Test skipped - no LLM available');
      return;
    }
    
    // 4-level deep hierarchy
    const hierarchy = {
      id: 'root',
      description: 'Complex nested task',
      complexity: 'COMPLEX',
      level: 0,
      children: [
        {
          id: 'level1',
          description: 'Level 1 complex task',
          complexity: 'COMPLEX',
          level: 1,
          children: [
            {
              id: 'level2',
              description: 'Level 2 complex task',
              complexity: 'COMPLEX',
              level: 2,
              children: [
                {
                  id: 'level3-a',
                  description: 'Level 3 simple task A',
                  complexity: 'SIMPLE',
                  level: 3,
                  tools: ['file_write']
                },
                {
                  id: 'level3-b',
                  description: 'Level 3 simple task B',
                  complexity: 'SIMPLE',
                  level: 3,
                  tools: ['file_read']
                }
              ]
            }
          ]
        }
      ]
    };
    
    console.log('Testing deeply nested hierarchy...');
    const result = await formalPlanner.synthesize(hierarchy);
    
    console.log('Deep nesting result:', {
      success: result.success,
      errors: result.errors,
      syntheticToolCount: Object.keys(result.syntheticTools || {}).length,
      levels: result.levelPlans ? Object.keys(result.levelPlans).length : 0
    });
    
    expect(result.success).toBe(true);
    
    // Should create synthetic tools at multiple levels
    const syntheticTools = Object.values(result.syntheticTools || {});
    expect(syntheticTools.length).toBeGreaterThanOrEqual(3); // level3 tasks + level2 + level1
    
    // Check nesting in synthetic tools
    const level2Tool = syntheticTools.find(t => t.name.includes('level2'));
    expect(level2Tool).toBeDefined();
    expect(level2Tool.executionPlan).toBeDefined();
    
    expect(result.rootBT).toBeDefined();
  }, 60000);

  it('should handle single SIMPLE root task', async () => {
    if (!llmClient) {
      console.log('Test skipped - no LLM available');
      return;
    }
    
    // Edge case: root is SIMPLE (no children)
    const hierarchy = {
      id: 'simple-root',
      description: 'Write a simple file',
      complexity: 'SIMPLE',
      level: 0,
      tools: ['file_write']
    };
    
    console.log('Testing single SIMPLE root...');
    const result = await formalPlanner.synthesize(hierarchy);
    
    console.log('Simple root result:', {
      success: result.success,
      syntheticToolCount: Object.keys(result.syntheticTools || {}).length,
      hasRootBT: !!result.rootBT
    });
    
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    
    // No synthetic tools needed for single SIMPLE task
    expect(Object.keys(result.syntheticTools || {})).toHaveLength(0);
    
    // Should still have a root BT
    expect(result.rootBT).toBeDefined();
    expect(result.rootBT.type).toBeDefined();
  }, 30000);

  it('should handle empty children arrays gracefully', async () => {
    if (!llmClient) {
      console.log('Test skipped - no LLM available');
      return;
    }
    
    // COMPLEX task with empty children array (edge case)
    const hierarchy = {
      id: 'empty-complex',
      description: 'Complex task with no breakdown',
      complexity: 'COMPLEX',
      level: 0,
      children: [] // Empty!
    };
    
    console.log('Testing COMPLEX with empty children...');
    const result = await formalPlanner.synthesize(hierarchy);
    
    console.log('Empty children result:', {
      success: result.success,
      errors: result.errors,
      hasRootBT: !!result.rootBT
    });
    
    // Should handle gracefully - either succeed with simple BT or return meaningful error
    if (result.success) {
      expect(result.rootBT).toBeDefined();
    } else {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  }, 30000);
});