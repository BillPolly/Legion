/**
 * Simple unit tests for OperationsManager
 */

import { jest, describe, test, beforeEach, expect } from '@jest/globals';
import { OperationsManager } from '../../src/core/OperationsManager.js';

describe('OperationsManager', () => {
  let opsManager;
  let mockDatabase;

  beforeEach(() => {
    // Simple mock database
    mockDatabase = {
      mongoProvider: {
        find: jest.fn().mockResolvedValue([]),
        updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
        deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 })
      }
    };
    
    opsManager = new OperationsManager(mockDatabase);
  });

  describe('Tool ID Generation', () => {
    test('should generate simple moduleName.toolName ID', () => {
      const toolId = opsManager.generateToolId('calculator', 'math');
      expect(toolId).toBe('math.calculator');
    });

    test('should generate module ID as module name', () => {
      const moduleId = opsManager.generateModuleId('math');
      expect(moduleId).toBe('math');
    });
  });

  describe('Database Operations', () => {
    test('should get tools from database', async () => {
      const mockTools = [{ name: 'test', _id: 'test.tool' }];
      mockDatabase.mongoProvider.find.mockResolvedValue(mockTools);

      const result = await opsManager.getTools();
      
      expect(result).toEqual(mockTools);
      expect(mockDatabase.mongoProvider.find).toHaveBeenCalledWith('tools', {});
    });

    test('should get single tool by name', async () => {
      const mockTool = { name: 'calculator', _id: 'math.calculator' };
      mockDatabase.mongoProvider.find.mockResolvedValue([mockTool]);

      const result = await opsManager.getTool('calculator');
      
      expect(result).toEqual(mockTool);
      expect(mockDatabase.mongoProvider.find).toHaveBeenCalledWith('tools', { name: 'calculator' });
    });

    test('should return null if tool not found', async () => {
      mockDatabase.mongoProvider.find.mockResolvedValue([]);

      const result = await opsManager.getTool('nonexistent');
      
      expect(result).toBeNull();
    });
  });

  describe('Search Operations', () => {
    test('should search tools by name and description', async () => {
      const mockTools = [
        { name: 'calculator', description: 'Math calculations' },
        { name: 'parser', description: 'Parse text' }
      ];
      mockDatabase.mongoProvider.find.mockResolvedValue(mockTools);

      const result = await opsManager.searchTools('calc');
      
      expect(result).toEqual(mockTools);
      expect(mockDatabase.mongoProvider.find).toHaveBeenCalledWith('tools', {
        $or: [
          { name: { $regex: 'calc', $options: 'i' } },
          { description: { $regex: 'calc', $options: 'i' } }
        ]
      }, { limit: 10 });
    });
  });
});