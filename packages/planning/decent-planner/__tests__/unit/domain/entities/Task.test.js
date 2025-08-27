/**
 * Unit tests for Task entity
 * Pure domain logic tests with no external dependencies
 * Following Clean Architecture and TDD principles
 */

// Test functions are provided by the test runner as globals
import { Task } from '../../../../src/domain/entities/Task.js';
import { TaskComplexity } from '../../../../src/domain/value-objects/TaskComplexity.js';
import { TaskStatus } from '../../../../src/domain/value-objects/TaskStatus.js';
import { TaskId } from '../../../../src/domain/value-objects/TaskId.js';

describe('Task Entity', () => {
  describe('creation', () => {
    it('should create a task with required fields', () => {
      const task = new Task({
        id: 'test-id',
        description: 'Test task'
      });
      
      expect(task.description).toBe('Test task');
      expect(task.id).toBeDefined();
      expect(task.status.isPending()).toBe(true);
    });
    
    it('should throw error for empty description', () => {
      expect(() => new Task({ id: 'test', description: '' })).toThrow('Task description is required');
      expect(() => new Task({ id: 'test', description: '   ' })).toThrow('Task description is required');
      expect(() => new Task({ id: 'test', description: null })).toThrow('Task description is required');
    });
    
    it('should accept all valid properties', () => {
      const task = new Task({
        id: 'task-123',
        description: 'Complex task',
        complexity: 'COMPLEX',
        status: 'IN_PROGRESS',
        parentId: 'parent-456',
        inputs: ['input1', 'input2'],
        outputs: ['output1'],
        depth: 2
      });
      
      expect(task.id.toString()).toBe('task-123');
      expect(task.complexity.isComplex()).toBe(true);
      expect(task.status.isInProgress()).toBe(true);
      expect(task.parentId.toString()).toBe('parent-456');
      expect(task.inputs).toEqual(['input1', 'input2']);
      expect(task.outputs).toEqual(['output1']);
      expect(task.depth).toBe(2);
    });
  });
  
  describe('complexity rules', () => {
    it('should not allow adding subtasks to SIMPLE tasks', () => {
      const simpleTask = new Task({
        description: 'Simple task',
        complexity: TaskComplexity.SIMPLE
      });
      
      const subtask = new Task({ id: 'subtask-1', description: 'Subtask' });
      
      expect(() => simpleTask.addSubtask(subtask)).toThrow('Cannot add subtasks to a SIMPLE task');
    });
    
    it('should allow adding subtasks to COMPLEX tasks', () => {
      const complexTask = new Task({
        description: 'Complex task',
        complexity: TaskComplexity.COMPLEX
      });
      
      const subtask = new Task({ id: 'subtask-1', description: 'Subtask' });
      complexTask.addSubtask(subtask);
      
      expect(complexTask.hasSubtasks()).toBe(true);
      expect(complexTask.getSubtaskCount()).toBe(1);
    });
    
    it('should not allow adding tools to COMPLEX tasks', () => {
      const complexTask = new Task({
        description: 'Complex task',
        complexity: TaskComplexity.COMPLEX
      });
      
      expect(() => complexTask.addTool({ name: 'tool1' })).toThrow('Tools can only be added to SIMPLE tasks');
    });
    
    it('should allow adding tools to SIMPLE tasks', () => {
      const simpleTask = new Task({
        description: 'Simple task',
        complexity: TaskComplexity.SIMPLE
      });
      
      simpleTask.addTool({ name: 'tool1', confidence: 0.9 });
      
      expect(simpleTask.hasTools()).toBe(true);
      expect(simpleTask.getToolCount()).toBe(1);
    });
  });
  
  describe('feasibility', () => {
    it('should set feasibility with reasoning', () => {
      const task = new Task({ id: 'test-1', description: 'Test task' });
      
      task.setFeasibility(true, 'Tools available');
      
      expect(task.feasible).toBe(true);
      expect(task.reasoning).toBe('Tools available');
    });
    
    it('should set feasibility without reasoning', () => {
      const task = new Task({ id: 'test-2', description: 'Test task' });
      
      task.setFeasibility(false);
      
      expect(task.feasible).toBe(false);
      expect(task.reasoning).toBeNull();
    });
  });
  
  describe('status management', () => {
    it('should update status with TaskStatus instance', () => {
      const task = new Task({ id: 'test-3', description: 'Test task' });
      
      task.updateStatus(TaskStatus.inProgress());
      expect(task.isInProgress()).toBe(true);
      
      task.updateStatus(TaskStatus.completed());
      expect(task.isCompleted()).toBe(true);
    });
    
    it('should update status with string', () => {
      const task = new Task({ id: 'test-4', description: 'Test task' });
      
      task.updateStatus('FAILED');
      
      expect(task.isFailed()).toBe(true);
    });
  });
  
  describe('subtask validation', () => {
    it('should only accept Task instances as subtasks', () => {
      const complexTask = new Task({
        description: 'Complex task',
        complexity: TaskComplexity.COMPLEX
      });
      
      expect(() => complexTask.addSubtask({ description: 'Not a task' }))
        .toThrow('Subtask must be a Task instance');
    });
    
    it('should properly track subtask count', () => {
      const complexTask = new Task({
        description: 'Complex task',
        complexity: TaskComplexity.COMPLEX
      });
      
      expect(complexTask.hasSubtasks()).toBe(false);
      expect(complexTask.getSubtaskCount()).toBe(0);
      
      complexTask.addSubtask(new Task({ id: 'sub-1', description: 'Subtask 1' }));
      complexTask.addSubtask(new Task({ id: 'sub-2', description: 'Subtask 2' }));
      
      expect(complexTask.hasSubtasks()).toBe(true);
      expect(complexTask.getSubtaskCount()).toBe(2);
    });
  });
  
  describe('serialization', () => {
    it('should convert to JSON', () => {
      const task = new Task({
        id: 'task-123',
        description: 'Test task',
        complexity: TaskComplexity.SIMPLE,
        status: TaskStatus.PENDING
      });
      
      const json = task.toJSON();
      
      expect(json.id).toBe('task-123');
      expect(json.description).toBe('Test task');
      expect(json.complexity).toBe('SIMPLE');
      expect(json.status).toBe('PENDING');
    });
    
    it('should serialize subtasks recursively', () => {
      const rootTask = new Task({
        description: 'Root task',
        complexity: TaskComplexity.COMPLEX
      });
      
      const subtask = new Task({
        id: 'subtask-id',
        description: 'Subtask',
        complexity: TaskComplexity.SIMPLE
      });
      
      rootTask.addSubtask(subtask);
      
      const json = rootTask.toJSON();
      
      expect(json.subtasks).toHaveLength(1);
      expect(json.subtasks[0].description).toBe('Subtask');
    });
    
    it('should restore from JSON', () => {
      const json = {
        id: 'task-456',
        description: 'Restored task',
        complexity: 'COMPLEX',
        status: 'IN_PROGRESS',
        subtasks: [
          { id: 'sub-1', description: 'Subtask 1', complexity: 'SIMPLE' }
        ]
      };
      
      const task = Task.fromJSON(json);
      
      expect(task.id.toString()).toBe('task-456');
      expect(task.description).toBe('Restored task');
      expect(task.isComplex()).toBe(true);
      expect(task.isInProgress()).toBe(true);
      expect(task.getSubtaskCount()).toBe(1);
    });
  });
  
  describe('helper methods', () => {
    it('should correctly identify simple tasks', () => {
      const simpleTask = new Task({
        description: 'Simple',
        complexity: TaskComplexity.SIMPLE
      });
      
      expect(simpleTask.isSimple()).toBe(true);
      expect(simpleTask.isComplex()).toBe(false);
    });
    
    it('should correctly identify complex tasks', () => {
      const complexTask = new Task({
        description: 'Complex',
        complexity: TaskComplexity.COMPLEX
      });
      
      expect(complexTask.isComplex()).toBe(true);
      expect(complexTask.isSimple()).toBe(false);
    });
    
    it('should correctly identify status states', () => {
      const task = new Task({ id: 'test-status', description: 'Test' });
      
      expect(task.isPending()).toBe(true);
      expect(task.isInProgress()).toBe(false);
      expect(task.isCompleted()).toBe(false);
      expect(task.isFailed()).toBe(false);
      
      task.updateStatus('COMPLETED');
      expect(task.isCompleted()).toBe(true);
      expect(task.isPending()).toBe(false);
    });
  });
});