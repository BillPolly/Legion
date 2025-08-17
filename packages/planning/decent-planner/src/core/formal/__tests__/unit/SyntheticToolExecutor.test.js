/**
 * Unit tests for SyntheticToolExecutor
 * 
 * Tests the execution of synthetic tools by passing their stored BTs to BehaviorTreeExecutor
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SyntheticToolExecutor } from '../../SyntheticToolExecutor.js';
import { SyntheticTool } from '../../SyntheticTool.js';

describe('SyntheticToolExecutor', () => {
  let executor;
  let mockBTExecutor;

  beforeEach(() => {
    // Mock BehaviorTreeExecutor
    mockBTExecutor = {
      executeTree: jest.fn().mockResolvedValue({
        success: true,
        status: 'SUCCESS',
        artifacts: {
          result: 'test result',
          output1: 'value1'
        },
        data: {
          result: 'test result',
          output1: 'value1'
        },
        executionTime: 150
      })
    };
    
    executor = new SyntheticToolExecutor(mockBTExecutor);
  });

  describe('initialization', () => {
    it('should create executor with BT executor', () => {
      expect(executor.btExecutor).toBe(mockBTExecutor);
    });
    
    it('should require BT executor', () => {
      expect(() => new SyntheticToolExecutor()).toThrow('BehaviorTreeExecutor is required');
    });
  });

  describe('execute', () => {
    it('should pass the stored BT directly to BehaviorTreeExecutor', async () => {
      const behaviorTree = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'tool1' },
          { type: 'action', tool: 'tool2' }
        ]
      };
      
      const syntheticTool = new SyntheticTool({
        name: 'test_tool',
        description: 'Test tool',
        executionPlan: behaviorTree,  // This IS the BT
        outputSchema: {
          result: { type: 'string' }
        }
      });
      
      const inputs = { input1: 'value1' };
      const result = await executor.execute(syntheticTool, inputs);
      
      // Verify BT was passed directly to executor
      expect(mockBTExecutor.executeTree).toHaveBeenCalledWith(
        behaviorTree,  // The exact BT stored in executionPlan
        expect.objectContaining({
          artifacts: { input1: 'value1' }
        })
      );
      
      expect(result.success).toBe(true);
      expect(result.outputs.result).toBe('test result');
    });

    it('should create isolated context for BT execution', async () => {
      const syntheticTool = new SyntheticTool({
        name: 'isolated_tool',
        description: 'Test isolation',
        executionPlan: { type: 'action', tool: 'test' }
      });
      
      const parentContext = {
        parentData: 'should not leak',
        artifacts: { parentArtifact: 'should not be visible' }
      };
      
      const inputs = { input1: 'value' };
      await executor.execute(syntheticTool, inputs, parentContext);
      
      // Check that context was properly isolated
      const calledContext = mockBTExecutor.executeTree.mock.calls[0][1];
      expect(calledContext.artifacts).toEqual({ input1: 'value' });
      expect(calledContext.parentContext.artifacts).toBeUndefined();
      expect(calledContext.parentContext.parentData).toBe('should not leak');
    });

    it('should map tool inputs to BT artifacts', async () => {
      const syntheticTool = new SyntheticTool({
        name: 'mapper_tool',
        description: 'Test mapping',
        executionPlan: { type: 'action' },
        inputSchema: {
          fileName: { type: 'string' },
          content: { type: 'string' }
        }
      });
      
      const inputs = {
        fileName: 'test.txt',
        content: 'file content'
      };
      
      await executor.execute(syntheticTool, inputs);
      
      const calledContext = mockBTExecutor.executeTree.mock.calls[0][1];
      expect(calledContext.artifacts).toEqual({
        fileName: 'test.txt',
        content: 'file content'
      });
    });

    it('should extract outputs based on schema', async () => {
      const syntheticTool = new SyntheticTool({
        name: 'output_tool',
        description: 'Test output extraction',
        executionPlan: { type: 'action' },
        outputSchema: {
          result: { type: 'string' },
          output1: { type: 'string' }
        }
      });
      
      mockBTExecutor.executeTree.mockResolvedValue({
        success: true,
        artifacts: {
          result: 'final result',
          output1: 'output value',
          internal: 'should not be exposed'
        }
      });
      
      const result = await executor.execute(syntheticTool);
      
      // Only schema-defined outputs should be returned
      expect(result.outputs).toEqual({
        result: 'final result',
        output1: 'output value'
      });
      expect(result.outputs.internal).toBeUndefined();
    });

    it('should return all artifacts if no output schema', async () => {
      const syntheticTool = new SyntheticTool({
        name: 'no_schema_tool',
        description: 'Test no schema',
        executionPlan: { type: 'action' },
        outputSchema: {}  // No schema defined
      });
      
      mockBTExecutor.executeTree.mockResolvedValue({
        success: true,
        data: {
          anything: 'goes',
          everything: 'returned'
        }
      });
      
      const result = await executor.execute(syntheticTool);
      
      expect(result.outputs).toEqual({
        anything: 'goes',
        everything: 'returned'
      });
    });

    it('should handle BT execution failure', async () => {
      const syntheticTool = new SyntheticTool({
        name: 'failing_tool',
        description: 'Test failure',
        executionPlan: { type: 'action' }
      });
      
      mockBTExecutor.executeTree.mockResolvedValue({
        success: false,
        status: 'FAILURE',
        error: 'Tool not found'
      });
      
      const result = await executor.execute(syntheticTool);
      
      expect(result.success).toBe(false);
      expect(result.outputs).toEqual({});
    });

    it('should handle BT execution errors', async () => {
      const syntheticTool = new SyntheticTool({
        name: 'error_tool',
        description: 'Test errors',
        executionPlan: { type: 'action' }
      });
      
      mockBTExecutor.executeTree.mockRejectedValue(new Error('BT execution error'));
      
      const result = await executor.execute(syntheticTool);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Synthetic tool error_tool execution failed');
      expect(result.error).toContain('BT execution error');
    });

    it('should validate tool has executionPlan', async () => {
      const invalidTool = { name: 'invalid' };
      
      const result = await executor.execute(invalidTool);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing executionPlan');
    });

    it('should include metadata in results', async () => {
      const syntheticTool = new SyntheticTool({
        name: 'metadata_tool',
        description: 'Test metadata',
        executionPlan: { type: 'action' }
      });
      
      const result = await executor.execute(syntheticTool);
      
      expect(result.metadata).toEqual({
        toolName: 'metadata_tool',
        executionTime: 150,
        btStatus: 'SUCCESS'
      });
    });
  });

  describe('isSynthetic', () => {
    it('should identify synthetic tools by type', () => {
      const synthetic = { type: 'synthetic', name: 'test' };
      expect(SyntheticToolExecutor.isSynthetic(synthetic)).toBe(true);
    });
    
    it('should identify synthetic tools by executionPlan', () => {
      const synthetic = { executionPlan: { type: 'action' }, name: 'test' };
      expect(SyntheticToolExecutor.isSynthetic(synthetic)).toBe(true);
    });
    
    it('should reject non-synthetic tools', () => {
      const regular = { name: 'regular_tool' };
      expect(SyntheticToolExecutor.isSynthetic(regular)).toBe(false);
    });
    
    it('should handle null/undefined', () => {
      expect(SyntheticToolExecutor.isSynthetic(null)).toBe(false);
      expect(SyntheticToolExecutor.isSynthetic(undefined)).toBe(false);
    });
  });
});