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
        complete: jest.fn().mockResolvedValue(JSON.stringify({
          architecture: {
            style: 'Clean Architecture',
            description: 'Layered architecture following Clean Architecture principles',
            layers: [
              {
                id: 'domain',
                name: 'Domain Layer',
                description: 'Core business logic',
                responsibility: 'Encapsulates business rules',
                level: 1,
                components: [
                  {
                    type: 'entity',
                    name: 'UserEntity',
                    description: 'User business entity',
                    sourceEntity: 'user-entity-id'
                  }
                ],
                dependencies: [],
                dependents: ['application'],
                interfaces: [],
                patterns: ['Entity', 'Value Object'],
                testingStrategy: 'Unit tests'
              },
              {
                id: 'application',
                name: 'Application Layer',
                description: 'Application business rules',
                responsibility: 'Orchestrates domain objects',
                level: 2,
                components: [
                  {
                    type: 'use_case',
                    name: 'CreateUserUseCase',
                    description: 'Creates new user',
                    sourceEntity: 'user-aggregate'
                  }
                ],
                dependencies: ['domain'],
                dependents: ['infrastructure', 'presentation'],
                interfaces: [],
                patterns: ['Use Case'],
                testingStrategy: 'Integration tests'
              },
              {
                id: 'infrastructure',
                name: 'Infrastructure Layer',
                description: 'External concerns',
                responsibility: 'Implements interfaces',
                level: 3,
                components: [],
                dependencies: ['application', 'domain'],
                dependents: [],
                interfaces: [],
                patterns: ['Repository'],
                testingStrategy: 'Integration tests'
              },
              {
                id: 'presentation',
                name: 'Presentation Layer',
                description: 'User interface',
                responsibility: 'Handles user interaction',
                level: 4,
                components: [],
                dependencies: ['application'],
                dependents: [],
                interfaces: [],
                patterns: ['MVC'],
                testingStrategy: 'E2E tests'
              }
            ],
            dependencyRules: []
          }
        }))
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
    it('should generate clean architecture from domain model', async () => {
      const entities = [
        {
          id: 'ENT001',
          name: 'User',
          boundedContext: 'BC001'
        }
      ];
      
      const boundedContexts = [
        {
          id: 'BC001',
          name: 'UserManagement',
          description: 'User management context'
        }
      ];

      const result = await tool.execute({
        entities,
        boundedContexts,
        aggregates: [],
        valueObjects: [],
        domainEvents: [],
        projectId: 'test-project'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('architecture');
      expect(result.data).toHaveProperty('artifactId');
      expect(result.data).toHaveProperty('summary');
      expect(result.data.architecture).toHaveProperty('layers');
      expect(Array.isArray(result.data.architecture.layers)).toBe(true);
      expect(result.data.architecture.layers).toHaveLength(4);
      
      const layerNames = result.data.architecture.layers.map(l => l.name);
      expect(layerNames).toContain('Domain Layer');
      expect(layerNames).toContain('Application Layer');
      expect(layerNames).toContain('Infrastructure Layer');
      expect(layerNames).toContain('Presentation Layer');
    });

    it('should fail without required bounded contexts', async () => {
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Input validation failed');
    });

    it('should handle missing LLM client', async () => {
      tool.llmClient = null;
      tool.resourceManager = null;

      const boundedContexts = [
        {
          id: 'BC001',
          name: 'UserManagement',
          description: 'User management context'
        }
      ];

      const result = await tool.execute({
        boundedContexts,
        entities: [],
        aggregates: [],
        valueObjects: [],
        domainEvents: []
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM client not available');
    });
  });
});