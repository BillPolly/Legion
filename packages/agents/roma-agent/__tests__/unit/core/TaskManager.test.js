/**
 * Unit tests for TaskManager class
 */

import { jest } from '@jest/globals';
import TaskManager from '../../../src/core/TaskManager.js';
import Task from '../../../src/core/Task.js';

describe('TaskManager', () => {
  let taskManager;
  
  beforeEach(() => {
    taskManager = new TaskManager();
  });
  
  describe('task creation and management', () => {
    it('should create root task', () => {
      const root = taskManager.createRootTask('Root task');
      
      expect(root).toBeInstanceOf(Task);
      expect(root.description).toBe('Root task');
      expect(root.parent).toBeNull();
      expect(root.status).toBe('in-progress');
      expect(taskManager.rootTask).toBe(root);
      expect(taskManager.currentTask).toBe(root);
    });
    
    it('should create subtask of current task', () => {
      const root = taskManager.createRootTask('Root task');
      const subtask = taskManager.createSubtask('Subtask 1');
      
      expect(subtask).toBeInstanceOf(Task);
      expect(subtask.parent).toBe(root);
      expect(subtask.description).toBe('Subtask 1');
      expect(root.children).toContain(subtask);
    });
    
    it('should create subtask with inherited artifacts', () => {
      taskManager.createRootTask('Root task');
      const subtask = taskManager.createSubtask('Subtask 1', ['artifact1', 'artifact2']);
      
      expect(subtask.getArtifacts()).toEqual(['artifact1', 'artifact2']);
    });
    
    it('should throw error when creating subtask without current task', () => {
      expect(() => {
        taskManager.createSubtask('Subtask');
      }).toThrow('No current task to create subtask for');
    });
    
    it('should switch to different task', () => {
      const root = taskManager.createRootTask('Root task');
      const subtask = taskManager.createSubtask('Subtask 1');
      
      taskManager.switchToTask(subtask);
      
      expect(taskManager.currentTask).toBe(subtask);
      expect(subtask.status).toBe('in-progress');
    });
    
    it('should throw error when switching to unknown task', () => {
      const fakeTask = new Task('Fake task');
      
      expect(() => {
        taskManager.switchToTask(fakeTask);
      }).toThrow(`Task ${fakeTask.id} not found in task manager`);
    });
    
    it('should get task by ID', () => {
      const root = taskManager.createRootTask('Root task');
      const subtask = taskManager.createSubtask('Subtask 1');
      
      expect(taskManager.getTask(root.id)).toBe(root);
      expect(taskManager.getTask(subtask.id)).toBe(subtask);
      expect(taskManager.getTask('unknown')).toBeUndefined();
    });
  });
  
  describe('task completion checking', () => {
    it('should check completion without LLM using heuristics', async () => {
      const root = taskManager.createRootTask('Root task');
      root.addPrompt('Test prompt');
      root.addResponse('Test response');
      root.addToolResult('test_tool', {}, { success: true });
      
      const result = await taskManager.checkTaskCompletion();
      
      expect(result.complete).toBe(true);
      expect(result.reason).toBe('No LLM available for completion check');
    });
    
    it('should not mark task complete if has incomplete children', async () => {
      const root = taskManager.createRootTask('Root task');
      const subtask = taskManager.createSubtask('Subtask');
      
      taskManager.switchToTask(root);
      
      const result = await taskManager.checkTaskCompletion();
      
      expect(result.complete).toBe(false);
      expect(result.reason).toBe('Has incomplete subtasks');
    });
    
    it('should check completion with LLM', async () => {
      const mockLLM = {
        complete: jest.fn().mockResolvedValue(JSON.stringify({
          complete: true,
          reason: 'Task successfully completed',
          result: { data: 'test' }
        }))
      };
      
      taskManager = new TaskManager(mockLLM);
      taskManager.createRootTask('Test task');
      
      const result = await taskManager.checkTaskCompletion();
      
      expect(result.complete).toBe(true);
      expect(result.reason).toBe('Task successfully completed');
      expect(result.result).toEqual({ data: 'test' });
      expect(mockLLM.complete).toHaveBeenCalled();
    });
    
    it('should handle LLM error gracefully', async () => {
      const mockLLM = {
        complete: jest.fn().mockRejectedValue(new Error('LLM error'))
      };
      
      taskManager = new TaskManager(mockLLM);
      taskManager.createRootTask('Test task');
      
      const result = await taskManager.checkTaskCompletion();
      
      expect(result.complete).toBe(false);
      expect(result.reason).toBe('Error: LLM error');
    });
  });
  
  describe('task completion and parent return', () => {
    it('should complete current task and return to parent', async () => {
      const root = taskManager.createRootTask('Root task');
      const subtask = taskManager.createSubtask('Subtask');
      
      taskManager.switchToTask(subtask);
      
      const result = await taskManager.completeCurrentTask({ success: true });
      
      expect(subtask.status).toBe('completed');
      expect(subtask.result).toEqual({ success: true });
      expect(taskManager.currentTask).toBe(root);
      expect(result.returnedToParent).toBe(true);
      expect(result.parentTask).toBe(root);
    });
    
    it('should complete root task', async () => {
      taskManager.createRootTask('Root task');
      
      const result = await taskManager.completeCurrentTask({ success: true });
      
      expect(taskManager.rootTask.status).toBe('completed');
      expect(taskManager.currentTask).toBeNull();
      expect(result.returnedToParent).toBe(false);
      expect(result.rootCompleted).toBe(true);
    });
    
    it('should pass selected artifacts to parent', async () => {
      const mockLLM = {
        complete: jest.fn().mockResolvedValue(JSON.stringify({
          selectedArtifacts: ['artifact1'],
          reason: 'Relevant to parent'
        }))
      };
      
      taskManager = new TaskManager(mockLLM);
      const root = taskManager.createRootTask('Root task');
      const subtask = taskManager.createSubtask('Subtask');
      
      subtask.addArtifact('artifact1');
      subtask.addArtifact('artifact2');
      
      taskManager.switchToTask(subtask);
      const result = await taskManager.completeCurrentTask();
      
      expect(result.artifactsReturned).toEqual(['artifact1']);
      expect(root.getArtifacts()).toEqual(['artifact1']);
    });
  });
  
  describe('artifact selection', () => {
    it('should select artifacts for subtask via LLM', async () => {
      const mockLLM = {
        complete: jest.fn().mockResolvedValue(JSON.stringify({
          selectedArtifacts: ['artifact1', 'artifact3'],
          reason: 'These are relevant'
        }))
      };
      
      taskManager = new TaskManager(mockLLM);
      
      const selected = await taskManager.selectArtifactsForSubtask(
        'Subtask description',
        ['artifact1', 'artifact2', 'artifact3']
      );
      
      expect(selected).toEqual(['artifact1', 'artifact3']);
      expect(mockLLM.complete).toHaveBeenCalled();
    });
    
    it('should return empty array when no LLM available', async () => {
      const selected = await taskManager.selectArtifactsForSubtask(
        'Subtask description',
        ['artifact1', 'artifact2']
      );
      
      expect(selected).toEqual([]);
    });
    
    it('should filter out non-existent artifacts', async () => {
      const mockLLM = {
        complete: jest.fn().mockResolvedValue(JSON.stringify({
          selectedArtifacts: ['artifact1', 'nonexistent'],
          reason: 'Selection'
        }))
      };
      
      taskManager = new TaskManager(mockLLM);
      
      const selected = await taskManager.selectArtifactsForSubtask(
        'Subtask description',
        ['artifact1', 'artifact2']
      );
      
      expect(selected).toEqual(['artifact1']);
    });
  });
  
  describe('task tree and execution path', () => {
    it('should get task tree', () => {
      const root = taskManager.createRootTask('Root');
      const child1 = taskManager.createSubtask('Child 1');
      const child2 = taskManager.createSubtask('Child 2');
      
      taskManager.switchToTask(child1);
      const grandchild = taskManager.createSubtask('Grandchild');
      taskManager.switchToTask(grandchild); // Switch to grandchild to make it current
      
      const tree = taskManager.getTaskTree();
      
      expect(tree.description).toBe('Root');
      expect(tree.children).toHaveLength(2);
      expect(tree.children[0].description).toBe('Child 1');
      expect(tree.children[0].children).toHaveLength(1);
      expect(tree.children[0].children[0].description).toBe('Grandchild');
      expect(tree.children[0].children[0].isCurrent).toBe(true);
    });
    
    it('should get execution path', () => {
      const root = taskManager.createRootTask('Root');
      const child = taskManager.createSubtask('Child');
      taskManager.switchToTask(child);
      const grandchild = taskManager.createSubtask('Grandchild');
      taskManager.switchToTask(grandchild);
      
      const path = taskManager.getExecutionPath();
      
      expect(path).toHaveLength(3);
      expect(path[0].description).toBe('Root');
      expect(path[1].description).toBe('Child');
      expect(path[2].description).toBe('Grandchild');
    });
    
    it('should return empty path when no current task', () => {
      const path = taskManager.getExecutionPath();
      
      expect(path).toEqual([]);
    });
  });
  
  describe('reset', () => {
    it('should reset all state', () => {
      taskManager.createRootTask('Root');
      taskManager.createSubtask('Subtask');
      
      taskManager.reset();
      
      expect(taskManager.rootTask).toBeNull();
      expect(taskManager.currentTask).toBeNull();
      expect(taskManager.taskMap.size).toBe(0);
      expect(taskManager.completedTasks).toEqual([]);
    });
  });
});