/**
 * Unit tests for DomainEventExtractorTool
 */

import { jest } from '@jest/globals';

describe('DomainEventExtractorTool', () => {
  let DomainEventExtractorTool;
  let tool;
  let mockDependencies;

  beforeEach(async () => {
    const module = await import('../../../src/tools/domain/DomainEventExtractorTool.js');
    DomainEventExtractorTool = module.DomainEventExtractorTool;

    mockDependencies = {
      llmClient: {
        complete: jest.fn().mockResolvedValue(JSON.stringify({
          domainEvents: [
            {
              id: 'DE001',
              name: 'UserRegistered',
              aggregate: 'UserAggregate',
              payload: ['userId', 'email', 'timestamp'],
              triggers: ['New user signs up'],
              boundedContext: 'UserManagement'
            }
          ]
        }))
      },
      designDatabase: {
        storeArtifact: jest.fn().mockResolvedValue({ id: 'event-123' })
      }
    };

    tool = new DomainEventExtractorTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should create DomainEventExtractorTool instance', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('extract_domain_events');
      expect(tool.llmClient).toBe(mockDependencies.llmClient);
    });
  });

  describe('execute', () => {
    it('should extract domain events from aggregates', async () => {
      const result = await tool.execute({
        aggregates: [
          { 
            id: 'AGG001', 
            name: 'UserAggregate',
            entities: ['User'],
            boundedContext: 'UserManagement'
          }
        ]
      });

      expect(result).toHaveProperty('domainEvents');
      expect(Array.isArray(result.domainEvents)).toBe(true);
    });

    it('should return default events', async () => {
      const result = await tool.execute({});

      expect(result.domainEvents).toHaveLength(1);
      expect(result.domainEvents[0]).toHaveProperty('name', 'EntityCreated');
    });
  });
});