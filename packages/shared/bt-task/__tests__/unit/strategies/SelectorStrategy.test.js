/**
 * Unit tests for SelectorStrategy
 * 
 * SelectorStrategy tries alternatives until one succeeds:
 * - Executes children one at a time in order
 * - Succeeds on first child success
 * - Fails only when all children fail
 * - Stops trying alternatives once one succeeds
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createBTTask } from '../../../src/factory/createBTTask.js';
import { SelectorStrategy } from '../../../src/strategies/SelectorStrategy.js';
import { BTTaskStrategy } from '../../../src/core/BTTaskStrategy.js';

describe('SelectorStrategy', () => {
  describe('Prototype Chain', () => {
    it('should extend BTTaskStrategy', () => {
      expect(Object.getPrototypeOf(SelectorStrategy)).toBe(BTTaskStrategy);
    });
    
    it('should have executeChildren method', () => {
      expect(typeof SelectorStrategy.executeChildren).toBe('function');
    });
    
    it('should have handleChildResult method', () => {
      expect(typeof SelectorStrategy.handleChildResult).toBe('function');
    });
  });
  
  describe('Alternative Execution', () => {
    it('should try alternatives until one succeeds', async () => {
      const selectorTask = createBTTask(
        'Try Alternatives',
        null,
        SelectorStrategy,
        { type: 'selector' }
      );
      
      // Create three mock children: fail, fail, succeed
      const child1 = createBTTask('Option 1', selectorTask, BTTaskStrategy);
      const child2 = createBTTask('Option 2', selectorTask, BTTaskStrategy);
      const child3 = createBTTask('Option 3', selectorTask, BTTaskStrategy);
      
      // Track which children were executed
      const executedChildren = [];
      
      // Override onMessage to simulate child responses
      child1.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          executedChildren.push('child1');
          // Child 1 fails
          this.send(this.parent, {
            type: 'child-result',
            status: 'FAILURE',
            error: 'Option 1 failed'
          });
        }
      };
      
      child2.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          executedChildren.push('child2');
          // Child 2 fails
          this.send(this.parent, {
            type: 'child-result',
            status: 'FAILURE',
            error: 'Option 2 failed'
          });
        }
      };
      
      child3.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          executedChildren.push('child3');
          // Child 3 succeeds
          this.send(this.parent, {
            type: 'child-result',
            status: 'SUCCESS',
            data: { result: 'Option 3 worked!' }
          });
        }
      };
      
      // Start execution
      selectorTask.executeBTNode(selectorTask, {
        type: 'execute',
        context: {}
      });
      
      // Wait for async execution
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      
      // Verify all three children were tried
      expect(executedChildren).toEqual(['child1', 'child2', 'child3']);
      
      // Verify selector succeeded
      expect(selectorTask.status).toBe('completed');
    });
    
    it('should stop on first success', async () => {
      const selectorTask = createBTTask(
        'Stop on Success',
        null,
        SelectorStrategy,
        { type: 'selector' }
      );
      
      const child1 = createBTTask('Option 1', selectorTask, BTTaskStrategy);
      const child2 = createBTTask('Option 2', selectorTask, BTTaskStrategy);
      const child3 = createBTTask('Option 3', selectorTask, BTTaskStrategy);
      
      const executedChildren = [];
      
      child1.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          executedChildren.push('child1');
          // Child 1 fails
          this.send(this.parent, {
            type: 'child-result',
            status: 'FAILURE'
          });
        }
      };
      
      child2.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          executedChildren.push('child2');
          // Child 2 succeeds - should stop here
          this.send(this.parent, {
            type: 'child-result',
            status: 'SUCCESS'
          });
        }
      };
      
      child3.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          executedChildren.push('child3');
          // Should never execute
        }
      };
      
      selectorTask.executeBTNode(selectorTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      
      // Verify only first two children executed
      expect(executedChildren).toEqual(['child1', 'child2']);
      
      // Verify child3 never ran
      expect(executedChildren).not.toContain('child3');
      
      // Verify selector succeeded
      expect(selectorTask.status).toBe('completed');
    });
  });
  
  describe('Failure Cases', () => {
    it('should fail when all children fail', async () => {
      const selectorTask = createBTTask(
        'All Fail',
        null,
        SelectorStrategy,
        { type: 'selector' }
      );
      
      const child1 = createBTTask('Option 1', selectorTask, BTTaskStrategy);
      const child2 = createBTTask('Option 2', selectorTask, BTTaskStrategy);
      
      child1.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          this.send(this.parent, {
            type: 'child-result',
            status: 'FAILURE',
            error: 'Option 1 failed'
          });
        }
      };
      
      child2.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          this.send(this.parent, {
            type: 'child-result',
            status: 'FAILURE',
            error: 'Option 2 failed'
          });
        }
      };
      
      selectorTask.executeBTNode(selectorTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      
      // Verify selector failed
      expect(selectorTask.status).toBe('failed');
    });
    
    it('should provide error details when all fail', async () => {
      const selectorTask = createBTTask(
        'Track Errors',
        null,
        SelectorStrategy,
        { type: 'selector' }
      );
      
      const child1 = createBTTask('Option 1', selectorTask, BTTaskStrategy);
      
      child1.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          this.send(this.parent, {
            type: 'child-result',
            status: 'FAILURE',
            error: 'Specific error message'
          });
        }
      };
      
      selectorTask.executeBTNode(selectorTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Verify error details available
      expect(selectorTask.status).toBe('failed');
      expect(selectorTask.result).toBeDefined();
    });
  });
  
  describe('Empty Selector', () => {
    it('should fail with no children', async () => {
      const emptySelector = createBTTask(
        'Empty',
        null,
        SelectorStrategy,
        { type: 'selector' }
      );
      
      // No children added
      
      emptySelector.executeBTNode(emptySelector, {
        type: 'execute',
        context: {}
      });
      
      // Wait for completion
      await new Promise(resolve => setImmediate(resolve));
      
      // Empty selector should fail (no alternatives to try)
      expect(emptySelector.status).toBe('failed');
    });
  });
  
  describe('Context Propagation', () => {
    it('should pass context to each alternative', async () => {
      const selectorTask = createBTTask(
        'Context Flow',
        null,
        SelectorStrategy,
        { type: 'selector' }
      );
      
      const child1 = createBTTask('Option 1', selectorTask, BTTaskStrategy);
      const child2 = createBTTask('Option 2', selectorTask, BTTaskStrategy);
      
      const receivedContexts = [];
      
      child1.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          receivedContexts.push(message.context);
          this.send(this.parent, {
            type: 'child-result',
            status: 'FAILURE'
          });
        }
      };
      
      child2.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          receivedContexts.push(message.context);
          this.send(this.parent, {
            type: 'child-result',
            status: 'SUCCESS'
          });
        }
      };
      
      const initialContext = {
        workspaceDir: '/test',
        artifacts: { test: 'value' }
      };
      
      selectorTask.executeBTNode(selectorTask, {
        type: 'execute',
        context: initialContext
      });
      
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      
      // Verify context was passed to both children
      expect(receivedContexts).toHaveLength(2);
      expect(receivedContexts[0]).toEqual(initialContext);
      expect(receivedContexts[1]).toEqual(initialContext);
    });
    
    it('should preserve artifacts from successful alternative', async () => {
      const selectorTask = createBTTask(
        'Preserve Artifacts',
        null,
        SelectorStrategy,
        { type: 'selector' }
      );
      
      const child = createBTTask('Success Option', selectorTask, BTTaskStrategy);
      
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          // Modify context and succeed
          const updatedContext = {
            ...message.context,
            artifacts: {
              ...message.context.artifacts,
              newArtifact: {
                name: 'newArtifact',
                value: 'created by child',
                type: 'test'
              }
            }
          };
          
          this.send(this.parent, {
            type: 'child-result',
            status: 'SUCCESS',
            context: updatedContext
          });
        }
      };
      
      selectorTask.executeBTNode(selectorTask, {
        type: 'execute',
        context: { artifacts: {} }
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Verify selector completed
      expect(selectorTask.status).toBe('completed');
    });
  });
  
  describe('First Success Behavior', () => {
    it('should succeed immediately when first child succeeds', async () => {
      const selectorTask = createBTTask(
        'First Success',
        null,
        SelectorStrategy,
        { type: 'selector' }
      );
      
      const child1 = createBTTask('Winner', selectorTask, BTTaskStrategy);
      const child2 = createBTTask('Never Tried', selectorTask, BTTaskStrategy);
      
      let child1Executed = false;
      let child2Executed = false;
      
      child1.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          child1Executed = true;
          this.send(this.parent, {
            type: 'child-result',
            status: 'SUCCESS',
            data: { winner: 'child1' }
          });
        }
      };
      
      child2.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          child2Executed = true;
        }
      };
      
      selectorTask.executeBTNode(selectorTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Verify only first child executed
      expect(child1Executed).toBe(true);
      expect(child2Executed).toBe(false);
      
      // Verify selector succeeded
      expect(selectorTask.status).toBe('completed');
    });
  });
});