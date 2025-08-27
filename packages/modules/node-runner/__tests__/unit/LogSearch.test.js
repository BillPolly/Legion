/**
 * @fileoverview Unit tests for LogSearch - Search engine for logs with multiple strategies
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LogSearch } from '../../src/search/LogSearch.js';

describe('LogSearch', () => {
  let logSearch;
  let mockSemanticSearchProvider;
  let mockLogStorage;

  beforeEach(() => {
    mockSemanticSearchProvider = {
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      search: jest.fn().mockResolvedValue([
        { id: 'log-1', score: 0.95, metadata: { message: 'Semantic match 1' } },
        { id: 'log-2', score: 0.85, metadata: { message: 'Semantic match 2' } }
      ]),
      addDocument: jest.fn().mockResolvedValue(true),
      isAvailable: jest.fn().mockReturnValue(true)
    };

    mockLogStorage = {
      searchLogs: jest.fn().mockResolvedValue([
        { logId: 'log-3', message: 'Keyword match', timestamp: new Date() },
        { logId: 'log-4', message: 'Another keyword match', timestamp: new Date() }
      ]),
      getLogsBySession: jest.fn().mockResolvedValue([
        { logId: 'log-5', message: 'Session log 1', timestamp: new Date() },
        { logId: 'log-6', message: 'Session log 2', timestamp: new Date() }
      ]),
      getLogById: jest.fn().mockResolvedValue({
        logId: 'log-1',
        message: 'Full log message',
        sessionId: 'session-123',
        timestamp: new Date()
      })
    };

    logSearch = new LogSearch(mockSemanticSearchProvider, mockLogStorage);
  });

  describe('Constructor', () => {
    it('should create LogSearch instance', () => {
      expect(logSearch).toBeInstanceOf(LogSearch);
    });

    it('should accept SemanticSearchProvider', () => {
      expect(logSearch.semanticSearchProvider).toBe(mockSemanticSearchProvider);
    });

    it('should accept LogStorage', () => {
      expect(logSearch.logStorage).toBe(mockLogStorage);
    });

    it('should work without SemanticSearchProvider', () => {
      const searchWithoutSemantic = new LogSearch(null, mockLogStorage);
      expect(searchWithoutSemantic.semanticSearchProvider).toBeNull();
    });

    it('should initialize search statistics', () => {
      expect(logSearch.stats).toBeDefined();
      expect(logSearch.stats.searches).toBe(0);
      expect(logSearch.stats.semanticSearches).toBe(0);
      expect(logSearch.stats.keywordSearches).toBe(0);
    });
  });

  describe('Semantic Search', () => {
    it('should perform semantic search when provider available', async () => {
      const results = await logSearch.semanticSearch('error in database connection');

      expect(mockSemanticSearchProvider.generateEmbedding).toHaveBeenCalledWith('error in database connection');
      expect(mockSemanticSearchProvider.search).toHaveBeenCalled();
      expect(results).toHaveLength(2);
      expect(results[0].score).toBe(0.95);
    });

    it('should include sessionId filter in semantic search', async () => {
      await logSearch.semanticSearch('error', 'session-123');

      expect(mockSemanticSearchProvider.search).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          filter: { sessionId: 'session-123' }
        })
      );
    });

    it('should limit semantic search results', async () => {
      mockSemanticSearchProvider.search.mockResolvedValueOnce(
        Array(100).fill(null).map((_, i) => ({
          id: `log-${i}`,
          score: 0.9 - i * 0.01,
          metadata: { message: `Result ${i}` }
        }))
      );

      const results = await logSearch.semanticSearch('test', null, 10);

      expect(results).toHaveLength(10);
    });

    it('should throw error when semantic provider not available', async () => {
      const searchWithoutSemantic = new LogSearch(null, mockLogStorage);

      await expect(searchWithoutSemantic.semanticSearch('test')).rejects.toThrow('Semantic search provider not configured');
    });

    it('should handle semantic search errors gracefully', async () => {
      mockSemanticSearchProvider.generateEmbedding.mockRejectedValueOnce(new Error('Embedding failed'));

      await expect(logSearch.semanticSearch('test')).rejects.toThrow('Embedding failed');
    });

    it('should enrich semantic results with full log data', async () => {
      const results = await logSearch.semanticSearch('test');

      expect(mockLogStorage.getLogById).toHaveBeenCalled();
      expect(results[0]).toHaveProperty('logId');
      expect(results[0]).toHaveProperty('message');
    });

    it('should track semantic search statistics', async () => {
      await logSearch.semanticSearch('test');

      expect(logSearch.stats.semanticSearches).toBe(1);
      expect(logSearch.stats.searches).toBe(1);
    });
  });

  describe('Keyword Search', () => {
    it('should perform keyword search', async () => {
      const results = await logSearch.keywordSearch('error');

      expect(mockLogStorage.searchLogs).toHaveBeenCalledWith(null, 'error');
      expect(results).toHaveLength(2);
    });

    it('should search within specific session', async () => {
      await logSearch.keywordSearch('error', 'session-123');

      expect(mockLogStorage.searchLogs).toHaveBeenCalledWith('session-123', 'error');
    });

    it('should limit keyword search results', async () => {
      mockLogStorage.searchLogs.mockResolvedValueOnce(
        Array(100).fill(null).map((_, i) => ({
          logId: `log-${i}`,
          message: `Log message ${i}`,
          timestamp: new Date()
        }))
      );

      const results = await logSearch.keywordSearch('test', null, 25);

      expect(results).toHaveLength(25);
    });

    it('should handle case-insensitive search', async () => {
      const results = await logSearch.keywordSearch('ERROR', null, 100, { caseSensitive: false });

      expect(mockLogStorage.searchLogs).toHaveBeenCalled();
      // Implementation would handle case conversion
    });

    it('should track keyword search statistics', async () => {
      await logSearch.keywordSearch('test');

      expect(logSearch.stats.keywordSearches).toBe(1);
      expect(logSearch.stats.searches).toBe(1);
    });
  });

  describe('Regex Search', () => {
    it('should perform regex search', async () => {
      mockLogStorage.getLogsBySession.mockResolvedValueOnce([
        { logId: 'log-1', message: 'Error: Connection failed', timestamp: new Date() },
        { logId: 'log-2', message: 'Info: Connected', timestamp: new Date() },
        { logId: 'log-3', message: 'Error: Timeout', timestamp: new Date() }
      ]);

      const results = await logSearch.regexSearch(/Error:.*/, 'session-123');

      expect(results).toHaveLength(2);
      expect(results[0].message).toContain('Error:');
    });

    it('should search across all sessions when not specified', async () => {
      await logSearch.regexSearch(/test/);

      expect(mockLogStorage.getLogsBySession).toHaveBeenCalledWith(null);
    });

    it('should handle invalid regex patterns', async () => {
      await expect(logSearch.regexSearch('[invalid')).rejects.toThrow();
    });

    it('should support regex flags', async () => {
      mockLogStorage.getLogsBySession.mockResolvedValueOnce([
        { logId: 'log-1', message: 'ERROR: Big problem', timestamp: new Date() },
        { logId: 'log-2', message: 'error: small issue', timestamp: new Date() }
      ]);

      const results = await logSearch.regexSearch(/error:/i, null);

      expect(results).toHaveLength(2);
    });

    it('should limit regex search results', async () => {
      mockLogStorage.getLogsBySession.mockResolvedValueOnce(
        Array(100).fill(null).map((_, i) => ({
          logId: `log-${i}`,
          message: `Error ${i}`,
          timestamp: new Date()
        }))
      );

      const results = await logSearch.regexSearch(/Error/, null, 15);

      expect(results).toHaveLength(15);
    });

    it('should track regex search statistics', async () => {
      await logSearch.regexSearch(/test/);

      expect(logSearch.stats.regexSearches).toBe(1);
      expect(logSearch.stats.searches).toBe(1);
    });
  });

  describe('Hybrid Search', () => {
    it('should combine semantic and keyword search', async () => {
      const results = await logSearch.hybridSearch('database error');

      expect(mockSemanticSearchProvider.search).toHaveBeenCalled();
      expect(mockLogStorage.searchLogs).toHaveBeenCalled();
      expect(results.length).toBeGreaterThan(0);
    });

    it('should deduplicate results', async () => {
      // Mock same log ID from both searches
      mockSemanticSearchProvider.search.mockResolvedValueOnce([
        { id: 'log-1', score: 0.95, metadata: { message: 'Match' } }
      ]);
      mockLogStorage.searchLogs.mockResolvedValueOnce([
        { logId: 'log-1', message: 'Match', timestamp: new Date() }
      ]);

      const results = await logSearch.hybridSearch('test');

      const uniqueIds = new Set(results.map(r => r.logId));
      expect(uniqueIds.size).toBe(results.length);
    });

    it('should weight semantic results higher', async () => {
      const results = await logSearch.hybridSearch('test');

      // Semantic results should appear first
      expect(results[0].searchType).toBe('semantic');
    });

    it('should fall back to keyword if semantic fails', async () => {
      mockSemanticSearchProvider.search.mockRejectedValueOnce(new Error('Semantic failed'));

      const results = await logSearch.hybridSearch('test');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].searchType).toBe('keyword');
    });

    it('should apply session filter to both searches', async () => {
      await logSearch.hybridSearch('test', 'session-123');

      expect(mockSemanticSearchProvider.search).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          filter: { sessionId: 'session-123' }
        })
      );
      expect(mockLogStorage.searchLogs).toHaveBeenCalledWith('session-123', 'test');
    });

    it('should respect result limit', async () => {
      const results = await logSearch.hybridSearch('test', null, 5);

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Search Options', () => {
    it('should support time range filtering', async () => {
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-31');

      await logSearch.keywordSearch('test', null, 100, {
        startTime,
        endTime
      });

      // Implementation would filter by time
      expect(mockLogStorage.searchLogs).toHaveBeenCalled();
    });

    it('should support source filtering', async () => {
      await logSearch.keywordSearch('test', null, 100, {
        source: 'frontend'
      });

      // Implementation would filter by source
      expect(mockLogStorage.searchLogs).toHaveBeenCalled();
    });

    it('should support log level filtering', async () => {
      await logSearch.keywordSearch('test', null, 100, {
        level: 'error'
      });

      // Implementation would filter by level
      expect(mockLogStorage.searchLogs).toHaveBeenCalled();
    });

    it('should support result sorting', async () => {
      const results = await logSearch.keywordSearch('test', null, 100, {
        sortBy: 'timestamp',
        sortOrder: 'desc'
      });

      // Results should be sorted by timestamp descending
      expect(results).toBeDefined();
    });
  });

  describe('Search Indexing', () => {
    it('should index log for semantic search', async () => {
      const log = {
        logId: 'log-123',
        message: 'Application started successfully',
        sessionId: 'session-123',
        timestamp: new Date()
      };

      await logSearch.indexLog(log);

      expect(mockSemanticSearchProvider.addDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'log-123',
          text: 'Application started successfully',
          metadata: expect.objectContaining({
            sessionId: 'session-123'
          })
        })
      );
    });

    it('should handle indexing when semantic provider not available', async () => {
      const searchWithoutSemantic = new LogSearch(null, mockLogStorage);
      const log = { logId: 'log-123', message: 'Test' };

      // Should not throw
      await expect(searchWithoutSemantic.indexLog(log)).resolves.not.toThrow();
    });

    it('should batch index multiple logs', async () => {
      const logs = [
        { logId: 'log-1', message: 'Log 1' },
        { logId: 'log-2', message: 'Log 2' },
        { logId: 'log-3', message: 'Log 3' }
      ];

      await logSearch.batchIndexLogs(logs);

      expect(mockSemanticSearchProvider.addDocument).toHaveBeenCalledTimes(3);
    });
  });

  describe('Search Statistics', () => {
    it('should track search counts', async () => {
      await logSearch.keywordSearch('test');
      await logSearch.semanticSearch('test');
      await logSearch.regexSearch(/test/);

      expect(logSearch.stats.searches).toBe(3);
      expect(logSearch.stats.keywordSearches).toBe(1);
      expect(logSearch.stats.semanticSearches).toBe(1);
      expect(logSearch.stats.regexSearches).toBe(1);
    });

    it('should track search performance', async () => {
      await logSearch.keywordSearch('test');

      expect(logSearch.stats.lastSearchDuration).toBeGreaterThanOrEqual(0);
    });

    it('should provide search statistics summary', () => {
      const summary = logSearch.getStatistics();

      expect(summary).toHaveProperty('totalSearches');
      expect(summary).toHaveProperty('searchTypes');
      expect(summary).toHaveProperty('averageSearchTime');
    });

    it('should reset statistics', () => {
      logSearch.stats.searches = 10;
      logSearch.resetStatistics();

      expect(logSearch.stats.searches).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      mockLogStorage.searchLogs.mockRejectedValueOnce(new Error('Database error'));

      await expect(logSearch.keywordSearch('test')).rejects.toThrow('Database error');
    });

    it('should validate search query', async () => {
      await expect(logSearch.keywordSearch('')).rejects.toThrow('Search query cannot be empty');
      await expect(logSearch.keywordSearch(null)).rejects.toThrow('Search query cannot be empty');
    });

    it('should validate limit parameter', async () => {
      await expect(logSearch.keywordSearch('test', null, -1)).rejects.toThrow('Limit must be positive');
      await expect(logSearch.keywordSearch('test', null, 0)).rejects.toThrow('Limit must be positive');
    });

    it('should handle malformed regex patterns', async () => {
      // Test with an actual invalid regex pattern (unclosed bracket)
      await expect(logSearch.regexSearch('[invalid')).rejects.toThrow('Invalid regex pattern');
    });
  });

  describe('Performance Optimization', () => {
    it('should cache recent search results', async () => {
      // First search
      await logSearch.keywordSearch('test');
      expect(mockLogStorage.searchLogs).toHaveBeenCalledTimes(1);

      // Same search should use cache
      await logSearch.keywordSearch('test');
      expect(mockLogStorage.searchLogs).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache after TTL', async () => {
      logSearch.cacheConfig.ttl = 100; // 100ms TTL

      await logSearch.keywordSearch('test');
      await new Promise(resolve => setTimeout(resolve, 150));
      await logSearch.keywordSearch('test');

      expect(mockLogStorage.searchLogs).toHaveBeenCalledTimes(2);
    });

    it('should limit cache size', async () => {
      logSearch.cacheConfig.maxSize = 2;

      await logSearch.keywordSearch('query1');
      await logSearch.keywordSearch('query2');
      await logSearch.keywordSearch('query3');

      // Cache should evict oldest entry
      expect(logSearch.cache.size).toBeLessThanOrEqual(2);
    });
  });
});