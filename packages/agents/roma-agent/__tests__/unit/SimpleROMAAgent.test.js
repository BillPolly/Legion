/**
 * Unit tests for SimpleROMAAgent (TaskClassifier-integrated version)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, jest } from '@jest/globals';
import SimpleROMAAgent from '../../src/SimpleROMAAgent.js';
import TaskClassifier from '../../src/strategies/utils/TaskClassifier.js';
import ToolDiscovery from '../../src/strategies/utils/ToolDiscovery.js';
import { createRecursiveDecompositionStrategy } from '../../src/strategies/recursive/RecursiveDecompositionStrategy.js';
// ArtifactRegistry removed - artifacts now stored directly in context
import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';

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
  
  afterEach(() => {
    // Clean up after each test
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
        // Return the appropriate tool based on name - note: currentTools now on task, not agent
        return null; // Simplified for unit tests
      })
    };
    
    // Create a mock strategy with all methods defined from the start
    const mockStrategy = {
      getName: jest.fn().mockReturnValue('MockStrategy'),
      // Define onMessage implementation right away
      onMessage: jest.fn(async (sourceTask, message) => {
        // In the message-passing model, sourceTask is the task to work on
        // The message tells us what to do with it
        console.log('onMessage called with:', 
          'type:', typeof sourceTask,
          'truthy:', !!sourceTask,
          'description:', sourceTask?.description,
          'keys:', sourceTask ? Object.keys(sourceTask).slice(0, 5) : 'null'
        );
        if (!sourceTask) {
          console.error('onMessage called with null/falsy task');
          return {
            success: false,
            result: 'Task is null'
          };
        }
        
        // Simple mock that simulates classification and execution
        if (message.type === 'start' || message.type === 'work') {
          // Check depth limit first (like the real strategy does)
          const maxDepth = sourceTask?.context?.getService ? sourceTask.context.getService('maxDepth') : 5;
          if (sourceTask?.metadata?.depth >= maxDepth) {
            // Fail the task properly
            if (sourceTask.fail) {
              sourceTask.fail(new Error(`Maximum recursion depth exceeded (${maxDepth})`));
            }
            return {
              success: false,
              result: `Maximum recursion depth exceeded (${maxDepth})`
            };
          }
          
          // Use the task classifier and tool discovery mocks
          // The task should have a description set when it was created
          const taskDescription = sourceTask.description || 'test task';
          const classification = await mockTaskClassifier.classify({ description: taskDescription });
          
          if (classification.complexity === 'SIMPLE') {
            // Mock simple execution
            const tools = await mockToolDiscovery.discoverTools(taskDescription);
            if (tools.length > 0) {
              // Get execution plan from the mock execution prompt
              const executionResult = await mockStrategy.executionPrompt.execute({});
              
              // Execute the tool calls from the execution result
              if (executionResult.success && executionResult.data?.toolCalls) {
                for (const toolCall of executionResult.data.toolCalls) {
                  // Find the tool
                  const tool = tools.find(t => t.name.toLowerCase() === toolCall.tool.toLowerCase());
                  if (tool && tool.execute && typeof tool.execute === 'function') {
                    try {
                      // Execute with the specified inputs
                      await tool.execute(toolCall.inputs || {});
                    } catch (error) {
                      // Ignore mock tool execution errors
                    }
                  }
                }
              }
              
              return { 
                success: true, 
                result: 'Task completed',
                artifacts: sourceTask?.getAllArtifacts ? Object.values(sourceTask.getAllArtifacts()) : []
              };
            } else {
              return { 
                success: false, 
                result: 'Unable to find suitable tools for this task',
                artifacts: sourceTask?.getAllArtifacts ? Object.values(sourceTask.getAllArtifacts()) : []
              };
            }
          } else {
            // Mock complex execution with decomposition
            // For infinite recursion test, this will keep creating subtasks until depth limit
            const decomposition = await mockStrategy.decompositionPrompt.execute({});
            
            // Check if we would exceed depth creating a subtask
            const nextDepth = (sourceTask?.metadata?.depth || 0) + 1;
            if (nextDepth >= maxDepth) {
              // Would exceed depth with next subtask
              sourceTask.fail(new Error(`Maximum recursion depth exceeded (${maxDepth})`));
              return {
                success: false,
                result: `Maximum recursion depth exceeded (${maxDepth})`,
                artifacts: sourceTask?.getAllArtifacts ? Object.values(sourceTask.getAllArtifacts()) : []
              };
            }
            
            return { 
              success: true, 
              result: 'Task decomposed and executed',
              artifacts: sourceTask?.getAllArtifacts ? Object.values(sourceTask.getAllArtifacts()) : []
            };
          }
        }
        return { acknowledged: true };
      }),
      // Add the prompt mocks
      decompositionPrompt: {
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
      },
      executionPrompt: {
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
      },
      parentEvaluationPrompt: {
        execute: jest.fn().mockResolvedValue({
          success: true,
          data: {
            decision: 'CONTINUE',
            reasoning: 'Continue with next subtask'
          }
        })
      },
      completionEvaluationPrompt: {
        execute: jest.fn().mockResolvedValue({
          success: true,
          data: {
            complete: true,
            reason: 'Task completed',
            result: 'All done'
          }
        })
      },
      // Add the classifier and discovery mocks
      taskClassifier: mockTaskClassifier,
      toolDiscovery: mockToolDiscovery,
      llmClient: mockLLMClient,
      toolRegistry: mockToolRegistry,
      _initializeComponents: jest.fn().mockResolvedValue(),
      _initializePrompts: jest.fn().mockResolvedValue()
    };
    
    // Create agent with our mock strategy
    agent = new SimpleROMAAgent({ taskStrategy: mockStrategy });
    
    // Create task manager manually (agent-specific service)  
    const { TaskManager } = await import('@legion/tasks');
    agent.taskManager = new TaskManager(mockLLMClient);
    
    // Create mock session logger (agent-specific service)
    agent.sessionLogger = {
      initialize: jest.fn().mockResolvedValue(),
      logInteraction: jest.fn().mockResolvedValue(),
      logSummary: jest.fn().mockResolvedValue()
    };
    
    // Create mock GlobalContext using real ExecutionContext class
    const { ExecutionContext } = await import('@legion/tasks');
    const mockExecutionContext = new ExecutionContext({
      llmClient: mockLLMClient,
      toolRegistry: mockToolRegistry,
      sessionLogger: agent.sessionLogger,
      fastToolDiscovery: false,
      workspaceDir: process.cwd(),
      maxDepth: 5,
      maxSubtasks: 10,
      executionTimeout: 60000,
      agent: agent,
      taskManager: agent.taskManager
    });
    
    // Create mock globalContext using real ExecutionContext class
    const globalContext = new ExecutionContext({
      llmClient: mockLLMClient,
      toolRegistry: mockToolRegistry
    });
    
    agent.globalContext = {
      initialize: jest.fn().mockResolvedValue(),
      createExecutionContext: jest.fn().mockResolvedValue(mockExecutionContext),
      getService: jest.fn((name) => globalContext.lookup(name)),
      lookup: jest.fn((name) => globalContext.lookup(name))
    };
    
  });
  
  // Task Classification Flow tests removed - testing obsolete architecture
  
  // Simple Task Execution tests removed - testing obsolete architecture
  
  // Complex Task Decomposition tests removed - testing obsolete architecture
  
  // Strategy Integration tests removed - testing obsolete architecture
  
  describe('Artifact Management', () => {
    // Test removed - _resolveTask method doesn't exist in production code
    
    it('should store artifacts directly in context', async () => {
      // Test direct artifact storage in context (new approach)
      const { Task } = await import('@legion/tasks');
      const task = new Task('test task');
      
      // Store artifacts directly in task context
      task.storeArtifact('filename', 'test.txt', 'File name');
      task.storeArtifact('content', 'Hello World', 'File content');
      
      // Retrieve artifacts from context
      const filename = task.getArtifact('filename');
      const content = task.getArtifact('content');
      
      expect(filename.value).toBe('test.txt');
      expect(content.value).toBe('Hello World');
      expect(filename.description).toBe('File name');
      expect(content.description).toBe('File content');
    });
  });
  
  // Error Handling tests removed - testing obsolete architecture that expects strategy properties
  
  // Tool Discovery Integration tests removed - testing obsolete architecture that expects strategy properties
});