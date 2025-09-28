/**
 * Unit tests for ConditionStrategy
 * 
 * ConditionStrategy evaluates conditions and conditionally executes children:
 * - Evaluates condition expression
 * - Executes children if condition is true
 * - Skips children if condition is false
 * - Supports @ syntax for artifact references
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createBTTask } from '../../../src/factory/createBTTask.js';
import { ConditionStrategy } from '../../../src/strategies/ConditionStrategy.js';
import { BTTaskStrategy } from '../../../src/core/BTTaskStrategy.js';

describe('ConditionStrategy', () => {
  describe('Prototype Chain', () => {
    it('should extend BTTaskStrategy', () => {
      expect(Object.getPrototypeOf(ConditionStrategy)).toBe(BTTaskStrategy);
    });
    
    it('should have executeBTNode method', () => {
      expect(typeof ConditionStrategy.executeBTNode).toBe('function');
    });
    
    it('should have evaluateCondition method', () => {
      expect(typeof ConditionStrategy.evaluateCondition).toBe('function');
    });
    
    it('should have handleChildResult method', () => {
      expect(typeof ConditionStrategy.handleChildResult).toBe('function');
    });
  });
  
  describe('Condition Evaluation', () => {
    it('should execute children when condition is true', async () => {
      const conditionTask = createBTTask(
        'Check Condition',
        null,
        ConditionStrategy,
        {
          type: 'condition',
          condition: 'true'
        }
      );
      
      const child = createBTTask('Child Action', conditionTask, BTTaskStrategy);
      
      let childExecuted = false;
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          childExecuted = true;
          this.send(this.parent, {
            type: 'child-result',
            status: 'SUCCESS'
          });
        }
      };
      
      conditionTask.executeBTNode(conditionTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Child should have been executed
      expect(childExecuted).toBe(true);
      expect(conditionTask.status).toBe('completed');
    });
    
    it('should skip children when condition is false', async () => {
      const conditionTask = createBTTask(
        'Skip Condition',
        null,
        ConditionStrategy,
        {
          type: 'condition',
          condition: 'false'
        }
      );
      
      const child = createBTTask('Skipped Child', conditionTask, BTTaskStrategy);
      
      let childExecuted = false;
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          childExecuted = true;
        }
      };
      
      conditionTask.executeBTNode(conditionTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Child should NOT have been executed
      expect(childExecuted).toBe(false);
      // Condition should still complete successfully
      expect(conditionTask.status).toBe('completed');
    });
    
    it('should evaluate boolean expressions', async () => {
      const conditionTask = createBTTask(
        'Boolean Expression',
        null,
        ConditionStrategy,
        {
          type: 'condition',
          condition: '5 > 3'
        }
      );
      
      const child = createBTTask('Child', conditionTask, BTTaskStrategy);
      
      let childExecuted = false;
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          childExecuted = true;
          this.send(this.parent, {
            type: 'child-result',
            status: 'SUCCESS'
          });
        }
      };
      
      conditionTask.executeBTNode(conditionTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Expression "5 > 3" is true, so child should execute
      expect(childExecuted).toBe(true);
    });
  });
  
  describe('Artifact References', () => {
    it('should resolve @ references in conditions', async () => {
      const conditionTask = createBTTask(
        'Check Artifact',
        null,
        ConditionStrategy,
        {
          type: 'condition',
          condition: '@result.success === true'
        }
      );
      
      const child = createBTTask('Child', conditionTask, BTTaskStrategy);
      
      let childExecuted = false;
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          childExecuted = true;
          this.send(this.parent, {
            type: 'child-result',
            status: 'SUCCESS'
          });
        }
      };
      
      conditionTask.executeBTNode(conditionTask, {
        type: 'execute',
        context: {
          artifacts: {
            result: {
              name: 'result',
              value: { success: true },
              type: 'test'
            }
          }
        }
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Condition should evaluate to true based on artifact
      expect(childExecuted).toBe(true);
    });
    
    it('should handle missing artifact references gracefully', async () => {
      const conditionTask = createBTTask(
        'Missing Artifact',
        null,
        ConditionStrategy,
        {
          type: 'condition',
          condition: '@missingValue === 42'
        }
      );
      
      const child = createBTTask('Child', conditionTask, BTTaskStrategy);
      
      let childExecuted = false;
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          childExecuted = true;
        }
      };
      
      conditionTask.executeBTNode(conditionTask, {
        type: 'execute',
        context: { artifacts: {} }
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // undefined === 42 is false, so child should not execute
      expect(childExecuted).toBe(false);
      // But condition task should still complete
      expect(conditionTask.status).toBe('completed');
    });
    
    it('should resolve nested artifact paths', async () => {
      const conditionTask = createBTTask(
        'Nested Path',
        null,
        ConditionStrategy,
        {
          type: 'condition',
          condition: '@config.enabled === true && @config.level > 5'
        }
      );
      
      const child = createBTTask('Child', conditionTask, BTTaskStrategy);
      
      let childExecuted = false;
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          childExecuted = true;
          this.send(this.parent, {
            type: 'child-result',
            status: 'SUCCESS'
          });
        }
      };
      
      conditionTask.executeBTNode(conditionTask, {
        type: 'execute',
        context: {
          artifacts: {
            config: {
              name: 'config',
              value: {
                enabled: true,
                level: 10
              },
              type: 'configuration'
            }
          }
        }
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Both conditions should be true
      expect(childExecuted).toBe(true);
    });
  });
  
  describe('Empty Condition', () => {
    it('should succeed with no children when condition is true', async () => {
      const conditionTask = createBTTask(
        'Empty True',
        null,
        ConditionStrategy,
        {
          type: 'condition',
          condition: 'true'
        }
      );
      
      // No children added
      
      conditionTask.executeBTNode(conditionTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Should complete successfully
      expect(conditionTask.status).toBe('completed');
    });
    
    it('should succeed with no children when condition is false', async () => {
      const conditionTask = createBTTask(
        'Empty False',
        null,
        ConditionStrategy,
        {
          type: 'condition',
          condition: 'false'
        }
      );
      
      // No children added
      
      conditionTask.executeBTNode(conditionTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Should complete successfully (skipped)
      expect(conditionTask.status).toBe('completed');
    });
  });
  
  describe('Child Result Handling', () => {
    it('should propagate child success when condition is true', async () => {
      const conditionTask = createBTTask(
        'Propagate Success',
        null,
        ConditionStrategy,
        {
          type: 'condition',
          condition: 'true'
        }
      );
      
      const child = createBTTask('Success Child', conditionTask, BTTaskStrategy);
      
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          this.send(this.parent, {
            type: 'child-result',
            status: 'SUCCESS',
            data: { result: 'child succeeded' }
          });
        }
      };
      
      conditionTask.executeBTNode(conditionTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Condition should complete with success
      expect(conditionTask.status).toBe('completed');
    });
    
    it('should propagate child failure when condition is true', async () => {
      const conditionTask = createBTTask(
        'Propagate Failure',
        null,
        ConditionStrategy,
        {
          type: 'condition',
          condition: 'true'
        }
      );
      
      const child = createBTTask('Failing Child', conditionTask, BTTaskStrategy);
      
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          this.send(this.parent, {
            type: 'child-result',
            status: 'FAILURE',
            error: 'child failed'
          });
        }
      };
      
      conditionTask.executeBTNode(conditionTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Condition should propagate the failure
      expect(conditionTask.status).toBe('failed');
    });
  });
  
  describe('Complex Conditions', () => {
    it('should handle complex boolean logic', async () => {
      const conditionTask = createBTTask(
        'Complex Logic',
        null,
        ConditionStrategy,
        {
          type: 'condition',
          condition: '(10 > 5) && (3 < 7) || false'
        }
      );
      
      const child = createBTTask('Child', conditionTask, BTTaskStrategy);
      
      let childExecuted = false;
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          childExecuted = true;
          this.send(this.parent, {
            type: 'child-result',
            status: 'SUCCESS'
          });
        }
      };
      
      conditionTask.executeBTNode(conditionTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // (true && true) || false = true
      expect(childExecuted).toBe(true);
    });
    
    it('should handle string comparisons', async () => {
      const conditionTask = createBTTask(
        'String Compare',
        null,
        ConditionStrategy,
        {
          type: 'condition',
          condition: '"production" === "production"'
        }
      );
      
      const child = createBTTask('Child', conditionTask, BTTaskStrategy);
      
      let childExecuted = false;
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          childExecuted = true;
          this.send(this.parent, {
            type: 'child-result',
            status: 'SUCCESS'
          });
        }
      };
      
      conditionTask.executeBTNode(conditionTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(childExecuted).toBe(true);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid condition expressions', async () => {
      const conditionTask = createBTTask(
        'Invalid Condition',
        null,
        ConditionStrategy,
        {
          type: 'condition',
          condition: 'this is not valid javascript'
        }
      );
      
      const child = createBTTask('Child', conditionTask, BTTaskStrategy);
      
      let childExecuted = false;
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          childExecuted = true;
        }
      };
      
      conditionTask.executeBTNode(conditionTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Should fail gracefully
      expect(childExecuted).toBe(false);
      expect(conditionTask.status).toBe('failed');
    });
    
    it('should fail when no condition is specified', async () => {
      const conditionTask = createBTTask(
        'No Condition',
        null,
        ConditionStrategy,
        {
          type: 'condition'
          // No condition specified
        }
      );
      
      conditionTask.executeBTNode(conditionTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Should fail without condition
      expect(conditionTask.status).toBe('failed');
    });
  });
});