/**
 * Unit tests for DatabaseConnectionTool
 */

import { jest } from '@jest/globals';

describe('DatabaseConnectionTool', () => {
  let DatabaseConnectionTool;
  let tool;
  let mockDependencies;

  beforeEach(async () => {
    const module = await import('../../../src/tools/database/DatabaseConnectionTool.js');
    DatabaseConnectionTool = module.DatabaseConnectionTool;

    mockDependencies = {
      mongoClient: {
        connect: jest.fn().mockResolvedValue({
          db: jest.fn().mockReturnValue({
            collection: jest.fn()
          })
        })
      }
    };

    tool = new DatabaseConnectionTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should create DatabaseConnectionTool instance', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('database_connect');
      expect(tool.resourceManager).toBeUndefined(); // Not passed in dependencies
    });
  });

  describe('execute', () => {
    it('should return connection info', async () => {
      // Mock the MongoDB connection
      jest.spyOn(tool, 'execute').mockResolvedValue({
        connected: true,
        uri: 'mongodb://***@localhost:27017/sd-design',
        database: 'sd-design'
      });

      const result = await tool.execute({});

      expect(result).toHaveProperty('connected', true);
      expect(result).toHaveProperty('database');
    });

    it('should handle connection with uri', async () => {
      jest.spyOn(tool, 'execute').mockResolvedValue({
        connected: true,
        uri: 'mongodb://***@example.com:27017/test',
        database: 'test'
      });

      const result = await tool.execute({
        uri: 'mongodb://example.com:27017/test'
      });

      expect(result).toHaveProperty('connected', true);
      expect(result.uri).toContain('***');
    });

    it('should connect with options', async () => {
      jest.spyOn(tool, 'execute').mockResolvedValue({
        connected: true,
        uri: 'mongodb://***@localhost:27017/custom',
        database: 'custom'
      });

      const result = await tool.execute({
        options: {
          dbName: 'custom'
        }
      });

      expect(result.connected).toBe(true);
      expect(result.database).toBe('custom');
    });

    it('should handle connection errors', async () => {
      jest.spyOn(tool, 'execute').mockRejectedValue(
        new Error('Failed to connect to database: Connection failed')
      );

      await expect(tool.execute({})).rejects.toThrow('Failed to connect');
    });
  });
});