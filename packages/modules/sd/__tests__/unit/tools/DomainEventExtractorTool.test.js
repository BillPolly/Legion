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
              id: 'event-user-registered',
              name: 'UserRegistered',
              description: 'A new user has registered in the system',
              trigger: 'User submits registration form',
              timing: 'after registration_validation',
              payload: {
                structure: {
                  userId: 'string',
                  email: 'string',
                  timestamp: 'datetime'
                },
                example: {
                  userId: 'user-123',
                  email: 'user@example.com',
                  timestamp: '2024-01-01T10:00:00Z'
                }
              },
              consequences: [
                'Welcome email is sent',
                'User profile is created',
                'Analytics tracking is triggered'
              ],
              eventType: 'creation',
              version: '1.0',
              metadata: {
                source: 'UserAggregate',
                correlationId: 'correlation-id',
                causationId: 'causation-id'
              }
            }
          ],
          reasoning: 'Event extracted based on user registration business process'
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
      const entities = [
        {
          id: 'ENT001',
          name: 'User',
          boundedContext: 'BC001'
        }
      ];
      
      const aggregates = [
        { 
          id: 'AGG001', 
          name: 'UserAggregate',
          entities: [{ entityId: 'ENT001', entityName: 'User' }],
          aggregateRoot: { entityId: 'ENT001', entityName: 'User' },
          boundedContext: 'BC001'
        }
      ];

      const result = await tool.execute({
        entities,
        aggregates,
        projectId: 'test-project'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('domainEvents');
      expect(result.data).toHaveProperty('artifactId');
      expect(result.data).toHaveProperty('summary');
      expect(Array.isArray(result.data.domainEvents)).toBe(true);
      expect(result.data.summary).toHaveProperty('totalEvents');
      expect(result.data.summary).toHaveProperty('byAggregate');
      expect(result.data.summary).toHaveProperty('eventTypes');
    });

    it('should fail without required parameters', async () => {
      const result = await tool.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Input validation failed');
    });

    it('should fail without entities parameter', async () => {
      const aggregates = [
        { 
          id: 'AGG001', 
          name: 'UserAggregate',
          entities: [{ entityId: 'ENT001', entityName: 'User' }],
          boundedContext: 'BC001'
        }
      ];

      const result = await tool.execute({ aggregates });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Input validation failed');
    });
  });
});