/**
 * Tests for MetaTools class
 * 
 * Tests meta-tools for tool search, activation, suggestions, and working set management
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { MetaTools } from '../../../src/tools/MetaTools.js';
import { ToolRegistry } from '../../../src/tools/ToolRegistry.js';
import { WorkingSet } from '../../../src/tools/WorkingSet.js';

describe('MetaTools', () => {
  let registry;
  let workingSet;
  let metaTools;

  beforeEach(() => {
    registry = new ToolRegistry();
    workingSet = new WorkingSet(registry);
    metaTools = new MetaTools(registry, workingSet);

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

  describe('Meta-Tool Registration', () => {
    test('should register all meta-tools', () => {
      const tools = metaTools.getMetaTools();
      
      expect(tools).toHaveProperty('tool_search');
      expect(tools).toHaveProperty('tool_activate');
      expect(tools).toHaveProperty('tool_deactivate');
      expect(tools).toHaveProperty('tool_suggest');
      expect(tools).toHaveProperty('tool_list_active');
      expect(tools).toHaveProperty('tool_info');
    });

    test('should register tools with proper schemas', () => {
      const tools = metaTools.getMetaTools();
      
      for (const [name, tool] of Object.entries(tools)) {
        expect(tool.name).toBe(name);
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.execute).toBe('function');
      }
    });
  });

  describe('tool_search functionality', () => {
    test('should search tools by name pattern', async () => {
      const searchTool = metaTools.getMetaTools().tool_search;
      
      const result = await searchTool.execute({
        namePattern: 'file-*'
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.map(t => t.name)).toContain('file-reader');
      expect(result.results.map(t => t.name)).toContain('file-writer');
    });

    test('should search tools by category', async () => {
      const searchTool = metaTools.getMetaTools().tool_search;
      
      const result = await searchTool.execute({
        category: 'utility'
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.map(t => t.name)).toContain('json-parser');
      expect(result.results.map(t => t.name)).toContain('data-validator');
    });

    test('should search tools by tags', async () => {
      const searchTool = metaTools.getMetaTools().tool_search;
      
      const result = await searchTool.execute({
        tags: ['io']
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.map(t => t.name)).toContain('file-reader');
      expect(result.results.map(t => t.name)).toContain('file-writer');
    });

    test('should search tools by description keywords', async () => {
      const searchTool = metaTools.getMetaTools().tool_search;
      
      const result = await searchTool.execute({
        keywords: ['HTTP']
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].name).toBe('http-client');
    });

    test('should perform fuzzy search', async () => {
      const searchTool = metaTools.getMetaTools().tool_search;
      
      const result = await searchTool.execute({
        fuzzyQuery: 'json parse'
      });

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0]).toHaveProperty('score');
    });

    test('should limit search results', async () => {
      const searchTool = metaTools.getMetaTools().tool_search;
      
      const result = await searchTool.execute({
        category: 'file',
        limit: 1
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
    });

    test('should return empty results for no matches', async () => {
      const searchTool = metaTools.getMetaTools().tool_search;
      
      const result = await searchTool.execute({
        category: 'nonexistent'
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
    });
  });

  describe('tool_activate functionality', () => {
    test('should activate a single tool', async () => {
      const activateTool = metaTools.getMetaTools().tool_activate;
      
      const result = await activateTool.execute({
        toolName: 'file-reader'
      });

      expect(result.success).toBe(true);
      expect(result.activated).toContain('file-reader');
      expect(workingSet.isActive('file-reader')).toBe(true);
    });

    test('should activate multiple tools', async () => {
      const activateTool = metaTools.getMetaTools().tool_activate;
      
      const result = await activateTool.execute({
        toolNames: ['file-reader', 'json-parser']
      });

      expect(result.success).toBe(true);
      expect(result.activated).toHaveLength(2);
      expect(workingSet.isActive('file-reader')).toBe(true);
      expect(workingSet.isActive('json-parser')).toBe(true);
    });

    test('should activate tools with priority', async () => {
      const activateTool = metaTools.getMetaTools().tool_activate;
      
      const result = await activateTool.execute({
        toolName: 'file-reader',
        priority: 5
      });

      expect(result.success).toBe(true);
      const priorities = workingSet.getToolPriorities();
      expect(priorities['file-reader']).toBe(5);
    });

    test('should handle non-existent tools', async () => {
      const activateTool = metaTools.getMetaTools().tool_activate;
      
      const result = await activateTool.execute({
        toolName: 'nonexistent-tool'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
    });

    test('should skip already active tools', async () => {
      workingSet.activateTool('file-reader');
      
      const activateTool = metaTools.getMetaTools().tool_activate;
      
      const result = await activateTool.execute({
        toolName: 'file-reader'
      });

      expect(result.success).toBe(true);
      expect(result.skipped).toContain('file-reader');
    });
  });

  describe('tool_deactivate functionality', () => {
    beforeEach(() => {
      workingSet.activateTool('file-reader');
      workingSet.activateTool('json-parser');
    });

    test('should deactivate a single tool', async () => {
      const deactivateTool = metaTools.getMetaTools().tool_deactivate;
      
      const result = await deactivateTool.execute({
        toolName: 'file-reader'
      });

      expect(result.success).toBe(true);
      expect(result.deactivated).toContain('file-reader');
      expect(workingSet.isActive('file-reader')).toBe(false);
    });

    test('should deactivate multiple tools', async () => {
      const deactivateTool = metaTools.getMetaTools().tool_deactivate;
      
      const result = await deactivateTool.execute({
        toolNames: ['file-reader', 'json-parser']
      });

      expect(result.success).toBe(true);
      expect(result.deactivated).toHaveLength(2);
      expect(workingSet.isActive('file-reader')).toBe(false);
      expect(workingSet.isActive('json-parser')).toBe(false);
    });

    test('should skip inactive tools', async () => {
      const deactivateTool = metaTools.getMetaTools().tool_deactivate;
      
      const result = await deactivateTool.execute({
        toolName: 'http-client'
      });

      expect(result.success).toBe(true);
      expect(result.skipped).toContain('http-client');
    });

    test('should deactivate all tools', async () => {
      const deactivateTool = metaTools.getMetaTools().tool_deactivate;
      
      const result = await deactivateTool.execute({
        all: true
      });

      expect(result.success).toBe(true);
      expect(workingSet.getActiveToolCount()).toBe(0);
    });
  });

  describe('tool_suggest functionality', () => {
    beforeEach(() => {
      workingSet.activateTool('file-reader');
      registry.recordUsage('json-parser');
      registry.recordUsage('json-parser');
    });

    test('should suggest tools based on working set', async () => {
      const suggestTool = metaTools.getMetaTools().tool_suggest;
      
      const result = await suggestTool.execute({});

      expect(result.success).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0]).toHaveProperty('name');
      expect(result.suggestions[0]).toHaveProperty('reason');
      expect(result.suggestions[0]).toHaveProperty('score');
    });

    test('should suggest tools by category', async () => {
      const suggestTool = metaTools.getMetaTools().tool_suggest;
      
      const result = await suggestTool.execute({
        category: 'utility'
      });

      expect(result.success).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.every(s => 
        registry.getToolMetadata(s.name)?.category === 'utility'
      )).toBe(true);
    });

    test('should limit suggestion count', async () => {
      const suggestTool = metaTools.getMetaTools().tool_suggest;
      
      const result = await suggestTool.execute({
        limit: 2
      });

      expect(result.success).toBe(true);
      expect(result.suggestions.length).toBeLessThanOrEqual(2);
    });

    test('should include usage-based suggestions', async () => {
      const suggestTool = metaTools.getMetaTools().tool_suggest;
      
      const result = await suggestTool.execute({});

      expect(result.success).toBe(true);
      // Should suggest json-parser due to usage
      expect(result.suggestions.some(s => s.name === 'json-parser')).toBe(true);
    });
  });

  describe('tool_list_active functionality', () => {
    beforeEach(() => {
      workingSet.activateTool('file-reader', { priority: 5 });
      workingSet.activateTool('json-parser', { priority: 3 });
    });

    test('should list active tools', async () => {
      const listTool = metaTools.getMetaTools().tool_list_active;
      
      const result = await listTool.execute({});

      expect(result.success).toBe(true);
      expect(result.activeTools).toHaveLength(2);
      expect(result.activeTools.map(t => t.name)).toContain('file-reader');
      expect(result.activeTools.map(t => t.name)).toContain('json-parser');
    });

    test('should include tool details', async () => {
      const listTool = metaTools.getMetaTools().tool_list_active;
      
      const result = await listTool.execute({
        includeDetails: true
      });

      expect(result.success).toBe(true);
      expect(result.activeTools[0]).toHaveProperty('category');
      expect(result.activeTools[0]).toHaveProperty('tags');
      expect(result.activeTools[0]).toHaveProperty('priority');
    });

    test('should sort by priority', async () => {
      const listTool = metaTools.getMetaTools().tool_list_active;
      
      const result = await listTool.execute({
        sortBy: 'priority'
      });

      expect(result.success).toBe(true);
      expect(result.activeTools[0].name).toBe('file-reader'); // Higher priority
      expect(result.activeTools[1].name).toBe('json-parser'); // Lower priority
    });

    test('should handle empty working set', async () => {
      workingSet.clear();
      
      const listTool = metaTools.getMetaTools().tool_list_active;
      
      const result = await listTool.execute({});

      expect(result.success).toBe(true);
      expect(result.activeTools).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe('tool_info functionality', () => {
    test('should get tool information', async () => {
      const infoTool = metaTools.getMetaTools().tool_info;
      
      const result = await infoTool.execute({
        toolName: 'file-reader'
      });

      expect(result.success).toBe(true);
      expect(result.tool).toHaveProperty('name', 'file-reader');
      expect(result.tool).toHaveProperty('description');
      expect(result.tool).toHaveProperty('category', 'file');
      expect(result.tool).toHaveProperty('tags');
    });

    test('should include usage statistics', async () => {
      registry.recordUsage('file-reader');
      registry.recordUsage('file-reader');
      
      const infoTool = metaTools.getMetaTools().tool_info;
      
      const result = await infoTool.execute({
        toolName: 'file-reader',
        includeUsage: true
      });

      expect(result.success).toBe(true);
      expect(result.tool).toHaveProperty('usage');
      expect(result.tool.usage.count).toBe(2);
    });

    test('should include relationships', async () => {
      registry.addDependency('json-parser', 'file-reader');
      
      const infoTool = metaTools.getMetaTools().tool_info;
      
      const result = await infoTool.execute({
        toolName: 'file-reader',
        includeRelationships: true
      });

      expect(result.success).toBe(true);
      expect(result.tool).toHaveProperty('dependents');
      expect(result.tool.dependents).toContain('json-parser');
    });

    test('should handle non-existent tools', async () => {
      const infoTool = metaTools.getMetaTools().tool_info;
      
      const result = await infoTool.execute({
        toolName: 'nonexistent-tool'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid parameters', async () => {
      const searchTool = metaTools.getMetaTools().tool_search;
      
      const result = await searchTool.execute({});

      // Should handle empty search criteria gracefully
      expect(result.success).toBe(true);
    });

    test('should validate tool activation limits', async () => {
      const limitedWorkingSet = new WorkingSet(registry, { maxSize: 2 });
      const limitedMetaTools = new MetaTools(registry, limitedWorkingSet);
      
      const activateTool = limitedMetaTools.getMetaTools().tool_activate;
      
      // Fill up the working set
      await activateTool.execute({ toolNames: ['file-reader', 'file-writer'] });
      
      // Try to activate another tool
      const result = await activateTool.execute({ toolName: 'http-client' });
      
      expect(result.success).toBe(true);
      expect(limitedWorkingSet.getActiveToolCount()).toBe(2); // Should have evicted one
    });

    test('should handle tool registry sync issues', async () => {
      workingSet.activateTool('file-reader');
      
      // Remove tool from registry
      registry.unregisterTool('file-reader');
      
      const listTool = metaTools.getMetaTools().tool_list_active;
      
      // Should handle missing tools gracefully
      const result = await listTool.execute({});
      
      expect(result.success).toBe(true);
    });
  });

  describe('Integration Features', () => {
    test('should support tool chaining recommendations', async () => {
      // Setup dependencies
      registry.addDependency('json-parser', 'http-client');
      workingSet.activateTool('http-client');
      
      const suggestTool = metaTools.getMetaTools().tool_suggest;
      
      const result = await suggestTool.execute({});
      
      expect(result.success).toBe(true);
      // Should suggest json-parser as it depends on active http-client
      expect(result.suggestions.some(s => s.name === 'json-parser')).toBe(true);
    });

    test('should provide tool statistics', async () => {
      workingSet.activateTool('file-reader');
      workingSet.activateTool('json-parser');
      registry.recordUsage('file-reader');
      
      const listTool = metaTools.getMetaTools().tool_list_active;
      
      const result = await listTool.execute({
        includeStatistics: true
      });

      expect(result.success).toBe(true);
      expect(result.statistics).toHaveProperty('totalActive', 2);
      expect(result.statistics).toHaveProperty('totalUsage', 1);
    });

    test('should support bulk operations', async () => {
      const activateTool = metaTools.getMetaTools().tool_activate;
      
      const result = await activateTool.execute({
        category: 'file' // Activate all file tools
      });

      expect(result.success).toBe(true);
      expect(result.activated.length).toBeGreaterThan(1);
      expect(workingSet.isActive('file-reader')).toBe(true);
      expect(workingSet.isActive('file-writer')).toBe(true);
    });
  });
});