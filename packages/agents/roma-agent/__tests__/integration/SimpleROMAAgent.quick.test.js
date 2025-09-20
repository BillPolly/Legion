/**
 * Quick integration tests for SimpleROMAAgent with reasonable timeouts
 */

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import SimpleROMAAgent from '../../src/core/SimpleROMAAgent.js';

describe('SimpleROMAAgent Quick Integration', () => {
  let agent;
  let mockLLMClient;
  let mockToolRegistry;

  beforeAll(async () => {
    // Create mocks instead of using real singletons for faster tests
    mockLLMClient = { 
      complete: jest.fn() 
    };
    
    mockToolRegistry = {
      listTools: jest.fn().mockResolvedValue([
        {
          name: 'calculator',
          description: 'Perform calculations',
          execute: jest.fn().mockResolvedValue({
            success: true,
            result: 12  // Fixed result for test predictability
          })
        },
        {
          name: 'file_write',
          description: 'Write content to file',
          execute: jest.fn().mockResolvedValue({
            success: true,
            filepath: '/tmp/test.txt'
          })
        }
      ]),
      searchTools: jest.fn().mockResolvedValue([]),
      getTool: jest.fn().mockImplementation(async (name) => {
        if (name === 'calculator') {
          return {
            name: 'calculator',
            description: 'Perform calculations',
            execute: jest.fn().mockResolvedValue({
              success: true,
              result: 12
            })
          };
        } else if (name === 'file_write') {
          return {
            name: 'file_write',
            description: 'Write content to file',
            execute: jest.fn().mockResolvedValue({
              success: true,
              filepath: '/tmp/test.txt'
            })
          };
        }
        return null;
      })
    };
  });

  beforeEach(async () => {
    // Create agent and override dependencies
    agent = new SimpleROMAAgent({ 
      testMode: true, 
      fastToolDiscovery: true 
    });
    
    // Override the initialization to use mocks
    agent.initialize = async function() {
      // Create mock resource manager
      this.resourceManager = { 
        get: jest.fn().mockImplementation(key => {
          if (key === 'llmClient') return mockLLMClient;
          return null;
        })
      };
      
      this.llmClient = mockLLMClient;
      this.toolRegistry = mockToolRegistry;
      
      // Import required classes
      const { default: ToolDiscovery } = await import('../../src/utils/ToolDiscovery.js');
      const { default: TaskClassifier } = await import('../../src/utils/TaskClassifier.js');
      const { default: Prompt } = await import('../../src/utils/Prompt.js');
      
      this.toolDiscovery = new ToolDiscovery(this.llmClient, this.toolRegistry);
      this.taskClassifier = new TaskClassifier(this.llmClient);
      
      // Create mock prompt builder with all required methods
      this.promptBuilder = {
        buildExecutionPrompt: jest.fn().mockResolvedValue('mock execution prompt'),
        buildDecompositionPrompt: jest.fn().mockReturnValue('mock decomposition prompt'),
        buildCompletionEvaluationPrompt: jest.fn().mockReturnValue('mock completion prompt'),
        buildParentEvaluationPrompt: jest.fn().mockReturnValue('mock parent evaluation prompt'),
        formatDiscoveredToolsSection: jest.fn().mockReturnValue('mock tools section'),
        formatArtifactsSection: jest.fn().mockReturnValue('mock artifacts section')
      };

      // Create validators (simplified)
      this.simpleTaskValidator = {
        parseAndValidate: jest.fn().mockImplementation(response => {
          try {
            return { valid: true, data: JSON.parse(response) };
          } catch {
            return { valid: false, error: 'Parse error' };
          }
        }),
        process: jest.fn().mockImplementation(response => {
          try {
            const data = JSON.parse(response);
            return { success: true, data };
          } catch {
            return { success: false, error: 'Parse error' };
          }
        })
      };
      
      this.decompositionValidator = {
        parseAndValidate: jest.fn().mockImplementation(response => {
          try {
            return { valid: true, data: JSON.parse(response) };
          } catch {
            return { valid: false, error: 'Parse error' };
          }
        }),
        process: jest.fn().mockImplementation(response => {
          try {
            const data = JSON.parse(response);
            return { success: true, data };
          } catch {
            return { success: false, error: 'Parse error' };
          }
        })
      };
      
      // Strategy is already created in constructor
      const { ArtifactRegistry, TaskManager } = await import('@legion/tasks');
      this.artifactRegistry = new ArtifactRegistry();
      
      // Create task manager
      this.taskManager = new TaskManager();
    };
    
    await agent.initialize();
  });

  describe('Basic Functionality', () => {
    it('should execute a simple arithmetic task with fast tool discovery', async () => {
      // Mock LLM responses
      mockLLMClient.complete
        .mockResolvedValueOnce(JSON.stringify({ // Classification
          complexity: 'SIMPLE',
          reasoning: 'Simple arithmetic calculation'
        }))
        .mockResolvedValueOnce(JSON.stringify({ // Execution
          useTools: true,
          toolCalls: [{
            tool: 'calculator',
            inputs: { expression: '7 + 5' },
            outputs: { result: '@calc_result' }
          }]
        }));
      
      const task = {
        description: 'Calculate 7 plus 5'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      
      // Check that we have a result (the structure can vary)
      expect(result.results || result.result || result.toolResults).toBeDefined();
      
      // The result should indicate the calculation was performed
      const hasResult = result.results?.[0] || result.result || result.toolResults?.[0];
      expect(hasResult).toBeDefined();
      
      // The mock tool was set up to return { success: true, result: 12 }
      if (hasResult && typeof hasResult === 'object') {
        expect(hasResult.success || hasResult.result === 12).toBeTruthy();
      }
    }, 10000); // 10 seconds for mocked test

    it('should handle direct question responses quickly', async () => {
      // Mock LLM responses
      mockLLMClient.complete
        .mockResolvedValueOnce(JSON.stringify({ // Classification
          complexity: 'SIMPLE',
          reasoning: 'Simple arithmetic question'
        }))
        .mockResolvedValueOnce(JSON.stringify({ // Direct response
          response: '2 plus 2 equals 4'
        }));
        
      const task = {
        description: 'What is 2 plus 2?'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.result || result.response).toBeDefined();
      expect((result.result || result.response).toString()).toContain('4');
    }, 10000); // 10 seconds for mocked test

    it('should classify simple file operations correctly', async () => {
      // Mock LLM responses
      mockLLMClient.complete
        .mockResolvedValueOnce(JSON.stringify({ // Classification
          complexity: 'SIMPLE',
          reasoning: 'Single file write operation'
        }))
        .mockResolvedValueOnce(JSON.stringify({ // Execution
          useTools: true,
          toolCalls: [{
            tool: 'file_write',
            inputs: { filepath: '/tmp/hello.txt', content: 'hello world' },
            outputs: { filepath: '@file_path' }
          }]
        }));
        
      const task = {
        description: 'Create a text file with hello world'
      };

      const result = await agent.execute(task);

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results[0].success).toBe(true);
    }, 10000); // 10 seconds for mocked test
  });

  describe('Error Handling', () => {
    it('should prevent infinite recursion', async () => {
      // Mock LLM to always classify as COMPLEX and decompose
      // This will force recursion
      mockLLMClient.complete.mockImplementation(() => {
        // Always return COMPLEX classification
        return Promise.resolve(JSON.stringify({
          complexity: 'COMPLEX',
          reasoning: 'Requires multiple steps'
        }));
      });
        
      const task = {
        description: 'Create a complex application'
      };

      // Set depth to just below max to allow one more level
      const context = {
        depth: 4, // One below max depth (default is 5)
        artifactRegistry: agent.artifactRegistry,
        conversation: []
      };
      
      // This should eventually hit the depth limit
      const result = await agent.execute(task, context);
      
      // When max depth is reached, it should handle gracefully
      // The agent should return some result rather than throwing
      expect(result).toBeDefined();
      expect(result.success !== undefined || result.error !== undefined).toBe(true);
    }, 10000);

    it('should handle malformed tasks gracefully', async () => {
      const task = {
        // Missing description
      };

      const result = await agent.execute(task);
      
      // Should handle gracefully, not crash
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    }, 10000);
  });

  describe('Artifact Management', () => {
    it('should resolve artifact references correctly', async () => {
      const context = {
        artifacts: new Map([['test_value', 42]]),
        conversation: [],
        depth: 0
      };

      const resolvedObj = agent.resolveArtifacts(
        { value: '@test_value', other: 'static' },
        context
      );

      expect(resolvedObj.value).toBe(42);
      expect(resolvedObj.other).toBe('static');
    });
  });
});