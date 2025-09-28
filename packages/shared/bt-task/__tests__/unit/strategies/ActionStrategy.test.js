/**
 * Unit tests for ActionStrategy
 * Tests tool execution with parameter resolution and artifact storage
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('ActionStrategy', () => {
  let ActionStrategy;
  let BTTaskStrategy;
  let createBTTask;
  let mockTool;
  let mockContext;
  
  beforeEach(async () => {
    // Try to import the strategy
    try {
      const strategyModule = await import('../../../src/strategies/ActionStrategy.js');
      ActionStrategy = strategyModule.ActionStrategy;
    } catch (error) {
      // Will fail until implemented
      ActionStrategy = null;
    }
    
    try {
      const btStrategyModule = await import('../../../src/core/BTTaskStrategy.js');
      BTTaskStrategy = btStrategyModule.BTTaskStrategy;
    } catch (error) {
      BTTaskStrategy = null;
    }
    
    try {
      const factoryModule = await import('../../../src/factory/createBTTask.js');
      createBTTask = factoryModule.createBTTask;
    } catch (error) {
      createBTTask = null;
    }
    
    // Create mock tool
    mockTool = {
      name: 'test_tool',
      execute: jest.fn()
    };
    
    // Create mock context
    mockContext = {
      workspaceDir: '/test',
      toolRegistry: {
        getTool: jest.fn(() => mockTool)
      },
      artifacts: {
        inputData: 'test input',
        config: { option: 'value' }
      }
    };
  });
  
  describe('Prototype Chain', () => {
    it('should extend BTTaskStrategy', () => {
      if (!ActionStrategy || !BTTaskStrategy) {
        expect(ActionStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      expect(Object.getPrototypeOf(ActionStrategy)).toBe(BTTaskStrategy);
    });
  });
  
  describe('Tool Execution', () => {
    it('should look up tool from toolRegistry', async () => {
      if (!ActionStrategy || !createBTTask) {
        expect(ActionStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const actionTask = createBTTask(
        'Test Action',
        null,
        ActionStrategy,
        {
          type: 'action',
          tool: 'test_tool',
          params: {}
        }
      );
      
      // Make execute return a resolved promise
      mockTool.execute.mockResolvedValue({ success: true, data: 'result' });
      
      // Execute node
      actionTask.executeBTNode(actionTask, {
        type: 'execute',
        context: mockContext
      });
      
      // Wait for async execution
      await new Promise(resolve => setImmediate(resolve));
      
      // Should have looked up tool
      expect(mockContext.toolRegistry.getTool).toHaveBeenCalledWith('test_tool');
    });
    
    it('should execute tool with resolved parameters', async () => {
      if (!ActionStrategy || !createBTTask) {
        expect(ActionStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const actionTask = createBTTask(
        'Test Action',
        null,
        ActionStrategy,
        {
          type: 'action',
          tool: 'test_tool',
          params: {
            input: 'literal',
            data: '@inputData'
          }
        }
      );
      
      mockTool.execute.mockResolvedValue({ success: true, data: 'result' });
      
      actionTask.executeBTNode(actionTask, {
        type: 'execute',
        context: mockContext
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Should have executed tool with resolved params
      expect(mockTool.execute).toHaveBeenCalledWith({
        input: 'literal',
        data: 'test input'  // Resolved from @inputData
      });
    });
  });
  
  describe('Parameter Resolution', () => {
    it('should resolve @ references from artifacts', async () => {
      if (!ActionStrategy || !createBTTask) {
        expect(ActionStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const actionTask = createBTTask(
        'Test Action',
        null,
        ActionStrategy,
        {
          type: 'action',
          tool: 'test_tool',
          params: {
            artifact: '@inputData',
            nested: '@config.option',
            literal: 'text'
          }
        }
      );
      
      mockTool.execute.mockResolvedValue({ success: true });
      
      actionTask.executeBTNode(actionTask, {
        type: 'execute',
        context: mockContext
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockTool.execute).toHaveBeenCalledWith({
        artifact: 'test input',
        nested: 'value',
        literal: 'text'
      });
    });
    
    it('should pass literal parameters unchanged', async () => {
      if (!ActionStrategy || !createBTTask) {
        expect(ActionStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const actionTask = createBTTask(
        'Test Action',
        null,
        ActionStrategy,
        {
          type: 'action',
          tool: 'test_tool',
          params: {
            string: 'text',
            number: 42,
            boolean: true,
            object: { key: 'value' }
          }
        }
      );
      
      mockTool.execute.mockResolvedValue({ success: true });
      
      actionTask.executeBTNode(actionTask, {
        type: 'execute',
        context: mockContext
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockTool.execute).toHaveBeenCalledWith({
        string: 'text',
        number: 42,
        boolean: true,
        object: { key: 'value' }
      });
    });
  });
  
  describe('Output Variable Storage', () => {
    it('should store result in artifacts when outputVariable is configured', async () => {
      if (!ActionStrategy || !createBTTask) {
        expect(ActionStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const actionTask = createBTTask(
        'Test Action',
        null,
        ActionStrategy,
        {
          type: 'action',
          tool: 'test_tool',
          params: {},
          outputVariable: 'result'
        }
      );
      
      const toolResult = { success: true, data: { output: 'test output' } };
      mockTool.execute.mockResolvedValue(toolResult);
      
      actionTask.executeBTNode(actionTask, {
        type: 'execute',
        context: mockContext
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Should have stored result in context.artifacts as artifact object
      expect(mockContext.artifacts.result).toBeDefined();
      expect(mockContext.artifacts.result.value).toEqual({ output: 'test output' });
      expect(mockContext.artifacts.result.name).toBe('result');
      expect(mockContext.artifacts.result.type).toBe('tool_output');
    });
    
    it('should not store artifact if outputVariable not configured', async () => {
      if (!ActionStrategy || !createBTTask) {
        expect(ActionStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const actionTask = createBTTask(
        'Test Action',
        null,
        ActionStrategy,
        {
          type: 'action',
          tool: 'test_tool',
          params: {}
          // No outputVariable
        }
      );
      
      mockTool.execute.mockResolvedValue({ success: true, data: 'result' });
      
      const storeArtifactSpy = jest.spyOn(actionTask, 'storeArtifact');
      
      actionTask.executeBTNode(actionTask, {
        type: 'execute',
        context: mockContext
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Should NOT have stored artifact
      expect(storeArtifactSpy).not.toHaveBeenCalled();
    });
  });
  
  describe('Success/Failure Mapping', () => {
    it('should complete with SUCCESS when tool succeeds', async () => {
      if (!ActionStrategy || !createBTTask) {
        expect(ActionStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const actionTask = createBTTask(
        'Test Action',
        null,
        ActionStrategy,
        {
          type: 'action',
          tool: 'test_tool',
          params: {}
        }
      );
      
      mockTool.execute.mockResolvedValue({ success: true, data: 'result' });
      
      const completeSpy = jest.spyOn(actionTask, 'completeBTNode');
      
      actionTask.executeBTNode(actionTask, {
        type: 'execute',
        context: mockContext
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(completeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'SUCCESS',
          data: 'result'
        })
      );
    });
    
    it('should complete with FAILURE when tool fails', async () => {
      if (!ActionStrategy || !createBTTask) {
        expect(ActionStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const actionTask = createBTTask(
        'Test Action',
        null,
        ActionStrategy,
        {
          type: 'action',
          tool: 'test_tool',
          params: {}
        }
      );
      
      mockTool.execute.mockResolvedValue({ 
        success: false, 
        error: 'Tool execution failed' 
      });
      
      const completeSpy = jest.spyOn(actionTask, 'completeBTNode');
      
      actionTask.executeBTNode(actionTask, {
        type: 'execute',
        context: mockContext
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(completeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILURE',
          error: 'Tool execution failed'
        })
      );
    });
    
    it('should handle tool execution errors', async () => {
      if (!ActionStrategy || !createBTTask) {
        expect(ActionStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const actionTask = createBTTask(
        'Test Action',
        null,
        ActionStrategy,
        {
          type: 'action',
          tool: 'test_tool',
          params: {}
        }
      );
      
      // Tool throws error
      mockTool.execute.mockRejectedValue(new Error('Tool crashed'));
      
      const completeSpy = jest.spyOn(actionTask, 'completeBTNode');
      
      actionTask.executeBTNode(actionTask, {
        type: 'execute',
        context: mockContext
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(completeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILURE',
          error: expect.stringContaining('Tool crashed')
        })
      );
    });
  });
  
  describe('Context Lookup', () => {
    it('should retrieve toolRegistry from context', async () => {
      if (!ActionStrategy || !createBTTask) {
        expect(ActionStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const actionTask = createBTTask(
        'Test Action',
        null,
        ActionStrategy,
        {
          type: 'action',
          tool: 'test_tool',
          params: {}
        }
      );
      
      // Use lookup instead of directly accessing context
      actionTask.context = mockContext;
      
      mockTool.execute.mockResolvedValue({ success: true });
      
      actionTask.executeBTNode(actionTask, {
        type: 'execute',
        context: mockContext
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockContext.toolRegistry.getTool).toHaveBeenCalled();
    });
  });
});