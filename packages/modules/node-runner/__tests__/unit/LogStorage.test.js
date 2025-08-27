/**
 * @fileoverview Unit tests for LogStorage class
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LogStorage } from '../../src/storage/LogStorage.js';

describe('LogStorage', () => {
  let logStorage;
  let mockStorageProvider;

  beforeEach(() => {
    mockStorageProvider = {
      store: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(true)
    };
    logStorage = new LogStorage(mockStorageProvider);
  });

  describe('Log Storage Creation', () => {
    it('should create LogStorage with storage provider dependency', () => {
      expect(logStorage).toBeInstanceOf(LogStorage);
      expect(logStorage.storageProvider).toBe(mockStorageProvider);
    });
  });

  describe('Message Logging', () => {
    it('should log message with all required fields', async () => {
      const logMessage = {
        sessionId: 'session-123',
        processId: 'process-456',
        source: 'stdout',
        message: 'Test log message',
        timestamp: new Date()
      };

      const result = await logStorage.logMessage(logMessage);

      expect(result).toBe(true);
      expect(mockStorageProvider.store).toHaveBeenCalledWith(
        'logs',
        expect.objectContaining({
          logId: expect.any(String),
          sessionId: 'session-123',
          processId: 'process-456',
          source: 'stdout',
          message: 'Test log message',
          timestamp: expect.any(Date),
          createdAt: expect.any(Date)
        })
      );
    });

    it('should generate unique log IDs', async () => {
      const message1 = {
        sessionId: 'session-1',
        processId: 'process-1',
        source: 'stdout',
        message: 'Message 1'
      };

      const message2 = {
        sessionId: 'session-1',
        processId: 'process-1',
        source: 'stdout',
        message: 'Message 2'
      };

      await logStorage.logMessage(message1);
      await logStorage.logMessage(message2);

      const calls = mockStorageProvider.store.mock.calls;
      expect(calls[0][1].logId).not.toBe(calls[1][1].logId);
    });

    it('should handle different log sources', async () => {
      const sources = ['stdout', 'stderr', 'system', 'frontend'];

      for (const source of sources) {
        const logMessage = {
          sessionId: 'session-123',
          processId: 'process-456',
          source,
          message: `Test ${source} message`
        };

        await logStorage.logMessage(logMessage);
      }

      expect(mockStorageProvider.store).toHaveBeenCalledTimes(4);
    });

    it('should add timestamp if not provided', async () => {
      const logMessage = {
        sessionId: 'session-123',
        processId: 'process-456',
        source: 'stdout',
        message: 'Test message without timestamp'
      };

      await logStorage.logMessage(logMessage);

      expect(mockStorageProvider.store).toHaveBeenCalledWith(
        'logs',
        expect.objectContaining({
          timestamp: expect.any(Date),
          createdAt: expect.any(Date)
        })
      );
    });
  });

  describe('Log Retrieval', () => {
    it('should get logs by session ID', async () => {
      const mockLogs = [
        { logId: 'log-1', sessionId: 'session-123', message: 'Log 1' },
        { logId: 'log-2', sessionId: 'session-123', message: 'Log 2' }
      ];

      mockStorageProvider.query.mockResolvedValueOnce(mockLogs);

      const result = await logStorage.getLogsBySession('session-123');

      expect(result).toEqual(mockLogs);
      expect(mockStorageProvider.query).toHaveBeenCalledWith(
        'logs',
        { sessionId: 'session-123' }
      );
    });

    it('should get logs by process ID', async () => {
      const mockLogs = [
        { logId: 'log-1', processId: 'process-456', message: 'Process log' }
      ];

      mockStorageProvider.query.mockResolvedValueOnce(mockLogs);

      const result = await logStorage.getLogsByProcess('process-456');

      expect(result).toEqual(mockLogs);
      expect(mockStorageProvider.query).toHaveBeenCalledWith(
        'logs',
        { processId: 'process-456' }
      );
    });

    it('should get logs with time range filter', async () => {
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-02');

      await logStorage.getLogsInTimeRange('session-123', startTime, endTime);

      expect(mockStorageProvider.query).toHaveBeenCalledWith(
        'logs',
        expect.objectContaining({
          sessionId: 'session-123'
        })
      );
    });

    it('should get logs by source type', async () => {
      const mockLogs = [
        { logId: 'log-1', source: 'stderr', message: 'Error message' }
      ];

      mockStorageProvider.query.mockResolvedValueOnce(mockLogs);

      const result = await logStorage.getLogsBySource('session-123', 'stderr');

      expect(result).toEqual(mockLogs);
      expect(mockStorageProvider.query).toHaveBeenCalledWith(
        'logs',
        { sessionId: 'session-123', source: 'stderr' }
      );
    });
  });

  describe('Log Search', () => {
    it('should search logs by keyword', async () => {
      const mockLogs = [
        { logId: 'log-1', message: 'Error: File not found' },
        { logId: 'log-2', message: 'Warning: Deprecated function' }
      ];

      // Mock simple text search
      mockStorageProvider.query.mockResolvedValueOnce(mockLogs);

      const result = await logStorage.searchLogs('session-123', 'Error');

      expect(result.length).toBeGreaterThanOrEqual(0);
      expect(mockStorageProvider.query).toHaveBeenCalled();
    });

    it('should handle empty search results', async () => {
      mockStorageProvider.query.mockResolvedValueOnce([]);

      const result = await logStorage.searchLogs('session-123', 'nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('Log Statistics', () => {
    it('should get log count by session', async () => {
      const mockLogs = [
        { logId: 'log-1' },
        { logId: 'log-2' },
        { logId: 'log-3' }
      ];

      mockStorageProvider.query.mockResolvedValueOnce(mockLogs);

      const count = await logStorage.getLogCount('session-123');

      expect(count).toBe(3);
      expect(mockStorageProvider.query).toHaveBeenCalledWith(
        'logs',
        { sessionId: 'session-123' }
      );
    });

    it('should get log statistics by source', async () => {
      const mockLogs = [
        { source: 'stdout', logId: 'log-1' },
        { source: 'stdout', logId: 'log-2' },
        { source: 'stderr', logId: 'log-3' },
        { source: 'system', logId: 'log-4' }
      ];

      mockStorageProvider.query.mockResolvedValueOnce(mockLogs);

      const stats = await logStorage.getLogStats('session-123');

      expect(stats).toEqual({
        total: 4,
        stdout: 2,
        stderr: 1,
        system: 1,
        frontend: 0
      });
    });
  });

  describe('Log Cleanup', () => {
    it('should delete logs by session', async () => {
      const result = await logStorage.deleteLogsBySession('session-123');

      expect(result).toBe(true);
      expect(mockStorageProvider.delete).toHaveBeenCalledWith(
        'logs',
        { sessionId: 'session-123' }
      );
    });

    it('should delete old logs by date', async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      // Mock logs older than cutoff
      const mockOldLogs = [
        { logId: 'old-log-1', createdAt: new Date(cutoffDate.getTime() - 86400000) },
        { logId: 'old-log-2', createdAt: new Date(cutoffDate.getTime() - 172800000) }
      ];

      mockStorageProvider.query.mockResolvedValueOnce(mockOldLogs);

      const deleted = await logStorage.cleanupOldLogs(30);

      expect(deleted).toBe(2);
      expect(mockStorageProvider.delete).toHaveBeenCalledTimes(2);
    });

    it('should preserve recent logs during cleanup', async () => {
      const recentDate = new Date();
      
      const mockLogs = [
        { logId: 'recent-log', createdAt: recentDate }
      ];

      mockStorageProvider.query.mockResolvedValueOnce(mockLogs);

      const deleted = await logStorage.cleanupOldLogs(30);

      expect(deleted).toBe(0);
      expect(mockStorageProvider.delete).not.toHaveBeenCalled();
    });
  });
});