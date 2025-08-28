/**
 * @fileoverview Unit tests for SearchLogsTool - Log search and retrieval
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SearchLogsTool } from '../../src/tools/SearchLogsTool.js';

describe('SearchLogsTool', () => {
  let searchLogsTool;
  let mockModule;

  beforeEach(() => {
    mockModule = {
      logStorage: {
        searchLogs: jest.fn().mockResolvedValue([
          { logId: 'log-1', message: 'Starting server', timestamp: new Date() },
          { logId: 'log-2', message: 'Server started on port 3000', timestamp: new Date() }
        ]),
        getLogsBySession: jest.fn().mockResolvedValue([
          { logId: 'log-1', message: 'Test log', timestamp: new Date() }
        ]),
        getLogsInTimeRange: jest.fn().mockResolvedValue([
          { logId: 'log-3', message: 'Time range log', timestamp: new Date() }
        ]),
        getLogsBySource: jest.fn().mockResolvedValue([
          { logId: 'log-4', source: 'stderr', message: 'Error log', timestamp: new Date() }
        ])
      },
      logSearch: {
        semanticSearch: jest.fn().mockResolvedValue([
          { logId: 'log-5', message: 'Semantic result', score: 0.95, timestamp: new Date() }
        ]),
        keywordSearch: jest.fn().mockResolvedValue([
          { logId: 'log-6', message: 'Keyword result', searchType: 'keyword', timestamp: new Date() }
        ]),
        regexSearch: jest.fn().mockResolvedValue([
          { logId: 'log-7', message: 'Regex match', searchType: 'regex', timestamp: new Date() }
        ]),
        hybridSearch: jest.fn().mockResolvedValue([
          { logId: 'log-8', message: 'Hybrid result', searchType: 'hybrid', timestamp: new Date() }
        ])
      },
      sessionManager: {
        getSession: jest.fn().mockResolvedValue({
          sessionId: 'session-123',
          status: 'active',
          projectPath: '/test/project'
        }),
        listSessions: jest.fn().mockResolvedValue([
          { sessionId: 'session-123', status: 'active' },
          { sessionId: 'session-456', status: 'completed' }
        ])
      }
    };
    searchLogsTool = new SearchLogsTool(mockModule);
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(searchLogsTool.name).toBe('search_logs');
    });

    it('should have comprehensive description', () => {
      expect(searchLogsTool.description).toBeTruthy();
      expect(searchLogsTool.description).toContain('Search');
      expect(searchLogsTool.description).toContain('logs');
    });

    it('should have complete JSON Schema for input validation', () => {
      expect(searchLogsTool.inputSchema).toBeDefined();
      expect(searchLogsTool.inputSchema.type).toBe('object');
      expect(searchLogsTool.inputSchema.properties).toBeDefined();
    });

    it('should define all expected search parameters', () => {
      const properties = searchLogsTool.inputSchema.properties;
      
      // Core search parameters
      expect(properties.query).toBeDefined();
      expect(properties.sessionId).toBeDefined();
      expect(properties.searchMode).toBeDefined();
      
      // Filtering parameters
      expect(properties.source).toBeDefined();
      expect(properties.startTime).toBeDefined();
      expect(properties.endTime).toBeDefined();
      
      // Result control
      expect(properties.limit).toBeDefined();
      expect(properties.offset).toBeDefined();
    });

    it('should have proper parameter constraints', () => {
      const properties = searchLogsTool.inputSchema.properties;
      
      // query should be string with minimum length
      expect(properties.query.type).toBe('string');
      expect(properties.query.minLength).toBeGreaterThan(0);
      
      // searchMode should be enum
      expect(properties.searchMode.enum).toContain('keyword');
      expect(properties.searchMode.enum).toContain('semantic');
      expect(properties.searchMode.enum).toContain('regex');
      expect(properties.searchMode.enum).toContain('hybrid');
      
      // limit should have reasonable bounds
      expect(properties.limit.type).toBe('number');
      expect(properties.limit.minimum).toBeGreaterThan(0);
      expect(properties.limit.maximum).toBeLessThanOrEqual(1000);
    });
  });

  describe('Search Modes', () => {
    it('should perform keyword search', async () => {
      const input = {
        query: 'server started',
        searchMode: 'keyword'
      };

      const result = await searchLogsTool.execute(input);

      expect(mockModule.logSearch.keywordSearch).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.logs).toBeDefined();
      expect(result.data.searchMode).toBe('keyword');
    });

    it('should perform semantic search', async () => {
      const input = {
        query: 'application initialization',
        searchMode: 'semantic'
      };

      const result = await searchLogsTool.execute(input);

      expect(mockModule.logSearch.semanticSearch).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.searchMode).toBe('semantic');
    });

    it('should perform regex search', async () => {
      const input = {
        query: 'error.*failed',
        searchMode: 'regex'
      };

      const result = await searchLogsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.searchMode).toBe('regex');
    });

    it('should default to keyword search mode', async () => {
      const input = {
        query: 'test query'
        // No searchMode specified
      };

      const result = await searchLogsTool.execute(input);

      expect(result.data.searchMode).toBe('keyword');
    });
  });

  describe('Session Filtering', () => {
    it('should search within specific session', async () => {
      const input = {
        query: 'test',
        sessionId: 'session-123'
      };

      const result = await searchLogsTool.execute(input);

      expect(mockModule.logSearch.keywordSearch).toHaveBeenCalledWith('test', 'session-123', 100);
      expect(result.success).toBe(true);
      expect(result.data.sessionId).toBe('session-123');
    });

    it('should search across all sessions when not specified', async () => {
      const input = {
        query: 'global search'
      };

      const result = await searchLogsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.sessionId).toBeUndefined();
    });

    it('should validate session exists', async () => {
      mockModule.sessionManager.getSession.mockResolvedValueOnce(null);

      const input = {
        query: 'test',
        sessionId: 'non-existent'
      };

      const result = await searchLogsTool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session not found');
    });
  });

  describe('Time-based Filtering', () => {
    it('should filter logs by time range', async () => {
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-31');

      const input = {
        query: 'test',
        sessionId: 'session-123',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      };

      const result = await searchLogsTool.execute(input);

      expect(mockModule.logStorage.getLogsInTimeRange).toHaveBeenCalledWith(
        'session-123',
        expect.any(Date),
        expect.any(Date)
      );
      expect(result.success).toBe(true);
    });

    it('should handle start time only', async () => {
      const input = {
        query: 'test',
        startTime: new Date('2024-01-01').toISOString()
      };

      const result = await searchLogsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.filters).toHaveProperty('startTime');
    });

    it('should handle end time only', async () => {
      const input = {
        query: 'test',
        endTime: new Date('2024-01-31').toISOString()
      };

      const result = await searchLogsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.filters).toHaveProperty('endTime');
    });
  });

  describe('Source Filtering', () => {
    it('should filter logs by source type', async () => {
      const input = {
        query: 'error',
        sessionId: 'session-123',
        source: 'stderr'
      };

      const result = await searchLogsTool.execute(input);

      expect(mockModule.logStorage.getLogsBySource).toHaveBeenCalledWith('session-123', 'stderr');
      expect(result.success).toBe(true);
      expect(result.data.filters).toHaveProperty('source', 'stderr');
    });

    it('should validate source type', async () => {
      const input = {
        query: 'test',
        source: 'invalid-source'
      };

      const result = await searchLogsTool.execute(input);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Result Pagination', () => {
    it('should limit results to specified count', async () => {
      mockModule.logSearch.keywordSearch.mockResolvedValueOnce(
        Array(100).fill(null).map((_, i) => ({ 
          logId: `log-${i}`, 
          message: `Log ${i}`, 
          timestamp: new Date(),
          searchType: 'keyword'
        }))
      );

      const input = {
        query: 'test',
        limit: 10
      };

      const result = await searchLogsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.logs.length).toBeLessThanOrEqual(10);
      expect(result.data.totalResults).toBeGreaterThanOrEqual(10); // Now based on LogSearch results
    });

    it('should handle offset for pagination', async () => {
      const input = {
        query: 'test',
        limit: 10,
        offset: 20
      };

      const result = await searchLogsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.pagination).toEqual({
        limit: 10,
        offset: 20,
        hasMore: expect.any(Boolean)
      });
    });

    it('should use default limit when not specified', async () => {
      const input = {
        query: 'test'
      };

      const result = await searchLogsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.logs.length).toBeLessThanOrEqual(100); // Default limit
    });
  });

  describe('Error Handling', () => {
    it('should handle search failure', async () => {
      mockModule.logSearch.keywordSearch.mockRejectedValueOnce(new Error('Search failed'));

      const input = {
        query: 'test'
      };

      const result = await searchLogsTool.execute(input);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Search failed');
    });

    it('should handle semantic search unavailable', async () => {
      mockModule.logSearch.semanticSearch.mockRejectedValueOnce(new Error('Semantic search unavailable'));

      const input = {
        query: 'test',
        searchMode: 'semantic'
      };

      // Should fall back to keyword search
      const result = await searchLogsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.searchMode).toBe('keyword');
      expect(result.data.warning).toContain('Falling back to keyword search');
    });

    it('should require query parameter', async () => {
      const input = {
        sessionId: 'session-123'
        // Missing query
      };

      const result = await searchLogsTool.execute(input);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Event Emission', () => {
    it('should emit progress events during search', async () => {
      const progressEvents = [];
      searchLogsTool.on('progress', (data) => progressEvents.push(data));

      const input = {
        query: 'test'
      };

      await searchLogsTool.execute(input);

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toEqual(
        expect.objectContaining({
          percentage: expect.any(Number),
          status: expect.any(String)
        })
      );
    });

    it('should emit info events for search details', async () => {
      const infoEvents = [];
      searchLogsTool.on('info', (data) => infoEvents.push(data));

      const input = {
        query: 'test',
        searchMode: 'semantic'
      };

      await searchLogsTool.execute(input);

      expect(infoEvents.some(event => event.message.includes('semantic search'))).toBe(true);
    });
  });

  describe('Result Format', () => {
    it('should return structured search results', async () => {
      const input = {
        query: 'test',
        sessionId: 'session-123'
      };

      const result = await searchLogsTool.execute(input);

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            logs: expect.any(Array),
            totalResults: expect.any(Number),
            searchMode: expect.any(String),
            sessionId: 'session-123',
            query: 'test'
          })
        })
      );
    });

    it('should include log metadata in results', async () => {
      const input = {
        query: 'test'
      };

      const result = await searchLogsTool.execute(input);

      if (result.data.logs.length > 0) {
        expect(result.data.logs[0]).toHaveProperty('logId');
        expect(result.data.logs[0]).toHaveProperty('message');
        expect(result.data.logs[0]).toHaveProperty('timestamp');
      }
    });
  });
});