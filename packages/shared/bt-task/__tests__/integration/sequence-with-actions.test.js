/**
 * Integration tests for Sequence with Action nodes
 * Tests real tool execution in sequence with artifact flow
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createBTTask } from '../../src/factory/createBTTask.js';
import { SequenceStrategy } from '../../src/strategies/SequenceStrategy.js';
import { ActionStrategy } from '../../src/strategies/ActionStrategy.js';

describe('Sequence with Actions Integration', () => {
  let toolRegistry;
  let executionLog;
  
  beforeEach(() => {
    executionLog = [];
    
    // Create a real tool registry with test tools
    toolRegistry = {
      getTool: async (name) => {
        const tools = {
          'add_numbers': {
            name: 'add_numbers',
            execute: async (params) => {
              executionLog.push(`add_numbers: ${params.a} + ${params.b}`);
              return {
                success: true,
                data: params.a + params.b
              };
            }
          },
          'multiply_by': {
            name: 'multiply_by',
            execute: async (params) => {
              executionLog.push(`multiply_by: ${params.value} * ${params.factor}`);
              return {
                success: true,
                data: params.value * params.factor
              };
            }
          },
          'format_result': {
            name: 'format_result',
            execute: async (params) => {
              executionLog.push(`format_result: ${params.value}`);
              return {
                success: true,
                data: `Result: ${params.value}`
              };
            }
          },
          'failing_tool': {
            name: 'failing_tool',
            execute: async (params) => {
              executionLog.push('failing_tool: executed');
              return {
                success: false,
                error: 'Intentional failure'
              };
            }
          }
        };
        
        return tools[name];
      }
    };
  });
  
  describe('Sequential Tool Execution', () => {
    it('should execute actions in sequence with artifact flow', async () => {
      // Create sequence: add -> multiply -> format
      const sequenceTask = createBTTask(
        'Math Sequence',
        null,
        SequenceStrategy,
        { type: 'sequence' }
      );
      
      // Action 1: Add 5 + 3 -> @sum
      const addTask = createBTTask(
        'Add Numbers',
        sequenceTask,
        ActionStrategy,
        {
          type: 'action',
          tool: 'add_numbers',
          params: { a: 5, b: 3 },
          outputVariable: 'sum'
        }
      );
      
      // Action 2: Multiply @sum * 2 -> @product
      const multiplyTask = createBTTask(
        'Multiply',
        sequenceTask,
        ActionStrategy,
        {
          type: 'action',
          tool: 'multiply_by',
          params: { value: '@sum', factor: 2 },
          outputVariable: 'product'
        }
      );
      
      // Action 3: Format @product -> @result
      const formatTask = createBTTask(
        'Format Result',
        sequenceTask,
        ActionStrategy,
        {
          type: 'action',
          tool: 'format_result',
          params: { value: '@product' },
          outputVariable: 'result'
        }
      );
      
      // Execute sequence
      sequenceTask.executeBTNode(sequenceTask, {
        type: 'execute',
        context: {
          workspaceDir: '/test',
          toolRegistry: toolRegistry,
          artifacts: {}
        }
      });
      
      // Wait for async execution
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      
      // Verify execution order
      expect(executionLog).toEqual([
        'add_numbers: 5 + 3',
        'multiply_by: 8 * 2',
        'format_result: 16'
      ]);
      
      // Verify artifacts (getArtifact returns the artifact object, not just the value)
      expect(sequenceTask.getArtifact('sum')?.value).toBe(8);
      expect(sequenceTask.getArtifact('product')?.value).toBe(16);
      expect(sequenceTask.getArtifact('result')?.value).toBe('Result: 16');
      
      // Verify sequence completed
      expect(sequenceTask.status).toBe('completed');
    });
    
    it('should pass artifacts between actions', async () => {
      const sequenceTask = createBTTask(
        'Pipeline',
        null,
        SequenceStrategy,
        { type: 'sequence' }
      );
      
      // Action 1 produces value
      const action1 = createBTTask(
        'Produce',
        sequenceTask,
        ActionStrategy,
        {
          type: 'action',
          tool: 'add_numbers',
          params: { a: 10, b: 20 },
          outputVariable: 'intermediate'
        }
      );
      
      // Action 2 consumes value from action 1
      const action2 = createBTTask(
        'Consume',
        sequenceTask,
        ActionStrategy,
        {
          type: 'action',
          tool: 'multiply_by',
          params: { value: '@intermediate', factor: 3 },
          outputVariable: 'final'
        }
      );
      
      sequenceTask.executeBTNode(sequenceTask, {
        type: 'execute',
        context: {
          toolRegistry: toolRegistry,
          artifacts: {}
        }
      });
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify artifacts were passed correctly
      expect(sequenceTask.getArtifact('intermediate')?.value).toBe(30);
      expect(sequenceTask.getArtifact('final')?.value).toBe(90);
    });
  });
  
  describe('Failure Propagation', () => {
    it('should stop execution when an action fails', async () => {
      const sequenceTask = createBTTask(
        'Failing Sequence',
        null,
        SequenceStrategy,
        { type: 'sequence' }
      );
      
      // Action 1: succeeds
      const action1 = createBTTask(
        'Success',
        sequenceTask,
        ActionStrategy,
        {
          type: 'action',
          tool: 'add_numbers',
          params: { a: 1, b: 1 }
        }
      );
      
      // Action 2: fails
      const action2 = createBTTask(
        'Failure',
        sequenceTask,
        ActionStrategy,
        {
          type: 'action',
          tool: 'failing_tool',
          params: {}
        }
      );
      
      // Action 3: should not execute
      const action3 = createBTTask(
        'Should Not Run',
        sequenceTask,
        ActionStrategy,
        {
          type: 'action',
          tool: 'add_numbers',
          params: { a: 5, b: 5 }
        }
      );
      
      sequenceTask.executeBTNode(sequenceTask, {
        type: 'execute',
        context: {
          toolRegistry: toolRegistry,
          artifacts: {}
        }
      });
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify execution stopped at failure
      expect(executionLog).toEqual([
        'add_numbers: 1 + 1',
        'failing_tool: executed'
        // Action 3 should not have executed
      ]);
      
      // Verify sequence failed
      expect(sequenceTask.status).toBe('failed');
    });
    
    it('should provide error details from failed action', async () => {
      const sequenceTask = createBTTask(
        'Error Sequence',
        null,
        SequenceStrategy,
        { type: 'sequence' }
      );
      
      const failingAction = createBTTask(
        'Failing Action',
        sequenceTask,
        ActionStrategy,
        {
          type: 'action',
          tool: 'failing_tool',
          params: {}
        }
      );
      
      sequenceTask.executeBTNode(sequenceTask, {
        type: 'execute',
        context: {
          toolRegistry: toolRegistry,
          artifacts: {}
        }
      });
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify error is propagated
      expect(sequenceTask.status).toBe('failed');
      expect(sequenceTask.result).toBeDefined();
    });
  });
  
  describe('Context Propagation', () => {
    it('should maintain context through sequence execution', async () => {
      const sequenceTask = createBTTask(
        'Context Test',
        null,
        SequenceStrategy,
        { type: 'sequence' }
      );
      
      const action = createBTTask(
        'Test Action',
        sequenceTask,
        ActionStrategy,
        {
          type: 'action',
          tool: 'add_numbers',
          params: { a: 1, b: 2 },
          outputVariable: 'result'
        }
      );
      
      const initialContext = {
        workspaceDir: '/test/workspace',
        toolRegistry: toolRegistry,
        artifacts: {
          initialValue: {
            name: 'initialValue',
            value: 'preserved',
            description: 'Initial value',
            type: 'initial',
            createdAt: new Date()
          }
        }
      };
      
      sequenceTask.executeBTNode(sequenceTask, {
        type: 'execute',
        context: initialContext
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify initial artifacts preserved
      expect(sequenceTask.getArtifact('initialValue')?.value).toBe('preserved');
      
      // Verify new artifact added
      expect(sequenceTask.getArtifact('result')?.value).toBe(3);
    });
    
    it('should allow actions to reference pre-existing artifacts', async () => {
      const sequenceTask = createBTTask(
        'Pre-existing Artifacts',
        null,
        SequenceStrategy,
        { type: 'sequence' }
      );
      
      const action = createBTTask(
        'Use Artifact',
        sequenceTask,
        ActionStrategy,
        {
          type: 'action',
          tool: 'multiply_by',
          params: { value: '@baseValue', factor: 2 },
          outputVariable: 'doubled'
        }
      );
      
      sequenceTask.executeBTNode(sequenceTask, {
        type: 'execute',
        context: {
          toolRegistry: toolRegistry,
          artifacts: {
            baseValue: {
              name: 'baseValue',
              value: 50,
              description: 'Base value',
              type: 'initial',
              createdAt: new Date()
            }
          }
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify artifact from initial context was used
      expect(sequenceTask.getArtifact('doubled')?.value).toBe(100);
    });
  });
  
  describe('Empty Sequence', () => {
    it('should complete successfully with no actions', async () => {
      const emptySequence = createBTTask(
        'Empty',
        null,
        SequenceStrategy,
        { type: 'sequence' }
      );
      
      emptySequence.executeBTNode(emptySequence, {
        type: 'execute',
        context: {
          toolRegistry: toolRegistry,
          artifacts: {}
        }
      });
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should complete successfully
      expect(emptySequence.status).toBe('completed');
    });
  });
});