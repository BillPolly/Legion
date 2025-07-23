/**
 * Integration test for LLM Planner with Aiur
 */

import { jest } from '@jest/globals';
import { PlanningTools } from '../../src/planning/PlanningTools.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { HandleRegistry } from '../../src/handles/HandleRegistry.js';
import { PlanExecutor } from '../../src/planning/PlanExecutor.js';
import { Plan, PlanStep, PlanAction } from '@legion/llm-planner';

describe('LLM Planner Integration', () => {
  let planningTools;
  let toolRegistry;
  let handleRegistry;
  let planExecutor;

  beforeEach(() => {
    // Initialize registries
    handleRegistry = new HandleRegistry();
    toolRegistry = new ToolRegistry(handleRegistry);
    
    // Add some mock tools for testing
    toolRegistry.registerTool({
      name: 'file_read',
      description: 'Read a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' }
        }
      },
      execute: async (params) => ({ content: `Contents of ${params.path}` })
    });
    
    toolRegistry.registerTool({
      name: 'file_write',
      description: 'Write a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' }
        }
      },
      execute: async (params) => ({ success: true, path: params.path })
    });
    
    // Initialize executor and planning tools
    planExecutor = new PlanExecutor(toolRegistry, handleRegistry);
    planningTools = new PlanningTools(toolRegistry, handleRegistry, planExecutor);
  });

  test('should create a manual plan successfully', async () => {
    const planCreateTool = planningTools.getTools().plan_create;
    
    const result = await planCreateTool.execute({
      title: 'Test Manual Plan',
      description: 'A simple test plan',
      steps: [
        {
          id: 'step1',
          action: 'file_read',
          parameters: { path: '/test/file.txt' },
          expectedOutputs: ['file_content']
        },
        {
          id: 'step2',
          action: 'file_write',
          parameters: { path: '/test/output.txt', content: 'Hello World' },
          dependsOn: ['step1']
        }
      ]
    });
    
    expect(result.success).toBe(true);
    expect(result.plan.title).toBe('Test Manual Plan');
    expect(result.plan.steps).toHaveLength(2);
  });

  test('should generate a plan from a goal using LLM planner', async () => {
    const planCreateTool = planningTools.getTools().plan_create;
    
    // Mock the LLM planner if it's not initialized
    if (!planningTools.llmPlanner) {
      const allowableActions = [
        { type: 'file_write', inputs: ['path', 'content'], outputs: ['result'] }
      ];
      
      planningTools.llmPlanner = {
        createPlan: jest.fn().mockResolvedValue(
          new Plan({
            id: 'test-plan-1',
            name: 'Hello World Web Page',
            description: 'Create a simple HTML page',
            metadata: {},
            inputs: [],
            requiredOutputs: ['webpage'],
            steps: [{
              id: 'create-html',
              name: 'Create HTML file',
              description: 'Write the HTML content',
              type: 'implementation',
              dependencies: [],
              actions: [{
                type: 'file_write',
                parameters: {
                  path: 'hello.html',
                  content: '<!DOCTYPE html><html><body><h1>Hello World!</h1></body></html>'
                }
              }]
            }]
          }, allowableActions)
        )
      };
    }
    
    const result = await planCreateTool.execute({
      goal: 'Create a simple hello world web page',
      requiredOutputs: ['webpage']
    });
    
    if (!result.success) {
      console.error('Plan creation failed:', result.error);
    }
    
    expect(result.success).toBe(true);
    expect(result.plan).toBeDefined();
    expect(result.message).toContain('AI-generated plan');
    
    // Check that the plan was flattened correctly
    expect(result.plan.steps).toBeDefined();
    expect(result.plan.steps.length).toBeGreaterThan(0);
    expect(result.plan.steps[0].action).toBe('file_write');
  });

  test('should execute an LLM-generated plan', async () => {
    const planCreateTool = planningTools.getTools().plan_create;
    const planExecuteTool = planningTools.getTools().plan_execute;
    
    // Mock the LLM planner
    if (!planningTools.llmPlanner) {
      const allowableActions = [
        { type: 'file_read', inputs: ['path'], outputs: ['content'] },
        { type: 'file_write', inputs: ['path', 'content'], outputs: ['result'] }
      ];
      
      planningTools.llmPlanner = {
        createPlan: jest.fn().mockResolvedValue(
          new Plan({
            id: 'exec-test-plan',
            name: 'File Operations Plan',
            description: 'Read and write files',
            metadata: {},
            inputs: [],
            requiredOutputs: ['output_file'],
            steps: [
              {
                id: 'read-step',
                name: 'Read input file',
                type: 'implementation',
                dependencies: [],
                actions: [{
                  type: 'file_read',
                  parameters: { path: 'input.txt' }
                }]
              },
              {
                id: 'write-step',
                name: 'Write output file',
                type: 'implementation',
                dependencies: ['read-step'],
                actions: [{
                  type: 'file_write',
                  parameters: { path: 'output.txt', content: 'Processed content' }
                }]
              }
            ]
          }, allowableActions)
        )
      };
    }
    
    // Create the plan
    const createResult = await planCreateTool.execute({
      goal: 'Read a file and write its content to another file',
      requiredOutputs: ['output_file'],
      saveAs: 'test_exec_plan'
    });
    
    expect(createResult.success).toBe(true);
    
    // Execute the plan
    const execResult = await planExecuteTool.execute({
      planHandle: 'test_exec_plan'
    });
    
    expect(execResult.success).toBe(true);
    expect(execResult.execution).toBeDefined();
    expect(execResult.execution.completedSteps.length).toBeGreaterThan(0);
  });
});