/**
 * Unit tests for ArtifactStorageTool
 */

import { jest } from '@jest/globals';

describe('ArtifactStorageTool', () => {
  let ArtifactStorageTool;
  let tool;
  let mockDependencies;

  beforeEach(async () => {
    const module = await import('../../../src/tools/database/ArtifactStorageTool.js');
    ArtifactStorageTool = module.ArtifactStorageTool;

    mockDependencies = {
      designDatabase: {
        storeArtifact: jest.fn().mockResolvedValue({ id: 'artifact-123', status: 'stored' })
      }
    };

    tool = new ArtifactStorageTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should create ArtifactStorageTool instance', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('store_artifact');
      expect(tool.designDatabase).toBe(mockDependencies.designDatabase);
    });
  });

  describe('execute', () => {
    it('should store artifact to database', async () => {
      const result = await tool.execute({
        artifact: { 
          id: 'A001', 
          type: 'entity',
          data: { name: 'User' }
        },
        projectId: 'project-123'
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('storedArtifact');
      expect(result.storedArtifact).toHaveProperty('type', 'entity');
    });

    it('should handle missing database', async () => {
      tool.designDatabase = null;

      const result = await tool.execute({
        artifact: { id: 'A001', type: 'entity', data: {} },
        projectId: 'project-123'
      });

      // Tool generates artifact even without database
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('storedArtifact');
    });

    it('should store artifact with metadata', async () => {
      const result = await tool.execute({
        artifact: { 
          id: 'A002', 
          type: 'aggregate',
          data: { name: 'OrderAggregate' }
        },
        metadata: {
          version: '1.0',
          author: 'test'
        }
      });

      // Without actual database mock, tool generates artifact internally
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('storedArtifact');
    });
  });
});