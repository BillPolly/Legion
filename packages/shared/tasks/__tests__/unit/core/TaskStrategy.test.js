import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import TaskStrategy from '../../../src/core/TaskStrategy.js';
import { createTask } from '../../../src/core/createTask.js';

describe('TaskStrategy Prototypal System', () => {
  describe('TaskStrategy Base Prototype', () => {
    let strategy;

    beforeEach(() => {
      strategy = Object.create(TaskStrategy);
    });

    it('should have initialization method', () => {
      expect(typeof strategy.initializeTask).toBe('function');
    });

    it('should have message handling methods', () => {
      expect(typeof strategy.onMessage).toBe('function');
      expect(typeof strategy.receiveMessage).toBe('function');
      expect(typeof strategy.addToConversation).toBe('function');
    });

    it('should have status methods', () => {
      expect(typeof strategy.markStarted).toBe('function');
      expect(typeof strategy.markCompleted).toBe('function');
      expect(typeof strategy.markFailed).toBe('function');
      expect(typeof strategy.isPending).toBe('function');
      expect(typeof strategy.isCompleted).toBe('function');
      expect(typeof strategy.isFailed).toBe('function');
    });

    it('should have artifact methods', () => {
      expect(typeof strategy.addArtifact).toBe('function');
      expect(typeof strategy.hasArtifact).toBe('function');
      expect(typeof strategy.removeArtifact).toBe('function');
    });

    it('should have child task methods', () => {
      expect(typeof strategy.createChildTask).toBe('function');
      expect(typeof strategy.addChild).toBe('function');
      expect(typeof strategy.hasMoreSubtasks).toBe('function');
      expect(typeof strategy.getPlannedSubtasks).toBe('function');
    });

    it('should have path methods', () => {
      expect(typeof strategy.getPath).toBe('function');
      expect(typeof strategy.getConversationHistory).toBe('function');
    });

    it('should initialize task with description', () => {
      strategy.initializeTask('Test task');
      
      expect(strategy.description).toBe('Test task');
      expect(strategy.id).toBeDefined();
      expect(strategy.status).toBe('pending');
      expect(strategy.children).toEqual([]);
      expect(strategy.artifacts).toBeInstanceOf(Set);
    });

    it('should handle messages', async () => {
      strategy.initializeTask('Test task');
      
      const message = {
        role: 'user',
        content: 'Test message'
      };

      const response = await strategy.receiveMessage(message);
      
      expect(response.role).toBe('assistant');
      expect(response.content).toBe('Task received message');
      expect(strategy.conversation.length).toBe(2); // Message + response
    });
  });

  describe('TaskStrategy with Custom Implementation', () => {
    it('should support custom strategy creation', async () => {
      // Create custom strategy prototype
      const CustomStrategy = Object.create(TaskStrategy);
      CustomStrategy.name = 'CustomStrategy';
      CustomStrategy.execute = async function(context) {
        return {
          status: 'completed',
          data: { 
            processed: true, 
            input: context.input 
          }
        };
      };

      // Create instance
      const strategy = Object.create(CustomStrategy);
      
      expect(strategy.name).toBe('CustomStrategy');
      
      const result = await strategy.execute({ input: 'test' });
      expect(result.data.processed).toBe(true);
      expect(result.data.input).toBe('test');
    });

    it('should inherit from base prototype', () => {
      const CustomStrategy = Object.create(TaskStrategy);
      CustomStrategy.customMethod = function() {
        return 'custom';
      };

      const strategy = Object.create(CustomStrategy);
      
      // Should have custom method
      expect(strategy.customMethod()).toBe('custom');
      
      // Should still have base methods
      expect(typeof strategy.execute).toBe('function');
      expect(typeof strategy.validate).toBe('function');
      expect(strategy.version).toBe('1.0.0');
    });
  });

  describe('createTask Factory with TaskStrategy', () => {
    it('should create task with strategy prototype', () => {
      const task = createTask(TaskStrategy, {
        id: 'test-task',
        input: { data: 'test' }
      });

      expect(task.id).toBe('test-task');
      expect(task.input).toEqual({ data: 'test' });
      expect(typeof task.execute).toBe('function');
    });

    it('should execute task with strategy', async () => {
      const task = createTask(TaskStrategy, {
        input: { value: 42 }
      });

      const context = {
        artifacts: new Map(),
        sendMessage: jest.fn()
      };

      const result = await task.execute(context);
      
      expect(result.status).toBe('completed');
      expect(result.data).toEqual({ value: 42 });
    });

    it('should support custom strategy in factory', async () => {
      const CustomStrategy = Object.create(TaskStrategy);
      CustomStrategy.execute = async function(context) {
        return {
          status: 'completed',
          data: {
            doubled: this.input.value * 2
          }
        };
      };

      const task = createTask(CustomStrategy, {
        input: { value: 10 }
      });

      const result = await task.execute({ 
        artifacts: new Map() 
      });
      
      expect(result.data.doubled).toBe(20);
    });
  });

  describe('Artifact Management', () => {
    let strategy;

    beforeEach(() => {
      strategy = Object.create(TaskStrategy);
      strategy.initializeTask('Test task');
    });

    it('should add artifacts', () => {
      const artifact = 'test-artifact';
      strategy.addArtifact(artifact);

      expect(strategy.hasArtifact(artifact)).toBe(true);
      expect(strategy.artifacts.has(artifact)).toBe(true);
    });

    it('should check artifact existence', () => {
      expect(strategy.hasArtifact('test')).toBe(false);
      
      strategy.addArtifact('test');
      
      expect(strategy.hasArtifact('test')).toBe(true);
    });

    it('should remove artifacts', () => {
      strategy.addArtifact('test');
      expect(strategy.artifacts.has('test')).toBe(true);
      
      strategy.removeArtifact('test');
      
      expect(strategy.artifacts.has('test')).toBe(false);
      expect(strategy.hasArtifact('test')).toBe(false);
    });
  });

  describe('Status Management', () => {
    let strategy;

    beforeEach(() => {
      strategy = Object.create(TaskStrategy);
      strategy.initializeTask('Test task');
    });

    it('should start pending', () => {
      expect(strategy.isPending()).toBe(true);
      expect(strategy.isCompleted()).toBe(false);
      expect(strategy.isFailed()).toBe(false);
    });

    it('should mark as started', () => {
      strategy.markStarted();
      
      expect(strategy.status).toBe('in-progress');
      expect(strategy.metadata.startedAt).toBeDefined();
      expect(strategy.isPending()).toBe(false);
    });

    it('should mark as completed', () => {
      const result = { data: 'success' };
      strategy.markCompleted(result);
      
      expect(strategy.status).toBe('completed');
      expect(strategy.result).toBe(result);
      expect(strategy.metadata.completedAt).toBeDefined();
      expect(strategy.isCompleted()).toBe(true);
    });

    it('should mark as failed', () => {
      const error = new Error('Test error');
      strategy.markFailed(error);
      
      expect(strategy.status).toBe('failed');
      expect(strategy.result).toBe(error);
      expect(strategy.metadata.completedAt).toBeDefined();
      expect(strategy.isFailed()).toBe(true);
    });
  });

  describe('Prototypal Chain', () => {
    it('should maintain proper prototype chain', () => {
      const CustomStrategy = Object.create(TaskStrategy);
      const strategy = Object.create(CustomStrategy);
      
      expect(Object.getPrototypeOf(strategy)).toBe(CustomStrategy);
      expect(Object.getPrototypeOf(CustomStrategy)).toBe(TaskStrategy);
      
      // Check prototype chain traversal
      expect(TaskStrategy.isPrototypeOf(strategy)).toBe(true);
      expect(CustomStrategy.isPrototypeOf(strategy)).toBe(true);
    });

    it('should allow prototype method overrides', async () => {
      const CustomStrategy = Object.create(TaskStrategy);
      CustomStrategy.validate = async function(input) {
        if (!input.required) {
          return {
            valid: false,
            errors: ['Missing required field']
          };
        }
        return { valid: true, errors: [] };
      };

      const strategy = Object.create(CustomStrategy);
      
      const result1 = await strategy.validate({ required: 'yes' });
      expect(result1.valid).toBe(true);
      
      const result2 = await strategy.validate({});
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('Missing required field');
    });
  });
});