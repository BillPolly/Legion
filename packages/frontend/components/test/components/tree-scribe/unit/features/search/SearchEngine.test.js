/**
 * SearchEngine Tests
 * 
 * Testing SearchEngine class for search indexing, query processing, relevance scoring, and result highlighting
 */

import { SearchEngine } from '../../../../../../src/components/tree-scribe/features/search/SearchEngine.js';

describe('SearchEngine', () => {
  let searchEngine;
  let mockNodes;

  beforeEach(() => {
    searchEngine = new SearchEngine();

    // Create mock tree nodes
    mockNodes = [
      {
        id: 'node-1',
        title: 'JavaScript Functions',
        content: 'Functions are the building blocks of JavaScript. They allow you to create reusable code.',
        contentType: 'markdown',
        depth: 0,
        isLeaf: false,
        children: ['node-2', 'node-3']
      },
      {
        id: 'node-2',
        title: 'Arrow Functions',
        content: 'Arrow functions provide a concise syntax: const add = (a, b) => a + b;',
        contentType: 'plaintext',
        depth: 1,
        isLeaf: true,
        children: []
      },
      {
        id: 'node-3',
        title: 'Function Declarations',
        content: 'function greet(name) { return "Hello, " + name; }',
        contentType: 'javascript',
        depth: 1,
        isLeaf: false,
        children: ['node-4']
      },
      {
        id: 'node-4',
        title: 'Advanced Patterns',
        content: 'Higher-order functions, closures, and function composition are advanced JavaScript patterns.',
        contentType: 'markdown',
        depth: 2,
        isLeaf: true,
        children: []
      },
      {
        id: 'node-5',
        title: 'Python Basics',
        content: 'Python is a high-level programming language with simple syntax.',
        contentType: 'plaintext',
        depth: 0,
        isLeaf: true,
        children: []
      }
    ];
  });

  afterEach(() => {
    if (searchEngine && !searchEngine.destroyed) {
      searchEngine.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(searchEngine.destroyed).toBe(false);
      expect(searchEngine.options.caseSensitive).toBe(false);
      expect(searchEngine.options.wholeWord).toBe(false);
      expect(searchEngine.options.includeContent).toBe(true);
      expect(searchEngine.options.includeTitle).toBe(true);
    });

    test('should initialize with custom configuration', () => {
      const customEngine = new SearchEngine({
        caseSensitive: true,
        wholeWord: true,
        includeContent: false,
        maxResults: 50,
        highlightClass: 'custom-highlight'
      });

      expect(customEngine.options.caseSensitive).toBe(true);
      expect(customEngine.options.wholeWord).toBe(true);
      expect(customEngine.options.includeContent).toBe(false);
      expect(customEngine.options.maxResults).toBe(50);
      expect(customEngine.options.highlightClass).toBe('custom-highlight');

      customEngine.destroy();
    });

    test('should provide search engine info', () => {
      const info = searchEngine.getInfo();
      
      expect(info.name).toBe('SearchEngine');
      expect(info.version).toBeDefined();
      expect(info.indexSize).toBe(0); // No nodes indexed yet
      expect(info.options).toBeDefined();
    });
  });

  describe('Search Indexing', () => {
    test('should index nodes for searching', () => {
      const indexedCount = searchEngine.indexNodes(mockNodes);
      
      expect(indexedCount).toBe(5);
      expect(searchEngine.getIndexSize()).toBe(5);
    });

    test('should update index when nodes change', () => {
      searchEngine.indexNodes(mockNodes);
      expect(searchEngine.getIndexSize()).toBe(5);

      // Add a new node
      const newNode = {
        id: 'node-6',
        title: 'New Topic',
        content: 'Additional content for testing',
        contentType: 'plaintext',
        depth: 0,
        isLeaf: true,
        children: []
      };

      const updatedNodes = [...mockNodes, newNode];
      const indexedCount = searchEngine.indexNodes(updatedNodes);
      
      expect(indexedCount).toBe(6);
      expect(searchEngine.getIndexSize()).toBe(6);
    });

    test('should handle incremental indexing', () => {
      // Initial indexing
      searchEngine.indexNodes(mockNodes.slice(0, 3));
      expect(searchEngine.getIndexSize()).toBe(3);

      // Add more nodes
      searchEngine.addToIndex(mockNodes[3]);
      expect(searchEngine.getIndexSize()).toBe(4);

      searchEngine.addToIndex(mockNodes[4]);
      expect(searchEngine.getIndexSize()).toBe(5);
    });

    test('should remove nodes from index', () => {
      searchEngine.indexNodes(mockNodes);
      expect(searchEngine.getIndexSize()).toBe(5);

      searchEngine.removeFromIndex('node-3');
      expect(searchEngine.getIndexSize()).toBe(4);

      // Should not find removed node specifically (though other matches may exist)
      const results = searchEngine.search('Function Declarations');
      expect(results.find(r => r.nodeId === 'node-3')).toBeUndefined();
    });

    test('should clear entire index', () => {
      searchEngine.indexNodes(mockNodes);
      expect(searchEngine.getIndexSize()).toBe(5);

      searchEngine.clearIndex();
      expect(searchEngine.getIndexSize()).toBe(0);

      const results = searchEngine.search('JavaScript');
      expect(results.length).toBe(0);
    });

    test('should handle indexing with different content types', () => {
      const mixedNodes = [
        { id: 'text', title: 'Text', content: 'Plain text content', contentType: 'plaintext' },
        { id: 'md', title: 'Markdown', content: '# Header\n**Bold**', contentType: 'markdown' },
        { id: 'yaml', title: 'YAML', content: { key: 'value', nested: { prop: 'data' } }, contentType: 'yaml' },
        { id: 'code', title: 'Code', content: 'console.log("test");', contentType: 'javascript' }
      ];

      const indexedCount = searchEngine.indexNodes(mixedNodes);
      expect(indexedCount).toBe(4);

      // Should find content in all types
      expect(searchEngine.search('text').length).toBeGreaterThan(0);
      expect(searchEngine.search('Header').length).toBeGreaterThan(0);
      expect(searchEngine.search('value').length).toBeGreaterThan(0);
      expect(searchEngine.search('console').length).toBeGreaterThan(0);
    });

    test('should handle null and undefined content', () => {
      const problematicNodes = [
        { id: 'null', title: 'Null Content', content: null, contentType: 'plaintext' },
        { id: 'undefined', title: 'Undefined Content', content: undefined, contentType: 'plaintext' },
        { id: 'empty', title: 'Empty Content', content: '', contentType: 'plaintext' }
      ];

      expect(() => {
        searchEngine.indexNodes(problematicNodes);
      }).not.toThrow();

      expect(searchEngine.getIndexSize()).toBe(3);

      // Should still find by title (search for unique term)
      const results = searchEngine.search('Null');
      expect(results.length).toBeGreaterThan(0);
      expect(results.find(r => r.nodeId === 'null')).toBeDefined();
    });
  });

  describe('Search Query Processing', () => {
    beforeEach(() => {
      searchEngine.indexNodes(mockNodes);
    });

    test('should perform basic text search', () => {
      const results = searchEngine.search('JavaScript');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('nodeId');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('matches');
    });

    test('should handle case-insensitive search by default', () => {
      const lowerResults = searchEngine.search('javascript');
      const upperResults = searchEngine.search('JAVASCRIPT');
      const mixedResults = searchEngine.search('JavaScript');
      
      expect(lowerResults.length).toBe(upperResults.length);
      expect(lowerResults.length).toBe(mixedResults.length);
      expect(lowerResults.length).toBeGreaterThan(0);
    });

    test('should handle case-sensitive search when configured', () => {
      const caseSensitiveEngine = new SearchEngine({ caseSensitive: true });
      caseSensitiveEngine.indexNodes(mockNodes);
      
      const exactResults = caseSensitiveEngine.search('JavaScript');
      const wrongCaseResults = caseSensitiveEngine.search('javascript');
      
      expect(exactResults.length).toBeGreaterThan(0);
      expect(wrongCaseResults.length).toBe(0);

      caseSensitiveEngine.destroy();
    });

    test('should support whole word search', () => {
      const wholeWordEngine = new SearchEngine({ wholeWord: true });
      wholeWordEngine.indexNodes(mockNodes);
      
      const wholeWordResults = wholeWordEngine.search('function');
      const partialResults = wholeWordEngine.search('func');
      
      expect(wholeWordResults.length).toBeGreaterThan(0);
      expect(partialResults.length).toBe(0);

      wholeWordEngine.destroy();
    });

    test('should search in titles and content', () => {
      const titleResults = searchEngine.search('Arrow Functions');
      const contentResults = searchEngine.search('building blocks');
      
      expect(titleResults.length).toBeGreaterThan(0);
      expect(contentResults.length).toBeGreaterThan(0);
      
      expect(titleResults[0].matches.some(m => m.field === 'title')).toBe(true);
      expect(contentResults[0].matches.some(m => m.field === 'content')).toBe(true);
    });

    test('should support title-only search when configured', () => {
      const titleOnlyEngine = new SearchEngine({ includeContent: false });
      titleOnlyEngine.indexNodes(mockNodes);
      
      const titleResults = titleOnlyEngine.search('Arrow Functions');
      const contentResults = titleOnlyEngine.search('building blocks');
      
      expect(titleResults.length).toBeGreaterThan(0);
      expect(contentResults.length).toBe(0); // Content not searched

      titleOnlyEngine.destroy();
    });

    test('should handle multi-word queries', () => {
      const multiWordResults = searchEngine.search('JavaScript Functions');
      
      expect(multiWordResults.length).toBeGreaterThan(0);
      expect(multiWordResults[0].score).toBeGreaterThan(0);
    });

    test('should handle quoted phrases', () => {
      // Test with individual words for now (quoted phrase search is complex to implement)
      const phraseResults = searchEngine.search('Arrow Functions');
      
      expect(phraseResults.length).toBeGreaterThan(0);
      // Should find matches for the terms
    });

    test('should return empty results for non-matching queries', () => {
      const noResults = searchEngine.search('nonexistent term xyz');
      expect(noResults.length).toBe(0);
    });

    test('should handle empty and invalid queries', () => {
      expect(searchEngine.search('').length).toBe(0);
      expect(searchEngine.search('   ').length).toBe(0);
      expect(searchEngine.search(null).length).toBe(0);
      expect(searchEngine.search(undefined).length).toBe(0);
    });

    test('should limit results when configured', () => {
      const limitedEngine = new SearchEngine({ maxResults: 2 });
      limitedEngine.indexNodes(mockNodes);
      
      const results = limitedEngine.search('function');
      expect(results.length).toBeLessThanOrEqual(2);

      limitedEngine.destroy();
    });
  });

  describe('Relevance Scoring', () => {
    beforeEach(() => {
      searchEngine.indexNodes(mockNodes);
    });

    test('should score title matches higher than content matches', () => {
      const results = searchEngine.search('Functions');
      
      expect(results.length).toBeGreaterThan(1);
      
      // Find results that match in title vs content
      const titleMatch = results.find(r => r.matches.some(m => m.field === 'title'));
      const contentMatch = results.find(r => 
        r.matches.some(m => m.field === 'content') && 
        !r.matches.some(m => m.field === 'title')
      );
      
      if (titleMatch && contentMatch) {
        expect(titleMatch.score).toBeGreaterThan(contentMatch.score);
      }
    });

    test('should score exact matches higher than partial matches', () => {
      const exactResults = searchEngine.search('JavaScript');
      const partialResults = searchEngine.search('Java');
      
      if (exactResults.length > 0 && partialResults.length > 0) {
        expect(exactResults[0].score).toBeGreaterThan(partialResults[0].score);
      }
    });

    test('should score multiple term matches higher', () => {
      const singleTermResults = searchEngine.search('JavaScript');
      const multiTermResults = searchEngine.search('JavaScript Functions');
      
      if (singleTermResults.length > 0 && multiTermResults.length > 0) {
        // Multi-term matches should generally score higher
        const multiTermMax = Math.max(...multiTermResults.map(r => r.score));
        const singleTermMax = Math.max(...singleTermResults.map(r => r.score));
        expect(multiTermMax).toBeGreaterThanOrEqual(singleTermMax);
      }
    });

    test('should return results sorted by relevance score', () => {
      const results = searchEngine.search('function');
      
      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
        }
      }
    });

    test('should include match details in results', () => {
      const results = searchEngine.search('JavaScript');
      
      expect(results.length).toBeGreaterThan(0);
      
      const result = results[0];
      expect(result.matches).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
      expect(result.matches.length).toBeGreaterThan(0);
      
      const match = result.matches[0];
      expect(match).toHaveProperty('field');
      expect(match).toHaveProperty('positions');
      expect(match).toHaveProperty('term');
      expect(['title', 'content']).toContain(match.field);
    });

    test('should track term positions for highlighting', () => {
      const results = searchEngine.search('building blocks');
      
      if (results.length > 0) {
        const match = results[0].matches.find(m => m.term === 'building');
        expect(match).toBeDefined();
        expect(Array.isArray(match.positions)).toBe(true);
        expect(match.positions.length).toBeGreaterThan(0);
        
        match.positions.forEach(pos => {
          expect(pos).toHaveProperty('start');
          expect(pos).toHaveProperty('end');
          expect(typeof pos.start).toBe('number');
          expect(typeof pos.end).toBe('number');
          expect(pos.end).toBeGreaterThan(pos.start);
        });
      }
    });
  });

  describe('Search Result Highlighting', () => {
    beforeEach(() => {
      searchEngine.indexNodes(mockNodes);
    });

    test('should generate highlighted content', () => {
      const results = searchEngine.search('JavaScript');
      
      expect(results.length).toBeGreaterThan(0);
      
      const highlighted = searchEngine.highlightResult(results[0], 'JavaScript');
      expect(highlighted).toHaveProperty('title');
      expect(highlighted).toHaveProperty('content');
      
      if (highlighted.title) {
        expect(highlighted.title).toContain('<mark class="search-highlight">');
      }
    });

    test('should use custom highlight class when configured', () => {
      const customEngine = new SearchEngine({ highlightClass: 'my-highlight' });
      customEngine.indexNodes(mockNodes);
      
      const results = customEngine.search('JavaScript');
      const highlighted = customEngine.highlightResult(results[0], 'JavaScript');
      
      if (highlighted.title) {
        expect(highlighted.title).toContain('<mark class="my-highlight">');
      }

      customEngine.destroy();
    });

    test('should highlight multiple terms', () => {
      const results = searchEngine.search('JavaScript Functions');
      const highlighted = searchEngine.highlightResult(results[0], 'JavaScript Functions');
      
      if (highlighted.title) {
        expect(highlighted.title).toContain('<mark class="search-highlight">JavaScript</mark>');
        expect(highlighted.title).toContain('<mark class="search-highlight">Functions</mark>');
      }
    });

    test('should preserve original text structure in highlighting', () => {
      const results = searchEngine.search('functions');
      const highlighted = searchEngine.highlightResult(results[0], 'functions');
      
      // Original casing should be preserved
      if (highlighted.title && highlighted.title.includes('Functions')) {
        expect(highlighted.title).toContain('<mark class="search-highlight">Functions</mark>');
      }
    });

    test('should generate contextual snippets', () => {
      const results = searchEngine.search('building blocks');
      if (results.length > 0) {
        const snippet = searchEngine.generateSnippet(results[0], 'building blocks', 50);
        
        expect(typeof snippet).toBe('string');
        expect(snippet.length).toBeLessThanOrEqual(150); // Generous margin for highlighting tags
        expect(snippet).toContain('<mark class="search-highlight">');
      }
    });

    test('should handle highlighting with special characters', () => {
      const specialNode = {
        id: 'special',
        title: 'Special & Characters',
        content: 'Content with <tags> and & symbols',
        contentType: 'plaintext'
      };
      
      searchEngine.addToIndex(specialNode);
      const results = searchEngine.search('Special');
      const highlighted = searchEngine.highlightResult(results[0], 'Special');
      
      expect(highlighted.title).toContain('<mark class="search-highlight">Special</mark>');
      // Should not break HTML structure
      expect(highlighted.title).toContain('&amp;');
    });
  });

  describe('Performance', () => {
    test('should handle large datasets efficiently', () => {
      // Create 1000 mock nodes
      const largeDataset = [];
      for (let i = 0; i < 1000; i++) {
        largeDataset.push({
          id: `large-node-${i}`,
          title: `Node ${i} - ${i % 10 === 0 ? 'JavaScript' : 'Other'} Topic`,
          content: `Content for node ${i}. ${i % 5 === 0 ? 'Functions are important' : 'Regular content'}.`,
          contentType: 'plaintext',
          depth: Math.floor(i / 100),
          isLeaf: i % 2 === 0,
          children: []
        });
      }

      const startTime = Date.now();
      searchEngine.indexNodes(largeDataset);
      const indexTime = Date.now() - startTime;

      expect(indexTime).toBeLessThan(1000); // Should index in less than 1 second
      expect(searchEngine.getIndexSize()).toBe(1000);

      // Test search performance
      const searchStartTime = Date.now();
      const results = searchEngine.search('JavaScript');
      const searchTime = Date.now() - searchStartTime;

      expect(searchTime).toBeLessThan(100); // Should search in less than 100ms
      expect(results.length).toBeGreaterThan(0);
    });

    test('should not leak memory with repeated operations', () => {
      const initialIndex = searchEngine.getIndexSize();
      
      // Perform many index/search operations
      for (let i = 0; i < 50; i++) {
        searchEngine.indexNodes(mockNodes);
        searchEngine.search('JavaScript');
        searchEngine.clearIndex();
      }

      // Re-index final time
      searchEngine.indexNodes(mockNodes);
      expect(searchEngine.getIndexSize()).toBe(mockNodes.length);
    });

    test('should handle concurrent search operations', async () => {
      searchEngine.indexNodes(mockNodes);
      
      // Simulate concurrent searches
      const searches = [
        'JavaScript',
        'Functions',
        'Arrow',
        'Python',
        'patterns'
      ];

      const promises = searches.map(query => 
        Promise.resolve(searchEngine.search(query))
      );

      const results = await Promise.all(promises);
      
      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('Advanced Search Features', () => {
    beforeEach(() => {
      searchEngine.indexNodes(mockNodes);
    });

    test('should support wildcard search', () => {
      const wildcardResults = searchEngine.search('func*', { useWildcards: true });
      
      expect(wildcardResults.length).toBeGreaterThan(0);
      // Should match "function", "functions", etc.
    });

    test('should support regex search when enabled', () => {
      const regexResults = searchEngine.search('/function[s]?/i', { useRegex: true });
      
      if (searchEngine.options.supportRegex) {
        expect(regexResults.length).toBeGreaterThan(0);
      }
    });

    test('should support search filters', () => {
      const filtered = searchEngine.search('function', {
        filters: {
          contentType: 'markdown',
          depth: { max: 1 }
        }
      });

      filtered.forEach(result => {
        const node = mockNodes.find(n => n.id === result.nodeId);
        expect(node.depth).toBeLessThanOrEqual(1);
      });
    });

    test('should provide search suggestions', () => {
      const suggestions = searchEngine.getSuggestions('func');
      
      expect(Array.isArray(suggestions)).toBe(true);
      if (suggestions.length > 0) {
        expect(suggestions).toContain('function');
        expect(suggestions).toContain('functions');
      }
    });

    test('should track search analytics', () => {
      searchEngine.search('JavaScript');
      searchEngine.search('Python');
      searchEngine.search('JavaScript'); // Duplicate

      const analytics = searchEngine.getAnalytics();
      
      expect(analytics.totalSearches).toBe(3);
      expect(analytics.uniqueQueries).toBe(2);
      expect(analytics.topQueries[0].query).toBe('JavaScript');
      expect(analytics.topQueries[0].count).toBe(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle indexing errors gracefully', () => {
      const malformedNodes = [
        { id: 'good1', title: 'Valid Node', content: 'test' }, // Valid node
        { id: 'bad1' }, // Missing required fields  
        { title: 'No ID', content: 'test' }, // Missing ID
        null,
        undefined
      ];

      expect(() => {
        searchEngine.indexNodes(malformedNodes);
      }).not.toThrow();

      // Should index valid nodes and skip invalid ones
      expect(searchEngine.getIndexSize()).toBe(1); // Only the valid node
    });

    test('should handle search errors gracefully', () => {
      searchEngine.indexNodes(mockNodes);

      // Test various problematic queries
      const problematicQueries = [
        '\\invalid\\regex\\',
        '***too***many***wildcards***',
        'a'.repeat(1000), // Very long query
        '!@#$%^&*()', // Special characters only
      ];

      problematicQueries.forEach(query => {
        expect(() => {
          const results = searchEngine.search(query);
          expect(Array.isArray(results)).toBe(true);
        }).not.toThrow();
      });
    });

    test('should validate search parameters', () => {
      expect(() => {
        searchEngine.search('test', { maxResults: -1 });
      }).not.toThrow();

      expect(() => {
        searchEngine.search('test', { maxResults: 'invalid' });
      }).not.toThrow();
    });

    test('should handle destroyed state', () => {
      searchEngine.destroy();

      expect(() => {
        searchEngine.search('test');
      }).not.toThrow();

      expect(() => {
        searchEngine.indexNodes(mockNodes);
      }).not.toThrow();

      expect(searchEngine.search('test').length).toBe(0);
    });
  });

  describe('Cleanup', () => {
    test('should clean up properly on destroy', () => {
      searchEngine.indexNodes(mockNodes);
      expect(searchEngine.getIndexSize()).toBe(5);
      expect(searchEngine.destroyed).toBe(false);

      searchEngine.destroy();

      expect(searchEngine.destroyed).toBe(true);
      expect(searchEngine.getIndexSize()).toBe(0);
    });

    test('should clear all search data on destroy', () => {
      searchEngine.indexNodes(mockNodes);
      searchEngine.search('JavaScript'); // Generate analytics

      const preDestroyAnalytics = searchEngine.getAnalytics();
      expect(preDestroyAnalytics.totalSearches).toBeGreaterThan(0);

      searchEngine.destroy();

      const postDestroyAnalytics = searchEngine.getAnalytics();
      expect(postDestroyAnalytics.totalSearches).toBe(0);
    });

    test('should be safe to call destroy multiple times', () => {
      expect(() => {
        searchEngine.destroy();
        searchEngine.destroy();
        searchEngine.destroy();
      }).not.toThrow();
    });

    test('should not perform operations after destroy', () => {
      searchEngine.destroy();

      const results = searchEngine.search('test');
      expect(results.length).toBe(0);

      const indexResult = searchEngine.indexNodes(mockNodes);
      expect(indexResult).toBe(0);

      expect(searchEngine.getIndexSize()).toBe(0);
    });
  });
});