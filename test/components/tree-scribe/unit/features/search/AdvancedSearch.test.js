/**
 * Advanced Search Features Tests
 * 
 * Testing enhanced search capabilities for TreeScribe
 */

import { SearchEngine } from '../../../../../../src/components/tree-scribe/features/search/SearchEngine.js';
import { AdvancedSearchManager } from '../../../../../../src/components/tree-scribe/features/search/AdvancedSearchManager.js';

describe('AdvancedSearchManager', () => {
  let manager;
  let searchEngine;
  let mockTree;

  beforeEach(() => {
    // Create mock tree with diverse content
    mockTree = {
      nodes: [
        {
          id: 'node1',
          title: 'Introduction to JavaScript',
          content: 'JavaScript is a programming language that enables interactive web pages.',
          type: 'markdown',
          path: ['root', 'node1'],
          depth: 1
        },
        {
          id: 'node2',
          title: 'Variables and Data Types',
          content: 'In JavaScript, you can declare variables using var, let, or const keywords.',
          type: 'markdown',
          path: ['root', 'node2'],
          depth: 1
        },
        {
          id: 'node3',
          title: 'Functions',
          content: 'Functions in JavaScript are blocks of code designed to perform particular tasks.',
          type: 'markdown',
          path: ['root', 'node2', 'node3'],
          depth: 2
        },
        {
          id: 'node4',
          title: 'Arrays and Objects',
          content: 'JavaScript provides arrays for storing multiple values and objects for key-value pairs.',
          type: 'markdown',
          path: ['root', 'node2', 'node4'],
          depth: 2
        },
        {
          id: 'node5',
          title: 'Advanced Concepts',
          content: 'Advanced JavaScript includes closures, promises, async/await, and more.',
          type: 'markdown',
          path: ['root', 'node5'],
          depth: 1
        }
      ]
    };

    searchEngine = new SearchEngine();
    searchEngine.indexTree(mockTree);
    
    manager = new AdvancedSearchManager({
      searchEngine,
      contextWindow: 50,
      highlightTag: 'mark'
    });
  });

  afterEach(() => {
    if (manager && !manager.destroyed) {
      manager.destroy();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      const defaultManager = new AdvancedSearchManager({ searchEngine });
      
      expect(defaultManager.destroyed).toBe(false);
      expect(defaultManager.options.contextWindow).toBe(100);
      expect(defaultManager.options.highlightTag).toBe('mark');
      expect(defaultManager.options.maxResults).toBe(100);
      
      defaultManager.destroy();
    });

    test('should accept custom options', () => {
      expect(manager.options.contextWindow).toBe(50);
      expect(manager.currentQuery).toBeNull();
      expect(manager.currentResults).toEqual([]);
      expect(manager.currentIndex).toBe(-1);
    });
  });

  describe('Search Navigation', () => {
    test('should perform search and navigate results', () => {
      const results = manager.search('JavaScript');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].nodeId).toBe('node1');
      expect(manager.currentIndex).toBe(0);
    });

    test('should navigate to next result', () => {
      manager.search('JavaScript');
      
      const firstResult = manager.getCurrentResult();
      expect(firstResult.nodeId).toBe('node1');
      
      const nextResult = manager.navigateNext();
      expect(nextResult.nodeId).toBe('node2');
      expect(manager.currentIndex).toBe(1);
    });

    test('should navigate to previous result', () => {
      manager.search('JavaScript');
      manager.navigateNext(); // Move to second result
      
      const prevResult = manager.navigatePrevious();
      expect(prevResult.nodeId).toBe('node1');
      expect(manager.currentIndex).toBe(0);
    });

    test('should wrap around when navigating past last result', () => {
      const results = manager.search('JavaScript');
      
      // Navigate to last result
      for (let i = 0; i < results.length - 1; i++) {
        manager.navigateNext();
      }
      
      // Navigate past last should wrap to first
      const wrappedResult = manager.navigateNext();
      expect(wrappedResult.nodeId).toBe(results[0].nodeId);
      expect(manager.currentIndex).toBe(0);
    });

    test('should wrap around when navigating before first result', () => {
      const results = manager.search('JavaScript');
      
      // Navigate before first should wrap to last
      const wrappedResult = manager.navigatePrevious();
      expect(wrappedResult.nodeId).toBe(results[results.length - 1].nodeId);
      expect(manager.currentIndex).toBe(results.length - 1);
    });

    test('should handle navigation with no results', () => {
      manager.search('nonexistent');
      
      expect(manager.navigateNext()).toBeNull();
      expect(manager.navigatePrevious()).toBeNull();
      expect(manager.getCurrentResult()).toBeNull();
    });

    test('should jump to specific result index', () => {
      const results = manager.search('JavaScript');
      
      const jumpedResult = manager.jumpToResult(2);
      expect(jumpedResult).toBe(results[2]);
      expect(manager.currentIndex).toBe(2);
    });

    test('should handle invalid jump indices', () => {
      manager.search('JavaScript');
      
      expect(manager.jumpToResult(-1)).toBeNull();
      expect(manager.jumpToResult(999)).toBeNull();
      expect(manager.currentIndex).toBe(0); // Should remain unchanged
    });
  });

  describe('Search Result Context', () => {
    test('should provide context around matches', () => {
      const results = manager.search('variables');
      const firstResult = results[0];
      
      expect(firstResult.context).toBeDefined();
      expect(firstResult.context.before).toContain('you can declare');
      expect(firstResult.context.match).toBe('variables');
      expect(firstResult.context.after).toContain('using');
    });

    test('should highlight matches in context', () => {
      const results = manager.search('JavaScript');
      const firstResult = results[0];
      
      expect(firstResult.highlightedContent).toContain('<mark>JavaScript</mark>');
      expect(firstResult.highlightedContent).not.toContain('javascript'); // Case preserved
    });

    test('should provide multiple contexts for multiple matches', () => {
      const results = manager.search('JavaScript');
      const nodeWithMultipleMatches = results.find(r => 
        r.matches && r.matches.length > 1
      );
      
      if (nodeWithMultipleMatches) {
        expect(nodeWithMultipleMatches.contexts.length).toBe(
          nodeWithMultipleMatches.matches.length
        );
      }
    });

    test('should truncate long contexts', () => {
      const longContent = 'x'.repeat(200) + ' JavaScript ' + 'y'.repeat(200);
      searchEngine.indexTree({
        nodes: [{
          id: 'long',
          title: 'Long Content',
          content: longContent,
          type: 'text'
        }]
      });
      
      const results = manager.search('JavaScript');
      const longResult = results.find(r => r.nodeId === 'long');
      
      expect(longResult.context.before.length).toBeLessThanOrEqual(50);
      expect(longResult.context.after.length).toBeLessThanOrEqual(50);
    });

    test('should handle matches at content boundaries', () => {
      searchEngine.indexTree({
        nodes: [
          {
            id: 'start',
            title: 'Start Match',
            content: 'JavaScript at the beginning',
            type: 'text'
          },
          {
            id: 'end',
            title: 'End Match',
            content: 'Ends with JavaScript',
            type: 'text'
          }
        ]
      });
      
      const results = manager.search('JavaScript');
      
      const startMatch = results.find(r => r.nodeId === 'start');
      expect(startMatch.context.before).toBe('');
      
      const endMatch = results.find(r => r.nodeId === 'end');
      expect(endMatch.context.after).toBe('');
    });
  });

  describe('Search Filters and Options', () => {
    test('should filter results by node type', () => {
      searchEngine.indexTree({
        nodes: [
          ...mockTree.nodes,
          {
            id: 'yaml1',
            title: 'JavaScript Config',
            content: 'config: { language: "JavaScript" }',
            type: 'yaml'
          }
        ]
      });
      
      const results = manager.search('JavaScript', {
        nodeTypes: ['markdown']
      });
      
      expect(results.every(r => r.type === 'markdown')).toBe(true);
      expect(results.find(r => r.type === 'yaml')).toBeUndefined();
    });

    test('should filter results by path depth', () => {
      const results = manager.search('JavaScript', {
        maxDepth: 1
      });
      
      expect(results.every(r => r.depth <= 1)).toBe(true);
      expect(results.find(r => r.depth > 1)).toBeUndefined();
    });

    test('should limit number of results', () => {
      const results = manager.search('JavaScript', {
        maxResults: 2
      });
      
      expect(results.length).toBeLessThanOrEqual(2);
    });

    test('should search with case sensitivity option', () => {
      const caseSensitiveResults = manager.search('javascript', {
        caseSensitive: true
      });
      
      const caseInsensitiveResults = manager.search('javascript', {
        caseSensitive: false
      });
      
      expect(caseSensitiveResults.length).toBe(0);
      expect(caseInsensitiveResults.length).toBeGreaterThan(0);
    });

    test('should search with whole word option', () => {
      searchEngine.indexTree({
        nodes: [{
          id: 'partial',
          title: 'Partial Match',
          content: 'JavaScripting is different from JavaScript',
          type: 'text'
        }]
      });
      
      const wholeWordResults = manager.search('JavaScript', {
        wholeWord: true
      });
      
      const partialResults = manager.search('JavaScript', {
        wholeWord: false
      });
      
      expect(wholeWordResults.length).toBeLessThan(partialResults.length);
    });

    test('should search with regex patterns', () => {
      const results = manager.search(/Java\w+/i, {
        useRegex: true
      });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matches[0].match).toMatch(/Java\w+/i);
    });
  });

  describe('Search Result Highlighting', () => {
    test('should highlight all occurrences in content', () => {
      const results = manager.search('JavaScript');
      const result = results[0];
      
      const highlighted = manager.getHighlightedContent(result);
      const markCount = (highlighted.match(/<mark>/g) || []).length;
      
      expect(markCount).toBe(result.matches.length);
    });

    test('should preserve HTML structure when highlighting', () => {
      searchEngine.indexTree({
        nodes: [{
          id: 'html',
          title: 'HTML Content',
          content: '<p>Learn <strong>JavaScript</strong> programming</p>',
          type: 'html'
        }]
      });
      
      const results = manager.search('JavaScript');
      const htmlResult = results.find(r => r.nodeId === 'html');
      
      const highlighted = manager.getHighlightedContent(htmlResult);
      expect(highlighted).toContain('<strong><mark>JavaScript</mark></strong>');
    });

    test('should use custom highlight tag', () => {
      const customManager = new AdvancedSearchManager({
        searchEngine,
        highlightTag: 'em'
      });
      
      const results = customManager.search('JavaScript');
      const highlighted = customManager.getHighlightedContent(results[0]);
      
      expect(highlighted).toContain('<em>JavaScript</em>');
      expect(highlighted).not.toContain('<mark>');
      
      customManager.destroy();
    });

    test('should add custom CSS classes to highlights', () => {
      const results = manager.search('JavaScript');
      const highlighted = manager.getHighlightedContent(results[0], {
        className: 'search-highlight'
      });
      
      expect(highlighted).toContain('<mark class="search-highlight">');
    });

    test('should handle overlapping matches', () => {
      searchEngine.indexTree({
        nodes: [{
          id: 'overlap',
          title: 'Overlapping',
          content: 'JavaScript JavaScript JavaScript',
          type: 'text'
        }]
      });
      
      const results = manager.search('JavaScript JavaScript');
      const overlapResult = results.find(r => r.nodeId === 'overlap');
      
      if (overlapResult) {
        const highlighted = manager.getHighlightedContent(overlapResult);
        expect(highlighted).toBeTruthy();
        // Should handle overlaps gracefully
      }
    });
  });

  describe('Search Result Export', () => {
    test('should export search results as JSON', () => {
      manager.search('JavaScript');
      
      const exported = manager.exportResults('json');
      const parsed = JSON.parse(exported);
      
      expect(parsed.query).toBe('JavaScript');
      expect(parsed.results).toBeDefined();
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.totalResults).toBeGreaterThan(0);
    });

    test('should export search results as CSV', () => {
      manager.search('JavaScript');
      
      const csv = manager.exportResults('csv');
      
      expect(csv).toContain('"Node ID","Title","Match","Context"');
      expect(csv).toContain('JavaScript');
      expect(csv.split('\n').length).toBeGreaterThan(1);
    });

    test('should export search results as HTML', () => {
      manager.search('JavaScript');
      
      const html = manager.exportResults('html');
      
      expect(html).toContain('<table');
      expect(html).toContain('JavaScript');
      expect(html).toContain('<mark>');
    });

    test('should include statistics in export', () => {
      manager.search('JavaScript');
      
      const stats = manager.getSearchStatistics();
      
      expect(stats.totalMatches).toBeGreaterThan(0);
      expect(stats.nodesWithMatches).toBeGreaterThan(0);
      expect(stats.averageScore).toBeGreaterThan(0);
      expect(stats.searchDuration).toBeDefined();
    });
  });

  describe('Search History', () => {
    test('should maintain search history', () => {
      manager.search('JavaScript');
      manager.search('functions');
      manager.search('variables');
      
      const history = manager.getSearchHistory();
      
      expect(history).toHaveLength(3);
      expect(history[0].query).toBe('variables'); // Most recent first
      expect(history[2].query).toBe('JavaScript');
    });

    test('should navigate through search history', () => {
      manager.search('JavaScript');
      manager.search('functions');
      
      const prevSearch = manager.previousSearch();
      expect(prevSearch.query).toBe('JavaScript');
      expect(manager.currentQuery).toBe('JavaScript');
      
      const nextSearch = manager.nextSearch();
      expect(nextSearch.query).toBe('functions');
    });

    test('should limit history size', () => {
      const historyManager = new AdvancedSearchManager({
        searchEngine,
        maxHistorySize: 3
      });
      
      historyManager.search('one');
      historyManager.search('two');
      historyManager.search('three');
      historyManager.search('four');
      
      const history = historyManager.getSearchHistory();
      expect(history).toHaveLength(3);
      expect(history.find(h => h.query === 'one')).toBeUndefined();
      
      historyManager.destroy();
    });

    test('should clear search history', () => {
      manager.search('JavaScript');
      manager.search('functions');
      
      manager.clearHistory();
      
      expect(manager.getSearchHistory()).toHaveLength(0);
      expect(manager.previousSearch()).toBeNull();
    });
  });

  describe('Live Search Updates', () => {
    test('should update results when tree changes', () => {
      const initialResults = manager.search('JavaScript');
      const initialCount = initialResults.length;
      
      // Add new node
      searchEngine.indexTree({
        nodes: [
          ...mockTree.nodes,
          {
            id: 'new',
            title: 'New JavaScript Features',
            content: 'ES2022 JavaScript updates',
            type: 'markdown'
          }
        ]
      });
      
      // Refresh search
      const updatedResults = manager.refreshSearch();
      expect(updatedResults.length).toBeGreaterThan(initialCount);
    });

    test('should handle node removal in search results', () => {
      manager.search('JavaScript');
      
      // Remove a node from index
      const filteredNodes = mockTree.nodes.filter(n => n.id !== 'node1');
      searchEngine.indexTree({ nodes: filteredNodes });
      
      const updatedResults = manager.refreshSearch();
      expect(updatedResults.find(r => r.nodeId === 'node1')).toBeUndefined();
    });

    test('should maintain navigation state during refresh', () => {
      manager.search('JavaScript');
      manager.navigateNext();
      manager.navigateNext();
      
      const currentIndex = manager.currentIndex;
      manager.refreshSearch();
      
      // Should try to maintain position
      expect(manager.currentIndex).toBeLessThanOrEqual(currentIndex);
    });
  });

  describe('Search Performance', () => {
    test('should handle large result sets efficiently', () => {
      // Create large dataset
      const largeTree = { nodes: [] };
      for (let i = 0; i < 1000; i++) {
        largeTree.nodes.push({
          id: `node${i}`,
          title: `JavaScript Tutorial Part ${i}`,
          content: `Content about JavaScript concept ${i}`,
          type: 'markdown'
        });
      }
      
      searchEngine.indexTree(largeTree);
      
      const start = Date.now();
      const results = manager.search('JavaScript');
      const duration = Date.now() - start;
      
      expect(results.length).toBe(100); // Limited by maxResults
      expect(duration).toBeLessThan(100); // Should be fast
    });

    test('should cancel ongoing searches', (done) => {
      manager.searchAsync('JavaScript', {
        onResult: (result) => {
          // Should not be called after cancel
          expect(manager.isSearching).toBe(true);
        },
        onComplete: () => {
          done(new Error('Search should have been cancelled'));
        }
      });
      
      manager.cancelSearch();
      expect(manager.isSearching).toBe(false);
      
      setTimeout(() => {
        done(); // Test passes if onComplete wasn't called
      }, 100);
    });
  });

  describe('Accessibility Integration', () => {
    test('should announce search results to screen readers', () => {
      const announcements = [];
      manager.setAnnouncer({
        announce: (message) => announcements.push(message)
      });
      
      manager.search('JavaScript');
      
      expect(announcements.length).toBeGreaterThan(0);
      expect(announcements[0]).toContain('results found');
    });

    test('should announce navigation changes', () => {
      const announcements = [];
      manager.setAnnouncer({
        announce: (message) => announcements.push(message)
      });
      
      manager.search('JavaScript');
      manager.navigateNext();
      
      const navAnnouncement = announcements.find(a => 
        a.includes('Result') && a.includes('of')
      );
      expect(navAnnouncement).toBeTruthy();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources on destroy', () => {
      manager.search('JavaScript');
      manager.destroy();
      
      expect(manager.destroyed).toBe(true);
      expect(manager.currentResults).toEqual([]);
      expect(manager.searchHistory.length).toBe(0);
    });

    test('should handle operations after destroy gracefully', () => {
      manager.destroy();
      
      expect(() => {
        manager.search('JavaScript');
      }).not.toThrow();
      
      expect(manager.getCurrentResult()).toBeNull();
    });
  });
});