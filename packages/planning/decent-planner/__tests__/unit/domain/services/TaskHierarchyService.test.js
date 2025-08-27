/**
 * Unit tests for TaskHierarchyService domain service
 * Pure domain logic tests with no external dependencies
 * Following Clean Architecture and TDD principles
 */

// Test functions are provided by the test runner as globals
import { TaskHierarchyService } from '../../../../src/domain/services/TaskHierarchyService.js';
import { Task } from '../../../../src/domain/entities/Task.js';
import { TaskComplexity } from '../../../../src/domain/value-objects/TaskComplexity.js';
import { TaskId } from '../../../../src/domain/value-objects/TaskId.js';

describe('TaskHierarchyService', () => {
  // Helper to create test hierarchy
  function createTestHierarchy() {
    const root = new Task({
      id: 'root',
      description: 'Root task',
      complexity: TaskComplexity.COMPLEX,
      depth: 0
    });
    
    const child1 = new Task({
      id: 'child1',
      description: 'Child 1',
      complexity: TaskComplexity.SIMPLE,
      depth: 1,
      feasible: true,
      tools: [{ name: 'tool1' }, { name: 'tool2' }]
    });
    
    const child2 = new Task({
      id: 'child2',
      description: 'Child 2',
      complexity: TaskComplexity.COMPLEX,
      depth: 1
    });
    
    const grandchild1 = new Task({
      id: 'grandchild1',
      description: 'Grandchild 1',
      complexity: TaskComplexity.SIMPLE,
      depth: 2,
      feasible: false
    });
    
    const grandchild2 = new Task({
      id: 'grandchild2',
      description: 'Grandchild 2',
      complexity: TaskComplexity.SIMPLE,
      depth: 2,
      feasible: true,
      tools: [{ name: 'tool3' }]
    });
    
    root.addSubtask(child1);
    root.addSubtask(child2);
    child2.addSubtask(grandchild1);
    child2.addSubtask(grandchild2);
    
    return { root, child1, child2, grandchild1, grandchild2 };
  }
  
  describe('traverse', () => {
    it('should traverse hierarchy depth-first', () => {
      const { root } = createTestHierarchy();
      const visited = [];
      
      TaskHierarchyService.traverse(root, (task) => {
        visited.push(task.id.toString());
      });
      
      expect(visited).toEqual(['root', 'child1', 'child2', 'grandchild1', 'grandchild2']);
    });
    
    it('should throw error for non-Task input', () => {
      expect(() => {
        TaskHierarchyService.traverse({ description: 'Not a task' }, () => {});
      }).toThrow('Root task must be a Task instance');
    });
  });
  
  describe('traverseAsync', () => {
    it('should traverse hierarchy asynchronously', async () => {
      const { root } = createTestHierarchy();
      const visited = [];
      
      await TaskHierarchyService.traverseAsync(root, async (task) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        visited.push(task.id.toString());
      });
      
      expect(visited).toEqual(['root', 'child1', 'child2', 'grandchild1', 'grandchild2']);
    });
  });
  
  describe('getTasksAtLevel', () => {
    it('should get all tasks at specific depth', () => {
      const { root } = createTestHierarchy();
      
      const level0 = TaskHierarchyService.getTasksAtLevel(root, 0);
      expect(level0.map(t => t.id.toString())).toEqual(['root']);
      
      const level1 = TaskHierarchyService.getTasksAtLevel(root, 1);
      expect(level1.map(t => t.id.toString())).toEqual(['child1', 'child2']);
      
      const level2 = TaskHierarchyService.getTasksAtLevel(root, 2);
      expect(level2.map(t => t.id.toString())).toEqual(['grandchild1', 'grandchild2']);
      
      const level3 = TaskHierarchyService.getTasksAtLevel(root, 3);
      expect(level3).toEqual([]);
    });
  });
  
  describe('getSimpleTasks', () => {
    it('should get all SIMPLE tasks', () => {
      const { root } = createTestHierarchy();
      
      const simpleTasks = TaskHierarchyService.getSimpleTasks(root);
      const ids = simpleTasks.map(t => t.id.toString());
      
      expect(ids).toEqual(['child1', 'grandchild1', 'grandchild2']);
    });
  });
  
  describe('getComplexTasks', () => {
    it('should get all COMPLEX tasks', () => {
      const { root } = createTestHierarchy();
      
      const complexTasks = TaskHierarchyService.getComplexTasks(root);
      const ids = complexTasks.map(t => t.id.toString());
      
      expect(ids).toEqual(['root', 'child2']);
    });
  });
  
  describe('calculateStatistics', () => {
    it('should calculate correct statistics', () => {
      const { root } = createTestHierarchy();
      
      const stats = TaskHierarchyService.calculateStatistics(root);
      
      expect(stats.totalTasks).toBe(5);
      expect(stats.simpleTasks).toBe(3);
      expect(stats.complexTasks).toBe(2);
      expect(stats.feasibleTasks).toBe(2);
      expect(stats.infeasibleTasks).toBe(1);
      expect(stats.maxDepth).toBe(2);
      expect(stats.averageSubtasks).toBe(2); // (2 + 2) / 2
      expect(stats.totalTools).toBe(3);
    });
    
    it('should handle single task', () => {
      const singleTask = new Task({
        description: 'Single',
        complexity: TaskComplexity.SIMPLE
      });
      
      const stats = TaskHierarchyService.calculateStatistics(singleTask);
      
      expect(stats.totalTasks).toBe(1);
      expect(stats.simpleTasks).toBe(1);
      expect(stats.complexTasks).toBe(0);
      expect(stats.averageSubtasks).toBe(0);
    });
  });
  
  describe('validateHierarchy', () => {
    it('should validate correct hierarchy', () => {
      const { root } = createTestHierarchy();
      
      const validation = TaskHierarchyService.validateHierarchy(root);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
      expect(validation.warnings).toEqual([]);
    });
    
    it('should detect SIMPLE task with subtasks', () => {
      const invalidTask = new Task({
        description: 'Invalid',
        complexity: TaskComplexity.SIMPLE
      });
      invalidTask.subtasks = [new Task({ description: 'Child' })]; // Force add
      
      const validation = TaskHierarchyService.validateHierarchy(invalidTask);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('SIMPLE task "Invalid" has subtasks');
    });
    
    it('should detect COMPLEX task without subtasks', () => {
      const complexTask = new Task({
        description: 'Complex without children',
        complexity: TaskComplexity.COMPLEX
      });
      
      const validation = TaskHierarchyService.validateHierarchy(complexTask);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('COMPLEX task "Complex without children" has no subtasks');
    });
    
    it('should detect COMPLEX task with tools', () => {
      const complexTask = new Task({
        description: 'Complex with tools',
        complexity: TaskComplexity.COMPLEX
      });
      complexTask.tools = [{ name: 'tool1' }]; // Force add
      
      const validation = TaskHierarchyService.validateHierarchy(complexTask);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('COMPLEX task "Complex with tools" has tools assigned');
    });
    
    it('should warn about deep nesting', () => {
      const deepTask = new Task({
        description: 'Deep task',
        depth: 11
      });
      
      const validation = TaskHierarchyService.validateHierarchy(deepTask);
      
      expect(validation.warnings).toContain('Task "Deep task" is at depth 11, which may be too deep');
    });
    
    it('should warn about too many subtasks', () => {
      const complexTask = new Task({
        description: 'Many children',
        complexity: TaskComplexity.COMPLEX
      });
      
      for (let i = 0; i < 12; i++) {
        complexTask.addSubtask(new Task({ description: `Child ${i}` }));
      }
      
      const validation = TaskHierarchyService.validateHierarchy(complexTask);
      
      expect(validation.warnings).toContain('Task "Many children" has 12 subtasks, which may be too many');
    });
  });
  
  describe('getBottomUpLevels', () => {
    it('should return levels in bottom-up order', () => {
      const { root } = createTestHierarchy();
      
      const levels = TaskHierarchyService.getBottomUpLevels(root);
      
      expect(levels).toEqual([2, 1, 0]);
    });
    
    it('should handle single level', () => {
      const singleTask = new Task({ description: 'Single' });
      
      const levels = TaskHierarchyService.getBottomUpLevels(singleTask);
      
      expect(levels).toEqual([0]);
    });
  });
  
  describe('findTaskById', () => {
    it('should find task by ID', () => {
      const { root, grandchild1 } = createTestHierarchy();
      
      const found = TaskHierarchyService.findTaskById(root, new TaskId('grandchild1'));
      
      expect(found).toBe(grandchild1);
    });
    
    it('should return null if task not found', () => {
      const { root } = createTestHierarchy();
      
      const found = TaskHierarchyService.findTaskById(root, new TaskId('nonexistent'));
      
      expect(found).toBeNull();
    });
  });
  
  describe('findParentTask', () => {
    it('should find parent of a task', () => {
      const { root, child2, grandchild1 } = createTestHierarchy();
      
      const parent = TaskHierarchyService.findParentTask(root, grandchild1);
      
      expect(parent).toBe(child2);
    });
    
    it('should return null for root task', () => {
      const { root } = createTestHierarchy();
      
      const parent = TaskHierarchyService.findParentTask(root, root);
      
      expect(parent).toBeNull();
    });
  });
  
  describe('cloneHierarchy', () => {
    it('should create deep clone of hierarchy', () => {
      const { root } = createTestHierarchy();
      
      const clone = TaskHierarchyService.cloneHierarchy(root);
      
      expect(clone).not.toBe(root);
      expect(clone.id.toString()).toBe('root');
      expect(clone.getSubtaskCount()).toBe(2);
      
      // Verify deep clone
      clone.description = 'Modified';
      expect(root.description).toBe('Root task');
    });
  });
});