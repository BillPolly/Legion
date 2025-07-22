/**
 * Tests for ToolRegistry class
 * 
 * Tests tool indexing, metadata storage, search, and relationship tracking
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ToolRegistry } from '../../../src/tools/ToolRegistry.js';

describe('ToolRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('Tool Registration', () => {
    test('should register a tool with metadata', () => {
      const tool = {
        name: 'test-tool',
        description: 'A test tool',
        category: 'utility',
        tags: ['test', 'utility'],
        execute: async () => ({ success: true })
      };

      registry.registerTool(tool);

      expect(registry.hasTool('test-tool')).toBe(true);
      expect(registry.getToolCount()).toBe(1);
    });

    test('should auto-generate metadata for basic tools', () => {
      const basicTool = {
        name: 'basic-tool',
        execute: async () => ({ result: 'basic' })
      };

      registry.registerTool(basicTool);

      const metadata = registry.getToolMetadata('basic-tool');
      expect(metadata).toBeDefined();
      expect(metadata.category).toBe('general');
      expect(metadata.tags).toEqual([]);
      expect(metadata.registeredAt).toBeInstanceOf(Date);
    });

    test('should prevent duplicate tool registration', () => {
      const tool1 = { name: 'duplicate', execute: async () => ({ version: 1 }) };
      const tool2 = { name: 'duplicate', execute: async () => ({ version: 2 }) };

      registry.registerTool(tool1);
      
      expect(() => {
        registry.registerTool(tool2);
      }).toThrow('Tool already registered: duplicate');
    });

    test('should allow overwriting with force flag', () => {
      const tool1 = { name: 'overwrite', execute: async () => ({ version: 1 }) };
      const tool2 = { name: 'overwrite', execute: async () => ({ version: 2 }) };

      registry.registerTool(tool1);
      registry.registerTool(tool2, { force: true });

      const tool = registry.getTool('overwrite');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('overwrite');
    });

    test('should register multiple tools at once', () => {
      const tools = [
        { name: 'batch1', execute: async () => ({ result: 1 }) },
        { name: 'batch2', execute: async () => ({ result: 2 }) },
        { name: 'batch3', execute: async () => ({ result: 3 }) }
      ];

      registry.registerTools(tools);

      expect(registry.getToolCount()).toBe(3);
      expect(registry.hasTool('batch1')).toBe(true);
      expect(registry.hasTool('batch2')).toBe(true);
      expect(registry.hasTool('batch3')).toBe(true);
    });
  });

  describe('Tool Retrieval', () => {
    beforeEach(() => {
      const tools = [
        {
          name: 'file-reader',
          description: 'Read files from disk',
          category: 'file',
          tags: ['io', 'read', 'file'],
          execute: async () => ({ content: 'file data' })
        },
        {
          name: 'http-client',
          description: 'Make HTTP requests',
          category: 'network',
          tags: ['http', 'web', 'client'],
          execute: async () => ({ status: 200 })
        },
        {
          name: 'json-parser',
          description: 'Parse JSON strings',
          category: 'utility',
          tags: ['json', 'parse', 'utility'],
          execute: async () => ({ parsed: true })
        }
      ];

      registry.registerTools(tools);
    });

    test('should retrieve tool by name', () => {
      const tool = registry.getTool('file-reader');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('file-reader');
    });

    test('should return null for non-existent tool', () => {
      const tool = registry.getTool('non-existent');
      expect(tool).toBeNull();
    });

    test('should get all tools', () => {
      const tools = registry.getAllTools();
      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.name)).toContain('file-reader');
      expect(tools.map(t => t.name)).toContain('http-client');
      expect(tools.map(t => t.name)).toContain('json-parser');
    });

    test('should get tool names', () => {
      const names = registry.getToolNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('file-reader');
      expect(names).toContain('http-client');
      expect(names).toContain('json-parser');
    });

    test('should get tools by category', () => {
      const fileTools = registry.getToolsByCategory('file');
      expect(fileTools).toHaveLength(1);
      expect(fileTools[0].name).toBe('file-reader');

      const networkTools = registry.getToolsByCategory('network');
      expect(networkTools).toHaveLength(1);
      expect(networkTools[0].name).toBe('http-client');

      const unknownTools = registry.getToolsByCategory('unknown');
      expect(unknownTools).toHaveLength(0);
    });

    test('should get tools by tags', () => {
      const ioTools = registry.getToolsByTags(['io']);
      expect(ioTools).toHaveLength(1);
      expect(ioTools[0].name).toBe('file-reader');

      const webTools = registry.getToolsByTags(['web']);
      expect(webTools).toHaveLength(1);
      expect(webTools[0].name).toBe('http-client');

      const utilityTools = registry.getToolsByTags(['utility']);
      expect(utilityTools).toHaveLength(1);
      expect(utilityTools[0].name).toBe('json-parser');
    });
  });

  describe('Tool Search', () => {
    beforeEach(() => {
      const tools = [
        {
          name: 'file-reader',
          description: 'Read text files from the filesystem',
          category: 'file',
          tags: ['io', 'read', 'file', 'text'],
          execute: async () => ({ content: 'data' })
        },
        {
          name: 'file-writer',
          description: 'Write content to files on disk',
          category: 'file',
          tags: ['io', 'write', 'file'],
          execute: async () => ({ written: true })
        },
        {
          name: 'web-scraper',
          description: 'Extract data from web pages',
          category: 'web',
          tags: ['web', 'scrape', 'extract', 'http'],
          execute: async () => ({ data: [] })
        },
        {
          name: 'data-analyzer',
          description: 'Analyze and process data sets',
          category: 'analysis',
          tags: ['data', 'analyze', 'process'],
          execute: async () => ({ analysis: {} })
        }
      ];

      registry.registerTools(tools);
    });

    test('should search by name pattern', () => {
      const results = registry.searchTools({ namePattern: /^file-/ });
      expect(results).toHaveLength(2);
      expect(results.map(t => t.name)).toContain('file-reader');
      expect(results.map(t => t.name)).toContain('file-writer');
    });

    test('should search by description keywords', () => {
      const results = registry.searchTools({ descriptionKeywords: ['web'] });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('web-scraper');

      const dataResults = registry.searchTools({ descriptionKeywords: ['data'] });
      expect(dataResults).toHaveLength(2);
      expect(dataResults.map(t => t.name)).toContain('web-scraper');
      expect(dataResults.map(t => t.name)).toContain('data-analyzer');
    });

    test('should search by category', () => {
      const fileResults = registry.searchTools({ category: 'file' });
      expect(fileResults).toHaveLength(2);

      const webResults = registry.searchTools({ category: 'web' });
      expect(webResults).toHaveLength(1);
      expect(webResults[0].name).toBe('web-scraper');
    });

    test('should search by tags', () => {
      const ioResults = registry.searchTools({ tags: ['io'] });
      expect(ioResults).toHaveLength(2);
      expect(ioResults.map(t => t.name)).toContain('file-reader');
      expect(ioResults.map(t => t.name)).toContain('file-writer');

      const httpResults = registry.searchTools({ tags: ['http'] });
      expect(httpResults).toHaveLength(1);
      expect(httpResults[0].name).toBe('web-scraper');
    });

    test('should combine search criteria', () => {
      const results = registry.searchTools({
        category: 'file',
        tags: ['write']
      });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('file-writer');
    });

    test('should return empty array for no matches', () => {
      const results = registry.searchTools({ category: 'unknown' });
      expect(results).toHaveLength(0);
    });

    test('should perform fuzzy search on tool names', () => {
      const results = registry.fuzzySearchTools('file');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.tool.name.includes('file'))).toBe(true);
    });

    test('should rank fuzzy search results by relevance', () => {
      const results = registry.fuzzySearchTools('file read');
      expect(results).toHaveLength(4); // All tools should have some score
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    });
  });

  describe('Tool Metadata Management', () => {
    test('should store and retrieve tool metadata', () => {
      const tool = {
        name: 'meta-tool',
        description: 'Tool with metadata',
        category: 'test',
        tags: ['meta', 'test'],
        author: 'Test Author',
        version: '1.0.0',
        execute: async () => ({ success: true })
      };

      registry.registerTool(tool);

      const metadata = registry.getToolMetadata('meta-tool');
      expect(metadata.author).toBe('Test Author');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.category).toBe('test');
      expect(metadata.tags).toContain('meta');
    });

    test('should update tool metadata', () => {
      const tool = { name: 'update-meta', execute: async () => ({}) };
      registry.registerTool(tool);

      registry.updateToolMetadata('update-meta', {
        description: 'Updated description',
        tags: ['updated'],
        version: '2.0.0'
      });

      const metadata = registry.getToolMetadata('update-meta');
      expect(metadata.description).toBe('Updated description');
      expect(metadata.tags).toContain('updated');
      expect(metadata.version).toBe('2.0.0');
    });

    test('should get all categories', () => {
      const tools = [
        { name: 'tool1', category: 'file', execute: async () => ({}) },
        { name: 'tool2', category: 'network', execute: async () => ({}) },
        { name: 'tool3', category: 'file', execute: async () => ({}) }
      ];

      registry.registerTools(tools);

      const categories = registry.getAllCategories();
      expect(categories).toContain('file');
      expect(categories).toContain('network');
      expect(categories.length).toBe(2);
    });

    test('should get all tags', () => {
      const tools = [
        { name: 'tool1', tags: ['io', 'file'], execute: async () => ({}) },
        { name: 'tool2', tags: ['web', 'http'], execute: async () => ({}) },
        { name: 'tool3', tags: ['file', 'text'], execute: async () => ({}) }
      ];

      registry.registerTools(tools);

      const tags = registry.getAllTags();
      expect(tags).toContain('io');
      expect(tags).toContain('file');
      expect(tags).toContain('web');
      expect(tags).toContain('http');
      expect(tags).toContain('text');
    });
  });

  describe('Tool Relationships', () => {
    beforeEach(() => {
      const tools = [
        { name: 'file-reader', execute: async () => ({}) },
        { name: 'file-writer', execute: async () => ({}) },
        { name: 'data-processor', execute: async () => ({}) },
        { name: 'report-generator', execute: async () => ({}) }
      ];

      registry.registerTools(tools);
    });

    test('should define tool dependencies', () => {
      registry.addDependency('report-generator', 'data-processor');
      registry.addDependency('data-processor', 'file-reader');

      const deps = registry.getDependencies('report-generator');
      expect(deps).toContain('data-processor');

      const processorDeps = registry.getDependencies('data-processor');
      expect(processorDeps).toContain('file-reader');
    });

    test('should get tool dependents', () => {
      registry.addDependency('report-generator', 'data-processor');
      registry.addDependency('data-processor', 'file-reader');

      const dependents = registry.getDependents('file-reader');
      expect(dependents).toContain('data-processor');

      const processorDependents = registry.getDependents('data-processor');
      expect(processorDependents).toContain('report-generator');
    });

    test('should detect circular dependencies', () => {
      registry.addDependency('tool-a', 'tool-b');
      registry.addDependency('tool-b', 'tool-c');

      expect(() => {
        registry.addDependency('tool-c', 'tool-a');
      }).toThrow('Circular dependency detected');
    });

    test('should create tool groups', () => {
      registry.createGroup('file-operations', ['file-reader', 'file-writer']);
      registry.createGroup('data-pipeline', ['data-processor', 'report-generator']);

      const fileGroup = registry.getGroup('file-operations');
      expect(fileGroup).toContain('file-reader');
      expect(fileGroup).toContain('file-writer');

      const groups = registry.getAllGroups();
      expect(groups).toHaveProperty('file-operations');
      expect(groups).toHaveProperty('data-pipeline');
    });

    test('should suggest related tools', () => {
      // Add metadata to make relationships detectable
      registry.updateToolMetadata('file-reader', { tags: ['file', 'io'] });
      registry.updateToolMetadata('file-writer', { tags: ['file', 'io'] });
      registry.updateToolMetadata('data-processor', { tags: ['data', 'process'] });

      const suggestions = registry.getSuggestedTools('file-reader');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.name === 'file-writer')).toBe(true);
    });
  });

  describe('Tool Statistics', () => {
    beforeEach(() => {
      const tools = [
        { name: 'popular-tool', category: 'utility', execute: async () => ({}) },
        { name: 'unused-tool', category: 'utility', execute: async () => ({}) },
        { name: 'file-tool', category: 'file', execute: async () => ({}) }
      ];

      registry.registerTools(tools);

      // Simulate usage
      registry.recordUsage('popular-tool');
      registry.recordUsage('popular-tool');
      registry.recordUsage('popular-tool');
      registry.recordUsage('file-tool');
    });

    test('should track tool usage', () => {
      const usage = registry.getToolUsage('popular-tool');
      expect(usage.count).toBe(3);
      expect(usage.lastUsed).toBeInstanceOf(Date);

      const unusedUsage = registry.getToolUsage('unused-tool');
      expect(unusedUsage.count).toBe(0);
      expect(unusedUsage.lastUsed).toBeNull();
    });

    test('should get usage statistics', () => {
      const stats = registry.getUsageStatistics();
      expect(stats.totalUsage).toBe(4);
      expect(stats.mostUsed[0].tool).toBe('popular-tool');
      expect(stats.mostUsed[0].count).toBe(3);
    });

    test('should get registry statistics', () => {
      const stats = registry.getStatistics();
      expect(stats.totalTools).toBe(3);
      expect(stats.categoryCounts.utility).toBe(2);
      expect(stats.categoryCounts.file).toBe(1);
      expect(stats.totalUsage).toBe(4);
    });
  });

  describe('Tool Validation', () => {
    test('should validate tool structure', () => {
      const invalidTool = {
        description: 'Missing name and execute'
      };

      expect(() => {
        registry.registerTool(invalidTool);
      }).toThrow('Tool must have name and execute function');
    });

    test('should validate tool name format', () => {
      const invalidNameTool = {
        name: 'Invalid Name!',
        execute: async () => ({})
      };

      expect(() => {
        registry.registerTool(invalidNameTool);
      }).toThrow('Tool name must contain only letters, numbers, hyphens, and underscores');
    });

    test('should validate tool categories', () => {
      const registry = new ToolRegistry({
        allowedCategories: ['file', 'network', 'utility']
      });

      const invalidCategoryTool = {
        name: 'invalid-cat',
        category: 'invalid-category',
        execute: async () => ({})
      };

      expect(() => {
        registry.registerTool(invalidCategoryTool);
      }).toThrow('Invalid category: invalid-category');
    });

    test('should run compatibility checks', () => {
      const tool = {
        name: 'compat-test',
        execute: async () => ({ success: true })
      };

      const compatibility = registry.checkCompatibility(tool);
      expect(compatibility.compatible).toBe(true);
      expect(compatibility.issues).toHaveLength(0);
    });
  });

  describe('Tool Management', () => {
    test('should unregister tools', () => {
      const tool = { name: 'temp-tool', execute: async () => ({}) };
      registry.registerTool(tool);

      expect(registry.hasTool('temp-tool')).toBe(true);

      const unregistered = registry.unregisterTool('temp-tool');
      expect(unregistered).toBe(true);
      expect(registry.hasTool('temp-tool')).toBe(false);
    });

    test('should clear all tools', () => {
      const tools = [
        { name: 'tool1', execute: async () => ({}) },
        { name: 'tool2', execute: async () => ({}) }
      ];

      registry.registerTools(tools);
      expect(registry.getToolCount()).toBe(2);

      registry.clear();
      expect(registry.getToolCount()).toBe(0);
      expect(registry.getToolNames()).toHaveLength(0);
    });

    test('should clone registry', () => {
      const tools = [
        { name: 'tool1', execute: async () => ({}) },
        { name: 'tool2', execute: async () => ({}) }
      ];

      registry.registerTools(tools);

      const cloned = registry.clone();
      expect(cloned.getToolCount()).toBe(2);
      expect(cloned.hasTool('tool1')).toBe(true);
      expect(cloned.hasTool('tool2')).toBe(true);
    });

    test('should merge registries', () => {
      const tools1 = [
        { name: 'tool1', execute: async () => ({}) },
        { name: 'tool2', execute: async () => ({}) }
      ];

      const tools2 = [
        { name: 'tool3', execute: async () => ({}) },
        { name: 'tool4', execute: async () => ({}) }
      ];

      registry.registerTools(tools1);

      const otherRegistry = new ToolRegistry();
      otherRegistry.registerTools(tools2);

      registry.merge(otherRegistry);

      expect(registry.getToolCount()).toBe(4);
      expect(registry.hasTool('tool1')).toBe(true);
      expect(registry.hasTool('tool3')).toBe(true);
    });
  });

  describe('Import/Export', () => {
    test('should export registry data', () => {
      const tools = [
        { name: 'tool1', category: 'test', execute: async () => ({}) },
        { name: 'tool2', category: 'test', execute: async () => ({}) }
      ];

      registry.registerTools(tools);
      registry.recordUsage('tool1');

      const exported = registry.export();
      expect(exported.tools).toHaveLength(2);
      expect(exported.metadata).toHaveProperty('tool1');
      expect(exported.usage).toHaveProperty('tool1');
      expect(exported.exportedAt).toBeDefined();
    });

    test('should import registry data', () => {
      const exportedData = {
        tools: [
          { name: 'imported1', execute: async () => ({}) },
          { name: 'imported2', execute: async () => ({}) }
        ],
        metadata: {
          imported1: { category: 'imported' },
          imported2: { category: 'imported' }
        },
        usage: {
          imported1: { count: 5, lastUsed: new Date() }
        }
      };

      registry.import(exportedData);

      expect(registry.getToolCount()).toBe(2);
      expect(registry.hasTool('imported1')).toBe(true);
      expect(registry.getToolUsage('imported1').count).toBe(5);
    });
  });
});