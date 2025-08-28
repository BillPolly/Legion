/**
 * @fileoverview Unit tests for ListSessionsTool - List and filter sessions
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListSessionsTool } from '../../src/tools/ListSessionsTool.js';

describe('ListSessionsTool', () => {
  let listSessionsTool;
  let mockModule;

  beforeEach(() => {
    mockModule = {
      sessionManager: {
        listSessions: jest.fn().mockResolvedValue([
          {
            sessionId: 'session-123',
            projectPath: '/test/project1',
            command: 'npm start',
            status: 'active',
            startTime: new Date('2024-01-01T10:00:00Z'),
            metadata: { port: 3000 }
          },
          {
            sessionId: 'session-456',
            projectPath: '/test/project2',
            command: 'npm test',
            status: 'completed',
            startTime: new Date('2024-01-01T09:00:00Z'),
            endTime: new Date('2024-01-01T09:30:00Z'),
            metadata: {}
          },
          {
            sessionId: 'session-789',
            projectPath: '/test/project3',
            command: 'npm run dev',
            status: 'failed',
            startTime: new Date('2024-01-01T08:00:00Z'),
            endTime: new Date('2024-01-01T08:15:00Z'),
            metadata: { error: 'Port in use' }
          }
        ]),
        getSessionStatistics: jest.fn().mockResolvedValue({
          totalLogs: 1500,
          errorLogs: 23,
          warningLogs: 45,
          processes: 3,
          duration: 1800000 // 30 minutes in ms
        })
      },
      logStorage: {
        getLogCountBySession: jest.fn().mockResolvedValue(500)
      }
    };
    listSessionsTool = new ListSessionsTool(mockModule);
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(listSessionsTool.name).toBe('list_sessions');
    });

    it('should have comprehensive description', () => {
      expect(listSessionsTool.description).toBeTruthy();
      expect(listSessionsTool.description).toContain('List');
      expect(listSessionsTool.description).toContain('sessions');
    });

    it('should have complete JSON Schema for input validation', () => {
      expect(listSessionsTool.inputSchema).toBeDefined();
      expect(listSessionsTool.inputSchema.type).toBe('object');
      expect(listSessionsTool.inputSchema.properties).toBeDefined();
    });

    it('should define all expected filter parameters', () => {
      const properties = listSessionsTool.inputSchema.properties;
      
      // Status filter
      expect(properties.status).toBeDefined();
      expect(properties.status.enum).toContain('active');
      expect(properties.status.enum).toContain('completed');
      expect(properties.status.enum).toContain('failed');
      
      // Project path filter
      expect(properties.projectPath).toBeDefined();
      
      // Time filters
      expect(properties.startedAfter).toBeDefined();
      expect(properties.startedBefore).toBeDefined();
      
      // Pagination
      expect(properties.limit).toBeDefined();
      expect(properties.offset).toBeDefined();
      
      // Additional options
      expect(properties.includeStatistics).toBeDefined();
      expect(properties.sortBy).toBeDefined();
      expect(properties.sortOrder).toBeDefined();
    });

    it('should have proper parameter constraints', () => {
      const properties = listSessionsTool.inputSchema.properties;
      
      // limit should have reasonable bounds
      expect(properties.limit.type).toBe('number');
      expect(properties.limit.minimum).toBeGreaterThan(0);
      expect(properties.limit.maximum).toBeLessThanOrEqual(1000);
      expect(properties.limit.default).toBe(100);
      
      // offset should be non-negative
      expect(properties.offset.type).toBe('number');
      expect(properties.offset.minimum).toBe(0);
      expect(properties.offset.default).toBe(0);
      
      // sortOrder should be enum
      expect(properties.sortOrder.enum).toContain('asc');
      expect(properties.sortOrder.enum).toContain('desc');
    });
  });

  describe('Session Listing', () => {
    it('should list all sessions without filters', async () => {
      const input = {};

      const result = await listSessionsTool.execute(input);

      expect(mockModule.sessionManager.listSessions).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.sessions).toHaveLength(3);
      expect(result.data.totalCount).toBe(3);
    });

    it('should filter sessions by status', async () => {
      const input = {
        status: 'active'
      };

      const result = await listSessionsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.sessions).toHaveLength(1);
      expect(result.data.sessions[0].status).toBe('active');
    });

    it('should filter sessions by project path', async () => {
      const input = {
        projectPath: '/test/project1'
      };

      const result = await listSessionsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.sessions).toHaveLength(1);
      expect(result.data.sessions[0].projectPath).toBe('/test/project1');
    });

    it('should filter sessions by time range', async () => {
      const input = {
        startedAfter: '2024-01-01T08:30:00Z',
        startedBefore: '2024-01-01T10:30:00Z'
      };

      const result = await listSessionsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.sessions).toHaveLength(2); // session-123 and session-456
    });
  });

  describe('Session Statistics', () => {
    it('should include statistics when requested', async () => {
      const input = {
        includeStatistics: true
      };

      const result = await listSessionsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.sessions[0]).toHaveProperty('statistics');
      expect(mockModule.sessionManager.getSessionStatistics).toHaveBeenCalled();
    });

    it('should not include statistics by default', async () => {
      const input = {};

      const result = await listSessionsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.sessions[0]).not.toHaveProperty('statistics');
    });

    it('should include log counts in statistics', async () => {
      const input = {
        includeStatistics: true
      };

      const result = await listSessionsTool.execute(input);

      expect(result.data.sessions[0].statistics).toHaveProperty('totalLogs');
      expect(result.data.sessions[0].statistics).toHaveProperty('errorLogs');
      expect(result.data.sessions[0].statistics).toHaveProperty('warningLogs');
    });
  });

  describe('Sorting', () => {
    it('should sort sessions by startTime descending by default', async () => {
      const input = {};

      const result = await listSessionsTool.execute(input);

      expect(result.data.sessions[0].sessionId).toBe('session-123'); // Most recent
      expect(result.data.sessions[1].sessionId).toBe('session-456');
      expect(result.data.sessions[2].sessionId).toBe('session-789'); // Oldest
    });

    it('should sort sessions by specified field', async () => {
      const input = {
        sortBy: 'status'
      };

      const result = await listSessionsTool.execute(input);

      expect(result.success).toBe(true);
      // Sessions should be sorted by status
    });

    it('should handle ascending sort order', async () => {
      const input = {
        sortBy: 'startTime',
        sortOrder: 'asc'
      };

      const result = await listSessionsTool.execute(input);

      expect(result.data.sessions[0].sessionId).toBe('session-789'); // Oldest
      expect(result.data.sessions[2].sessionId).toBe('session-123'); // Most recent
    });
  });

  describe('Pagination', () => {
    it('should limit results to specified count', async () => {
      const input = {
        limit: 2
      };

      const result = await listSessionsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.sessions).toHaveLength(2);
      expect(result.data.totalCount).toBe(3);
      expect(result.data.pagination.hasMore).toBe(true);
    });

    it('should handle offset for pagination', async () => {
      const input = {
        limit: 2,
        offset: 1
      };

      const result = await listSessionsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.sessions).toHaveLength(2);
      expect(result.data.sessions[0].sessionId).toBe('session-456');
    });

    it('should use default limit when not specified', async () => {
      const input = {};

      const result = await listSessionsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.sessions.length).toBeLessThanOrEqual(100); // Default limit
    });
  });

  describe('Error Handling', () => {
    it('should handle sessionManager failure', async () => {
      mockModule.sessionManager.listSessions.mockRejectedValueOnce(new Error('Database error'));

      const input = {};

      const result = await listSessionsTool.execute(input);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('should handle statistics retrieval failure gracefully', async () => {
      mockModule.sessionManager.getSessionStatistics.mockRejectedValueOnce(new Error('Stats error'));

      const input = {
        includeStatistics: true
      };

      const result = await listSessionsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.sessions[0].statistics).toBeUndefined();
    });

    it('should validate date formats', async () => {
      const input = {
        startedAfter: 'invalid-date'
      };

      const result = await listSessionsTool.execute(input);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Event Emission', () => {
    it('should emit progress events during listing', async () => {
      const progressEvents = [];
      listSessionsTool.on('progress', (data) => progressEvents.push(data));

      const input = {};

      await listSessionsTool.execute(input);

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toEqual(
        expect.objectContaining({
          percentage: expect.any(Number),
          status: expect.any(String)
        })
      );
    });

    it('should emit info events for filtering details', async () => {
      const infoEvents = [];
      listSessionsTool.on('info', (data) => infoEvents.push(data));

      const input = {
        status: 'active'
      };

      await listSessionsTool.execute(input);

      expect(infoEvents.some(event => event.message.includes('Filtering'))).toBe(true);
    });
  });

  describe('Result Format', () => {
    it('should return structured session list', async () => {
      const input = {};

      const result = await listSessionsTool.execute(input);

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            sessions: expect.any(Array),
            totalCount: expect.any(Number),
            filters: expect.any(Object),
            pagination: expect.objectContaining({
              limit: expect.any(Number),
              offset: expect.any(Number),
              hasMore: expect.any(Boolean)
            })
          })
        })
      );
    });

    it('should include session metadata in results', async () => {
      const input = {};

      const result = await listSessionsTool.execute(input);

      const session = result.data.sessions[0];
      expect(session).toHaveProperty('sessionId');
      expect(session).toHaveProperty('projectPath');
      expect(session).toHaveProperty('command');
      expect(session).toHaveProperty('status');
      expect(session).toHaveProperty('startTime');
    });

    it('should format dates as ISO strings', async () => {
      const input = {};

      const result = await listSessionsTool.execute(input);

      const session = result.data.sessions[0];
      expect(typeof session.startTime).toBe('string');
      expect(session.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Complex Filtering', () => {
    it('should combine multiple filters', async () => {
      const input = {
        status: 'completed',
        startedAfter: '2024-01-01T08:00:00Z',
        limit: 10
      };

      const result = await listSessionsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.sessions).toHaveLength(1);
      expect(result.data.sessions[0].status).toBe('completed');
    });

    it('should handle empty filter results', async () => {
      const input = {
        status: 'active',
        projectPath: '/non-existent'
      };

      const result = await listSessionsTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.data.sessions).toHaveLength(0);
      expect(result.data.totalCount).toBe(0);
    });
  });
});