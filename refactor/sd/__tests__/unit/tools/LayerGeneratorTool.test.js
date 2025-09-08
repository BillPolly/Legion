/**
 * Unit tests for LayerGeneratorTool
 */

import { jest } from '@jest/globals';

describe('LayerGeneratorTool', () => {
  let LayerGeneratorTool;
  let tool;
  let mockDependencies;

  beforeEach(async () => {
    const module = await import('../../../src/tools/architecture/LayerGeneratorTool.js');
    LayerGeneratorTool = module.LayerGeneratorTool;

    mockDependencies = {
      llmClient: {
        complete: jest.fn().mockResolvedValue('Generated layers')
      }
    };

    tool = new LayerGeneratorTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should create LayerGeneratorTool instance', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('design_layers');
      expect(tool.llmClient).toBe(mockDependencies.llmClient);
    });
  });

  describe('execute', () => {
    it('should generate layers from aggregates', async () => {
      const result = await tool.execute({
        aggregates: [
          { 
            id: 'AGG001', 
            name: 'UserAggregate',
            entities: ['User', 'Profile']
          }
        ],
        interfaces: [
          { id: 'I001', name: 'IUserService' }
        ]
      });

      expect(result).toHaveProperty('layers');
      expect(typeof result.layers).toBe('object');
      expect(result.layers).toHaveProperty('domain');
      expect(result.layers).toHaveProperty('application');
    });

    it('should return default layers when no input', async () => {
      const result = await tool.execute({});

      expect(Object.keys(result.layers)).toHaveLength(4);
      expect(result.layers.presentation).toHaveProperty('name', 'Presentation');
      expect(result.layers.application).toHaveProperty('name', 'Application');
      expect(result.layers.domain).toHaveProperty('name', 'Domain');
      expect(result.layers.infrastructure).toHaveProperty('name', 'Infrastructure');
    });

    it('should handle missing LLM client', async () => {
      tool.llmClient = null;

      const result = await tool.execute({});
      expect(Object.keys(result.layers)).toHaveLength(4);
      const layerNames = Object.values(result.layers).map(l => l.name);
      expect(layerNames).toContain('Presentation');
      expect(layerNames).toContain('Application');
      expect(layerNames).toContain('Domain');
      expect(layerNames).toContain('Infrastructure');
    });
  });
});