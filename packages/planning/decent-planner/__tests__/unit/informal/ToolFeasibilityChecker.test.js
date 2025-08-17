/**
 * Unit tests for ToolFeasibilityChecker
 */

import { describe, it, expect, beforeAll, jest } from '@jest/globals';
import { ToolFeasibilityChecker } from '../../../src/core/informal/ToolFeasibilityChecker.js';
import { TaskNode } from '../../../src/core/informal/types/TaskNode.js';

describe('ToolFeasibilityChecker', () => {
  let checker;
  let mockToolRegistry;

  beforeAll(() => {
    // Mock ToolRegistry for unit tests
    mockToolRegistry = {
      searchTools: async (query, options = {}) => {
        const normalizedQuery = query.toLowerCase();
        
        // Simulate semantic search results based on query
        if (normalizedQuery.includes('file') || normalizedQuery.includes('write')) {
          return [
            { name: 'file_write', description: 'Write content to a file', confidence: 0.95 },
            { name: 'file_read', description: 'Read content from a file', confidence: 0.85 },
            { name: 'file_delete', description: 'Delete a file', confidence: 0.75 }
          ];
        }
        
        if (normalizedQuery.includes('database') || normalizedQuery.includes('sql')) {
          return [
            { name: 'db_query', description: 'Execute SQL query', confidence: 0.92 },
            { name: 'db_create_table', description: 'Create database table', confidence: 0.88 },
            { name: 'db_insert', description: 'Insert data into table', confidence: 0.85 }
          ];
        }
        
        if (normalizedQuery.includes('api') || normalizedQuery.includes('http')) {
          return [
            { name: 'http_get', description: 'Make HTTP GET request', confidence: 0.90 },
            { name: 'http_post', description: 'Make HTTP POST request', confidence: 0.88 },
            { name: 'api_call', description: 'Call external API', confidence: 0.85 }
          ];
        }
        
        if (normalizedQuery.includes('authentication') || normalizedQuery.includes('jwt')) {
          return [
            { name: 'jwt_sign', description: 'Sign JWT token', confidence: 0.93 },
            { name: 'jwt_verify', description: 'Verify JWT token', confidence: 0.91 },
            { name: 'password_hash', description: 'Hash password', confidence: 0.87 }
          ];
        }
        
        if (normalizedQuery.includes('impossible') || normalizedQuery.includes('unicorn')) {
          return []; // No tools found
        }
        
        // Default: return some generic tools with lower confidence
        return [
          { name: 'generic_tool', description: 'Generic operation', confidence: 0.45 },
          { name: 'util_helper', description: 'Utility helper', confidence: 0.40 }
        ];
      },
      
      getTool: async (toolName) => {
        // Return tool details
        const tools = {
          'file_write': { name: 'file_write', description: 'Write content to a file', category: 'file' },
          'db_query': { name: 'db_query', description: 'Execute SQL query', category: 'database' },
          'http_get': { name: 'http_get', description: 'Make HTTP GET request', category: 'http' }
        };
        
        return tools[toolName] || null;
      }
    };

    checker = new ToolFeasibilityChecker(mockToolRegistry);
  });

  describe('initialization', () => {
    it('should require ToolRegistry', () => {
      expect(() => new ToolFeasibilityChecker()).toThrow('ToolRegistry is required');
    });

    it('should set default confidence threshold', () => {
      const checker = new ToolFeasibilityChecker(mockToolRegistry);
      expect(checker.confidenceThreshold).toBe(0.7);
    });

    it('should accept custom confidence threshold', () => {
      const checker = new ToolFeasibilityChecker(mockToolRegistry, { confidenceThreshold: 0.8 });
      expect(checker.confidenceThreshold).toBe(0.8);
    });
  });

  describe('checkTaskFeasibility', () => {
    it('should find tools for simple file operation', async () => {
      const task = new TaskNode({
        description: 'Write configuration to file',
        complexity: 'SIMPLE'
      });

      const result = await checker.checkTaskFeasibility(task);

      expect(result.feasible).toBe(true);
      expect(result.tools).toBeDefined();
      expect(result.tools.length).toBeGreaterThan(0);
      expect(result.tools[0].name).toBe('file_write');
      expect(result.tools[0].confidence).toBeGreaterThan(0.7);
    });

    it('should find tools for database operations', async () => {
      const task = new TaskNode({
        description: 'Create database table for users',
        complexity: 'SIMPLE'
      });

      const result = await checker.checkTaskFeasibility(task);

      expect(result.feasible).toBe(true);
      expect(result.tools.some(t => t.name === 'db_create_table')).toBe(true);
    });

    it('should mark task as infeasible if no tools found', async () => {
      const task = new TaskNode({
        description: 'Capture a unicorn in the wild',
        complexity: 'SIMPLE'
      });

      const result = await checker.checkTaskFeasibility(task);

      expect(result.feasible).toBe(false);
      expect(result.tools).toEqual([]);
      expect(result.reason).toContain('No tools found');
    });

    it('should mark task as infeasible if confidence too low', async () => {
      const highThresholdChecker = new ToolFeasibilityChecker(
        mockToolRegistry, 
        { confidenceThreshold: 0.95 }
      );

      const task = new TaskNode({
        description: 'Perform generic operation',
        complexity: 'SIMPLE'
      });

      const result = await highThresholdChecker.checkTaskFeasibility(task);

      expect(result.feasible).toBe(false);
      expect(result.reason).toContain('confidence');
    });

    it('should use I/O hints for better tool discovery', async () => {
      const task = new TaskNode({
        description: 'Store user data',
        complexity: 'SIMPLE',
        suggestedInputs: ['user object', 'database connection'],
        suggestedOutputs: ['database record', 'user id']
      });

      const result = await checker.checkTaskFeasibility(task);

      expect(result.feasible).toBe(true);
      expect(result.tools.some(t => t.name.includes('db'))).toBe(true);
    });

    it('should only check SIMPLE tasks', async () => {
      const complexTask = new TaskNode({
        description: 'Build entire application',
        complexity: 'COMPLEX'
      });

      const result = await checker.checkTaskFeasibility(complexTask);

      expect(result.feasible).toBe(true);
      expect(result.tools).toEqual([]);
      expect(result.reason).toBe('COMPLEX tasks do not require tools directly');
    });

    it('should limit number of returned tools', async () => {
      const checker = new ToolFeasibilityChecker(
        mockToolRegistry,
        { maxTools: 2 }
      );

      const task = new TaskNode({
        description: 'File operations',
        complexity: 'SIMPLE'
      });

      const result = await checker.checkTaskFeasibility(task);

      expect(result.tools.length).toBeLessThanOrEqual(2);
    });
  });

  describe('checkHierarchyFeasibility', () => {
    it('should check all SIMPLE tasks in hierarchy', async () => {
      const root = new TaskNode({
        description: 'Build feature',
        complexity: 'COMPLEX'
      });

      const subtask1 = new TaskNode({
        description: 'Write to file',
        complexity: 'SIMPLE'
      });

      const subtask2 = new TaskNode({
        description: 'Query database',
        complexity: 'SIMPLE'
      });

      root.addSubtask(subtask1);
      root.addSubtask(subtask2);

      const result = await checker.checkHierarchyFeasibility(root);

      expect(result.feasible).toBe(true);
      expect(result.totalTasks).toBe(3);
      expect(result.simpleTasks).toBe(2);
      expect(result.feasibleTasks).toBe(2);
      expect(result.infeasibleTasks).toEqual([]);
    });

    it('should identify infeasible tasks in hierarchy', async () => {
      const root = new TaskNode({
        description: 'Build feature',
        complexity: 'COMPLEX'
      });

      const feasibleTask = new TaskNode({
        description: 'Write to file',
        complexity: 'SIMPLE'
      });

      const infeasibleTask = new TaskNode({
        description: 'Capture impossible unicorn',
        complexity: 'SIMPLE'
      });

      root.addSubtask(feasibleTask);
      root.addSubtask(infeasibleTask);

      const result = await checker.checkHierarchyFeasibility(root);

      expect(result.feasible).toBe(false);
      expect(result.infeasibleTasks).toHaveLength(1);
      expect(result.infeasibleTasks[0].task).toBe('Capture impossible unicorn');
    });

    it('should handle nested hierarchies', async () => {
      const root = new TaskNode({
        description: 'Build system',
        complexity: 'COMPLEX'
      });

      const level1 = new TaskNode({
        description: 'Build subsystem',
        complexity: 'COMPLEX'
      });

      const level2 = new TaskNode({
        description: 'Write configuration',
        complexity: 'SIMPLE'
      });

      root.addSubtask(level1);
      level1.addSubtask(level2);

      const result = await checker.checkHierarchyFeasibility(root);

      expect(result.totalTasks).toBe(3);
      expect(result.simpleTasks).toBe(1);
      expect(result.feasibleTasks).toBe(1);
    });

    it('should annotate tasks with tool information', async () => {
      const task = new TaskNode({
        description: 'Write to file',
        complexity: 'SIMPLE'
      });

      await checker.checkTaskFeasibility(task);

      expect(task.tools).toBeDefined();
      expect(task.tools.length).toBeGreaterThan(0);
      expect(task.feasible).toBe(true);
    });
  });

  describe('tool search strategies', () => {
    it('should combine description and I/O hints in search query', async () => {
      const searchSpy = jest.spyOn(mockToolRegistry, 'searchTools');

      const task = new TaskNode({
        description: 'Save user profile',
        complexity: 'SIMPLE',
        suggestedInputs: ['user data'],
        suggestedOutputs: ['profile id']
      });

      await checker.checkTaskFeasibility(task);

      expect(searchSpy).toHaveBeenCalled();
      const query = searchSpy.mock.calls[0][0];
      expect(query).toContain('Save user profile');
    });

    it('should filter tools by confidence threshold', async () => {
      const checker = new ToolFeasibilityChecker(
        mockToolRegistry,
        { confidenceThreshold: 0.8 }
      );

      const task = new TaskNode({
        description: 'File operation',
        complexity: 'SIMPLE'
      });

      const result = await checker.checkTaskFeasibility(task);

      result.tools.forEach(tool => {
        expect(tool.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should sort tools by confidence', async () => {
      const task = new TaskNode({
        description: 'File operation',
        complexity: 'SIMPLE'
      });

      const result = await checker.checkTaskFeasibility(task);

      for (let i = 1; i < result.tools.length; i++) {
        expect(result.tools[i-1].confidence).toBeGreaterThanOrEqual(result.tools[i].confidence);
      }
    });
  });

  describe('error handling', () => {
    it('should handle ToolRegistry errors gracefully', async () => {
      const failingRegistry = {
        searchTools: async () => {
          throw new Error('Registry unavailable');
        }
      };

      const checker = new ToolFeasibilityChecker(failingRegistry);
      const task = new TaskNode({
        description: 'Some task',
        complexity: 'SIMPLE'
      });

      await expect(checker.checkTaskFeasibility(task))
        .rejects.toThrow('Registry unavailable');
    });

    it('should throw error for invalid task', async () => {
      await expect(checker.checkTaskFeasibility(null))
        .rejects.toThrow('Task is required');

      await expect(checker.checkTaskFeasibility({}))
        .rejects.toThrow('Invalid task: missing description');
    });
  });
});