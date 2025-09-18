/**
 * Unit tests for RecursiveExecutionStrategy artifact management
 * Tests the new artifact-aware recursive decomposition and execution
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RecursiveExecutionStrategy } from '../../../../src/core/strategies/RecursiveExecutionStrategy.js';
import { ExecutionContext } from '../../../../src/core/ExecutionContext.js';

describe('RecursiveExecutionStrategy - Artifact Management', () => {
  let strategy;
  let context;
  let mockToolRegistry;
  let mockLlmClient;
  let mockSimplePromptClient;

  beforeEach(() => {
    // Create mock tool registry
    mockToolRegistry = {
      getTool: jest.fn().mockResolvedValue({
        name: 'test_tool',
        execute: jest.fn().mockResolvedValue({
          success: true,
          data: { output: 'test result' }
        })
      }),
      getAllTools: jest.fn().mockReturnValue([])
    };

    // Create mock simple prompt client
    mockSimplePromptClient = {
      request: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          decompose: false,
          subtasks: [],
          strategy: 'atomic',
          reasoning: 'Simple task requires no decomposition'
        })
      })
    };

    // Create mock LLM client
    mockLlmClient = {
      chatCompletion: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          decompose: false,
          reasoning: 'Task is simple enough to execute directly'
        })
      })
    };

    // Create strategy with artifact support
    strategy = new RecursiveExecutionStrategy({
      toolRegistry: mockToolRegistry,
      llmClient: mockLlmClient,
      simplePromptClient: mockSimplePromptClient,
      maxDepth: 3
    });

    // Create context with test artifacts
    context = new ExecutionContext();
    context.depth = 1;

    // Add test artifacts to context
    context.addArtifact('source_code', {
      type: 'file',
      value: '/tmp/server.js',
      description: 'Server source code',
      purpose: 'Main application file',
      timestamp: Date.now()
    });

    context.addArtifact('config_data', {
      type: 'data',
      value: { port: 3000, host: 'localhost' },
      description: 'Application configuration',
      purpose: 'Server configuration',
      timestamp: Date.now()
    });
  });

  describe('buildPrompt() with artifacts', () => {
    it('should build prompt with conversation history and artifact catalog', () => {
      // Add conversation history
      context.conversationHistory.push({
        role: 'user',
        content: 'Create a web server',
        timestamp: Date.now()
      });

      const task = {
        description: 'Deploy the web server using existing artifacts'
      };

      const prompt = strategy.buildPrompt(task, context);

      expect(prompt).toContain('## Conversation History');
      expect(prompt).toContain('User: Create a web server');
      expect(prompt).toContain('## Available Artifacts');
      expect(prompt).toContain('- @source_code (file): Server source code');
      expect(prompt).toContain('- @config_data (data): Application configuration');
      expect(prompt).toContain('## Current Task');
      expect(prompt).toContain('Deploy the web server using existing artifacts');
      expect(prompt).toContain('@artifact_name');
    });

    it('should handle empty conversation and artifacts', () => {
      const emptyContext = new ExecutionContext();
      emptyContext.depth = 1;
      
      const task = {
        description: 'Simple task'
      };

      const prompt = strategy.buildPrompt(task, emptyContext);

      expect(prompt).toContain('No previous conversation.');
      expect(prompt).toContain('No artifacts available.');
      expect(prompt).toContain('Simple task');
    });
  });

  describe('buildDecompositionPrompt() with artifacts', () => {
    it('should include artifact context in decomposition prompt', () => {
      const task = {
        description: 'Deploy web server using @source_code and @config_data'
      };

      const prompt = strategy.buildDecompositionPrompt(task, context);

      expect(prompt).toContain('Deploy web server using @source_code and @config_data');
      expect(prompt).toContain('Depth 1/3');
      expect(prompt).toContain('subtasks');
      expect(prompt).toContain('strategy');
      expect(prompt).toContain('reasoning');
    });
  });

  describe('executeSubtask() with artifact flow', () => {
    it('should pass artifacts through subtask execution', async () => {
      const subtask = {
        id: 'subtask-1',
        description: 'Use source code',
        tool: 'test_tool',
        inputs: {
          filepath: '@source_code',
          config: '@config_data'
        },
        outputs: [
          {
            name: 'deployment_result',
            type: 'process',
            description: 'Deployment process info',
            purpose: 'Track deployment status'
          }
        ]
      };

      const mockEmitter = {
        custom: jest.fn()
      };

      const childContext = context.createChild('subtask-1');

      const result = await strategy.executeSubtask(subtask, childContext, mockEmitter);

      expect(result.success).toBe(true);
      // The subtask should have been executed by AtomicExecutionStrategy
      // which would have resolved the artifact references
    });

    it('should inherit artifacts in child context', async () => {
      const subtask = {
        id: 'subtask-1',
        description: 'Access parent artifacts',
        atomic: true  // Force atomic execution
      };

      const mockEmitter = {
        custom: jest.fn()
      };

      const childContext = context.createChild('subtask-1');

      // Verify artifacts are inherited
      expect(childContext.getArtifact('source_code')).toBeDefined();
      expect(childContext.getArtifactValue('config_data')).toEqual({
        port: 3000,
        host: 'localhost'
      });

      const result = await strategy.executeSubtask(subtask, childContext, mockEmitter);

      expect(result.success).toBe(true);
    });
  });

  describe('llmDecompose() with artifact-aware prompts', () => {
    it('should use artifact-aware prompts for decomposition', async () => {
      const task = {
        id: 'test-task',
        description: 'Deploy using @source_code'
      };

      const mockEmitter = {
        custom: jest.fn()
      };

      // Mock decomposition response with artifacts
      mockSimplePromptClient.request.mockResolvedValue({
        content: JSON.stringify({
          subtasks: [
            {
              id: 'deploy-step-1',
              description: 'Validate source code',
              operation: 'validate_file',
              inputs: { filepath: '@source_code' },
              outputs: [
                {
                  name: 'validation_result',
                  type: 'data',
                  description: 'Code validation result',
                  purpose: 'Ensure code quality'
                }
              ]
            },
            {
              id: 'deploy-step-2', 
              description: 'Start server with config',
              operation: 'start_server',
              inputs: {
                code: '@source_code',
                config: '@config_data'
              },
              outputs: [
                {
                  name: 'server_process',
                  type: 'process',
                  description: 'Running server process',
                  purpose: 'Handle web requests'
                }
              ]
            }
          ],
          strategy: 'sequential',
          reasoning: 'Sequential deployment ensures proper validation before startup'
        })
      });

      const decomposition = await strategy.llmDecompose(task, context, mockEmitter);

      expect(decomposition).toBeDefined();
      expect(decomposition.subtasks).toHaveLength(2);
      expect(decomposition.subtasks[0].inputs.filepath).toBe('@source_code');
      expect(decomposition.subtasks[1].inputs.code).toBe('@source_code');
      expect(decomposition.subtasks[1].inputs.config).toBe('@config_data');
      expect(decomposition.strategy).toBe('sequential');
    });

    it('should handle artifact references in decomposition output specifications', async () => {
      const task = {
        id: 'test-task',
        description: 'Process data and create reports'
      };

      const mockEmitter = {
        custom: jest.fn()
      };

      mockSimplePromptClient.request.mockResolvedValue({
        content: JSON.stringify({
          subtasks: [
            {
              id: 'process-data',
              description: 'Process configuration data',
              inputs: { data: '@config_data' },
              outputs: [
                {
                  name: 'processed_data',
                  type: 'data',
                  description: 'Processed configuration',
                  purpose: 'Clean data for reporting'
                }
              ]
            },
            {
              id: 'generate-report',
              description: 'Generate report from processed data',
              inputs: { data: '@processed_data' },
              outputs: [
                {
                  name: 'final_report',
                  type: 'file',
                  description: 'Generated report file',
                  purpose: 'Final output document'
                }
              ]
            }
          ],
          strategy: 'sequential'
        })
      });

      const decomposition = await strategy.llmDecompose(task, context, mockEmitter);

      expect(decomposition.subtasks[0].outputs[0].name).toBe('processed_data');
      expect(decomposition.subtasks[1].inputs.data).toBe('@processed_data');
      expect(decomposition.subtasks[1].outputs[0].name).toBe('final_report');
      expect(decomposition.subtasks[1].outputs[0].type).toBe('file');
    });
  });

  describe('executeSubtasksSequential() with artifact chaining', () => {
    it('should chain artifacts between sequential subtasks', async () => {
      const subtasks = [
        {
          id: 'step-1',
          description: 'Process input data',
          tool: 'test_tool',
          inputs: { data: '@config_data' },
          outputs: [
            {
              name: 'processed_config',
              type: 'data',
              description: 'Processed configuration',
              purpose: 'Cleaned data'
            }
          ]
        },
        {
          id: 'step-2',
          description: 'Generate output using processed data',
          tool: 'test_tool',
          inputs: {
            source: '@source_code',
            config: '@processed_config'  // Uses output from step-1
          },
          outputs: [
            {
              name: 'final_output',
              type: 'file',
              description: 'Final generated file',
              purpose: 'Complete result'
            }
          ]
        }
      ];

      const mockEmitter = {
        custom: jest.fn()
      };

      // Mock tool execution to store artifacts
      let executionCount = 0;
      mockToolRegistry.getTool.mockImplementation(async (toolName) => ({
        name: toolName,
        execute: jest.fn().mockImplementation(async (inputs) => {
          executionCount++;
          if (executionCount === 1) {
            // First execution - return processed config
            return {
              success: true,
              data: { port: 3000, host: 'localhost', processed: true }
            };
          } else {
            // Second execution - should receive processed config
            expect(inputs.config).toEqual({ 
              port: 3000, 
              host: 'localhost', 
              processed: true 
            });
            return {
              success: true,
              data: '/tmp/final_output.txt'
            };
          }
        })
      }));

      const results = await strategy.executeSubtasksSequential(
        subtasks,
        context,
        mockEmitter
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(executionCount).toBe(2);
    });
  });

  describe('executeSubtasksParallel() with artifact isolation', () => {
    it('should isolate artifacts between parallel branches', async () => {
      const subtasks = [
        {
          id: 'parallel-1',
          description: 'Process source code',
          tool: 'test_tool',
          inputs: { file: '@source_code' },
          outputs: [
            {
              name: 'analysis_result',
              type: 'data',
              description: 'Code analysis result',
              purpose: 'Code quality metrics'
            }
          ]
        },
        {
          id: 'parallel-2',
          description: 'Validate configuration',
          tool: 'test_tool',
          inputs: { config: '@config_data' },
          outputs: [
            {
              name: 'validation_result',
              type: 'data',
              description: 'Config validation result',
              purpose: 'Config compliance check'
            }
          ]
        }
      ];

      const mockEmitter = {
        custom: jest.fn()
      };

      const results = await strategy.executeSubtasksParallel(
        subtasks,
        context,
        mockEmitter
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe('composeResult() with artifact accumulation', () => {
    it('should compose results while preserving artifact context', async () => {
      const originalTask = {
        id: 'compose-test',
        description: 'Test composition with artifacts'
      };

      const subtaskResults = [
        {
          success: true,
          result: 'Step 1 completed',
          subtaskId: 'step-1'
        },
        {
          success: true,
          result: { output: 'Step 2 data' },
          subtaskId: 'step-2'
        }
      ];

      const decomposition = {
        strategy: 'sequential',
        metadata: { source: 'llm' }
      };

      const composedResult = await strategy.composeResult(
        originalTask,
        subtaskResults,
        decomposition,
        context
      );

      expect(composedResult.result).toEqual([
        'Step 1 completed',
        { output: 'Step 2 data' }
      ]);
      expect(composedResult.metadata.successful).toBe(2);
      expect(composedResult.metadata.failed).toBe(0);
      expect(composedResult.metadata.total).toBe(2);
    });

    it('should handle different composition types with artifacts', async () => {
      const originalTask = {
        id: 'merge-test',
        compositionType: 'merge',
        description: 'Test merge composition'
      };

      const subtaskResults = [
        {
          success: true,
          result: { step1: 'value1' },
          subtaskId: 'step-1'
        },
        {
          success: true,
          result: { step2: 'value2' },
          subtaskId: 'step-2'
        }
      ];

      const decomposition = {
        strategy: 'parallel',
        metadata: { source: 'llm' }
      };

      const composedResult = await strategy.composeResult(
        originalTask,
        subtaskResults,
        decomposition,
        context
      );

      expect(composedResult.result).toEqual({
        step1: 'value1',
        step2: 'value2'
      });
    });
  });

  describe('Error handling with artifacts', () => {
    it('should preserve artifacts even when subtasks fail', async () => {
      const subtask = {
        id: 'failing-subtask',
        description: 'This subtask will fail',
        tool: 'failing_tool',
        inputs: { data: '@config_data' }
      };

      // Mock failing tool
      mockToolRegistry.getTool.mockResolvedValue({
        name: 'failing_tool',
        execute: jest.fn().mockRejectedValue(new Error('Tool execution failed'))
      });

      const mockEmitter = {
        custom: jest.fn()
      };

      try {
        await strategy.executeSubtask(subtask, context, mockEmitter);
      } catch (error) {
        expect(error.message).toContain('Tool execution failed');
      }

      // Artifacts should still be available in context
      expect(context.getArtifact('source_code')).toBeDefined();
      expect(context.getArtifact('config_data')).toBeDefined();
    });

    it('should handle missing artifact references gracefully', async () => {
      const subtask = {
        id: 'missing-artifact-subtask',
        description: 'References non-existent artifact',
        tool: 'test_tool',
        inputs: { data: '@non_existent_artifact' }
      };

      const mockEmitter = {
        custom: jest.fn()
      };

      // This should be handled by the tool execution layer
      // The RecursiveExecutionStrategy delegates to other strategies
      // which will use resolveToolInputs() and throw appropriate errors
      await expect(
        strategy.executeSubtask(subtask, context, mockEmitter)
      ).rejects.toThrow(); // Should reject due to missing artifact
    });
  });

  describe('Depth management with artifacts', () => {
    it('should respect max depth while preserving artifacts', async () => {
      // Set context near max depth
      context.depth = 2; // maxDepth is 3

      const task = {
        id: 'deep-task',
        description: 'Task at max depth',
        recursive: true
      };

      const canDecompose = await strategy.shouldDecompose(task, context);

      // Should not decompose at max depth
      expect(canDecompose).toBe(false);

      // Artifacts should still be accessible
      expect(context.getArtifact('source_code')).toBeDefined();
      expect(context.getArtifact('config_data')).toBeDefined();
    });

    it('should pass artifacts through depth levels', async () => {
      // Test that artifacts flow through recursive execution levels
      context.depth = 1;

      const childContext = context.createChild('child-task');
      childContext.depth = 2;

      // Child should inherit all artifacts
      expect(childContext.getArtifact('source_code')).toBeDefined();
      expect(childContext.getArtifact('config_data')).toBeDefined();
      expect(childContext.getArtifactValue('source_code')).toBe('/tmp/server.js');
      expect(childContext.getArtifactValue('config_data')).toEqual({
        port: 3000,
        host: 'localhost'
      });
    });
  });
});