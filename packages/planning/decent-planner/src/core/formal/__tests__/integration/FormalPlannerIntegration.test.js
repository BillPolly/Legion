/**
 * Integration test for FormalPlanner with real components
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

describe('FormalPlanner Integration', () => {
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
    const planner = new PlannerAdapter(realPlanner); // Adapt to expected interface
    const validator = new BTValidator();
    const toolFactory = new SyntheticToolFactory();
    const artifactMapper = new ArtifactMapping();
    
    // Use mock tool registry to avoid MongoDB dependency
    const toolRegistry = {
      searchTools: async (query) => {
        // Return some basic tools for testing
        return [
          { name: 'file_write', confidence: 0.9, description: 'Write to file' },
          { name: 'file_read', confidence: 0.8, description: 'Read from file' },
          { name: 'directory_list', confidence: 0.7, description: 'List directory' },
          { name: 'csv_parse', confidence: 0.7, description: 'Parse CSV' },
          { name: 'data_transform', confidence: 0.6, description: 'Transform data' }
        ].filter(t => !query || t.name.includes(query) || t.description.toLowerCase().includes(query.toLowerCase()));
      },
      getTool: async (name) => ({ 
        name, 
        execute: async () => ({ success: true }) 
      })
    };
    
    // Create formal planner with real dependencies
    formalPlanner = new FormalPlanner({
      planner,
      validator,
      toolFactory,
      artifactMapper,
      toolRegistry
    });
  });

  it('should synthesize a simple two-level hierarchy', async () => {
    if (!llmClient) {
      console.log('Test skipped - no LLM available');
      return;
    }
    
    // Create a simple hierarchy that informal planner would produce
    const taskHierarchy = {
      id: 'root',
      description: 'Process data files',
      complexity: 'COMPLEX',
      level: 0,
      children: [
        {
          id: 'read-files',
          description: 'Read all CSV files from a directory',
          complexity: 'SIMPLE',
          level: 1,
          tools: ['file_read', 'directory_list'],
          suggestedInputs: ['directory_path'],
          suggestedOutputs: ['file_contents']
        },
        {
          id: 'process-data',
          description: 'Parse CSV data and extract records',
          complexity: 'SIMPLE',
          level: 1,
          tools: ['csv_parse', 'data_transform'],
          suggestedInputs: ['csv_content'],
          suggestedOutputs: ['records']
        }
      ]
    };
    
    console.log('Starting synthesis of two-level hierarchy...');
    const result = await formalPlanner.synthesize(taskHierarchy);
    
    console.log('Synthesis result:', {
      success: result.success,
      errors: result.errors,
      syntheticToolCount: Object.keys(result.syntheticTools || {}).length,
      hasRootBT: !!result.rootBT
    });
    
    if (!result.success && result.errors.length > 0) {
      console.error('Detailed errors:', result.errors);
    }
    
    // Basic validation
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    
    // Should have created synthetic tools for children
    const syntheticToolNames = Object.keys(result.syntheticTools || {});
    console.log('Synthetic tools created:', syntheticToolNames);
    expect(syntheticToolNames.length).toBeGreaterThan(0);
    
    // Should have root BT
    expect(result.rootBT).toBeDefined();
    expect(result.rootBT.type).toBeDefined();
    
    console.log('Root BT structure:', JSON.stringify(result.rootBT, null, 2));
  }, 60000);
  
  it('should handle single-level SIMPLE task', async () => {
    if (!llmClient) {
      console.log('Test skipped - no LLM available');
      return;
    }
    
    // Single SIMPLE task - no children to synthesize
    const taskHierarchy = {
      id: 'simple-task',
      description: 'Write "Hello World" to a file',
      complexity: 'SIMPLE',
      level: 0,
      tools: ['file_write']
    };
    
    console.log('Synthesizing single SIMPLE task...');
    const result = await formalPlanner.synthesize(taskHierarchy);
    
    console.log('Single task result:', {
      success: result.success,
      syntheticToolCount: Object.keys(result.syntheticTools || {}).length,
      rootBT: result.rootBT?.type
    });
    
    expect(result.success).toBe(true);
    expect(Object.keys(result.syntheticTools || {})).toHaveLength(0);
    expect(result.rootBT).toBeDefined();
  }, 30000);
  
  it('should handle three-level hierarchy', async () => {
    if (!llmClient) {
      console.log('Test skipped - no LLM available');
      return;
    }
    
    // Three-level hierarchy
    const taskHierarchy = {
      id: 'root',
      description: 'Build a web application',
      complexity: 'COMPLEX',
      level: 0,
      children: [
        {
          id: 'backend',
          description: 'Set up backend API',
          complexity: 'COMPLEX',
          level: 1,
          children: [
            {
              id: 'database',
              description: 'Set up database connection',
              complexity: 'SIMPLE',
              level: 2,
              tools: ['database_connect', 'schema_create']
            },
            {
              id: 'api-routes',
              description: 'Create REST API routes',
              complexity: 'SIMPLE',
              level: 2,
              tools: ['route_create', 'middleware_add']
            }
          ]
        },
        {
          id: 'frontend',
          description: 'Create user interface',
          complexity: 'SIMPLE',
          level: 1,
          tools: ['component_create', 'style_add']
        }
      ]
    };
    
    console.log('Synthesizing three-level hierarchy...');
    const result = await formalPlanner.synthesize(taskHierarchy);
    
    console.log('Three-level result:', {
      success: result.success,
      errors: result.errors,
      syntheticToolCount: Object.keys(result.syntheticTools || {}).length,
      levelPlans: result.levelPlans?.length
    });
    
    expect(result.success).toBe(true);
    
    // Should create synthetic tools at level 2 and level 1
    const syntheticTools = Object.values(result.syntheticTools || {});
    console.log('Synthetic tools at each level:', 
      syntheticTools.map(t => ({ name: t.name, level: t.metadata?.level }))
    );
    
    expect(syntheticTools.length).toBeGreaterThan(0);
    expect(result.rootBT).toBeDefined();
  }, 60000);
});