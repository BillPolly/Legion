/**
 * Unit tests for BoundedContextGeneratorTool
 */

import { jest } from '@jest/globals';

describe('BoundedContextGeneratorTool', () => {
  let BoundedContextGeneratorTool;
  let tool;
  let mockDependencies;

  beforeEach(async () => {
    const module = await import('../../../src/tools/domain/BoundedContextGeneratorTool.js');
    BoundedContextGeneratorTool = module.BoundedContextGeneratorTool;

    mockDependencies = {
      llmClient: {
        complete: jest.fn().mockResolvedValue(JSON.stringify({
          boundedContexts: [
            {
              id: 'BC001',
              name: 'UserManagement',
              description: 'Handles user authentication and profiles',
              boundaries: ['User registration', 'Authentication', 'Profile management'],
              entities: ['User', 'Profile', 'Credentials'],
              aggregates: ['UserAggregate'],
              domainEvents: ['UserRegistered', 'UserLoggedIn'],
              domainType: 'core',
              isCore: true
            },
            {
              id: 'BC002',
              name: 'OrderManagement',
              description: 'Handles order processing',
              boundaries: ['Order creation', 'Order fulfillment'],
              entities: ['Order', 'OrderItem'],
              aggregates: ['OrderAggregate'],
              type: 'supporting'
            }
          ],
          coreDomain: 'UserManagement',
          contextMap: {
            'UserManagement': ['OrderManagement'],
            'OrderManagement': ['UserManagement']
          }
        }))
      },
      designDatabase: {
        storeArtifact: jest.fn().mockResolvedValue({ 
          id: 'context-artifact-123'
        })
      }
    };

    tool = new BoundedContextGeneratorTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should create BoundedContextGeneratorTool instance', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('identify_bounded_contexts');
      expect(tool.llmClient).toBe(mockDependencies.llmClient);
    });
  });

  describe('execute', () => {
    it('should generate bounded contexts from requirements', async () => {
      const result = await tool.execute({
        parsedRequirements: {
          functional: [
            { id: 'FR001', description: 'User authentication' },
            { id: 'FR002', description: 'Order processing' }
          ]
        },
        projectId: 'proj-123'
      });

      expect(result).toHaveProperty('boundedContexts');
      expect(result.boundedContexts).toHaveLength(2);
      expect(result.boundedContexts[0]).toHaveProperty('name', 'UserManagement');
      expect(result.boundedContexts[0].boundaries).toHaveLength(3);
      expect(result).toHaveProperty('artifactId');
      expect(typeof result.artifactId).toBe('string');
    });

    it('should validate bounded contexts have required fields', async () => {
      mockDependencies.llmClient.complete.mockResolvedValue(JSON.stringify({
        boundedContexts: [
          {
            name: 'MissingFields'
          }
        ]
      }));

      await expect(tool.execute({
        parsedRequirements: { functional: [] }
      })).rejects.toThrow('Invalid bounded contexts');
    });

    it('should handle missing LLM client', async () => {
      tool.llmClient = null;

      await expect(tool.execute({
        parsedRequirements: { functional: [] }
      })).rejects.toThrow('LLM client not available');
    });

    it('should emit progress events', async () => {
      tool.emit = jest.fn();
      
      await tool.execute({
        parsedRequirements: { functional: [] },
        projectId: 'proj-123'
      });

      expect(tool.emit).toHaveBeenCalledWith('progress', 
        expect.objectContaining({ 
          percentage: 0,
          status: expect.stringContaining('Analyzing requirements')
        })
      );
      expect(tool.emit).toHaveBeenCalledWith('progress', 
        expect.objectContaining({ 
          percentage: 100,
          status: expect.stringContaining('successfully')
        })
      );
    });
  });
});