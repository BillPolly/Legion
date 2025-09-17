/**
 * Unit tests for tool registry initialization and recovery mechanisms
 * Tests the fixes implemented in Phase 1 of the robustness implementation plan
 */

import { jest } from '@jest/globals';
import { ROMAAgent } from '../../src/ROMAAgent.js';
import { ExecutionStrategy } from '../../src/core/strategies/ExecutionStrategy.js';
import { ExecutionStrategyResolver } from '../../src/core/strategies/ExecutionStrategyResolver.js';
import { ResourceManager } from '@legion/resource-manager';
import { ToolRegistry } from '@legion/tools-registry';

describe('Tool Registry Initialization Tests', () => {
  let resourceManager;
  let originalGetInstance;
  
  beforeAll(async () => {
    // Get resource manager instance
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(() => {
    // Save original getInstance for restoration
    originalGetInstance = ToolRegistry.getInstance;
  });

  afterEach(() => {
    // Restore original getInstance
    ToolRegistry.getInstance = originalGetInstance;
    jest.clearAllMocks();
  });

  describe('ROMAAgent Tool Registry Initialization', () => {
    it('should validate tool registry is initialized in ROMAAgent', async () => {
      const agent = new ROMAAgent();
      await agent.initialize();
      
      // Test getToolRegistry method
      const toolRegistry = agent.getToolRegistry();
      expect(toolRegistry).toBeDefined();
      expect(toolRegistry).not.toBeNull();
    });

    it('should throw error when tool registry is not available', async () => {
      const agent = new ROMAAgent();
      // Don't initialize to test error condition
      
      expect(() => agent.getToolRegistry()).toThrow('Tool registry not available');
    });

    it('should handle tool registry fallback initialization', async () => {
      // Mock ToolRegistry.getInstance to initially fail then succeed
      let callCount = 0;
      ToolRegistry.getInstance = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First call returns null
          return null;
        }
        // Second call returns a valid mock instance
        return {
          name: 'mock-tool-registry',
          initialize: jest.fn().mockResolvedValue(true),
          listTools: jest.fn().mockResolvedValue([]),
          getTool: jest.fn().mockResolvedValue(null)
        };
      });

      const agent = new ROMAAgent();
      await agent.initialize();
      
      // Should have called getInstance twice (once failing, once succeeding)
      expect(ToolRegistry.getInstance).toHaveBeenCalledTimes(2);
      
      const toolRegistry = agent.getToolRegistry();
      expect(toolRegistry).toBeDefined();
      expect(toolRegistry.name).toBe('mock-tool-registry');
    });
  });

  describe('ExecutionStrategy Tool Registry Access', () => {
    it('should warn when toolRegistry not provided to constructor', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const strategy = new ExecutionStrategy({
        // No toolRegistry provided
        llmClient: {},
        simplePromptClient: {}
      });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('toolRegistry not provided in constructor')
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('should retrieve toolRegistry from singleton as fallback', async () => {
      const strategy = new ExecutionStrategy({
        // No toolRegistry provided initially
      });
      
      const toolRegistry = await strategy.getToolRegistry();
      
      expect(toolRegistry).toBeDefined();
      expect(strategy.toolRegistry).toBe(toolRegistry);
    });

    it('should return existing toolRegistry if already set', async () => {
      const mockRegistry = { name: 'mock-registry' };
      const strategy = new ExecutionStrategy({
        toolRegistry: mockRegistry
      });
      
      const toolRegistry = await strategy.getToolRegistry();
      
      expect(toolRegistry).toBe(mockRegistry);
    });

    it('should ensure toolRegistry during initialization', async () => {
      const strategy = new ExecutionStrategy({
        // No toolRegistry provided
      });
      
      expect(strategy.toolRegistry).toBeUndefined();
      
      await strategy.initialize();
      
      // After initialization, toolRegistry should be available
      expect(strategy.toolRegistry).toBeDefined();
    });
  });

  describe('ExecutionStrategyResolver Tool Registry Management', () => {
    it('should warn when creating strategies without toolRegistry', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const resolver = new ExecutionStrategyResolver({
        // No toolRegistry in dependencies
      });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Creating strategy without toolRegistry')
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('should pass toolRegistry to all strategies', () => {
      const mockRegistry = { name: 'mock-registry' };
      const resolver = new ExecutionStrategyResolver({
        toolRegistry: mockRegistry
      });
      
      // Get a strategy to check if it has toolRegistry
      const strategy = resolver.getStrategy('AtomicExecutionStrategy');
      
      expect(strategy).toBeDefined();
      expect(strategy.toolRegistry).toBe(mockRegistry);
    });

    it('should recover toolRegistry from singleton', async () => {
      const resolver = new ExecutionStrategyResolver({
        // No toolRegistry initially
      });
      
      const toolRegistry = await resolver.getToolRegistry();
      
      expect(toolRegistry).toBeDefined();
      expect(resolver.dependencies.toolRegistry).toBe(toolRegistry);
    });

    it('should ensure toolRegistry during initialization', async () => {
      const resolver = new ExecutionStrategyResolver({
        // No toolRegistry initially
      });
      
      expect(resolver.dependencies.toolRegistry).toBeUndefined();
      
      await resolver.initialize();
      
      // After initialization, toolRegistry should be in dependencies
      expect(resolver.dependencies.toolRegistry).toBeDefined();
    });

    it('should warn when toolRegistry is removed during update', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const mockRegistry = { name: 'mock-registry' };
      const resolver = new ExecutionStrategyResolver({
        toolRegistry: mockRegistry
      });
      
      // Update dependencies to remove toolRegistry
      resolver.updateDependencies({
        toolRegistry: null
      });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('toolRegistry is being set to null/undefined')
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('should handle null toolRegistry gracefully', async () => {
      // Mock getInstance to return null
      ToolRegistry.getInstance = jest.fn().mockResolvedValue(null);
      
      const resolver = new ExecutionStrategyResolver({});
      const toolRegistry = await resolver.getToolRegistry();
      
      // Should return null but not throw
      expect(toolRegistry).toBeNull();
      expect(ToolRegistry.getInstance).toHaveBeenCalled();
    });
  });

  describe('Singleton Pattern Validation', () => {
    it('should use singleton pattern for tool registry', async () => {
      const agent1 = new ROMAAgent();
      await agent1.initialize();
      
      const agent2 = new ROMAAgent();
      await agent2.initialize();
      
      const registry1 = agent1.getToolRegistry();
      const registry2 = agent2.getToolRegistry();
      
      // Both agents should have the same registry instance
      expect(registry1).toBe(registry2);
    });

    it('should handle concurrent initialization gracefully', async () => {
      // Create multiple agents concurrently
      const agents = await Promise.all([
        (async () => {
          const agent = new ROMAAgent();
          await agent.initialize();
          return agent;
        })(),
        (async () => {
          const agent = new ROMAAgent();
          await agent.initialize();
          return agent;
        })(),
        (async () => {
          const agent = new ROMAAgent();
          await agent.initialize();
          return agent;
        })()
      ]);
      
      // All should have tool registry
      agents.forEach(agent => {
        const registry = agent.getToolRegistry();
        expect(registry).toBeDefined();
        expect(registry).not.toBeNull();
      });
      
      // All should have the same instance
      const registry0 = agents[0].getToolRegistry();
      const registry1 = agents[1].getToolRegistry();
      const registry2 = agents[2].getToolRegistry();
      
      expect(registry0).toBe(registry1);
      expect(registry1).toBe(registry2);
    });
  });

  describe('Error Recovery', () => {
    it('should handle tool registry initialization errors', async () => {
      // Mock getInstance to throw an error
      ToolRegistry.getInstance = jest.fn().mockRejectedValue(
        new Error('Failed to connect to database')
      );
      
      const strategy = new ExecutionStrategy({});
      
      // Should handle error gracefully
      const toolRegistry = await strategy.getToolRegistry();
      
      expect(toolRegistry).toBeUndefined();
      expect(ToolRegistry.getInstance).toHaveBeenCalled();
    });

    it('should log appropriate errors when tool registry fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock getInstance to throw
      ToolRegistry.getInstance = jest.fn().mockRejectedValue(
        new Error('Connection failed')
      );
      
      const strategy = new ExecutionStrategy({ name: 'TestStrategy' });
      await strategy.getToolRegistry();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get toolRegistry from singleton'),
        expect.stringContaining('Connection failed')
      );
      
      consoleErrorSpy.mockRestore();
    });
  });
});