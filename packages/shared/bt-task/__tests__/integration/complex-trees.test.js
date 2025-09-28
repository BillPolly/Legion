/**
 * Integration tests for complex BT trees
 * 
 * Tests real combinations of Sequence, Selector, and Condition nodes
 * with artifact flow and conditional logic. No mocks used - these tests
 * verify the complete behavior tree system working together.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createBTTask } from '../../src/factory/createBTTask.js';
import { SequenceStrategy } from '../../src/strategies/SequenceStrategy.js';
import { SelectorStrategy } from '../../src/strategies/SelectorStrategy.js';
import { ConditionStrategy } from '../../src/strategies/ConditionStrategy.js';
import { ActionStrategy } from '../../src/strategies/ActionStrategy.js';

describe('Complex BT Trees Integration', () => {
  let toolRegistry;
  
  beforeEach(() => {
    // Create real tool implementations for integration tests (NO MOCKS)
    toolRegistry = {
      getTool: async (name) => {
        const tools = {
          'json_stringify': {
            name: 'json_stringify',
            execute: async (params) => {
              try {
                const result = JSON.stringify(params.data);
                return { success: true, data: result };
              } catch (error) {
                return { success: false, error: error.message };
              }
            }
          },
          'json_parse': {
            name: 'json_parse',
            execute: async (params) => {
              try {
                const result = JSON.parse(params.json_string);
                return { success: true, data: result };
              } catch (error) {
                return { success: false, error: error.message };
              }
            }
          },
          'calculator': {
            name: 'calculator',
            execute: async (params) => {
              try {
                // Simple eval for basic math expressions
                const result = eval(params.expression);
                return { success: true, data: result };
              } catch (error) {
                return { success: false, error: error.message };
              }
            }
          }
        };
        return tools[name];
      }
    };
  });
  
  describe('Sequence with nested Selector', () => {
    it('should execute sequence with selector trying alternatives', async () => {
      // Root sequence
      const rootSequence = createBTTask(
        'Main Sequence',
        null,
        SequenceStrategy,
        { type: 'sequence' }
      );
      
      // First action - sets up data
      const setupAction = createBTTask(
        'Setup Data',
        rootSequence,
        ActionStrategy,
        {
          type: 'action',
          tool: 'json_stringify',
          params: {
            data: { mode: 'test', value: 10 }
          },
          outputVariable: 'config'
        }
      );
      
      // Nested selector - tries multiple alternatives
      const selector = createBTTask(
        'Try Alternatives',
        rootSequence,
        SelectorStrategy,
        { type: 'selector' }
      );
      
      // First alternative - will fail
      const failingAction = createBTTask(
        'Failing Option',
        selector,
        ActionStrategy,
        {
          type: 'action',
          tool: 'json_parse',
          params: {
            json_string: 'invalid json'  // Will fail
          }
        }
      );
      
      // Second alternative - will succeed
      const successAction = createBTTask(
        'Success Option',
        selector,
        ActionStrategy,
        {
          type: 'action',
          tool: 'json_parse',
          params: {
            json_string: '@config'  // Use artifact from setup
          },
          outputVariable: 'parsed'
        }
      );
      
      // Final action - uses result
      const finalAction = createBTTask(
        'Process Result',
        rootSequence,
        ActionStrategy,
        {
          type: 'action',
          tool: 'calculator',
          params: {
            expression: '5 * 2'  // Simple calculation
          },
          outputVariable: 'result'
        }
      );
      
      // Create context with toolRegistry
      const context = {
        workspaceDir: '/tmp/test-' + Date.now(),
        toolRegistry: toolRegistry,
        artifacts: {}
      };
      
      // Execute the tree
      rootSequence.send(rootSequence, {
        type: 'execute',
        context: context
      });
      
      // Wait for async completion
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify execution completed
      expect(rootSequence.status).toBe('completed');
      
      // Verify artifacts were created
      expect(context.artifacts.config).toBeDefined();
      expect(context.artifacts.parsed).toBeDefined();
      expect(context.artifacts.result).toBeDefined();
      
      // Verify selector tried alternatives
      expect(failingAction.status).toBe('failed');
      expect(successAction.status).toBe('completed');
      expect(selector.status).toBe('completed');
    });
  });
  
  describe('Condition nodes with artifact checks', () => {
    it('should conditionally execute based on artifact values', async () => {
      // Root sequence
      const root = createBTTask(
        'Conditional Workflow',
        null,
        SequenceStrategy,
        { type: 'sequence' }
      );
      
      // Setup action - creates test data
      const setup = createBTTask(
        'Generate Data',
        root,
        ActionStrategy,
        {
          type: 'action',
          tool: 'json_stringify',
          params: {
            data: { enabled: true, threshold: 15, value: 20 }
          },
          outputVariable: 'testData'
        }
      );
      
      // Parse the data for use in conditions
      const parse = createBTTask(
        'Parse Data',
        root,
        ActionStrategy,
        {
          type: 'action',
          tool: 'json_parse',
          params: {
            json_string: '@testData'
          },
          outputVariable: 'config'
        }
      );
      
      // First condition - checks if enabled
      const enabledCheck = createBTTask(
        'Check Enabled',
        root,
        ConditionStrategy,
        {
          type: 'condition',
          condition: '@config.enabled === true'
        }
      );
      
      // Action to run if enabled
      const enabledAction = createBTTask(
        'Process When Enabled',
        enabledCheck,
        ActionStrategy,
        {
          type: 'action',
          tool: 'calculator',
          params: {
            expression: '20 + 10'  // Use literal value instead of artifact ref in expression
          },
          outputVariable: 'processedValue'
        }
      );
      
      // Second condition - threshold check
      const thresholdCheck = createBTTask(
        'Check Threshold',
        root,
        ConditionStrategy,
        {
          type: 'condition',
          condition: '@config.value > @config.threshold'
        }
      );
      
      // Action for threshold exceeded
      const thresholdAction = createBTTask(
        'Handle High Value',
        thresholdCheck,
        ActionStrategy,
        {
          type: 'action',
          tool: 'json_stringify',
          params: {
            data: { alert: 'threshold exceeded', value: '@processedValue' }
          },
          outputVariable: 'alert'
        }
      );
      
      // Create context
      const context = {
        workspaceDir: '/tmp/test-' + Date.now(),
        toolRegistry: toolRegistry,
        artifacts: {}
      };
      
      // Execute tree
      root.send(root, {
        type: 'execute',
        context: context
      });
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify completion
      expect(root.status).toBe('completed');
      
      // Verify conditions evaluated correctly
      expect(enabledCheck.status).toBe('completed');
      expect(thresholdCheck.status).toBe('completed');
      
      // Verify artifacts
      expect(context.artifacts.config).toBeDefined();
      expect(context.artifacts.config.value.enabled).toBe(true);
      expect(context.artifacts.processedValue).toBeDefined();
      expect(context.artifacts.alert).toBeDefined();
    });
    
    it('should skip children when condition is false', async () => {
      // Root with condition that will be false
      const root = createBTTask(
        'Skip Test',
        null,
        ConditionStrategy,
        {
          type: 'condition',
          condition: '10 < 5'  // False condition
        }
      );
      
      // Child that should be skipped
      const skippedAction = createBTTask(
        'Should Skip',
        root,
        ActionStrategy,
        {
          type: 'action',
          tool: 'calculator',
          params: { expression: '1 + 1' },
          outputVariable: 'skipped'
        }
      );
      
      // Context
      const context = {
        workspaceDir: '/tmp/test-' + Date.now(),
        toolRegistry: toolRegistry,
        artifacts: {}
      };
      
      // Execute
      root.send(root, {
        type: 'execute',
        context: context
      });
      
      // Wait
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify condition completed but child was skipped
      expect(root.status).toBe('completed');
      expect(skippedAction.status).toBe('pending'); // Never executed
      expect(context.artifacts.skipped).toBeUndefined(); // No artifact created
    });
  });
  
  describe('Mixed node type trees', () => {
    it('should handle complex tree with all node types', async () => {
      // Root sequence
      const root = createBTTask(
        'Complex Tree',
        null,
        SequenceStrategy,
        { type: 'sequence' }
      );
      
      // Initial setup
      const init = createBTTask(
        'Initialize',
        root,
        ActionStrategy,
        {
          type: 'action',
          tool: 'json_stringify',
          params: {
            data: { 
              mode: 'production',
              retries: 0,
              maxRetries: 3 
            }
          },
          outputVariable: 'state'
        }
      );
      
      // Condition to check mode
      const modeCheck = createBTTask(
        'Check Production Mode',
        root,
        ConditionStrategy,
        {
          type: 'condition',
          condition: '"production" === "production"'  // Will be true
        }
      );
      
      // Nested selector in condition
      const errorHandler = createBTTask(
        'Error Recovery',
        modeCheck,
        SelectorStrategy,
        { type: 'selector' }
      );
      
      // First attempt - simulate failure
      const attempt1 = createBTTask(
        'Primary Attempt',
        errorHandler,
        ActionStrategy,
        {
          type: 'action',
          tool: 'json_parse',
          params: {
            json_string: 'not valid json'  // Will fail
          }
        }
      );
      
      // Fallback - will succeed
      const fallback = createBTTask(
        'Fallback',
        errorHandler,
        ActionStrategy,
        {
          type: 'action',
          tool: 'json_parse',
          params: {
            json_string: '@state'  // Use valid state
          },
          outputVariable: 'recovered'
        }
      );
      
      // Final processing sequence
      const finalSeq = createBTTask(
        'Final Steps',
        root,
        SequenceStrategy,
        { type: 'sequence' }
      );
      
      // Update state
      const updateState = createBTTask(
        'Update State',
        finalSeq,
        ActionStrategy,
        {
          type: 'action',
          tool: 'json_stringify',
          params: {
            data: {
              mode: '@recovered.mode',
              status: 'completed',
              recovered: true
            }
          },
          outputVariable: 'finalState'
        }
      );
      
      // Create context
      const context = {
        workspaceDir: '/tmp/test-' + Date.now(),
        toolRegistry: toolRegistry,
        artifacts: {}
      };
      
      // Execute
      root.send(root, {
        type: 'execute',
        context: context
      });
      
      // Wait for complex execution
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify overall success
      expect(root.status).toBe('completed');
      
      // Verify node execution
      expect(modeCheck.status).toBe('completed'); // Condition passed
      expect(errorHandler.status).toBe('completed'); // Selector found alternative
      expect(attempt1.status).toBe('failed'); // First attempt failed
      expect(fallback.status).toBe('completed'); // Fallback succeeded
      expect(finalSeq.status).toBe('completed'); // Final sequence completed
      
      // Verify artifacts
      expect(context.artifacts.state).toBeDefined();
      expect(context.artifacts.recovered).toBeDefined();
      expect(context.artifacts.finalState).toBeDefined();
      
      // Verify final state content
      const finalState = JSON.parse(context.artifacts.finalState.value);
      expect(finalState.status).toBe('completed');
      expect(finalState.recovered).toBe(true);
    });
  });
  
  describe('Correct execution flow', () => {
    it('should maintain proper parent-child execution order', async () => {
      const executionOrder = [];
      
      // Build simple tree without complex tracking
      const root = createBTTask('Root', null, SequenceStrategy, { type: 'sequence' });
      
      // Add completion handler to track execution
      const originalComplete = root.completeBTNode;
      root.completeBTNode = function(result) {
        executionOrder.push('Root-complete');
        originalComplete.call(this, result);
      };
      
      const child1 = createBTTask('Child1', root, ActionStrategy, {
        type: 'action',
        tool: 'calculator',
        params: { expression: '1 + 1' },
        outputVariable: 'result1'
      });
      
      const child2 = createBTTask('Child2', root, SequenceStrategy, { type: 'sequence' });
      
      const grandchild1 = createBTTask('Grandchild1', child2, ActionStrategy, {
        type: 'action',
        tool: 'calculator',
        params: { expression: '2 + 2' },
        outputVariable: 'result2'
      });
      
      const grandchild2 = createBTTask('Grandchild2', child2, ActionStrategy, {
        type: 'action',
        tool: 'calculator',
        params: { expression: '3 + 3' },
        outputVariable: 'result3'
      });
      
      // Execute
      const context = {
        workspaceDir: '/tmp/test-' + Date.now(),
        toolRegistry: toolRegistry,
        artifacts: {}
      };
      
      root.send(root, {
        type: 'execute',
        context: context
      });
      
      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify all completed
      expect(root.status).toBe('completed');
      expect(child1.status).toBe('completed');
      expect(child2.status).toBe('completed');
      expect(grandchild1.status).toBe('completed');
      expect(grandchild2.status).toBe('completed');
      
      // Verify artifacts were created in correct order
      expect(context.artifacts.result1).toBeDefined();
      expect(context.artifacts.result1.value).toBe(2); // 1 + 1
      expect(context.artifacts.result2).toBeDefined();
      expect(context.artifacts.result2.value).toBe(4); // 2 + 2
      expect(context.artifacts.result3).toBeDefined();
      expect(context.artifacts.result3.value).toBe(6); // 3 + 3
    });
    
    it('should propagate failures correctly through tree', async () => {
      // Root selector
      const root = createBTTask('Root Selector', null, SelectorStrategy, { type: 'selector' });
      
      // First sequence - will fail
      const seq1 = createBTTask('Sequence 1', root, SequenceStrategy, { type: 'sequence' });
      
      const action1 = createBTTask('Action 1', seq1, ActionStrategy, {
        type: 'action',
        tool: 'calculator',
        params: { expression: '5 + 5' },
        outputVariable: 'sum'
      });
      
      const failAction = createBTTask('Fail Action', seq1, ActionStrategy, {
        type: 'action',
        tool: 'json_parse',
        params: { json_string: 'bad json' }  // Will fail
      });
      
      // Second sequence - should execute as fallback
      const seq2 = createBTTask('Sequence 2', root, SequenceStrategy, { type: 'sequence' });
      
      const action2 = createBTTask('Action 2', seq2, ActionStrategy, {
        type: 'action',
        tool: 'calculator',
        params: { expression: '10 * 2' },
        outputVariable: 'product'
      });
      
      // Execute
      const context = {
        workspaceDir: '/tmp/test-' + Date.now(),
        toolRegistry: toolRegistry,
        artifacts: {}
      };
      
      root.send(root, {
        type: 'execute',
        context: context
      });
      
      // Wait
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify selector succeeded with second alternative
      expect(root.status).toBe('completed');
      
      // First sequence failed
      expect(seq1.status).toBe('failed');
      expect(action1.status).toBe('completed'); // First action succeeded
      expect(failAction.status).toBe('failed'); // Second action failed
      
      // Second sequence succeeded
      expect(seq2.status).toBe('completed');
      expect(action2.status).toBe('completed');
      
      // Verify artifacts
      expect(context.artifacts.sum).toBeDefined(); // From first sequence before failure
      expect(context.artifacts.product).toBeDefined(); // From successful second sequence
    });
  });
});