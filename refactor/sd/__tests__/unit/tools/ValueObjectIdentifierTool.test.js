/**
 * Unit tests for ValueObjectIdentifierTool
 */

import { jest } from '@jest/globals';

describe('ValueObjectIdentifierTool', () => {
  let ValueObjectIdentifierTool;
  let tool;
  let mockDependencies;

  beforeEach(async () => {
    const module = await import('../../../src/tools/domain/ValueObjectIdentifierTool.js');
    ValueObjectIdentifierTool = module.ValueObjectIdentifierTool;

    mockDependencies = {
      llmClient: {
        complete: jest.fn().mockResolvedValue(JSON.stringify({
          valueObjects: [
            {
              id: 'VO001',
              name: 'EmailAddress',
              attributes: [
                { name: 'value', type: 'string' }
              ],
              immutability: {
                enforcedBy: 'constructor',
                description: 'Constructor only initialization'
              },
              equality: {
                basedOn: ['value'],
                description: 'Value equality on value field'
              },
              validation: ['Must be valid email format']
            }
          ]
        }))
      },
      designDatabase: {
        storeArtifact: jest.fn().mockResolvedValue({ id: 'vo-123' })
      }
    };

    tool = new ValueObjectIdentifierTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should create ValueObjectIdentifierTool instance', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('identify_value_objects');
      expect(tool.llmClient).toBe(mockDependencies.llmClient);
    });
  });

  describe('execute', () => {
    it('should identify value objects from entities', async () => {
      const result = await tool.execute({
        entities: [
          { 
            id: 'E001', 
            name: 'User',
            properties: ['id', 'email', 'address'],
            boundedContext: 'UserManagement'
          }
        ],
        boundedContexts: [
          { id: 'BC001', name: 'UserManagement' }
        ]
      });

      expect(result).toHaveProperty('valueObjects');
      expect(Array.isArray(result.valueObjects)).toBe(true);
    });

    it('should handle empty entities', async () => {
      mockDependencies.llmClient.complete.mockResolvedValue(JSON.stringify({
        valueObjects: []
      }));
      
      const result = await tool.execute({
        entities: []
      });

      expect(result.valueObjects).toEqual([]);
    });
  });
});