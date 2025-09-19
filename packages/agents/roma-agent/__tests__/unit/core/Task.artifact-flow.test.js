/**
 * Tests for Task artifact flow and context management
 */
import { jest } from '@jest/globals';
import Task from '../../../src/core/Task.js';
import ArtifactRegistry from '../../../src/core/ArtifactRegistry.js';

describe('Task Artifact Flow', () => {
  let parentTask;
  let mockTaskManager;
  
  beforeEach(() => {
    mockTaskManager = {
      taskMap: new Map(),
      addTask: jest.fn(),
      getTask: jest.fn(),
      updateTaskStatus: jest.fn()
    };
    
    // Create parent task with artifact registry
    parentTask = new Task('Parent task', null, {
      ArtifactRegistryClass: ArtifactRegistry,
      taskManager: mockTaskManager
    });
  });
  
  describe('Task-owned ArtifactRegistry', () => {
    it('should create its own ArtifactRegistry when class is provided', () => {
      const task = new Task('Test task', null, {
        ArtifactRegistryClass: ArtifactRegistry
      });
      
      expect(task.artifactRegistry).toBeDefined();
      expect(task.artifactRegistry).toBeInstanceOf(ArtifactRegistry);
    });
    
    it('should not share artifact registry between tasks', () => {
      const task1 = new Task('Task 1', null, {
        ArtifactRegistryClass: ArtifactRegistry
      });
      const task2 = new Task('Task 2', null, {
        ArtifactRegistryClass: ArtifactRegistry
      });
      
      expect(task1.artifactRegistry).not.toBe(task2.artifactRegistry);
      
      // Add artifact to task1
      task1.artifactRegistry.store('test', 'task1', 'Test artifact');
      
      // Should not appear in task2
      expect(task2.artifactRegistry.has('test')).toBe(false);
    });
  });
  
  describe('Goal inputs/outputs', () => {
    it('should set goal inputs', () => {
      const task = new Task('Test task');
      const inputs = [
        { name: 'config', type: 'json' },
        { name: 'template', type: 'string' }
      ];
      
      task.setGoalInputs(inputs);
      
      expect(task.goalInputs).toEqual(inputs);
    });
    
    it('should set goal outputs', () => {
      const task = new Task('Test task');
      const outputs = [
        { name: 'result', type: 'object' },
        { name: 'report', type: 'markdown' }
      ];
      
      task.setGoalOutputs(outputs);
      
      expect(task.goalOutputs).toEqual(outputs);
    });
    
    it('should parse artifact specs from string format', () => {
      const task = new Task('Test task');
      
      const specs = '@config_json, @template_string, @result';
      const parsed = task._parseArtifactSpecs(specs);
      
      expect(parsed).toEqual([
        { name: 'config_json', type: 'json', description: 'config_json artifact' },
        { name: 'template_string', type: null, description: 'template_string artifact' },
        { name: 'result', type: null, description: 'result artifact' }
      ]);
    });
    
    it('should handle single artifact spec', () => {
      const task = new Task('Test task');
      
      const parsed = task._parseSingleArtifactSpec('@user_data_json');
      
      expect(parsed).toEqual({
        name: 'user_data_json',
        type: 'json',
        description: 'user_data_json artifact'
      });
    });
  });
  
  describe('Artifact transfer', () => {
    it('should receive artifacts from parent registry', async () => {
      // Setup parent with artifacts
      parentTask.artifactRegistry.store('config', 
        { apiKey: 'test123' },
        'Configuration',
        'json'
      );
      parentTask.artifactRegistry.store('template', 
        'Hello {{name}}',
        'Template string',
        'string'
      );
      
      // Create child task
      const childTask = new Task('Child task', parentTask, {
        ArtifactRegistryClass: ArtifactRegistry
      });
      
      // Receive specific artifacts
      await childTask.receiveArtifacts(parentTask.artifactRegistry, ['config']);
      
      expect(childTask.artifactRegistry.has('config')).toBe(true);
      expect(childTask.artifactRegistry.get('config').value).toEqual({ apiKey: 'test123' });
      expect(childTask.artifactRegistry.has('template')).toBe(false);
    });
    
    it('should receive all artifacts when no specific names provided', async () => {
      // Setup parent with artifacts
      parentTask.artifactRegistry.store('artifact1', 'value1', 'Test artifact 1', 'string');
      parentTask.artifactRegistry.store('artifact2', 42, 'Test artifact 2', 'number');
      
      const childTask = new Task('Child task', parentTask, {
        ArtifactRegistryClass: ArtifactRegistry
      });
      
      // Receive all artifacts by specifying their names
      await childTask.receiveArtifacts(parentTask.artifactRegistry, ['artifact1', 'artifact2']);
      
      expect(childTask.artifactRegistry.has('artifact1')).toBe(true);
      expect(childTask.artifactRegistry.has('artifact2')).toBe(true);
    });
    
    it('should deliver goal outputs back to parent', async () => {
      const childTask = new Task('Child task', parentTask, {
        ArtifactRegistryClass: ArtifactRegistry,
        goalOutputs: [
          { name: 'result', type: 'object' },
          { name: 'report', type: 'string' }
        ]
      });
      
      // Child creates artifacts
      childTask.artifactRegistry.store('result', { success: true, data: 'test' }, 'Task result', 'object');
      childTask.artifactRegistry.store('report', 'Task completed successfully', 'Task report', 'string');
      childTask.artifactRegistry.store('internal_temp', 'Should not be transferred', 'Internal temp data', 'string');
      
      // Deliver only goal outputs to parent
      await childTask.deliverGoalOutputs(parentTask.artifactRegistry);
      
      expect(parentTask.artifactRegistry.has('result')).toBe(true);
      expect(parentTask.artifactRegistry.has('report')).toBe(true);
      expect(parentTask.artifactRegistry.has('internal_temp')).toBe(false);
    });
  });
  
  describe('createNextSubtask with artifact flow', () => {
    it('should create subtask with its own artifact registry', async () => {
      parentTask.plannedSubtasks = [
        {
          description: 'Subtask 1',
          outputs: '@result'
        }
      ];
      parentTask.currentSubtaskIndex = -1;
      
      const subtask = await parentTask.createNextSubtask(mockTaskManager);
      
      expect(subtask.artifactRegistry).toBeDefined();
      expect(subtask.artifactRegistry).not.toBe(parentTask.artifactRegistry);
    });
    
    it('should parse and set goal inputs/outputs from subtask definition', async () => {
      parentTask.plannedSubtasks = [
        {
          description: 'Process data',
          inputs: '@config, @template',
          outputs: '@processed_data, @report'
        }
      ];
      parentTask.currentSubtaskIndex = -1;
      
      const subtask = await parentTask.createNextSubtask(mockTaskManager);
      
      expect(subtask.goalInputs).toEqual([
        { name: 'config', type: null, description: 'config artifact' },
        { name: 'template', type: null, description: 'template artifact' }
      ]);
      expect(subtask.goalOutputs).toEqual([
        { name: 'processed_data', type: 'data', description: 'processed_data artifact' },
        { name: 'report', type: null, description: 'report artifact' }
      ]);
    });
    
    it('should transfer specified input artifacts to subtask', async () => {
      // Setup parent artifacts
      parentTask.artifactRegistry.store('config', { setting: 'value' }, 'Configuration settings', 'json');
      parentTask.artifactRegistry.store('other', 'not transferred', 'Other data', 'string');
      
      parentTask.plannedSubtasks = [
        {
          description: 'Use config',
          inputs: '@config',
          outputs: '@result'
        }
      ];
      parentTask.currentSubtaskIndex = -1;
      
      const subtask = await parentTask.createNextSubtask(mockTaskManager);
      
      // Should have received only the specified input
      expect(subtask.artifactRegistry.has('config')).toBe(true);
      expect(subtask.artifactRegistry.get('config').value).toEqual({ setting: 'value' });
      expect(subtask.artifactRegistry.has('other')).toBe(false);
    });
  });
  
  describe('Goal achievement checks', () => {
    it('should check if required inputs are available', () => {
      const task = new Task('Test task', null, {
        ArtifactRegistryClass: ArtifactRegistry,
        goalInputs: [
          { name: 'input1', type: 'string' },
          { name: 'input2', type: 'number' }
        ]
      });
      
      expect(task.hasRequiredInputs()).toBe(false);
      
      task.artifactRegistry.store('input1', 'test', 'Test input 1', 'string');
      expect(task.hasRequiredInputs()).toBe(false);
      
      task.artifactRegistry.store('input2', 42, 'Test input 2', 'number');
      expect(task.hasRequiredInputs()).toBe(true);
    });
    
    it('should check if goal outputs have been achieved', () => {
      const task = new Task('Test task', null, {
        ArtifactRegistryClass: ArtifactRegistry,
        goalOutputs: [
          { name: 'output1', type: 'string' },
          { name: 'output2', type: 'object' }
        ]
      });
      
      expect(task.hasAchievedGoals()).toBe(false);
      
      task.artifactRegistry.store('output1', 'done', 'Test output 1', 'string');
      expect(task.hasAchievedGoals()).toBe(false);
      
      task.artifactRegistry.store('output2', { complete: true }, 'Test output 2', 'object');
      expect(task.hasAchievedGoals()).toBe(true);
    });
    
    it('should return true for empty goals', () => {
      const task = new Task('Test task', null, {
        ArtifactRegistryClass: ArtifactRegistry
      });
      
      expect(task.hasRequiredInputs()).toBe(true);
      expect(task.hasAchievedGoals()).toBe(true);
    });
  });
});