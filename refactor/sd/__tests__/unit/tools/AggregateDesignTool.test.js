/**
 * Unit tests for AggregateDesignTool
 */

import { jest } from '@jest/globals';

describe('AggregateDesignTool', () => {
  let AggregateDesignTool;
  let tool;
  let mockDependencies;

  beforeEach(async () => {
    const module = await import('../../../src/tools/domain/AggregateDesignTool.js');
    AggregateDesignTool = module.AggregateDesignTool;

    mockDependencies = {
      llmClient: {
        complete: jest.fn().mockResolvedValue(JSON.stringify({
          aggregates: [
            {
              id: 'AGG001',
              name: 'UserAggregate',
              aggregateRoot: {
                entityId: 'E001',
                entityName: 'User'
              },
              rootEntity: 'User',
              entities: ['User', 'Profile'],
              invariants: [
                { rule: 'Email must be unique', enforcement: 'Check on create and update' }
              ],
              boundedContext: 'UserManagement'
            }
          ]
        }))
      },
      designDatabase: {
        storeArtifact: jest.fn().mockResolvedValue({ id: 'agg-123' })
      }
    };

    tool = new AggregateDesignTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should create AggregateDesignTool instance', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('design_aggregates');
      expect(tool.llmClient).toBe(mockDependencies.llmClient);
    });
  });

  describe('execute', () => {
    it('should design aggregates from entities', async () => {
      const result = await tool.execute({
        entities: [
          { 
            id: 'E001', 
            name: 'User',
            boundedContext: 'UserManagement'
          }
        ],
        boundedContexts: [
          { id: 'BC001', name: 'UserManagement' }
        ]
      });

      expect(result).toHaveProperty('aggregates');
      expect(Array.isArray(result.aggregates)).toBe(true);
    });

    it('should handle empty entities', async () => {
      const result = await tool.execute({
        entities: [],
        boundedContexts: []
      });

      expect(result.aggregates).toEqual([]);
    });
  });
});