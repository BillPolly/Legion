/**
 * Unit tests for SimpleROMAAgent
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import SimpleROMAAgent from '../../src/SimpleROMAAgent.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('SimpleROMAAgent', () => {
  let agent;
  let resourceManager;
  let toolRegistry;
  let mockLLMClient;
  let mockTool;
  
  beforeAll(async () => {
    // Get real ResourceManager singleton (tests must not use fallbacks)
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await ToolRegistry.getInstance();
  });
  
  beforeEach(async () => {
    agent = new SimpleROMAAgent();
    
    // Create mock LLM client for controlled testing
    mockLLMClient = {
      request: jest.fn()
    };
    
    // Create mock tool
    mockTool = {
      name: 'calculator',
      execute: jest.fn().mockResolvedValue({
        success: true,
        result: 420
      })
    };
    
    // Override the LLM client and tool registry for testing
    agent.llmClient = mockLLMClient;
    agent.toolRegistry = {
      getTool: jest.fn().mockResolvedValue(mockTool)
    };
    agent.resourceManager = resourceManager;
    agent.isInitialized = true;
  });
  
  afterAll(async () => {
    // No cleanup needed - singletons persist
  });
  
  describe('initialization', () => {
    it('should initialize with default values', () => {
      const freshAgent = new SimpleROMAAgent();
      expect(freshAgent.isInitialized).toBe(false);
      expect(freshAgent.statistics.totalExecutions).toBe(0);
      expect(freshAgent.statistics.successful).toBe(0);
      expect(freshAgent.statistics.failed).toBe(0);
      expect(freshAgent.executionHistory).toEqual([]);
      expect(freshAgent.activeExecutions).toEqual([]);
    });
    
    it('should initialize resources', async () => {
      const freshAgent = new SimpleROMAAgent();
      await freshAgent.initialize();
      
      expect(freshAgent.isInitialized).toBe(true);
      expect(freshAgent.resourceManager).toBeTruthy();
      expect(freshAgent.llmClient).toBeTruthy();
      expect(freshAgent.toolRegistry).toBeTruthy();
    });
  });
  
  describe('execute - direct response', () => {
    it('should handle direct LLM response tasks', async () => {
      mockLLMClient.request.mockResolvedValue({
        content: JSON.stringify({
          response: "The answer is 42"
        })
      });
      
      const task = { description: "What is the meaning of life?" };
      const result = await agent.execute(task);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe("The answer is 42");
      expect(agent.statistics.successful).toBe(1);
      expect(agent.statistics.totalExecutions).toBe(1);
    });
  });
  
  describe('execute - tool usage', () => {
    it('should execute tasks with tools', async () => {
      mockLLMClient.request.mockResolvedValue({
        content: JSON.stringify({
          useTools: true,
          toolCalls: [
            {
              tool: 'calculator',
              parameters: { expression: '42 * 10' }
            }
          ]
        })
      });
      
      const task = { description: "Calculate 42 * 10" };
      const result = await agent.execute(task);
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].result).toBe(420);
      expect(mockTool.execute).toHaveBeenCalledWith({ expression: '42 * 10' });
    });
    
    it('should save tool results as artifacts', async () => {
      mockLLMClient.request.mockResolvedValue({
        content: JSON.stringify({
          useTools: true,
          toolCalls: [
            {
              tool: 'calculator',
              parameters: { expression: '42 * 10' },
              saveAs: 'calc_result'
            }
          ]
        })
      });
      
      const task = { description: "Calculate 42 * 10" };
      const result = await agent.execute(task);
      
      expect(result.artifacts.get('calc_result')).toBe(420);
    });
    
    it('should handle tool execution failures gracefully', async () => {
      mockLLMClient.request.mockResolvedValue({
        content: JSON.stringify({
          useTools: true,
          toolCalls: [
            {
              tool: 'nonexistent_tool',
              parameters: {}
            }
          ]
        })
      });
      
      agent.toolRegistry.getTool.mockResolvedValue(null);
      
      const task = { description: "Use a nonexistent tool" };
      const result = await agent.execute(task);
      
      expect(result.success).toBe(false);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('Tool not found');
    });
  });
  
  describe('execute - task decomposition', () => {
    it('should decompose complex tasks into subtasks', async () => {
      let callCount = 0;
      mockLLMClient.request.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: decompose
          return Promise.resolve({
            content: JSON.stringify({
              decompose: true,
              subtasks: [
                { description: "Subtask 1" },
                { description: "Subtask 2" }
              ]
            })
          });
        } else {
          // Subsequent calls: direct responses
          return Promise.resolve({
            content: JSON.stringify({
              response: `Response for call ${callCount}`
            })
          });
        }
      });
      
      const task = { description: "Complex task" };
      const result = await agent.execute(task);
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(mockLLMClient.request).toHaveBeenCalledTimes(3); // 1 decompose + 2 subtasks
    });
    
    it('should enforce maximum recursion depth', async () => {
      // Always decompose to force max depth
      mockLLMClient.request.mockResolvedValue({
        content: JSON.stringify({
          decompose: true,
          subtasks: [{ description: "Infinite subtask" }]
        })
      });
      
      const task = { description: "Recursive task" };
      
      // Create context with depth near limit
      const deepContext = {
        artifacts: new Map(),
        conversation: [],
        depth: 9,
        onProgress: () => {}
      };
      
      await expect(agent.execute(task, deepContext)).rejects.toThrow('Maximum recursion depth exceeded');
    });
    
    it('should save subtask results as artifacts', async () => {
      let callCount = 0;
      mockLLMClient.request.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            content: JSON.stringify({
              decompose: true,
              subtasks: [
                { description: "Get data", saveAs: "data" }
              ]
            })
          });
        } else {
          return Promise.resolve({
            content: JSON.stringify({
              response: "Sample data"
            })
          });
        }
      });
      
      const task = { description: "Process data" };
      const result = await agent.execute(task);
      
      expect(result.artifacts.get('data')).toBe("Sample data");
    });
  });
  
  describe('artifact resolution', () => {
    it('should resolve artifact references in tasks', () => {
      const context = {
        artifacts: new Map([
          ['file_content', 'Hello World'],
          ['count', 42]
        ])
      };
      
      const task = "Process @file_content and multiply @count by 2";
      const resolved = agent.resolveArtifacts(task, context);
      
      expect(resolved).toBe("Process Hello World and multiply 42 by 2");
    });
    
    it('should resolve artifacts in objects', () => {
      const context = {
        artifacts: new Map([
          ['filename', 'test.txt'],
          ['content', 'Test content']
        ])
      };
      
      const params = {
        file: '@filename',
        data: '@content'
      };
      
      const resolved = agent.resolveArtifacts(params, context);
      
      expect(resolved.file).toBe('test.txt');
      expect(resolved.data).toBe('Test content');
    });
    
    it('should handle missing artifact references gracefully', () => {
      const context = {
        artifacts: new Map()
      };
      
      const task = "Process @nonexistent";
      const resolved = agent.resolveArtifacts(task, context);
      
      expect(resolved).toBe("Process @nonexistent");
    });
  });
  
  describe('progress tracking', () => {
    it('should emit progress events during execution', async () => {
      const progressEvents = [];
      const onProgress = (event) => progressEvents.push(event);
      
      mockLLMClient.request.mockResolvedValue({
        content: JSON.stringify({
          response: "Done"
        })
      });
      
      await agent.execute(
        { description: "Test task" },
        { onProgress }
      );
      
      expect(progressEvents).toContainEqual(
        expect.objectContaining({ type: 'start' })
      );
      expect(progressEvents).toContainEqual(
        expect.objectContaining({ type: 'analysis' })
      );
      expect(progressEvents).toContainEqual(
        expect.objectContaining({ type: 'complete' })
      );
    });
  });
  
  describe('statistics and history', () => {
    it('should track execution statistics', async () => {
      mockLLMClient.request.mockResolvedValue({
        content: JSON.stringify({ response: "Done" })
      });
      
      await agent.execute({ description: "Task 1" });
      await agent.execute({ description: "Task 2" });
      
      const stats = agent.getStatistics();
      expect(stats.totalExecutions).toBe(2);
      expect(stats.successful).toBe(2);
      expect(stats.failed).toBe(0);
      expect(stats.successRate).toBe(1);
    });
    
    it('should maintain execution history', async () => {
      mockLLMClient.request.mockResolvedValue({
        content: JSON.stringify({ response: "Done" })
      });
      
      await agent.execute({ description: "Historical task" });
      
      const history = agent.getExecutionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].task.description).toBe("Historical task");
      expect(history[0].result.success).toBe(true);
    });
    
    it('should track active executions', async () => {
      mockLLMClient.request.mockResolvedValue({
        content: JSON.stringify({ response: "Done" })
      });
      
      const promise = agent.execute({ description: "Active task" });
      
      // Check while executing
      const activeCount = agent.getActiveExecutions().length;
      expect(activeCount).toBeGreaterThan(0);
      
      await promise;
      
      // Check after completion
      expect(agent.getActiveExecutions().length).toBe(0);
    });
  });
  
  describe('shutdown', () => {
    it('should clean up on shutdown', async () => {
      await agent.shutdown();
      
      expect(agent.isInitialized).toBe(false);
      expect(agent.activeExecutions).toEqual([]);
    });
  });
});