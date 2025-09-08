/**
 * Unit tests for EntityModelingTool
 */

import { jest } from '@jest/globals';

describe('EntityModelingTool', () => {
  let EntityModelingTool;
  let tool;
  let mockDependencies;

  beforeEach(async () => {
    const module = await import('../../../src/tools/domain/EntityModelingTool.js');
    EntityModelingTool = module.EntityModelingTool;

    mockDependencies = {
      llmClient: {
        complete: jest.fn().mockResolvedValue(JSON.stringify({
          entities: [
            {
              id: 'E001',
              name: 'User',
              identity: 'userId',
              properties: [
                { name: 'id', type: 'string' },
                { name: 'email', type: 'string' },
                { name: 'password', type: 'string' }
              ],
              invariants: ['Email must be unique'],
              methods: ['login', 'logout'],
              relationships: ['hasProfile'],
              boundedContext: 'UserManagement'
            }
          ]
        }))
      },
      designDatabase: {
        storeArtifact: jest.fn().mockResolvedValue({ id: 'entity-123' })
      }
    };

    tool = new EntityModelingTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should create EntityModelingTool instance', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('model_entities');
      expect(tool.llmClient).toBe(mockDependencies.llmClient);
    });
  });

  describe('execute', () => {
    it('should model entities from bounded contexts', async () => {
      const result = await tool.execute({
        boundedContexts: [
          { 
            id: 'BC001', 
            name: 'UserManagement',
            entities: ['User', 'Profile']
          }
        ]
      });

      expect(result).toHaveProperty('entities');
      expect(Array.isArray(result.entities)).toBe(true);
    });

    it('should handle missing LLM client', async () => {
      tool.llmClient = null;

      await expect(tool.execute({
        boundedContexts: []
      })).rejects.toThrow('LLM client not available');
    });
  });
});