/**
 * E2E tests for Class Modification Workflow
 * Tests class evolution: generation -> modification -> refactoring
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { BehaviorTreeExecutor } from '../../src/core/BehaviorTreeExecutor.js';
import { BehaviorTreeTool } from '../../src/integration/BehaviorTreeTool.js';
import { NodeStatus } from '../../src/core/BehaviorTreeNode.js';
import { RealDevTools } from '../../tools/dev-tools.js';
import { ClassModificationTools } from '../../tools/class-modification-tools.js';
import fs from 'fs/promises';
import path from 'path';

// Mock ToolRegistry
class MockToolRegistry {
  constructor() {
    this.tools = new Map();
    this.providers = new Map();
  }

  async getTool(toolName) {
    return this.tools.get(toolName);
  }

  registerTool(name, tool) {
    this.tools.set(name, tool);
  }

  async registerProvider(provider) {
    this.providers.set(provider.name, provider);
  }
}

describe('Class Modification Workflow E2E Tests', () => {
  let toolRegistry;
  let executor;
  let devTools;
  let modificationTools;
  const testWorkingDir = './test-class-modifications';

  beforeEach(async () => {
    toolRegistry = new MockToolRegistry();
    executor = new BehaviorTreeExecutor(toolRegistry);
    devTools = new RealDevTools(testWorkingDir);
    modificationTools = new ClassModificationTools(testWorkingDir);

    // Register generation tools
    toolRegistry.registerTool('classGenerator', devTools.createClassGenerator());
    toolRegistry.registerTool('testGenerator', devTools.createTestGenerator());
    toolRegistry.registerTool('successValidator', devTools.createSuccessValidator());

    // Register modification tools
    toolRegistry.registerTool('methodModifier', modificationTools.createMethodModifier());
    toolRegistry.registerTool('testModifier', modificationTools.createTestModifier());
    toolRegistry.registerTool('classRefactor', modificationTools.createClassRefactor());
    toolRegistry.registerTool('stateInspector', modificationTools.createStateInspector());

    // Ensure clean test environment
    try {
      await fs.rm(testWorkingDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  afterEach(async () => {
    // Cleanup after tests
    try {
      await fs.rm(testWorkingDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    
    // Clear modification state
    modificationTools.clearAllStates();
  });

  describe('Method Modification', () => {
    test('should modify existing method implementation', async () => {
      // First generate a class
      const generateWorkflow = {
        type: 'sequence',
        children: [
          {
            id: 'generate-class',
            type: 'action',
            tool: 'classGenerator',
            params: {
              className: 'ShoppingCart',
              description: 'Shopping cart management',
              methods: ['addItem', 'removeItem', 'getTotal']
            }
          },
          {
            id: 'generate-tests',
            type: 'action',
            tool: 'testGenerator',
            params: {
              className: 'ShoppingCart',
              methods: ['addItem', 'removeItem', 'getTotal']
            }
          }
        ]
      };

      const generateResult = await executor.executeTree(generateWorkflow, {});
      expect(generateResult.success).toBe(true);

      // Now modify the addItem method
      const modifyWorkflow = {
        type: 'sequence',
        children: [
          {
            id: 'inspect-before',
            type: 'action',
            tool: 'stateInspector',
            params: {
              className: 'ShoppingCart'
            }
          },
          {
            id: 'modify-method',
            type: 'action',
            tool: 'methodModifier',
            params: {
              className: 'ShoppingCart',
              methodName: 'addItem',
              newImplementation: `    // Enhanced addItem with quantity and validation
    if (!data || !data.name || !data.price) {
      throw new Error('Item must have name and price');
    }
    
    const quantity = data.quantity || 1;
    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
    
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const item = { 
      id, 
      ...data, 
      quantity,
      subtotal: data.price * quantity,
      addedAt: new Date().toISOString() 
    };
    
    this.data.set(id, item);
    console.log(\`Added \${quantity}x \${data.name} to cart\`);
    return item;`,
              description: 'Enhanced addItem with quantity support and validation'
            }
          },
          {
            id: 'update-tests',
            type: 'action',
            tool: 'testModifier',
            params: {
              className: 'ShoppingCart',
              methodName: 'addItem'
            }
          },
          {
            id: 'inspect-after',
            type: 'action',
            tool: 'stateInspector',
            params: {
              className: 'ShoppingCart'
            }
          }
        ]
      };

      const modifyResult = await executor.executeTree(modifyWorkflow, {});
      expect(modifyResult.success).toBe(true);

      // Verify the modification
      const classFile = path.join(testWorkingDir, 'src', 'ShoppingCart.js');
      const modifiedCode = await fs.readFile(classFile, 'utf-8');
      
      expect(modifiedCode).toContain('Enhanced addItem with quantity and validation');
      expect(modifiedCode).toContain('Quantity must be positive');
      expect(modifiedCode).toContain('subtotal: data.price * quantity');

      // Check that state was tracked
      const stateData = modifyResult.context['inspect-after'].data;
      expect(stateData.modifications).toHaveLength(1);
      expect(stateData.modifications[0].type).toBe('modified');
      expect(stateData.modifications[0].methodName).toBe('addItem');
    });

    test('should add new method to existing class', async () => {
      // Generate initial class with fewer methods
      const generateWorkflow = {
        type: 'action',
        tool: 'classGenerator',
        params: {
          className: 'Calculator',
          methods: ['add', 'subtract']
        }
      };

      await executor.executeTree(generateWorkflow, {});

      // Add new method
      const addMethodResult = await executor.executeTree({
        type: 'action',
        tool: 'methodModifier',
        params: {
          className: 'Calculator',
          methodName: 'multiply',
          newImplementation: `    // Multiply two numbers
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new Error('Both parameters must be numbers');
    }
    return a * b;`,
          description: 'Added multiplication method'
        }
      }, {});

      expect(addMethodResult.success).toBe(true);
      
      const classFile = path.join(testWorkingDir, 'src', 'Calculator.js');
      const modifiedCode = await fs.readFile(classFile, 'utf-8');
      
      expect(modifiedCode).toContain('multiply(');
      expect(modifiedCode).toContain('Multiply two numbers');
      expect(modifiedCode).toContain('Both parameters must be numbers');
    });
  });

  describe('Class Refactoring', () => {
    test('should refactor class with multiple changes', async () => {
      // Generate initial class
      await executor.executeTree({
        type: 'action',
        tool: 'classGenerator',
        params: {
          className: 'UserManager',
          methods: ['createUser', 'deleteUser', 'findUser']
        }
      }, {});

      // Apply refactoring
      const refactorResult = await executor.executeTree({
        type: 'action',
        tool: 'classRefactor',
        params: {
          className: 'UserManager',
          changes: [
            { type: 'rename-method', oldName: 'createUser', newName: 'registerUser' },
            { type: 'rename-method', oldName: 'deleteUser', newName: 'removeUser' },
            { type: 'add-property', propertyName: 'maxUsers', defaultValue: '1000' },
            { type: 'add-property', propertyName: 'created', defaultValue: 'new Date().toISOString()' }
          ],
          description: 'Refactored UserManager with better naming and limits'
        }
      }, {});

      expect(refactorResult.success).toBe(true);
      
      const classFile = path.join(testWorkingDir, 'src', 'UserManager.js');
      const refactoredCode = await fs.readFile(classFile, 'utf-8');
      
      expect(refactoredCode).toContain('registerUser(');
      expect(refactoredCode).toContain('removeUser(');
      expect(refactoredCode).not.toContain('createUser(');
      expect(refactoredCode).not.toContain('deleteUser(');
      expect(refactoredCode).toContain('this.maxUsers = 1000');
      expect(refactoredCode).toContain('this.created = new Date().toISOString()');

      // Check refactoring was tracked
      expect(refactorResult.data.appliedChanges).toHaveLength(4);
      expect(refactorResult.data.appliedChanges[0]).toContain('Renamed method createUser to registerUser');
    });
  });

  describe('State Management and Inspection', () => {
    test('should track class state across modifications', async () => {
      // Generate class
      await executor.executeTree({
        type: 'action',
        tool: 'classGenerator',
        params: {
          className: 'BlogPost',
          methods: ['publish', 'unpublish']
        }
      }, {});

      // Initial state inspection
      const initialState = await executor.executeTree({
        type: 'action',
        tool: 'stateInspector',
        params: { className: 'BlogPost' }
      }, {});

      expect(initialState.success).toBe(true);
      expect(initialState.data.exists).toBe(true);
      expect(initialState.data.methods).toHaveLength(2);
      expect(initialState.data.modifications).toHaveLength(0);

      // Add method
      await executor.executeTree({
        type: 'action',
        tool: 'methodModifier',
        params: {
          className: 'BlogPost',
          methodName: 'updateContent',
          description: 'Added content update method'
        }
      }, {});

      // Refactor
      await executor.executeTree({
        type: 'action',
        tool: 'classRefactor',
        params: {
          className: 'BlogPost',
          changes: [{ type: 'add-property', propertyName: 'status', defaultValue: "'draft'" }],
          description: 'Added status property'
        }
      }, {});

      // Final state inspection
      const finalState = await executor.executeTree({
        type: 'action',
        tool: 'stateInspector',
        params: { className: 'BlogPost' }
      }, {});

      expect(finalState.success).toBe(true);
      expect(finalState.data.methods).toHaveLength(3); // publish, unpublish, updateContent
      expect(finalState.data.modifications).toHaveLength(2); // method add + refactor
      expect(finalState.data.modifications[0].type).toBe('added');
      expect(finalState.data.modifications[1].type).toBe('refactored');
    });

    test('should handle non-existent class gracefully', async () => {
      const result = await executor.executeTree({
        type: 'action',
        tool: 'methodModifier',
        params: {
          className: 'NonExistentClass',
          methodName: 'someMethod'
        }
      }, {});

      expect(result.success).toBe(false);
      expect(result.data.error).toContain('NonExistentClass does not exist');
    });
  });

  describe('Complex Modification Workflows', () => {
    test('should handle sequential modifications', async () => {
      // Multi-step workflow: generate -> modify -> refactor -> modify again
      const complexWorkflow = {
        type: 'sequence',
        children: [
          // 1. Generate initial class
          {
            id: 'generate',
            type: 'action',
            tool: 'classGenerator',
            params: {
              className: 'TaskManager',
              methods: ['addTask', 'completeTask']
            }
          },
          // 2. Add new method
          {
            id: 'add-method',
            type: 'action',
            tool: 'methodModifier',
            params: {
              className: 'TaskManager',
              methodName: 'prioritizeTask',
              newImplementation: `    // Set task priority
    if (!id || typeof priority !== 'number') {
      throw new Error('ID and numeric priority required');
    }
    const task = this.data.get(id);
    if (!task) throw new Error('Task not found');
    task.priority = priority;
    task.updatedAt = new Date().toISOString();
    return task;`,
              description: 'Added task prioritization'
            }
          },
          // 3. Refactor to add properties
          {
            id: 'refactor',
            type: 'action',
            tool: 'classRefactor',
            params: {
              className: 'TaskManager',
              changes: [
                { type: 'add-property', propertyName: 'maxTasks', defaultValue: '100' },
                { type: 'add-property', propertyName: 'defaultPriority', defaultValue: '1' }
              ],
              description: 'Added task limits and defaults'
            }
          },
          // 4. Modify existing method to use new properties
          {
            id: 'enhance-add-task',
            type: 'action',
            tool: 'methodModifier',
            params: {
              className: 'TaskManager',
              methodName: 'addTask',
              newImplementation: `    // Enhanced addTask with limits and defaults
    if (this.data.size >= this.maxTasks) {
      throw new Error(\`Cannot exceed \${this.maxTasks} tasks\`);
    }
    
    if (!data) throw new Error('Task data required');
    
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const task = {
      id,
      ...data,
      priority: data.priority || this.defaultPriority,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    this.data.set(id, task);
    console.log(\`Added task: \${task.title || 'Untitled'} (Priority: \${task.priority})\`);
    return task;`,
              description: 'Enhanced addTask to use limits and defaults'
            }
          },
          // 5. Final state inspection
          {
            id: 'final-state',
            type: 'action',
            tool: 'stateInspector',
            params: {
              className: 'TaskManager'
            }
          }
        ]
      };

      const result = await executor.executeTree(complexWorkflow, {});
      expect(result.success).toBe(true);

      // Verify final state
      const finalState = result.context['final-state'].data;
      expect(finalState.methods).toHaveLength(3); // addTask, completeTask, prioritizeTask
      expect(finalState.modifications).toHaveLength(4); // add method, refactor, modify method, enhance method

      // Verify code contains all enhancements
      const classFile = path.join(testWorkingDir, 'src', 'TaskManager.js');
      const finalCode = await fs.readFile(classFile, 'utf-8');
      
      expect(finalCode).toContain('this.maxTasks = 100');
      expect(finalCode).toContain('this.defaultPriority = 1');
      expect(finalCode).toContain('prioritizeTask(');
      expect(finalCode).toContain('Cannot exceed');
      expect(finalCode).toContain('Priority: ${task.priority}');
    });
  });

  describe('Integration with BehaviorTreeTool', () => {
    test('should work as a reusable BT tool', async () => {
      // Load the ClassEvolutionWorkflow config and test it
      const configPath = './configs/ClassEvolutionWorkflow.json';
      
      let configExists = false;
      try {
        await fs.access(configPath);
        configExists = true;
      } catch {
        // Config file doesn't exist, skip this test
      }

      if (configExists) {
        const configJson = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configJson);

        const btTool = new BehaviorTreeTool(config, toolRegistry);

        // Test generate mode
        const generateResult = await btTool.execute({
          className: 'EventManager',
          mode: 'generate',
          initialMethods: ['createEvent', 'cancelEvent'],
          description: 'Event management system'
        });

        expect(generateResult.success).toBe(true);

        // Test inspect mode
        const inspectResult = await btTool.execute({
          className: 'EventManager',
          mode: 'inspect'
        });

        expect(inspectResult.success).toBe(true);
        expect(inspectResult.data.context.exists).toBe(true);
      }
    });
  });
});