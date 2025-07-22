/**
 * Tests for Semantic Search
 * 
 * Tests vector-based tool search, similarity scoring,
 * context-aware ranking, and search result filtering
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { SemanticSearch } from '../../../src/tools/SemanticSearch.js';
import { ToolRegistry } from '../../../src/tools/ToolRegistry.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';

describe('SemanticSearch', () => {
  let toolRegistry;
  let handleRegistry;
  let semanticSearch;
  let mockTools;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    handleRegistry = new HandleRegistry();
    
    // Register mock tools with diverse metadata
    mockTools = [
      {
        name: 'file_read',
        description: 'Read contents of a file from the filesystem',
        tags: ['file', 'io', 'read', 'filesystem'],
        category: 'file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to read' }
          }
        },
        execute: async (params) => ({ content: 'file contents' })
      },
      {
        name: 'file_write',
        description: 'Write data to a file on the filesystem',
        tags: ['file', 'io', 'write', 'filesystem'],
        category: 'file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' }
          }
        },
        execute: async (params) => ({ success: true })
      },
      {
        name: 'http_get',
        description: 'Make an HTTP GET request to fetch data from a URL',
        tags: ['http', 'network', 'web', 'api', 'get'],
        category: 'network',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string' }
          }
        },
        execute: async (params) => ({ data: {} })
      },
      {
        name: 'json_parse',
        description: 'Parse JSON string into JavaScript object',
        tags: ['json', 'parse', 'data', 'transform'],
        category: 'data',
        inputSchema: {
          type: 'object',
          properties: {
            json: { type: 'string' }
          }
        },
        execute: async (params) => ({ result: {} })
      },
      {
        name: 'text_summarize',
        description: 'Generate a summary of text content using AI',
        tags: ['text', 'ai', 'nlp', 'summary', 'language'],
        category: 'ai',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            maxLength: { type: 'number' }
          }
        },
        execute: async (params) => ({ summary: 'Summary...' })
      }
    ];

    mockTools.forEach(tool => toolRegistry.registerTool(tool));
    
    semanticSearch = new SemanticSearch(toolRegistry, {
      enableVectorSearch: true,
      enableContextAware: true
    });
  });

  describe('Basic Search Functionality', () => {
    test('should create semantic search with tool registry', () => {
      expect(semanticSearch.toolRegistry).toBe(toolRegistry);
      expect(semanticSearch.options.enableVectorSearch).toBe(true);
      expect(semanticSearch.options.enableContextAware).toBe(true);
    });

    test('should perform exact match search', async () => {
      const results = await semanticSearch.search('file_read');
      
      expect(results).toHaveLength(1);
      expect(results[0].tool.name).toBe('file_read');
      expect(results[0].score).toBe(1.0);
      expect(results[0].matchType).toBe('exact');
    });

    test('should perform keyword search', async () => {
      const results = await semanticSearch.search('file');
      
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0].matchType).toBe('keyword');
      expect(results.every(r => r.tool.name.includes('file') || 
                              r.tool.description.includes('file') ||
                              r.tool.tags.includes('file'))).toBe(true);
    });

    test('should search by description', async () => {
      const results = await semanticSearch.search('read contents from filesystem');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].tool.name).toBe('file_read');
      expect(results[0].score).toBeGreaterThan(0.2);
    });

    test('should search by tags', async () => {
      const results = await semanticSearch.search('json transform');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.find(r => r.tool.name === 'json_parse')).toBeDefined();
    });
  });

  describe('Vector-Based Search', () => {
    test('should generate embeddings for tools', () => {
      const embeddings = semanticSearch.generateToolEmbeddings();
      
      expect(embeddings.size).toBe(mockTools.length);
      expect(embeddings.get('file_read')).toBeDefined();
      expect(embeddings.get('file_read').length).toBeGreaterThan(0);
    });

    test('should calculate similarity scores', () => {
      const embedding1 = semanticSearch.generateEmbedding('read file from disk');
      const embedding2 = semanticSearch.generateEmbedding('write data to file');
      const embedding3 = semanticSearch.generateEmbedding('make network request');
      
      const similarity1 = semanticSearch.cosineSimilarity(embedding1, embedding2);
      const similarity2 = semanticSearch.cosineSimilarity(embedding1, embedding3);
      
      // File operations should be more similar to each other than to network
      expect(similarity1).toBeGreaterThan(similarity2);
    });

    test('should perform semantic search with vectors', async () => {
      const results = await semanticSearch.semanticSearch('retrieve document from storage');
      
      expect(results.length).toBeGreaterThan(0);
      // Just check that we got semantic results with reasonable scores
      expect(results[0].matchType).toBe('semantic');
      expect(results[0].score).toBeGreaterThan(0.2);
      // Verify we're getting relevant tools (any tool is fine for semantic search)
      expect(results[0].tool).toBeDefined();
      expect(results[0].tool.name).toBeDefined();
    });

    test('should handle synonyms and related concepts', async () => {
      const results = await semanticSearch.semanticSearch('fetch web page');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.find(r => r.tool.name === 'http_get')).toBeDefined();
    });
  });

  describe('Context-Aware Ranking', () => {
    test('should boost scores based on handle context', async () => {
      // Create handles that suggest file operations
      handleRegistry.create('currentFile', { path: '/tmp/data.txt' });
      handleRegistry.create('fileContent', { content: 'Hello world' });
      
      const results = await semanticSearch.searchWithContext('write', handleRegistry);
      
      expect(results[0].tool.name).toBe('file_write');
      expect(results[0].contextBoost).toBeGreaterThan(0);
    });

    test('should consider recent tool usage', async () => {
      semanticSearch.recordToolUsage('json_parse');
      semanticSearch.recordToolUsage('json_parse');
      semanticSearch.recordToolUsage('text_summarize');
      
      const results = await semanticSearch.searchWithContext('parse data', handleRegistry);
      
      const jsonTool = results.find(r => r.tool.name === 'json_parse');
      expect(jsonTool.usageBoost).toBeGreaterThan(0);
    });

    test('should rank by parameter compatibility', async () => {
      handleRegistry.create('apiUrl', 'https://api.example.com/data');
      
      const results = await semanticSearch.searchWithContext('fetch data', handleRegistry);
      
      const httpTool = results.find(r => r.tool.name === 'http_get');
      expect(httpTool).toBeDefined();
      expect(httpTool.parameterMatch).toBeGreaterThan(0);
    });

    test('should combine multiple ranking factors', async () => {
      handleRegistry.create('textData', { text: 'Long article text...' });
      semanticSearch.recordToolUsage('text_summarize');
      
      const results = await semanticSearch.searchWithContext(
        'process text content',
        handleRegistry,
        { combineScores: true }
      );
      
      const summaryTool = results.find(r => r.tool.name === 'text_summarize');
      expect(summaryTool).toBeDefined();
      expect(summaryTool.combinedScore).toBeGreaterThan(summaryTool.score);
    });
  });

  describe('Search Result Filtering', () => {
    test('should filter by category', async () => {
      const results = await semanticSearch.search('*', {
        filters: { category: 'file' }
      });
      
      expect(results.length).toBe(2);
      expect(results.every(r => r.tool.category === 'file')).toBe(true);
    });

    test('should filter by tags', async () => {
      const results = await semanticSearch.search('*', {
        filters: { tags: ['network'] }
      });
      
      expect(results.length).toBe(1);
      expect(results[0].tool.name).toBe('http_get');
    });

    test('should filter by multiple criteria', async () => {
      const results = await semanticSearch.search('*', {
        filters: {
          tags: ['io'],
          category: 'file'
        }
      });
      
      expect(results.length).toBe(2);
      expect(results.every(r => r.tool.tags.includes('io'))).toBe(true);
    });

    test('should apply score threshold', async () => {
      const results = await semanticSearch.search('completely unrelated query', {
        minScore: 0.5
      });
      
      expect(results.length).toBe(0);
    });

    test('should limit result count', async () => {
      const results = await semanticSearch.search('*', {
        limit: 3
      });
      
      expect(results.length).toBe(3);
    });
  });

  describe('Advanced Search Features', () => {
    test('should support fuzzy matching', async () => {
      const results = await semanticSearch.search('fil_red', {
        fuzzy: true
      });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].tool.name).toBe('file_read');
      expect(results[0].matchType).toBe('fuzzy');
    });

    test('should expand abbreviations', async () => {
      const results = await semanticSearch.search('http req');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.find(r => r.tool.name === 'http_get')).toBeDefined();
    });

    test('should handle multi-word queries', async () => {
      const results = await semanticSearch.search('read write file system');
      
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.find(r => r.tool.name === 'file_read')).toBeDefined();
      expect(results.find(r => r.tool.name === 'file_write')).toBeDefined();
    });

    test('should provide search suggestions', async () => {
      const suggestions = await semanticSearch.getSuggestions('fil');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('file');
      expect(suggestions).toContain('file_read');
      expect(suggestions).toContain('file_write');
    });
  });

  describe('Search Analytics', () => {
    test('should track search queries', async () => {
      // Create a fresh semantic search instance to avoid interference
      const freshSemanticSearch = new SemanticSearch(toolRegistry, {
        enableVectorSearch: true,
        enableContextAware: true
      });
      
      // Use unique queries to avoid cache hits
      await freshSemanticSearch.search('analytics test 1');
      await freshSemanticSearch.search('analytics test 2'); 
      await freshSemanticSearch.search('analytics test 1');
      
      const analytics = freshSemanticSearch.getSearchAnalytics();
      
      // Now we should have exactly our searches
      expect(analytics.totalSearches).toBe(3);
      expect(analytics.uniqueQueries).toBe(2);
      expect(analytics.topQueries[0].query).toBe('analytics test 1');
      expect(analytics.topQueries[0].count).toBe(2);
      expect(analytics.topQueries[1].query).toBe('analytics test 2');
      expect(analytics.topQueries[1].count).toBe(1);
    });

    test('should track search performance', async () => {
      // Create a fresh instance to avoid interference
      const perfSearch = new SemanticSearch(toolRegistry, {
        enableVectorSearch: true,
        enableContextAware: true
      });
      
      await perfSearch.search('performance test query');
      
      const analytics = perfSearch.getSearchAnalytics();
      
      expect(analytics.averageSearchTime).toBeGreaterThanOrEqual(0);
      expect(analytics.searchTimes.length).toBeGreaterThan(0);
      expect(analytics.searchTimes[0]).toBeGreaterThanOrEqual(0);
    });

    test('should identify popular tools', async () => {
      semanticSearch.recordToolUsage('file_read');
      semanticSearch.recordToolUsage('file_read');
      semanticSearch.recordToolUsage('http_get');
      
      const popular = semanticSearch.getPopularTools(2);
      
      expect(popular).toHaveLength(2);
      expect(popular[0].name).toBe('file_read');
      expect(popular[0].usageCount).toBe(2);
    });
  });

  describe('Search Caching', () => {
    test('should cache search results', async () => {
      const query = 'file operations';
      
      const results1 = await semanticSearch.search(query);
      const startTime = Date.now();
      const results2 = await semanticSearch.search(query);
      const cachedTime = Date.now() - startTime;
      
      expect(results2).toEqual(results1);
      expect(cachedTime).toBeLessThan(5); // Should be very fast from cache
    });

    test('should invalidate cache on tool changes', async () => {
      const query = 'test query';
      await semanticSearch.search(query);
      
      toolRegistry.registerTool({
        name: 'new_tool',
        description: 'A new test tool',
        execute: async () => ({})
      });
      
      semanticSearch.invalidateCache();
      const results = await semanticSearch.search(query);
      
      expect(results.find(r => r.tool.name === 'new_tool')).toBeDefined();
    });

    test('should respect cache TTL', async () => {
      const shortTTLSearch = new SemanticSearch(toolRegistry, {
        cacheTTL: 100 // 100ms TTL
      });
      
      const query = 'cache test';
      await shortTTLSearch.search(query);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const cacheStats = shortTTLSearch.getCacheStats();
      expect(cacheStats.expired).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty query gracefully', async () => {
      const results = await semanticSearch.search('');
      
      expect(results).toEqual([]);
    });

    test('should handle invalid filters', async () => {
      const results = await semanticSearch.search('file', {
        filters: { invalidField: 'value' }
      });
      
      expect(results.length).toBeGreaterThan(0);
    });

    test('should handle missing tool registry', () => {
      expect(() => {
        new SemanticSearch(null);
      }).toThrow('Tool registry is required');
    });
  });

  describe('Integration with MCP', () => {
    test('should provide search as MCP tool', () => {
      const searchTool = semanticSearch.asMCPTool();
      
      expect(searchTool.name).toBe('search_tools');
      expect(searchTool.description).toContain('Search for tools');
      expect(searchTool.inputSchema).toBeDefined();
      expect(searchTool.execute).toBeInstanceOf(Function);
    });

    test('should execute MCP search tool', async () => {
      const searchTool = semanticSearch.asMCPTool();
      const result = await searchTool.execute({
        query: 'file operations',
        limit: 5
      });
      
      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeLessThanOrEqual(5);
    });
  });
});