/**
 * Tests for WorkingSet class
 * 
 * Tests active tool management, context-aware suggestions, and priority-based selection
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { WorkingSet } from '../../../src/tools/WorkingSet.js';
import { ToolRegistry } from '../../../src/tools/ToolRegistry.js';

describe('WorkingSet', () => {
  let registry;
  let workingSet;

  beforeEach(() => {
    registry = new ToolRegistry();
    workingSet = new WorkingSet(registry);

    // Register test tools
    const testTools = [
      {
        name: 'file-reader',
        description: 'Read files from disk',
        category: 'file',
        tags: ['io', 'read', 'file'],
        execute: async () => ({ content: 'data' })
      },
      {
        name: 'file-writer',
        description: 'Write content to files',
        category: 'file',
        tags: ['io', 'write', 'file'],
        execute: async () => ({ written: true })
      },
      {
        name: 'http-client',
        description: 'Make HTTP requests',
        category: 'network',
        tags: ['http', 'web', 'api'],
        execute: async () => ({ status: 200 })
      },
      {
        name: 'json-parser',
        description: 'Parse JSON data',
        category: 'utility',
        tags: ['json', 'parse'],
        execute: async () => ({ parsed: true })
      },
      {
        name: 'data-validator',
        description: 'Validate data structures',
        category: 'utility',
        tags: ['validation', 'data'],
        execute: async () => ({ valid: true })
      }
    ];

    registry.registerTools(testTools);
  });

  describe('Basic Working Set Management', () => {
    test('should initialize with empty working set', () => {
      expect(workingSet.getActiveTools()).toEqual([]);
      expect(workingSet.getActiveToolCount()).toBe(0);
      expect(workingSet.isActive('file-reader')).toBe(false);
    });

    test('should activate tools', () => {
      workingSet.activateTool('file-reader');
      
      expect(workingSet.isActive('file-reader')).toBe(true);
      expect(workingSet.getActiveToolCount()).toBe(1);
      expect(workingSet.getActiveTools()).toContain('file-reader');
    });

    test('should deactivate tools', () => {
      workingSet.activateTool('file-reader');
      workingSet.activateTool('json-parser');
      
      expect(workingSet.getActiveToolCount()).toBe(2);
      
      workingSet.deactivateTool('file-reader');
      
      expect(workingSet.isActive('file-reader')).toBe(false);
      expect(workingSet.isActive('json-parser')).toBe(true);
      expect(workingSet.getActiveToolCount()).toBe(1);
    });

    test('should handle activating non-existent tools', () => {
      expect(() => {
        workingSet.activateTool('non-existent');
      }).toThrow('Tool not found: non-existent');
    });

    test('should ignore duplicate activations', () => {
      workingSet.activateTool('file-reader');
      workingSet.activateTool('file-reader'); // Duplicate
      
      expect(workingSet.getActiveToolCount()).toBe(1);
    });

    test('should return false when deactivating inactive tool', () => {
      const result = workingSet.deactivateTool('file-reader');
      expect(result).toBe(false);
    });
  });

  describe('Working Set Size Management', () => {
    test('should respect size limits', () => {
      const limitedWorkingSet = new WorkingSet(registry, { maxSize: 2 });
      
      limitedWorkingSet.activateTool('file-reader');
      limitedWorkingSet.activateTool('file-writer');
      limitedWorkingSet.activateTool('http-client');
      
      expect(limitedWorkingSet.getActiveToolCount()).toBe(2);
    });

    test('should evict least recently used tools', () => {
      const limitedWorkingSet = new WorkingSet(registry, { 
        maxSize: 2,
        evictionPolicy: 'lru'
      });
      
      limitedWorkingSet.activateTool('file-reader');
      limitedWorkingSet.activateTool('file-writer');
      
      // Access file-reader to make it more recently used
      limitedWorkingSet.recordUsage('file-reader');
      
      // This should evict file-writer (least recently used)
      limitedWorkingSet.activateTool('http-client');
      
      expect(limitedWorkingSet.isActive('file-reader')).toBe(true);
      expect(limitedWorkingSet.isActive('file-writer')).toBe(false);
      expect(limitedWorkingSet.isActive('http-client')).toBe(true);
    });

    test('should evict lowest priority tools', () => {
      const limitedWorkingSet = new WorkingSet(registry, { 
        maxSize: 2,
        evictionPolicy: 'priority'
      });
      
      limitedWorkingSet.activateTool('file-reader', { priority: 5 });
      limitedWorkingSet.activateTool('file-writer', { priority: 3 });
      
      // This should evict file-writer (lower priority)
      limitedWorkingSet.activateTool('http-client', { priority: 4 });
      
      expect(limitedWorkingSet.isActive('file-reader')).toBe(true);
      expect(limitedWorkingSet.isActive('file-writer')).toBe(false);
      expect(limitedWorkingSet.isActive('http-client')).toBe(true);
    });

    test('should allow size reconfiguration', () => {
      workingSet.activateTool('file-reader');
      workingSet.activateTool('file-writer');
      workingSet.activateTool('http-client');
      
      expect(workingSet.getActiveToolCount()).toBe(3);
      
      workingSet.setMaxSize(2);
      
      expect(workingSet.getActiveToolCount()).toBe(2);
    });
  });

  describe('Priority Management', () => {
    test('should activate tools with priority', () => {
      workingSet.activateTool('file-reader', { priority: 5 });
      workingSet.activateTool('file-writer', { priority: 3 });
      
      const priorities = workingSet.getToolPriorities();
      expect(priorities['file-reader']).toBe(5);
      expect(priorities['file-writer']).toBe(3);
    });

    test('should update tool priorities', () => {
      workingSet.activateTool('file-reader', { priority: 3 });
      workingSet.updateToolPriority('file-reader', 8);
      
      const priorities = workingSet.getToolPriorities();
      expect(priorities['file-reader']).toBe(8);
    });

    test('should get tools ordered by priority', () => {
      workingSet.activateTool('file-reader', { priority: 5 });
      workingSet.activateTool('file-writer', { priority: 8 });
      workingSet.activateTool('http-client', { priority: 3 });
      
      const orderedTools = workingSet.getToolsByPriority();
      expect(orderedTools[0]).toBe('file-writer'); // Highest priority
      expect(orderedTools[1]).toBe('file-reader');
      expect(orderedTools[2]).toBe('http-client'); // Lowest priority
    });

    test('should handle tools without explicit priority', () => {
      workingSet.activateTool('file-reader'); // No priority specified
      workingSet.activateTool('file-writer', { priority: 5 });
      
      const priorities = workingSet.getToolPriorities();
      expect(priorities['file-reader']).toBe(1); // Default priority
      expect(priorities['file-writer']).toBe(5);
    });
  });

  describe('Context-Aware Suggestions', () => {
    test('should suggest tools based on active tools', () => {
      workingSet.activateTool('file-reader');
      
      const suggestions = workingSet.getSuggestedTools();
      
      // Should suggest file-writer (same category and tags)
      expect(suggestions.some(s => s.name === 'file-writer')).toBe(true);
      
      // Should not suggest currently active tools
      expect(suggestions.some(s => s.name === 'file-reader')).toBe(false);
    });

    test('should suggest tools based on tool dependencies', () => {
      // Add dependency relationship
      registry.addDependency('json-parser', 'http-client');
      
      workingSet.activateTool('http-client');
      
      const suggestions = workingSet.getSuggestedTools();
      
      // Should suggest json-parser as it depends on active http-client
      expect(suggestions.some(s => s.name === 'json-parser')).toBe(true);
    });

    test('should suggest tools based on usage patterns', () => {
      // Record usage patterns
      registry.recordUsage('file-reader');
      registry.recordUsage('json-parser');
      registry.recordUsage('json-parser');
      
      workingSet.activateTool('file-reader');
      
      const suggestions = workingSet.getSuggestedTools();
      
      // Should suggest json-parser due to higher usage frequency
      const jsonSuggestion = suggestions.find(s => s.name === 'json-parser');
      expect(jsonSuggestion).toBeDefined();
      expect(jsonSuggestion.reason).toContain('frequently used');
    });

    test('should limit number of suggestions', () => {
      const limitedWorkingSet = new WorkingSet(registry, { maxSuggestions: 2 });
      
      limitedWorkingSet.activateTool('file-reader');
      
      const suggestions = limitedWorkingSet.getSuggestedTools();
      expect(suggestions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Auto-Activation Features', () => {
    test('should auto-activate tools based on context', () => {
      const autoWorkingSet = new WorkingSet(registry, { 
        autoActivation: true,
        autoActivationThreshold: 0.7
      });
      
      // Simulate context that strongly suggests file operations
      autoWorkingSet.updateContext({
        recentOperations: ['read-file', 'write-file'],
        dataTypes: ['text', 'file']
      });
      
      autoWorkingSet.processAutoActivation();
      
      // Should auto-activate file-related tools
      expect(autoWorkingSet.isActive('file-reader')).toBe(true);
      expect(autoWorkingSet.isActive('file-writer')).toBe(true);
    });

    test('should respect auto-activation limits', () => {
      const autoWorkingSet = new WorkingSet(registry, { 
        autoActivation: true,
        maxAutoActivations: 1
      });
      
      autoWorkingSet.updateContext({
        recentOperations: ['read-file', 'parse-json', 'validate-data']
      });
      
      autoWorkingSet.processAutoActivation();
      
      // Should only auto-activate one tool despite multiple matches
      expect(autoWorkingSet.getActiveToolCount()).toBeLessThanOrEqual(1);
    });

    test('should not auto-activate if disabled', () => {
      const manualWorkingSet = new WorkingSet(registry, { autoActivation: false });
      
      manualWorkingSet.updateContext({
        recentOperations: ['read-file', 'write-file']
      });
      
      manualWorkingSet.processAutoActivation();
      
      expect(manualWorkingSet.getActiveToolCount()).toBe(0);
    });
  });

  describe('Usage Tracking and Analytics', () => {
    test('should record tool usage', () => {
      workingSet.activateTool('file-reader');
      workingSet.recordUsage('file-reader');
      workingSet.recordUsage('file-reader');
      
      const usage = workingSet.getToolUsage('file-reader');
      expect(usage.count).toBe(2);
      expect(usage.lastUsed).toBeInstanceOf(Date);
    });

    test('should track activation history', () => {
      workingSet.activateTool('file-reader');
      workingSet.activateTool('file-writer');
      workingSet.deactivateTool('file-reader');
      
      const history = workingSet.getActivationHistory();
      expect(history.length).toBe(3);
      expect(history[0].action).toBe('activate');
      expect(history[0].tool).toBe('file-reader');
      expect(history[2].action).toBe('deactivate');
    });

    test('should provide working set statistics', () => {
      workingSet.activateTool('file-reader');
      workingSet.activateTool('file-writer');
      workingSet.recordUsage('file-reader');
      
      const stats = workingSet.getStatistics();
      
      expect(stats.activeToolCount).toBe(2);
      expect(stats.totalUsage).toBe(1);
      expect(stats.averagePriority).toBeGreaterThan(0);
    });

    test('should track tool effectiveness', () => {
      workingSet.activateTool('file-reader');
      workingSet.recordUsage('file-reader');
      workingSet.recordUsage('file-reader');
      
      // Mock some time passing
      jest.useFakeTimers();
      jest.advanceTimersByTime(60000); // 1 minute
      
      const effectiveness = workingSet.getToolEffectiveness('file-reader');
      expect(effectiveness.usageRate).toBeGreaterThan(0);
      
      jest.useRealTimers();
    });
  });

  describe('Working Set State Management', () => {
    test('should save and restore working set state', () => {
      workingSet.activateTool('file-reader', { priority: 5 });
      workingSet.activateTool('json-parser', { priority: 3 });
      workingSet.recordUsage('file-reader');
      
      const state = workingSet.saveState();
      
      const newWorkingSet = new WorkingSet(registry);
      newWorkingSet.restoreState(state);
      
      expect(newWorkingSet.isActive('file-reader')).toBe(true);
      expect(newWorkingSet.isActive('json-parser')).toBe(true);
      expect(newWorkingSet.getToolPriorities()['file-reader']).toBe(5);
    });

    test('should clear working set', () => {
      workingSet.activateTool('file-reader');
      workingSet.activateTool('file-writer');
      
      expect(workingSet.getActiveToolCount()).toBe(2);
      
      workingSet.clear();
      
      expect(workingSet.getActiveToolCount()).toBe(0);
      expect(workingSet.getActiveTools()).toEqual([]);
    });

    test('should clone working set', () => {
      workingSet.activateTool('file-reader', { priority: 5 });
      workingSet.recordUsage('file-reader');
      
      const cloned = workingSet.clone();
      
      expect(cloned.isActive('file-reader')).toBe(true);
      expect(cloned.getToolPriorities()['file-reader']).toBe(5);
      expect(cloned.getToolUsage('file-reader').count).toBe(1);
    });
  });

  describe('Integration with Tool Registry', () => {
    test('should sync with registry changes', () => {
      workingSet.activateTool('file-reader');
      
      // Remove tool from registry
      registry.unregisterTool('file-reader');
      
      // Working set should detect and handle missing tool
      workingSet.syncWithRegistry();
      
      expect(workingSet.isActive('file-reader')).toBe(false);
    });

    test('should get tool information from registry', () => {
      workingSet.activateTool('file-reader');
      
      const toolInfo = workingSet.getActiveToolInfo('file-reader');
      
      expect(toolInfo.name).toBe('file-reader');
      expect(toolInfo.category).toBe('file');
      expect(toolInfo.tags).toContain('io');
    });

    test('should use registry for tool suggestions', () => {
      workingSet.activateTool('file-reader');
      
      const suggestions = workingSet.getSuggestedTools();
      
      // Should leverage registry's relationship tracking
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every(s => typeof s.reason === 'string')).toBe(true);
    });
  });
});