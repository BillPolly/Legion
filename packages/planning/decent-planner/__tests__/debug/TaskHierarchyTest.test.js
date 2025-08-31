/**
 * Debug TaskHierarchyService.getSimpleTasks method
 */

import { TaskHierarchyService } from '../../src/domain/services/TaskHierarchyService.js';

describe('TaskHierarchyService Debug', () => {
  test('getSimpleTasks with SIMPLE root task', () => {
    const rootTask = {
      id: 'task-123',
      description: 'test task',
      complexity: 'SIMPLE',
      status: 'PENDING',
      subtasks: [],
      tools: []
    };
    
    console.log('🧪 Testing getSimpleTasks with root task:', JSON.stringify(rootTask, null, 2));
    
    const simpleTasks = TaskHierarchyService.getSimpleTasks(rootTask);
    
    console.log('📊 getSimpleTasks returned:', simpleTasks.length, 'tasks');
    console.log('📋 Simple tasks:', simpleTasks.map(t => ({ id: t.id, complexity: t.complexity })));
    
    expect(simpleTasks).toHaveLength(1);
    expect(simpleTasks[0]).toBe(rootTask);
    expect(simpleTasks[0].complexity).toBe('SIMPLE');
  });
});