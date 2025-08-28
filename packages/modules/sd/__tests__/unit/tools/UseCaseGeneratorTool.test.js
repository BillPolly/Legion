/**
 * Unit tests for UseCaseGeneratorTool
 */

import { jest } from '@jest/globals';

describe('UseCaseGeneratorTool', () => {
  let UseCaseGeneratorTool;
  let tool;
  let mockDependencies;

  beforeEach(async () => {
    const module = await import('../../../src/tools/architecture/UseCaseGeneratorTool.js');
    UseCaseGeneratorTool = module.UseCaseGeneratorTool;

    mockDependencies = {
      llmClient: {
        complete: jest.fn().mockResolvedValue('Generated use cases')
      }
    };

    tool = new UseCaseGeneratorTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should create UseCaseGeneratorTool instance', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('generate_use_cases');
      expect(tool.llmClient).toBe(mockDependencies.llmClient);
    });
  });

  describe('execute', () => {
    it('should generate use cases from domain events', async () => {
      const result = await tool.execute({
        domainEvents: [
          { 
            id: 'DE001', 
            name: 'UserRegistered',
            aggregate: 'UserAggregate'
          }
        ],
        aggregates: [
          { id: 'AGG001', name: 'UserAggregate' }
        ]
      });

      expect(result).toHaveProperty('useCases');
      expect(Array.isArray(result.useCases)).toBe(true);
    });

    it('should return default use cases when no input', async () => {
      const result = await tool.execute({});

      expect(result.useCases).toHaveLength(1);
      expect(result.useCases[0]).toHaveProperty('name', 'CreateEntity');
    });

    it('should handle missing LLM client', async () => {
      tool.llmClient = null;

      const result = await tool.execute({});
      expect(result.useCases).toHaveLength(1);
      expect(result.useCases[0].name).toBe('CreateEntity');
    });
  });
});