/**
 * Unit tests for ContextRetrievalTool
 */

import { jest } from '@jest/globals';

describe('ContextRetrievalTool', () => {
  let ContextRetrievalTool;
  let tool;
  let mockDependencies;

  beforeEach(async () => {
    const module = await import('../../../src/tools/database/ContextRetrievalTool.js');
    ContextRetrievalTool = module.ContextRetrievalTool;

    mockDependencies = {
      designDatabase: {
        retrieveContext: jest.fn().mockResolvedValue({
          context: { 
            entities: ['User', 'Order'],
            aggregates: ['UserAggregate']
          }
        })
      }
    };

    tool = new ContextRetrievalTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should create ContextRetrievalTool instance', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('retrieve_context');
      expect(tool.designDatabase).toBe(mockDependencies.designDatabase);
    });
  });

  describe('execute', () => {
    it('should retrieve context from database', async () => {
      const result = await tool.execute({
        query: {
          projectId: 'project-123'
        }
      });

      expect(result).toHaveProperty('context');
      expect(result.context).toHaveProperty('projectId', 'project-123');
      expect(result.context).toHaveProperty('artifacts');
    });

    it('should handle missing database', async () => {
      tool.designDatabase = null;

      const result = await tool.execute({
        query: {
          projectId: 'project-123'
        }
      });

      // Tool returns empty context when no database
      expect(result).toHaveProperty('context');
      expect(result.context.artifacts).toEqual([]);
    });

    it('should retrieve context with filters', async () => {
      const result = await tool.execute({
        query: {
          projectId: 'project-123',
          type: 'entity',
          filters: {
            name: 'User'
          }
        }
      });

      expect(result).toHaveProperty('context');
      expect(result.context).toHaveProperty('projectId', 'project-123');
    });
  });
});