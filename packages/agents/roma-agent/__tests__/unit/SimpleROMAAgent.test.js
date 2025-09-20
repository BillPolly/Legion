/**
 * Unit tests for SimpleROMAAgent (TaskClassifier-integrated version)
 */

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import SimpleROMAAgent from '../../src/core/SimpleROMAAgent.js';
import TaskClassifier from '../../src/utils/TaskClassifier.js';
import ToolDiscovery from '../../src/utils/ToolDiscovery.js';
import ArtifactRegistry from '../../src/core/ArtifactRegistry.js';
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
      getCachedTool: jest.fn()
    };
    
    // Create agent but DO NOT initialize it to avoid creating real services
    agent = new SimpleROMAAgent();
    
    // Manually set up the agent with mocks (simulating what initialize() would do)
    agent.resourceManager = await ResourceManager.getInstance();
    agent.llmClient = mockLLMClient;
    agent.toolRegistry = mockToolRegistry;
    agent.toolDiscovery = mockToolDiscovery;
    agent.taskClassifier = mockTaskClassifier;
    
    // Create real validators for schema testing
    agent.simpleTaskValidator = agent._createSimpleTaskValidator();
    agent.decompositionValidator = agent._createDecompositionValidator();
    agent.parentEvaluationValidator = agent._createParentEvaluationValidator();
    agent.completionEvaluationValidator = agent._createCompletionEvaluationValidator();
    
    // Create mock Prompt instances (simulating what initialize() would create)
    const mockPromptBase = {
      executeCustom: jest.fn(),
      execute: jest.fn(),
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
    const TaskManager = (await import('../../src/core/TaskManager.js')).default;
    agent.taskManager = new TaskManager(mockLLMClient);
  });
  
  describe('Task Classification Flow', () => {
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
      
      // Mock LLM response for simple task execution
      mockLLMClient.complete.mockResolvedValue(JSON.stringify({
        useTools: true,
        toolCalls: [{
          tool: 'file_write',
          inputs: { filepath: '/tmp/test.txt', content: 'hello world' },
          outputs: { filepath: '@saved_file' }
        }]
      }));
      
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
      // Mock classification - first call for main task
      mockTaskClassifier.classify
        .mockResolvedValueOnce({
          complexity: 'COMPLEX',
          reasoning: 'Requires multiple coordinated operations',
          suggestedApproach: 'Break into subtasks',
          estimatedSteps: 8
        })
        // Second call for first subtask
        .mockResolvedValueOnce({ 
          complexity: 'SIMPLE', 
          reasoning: 'HTML subtask' 
        })
        // Third call for second subtask
        .mockResolvedValueOnce({ 
          complexity: 'SIMPLE', 
          reasoning: 'CSS subtask' 
        });
      
      // Mock tools found for subtasks so they can succeed
      const mockTool = {
        name: 'file_write',
        execute: jest.fn().mockResolvedValue({ success: true })
      };
      mockToolDiscovery.discoverTools
        .mockResolvedValueOnce([mockTool])  // For HTML subtask
        .mockResolvedValueOnce([mockTool]); // For CSS subtask
      
      // Set up proper LLM call sequence (6 calls total):
      // 1. Main task decomposition
      // 2. HTML subtask execution  
      // 3. Parent evaluates after HTML subtask
      // 4. CSS subtask execution
      // 5. Parent evaluates after CSS subtask  
      // 6. Parent completion evaluation
      mockLLMClient.complete = jest.fn()
        // 1. Main task decomposition
        .mockResolvedValueOnce(JSON.stringify({
          decompose: true,
          subtasks: [
            { description: 'Create HTML file', outputs: '@html_file' },
            { description: 'Create CSS file', outputs: '@css_file' }
          ]
        }))
        // 2. HTML subtask execution
        .mockResolvedValueOnce(JSON.stringify({
          useTools: true,
          toolCalls: [{
            tool: 'file_write',
            inputs: { filepath: 'index.html', content: '<html></html>' }
          }]
        }))
        // 3. Parent evaluates after HTML subtask
        .mockResolvedValueOnce(JSON.stringify({ 
          decision: 'CONTINUE',
          reasoning: 'HTML task completed, continue with CSS'
        }))
        // 4. CSS subtask execution
        .mockResolvedValueOnce(JSON.stringify({
          useTools: true,
          toolCalls: [{
            tool: 'file_write',
            inputs: { filepath: 'style.css', content: 'body {}' }
          }]
        }))
        // 5. Parent evaluates after CSS subtask - should continue to completion evaluation
        .mockResolvedValueOnce(JSON.stringify({ 
          decision: 'COMPLETE',
          reasoning: 'All subtasks completed successfully'
        }))
        // 6. Parent completion evaluation (after step 5 action: complete)
        .mockResolvedValueOnce(JSON.stringify({
          complete: true,
          result: 'All done',
          reason: 'Task completed'
        }))
        // Fallback response in case there's an extra call
        .mockResolvedValue(JSON.stringify({
          complete: true,
          result: 'All done',
          reason: 'Fallback response'
        }));
      
      const task = { description: 'build a complete web application with multiple pages' };
      const result = await agent.execute(task);
      
      expect(mockTaskClassifier.classify).toHaveBeenCalledTimes(3); // Main + 2 subtasks
      expect(mockLLMClient.complete.mock.calls.length).toBeGreaterThanOrEqual(6); // At least 6 calls
      expect(result.success).toBe(true);
      expect(result.result.message).toBe('Task completed');
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
      
      mockLLMClient.complete.mockResolvedValue(JSON.stringify({
        useTools: true,
        toolCalls: [{
          tool: 'calculator',
          inputs: { expression: '6 * 7' },
          outputs: { result: '@calculation_result' }
        }]
      }));
      
      agent.currentTools = [mockCalculatorTool]; // Simulate discovered tools
      
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
      
      mockLLMClient.complete.mockResolvedValue(JSON.stringify({
        useTools: true,
        toolCalls: [{
          tool: 'file_read',
          inputs: { filepath: '/tmp/test.txt' },
          outputs: { 
            content: '@file_content',
            filepath: '@file_path' 
          }
        }]
      }));
      
      agent.currentTools = [mockTool];
      
      const task = { description: 'read the test file' };
      const result = await agent.execute(task);
      
      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      // Check artifacts were saved (would be in ArtifactRegistry)
    });
  });
  
  describe('Complex Task Decomposition', () => {
    it('should decompose COMPLEX tasks into subtasks', async () => {
      // Mock first call to classify main task as COMPLEX
      mockTaskClassifier.classify
        .mockResolvedValueOnce({
          complexity: 'COMPLEX',
          reasoning: 'Multi-step application creation'
        })
        // Then mock each subtask classification as SIMPLE
        .mockResolvedValueOnce({ complexity: 'SIMPLE', reasoning: 'Simple setup task' })
        .mockResolvedValueOnce({ complexity: 'SIMPLE', reasoning: 'Simple file creation' })
        .mockResolvedValueOnce({ complexity: 'SIMPLE', reasoning: 'Simple config task' });
      
      // Provide mock tools for subtasks to succeed
      const mockTool = {
        name: 'file_write',
        execute: jest.fn().mockResolvedValue({ success: true, filepath: '/tmp/created' })
      };
      mockToolDiscovery.discoverTools.mockResolvedValue([mockTool]);
      
      // Set up comprehensive LLM call sequence (based on the working test above)
      // Complex tasks require many LLM calls for decomposition, subtask execution, and parent evaluations
      mockLLMClient.complete = jest.fn()
        // 1. Main task decomposition
        .mockResolvedValueOnce(JSON.stringify({
          decompose: true,
          subtasks: [
            { description: 'Setup project structure', outputs: '@project_structure' },
            { description: 'Create main application file', outputs: '@main_app' }
          ]
        }))
        // 2. First subtask execution
        .mockResolvedValueOnce(JSON.stringify({
          useTools: true,
          toolCalls: [{ tool: 'file_write', inputs: { filepath: 'structure.json', content: '{}' } }]
        }))
        // 3. Parent evaluates after first subtask
        .mockResolvedValueOnce(JSON.stringify({ 
          decision: 'CONTINUE',
          reasoning: 'First subtask completed, continue with next'
        }))
        // 4. Second subtask execution
        .mockResolvedValueOnce(JSON.stringify({
          useTools: true,
          toolCalls: [{ tool: 'file_write', inputs: { filepath: 'app.js', content: 'console.log("hello");' } }]
        }))
        // 5. Parent evaluates after second subtask - should complete
        .mockResolvedValueOnce(JSON.stringify({ 
          decision: 'COMPLETE',
          reasoning: 'All subtasks completed successfully'
        }))
        // 6. Parent completion evaluation
        .mockResolvedValueOnce(JSON.stringify({
          complete: true,
          result: 'All subtasks completed successfully',
          reason: 'Task completed'
        }))
        // 7-10. Additional fallback responses for any extra calls
        .mockResolvedValue(JSON.stringify({
          complete: true,
          result: { success: true, message: 'All subtasks completed successfully' },
          reason: 'Fallback response'
        }));
      
      const task = { description: 'create a complete Node.js application' };
      const result = await agent.execute(task);
      
      console.log('TEST DEBUG - Complex task result:', JSON.stringify(result, null, 2));
      console.log('TEST DEBUG - LLM calls:', mockLLMClient.complete.mock.calls.length);
      
      // The complex task should complete successfully when all subtasks succeed
      expect(result.success).toBe(true);
      expect(result.result.message).toBe('Task completed');
    });
    
    it('should prevent infinite recursion with depth limit', async () => {
      // Mock all classifications as COMPLEX to trigger decomposition
      mockTaskClassifier.classify.mockResolvedValue({
        complexity: 'COMPLEX',
        reasoning: 'Needs decomposition'
      });
      
      // Mock LLM to always return decomposition (will hit depth limit)
      mockLLMClient.complete.mockResolvedValue(JSON.stringify({
        decompose: true,
        subtasks: [{ description: 'Recursive subtask' }]
      }));
      
      const task = { description: 'infinitely recursive task' };
      const result = await agent.execute(task);
      
      // Should stop at depth limit (5) and fail
      expect(result.success).toBe(false);
      expect(result.result).toMatch(/Maximum recursion depth exceeded|Unable to complete task/);
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
    it('should resolve artifact references in task descriptions', () => {
      const context = {
        artifactRegistry: new ArtifactRegistry()
      };
      
      // Store some artifacts
      context.artifactRegistry.store('test_data', 'sample content', 'Test data');
      context.artifactRegistry.store('count', 42, 'Number value');
      
      const taskWithReferences = {
        description: 'Process @test_data and multiply @count by 2'
      };
      
      const resolved = agent._resolveTask(taskWithReferences, context);
      
      expect(resolved.description).toBe('Process sample content and multiply 42 by 2');
    });
    
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
      
      mockLLMClient.complete.mockResolvedValue(JSON.stringify({
        useTools: true,
        toolCalls: [{ tool: 'failing_tool', inputs: {} }]
      }));
      
      agent.currentTools = [failingTool];
      
      const task = { description: 'use failing tool' };
      const result = await agent.execute(task);
      
      expect(result.success).toBe(false);
      expect(result.results[0].error).toBe('Tool execution failed');
    });
    
    it('should handle invalid LLM responses', async () => {
      mockTaskClassifier.classify.mockResolvedValue({ complexity: 'SIMPLE' });
      mockToolDiscovery.discoverTools.mockResolvedValue([]);
      
      // Invalid JSON response
      mockLLMClient.complete.mockResolvedValue('Invalid JSON response');
      
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
        execute: jest.fn().mockResolvedValue({ success: true })
      };
      // Set up tool discovery to return the mock tool
      mockToolDiscovery.discoverTools.mockResolvedValue([mockTool]);
      
      mockLLMClient.complete.mockResolvedValue(JSON.stringify({
        useTools: true,
        toolCalls: [{ tool: 'calculator', inputs: {} }] // lowercase
      }));
      
      const task = { description: 'calculate something' };
      const result = await agent.execute(task);
      
      expect(mockTool.execute).toHaveBeenCalled();
    });
  });
});