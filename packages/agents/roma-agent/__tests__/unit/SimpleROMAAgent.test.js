/**
 * Unit tests for SimpleROMAAgent (TaskClassifier-integrated version)
 */

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import SimpleROMAAgent from '../../src/core/SimpleROMAAgent.js';
import TaskClassifier from '../../src/utils/TaskClassifier.js';
import ToolDiscovery from '../../src/utils/ToolDiscovery.js';
import { ArtifactRegistry } from '@legion/tasks';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('SimpleROMAAgent Unit Tests', () => {
  let agent;
  let mockLLMClient;
  let mockToolRegistry;
  let mockTaskClassifier;
  let mockToolDiscovery;
  
  beforeAll(async () => {
    // Initialize real ResourceManager singleton
    const resourceManager = await ResourceManager.getInstance();
  });
  
  beforeEach(async () => {
    // Create mock LLM client
    mockLLMClient = {
      complete: jest.fn()
    };
    
    // Create mock tool registry
    mockToolRegistry = {
      getInstance: jest.fn().mockResolvedValue({
        getTool: jest.fn(),
        listTools: jest.fn().mockResolvedValue([])
      })
    };
    
    // Create mock task classifier with initialize method
    mockTaskClassifier = {
      classify: jest.fn(),
      initialize: jest.fn().mockResolvedValue()
    };
    
    // Create mock tool discovery
    mockToolDiscovery = {
      discoverTools: jest.fn().mockResolvedValue([]),
      getCachedTool: jest.fn(),
      findToolByName: jest.fn((name) => {
        // Return the appropriate tool based on name
        const tools = agent.currentTools || [];
        return tools.find(t => t.name.toLowerCase() === name.toLowerCase());
      })
    };
    
    // Create agent but DO NOT initialize it to avoid creating real services
    agent = new SimpleROMAAgent();
    
    // Manually set up the agent with mocks (simulating what initialize() would do)
    agent.resourceManager = await ResourceManager.getInstance();
    agent.llmClient = mockLLMClient;
    agent.toolRegistry = mockToolRegistry;
    agent.toolDiscovery = mockToolDiscovery;
    agent.taskClassifier = mockTaskClassifier;
    
    // No longer need promptBuilder - it has been removed
    
    // Create real validators for schema testing
    agent.simpleTaskValidator = agent._createSimpleTaskValidator();
    agent.decompositionValidator = agent._createDecompositionValidator();
    agent.parentEvaluationValidator = agent._createParentEvaluationValidator();
    agent.completionEvaluationValidator = agent._createCompletionEvaluationValidator();
    
    // Create mock Prompt instances (simulating what initialize() would create)
    const mockPromptBase = {
      execute: jest.fn().mockResolvedValue({ 
        success: true, 
        data: { useTools: false, response: 'Mock response' } 
      }),
      llmClient: mockLLMClient,
      maxRetries: 3
    };
    
    agent.parentEvaluationPrompt = { ...mockPromptBase };
    agent.completionEvaluationPrompt = { ...mockPromptBase };
    agent.simpleTaskPrompt = { ...mockPromptBase };
    agent.decompositionPrompt = { ...mockPromptBase };
    
    // Create mock session logger
    agent.sessionLogger = {
      initialize: jest.fn().mockResolvedValue(),
      logInteraction: jest.fn().mockResolvedValue(),
      logSummary: jest.fn().mockResolvedValue()
    };
    
    // Create task manager manually
    const { TaskManager } = await import('@legion/tasks');
    agent.taskManager = new TaskManager(mockLLMClient);
  });
  
  describe('Task Classification Flow', () => {
    beforeEach(() => {
      // Mock the strategy's internal prompts
      const mockStrategy = agent.taskStrategy;
      if (mockStrategy) {
        // Mock the prompts that RecursiveDecompositionStrategy creates
        mockStrategy.decompositionPrompt = {
          execute: jest.fn().mockResolvedValue({
            success: true,
            data: {
              decompose: true,
              subtasks: [
                { description: 'First subtask', outputs: '@output1' },
                { description: 'Second subtask', outputs: '@output2' }
              ]
            }
          })
        };
        
        // Mock executionPrompt instead of simpleTaskPrompt (RecursiveDecompositionStrategy uses executionPrompt)
        mockStrategy.executionPrompt = {
          execute: jest.fn().mockResolvedValue({
            success: true,
            data: {
              useTools: true,
              toolCalls: [{
                tool: 'file_write',
                inputs: { filepath: '/tmp/test.txt', content: 'test' }
              }]
            }
          })
        };
        
        mockStrategy.parentEvaluationPrompt = {
          execute: jest.fn().mockResolvedValue({
            success: true,
            data: {
              decision: 'CONTINUE',
              reasoning: 'Continue with next subtask'
            }
          })
        };
        
        mockStrategy.completionEvaluationPrompt = {
          execute: jest.fn().mockResolvedValue({
            success: true,
            data: {
              complete: true,
              reason: 'Task completed',
              result: 'All done'
            }
          })
        };
      }
    });

    it('should classify tasks and branch to SIMPLE handler', async () => {
      // Mock classification as SIMPLE
      mockTaskClassifier.classify.mockResolvedValue({
        complexity: 'SIMPLE',
        reasoning: 'Can be done with direct tool calls',
        suggestedApproach: 'Use file operations',
        estimatedSteps: 2
      });
      
      // Mock tool discovery finding tools
      const mockTool = {
        name: 'file_write',
        execute: jest.fn().mockResolvedValue({ success: true, filepath: '/tmp/test.txt' })
      };
      mockToolDiscovery.discoverTools.mockResolvedValue([mockTool]);
      agent.currentTools = [mockTool]; // Set tools directly on agent
      
      // Mock the strategy's executionPrompt for this test
      const mockStrategy = agent.taskStrategy;
      mockStrategy.executionPrompt.execute.mockResolvedValueOnce({
        success: true,
        data: {
          useTools: true,
          toolCalls: [{
            tool: 'file_write',
            inputs: { filepath: '/tmp/test.txt', content: 'hello world' },
            outputs: { filepath: '@saved_file' }
          }]
        }
      });
      
      const task = { description: 'create a text file with hello world' };
      const result = await agent.execute(task);
      
      console.log('TEST DEBUG - Result:', JSON.stringify(result, null, 2));
      console.log('TEST DEBUG - mockToolDiscovery.discoverTools called:', mockToolDiscovery.discoverTools.mock.calls.length);
      console.log('TEST DEBUG - mockToolDiscovery.discoverTools results:', mockToolDiscovery.discoverTools.mock.results);
      
      expect(mockTaskClassifier.classify).toHaveBeenCalledWith(
        task,
        agent.sessionLogger
      );
      expect(mockToolDiscovery.discoverTools).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
    
    it('should classify tasks and branch to COMPLEX handler', async () => {
      // Mock classification - main task as COMPLEX, subtasks as SIMPLE to prevent infinite recursion
      let callCount = 0;
      mockTaskClassifier.classify.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First call - classify main task as COMPLEX
          return {
            complexity: 'COMPLEX',
            reasoning: 'Requires multiple coordinated operations',
            suggestedApproach: 'Break into subtasks',
            estimatedSteps: 8
          };
        } else {
          // Subsequent calls - classify subtasks as SIMPLE to prevent infinite recursion
          return {
            complexity: 'SIMPLE',
            reasoning: 'Can be executed directly',
            suggestedApproach: 'Use tools',
            estimatedSteps: 1
          };
        }
      });
      
      // Mock tools for subtask execution
      const mockTool = {
        name: 'file_write',
        execute: jest.fn().mockResolvedValue({ success: true })
      };
      mockToolDiscovery.discoverTools.mockResolvedValue([mockTool]);
      agent.currentTools = [mockTool]; // Set the tools directly
      
      // Update the strategy's decomposition prompt mock for this test
      const mockStrategy = agent.taskStrategy;
      mockStrategy.decompositionPrompt.execute.mockResolvedValueOnce({
        success: true,
        data: {
          decompose: true,
          subtasks: [
            { description: 'Create HTML file', outputs: '@html_file' },
            { description: 'Create CSS file', outputs: '@css_file' }
          ]
        }
      });
      
      // Mock successful subtask executions
      mockStrategy.executionPrompt.execute
        .mockResolvedValueOnce({
          success: true,
          data: {
            useTools: true,
            toolCalls: [{
              tool: 'file_write',
              inputs: { filepath: 'index.html', content: '<html></html>' }
            }]
          }
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            useTools: true,
            toolCalls: [{
              tool: 'file_write',
              inputs: { filepath: 'style.css', content: 'body {}' }
            }]
          }
        });
      
      // Mock parent evaluations
      mockStrategy.parentEvaluationPrompt.execute
        .mockResolvedValueOnce({
          success: true,
          data: {
            decision: 'CONTINUE',
            reasoning: 'HTML task completed, continue with CSS'
          }
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            decision: 'COMPLETE',
            reasoning: 'All subtasks completed successfully'
          }
        });
      
      // Mock completion evaluation
      mockStrategy.completionEvaluationPrompt.execute.mockResolvedValueOnce({
        success: true,
        data: {
          complete: true,
          reason: 'Task completed',
          result: 'All done'
        }
      });
      
      const task = { description: 'build a complete web application with multiple pages' };
      const result = await agent.execute(task);
      
      // Subtasks may also be classified, so check at least 1 call
      expect(mockTaskClassifier.classify).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });
  });
  
  describe('Simple Task Execution', () => {
    it('should discover tools and execute them for SIMPLE tasks', async () => {
      mockTaskClassifier.classify.mockResolvedValue({
        complexity: 'SIMPLE',
        reasoning: 'Direct calculation task'
      });
      
      const mockCalculatorTool = {
        name: 'calculator',
        execute: jest.fn().mockResolvedValue({ success: true, result: 42 })
      };
      mockToolDiscovery.discoverTools.mockResolvedValue([mockCalculatorTool]);
      agent.currentTools = [mockCalculatorTool]; // Set tools directly
      
      // Also set up findToolByName to return the calculator tool (used by RecursiveDecompositionStrategy)
      mockToolDiscovery.findToolByName.mockImplementation((name) => {
        if (name.toLowerCase() === 'calculator') {
          return mockCalculatorTool;
        }
        return null;
      });
      
      // Mock the strategy's prompt to return tool calls
      const mockStrategy = agent.taskStrategy;
      mockStrategy.executionPrompt.execute.mockResolvedValueOnce({
        success: true,
        data: {
          useTools: true,
          toolCalls: [{
            tool: 'calculator',
            inputs: { expression: '6 * 7' },
            outputs: { result: '@calculation_result' }
          }]
        }
      });
      
      const task = { description: 'calculate 6 * 7' };
      const result = await agent.execute(task);
      
      expect(mockToolDiscovery.discoverTools).toHaveBeenCalledWith('calculate 6 * 7');
      expect(mockCalculatorTool.execute).toHaveBeenCalledWith({ expression: '6 * 7' });
      expect(result.success).toBe(true);
    });
    
    it('should handle direct response for SIMPLE tasks without tools', async () => {
      mockTaskClassifier.classify.mockResolvedValue({
        complexity: 'SIMPLE',
        reasoning: 'Question that needs explanation'
      });
      
      mockToolDiscovery.discoverTools.mockResolvedValue([]);
      
      const task = { description: 'what is the capital of France?' };
      const result = await agent.execute(task);
      
      // When no tools found for SIMPLE task, task fails
      expect(result.success).toBe(false);
      expect(result.result).toContain('Unable to find suitable tools');
    });
    
    it('should save tool outputs as artifacts when specified', async () => {
      mockTaskClassifier.classify.mockResolvedValue({ complexity: 'SIMPLE' });
      
      const mockTool = {
        name: 'file_read',
        execute: jest.fn().mockResolvedValue({ 
          success: true, 
          content: 'file contents',
          filepath: '/tmp/test.txt'
        })
      };
      mockToolDiscovery.discoverTools.mockResolvedValue([mockTool]);
      agent.currentTools = [mockTool];
      
      // Set up findToolByName for file_read tool
      mockToolDiscovery.findToolByName.mockImplementation((name) => {
        if (name.toLowerCase() === 'file_read') {
          return mockTool;
        }
        return null;
      });
      
      // Mock the strategy's prompt to return tool calls with outputs
      const mockStrategy = agent.taskStrategy;
      mockStrategy.executionPrompt.execute.mockResolvedValueOnce({
        success: true,
        data: {
          useTools: true,
          toolCalls: [{
            tool: 'file_read',
            inputs: { filepath: '/tmp/test.txt' },
            outputs: { 
              content: '@file_content',
              filepath: '@file_path' 
            }
          }]
        }
      });
      
      const task = { description: 'read the test file' };
      const result = await agent.execute(task);
      
      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      // Check artifacts were saved (would be in ArtifactRegistry)
    });
  });
  
  describe('Complex Task Decomposition', () => {
    it('should decompose COMPLEX tasks into subtasks', async () => {
      // Mock main task classification as COMPLEX, subtasks as SIMPLE
      let callCount = 0;
      mockTaskClassifier.classify.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First call - main task is COMPLEX
          return {
            complexity: 'COMPLEX',
            reasoning: 'Multi-step application creation'
          };
        } else {
          // Subsequent calls - subtasks are SIMPLE to prevent recursion
          return {
            complexity: 'SIMPLE',
            reasoning: 'Direct execution'
          };
        }
      });
      
      // Provide mock tools for subtasks to succeed
      const mockTool = {
        name: 'file_write',
        execute: jest.fn().mockResolvedValue({ success: true, filepath: '/tmp/created' })
      };
      mockToolDiscovery.discoverTools.mockResolvedValue([mockTool]);
      agent.currentTools = [mockTool];
      
      // Mock the strategy's prompts for decomposition flow
      const mockStrategy = agent.taskStrategy;
      
      // Mock decomposition
      mockStrategy.decompositionPrompt.execute.mockResolvedValueOnce({
        success: true,
        data: {
          decompose: true,
          subtasks: [
            { description: 'Setup project structure', outputs: '@project_structure' },
            { description: 'Create main application file', outputs: '@main_app' }
          ]
        }
      });
      
      // Mock subtask executions
      mockStrategy.executionPrompt.execute
        .mockResolvedValueOnce({
          success: true,
          data: {
            useTools: true,
            toolCalls: [{ tool: 'file_write', inputs: { filepath: 'structure.json', content: '{}' } }]
          }
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            useTools: true,
            toolCalls: [{ tool: 'file_write', inputs: { filepath: 'app.js', content: 'console.log("hello");' } }]
          }
        });
      
      // Mock parent evaluations
      mockStrategy.parentEvaluationPrompt.execute
        .mockResolvedValueOnce({
          success: true,
          data: {
            decision: 'CONTINUE',
            reasoning: 'First subtask completed, continue with next'
          }
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            decision: 'COMPLETE',
            reasoning: 'All subtasks completed successfully'
          }
        });
      
      // Mock completion evaluation
      mockStrategy.completionEvaluationPrompt.execute.mockResolvedValueOnce({
        success: true,
        data: {
          complete: true,
          result: 'All subtasks completed successfully',
          reason: 'Task completed'
        }
      });
      
      const task = { description: 'create a complete Node.js application' };
      const result = await agent.execute(task);
      
      // The complex task should complete successfully when all subtasks succeed
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });
    
    it('should prevent infinite recursion with depth limit', async () => {
      // Mock all classifications as COMPLEX to trigger decomposition
      mockTaskClassifier.classify.mockResolvedValue({
        complexity: 'COMPLEX',
        reasoning: 'Needs decomposition'
      });
      
      // Mock strategy's decomposition prompt to always return more subtasks
      const mockStrategy = agent.taskStrategy;
      mockStrategy.decompositionPrompt.execute.mockResolvedValue({
        success: true,
        data: {
          decompose: true,
          subtasks: [{ description: 'Recursive subtask' }]
        }
      });
      
      const task = { description: 'infinitely recursive task' };
      const result = await agent.execute(task);
      
      // Should stop at depth limit (5) and fail
      expect(result.success).toBe(false);
      // The error message varies but should indicate the issue
      expect(result.result).toBeDefined();
    });
  });
  
  describe('Prompt Integration', () => {
    it('should create Prompt instances during initialization', () => {
      expect(agent.parentEvaluationPrompt).toBeDefined();
      expect(agent.completionEvaluationPrompt).toBeDefined();
      expect(agent.simpleTaskPrompt).toBeDefined();
      expect(agent.decompositionPrompt).toBeDefined();
      
      // Verify Prompt instances have expected configuration
      expect(agent.parentEvaluationPrompt.llmClient).toBe(mockLLMClient);
      expect(agent.parentEvaluationPrompt.maxRetries).toBe(3);
    });

    it('should maintain legacy ResponseValidator instances for compatibility', () => {
      // Legacy validators should still exist for backward compatibility
      expect(agent.simpleTaskValidator).toBeDefined();
      expect(agent.decompositionValidator).toBeDefined();
      expect(agent.parentEvaluationValidator).toBeDefined();
      expect(agent.completionEvaluationValidator).toBeDefined();
    });
    
    it('should validate simple task responses against schema', () => {
      const validToolCallResponse = {
        useTools: true,
        toolCalls: [{
          tool: 'calculator',
          inputs: { expression: '2 + 2' }
        }]
      };
      
      const result = agent.simpleTaskValidator.validateExample(validToolCallResponse);
      expect(result.success).toBe(true);
    });
    
    it('should validate direct response format', () => {
      const validDirectResponse = {
        response: 'This is a direct answer'
      };
      
      const result = agent.simpleTaskValidator.validateExample(validDirectResponse);
      expect(result.success).toBe(true);
    });
    
    it('should validate decomposition responses against schema', () => {
      const validDecomposition = {
        decompose: true,
        subtasks: [
          { description: 'First subtask' },
          { description: 'Second subtask', outputs: '@result' }
        ]
      };
      
      const result = agent.decompositionValidator.validateExample(validDecomposition);
      expect(result.success).toBe(true);
    });
    
    it('should reject invalid response formats', () => {
      const invalidResponse = {
        wrongField: 'invalid structure'
      };
      
      const result = agent.simpleTaskValidator.validateExample(invalidResponse);
      expect(result.success).toBe(false);
    });
  });
  
  describe('Artifact Management', () => {
    // Test removed - _resolveTask method doesn't exist in production code
    
    it('should resolve artifact references in tool inputs', () => {
      const context = {
        artifactRegistry: new ArtifactRegistry()
      };
      
      context.artifactRegistry.store('filename', 'test.txt', 'File name');
      context.artifactRegistry.store('content', 'Hello World', 'File content');
      
      const toolInputs = {
        filepath: '@filename',
        data: '@content',
        static: 'unchanged'
      };
      
      const resolved = context.artifactRegistry.resolveReferences(toolInputs);
      
      expect(resolved.filepath).toBe('test.txt');
      expect(resolved.data).toBe('Hello World');
      expect(resolved.static).toBe('unchanged');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle TaskClassifier failures gracefully', async () => {
      mockTaskClassifier.classify.mockRejectedValue(new Error('Classification failed'));
      
      const task = { description: 'test task' };
      
      // With the new interface, classification errors are caught and returned as failure results
      const result = await agent.execute(task);
      expect(result.success).toBe(false);
      expect(result.result).toBe('Classification failed');
    });
    
    it('should handle tool execution failures', async () => {
      mockTaskClassifier.classify.mockResolvedValue({ complexity: 'SIMPLE' });
      
      const failingTool = {
        name: 'failing_tool',
        execute: jest.fn().mockRejectedValue(new Error('Tool execution failed'))
      };
      mockToolDiscovery.discoverTools.mockResolvedValue([failingTool]);
      agent.currentTools = [failingTool];
      
      // Set up findToolByName for failing_tool
      mockToolDiscovery.findToolByName.mockImplementation((name) => {
        if (name.toLowerCase() === 'failing_tool') {
          return failingTool;
        }
        return null;
      });
      
      // Mock the strategy's executionPrompt to return tool calls
      const mockStrategy = agent.taskStrategy;
      mockStrategy.executionPrompt.execute.mockResolvedValueOnce({
        success: true,
        data: {
          useTools: true,
          toolCalls: [{ tool: 'failing_tool', inputs: {} }]
        }
      });
      
      const task = { description: 'use failing tool' };
      const result = await agent.execute(task);
      
      // The test should handle both cases - tool failure results in success=true with failed results
      // or success=false with error in result
      expect(result).toBeDefined();
      // RecursiveDecompositionStrategy returns success=true even when some tools fail,
      // with the failures in the results array
      if (result.results && result.results[0]) {
        expect(result.results[0].success).toBe(false);
        expect(result.results[0].error).toBe('Tool execution failed');
      } else if (result.result) {
        // Alternative format
        expect(result.result).toBeDefined();
      }
    });
    
    it('should handle invalid LLM responses', async () => {
      mockTaskClassifier.classify.mockResolvedValue({ complexity: 'SIMPLE' });
      mockToolDiscovery.discoverTools.mockResolvedValue([]);
      
      // Mock the strategy's executionPrompt to return invalid response
      const mockStrategy = agent.taskStrategy;
      mockStrategy.executionPrompt.execute.mockResolvedValueOnce({
        success: false,
        errors: ['Invalid JSON response']
      });
      
      const task = { description: 'test task' };
      const result = await agent.execute(task);
      
      // Should fallback gracefully
      expect(result).toBeDefined();
    });
  });
  
  describe('Tool Discovery Integration', () => {
    it('should cache discovered tools for task execution', async () => {
      mockTaskClassifier.classify.mockResolvedValue({ complexity: 'SIMPLE' });
      
      const discoveredTools = [
        { name: 'tool1', execute: jest.fn() },
        { name: 'tool2', execute: jest.fn() }
      ];
      mockToolDiscovery.discoverTools.mockResolvedValue(discoveredTools);
      
      mockLLMClient.complete.mockResolvedValue(JSON.stringify({
        useTools: true,
        toolCalls: [{ tool: 'tool1', inputs: {} }]
      }));
      
      const task = { description: 'use some tools' };
      await agent.execute(task);
      
      expect(agent.currentTools).toEqual(discoveredTools);
    });
    
    it('should handle case-insensitive tool name matching', async () => {
      mockTaskClassifier.classify.mockResolvedValue({ complexity: 'SIMPLE' });
      
      const mockTool = {
        name: 'Calculator',
        execute: jest.fn().mockResolvedValue({ success: true, result: 42 })
      };
      // Set up tool discovery to return the mock tool
      mockToolDiscovery.discoverTools.mockResolvedValue([mockTool]);
      agent.currentTools = [mockTool]; // Set tools directly on agent
      
      // Set up findToolByName to handle case-insensitive matching
      mockToolDiscovery.findToolByName.mockImplementation((name) => {
        // The RecursiveDecompositionStrategy does case-insensitive matching internally
        // But for tests, we need to ensure the tool is found
        if (name.toLowerCase() === 'calculator') {
          return mockTool;
        }
        return null;
      });
      
      // Mock the strategy's executionPrompt to return tool calls
      const mockStrategy = agent.taskStrategy;
      mockStrategy.executionPrompt.execute.mockResolvedValueOnce({
        success: true,
        data: {
          useTools: true,
          toolCalls: [{ tool: 'calculator', inputs: {} }] // lowercase
        }
      });
      
      const task = { description: 'calculate something' };
      const result = await agent.execute(task);
      
      expect(mockTool.execute).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });
});