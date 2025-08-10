/**
 * Unit tests for ContextHints
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ContextHints } from '../../src/core/ContextHints.js';

describe('ContextHints', () => {
  let contextHints;
  
  beforeEach(() => {
    contextHints = new ContextHints();
  });
  
  describe('constructor', () => {
    it('should initialize with empty hints map', () => {
      expect(contextHints.hints).toBeInstanceOf(Map);
      expect(contextHints.hints.size).toBe(0);
    });
  });
  
  describe('addHints', () => {
    it('should store hints for a task', () => {
      const suggestions = {
        suggestedInputs: ['database', 'config'],
        suggestedOutputs: ['api', 'routes'],
        relatedTasks: ['parent-task']
      };
      
      contextHints.addHints('task-1', suggestions);
      
      const stored = contextHints.hints.get('task-1');
      expect(stored).toEqual(suggestions);
    });
    
    it('should handle missing fields with defaults', () => {
      contextHints.addHints('task-1', {});
      
      const stored = contextHints.hints.get('task-1');
      expect(stored).toEqual({
        suggestedInputs: [],
        suggestedOutputs: [],
        relatedTasks: []
      });
    });
    
    it('should handle partial suggestions', () => {
      const suggestions = {
        suggestedInputs: ['database']
        // Missing outputs and relatedTasks
      };
      
      contextHints.addHints('task-1', suggestions);
      
      const stored = contextHints.hints.get('task-1');
      expect(stored.suggestedInputs).toEqual(['database']);
      expect(stored.suggestedOutputs).toEqual([]);
      expect(stored.relatedTasks).toEqual([]);
    });
    
    it('should overwrite existing hints', () => {
      contextHints.addHints('task-1', {
        suggestedInputs: ['old-input'],
        suggestedOutputs: ['old-output']
      });
      
      contextHints.addHints('task-1', {
        suggestedInputs: ['new-input'],
        suggestedOutputs: ['new-output']
      });
      
      const stored = contextHints.hints.get('task-1');
      expect(stored.suggestedInputs).toEqual(['new-input']);
      expect(stored.suggestedOutputs).toEqual(['new-output']);
    });
  });
  
  describe('getHints', () => {
    it('should retrieve stored hints', () => {
      const suggestions = {
        suggestedInputs: ['database'],
        suggestedOutputs: ['api'],
        relatedTasks: ['parent']
      };
      
      contextHints.addHints('task-1', suggestions);
      
      const retrieved = contextHints.getHints('task-1');
      expect(retrieved).toEqual(suggestions);
    });
    
    it('should return default hints for unknown task', () => {
      const retrieved = contextHints.getHints('unknown-task');
      
      expect(retrieved).toEqual({
        suggestedInputs: [],
        suggestedOutputs: [],
        relatedTasks: []
      });
    });
  });
  
  describe('setParentRelation', () => {
    it('should add parent relation to new task', () => {
      contextHints.setParentRelation('task-1', 'parent-1');
      
      const stored = contextHints.hints.get('task-1');
      expect(stored.relatedTasks).toContain('parent-1');
    });
    
    it('should add parent relation to existing task', () => {
      contextHints.addHints('task-1', {
        suggestedInputs: ['input'],
        suggestedOutputs: ['output']
      });
      
      contextHints.setParentRelation('task-1', 'parent-1');
      
      const stored = contextHints.hints.get('task-1');
      expect(stored.suggestedInputs).toEqual(['input']);
      expect(stored.suggestedOutputs).toEqual(['output']);
      expect(stored.relatedTasks).toContain('parent-1');
    });
    
    it('should not duplicate parent relations', () => {
      contextHints.setParentRelation('task-1', 'parent-1');
      contextHints.setParentRelation('task-1', 'parent-1');
      
      const stored = contextHints.hints.get('task-1');
      expect(stored.relatedTasks).toEqual(['parent-1']);
    });
    
    it('should handle multiple parent relations', () => {
      contextHints.setParentRelation('task-1', 'parent-1');
      contextHints.setParentRelation('task-1', 'parent-2');
      
      const stored = contextHints.hints.get('task-1');
      expect(stored.relatedTasks).toEqual(['parent-1', 'parent-2']);
    });
  });
  
  describe('getSiblingOutputs', () => {
    it('should collect outputs from sibling tasks', () => {
      // Set up parent-child relationships
      contextHints.addHints('task-1', {
        suggestedOutputs: ['output-1', 'output-2'],
        relatedTasks: ['parent-1']
      });
      
      contextHints.addHints('task-2', {
        suggestedOutputs: ['output-3'],
        relatedTasks: ['parent-1']
      });
      
      contextHints.addHints('task-3', {
        suggestedOutputs: ['output-4'],
        relatedTasks: ['parent-2'] // Different parent
      });
      
      const siblingOutputs = contextHints.getSiblingOutputs('parent-1');
      
      expect(siblingOutputs).toContain('output-1');
      expect(siblingOutputs).toContain('output-2');
      expect(siblingOutputs).toContain('output-3');
      expect(siblingOutputs).not.toContain('output-4');
    });
    
    it('should remove duplicate outputs', () => {
      contextHints.addHints('task-1', {
        suggestedOutputs: ['output-1', 'shared-output'],
        relatedTasks: ['parent-1']
      });
      
      contextHints.addHints('task-2', {
        suggestedOutputs: ['shared-output', 'output-2'],
        relatedTasks: ['parent-1']
      });
      
      const siblingOutputs = contextHints.getSiblingOutputs('parent-1');
      
      expect(siblingOutputs).toEqual(['output-1', 'shared-output', 'output-2']);
    });
    
    it('should return empty array for unknown parent', () => {
      contextHints.addHints('task-1', {
        suggestedOutputs: ['output-1'],
        relatedTasks: ['parent-1']
      });
      
      const siblingOutputs = contextHints.getSiblingOutputs('unknown-parent');
      
      expect(siblingOutputs).toEqual([]);
    });
    
    it('should handle tasks with no outputs', () => {
      contextHints.addHints('task-1', {
        suggestedOutputs: [],
        relatedTasks: ['parent-1']
      });
      
      contextHints.addHints('task-2', {
        suggestedOutputs: ['output-1'],
        relatedTasks: ['parent-1']
      });
      
      const siblingOutputs = contextHints.getSiblingOutputs('parent-1');
      
      expect(siblingOutputs).toEqual(['output-1']);
    });
    
    it('should handle tasks with missing suggestedOutputs', () => {
      contextHints.hints.set('task-1', {
        suggestedInputs: ['input'],
        relatedTasks: ['parent-1']
        // Missing suggestedOutputs
      });
      
      const siblingOutputs = contextHints.getSiblingOutputs('parent-1');
      
      expect(siblingOutputs).toEqual([]);
    });
  });
  
  describe('integration scenarios', () => {
    it('should handle complete workflow', () => {
      // Parent task decomposed into subtasks
      const parentId = 'parent-task';
      
      // Subtask 1
      contextHints.addHints('subtask-1', {
        suggestedInputs: ['initial-data'],
        suggestedOutputs: ['processed-data', 'metrics']
      });
      contextHints.setParentRelation('subtask-1', parentId);
      
      // Subtask 2
      contextHints.addHints('subtask-2', {
        suggestedInputs: ['processed-data'],
        suggestedOutputs: ['report', 'summary']
      });
      contextHints.setParentRelation('subtask-2', parentId);
      
      // Subtask 3
      contextHints.addHints('subtask-3', {
        suggestedInputs: ['metrics', 'summary'],
        suggestedOutputs: ['final-output']
      });
      contextHints.setParentRelation('subtask-3', parentId);
      
      // Get sibling outputs for planning
      const availableOutputs = contextHints.getSiblingOutputs(parentId);
      
      expect(availableOutputs).toContain('processed-data');
      expect(availableOutputs).toContain('metrics');
      expect(availableOutputs).toContain('report');
      expect(availableOutputs).toContain('summary');
      expect(availableOutputs).toContain('final-output');
      
      // Verify individual task hints
      const task2Hints = contextHints.getHints('subtask-2');
      expect(task2Hints.suggestedInputs).toContain('processed-data');
      expect(task2Hints.suggestedOutputs).toContain('report');
    });
  });
});