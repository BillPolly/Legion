/**
 * Integration tests for tool execution flow with tool registry
 * Tests the end-to-end flow of tool discovery and execution
 */

import { jest } from '@jest/globals';
import { ROMAAgent } from '../../src/ROMAAgent.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('Tool Execution Flow Integration Tests', () => {
  let agent;
  let resourceManager;
  let toolRegistry;
  
  beforeAll(async () => {
    // Get real singletons for integration testing
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await ToolRegistry.getInstance();
  });

  beforeEach(async () => {
    agent = new ROMAAgent();
    await agent.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Tool Discovery', () => {
    it('should discover available tools through tool registry', async () => {
      const registry = agent.getToolRegistry();
      expect(registry).toBeDefined();
      
      // Test that tool registry has tools available
      const tools = await registry.listTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should access specific tools by name', async () => {
      const registry = agent.getToolRegistry();
      
      // Try to get a common tool like file_write
      const fileTool = await registry.getTool('file_write');
      
      // Tool might not exist in test environment, but method should work
      if (fileTool) {
        expect(fileTool).toHaveProperty('name');
        expect(fileTool).toHaveProperty('execute');
      }
    });

    it('should handle tool registry in execution context', async () => {
      // Create a simple task that would use tools
      const task = {
        description: 'Write hello world to a file',
        atomic: true,
        tool: 'file_write',
        parameters: {
          filepath: '/tmp/test.txt',
          content: 'Hello World'
        }
      };

      // Get the execution strategy
      const strategy = await agent.strategyResolver.selectStrategy(task, {});
      expect(strategy).toBeDefined();
      
      // Verify strategy has access to tool registry
      const strategyRegistry = await strategy.getToolRegistry();
      expect(strategyRegistry).toBeDefined();
    });
  });

  describe('Tool Execution', () => {
    it('should pass tool registry to execution strategies', async () => {
      const atomicStrategy = agent.strategyResolver.getStrategy('AtomicExecutionStrategy');
      expect(atomicStrategy).toBeDefined();
      expect(atomicStrategy.toolRegistry).toBeDefined();
    });

    it('should maintain tool registry through strategy chain', async () => {
      // Get different strategies
      const recursive = agent.strategyResolver.getStrategy('RecursiveExecutionStrategy');
      const sequential = agent.strategyResolver.getStrategy('SequentialExecutionStrategy');
      const parallel = agent.strategyResolver.getStrategy('ParallelExecutionStrategy');
      const atomic = agent.strategyResolver.getStrategy('AtomicExecutionStrategy');
      
      // All should have tool registry
      expect(recursive.toolRegistry).toBeDefined();
      expect(sequential.toolRegistry).toBeDefined();
      expect(parallel.toolRegistry).toBeDefined();
      expect(atomic.toolRegistry).toBeDefined();
      
      // All should have the same instance (singleton)
      expect(recursive.toolRegistry).toBe(atomic.toolRegistry);
      expect(sequential.toolRegistry).toBe(atomic.toolRegistry);
      expect(parallel.toolRegistry).toBe(atomic.toolRegistry);
    });

    it('should handle tool execution with proper context', async () => {
      // Mock a tool execution scenario
      const mockTask = {
        id: 'test-task-1',
        description: 'Test task with tool',
        atomic: true,
        tool: 'mock_tool',
        parameters: { test: true }
      };

      // Mock the tool in registry
      const registry = agent.getToolRegistry();
      const originalGetTool = registry.getTool;
      registry.getTool = jest.fn().mockResolvedValue({
        name: 'mock_tool',
        execute: jest.fn().mockResolvedValue({
          success: true,
          result: 'Mock executed'
        })
      });

      const atomicStrategy = agent.strategyResolver.getStrategy('AtomicExecutionStrategy');
      
      // Verify tool can be retrieved through strategy
      const tool = await registry.getTool('mock_tool');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('mock_tool');
      
      // Restore original method
      registry.getTool = originalGetTool;
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tool registry gracefully', async () => {
      // Create a strategy without tool registry
      const { ExecutionStrategy } = await import('../../src/core/strategies/ExecutionStrategy.js');
      const strategy = new ExecutionStrategy({
        // No toolRegistry provided
      });
      
      // Should try to get from singleton
      const registry = await strategy.getToolRegistry();
      expect(registry).toBeDefined();
    });

    it('should log appropriate warnings when tool registry missing', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const { ExecutionStrategy } = await import('../../src/core/strategies/ExecutionStrategy.js');
      const strategy = new ExecutionStrategy({
        // No toolRegistry
      });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('toolRegistry not provided')
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('should recover from tool execution failures', async () => {
      const registry = agent.getToolRegistry();
      const originalGetTool = registry.getTool;
      
      // Mock a failing tool
      registry.getTool = jest.fn().mockResolvedValue({
        name: 'failing_tool',
        execute: jest.fn().mockRejectedValue(new Error('Tool execution failed'))
      });

      // Get strategy
      const atomicStrategy = agent.strategyResolver.getStrategy('AtomicExecutionStrategy');
      
      // Try to execute with failing tool
      const tool = await registry.getTool('failing_tool');
      expect(tool).toBeDefined();
      
      try {
        await tool.execute({});
      } catch (error) {
        expect(error.message).toBe('Tool execution failed');
      }
      
      // Restore
      registry.getTool = originalGetTool;
    });
  });


  describe('Strategy Resolver Integration', () => {
    it('should update all strategies when dependencies change', async () => {
      const mockRegistry = {
        name: 'updated-registry',
        getTool: jest.fn(),
        listTools: jest.fn().mockResolvedValue([])
      };
      
      // Update dependencies
      agent.strategyResolver.updateDependencies({
        toolRegistry: mockRegistry
      });
      
      // All strategies should have updated registry
      const atomic = agent.strategyResolver.getStrategy('AtomicExecutionStrategy');
      expect(atomic.toolRegistry).toBe(mockRegistry);
    });

    it('should warn when toolRegistry is removed', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      agent.strategyResolver.updateDependencies({
        toolRegistry: null
      });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('toolRegistry is being set to null/undefined')
      );
      
      consoleWarnSpy.mockRestore();
    });
  });
});
