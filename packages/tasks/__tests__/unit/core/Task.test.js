/**
 * Unit tests for Task class
 */

import { jest } from '@jest/globals';
import { Task } from '@legion/tasks';

describe('Task', () => {
  describe('constructor', () => {
    it('should create a root task with no parent', () => {
      const task = new Task('Root task');
      
      expect(task.description).toBe('Root task');
      expect(task.parent).toBeNull();
      expect(task.children).toEqual([]);
      expect(task.status).toBe('pending');
      expect(task.metadata.depth).toBe(0);
      expect(task.conversation).toHaveLength(1);
      expect(task.conversation[0].content).toBe('Task: Root task');
    });
    
    it('should create a child task with parent', () => {
      const parent = new Task('Parent task');
      const child = new Task('Child task', parent);
      
      expect(child.parent).toBe(parent);
      expect(child.metadata.depth).toBe(1);
      expect(parent.children).toContain(child);
    });
    
    it('should initialize conversation with task description', () => {
      const task = new Task('Test task');
      
      expect(task.conversation).toHaveLength(1);
      expect(task.conversation[0].role).toBe('system');
      expect(task.conversation[0].content).toBe('Task: Test task');
    });
    
    it('should accept context with custom id and metadata', () => {
      const task = new Task('Test task', null, {
        id: 'custom-id',
        metadata: {
          source: 'test',
          priority: 'high'
        }
      });
      
      expect(task.id).toBe('custom-id');
      expect(task.metadata.source).toBe('test');
      expect(task.metadata.priority).toBe('high');
    });
  });
  
  describe('conversation management', () => {
    let task;
    
    beforeEach(() => {
      task = new Task('Test task');
    });
    
    it('should add conversation entries', () => {
      const entry = task.addConversationEntry('user', 'Test message');
      
      expect(entry.role).toBe('user');
      expect(entry.content).toBe('Test message');
      expect(task.conversation).toHaveLength(2); // Initial + new
    });
    
    it('should add prompts', () => {
      const entry = task.addPrompt('Test prompt', 'classification');
      
      expect(entry.role).toBe('user');
      expect(entry.content).toBe('Test prompt');
      expect(entry.metadata.type).toBe('prompt');
      expect(entry.metadata.promptType).toBe('classification');
    });
    
    it('should add responses', () => {
      const entry = task.addResponse('Test response', 'classification');
      
      expect(entry.role).toBe('assistant');
      expect(entry.content).toBe('Test response');
      expect(entry.metadata.type).toBe('response');
      expect(entry.metadata.responseType).toBe('classification');
    });
    
    it('should add tool results', () => {
      const result = { success: true, data: 'test' };
      const entry = task.addToolResult('file_read', { path: 'test.txt' }, result);
      
      expect(entry.role).toBe('tool');
      expect(entry.content).toBe(JSON.stringify(result));
      expect(entry.metadata.toolName).toBe('file_read');
      expect(entry.metadata.inputs).toEqual({ path: 'test.txt' });
      expect(entry.metadata.success).toBe(true);
    });
    
    it('should format conversation for prompts', () => {
      task.addPrompt('Test prompt');
      task.addResponse('Test response');
      task.addToolResult('test_tool', {}, { success: true });
      
      const formatted = task.formatConversation();
      
      expect(formatted).toContain('SYSTEM: Task: Test task');
      expect(formatted).toContain('USER: Test prompt');
      expect(formatted).toContain('ASSISTANT: Test response');
      expect(formatted).toContain('TOOL test_tool:');
    });
    
    it('should filter conversation by last N entries', () => {
      for (let i = 0; i < 10; i++) {
        task.addPrompt(`Prompt ${i}`);
      }
      
      const context = task.getConversationContext({ lastN: 3 });
      
      expect(context).toHaveLength(3);
      expect(context[0].content).toBe('Prompt 7');
      expect(context[2].content).toBe('Prompt 9');
    });
  });
  
  describe('task lifecycle', () => {
    let task;
    
    beforeEach(() => {
      task = new Task('Test task');
    });
    
    it('should start task', () => {
      task.start();
      
      expect(task.status).toBe('in-progress');
      expect(task.metadata.startedAt).toBeInstanceOf(Date);
      expect(task.conversation).toContainEqual(
        expect.objectContaining({
          role: 'system',
          content: 'Task execution started'
        })
      );
    });
    
    it('should complete task', () => {
      task.start();
      const result = { success: true, data: 'test' };
      task.complete(result);
      
      expect(task.status).toBe('completed');
      expect(task.result).toEqual(result);
      expect(task.metadata.completedAt).toBeInstanceOf(Date);
      expect(task.conversation).toContainEqual(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('Task completed')
        })
      );
    });
    
    it('should fail task', () => {
      task.start();
      const error = new Error('Test error');
      task.fail(error);
      
      expect(task.status).toBe('failed');
      expect(task.result).toEqual({ error: 'Test error' });
      expect(task.metadata.completedAt).toBeInstanceOf(Date);
      expect(task.conversation).toContainEqual(
        expect.objectContaining({
          role: 'system',
          content: 'Task failed: Test error'
        })
      );
    });
  });
  
  describe('task hierarchy', () => {
    let root, child1, child2, grandchild;
    
    beforeEach(() => {
      root = new Task('Root task');
      child1 = new Task('Child 1', root);
      child2 = new Task('Child 2', root);
      grandchild = new Task('Grandchild', child1);
    });
    
    it('should manage parent-child relationships', () => {
      expect(root.children).toHaveLength(2);
      expect(root.children).toContain(child1);
      expect(root.children).toContain(child2);
      expect(child1.children).toContain(grandchild);
      expect(grandchild.metadata.depth).toBe(2);
    });
    
    it('should notify parent when child completes', () => {
      child1.start();
      child1.complete({ success: true });
      
      expect(root.conversation).toContainEqual(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('Subtask completed: Child 1')
        })
      );
    });
    
    it('should notify parent when child fails', () => {
      child1.start();
      child1.fail(new Error('Child error'));
      
      expect(root.conversation).toContainEqual(
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('Subtask failed: Child 1')
        })
      );
    });
    
    it('should check if all children are complete', () => {
      expect(root.areAllChildrenComplete()).toBe(false);
      
      child1.complete({ success: true });
      expect(root.areAllChildrenComplete()).toBe(false);
      
      child2.complete({ success: true });
      expect(root.areAllChildrenComplete()).toBe(true);
    });
    
    it('should get task hierarchy path', () => {
      const path = grandchild.getPath();
      
      expect(path).toBe('Root task > Child 1 > Grandchild');
    });
  });
  
  describe('artifact management', () => {
    let task;
    
    beforeEach(() => {
      task = new Task('Test task');
    });
    
    it('should add artifacts', () => {
      task.addArtifact('artifact1');
      task.addArtifact('artifact2');
      
      expect(task.getArtifacts()).toEqual(['artifact1', 'artifact2']);
      expect(task.conversation).toContainEqual(
        expect.objectContaining({
          role: 'system',
          content: 'Artifact added: @artifact1'
        })
      );
    });
    
    it('should remove artifacts', () => {
      task.addArtifact('artifact1');
      task.addArtifact('artifact2');
      task.removeArtifact('artifact1');
      
      expect(task.getArtifacts()).toEqual(['artifact2']);
    });
    
    it('should inherit artifacts from parent', () => {
      task.inheritArtifacts(['parent1', 'parent2']);
      
      expect(task.getArtifacts()).toEqual(['parent1', 'parent2']);
      expect(task.conversation).toContainEqual(
        expect.objectContaining({
          role: 'system',
          content: 'Inherited artifacts from parent: @parent1, @parent2'
        })
      );
    });
    
    it('should not duplicate artifacts', () => {
      task.addArtifact('artifact1');
      task.addArtifact('artifact1');
      
      expect(task.getArtifacts()).toEqual(['artifact1']);
    });
  });
  
  describe('serialization', () => {
    it('should convert to JSON', () => {
      const root = new Task('Root task');
      const child = new Task('Child task', root);
      
      root.addArtifact('artifact1');
      child.complete({ success: true });
      
      const json = root.toJSON();
      
      expect(json.id).toBe(root.id);
      expect(json.description).toBe('Root task');
      expect(json.status).toBe('pending');
      expect(json.artifacts).toEqual(['artifact1']);
      expect(json.children).toHaveLength(1);
      expect(json.children[0].description).toBe('Child task');
      expect(json.children[0].status).toBe('completed');
    });
    
    it('should create summary', () => {
      const task = new Task('Test task');
      task.addArtifact('artifact1');
      task.start();
      task.complete({ success: true });
      
      const summary = task.createSummary();
      
      expect(summary.id).toBe(task.id);
      expect(summary.description).toBe('Test task');
      expect(summary.status).toBe('completed');
      expect(summary.artifacts).toEqual(['artifact1']);
      expect(summary.duration).toBeGreaterThanOrEqual(0);
    });
  });
});