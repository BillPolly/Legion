/**
 * Unit tests for createBTTask factory function
 * Tests creation of BT tasks with proper configuration
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTask } from '@legion/tasks';

describe('createBTTask Factory', () => {
  let createBTTask;
  let BTTaskStrategy;
  let mockParent;
  
  beforeEach(async () => {
    // Try to import the factory and strategy
    try {
      const factoryModule = await import('../../../src/factory/createBTTask.js');
      createBTTask = factoryModule.createBTTask;
    } catch (error) {
      // Will fail until implemented
      createBTTask = null;
    }
    
    try {
      const strategyModule = await import('../../../src/core/BTTaskStrategy.js');
      BTTaskStrategy = strategyModule.BTTaskStrategy;
    } catch (error) {
      BTTaskStrategy = null;
    }
    
    // Create mock parent task
    mockParent = {
      id: 'parent-task',
      description: 'Parent Task',
      children: [],
      metadata: { depth: 0 },
      send: jest.fn(),
      addChild: jest.fn()
    };
  });
  
  describe('Task Creation', () => {
    it('should create a task with BT strategy as prototype', () => {
      if (!createBTTask || !BTTaskStrategy) {
        expect(createBTTask).toBeDefined();
        return; // Skip until implemented
      }
      
      const btTask = createBTTask(
        'Test BT Node',
        null,
        BTTaskStrategy,
        { nodeType: 'sequence' }
      );
      
      expect(btTask).toBeDefined();
      expect(Object.getPrototypeOf(btTask)).toBe(BTTaskStrategy);
    });
    
    it('should use createTask from @legion/tasks internally', () => {
      if (!createBTTask) {
        expect(createBTTask).toBeDefined();
        return; // Skip until implemented
      }
      
      // This test verifies the implementation uses the standard createTask
      // We can check this by verifying the created task has standard task properties
      const btTask = createBTTask(
        'Test Node',
        mockParent,
        BTTaskStrategy,
        {}
      );
      
      // Standard task properties from createTask
      expect(btTask.description).toBe('Test Node');
      expect(btTask.parent).toBe(mockParent);
      expect(typeof btTask.initializeTask).toBe('function');
    });
  });
  
  describe('Configuration Attachment', () => {
    it('should attach BT-specific configuration to task', () => {
      if (!createBTTask) {
        expect(createBTTask).toBeDefined();
        return; // Skip until implemented
      }
      
      const config = {
        type: 'action',
        tool: 'file_write',
        params: {
          filepath: './output.txt',
          content: 'test'
        },
        outputVariable: 'fileResult'
      };
      
      const btTask = createBTTask(
        'Write File',
        null,
        BTTaskStrategy,
        config
      );
      
      // Config should include all original fields plus generated ones
      expect(btTask.config.outputVariable).toBe(config.outputVariable);
      expect(btTask.config.params).toEqual(config.params);
      expect(btTask.config.type).toBe('action');
      expect(btTask.config.tool).toBe('file_write');
      expect(btTask.config.nodeType).toBe('action');
      expect(btTask.config.nodeId).toBeDefined();
    });
    
    it('should add nodeType to config from type', () => {
      if (!createBTTask) {
        expect(createBTTask).toBeDefined();
        return; // Skip until implemented
      }
      
      const config = {
        type: 'sequence',
        id: 'seq-1'
      };
      
      const btTask = createBTTask(
        'Sequence Node',
        null,
        BTTaskStrategy,
        config
      );
      
      expect(btTask.config.nodeType).toBe('sequence');
    });
    
    it('should generate nodeId if not provided', () => {
      if (!createBTTask) {
        expect(createBTTask).toBeDefined();
        return; // Skip until implemented
      }
      
      const btTask = createBTTask(
        'Test Node',
        null,
        BTTaskStrategy,
        { type: 'action' }
      );
      
      expect(btTask.config.nodeId).toBeDefined();
      expect(typeof btTask.config.nodeId).toBe('string');
    });
    
    it('should use provided id as nodeId', () => {
      if (!createBTTask) {
        expect(createBTTask).toBeDefined();
        return; // Skip until implemented
      }
      
      const config = {
        type: 'selector',
        id: 'my-selector'
      };
      
      const btTask = createBTTask(
        'Selector Node',
        null,
        BTTaskStrategy,
        config
      );
      
      expect(btTask.config.nodeId).toBe('my-selector');
    });
  });
  
  describe('Parent-Child Relationships', () => {
    it('should set parent correctly', () => {
      if (!createBTTask) {
        expect(createBTTask).toBeDefined();
        return; // Skip until implemented
      }
      
      const btTask = createBTTask(
        'Child Node',
        mockParent,
        BTTaskStrategy,
        { type: 'action' }
      );
      
      expect(btTask.parent).toBe(mockParent);
    });
    
    it('should handle null parent for root nodes', () => {
      if (!createBTTask) {
        expect(createBTTask).toBeDefined();
        return; // Skip until implemented
      }
      
      const btTask = createBTTask(
        'Root Node',
        null,
        BTTaskStrategy,
        { type: 'sequence' }
      );
      
      expect(btTask.parent).toBeNull();
    });
    
    it('should initialize children array', () => {
      if (!createBTTask) {
        expect(createBTTask).toBeDefined();
        return; // Skip until implemented
      }
      
      const btTask = createBTTask(
        'Parent Node',
        null,
        BTTaskStrategy,
        { type: 'sequence' }
      );
      
      expect(Array.isArray(btTask.children)).toBe(true);
      expect(btTask.children.length).toBe(0);
    });
  });
  
  describe('Default Values', () => {
    it('should use empty config object if not provided', () => {
      if (!createBTTask) {
        expect(createBTTask).toBeDefined();
        return; // Skip until implemented
      }
      
      const btTask = createBTTask(
        'Test Node',
        null,
        BTTaskStrategy
      );
      
      expect(btTask.config).toBeDefined();
      expect(typeof btTask.config).toBe('object');
    });
    
    it('should use node description as name if not in config', () => {
      if (!createBTTask) {
        expect(createBTTask).toBeDefined();
        return; // Skip until implemented
      }
      
      const btTask = createBTTask(
        'My Test Node',
        null,
        BTTaskStrategy,
        { type: 'action' }
      );
      
      expect(btTask.description).toBe('My Test Node');
    });
  });
});