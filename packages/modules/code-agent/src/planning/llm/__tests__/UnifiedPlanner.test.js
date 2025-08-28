/**
 * Tests for UnifiedPlanner class
 * 
 * This test suite verifies the UnifiedPlanner works correctly with different
 * configurations and can replace the specialized planners.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { UnifiedPlanner } from '../UnifiedPlanner.js';
import { ResourceManager } from '@legion/resource-manager';

describe('UnifiedPlanner', () => {
  let mockResourceManager;
  let mockLLMClient;
  let mockGenericPlanner;
  let unifiedPlanner;

  beforeEach(() => {
    // Create mock LLM client
    mockLLMClient = {
      generateResponse: jest.fn(),
      completeWithStructuredResponse: jest.fn()
    };

    // Create mock Planner
    mockGenericPlanner = {
      initialize: jest.fn(),
      createPlan: jest.fn()
    };

    // Create mock ResourceManager
    mockResourceManager = {
      initialize: jest.fn(),
      get: jest.fn().mockReturnValue(mockLLMClient)
    };

    // Mock the imports
    jest.unstable_mockModule('@legion/resource-manager', () => ({
      ResourceManager: jest.fn(() => mockResourceManager)
    }));

    jest.unstable_mockModule('@legion/planner', () => ({
      Planner: jest.fn(() => mockGenericPlanner)
    }));

    unifiedPlanner = new UnifiedPlanner();
    unifiedPlanner.resourceManager = mockResourceManager;
  });

  describe('Constructor', () => {
    test('should create UnifiedPlanner with default config', () => {
      expect(unifiedPlanner).toBeDefined();
      expect(unifiedPlanner.config.provider).toBe('mock');
      expect(unifiedPlanner.initialized).toBe(false);
    });

    test('should create UnifiedPlanner with custom config', () => {
      const customConfig = { provider: 'anthropic' };
      const planner = new UnifiedPlanner(customConfig);
      
      expect(planner.config.provider).toBe('anthropic');
    });
  });

  describe('initialize', () => {
    test('should initialize successfully', async () => {
      mockResourceManager.initialize.mockResolvedValue();

      await unifiedPlanner.initialize();

      expect(mockResourceManager.initialize).toHaveBeenCalled();
      expect(mockResourceManager.get).toHaveBeenCalledWith('llm-client');
      expect(unifiedPlanner.initialized).toBe(true);
    });

    test('should throw error if LLM client not available', async () => {
      mockResourceManager.initialize.mockResolvedValue();
      mockResourceManager.get.mockReturnValue(null);

      await expect(unifiedPlanner.initialize()).rejects.toThrow('LLM client not available from ResourceManager');
    });

    test('should throw error if ResourceManager initialization fails', async () => {
      mockResourceManager.initialize.mockRejectedValue(new Error('ResourceManager failed'));

      await expect(unifiedPlanner.initialize()).rejects.toThrow('Failed to initialize UnifiedPlanner');
    });
  });

  describe('analyzeRequirements', () => {
    beforeEach(async () => {
      mockResourceManager.initialize.mockResolvedValue();
      await unifiedPlanner.initialize();
      // Override the Planner instance with our mock
      unifiedPlanner.planner = mockGenericPlanner;
    });

    test('should analyze requirements successfully', async () => {
      const mockPlan = {
        steps: [
          {
            actions: [
              {
                type: 'determine_project_type',
                parameters: { projectType: 'frontend' }
              },
              {
                type: 'analyze_complexity',
                parameters: { complexity: 'low' }
              },
              {
                type: 'extract_frontend_features',
                parameters: { features: ['form', 'list'] }
              }
            ]
          }
        ]
      };

      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);

      const requirements = {
        task: 'Create a todo list application',
        requirements: {
          frontend: 'HTML form for adding todos, display list with delete functionality'
        }
      };

      const result = await unifiedPlanner.analyzeRequirements(requirements);

      expect(mockGenericPlanner.createPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('Analyze the following project requirements'),
          allowableActions: expect.any(Array),
          inputs: expect.any(Array)
        })
      );

      expect(result).toMatchObject({
        task: 'Create a todo list application',
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: {
            features: ['form', 'list']
          }
        }
      });
    });

    test('should throw error if not initialized', async () => {
      const uninitializedPlanner = new UnifiedPlanner();
      
      await expect(uninitializedPlanner.analyzeRequirements({})).rejects.toThrow('UnifiedPlanner must be initialized before use');
    });
  });

  describe('planDirectoryStructure', () => {
    beforeEach(async () => {
      mockResourceManager.initialize.mockResolvedValue();
      await unifiedPlanner.initialize();
      unifiedPlanner.planner = mockGenericPlanner;
    });

    test('should plan directory structure successfully', async () => {
      const mockPlan = {
        steps: [
          {
            actions: [
              {
                type: 'create_directory',
                parameters: { name: 'src', description: 'Source code directory' }
              },
              {
                type: 'create_file',
                parameters: { name: 'index.html' }
              },
              {
                type: 'create_file',
                parameters: { name: 'style.css' }
              }
            ]
          }
        ]
      };

      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);

      const analysis = {
        projectType: 'frontend',
        complexity: 'low'
      };

      const result = await unifiedPlanner.planDirectoryStructure(analysis);

      expect(mockGenericPlanner.createPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('Create an optimal directory structure'),
          allowableActions: expect.any(Array),
          inputs: expect.any(Array)
        })
      );

      expect(result).toMatchObject({
        directories: ['src'],
        files: ['index.html', 'style.css'],
        descriptions: {
          src: 'Source code directory'
        }
      });
    });
  });

  describe('planDependencies', () => {
    beforeEach(async () => {
      mockResourceManager.initialize.mockResolvedValue();
      await unifiedPlanner.initialize();
      unifiedPlanner.planner = mockGenericPlanner;
    });

    test('should plan dependencies successfully', async () => {
      const mockPlan = {
        steps: [
          {
            actions: [
              {
                type: 'order_files',
                parameters: { 
                  order: ['package.json', 'utils/validation.js', 'models/User.js', 'server.js'] 
                }
              },
              {
                type: 'resolve_dependency',
                parameters: { from: 'server.js', to: 'models/User.js' }
              }
            ]
          }
        ]
      };

      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);

      const structure = {
        files: ['package.json', 'server.js', 'models/User.js', 'utils/validation.js']
      };
      const analysis = {
        projectType: 'backend',
        complexity: 'medium'
      };

      const result = await unifiedPlanner.planDependencies(structure, analysis);

      expect(result).toMatchObject({
        creationOrder: ['package.json', 'utils/validation.js', 'models/User.js', 'server.js'],
        dependencies: {
          'server.js': ['models/User.js']
        }
      });
    });
  });

  describe('planFrontendArchitecture', () => {
    beforeEach(async () => {
      mockResourceManager.initialize.mockResolvedValue();
      await unifiedPlanner.initialize();
      unifiedPlanner.planner = mockGenericPlanner;
    });

    test('should plan frontend architecture successfully', async () => {
      const mockPlan = {
        steps: [
          {
            actions: [
              {
                type: 'create_component',
                parameters: {
                  name: 'TodoForm',
                  type: 'form',
                  props: ['onSubmit'],
                  state: { inputValue: 'string' },
                  description: 'Form for adding todos'
                }
              },
              {
                type: 'define_state_management',
                parameters: {
                  strategy: 'local',
                  globalState: {}
                }
              }
            ]
          }
        ]
      };

      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);

      const analysis = {
        projectType: 'frontend',
        complexity: 'low',
        components: {
          frontend: {
            features: ['form', 'list']
          }
        }
      };

      const result = await unifiedPlanner.planFrontendArchitecture(analysis);

      expect(result).toMatchObject({
        components: [
          {
            name: 'TodoForm',
            type: 'form',
            props: ['onSubmit'],
            state: { inputValue: 'string' },
            description: 'Form for adding todos'
          }
        ],
        stateManagement: {
          strategy: 'local',
          globalState: {}
        }
      });
    });
  });

  describe('planBackendArchitecture', () => {
    beforeEach(async () => {
      mockResourceManager.initialize.mockResolvedValue();
      await unifiedPlanner.initialize();
      unifiedPlanner.planner = mockGenericPlanner;
    });

    test('should plan backend architecture successfully', async () => {
      const mockPlan = {
        steps: [
          {
            actions: [
              {
                type: 'design_api',
                parameters: {
                  style: 'REST',
                  endpoints: ['/api/users', '/api/auth']
                }
              },
              {
                type: 'create_service',
                parameters: {
                  name: 'UserService',
                  type: 'business',
                  responsibilities: ['user management']
                }
              }
            ]
          }
        ]
      };

      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);

      const analysis = {
        projectType: 'backend',
        complexity: 'medium',
        components: {
          backend: {
            features: ['api', 'crud', 'authentication']
          }
        }
      };

      const result = await unifiedPlanner.planBackendArchitecture(analysis);

      expect(result).toMatchObject({
        apiDesign: {
          style: 'REST',
          endpoints: ['/api/users', '/api/auth']
        },
        services: [
          {
            name: 'UserService',
            type: 'business',
            responsibilities: ['user management']
          }
        ]
      });
    });
  });

  describe('planAPIInterface', () => {
    beforeEach(async () => {
      mockResourceManager.initialize.mockResolvedValue();
      await unifiedPlanner.initialize();
      unifiedPlanner.planner = mockGenericPlanner;
    });

    test('should plan API interface successfully', async () => {
      const mockPlan = {
        steps: [
          {
            actions: [
              {
                type: 'create_contract',
                parameters: {
                  endpoint: '/api/users',
                  method: 'GET',
                  description: 'Get list of users',
                  responseType: 'UserResponseDTO'
                }
              },
              {
                type: 'define_dto',
                parameters: {
                  model: 'User',
                  definition: {
                    request: { name: 'UserRequestDTO' },
                    response: { name: 'UserResponseDTO' }
                  }
                }
              }
            ]
          }
        ]
      };

      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);

      const frontendArchitecture = {
        components: [
          { name: 'UserList', type: 'display' }
        ]
      };

      const backendArchitecture = {
        apiDesign: {
          style: 'REST',
          endpoints: ['/users']
        }
      };

      const result = await unifiedPlanner.planAPIInterface(frontendArchitecture, backendArchitecture);

      expect(result).toMatchObject({
        contracts: [
          {
            endpoint: '/api/users',
            method: 'GET',
            description: 'Get list of users',
            responseType: 'UserResponseDTO'
          }
        ],
        dataTransferObjects: {
          User: {
            request: { name: 'UserRequestDTO' },
            response: { name: 'UserResponseDTO' }
          }
        }
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      mockResourceManager.initialize.mockResolvedValue();
      await unifiedPlanner.initialize();
      unifiedPlanner.planner = mockGenericPlanner;
    });

    test('should handle unknown planning type', async () => {
      await expect(unifiedPlanner._executePlanning('unknown', {})).rejects.toThrow('Unknown planning type: unknown');
    });

    test('should handle Planner errors', async () => {
      mockGenericPlanner.createPlan.mockRejectedValue(new Error('Planning failed'));

      await expect(unifiedPlanner.analyzeRequirements({})).rejects.toThrow('Planning failed for requirement');
    });

    test('should handle empty plan response', async () => {
      const emptyPlan = { steps: [] };
      mockGenericPlanner.createPlan.mockResolvedValue(emptyPlan);

      const result = await unifiedPlanner.analyzeRequirements({ task: 'test' });
      
      expect(result).toMatchObject({
        task: 'test',
        projectType: 'frontend', // default
        complexity: 'medium' // default
      });
    });

    test('should handle malformed plan response', async () => {
      const malformedPlan = { invalid: 'structure' };
      mockGenericPlanner.createPlan.mockResolvedValue(malformedPlan);

      const result = await unifiedPlanner.analyzeRequirements({ task: 'test' });
      
      expect(result).toHaveProperty('task');
      expect(result).toHaveProperty('projectType');
      expect(result).toHaveProperty('metadata');
    });

    test('should handle null input gracefully', async () => {
      const plan = { steps: [] };
      mockGenericPlanner.createPlan.mockResolvedValue(plan);

      await expect(unifiedPlanner.analyzeRequirements(null)).resolves.toBeDefined();
    });

    test('should handle undefined input gracefully', async () => {
      const plan = { steps: [] };
      mockGenericPlanner.createPlan.mockResolvedValue(plan);

      await expect(unifiedPlanner.analyzeRequirements(undefined)).resolves.toBeDefined();
    });

    test('should handle network timeouts', async () => {
      mockGenericPlanner.createPlan.mockRejectedValue(new Error('Request timeout'));

      await expect(unifiedPlanner.analyzeRequirements({ task: 'test' }))
        .rejects.toThrow('Planning failed for requirement: Request timeout');
    });

    test('should handle LLM rate limiting errors', async () => {
      mockGenericPlanner.createPlan.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(unifiedPlanner.analyzeRequirements({ task: 'test' }))
        .rejects.toThrow('Planning failed for requirement: Rate limit exceeded');
    });

    test('should handle very large input', async () => {
      const largePlan = { steps: [] };
      mockGenericPlanner.createPlan.mockResolvedValue(largePlan);

      const largeInput = {
        task: 'A'.repeat(10000), // Very long task description
        requirements: {
          frontend: 'B'.repeat(5000),
          backend: 'C'.repeat(5000)
        }
      };

      const result = await unifiedPlanner.analyzeRequirements(largeInput);
      expect(result).toBeDefined();
      expect(result.task).toBe(largeInput.task);
    });

    test('should handle special characters in input', async () => {
      const plan = { steps: [] };
      mockGenericPlanner.createPlan.mockResolvedValue(plan);

      const specialInput = {
        task: 'Create app with émojis 🚀 and spéciàl chars & symbols @#$%',
        requirements: {
          frontend: 'Handle ñíce cháracters properly'
        }
      };

      const result = await unifiedPlanner.analyzeRequirements(specialInput);
      expect(result).toBeDefined();
      expect(result.task).toBe(specialInput.task);
    });

    test('should handle concurrent planning requests', async () => {
      const plan = { steps: [] };
      mockGenericPlanner.createPlan.mockResolvedValue(plan);

      const requests = Array.from({ length: 5 }, (_, i) => 
        unifiedPlanner.analyzeRequirements({ task: `Task ${i}` })
      );

      const results = await Promise.all(requests);
      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.task).toBe(`Task ${i}`);
      });
    });
  });

  describe('Utility Methods', () => {
    test('should get status correctly', () => {
      const status = unifiedPlanner.getStatus();
      
      expect(status).toMatchObject({
        initialized: false,
        llmClientAvailable: false,
        genericPlannerAvailable: false,
        availablePlanners: [
          'requirement',
          'directory', 
          'dependency',
          'frontend',
          'backend',
          'api'
        ],
        provider: 'mock'
      });
    });

    test('should get available planning types', () => {
      const types = unifiedPlanner.getAvailablePlanningTypes();
      
      expect(types).toEqual([
        'requirement',
        'directory',
        'dependency',
        'frontend',
        'backend',
        'api'
      ]);
    });

    test('should check if planning type is supported', () => {
      expect(unifiedPlanner.isPlanningTypeSupported('requirement')).toBe(true);
      expect(unifiedPlanner.isPlanningTypeSupported('unknown')).toBe(false);
    });
  });

  describe('Plan Transformation', () => {
    beforeEach(async () => {
      mockResourceManager.initialize.mockResolvedValue();
      await unifiedPlanner.initialize();
      unifiedPlanner.planner = mockGenericPlanner;
    });

    test('should extract actions from hierarchical plan', () => {
      const plan = {
        steps: [
          {
            actions: [
              { type: 'action1', parameters: { param1: 'value1' } }
            ],
            subSteps: [
              {
                actions: [
                  { type: 'action2', parameters: { param2: 'value2' } }
                ]
              }
            ]
          }
        ]
      };

      const actions = unifiedPlanner._extractActionsFromPlan(plan);

      expect(actions).toEqual([
        { type: 'action1', parameters: { param1: 'value1' } },
        { type: 'action2', parameters: { param2: 'value2' } }
      ]);
    });

    test('should handle plan with no actions', () => {
      const plan = {
        steps: [
          {
            actions: [],
            subSteps: []
          }
        ]
      };

      const actions = unifiedPlanner._extractActionsFromPlan(plan);
      expect(actions).toEqual([]);
    });

    test('should handle deeply nested plan structure', () => {
      const plan = {
        steps: [
          {
            actions: [{ type: 'top-level', parameters: {} }],
            subSteps: [
              {
                actions: [{ type: 'level-1', parameters: {} }],
                subSteps: [
                  {
                    actions: [{ type: 'level-2', parameters: {} }]
                  }
                ]
              }
            ]
          }
        ]
      };

      const actions = unifiedPlanner._extractActionsFromPlan(plan);
      expect(actions).toHaveLength(3);
      expect(actions.map(a => a.type)).toEqual(['top-level', 'level-1', 'level-2']);
    });

    test('should handle plan with missing properties', () => {
      const plan = {
        steps: [
          {}, // Missing actions and subSteps
          { actions: [{ type: 'test', parameters: {} }] },
          { subSteps: [{ actions: [{ type: 'nested', parameters: {} }] }] }
        ]
      };

      const actions = unifiedPlanner._extractActionsFromPlan(plan);
      expect(actions).toHaveLength(2);
      expect(actions.map(a => a.type)).toEqual(['test', 'nested']);
    });

    test('should generate appropriate objectives for different planning types', () => {
      const requirementObjective = unifiedPlanner._generateObjective('requirement', { task: 'Build an app' });
      const directoryObjective = unifiedPlanner._generateObjective('directory', { projectType: 'frontend' });
      const dependencyObjective = unifiedPlanner._generateObjective('dependency', {});

      expect(requirementObjective).toContain('Analyze the following project requirements');
      expect(requirementObjective).toContain('Build an app');
      expect(directoryObjective).toContain('Create an optimal directory structure');
      expect(directoryObjective).toContain('frontend');
      expect(dependencyObjective).toContain('optimal creation order');
    });

    test('should generate objectives with missing input properties', () => {
      const objectiveWithMissingTask = unifiedPlanner._generateObjective('requirement', {});
      const objectiveWithMissingType = unifiedPlanner._generateObjective('directory', {});

      expect(objectiveWithMissingTask).toContain('No task specified');
      expect(objectiveWithMissingType).toContain('general');
    });

    test('should build appropriate context for different planning types', () => {
      const requirementContext = unifiedPlanner._buildContext('requirement', { task: 'Test' });
      const directoryContext = unifiedPlanner._buildContext('directory', { projectType: 'backend' });

      expect(requirementContext).toMatchObject({
        planningType: 'requirement',
        input: { task: 'Test' },
        availableProjectTypes: ['frontend', 'backend', 'fullstack'],
        complexityLevels: ['low', 'medium', 'high']
      });

      expect(directoryContext).toMatchObject({
        planningType: 'directory',
        input: { projectType: 'backend' },
        supportedTemplates: ['simple', 'modular', 'layered'],
        commonDirectories: ['src', 'tests', 'docs', 'config']
      });
    });

    test('should build context for all planning types', () => {
      const planningTypes = ['requirement', 'directory', 'dependency', 'frontend', 'backend', 'api'];
      
      planningTypes.forEach(type => {
        const context = unifiedPlanner._buildContext(type, { test: 'data' });
        expect(context).toHaveProperty('planningType', type);
        expect(context).toHaveProperty('input');
        expect(context).toHaveProperty('timestamp');
      });
    });

    test('should transform requirement analysis with various action combinations', () => {
      const actions = [
        { type: 'determine_project_type', parameters: { projectType: 'fullstack' } },
        { type: 'analyze_complexity', parameters: { complexity: 'high' } },
        { type: 'extract_frontend_features', parameters: { features: ['spa', 'responsive'] } },
        { type: 'extract_backend_features', parameters: { features: ['api', 'auth'] } },
        { type: 'suggest_architecture', parameters: { architecture: { pattern: 'layered' } } }
      ];

      const result = unifiedPlanner._transformRequirementAnalysis(actions, { task: 'Complex app' });

      expect(result).toMatchObject({
        task: 'Complex app',
        projectType: 'fullstack',
        complexity: 'high',
        components: {
          frontend: { features: ['spa', 'responsive'] },
          backend: { features: ['api', 'auth'] }
        },
        suggestedArchitecture: { pattern: 'layered' }
      });
    });

    test('should transform directory structure with edge cases', () => {
      const actions = [
        { type: 'create_directory', parameters: { name: 'src', description: 'Source code' } },
        { type: 'create_file', parameters: { name: 'index.js' } },
        { type: 'create_directory', parameters: { name: 'src' } }, // Duplicate
        { type: 'apply_template', parameters: { 
          template: { directories: ['tests'], files: ['package.json'] } 
        } }
      ];

      const result = unifiedPlanner._transformDirectoryStructure(actions, { projectType: 'backend' });

      expect(result.directories).toEqual(['src', 'tests']); // Duplicates removed
      expect(result.files).toEqual(['index.js', 'package.json']);
      expect(result.descriptions).toHaveProperty('src', 'Source code');
    });

    test('should transform complex backend architecture', () => {
      const actions = [
        { type: 'design_api', parameters: { style: 'GraphQL', endpoints: ['/graphql'] } },
        { type: 'create_service', parameters: { name: 'UserService', type: 'business' } },
        { type: 'create_service', parameters: { name: 'AuthService', type: 'security' } },
        { type: 'add_middleware', parameters: { name: 'auth', type: 'authentication' } },
        { type: 'configure_security', parameters: { method: 'oauth' } }
      ];

      const result = unifiedPlanner._transformBackendArchitecture(actions, { complexity: 'high' });

      expect(result.apiDesign).toEqual({ style: 'GraphQL', endpoints: ['/graphql'] });
      expect(result.services).toHaveLength(2);
      expect(result.services[0]).toMatchObject({ name: 'UserService', type: 'business' });
      expect(result.middleware).toHaveLength(1);
      expect(result.security).toEqual({ method: 'oauth' });
    });
  });
});