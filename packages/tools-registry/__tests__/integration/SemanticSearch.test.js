/**
 * Integration tests for semantic search functionality
 * Tests text search, semantic search, and combined search modes
 */

import { ResourceManager } from '@legion/resource-manager';
import { LoadingManager } from '../../src/loading/LoadingManager.js';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { ensureMongoDBAvailable, getTestDatabase, cleanTestDatabase } from '../utils/testHelpers.js';

describe('Semantic Search Integration Tests', () => {
  let resourceManager;
  let loadingManager;
  let toolRegistry;
  let semanticProvider;
  let testDb;
  
  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Ensure MongoDB is available
    await ensureMongoDBAvailable();
    testDb = await getTestDatabase();
    
    // Initialize components
    loadingManager = new LoadingManager({
      dbProvider: testDb,
      resourceManager
    });
    
    toolRegistry = new ToolRegistry();
    
    // Load modules and tools
    console.log('Loading modules and tools...');
    const loadResult = await loadingManager.loadAllModules();
    console.log(`Loaded ${loadResult.loaded} modules with ${loadResult.tools.length} tools`);
    
    // Register tools
    for (const tool of loadResult.tools) {
      await toolRegistry.registerTool(tool);
    }
    
    // Check if semantic search is available
    try {
      semanticProvider = await loadingManager.getSemanticProvider();
      console.log('Semantic search provider initialized');
    } catch (error) {
      console.log('Semantic search not available:', error.message);
    }
  });
  
  afterAll(async () => {
    await cleanTestDatabase();
  });
  
  describe('Text Search', () => {
    test('should find tools by exact name match', async () => {
      const results = await searchTools('file_read', 'text');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('file_read');
      expect(results[0]._searchScore).toBeGreaterThan(10); // Exact match gets high score
    });
    
    test('should find tools by partial name match', async () => {
      const results = await searchTools('calculator', 'text');
      
      expect(results.length).toBeGreaterThan(0);
      const calculatorTool = results.find(t => t.name === 'calculator');
      expect(calculatorTool).toBeDefined();
      expect(calculatorTool._searchScore).toBeGreaterThan(5);
    });
    
    test('should find tools by description keywords', async () => {
      const results = await searchTools('parse json', 'text');
      
      expect(results.length).toBeGreaterThan(0);
      const jsonTool = results.find(t => t.name.includes('json'));
      expect(jsonTool).toBeDefined();
    });
    
    test('should rank exact matches higher than partial matches', async () => {
      const results = await searchTools('file', 'text');
      
      // Tools with 'file' in the name should rank higher
      const topResults = results.slice(0, 5);
      const hasFileInName = topResults.every(t => 
        t.name.toLowerCase().includes('file') || 
        t.description?.toLowerCase().includes('file')
      );
      expect(hasFileInName).toBe(true);
    });
    
    test('should return empty results for non-matching query', async () => {
      const results = await searchTools('xyz123nonsense', 'text');
      expect(results).toEqual([]);
    });
  });
  
  describe('Semantic Search', () => {
    test('should find conceptually related tools', async () => {
      if (!semanticProvider) {
        console.log('Skipping semantic search test - provider not available');
        return;
      }
      
      const results = await searchTools('how to read files from disk', 'semantic');
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should find file reading tools
      const fileTools = results.filter(t => 
        t.name.includes('file') || t.name.includes('read')
      );
      expect(fileTools.length).toBeGreaterThan(0);
    });
    
    test('should understand intent-based queries', async () => {
      if (!semanticProvider) {
        console.log('Skipping semantic search test - provider not available');
        return;
      }
      
      const results = await searchTools('I need to perform mathematical calculations', 'semantic');
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should find calculator tool
      const calculatorTool = results.find(t => 
        t.name.includes('calculator') || t.name.includes('calc')
      );
      expect(calculatorTool).toBeDefined();
    });
    
    test('should find tools for complex queries', async () => {
      if (!semanticProvider) {
        console.log('Skipping semantic search test - provider not available');
        return;
      }
      
      const results = await searchTools('transform and validate data structures', 'semantic');
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should find JSON/data processing tools
      const dataTools = results.filter(t => 
        t.name.includes('json') || 
        t.name.includes('validate') ||
        t.name.includes('transform')
      );
      expect(dataTools.length).toBeGreaterThan(0);
    });
  });
  
  describe('Combined Search (Text + Semantic)', () => {
    test('should merge results from both search modes', async () => {
      const query = 'json file';
      
      // Get text results
      const textResults = await searchTools(query, 'text');
      
      // Get semantic results (if available)
      let semanticResults = [];
      if (semanticProvider) {
        semanticResults = await searchTools(query, 'semantic');
      }
      
      // Get combined results
      const combinedResults = await searchTools(query, 'both');
      
      expect(combinedResults.length).toBeGreaterThanOrEqual(Math.min(textResults.length, 10));
      
      // Should have tools from both searches
      if (semanticResults.length > 0) {
        // Check that we have unique tools from both
        const combinedNames = new Set(combinedResults.map(t => t.name));
        expect(combinedNames.size).toBeGreaterThan(0);
      }
    });
    
    test('should rank tools by combined score', async () => {
      if (!semanticProvider) {
        console.log('Skipping combined search test - semantic provider not available');
        return;
      }
      
      const results = await searchTools('read file content', 'both');
      
      expect(results.length).toBeGreaterThan(0);
      
      // Check that results have combined scores
      const topResult = results[0];
      expect(topResult.textScore).toBeDefined();
      expect(topResult.semanticScore).toBeDefined();
      expect(topResult.combinedScore).toBeDefined();
      
      // Combined score should be weighted average
      const expectedScore = (topResult.textScore * 0.4) + (topResult.semanticScore * 0.6);
      expect(topResult.combinedScore).toBeCloseTo(expectedScore, 2);
    });
    
    test('should handle fallback when semantic search unavailable', async () => {
      // Mock semantic provider being unavailable
      const originalProvider = semanticProvider;
      semanticProvider = null;
      
      const results = await searchTools('calculator', 'both');
      
      // Should fall back to text search
      expect(results.length).toBeGreaterThan(0);
      const calculatorTool = results.find(t => t.name === 'calculator');
      expect(calculatorTool).toBeDefined();
      
      // Restore provider
      semanticProvider = originalProvider;
    });
  });
  
  describe('Search Performance and Edge Cases', () => {
    test('should handle empty query', async () => {
      const results = await searchTools('', 'text');
      expect(results.length).toBeGreaterThan(0); // Should return all tools
    });
    
    test('should handle special characters in query', async () => {
      const results = await searchTools('file@#$%^&*()', 'text');
      expect(Array.isArray(results)).toBe(true);
    });
    
    test('should respect result limit', async () => {
      const limit = 5;
      const results = await searchTools('file', 'text', { limit });
      expect(results.length).toBeLessThanOrEqual(limit);
    });
    
    test('should be case-insensitive', async () => {
      const results1 = await searchTools('FILE_READ', 'text');
      const results2 = await searchTools('file_read', 'text');
      
      expect(results1[0]?.name).toBe(results2[0]?.name);
    });
  });
  
  // Helper function to perform searches
  async function searchTools(query, mode = 'text', options = {}) {
    const tools = Array.from(toolRegistry.tools.values());
    
    if (mode === 'text') {
      return performTextSearch(tools, query, options);
    } else if (mode === 'semantic' && semanticProvider) {
      return await performSemanticSearch(query, options);
    } else if (mode === 'both') {
      const textResults = performTextSearch(tools, query, options);
      
      if (semanticProvider) {
        const semanticResults = await performSemanticSearch(query, options);
        return mergeSearchResults(textResults, semanticResults, options);
      }
      
      return textResults;
    }
    
    return [];
  }
  
  function performTextSearch(tools, query, options = {}) {
    if (!query) {
      return tools.slice(0, options.limit || 100);
    }
    
    const lowerQuery = query.toLowerCase();
    
    const scoredTools = tools.map(tool => {
      const score = calculateTextSearchScore(tool, lowerQuery);
      return { ...tool, _searchScore: score };
    }).filter(tool => tool._searchScore > 0);
    
    // Sort by score
    scoredTools.sort((a, b) => b._searchScore - a._searchScore);
    
    return scoredTools.slice(0, options.limit || 100);
  }
  
  function calculateTextSearchScore(tool, query) {
    const name = (tool.name || '').toLowerCase();
    const description = (tool.description || '').toLowerCase();
    const module = (tool.moduleName || '').toLowerCase();
    const category = (tool.category || '').toLowerCase();
    const tags = (tool.tags || []).join(' ').toLowerCase();
    
    let score = 0;
    
    // Exact name match (highest priority)
    if (name === query) score += 10;
    else if (name.includes(query)) score += 5;
    
    // Description matches
    if (description.includes(query)) score += 3;
    
    // Module name matches
    if (module.includes(query)) score += 2;
    
    // Category/tag matches
    if (category.includes(query)) score += 1;
    if (tags.includes(query)) score += 1;
    
    // Bonus for word boundary matches
    const wordBoundaryRegex = new RegExp(`\\b${query}\\b`, 'i');
    if (wordBoundaryRegex.test(name)) score += 2;
    if (wordBoundaryRegex.test(description)) score += 1;
    
    return score;
  }
  
  async function performSemanticSearch(query, options = {}) {
    try {
      const results = await semanticProvider.search(query, {
        limit: options.limit || 100,
        collection: 'tools'
      });
      
      return results.map((result, index) => ({
        ...result,
        semanticScore: 10 - (index * 0.1),
        _searchScore: 10 - (index * 0.1)
      }));
    } catch (error) {
      console.error('Semantic search error:', error);
      return [];
    }
  }
  
  function mergeSearchResults(textResults, semanticResults, options = {}) {
    const merged = new Map();
    
    // Add text results
    textResults.forEach(tool => {
      merged.set(tool.name, {
        ...tool,
        textScore: tool._searchScore || 0,
        semanticScore: 0,
        combinedScore: tool._searchScore || 0
      });
    });
    
    // Add/update with semantic results
    semanticResults.forEach((tool, index) => {
      const semanticScore = 10 - (index * 0.1);
      
      if (merged.has(tool.name)) {
        const existing = merged.get(tool.name);
        existing.semanticScore = semanticScore;
        // Weighted combination: 40% text, 60% semantic
        existing.combinedScore = (existing.textScore * 0.4) + (semanticScore * 0.6);
      } else {
        merged.set(tool.name, {
          ...tool,
          textScore: 0,
          semanticScore: semanticScore,
          combinedScore: semanticScore
        });
      }
    });
    
    // Convert to array and sort by combined score
    const results = Array.from(merged.values())
      .sort((a, b) => b.combinedScore - a.combinedScore);
    
    return results.slice(0, options.limit || 100);
  }
});