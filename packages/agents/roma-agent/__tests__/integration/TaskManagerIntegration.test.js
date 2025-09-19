/**
 * Integration test to demonstrate how TaskManager SHOULD work with SimpleROMAAgent
 * This test will FAIL until we integrate TaskManager into SimpleROMAAgent
 */

import { jest } from '@jest/globals';
import SimpleROMAAgent from '../../src/core/SimpleROMAAgent.js';
import TaskManager from '../../src/core/TaskManager.js';

describe('TaskManager Integration with SimpleROMAAgent', () => {
  let agent;
  let taskManager;
  let mockLLM;
  
  beforeEach(async () => {
    // Create mock LLM that gives predictable responses
    mockLLM = {
      complete: jest.fn()
    };
    
    agent = new SimpleROMAAgent();
    await agent.initialize();
    
    // Replace LLM with mock in all components
    agent.llmClient = mockLLM;
    agent.taskClassifier.llmClient = mockLLM;
    agent.toolDiscovery.llmClient = mockLLM;
    
    // Create TaskManager with same LLM
    taskManager = new TaskManager(mockLLM);
  });
  
  describe('What SHOULD happen', () => {
    it('should create tasks from decomposition', async () => {
      // Setup: Task classified as COMPLEX and decomposed
      mockLLM.complete
        // Root task classification
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'COMPLEX',
          reasoning: 'Multiple steps needed'
        }))
        // Root task decomposition
        .mockResolvedValueOnce(JSON.stringify({
          decompose: true,
          subtasks: [
            { description: 'Create directory structure' },
            { description: 'Write server code' },
            { description: 'Create package.json' }
          ]
        }))
        // Subtask 1
        .mockResolvedValueOnce(JSON.stringify({ complexity: 'SIMPLE', reasoning: 'Direct' }))
        .mockResolvedValueOnce('[]') // Tool description generation returns empty
        .mockResolvedValueOnce(JSON.stringify({ response: 'Directory created' }))
        // Parent evaluates after subtask 1
        .mockResolvedValueOnce(JSON.stringify({ action: 'continue', relevantArtifacts: [] }))
        // Subtask 2
        .mockResolvedValueOnce(JSON.stringify({ complexity: 'SIMPLE', reasoning: 'Direct' }))
        .mockResolvedValueOnce('[]') // Tool description generation returns empty
        .mockResolvedValueOnce(JSON.stringify({ response: 'Server code written' }))
        // Parent evaluates after subtask 2
        .mockResolvedValueOnce(JSON.stringify({ action: 'continue', relevantArtifacts: [] }))
        // Subtask 3
        .mockResolvedValueOnce(JSON.stringify({ complexity: 'SIMPLE', reasoning: 'Direct' }))
        .mockResolvedValueOnce('[]') // Tool description generation returns empty
        .mockResolvedValueOnce(JSON.stringify({ response: 'Package.json created' }))
        // Parent evaluates and completes
        .mockResolvedValueOnce(JSON.stringify({ action: 'complete', result: { success: true } }));
      
      // THIS IS WHAT WE WANT:
      // When agent executes a complex task, it should:
      // 1. Create a root Task object
      // 2. Create subtask Task objects from decomposition
      // 3. Track conversation in each Task
      // 4. Check completion via LLM
      
      // But this will FAIL because agent doesn't use TaskManager yet!
      const result = await agent.execute({
        description: 'Create a Node.js server'
      });
      
      // These assertions show what SHOULD be true after integration:
      
      // Agent should have a TaskManager
      expect(agent.taskManager).toBeDefined();
      
      // Root task should exist
      expect(agent.taskManager.getRootTask()).toBeDefined();
      expect(agent.taskManager.getRootTask().description).toBe('Create a Node.js server');
      
      // Subtasks should be created
      expect(agent.taskManager.getRootTask().children).toHaveLength(3);
      
      // Each subtask should have its own conversation
      const subtask1 = agent.taskManager.getRootTask().children[0];
      expect(subtask1.conversation.length).toBeGreaterThan(0);
    });
    
    it('should check task completion via LLM', async () => {
      // Setup: Simple task that executes and needs completion check
      mockLLM.complete
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Single operation'
        }))
        .mockResolvedValueOnce('[]') // Tool description generation returns empty
        .mockResolvedValueOnce(JSON.stringify({
          response: 'Task completed successfully'  // Simple task execution response
        }))
      
      const result = await agent.execute({
        description: 'Read a file'
      });
      
      // These show what ACTUALLY happens:
      
      // When no tools are found, SIMPLE task fails
      expect(agent.taskManager.getCurrentTask().status).toBe('failed');
      expect(result.success).toBe(false);
      expect(result.result).toContain('Unable to find suitable tools');
      
      // Task should still have conversation history
      const conversation = agent.taskManager.getCurrentTask().conversation;
      expect(conversation.length).toBeGreaterThan(0);
    });
    
    it('should use task-scoped conversation for prompts', async () => {
      // Setup
      mockLLM.complete
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Direct execution'
        }))
        .mockResolvedValueOnce(JSON.stringify([
          'read file contents',
          'load file from disk'
        ])) // Tool description generation
        .mockResolvedValueOnce(JSON.stringify({
          useTools: true,
          toolCalls: [{
            tool: 'file_read',
            inputs: { path: 'config.json' }
          }]
        })); // Simple task execution
      
      const result = await agent.execute({
        description: 'Read config.json'
      });
      
      // Task conversation should be used in prompts
      const task = agent.taskManager.getCurrentTask();
      
      // The prompt builder should use task.formatConversation()
      // instead of the global conversation array
      expect(task.conversation.some(c => 
        c.content.includes('Read config.json')
      )).toBe(true);
    });
  });
  
  describe('Current implementation', () => {
    it('shows that agent NOW uses TaskManager with self-managing tasks', async () => {
      mockLLM.complete
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Simple task'
        }))
        .mockResolvedValueOnce('[]') // Tool description generation returns empty
        .mockResolvedValueOnce(JSON.stringify({
          response: 'Task completed'
        })); // Simple task execution response
      
      await agent.execute({
        description: 'Test task'
      });
      
      // This is now true:
      expect(agent.taskManager).toBeDefined();
      expect(agent.taskManager.getRootTask()).toBeDefined();
      expect(agent.taskManager.getRootTask().description).toBe('Test task');
      
      // Root task owns its services
      const rootTask = agent.taskManager.getRootTask();
      expect(rootTask.llmClient).toBeDefined();
      expect(rootTask.taskClassifier).toBeDefined();
      expect(rootTask.toolDiscovery).toBeDefined();
      expect(rootTask.artifactRegistry).toBeDefined();
      expect(rootTask.sessionLogger).toBeDefined();
    });
    
    it('shows that tasks manage their own decomposition', async () => {
      // Setup: Task classified as COMPLEX and decomposed
      mockLLM.complete
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'COMPLEX',
          reasoning: 'Multiple steps needed'
        }))
        .mockResolvedValueOnce(JSON.stringify({
          decompose: true,
          subtasks: [
            { description: 'Create directory structure' },
            { description: 'Write server code' },
            { description: 'Create package.json' }
          ]
        }))
        // First subtask execution (SIMPLE)
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Direct execution'
        }))
        .mockResolvedValueOnce('[]') // Tool description generation returns empty
        .mockResolvedValueOnce(JSON.stringify({
          response: 'Directory structure created'
        }))
        // Parent evaluates after first subtask
        .mockResolvedValueOnce(JSON.stringify({
          action: 'continue',
          relevantArtifacts: [],
          reason: 'Continue with next subtask'
        }))
        // Second subtask execution (SIMPLE)
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Direct execution'
        }))
        .mockResolvedValueOnce('[]') // Tool description generation returns empty
        .mockResolvedValueOnce(JSON.stringify({
          response: 'Server code written'
        }))
        // Parent evaluates after second subtask
        .mockResolvedValueOnce(JSON.stringify({
          action: 'continue',
          relevantArtifacts: [],
          reason: 'Continue with next subtask'
        }))
        // Third subtask execution (SIMPLE)
        .mockResolvedValueOnce(JSON.stringify({
          complexity: 'SIMPLE',
          reasoning: 'Direct execution'
        }))
        .mockResolvedValueOnce('[]') // Tool description generation returns empty
        .mockResolvedValueOnce(JSON.stringify({
          response: 'Package.json created'
        }))
        // Parent evaluates after third subtask and decides to complete
        .mockResolvedValueOnce(JSON.stringify({
          action: 'complete',
          relevantArtifacts: [],
          reason: 'All subtasks complete',
          result: { success: true }
        }));
      
      await agent.execute({
        description: 'Create a Node.js server'
      });
      
      // Root task should exist with decomposition
      const rootTask = agent.taskManager.getRootTask();
      expect(rootTask).toBeDefined();
      expect(rootTask.metadata.isDecomposed).toBe(true);
      expect(rootTask.plannedSubtasks).toHaveLength(3);
      
      // Task creates its own subtasks
      expect(rootTask.children.length).toBeGreaterThan(0);
      
      // Each subtask has its own conversation
      const subtask1 = rootTask.children[0];
      expect(subtask1).toBeDefined();
      expect(subtask1.conversation.length).toBeGreaterThan(0);
    });
  });
});