/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { LogSearchEnhanced } from '../../src/search/LogSearchEnhanced.js';
import { 
  MockSemanticSearchProvider, 
  MockStorageProvider, 
  MockResourceManager,
  generateTestLogs,
  sleep
} from '../utils/TestUtils.js';

describe('LogSearchEnhanced Unit Tests', () => {
  let logSearch;
  let mockSemanticProvider;
  let mockStorageProvider;
  let mockResourceManager;

  beforeEach(() => {
    mockSemanticProvider = new MockSemanticSearchProvider();
    mockStorageProvider = new MockStorageProvider();
    mockResourceManager = new MockResourceManager();
    
    // This class doesn't exist yet - will be created by TDD
    logSearch = new LogSearchEnhanced({
      semanticSearchProvider: mockSemanticProvider,
      storageProvider: mockStorageProvider,
      resourceManager: mockResourceManager
    });
  });

  afterEach(() => {
    mockSemanticProvider.reset();
    mockStorageProvider.reset();
    mockResourceManager.reset();
  });

  describe('Initialization', () => {
    test('should initialize with required dependencies', () => {
      expect(logSearch.semanticSearchProvider).toBe(mockSemanticProvider);
      expect(logSearch.storageProvider).toBe(mockStorageProvider);
      expect(logSearch.resourceManager).toBe(mockResourceManager);
    });

    test('should initialize without semantic provider', () => {
      const searchWithoutSemantic = new LogSearchEnhanced({
        storageProvider: mockStorageProvider,
        resourceManager: mockResourceManager
      });
      
      expect(searchWithoutSemantic.semanticSearchProvider).toBeNull();
      expect(searchWithoutSemantic.storageProvider).toBe(mockStorageProvider);
    });

    test('should throw error if required dependencies missing', () => {
      expect(() => {
        new LogSearchEnhanced({});
      }).toThrow('StorageProvider is required');
    });

    test('should initialize search statistics', () => {
      const stats = logSearch.getStatistics();
      expect(stats.totalSearches).toBe(0);
      expect(stats.searchTypes.semantic).toBe(0);
      expect(stats.searchTypes.keyword).toBe(0);
      expect(stats.searchTypes.regex).toBe(0);
      expect(stats.searchTypes.hybrid).toBe(0);
    });
  });

  describe('Semantic Search', () => {
    beforeEach(async () => {
      // Add test logs to semantic provider
      const testLogs = generateTestLogs(10);
      for (const log of testLogs) {
        await mockSemanticProvider.addDocument({
          id: log.logId,
          text: log.message,
          metadata: {
            sessionId: log.sessionId,
            timestamp: log.timestamp,
            source: log.source,
            level: log.level
          }
        });
        await mockStorageProvider.store('logs', log);
      }
    });

    test('should perform semantic search with results', async () => {
      const results = await logSearch.semanticSearch('Test message', 'test-session', 5);
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('searchType', 'semantic');
      expect(results[0]).toHaveProperty('logId');
      expect(results[0]).toHaveProperty('message');
    });

    test('should filter semantic search by sessionId', async () => {
      const results = await logSearch.semanticSearch('Test', 'test-session');
      
      results.forEach(result => {
        expect(result.sessionId).toBe('test-session');
      });
    });

    test('should respect limit parameter', async () => {
      const results = await logSearch.semanticSearch('Test', null, 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    test('should throw error if semantic provider not configured', async () => {
      const searchWithoutSemantic = new LogSearchEnhanced({
        storageProvider: mockStorageProvider,
        resourceManager: mockResourceManager
      });

      await expect(
        searchWithoutSemantic.semanticSearch('query')
      ).rejects.toThrow('Semantic search provider not configured');
    });

    test('should update semantic search statistics', async () => {
      const initialStats = logSearch.getStatistics();
      
      await logSearch.semanticSearch('Test message');
      
      const updatedStats = logSearch.getStatistics();
      expect(updatedStats.totalSearches).toBe(initialStats.totalSearches + 1);
      expect(updatedStats.searchTypes.semantic).toBe(initialStats.searchTypes.semantic + 1);
      expect(updatedStats.lastSearchDuration).toBeGreaterThan(0);
    });
  });

  describe('Keyword Search', () => {
    beforeEach(async () => {
      const testLogs = generateTestLogs(20, {
        messagePrefix: 'Application',
        sources: ['stdout', 'stderr', 'system']
      });
      
      for (const log of testLogs) {
        await mockStorageProvider.store('logs', log);
      }
    });

    test('should perform keyword search', async () => {
      const results = await logSearch.keywordSearch('Application', 'test-session', 10);
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('searchType', 'keyword');
      results.forEach(result => {
        expect(result.message).toContain('Application');
      });
    });

    test('should be case insensitive', async () => {
      const results = await logSearch.keywordSearch('application', 'test-session');
      expect(results.length).toBeGreaterThan(0);
    });

    test('should throw error for empty query', async () => {
      await expect(
        logSearch.keywordSearch('')
      ).rejects.toThrow('Search query cannot be empty');
      
      await expect(
        logSearch.keywordSearch('   ')
      ).rejects.toThrow('Search query cannot be empty');
    });

    test('should throw error for invalid limit', async () => {
      await expect(
        logSearch.keywordSearch('test', null, 0)
      ).rejects.toThrow('Limit must be positive');
      
      await expect(
        logSearch.keywordSearch('test', null, -5)
      ).rejects.toThrow('Limit must be positive');
    });

    test('should cache search results', async () => {
      const query = 'Application';
      const sessionId = 'test-session';
      
      // First search
      const results1 = await logSearch.keywordSearch(query, sessionId);
      
      // Second search (should be cached)
      const results2 = await logSearch.keywordSearch(query, sessionId);
      
      expect(results1).toEqual(results2);
      
      // Verify cache was used by checking cache size
      const stats = logSearch.getStatistics();
      expect(stats.cacheSize).toBe(1);
    });

    test('should update keyword search statistics', async () => {
      const initialStats = logSearch.getStatistics();
      
      await logSearch.keywordSearch('Application');
      
      const updatedStats = logSearch.getStatistics();
      expect(updatedStats.totalSearches).toBe(initialStats.totalSearches + 1);
      expect(updatedStats.searchTypes.keyword).toBe(initialStats.searchTypes.keyword + 1);
    });
  });

  describe('Regex Search', () => {
    beforeEach(async () => {
      const testLogs = [
        { logId: '1', sessionId: 'session1', message: 'Error: Connection failed' },
        { logId: '2', sessionId: 'session1', message: 'Warning: Low memory' },
        { logId: '3', sessionId: 'session1', message: 'Info: Process started' },
        { logId: '4', sessionId: 'session1', message: 'Error: Database timeout' },
        { logId: '5', sessionId: 'session2', message: 'Debug: Cache cleared' }
      ];

      for (const log of testLogs) {
        await mockStorageProvider.store('logs', log);
      }
    });

    test('should perform regex search with string pattern', async () => {
      const results = await logSearch.regexSearch('Error:', 'session1');
      
      expect(results.length).toBe(2);
      results.forEach(result => {
        expect(result.message).toMatch(/Error:/);
        expect(result.searchType).toBe('regex');
      });
    });

    test('should perform regex search with RegExp object', async () => {
      const pattern = /^(Error|Warning):/;
      const results = await logSearch.regexSearch(pattern, 'session1');
      
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result.message).toMatch(pattern);
      });
    });

    test('should respect limit parameter', async () => {
      const results = await logSearch.regexSearch('.*', 'session1', 2);
      expect(results.length).toBe(2);
    });

    test('should throw error for invalid regex', async () => {
      await expect(
        logSearch.regexSearch('[invalid(regex')
      ).rejects.toThrow('Invalid regex pattern');
    });

    test('should throw error for invalid pattern type', async () => {
      await expect(
        logSearch.regexSearch(123)
      ).rejects.toThrow('Pattern must be a RegExp or string');
    });

    test('should update regex search statistics', async () => {
      const initialStats = logSearch.getStatistics();
      
      await logSearch.regexSearch('Error:');
      
      const updatedStats = logSearch.getStatistics();
      expect(updatedStats.totalSearches).toBe(initialStats.totalSearches + 1);
      expect(updatedStats.searchTypes.regex).toBe(initialStats.searchTypes.regex + 1);
    });
  });

  describe('Hybrid Search', () => {
    beforeEach(async () => {
      const testLogs = generateTestLogs(15, {
        messagePrefix: 'System',
        levels: ['info', 'warn', 'error', 'debug']
      });
      
      // Add to both storage and semantic provider
      for (const log of testLogs) {
        await mockStorageProvider.store('logs', log);
        await mockSemanticProvider.addDocument({
          id: log.logId,
          text: log.message,
          metadata: {
            sessionId: log.sessionId,
            timestamp: log.timestamp
          }
        });
      }
    });

    test('should combine semantic and keyword search results', async () => {
      const results = await logSearch.hybridSearch('System message', 'test-session', 10);
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(10);
      
      // Should include results from both search types
      const searchTypes = new Set(results.map(r => r.searchType));
      expect(searchTypes.size).toBeGreaterThan(0);
    });

    test('should deduplicate results', async () => {
      const results = await logSearch.hybridSearch('System', 'test-session');
      
      const logIds = results.map(r => r.logId);
      const uniqueLogIds = new Set(logIds);
      
      expect(logIds.length).toBe(uniqueLogIds.size);
    });

    test('should fallback to keyword search if semantic fails', async () => {
      // Create search without semantic provider
      const searchWithoutSemantic = new LogSearchEnhanced({
        storageProvider: mockStorageProvider,
        resourceManager: mockResourceManager
      });

      const results = await searchWithoutSemantic.hybridSearch('System', 'test-session');
      expect(results.length).toBeGreaterThan(0);
    });

    test('should update hybrid search statistics', async () => {
      const initialStats = logSearch.getStatistics();
      
      await logSearch.hybridSearch('System');
      
      const updatedStats = logSearch.getStatistics();
      expect(updatedStats.totalSearches).toBe(initialStats.totalSearches + 1);
      expect(updatedStats.searchTypes.hybrid).toBe(initialStats.searchTypes.hybrid + 1);
    });
  });

  describe('Log Indexing', () => {
    test('should index single log for semantic search', async () => {
      const log = {
        logId: 'index-test-1',
        sessionId: 'test-session',
        message: 'Indexing test message',
        timestamp: new Date(),
        source: 'stdout',
        level: 'info'
      };

      await logSearch.indexLog(log);
      
      const providerStats = mockSemanticProvider.getStats();
      expect(providerStats.totalDocuments).toBe(1);
    });

    test('should batch index multiple logs', async () => {
      const logs = generateTestLogs(5, { messagePrefix: 'Batch index' });
      
      await logSearch.batchIndexLogs(logs);
      
      const providerStats = mockSemanticProvider.getStats();
      expect(providerStats.totalDocuments).toBe(5);
    });

    test('should handle indexing without semantic provider', async () => {
      const searchWithoutSemantic = new LogSearchEnhanced({
        storageProvider: mockStorageProvider,
        resourceManager: mockResourceManager
      });

      const log = generateTestLogs(1)[0];
      
      // Should not throw error
      await expect(searchWithoutSemantic.indexLog(log)).resolves.toBeUndefined();
    });
  });

  describe('Cache Management', () => {
    test('should manage cache size limit', async () => {
      // Configure small cache for testing
      logSearch.cacheConfig.maxSize = 3;
      
      // Perform multiple searches to fill cache
      for (let i = 0; i < 5; i++) {
        await logSearch.keywordSearch(`query-${i}`, 'test-session');
      }
      
      const stats = logSearch.getStatistics();
      expect(stats.cacheSize).toBeLessThanOrEqual(3);
    });

    test('should clear cache on command', async () => {
      await logSearch.keywordSearch('test query', 'test-session');
      
      let stats = logSearch.getStatistics();
      expect(stats.cacheSize).toBeGreaterThan(0);
      
      logSearch.clearCache();
      
      stats = logSearch.getStatistics();
      expect(stats.cacheSize).toBe(0);
    });

    test('should expire cache entries', async () => {
      // Set very short TTL for testing
      logSearch.cacheConfig.ttl = 10; // 10ms
      
      await logSearch.keywordSearch('expiry test', 'test-session');
      
      // Wait for cache to expire
      await sleep(20);
      
      // This search should not use cache (will be slower)
      await logSearch.keywordSearch('expiry test', 'test-session');
      
      // Cache should be refreshed
      const stats = logSearch.getStatistics();
      expect(stats.cacheSize).toBeGreaterThan(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track search performance metrics', async () => {
      await logSearch.keywordSearch('performance test');
      
      const stats = logSearch.getStatistics();
      expect(stats.averageSearchTime).toBeGreaterThanOrEqual(0);
      expect(stats.lastSearchDuration).toBeGreaterThanOrEqual(0);
      expect(stats.totalSearches).toBe(1);
    });

    test('should reset statistics', async () => {
      await logSearch.keywordSearch('reset test');
      
      let stats = logSearch.getStatistics();
      expect(stats.totalSearches).toBe(1);
      
      logSearch.resetStatistics();
      
      stats = logSearch.getStatistics();
      expect(stats.totalSearches).toBe(0);
      expect(stats.averageSearchTime).toBe(0);
    });

    test('should calculate average search time correctly', async () => {
      await logSearch.keywordSearch('avg test 1');
      await logSearch.keywordSearch('avg test 2');
      
      const stats = logSearch.getStatistics();
      expect(stats.totalSearches).toBe(2);
      expect(stats.averageSearchTime).toBe(stats.totalSearchTime / 2);
    });
  });

  describe('Error Handling', () => {
    test('should handle storage provider errors gracefully', async () => {
      // Mock storage provider to throw error
      mockStorageProvider.query = jest.fn().mockRejectedValue(new Error('Storage error'));
      
      await expect(
        logSearch.keywordSearch('error test')
      ).rejects.toThrow('Storage error');
    });

    test('should handle semantic provider errors gracefully', async () => {
      // Mock semantic provider to throw error
      mockSemanticProvider.generateEmbedding = jest.fn().mockRejectedValue(new Error('Embedding error'));
      
      await expect(
        logSearch.semanticSearch('error test')
      ).rejects.toThrow('Embedding error');
    });

    test('should continue hybrid search if one provider fails', async () => {
      // Make semantic search fail
      mockSemanticProvider.generateEmbedding = jest.fn().mockRejectedValue(new Error('Semantic fail'));
      
      // But keyword search should still work
      const testLogs = generateTestLogs(5);
      for (const log of testLogs) {
        await mockStorageProvider.store('logs', log);
      }
      
      const results = await logSearch.hybridSearch('Test message');
      expect(results.length).toBeGreaterThan(0);
    });
  });
});