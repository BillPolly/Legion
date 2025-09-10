/**
 * Unit tests for InterfaceDesignTool
 */

import { jest } from '@jest/globals';

describe('InterfaceDesignTool', () => {
  let InterfaceDesignTool;
  let tool;
  let mockDependencies;

  beforeEach(async () => {
    const module = await import('../../../src/tools/architecture/InterfaceDesignTool.js');
    InterfaceDesignTool = module.InterfaceDesignTool;

    mockDependencies = {
      llmClient: {
        complete: jest.fn().mockResolvedValue('Generated interfaces')
      }
    };

    tool = new InterfaceDesignTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should create InterfaceDesignTool instance', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('design_interfaces');
      expect(tool.llmClient).toBe(mockDependencies.llmClient);
    });
  });

  describe('execute', () => {
    it('should design interfaces from layers', async () => {
      const result = await tool.execute({
        layers: [
          { 
            id: 'L001', 
            name: 'Domain',
            components: ['Entity', 'ValueObject']
          }
        ],
        useCases: [
          { id: 'UC001', name: 'CreateUser' }
        ]
      });

      expect(result).toHaveProperty('interfaces');
      expect(Array.isArray(result.interfaces)).toBe(true);
    });

    it('should return default interfaces when no input', async () => {
      const result = await tool.execute({});

      expect(result.interfaces).toHaveLength(1);
      expect(result.interfaces[0]).toHaveProperty('name', 'IEntityRepository');
    });

    it('should handle missing LLM client', async () => {
      tool.llmClient = null;

      const result = await tool.execute({});
      expect(result.interfaces).toHaveLength(1);
      expect(result.interfaces[0].name).toBe('IEntityRepository');
    });
  });
});