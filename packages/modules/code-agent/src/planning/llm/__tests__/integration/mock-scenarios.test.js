/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { UnifiedPlanner } from '../../UnifiedPlanner.js';
import { RequirementAnalyzerConfig } from '../../configs/RequirementAnalyzerConfig.js';
import { DirectoryPlannerConfig } from '../../configs/DirectoryPlannerConfig.js';
import { DependencyPlannerConfig } from '../../configs/DependencyPlannerConfig.js';
import { FrontendArchitecturePlannerConfig } from '../../configs/FrontendArchitecturePlannerConfig.js';
import { BackendArchitecturePlannerConfig } from '../../configs/BackendArchitecturePlannerConfig.js';
import { APIInterfacePlannerConfig } from '../../configs/APIInterfacePlannerConfig.js';

describe('Mock Response Validation Tests', () => {
  let mockResourceManager;
  let mockLLMClient;
  let mockGenericPlanner;
  let unifiedPlanner;

  beforeEach(async () => {
    // Create mock LLM client
    mockLLMClient = {
      generateResponse: jest.fn(),
      completeWithStructuredResponse: jest.fn()
    };

    // Create mock GenericPlanner
    mockGenericPlanner = {
      initialize: jest.fn(),
      createPlan: jest.fn()
    };

    // Create mock ResourceManager
    mockResourceManager = {
      initialize: jest.fn(),
      get: jest.fn().mockReturnValue(mockLLMClient)
    };

    unifiedPlanner = new UnifiedPlanner();
    unifiedPlanner.resourceManager = mockResourceManager;
    await unifiedPlanner.initialize();
    unifiedPlanner.genericPlanner = mockGenericPlanner;
  });

  describe('RequirementAnalyzer Mock Scenarios', () => {
    test('should validate simple-frontend mock response format', async () => {
      const mockResponse = RequirementAnalyzerConfig.mockResponses['simple-frontend'];
      
      // Simulate UnifiedPlanner transformation
      const mockPlan = {
        steps: [
          {
            actions: [
              { type: 'determine_project_type', parameters: { projectType: mockResponse.projectType } },
              { type: 'analyze_complexity', parameters: { complexity: mockResponse.complexity } },
              { type: 'extract_frontend_features', parameters: { features: mockResponse.components.frontend.features } }
            ]
          }
        ]
      };
      
      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);
      
      const result = await unifiedPlanner.analyzeRequirements({ task: mockResponse.task });
      
      // Verify the transformation produces similar structure to mock
      expect(result).toMatchObject({
        task: mockResponse.task,
        projectType: mockResponse.projectType,
        complexity: mockResponse.complexity,
        components: {
          frontend: {
            features: mockResponse.components.frontend.features
          }
        }
      });
      
      expect(result.metadata.planner).toBe('UnifiedPlanner');
    });

    test('should validate backend-api mock response format', async () => {
      const mockResponse = RequirementAnalyzerConfig.mockResponses['backend-api'];
      
      const mockPlan = {
        steps: [
          {
            actions: [
              { type: 'determine_project_type', parameters: { projectType: mockResponse.projectType } },
              { type: 'analyze_complexity', parameters: { complexity: mockResponse.complexity } },
              { type: 'extract_backend_features', parameters: { features: mockResponse.components.backend.features } },
              { type: 'analyze_security_requirements', parameters: { authentication: mockResponse.security.authentication } }
            ]
          }
        ]
      };
      
      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);
      
      const result = await unifiedPlanner.analyzeRequirements({ task: mockResponse.task });
      
      expect(result).toMatchObject({
        task: mockResponse.task,
        projectType: mockResponse.projectType,
        complexity: mockResponse.complexity,
        components: {
          backend: {
            features: mockResponse.components.backend.features
          }
        }
      });
    });

    test('should validate fullstack-complex mock response format', async () => {
      const mockResponse = RequirementAnalyzerConfig.mockResponses['fullstack-complex'];
      
      const mockPlan = {
        steps: [
          {
            actions: [
              { type: 'determine_project_type', parameters: { projectType: mockResponse.projectType } },
              { type: 'analyze_complexity', parameters: { complexity: mockResponse.complexity } },
              { type: 'extract_frontend_features', parameters: { features: mockResponse.components.frontend.features } },
              { type: 'extract_backend_features', parameters: { features: mockResponse.components.backend.features } }
            ]
          }
        ]
      };
      
      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);
      
      const result = await unifiedPlanner.analyzeRequirements({ task: mockResponse.task });
      
      expect(result.projectType).toBe('fullstack');
      expect(result.complexity).toBe('high');
      expect(result.components).toHaveProperty('frontend');
      expect(result.components).toHaveProperty('backend');
    });
  });

  describe('DirectoryPlanner Mock Scenarios', () => {
    test('should validate simple-frontend directory structure', async () => {
      const mockResponse = DirectoryPlannerConfig.mockResponses['simple-frontend'];
      
      const mockPlan = {
        steps: [
          {
            actions: [
              { type: 'create_file', parameters: { name: 'index.html' } },
              { type: 'create_file', parameters: { name: 'style.css' } },
              { type: 'create_file', parameters: { name: 'script.js' } },
              { type: 'create_file', parameters: { name: 'README.md' } },
              { type: 'create_file', parameters: { name: '.gitignore' } }
            ]
          }
        ]
      };
      
      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);
      
      const result = await unifiedPlanner.planDirectoryStructure({
        projectType: 'frontend',
        complexity: 'low'
      });
      
      expect(result.files).toContain('index.html');
      expect(result.files).toContain('style.css');
      expect(result.files).toContain('script.js');
      expect(result.isValid).toBe(true);
      expect(result.metadata.planner).toBe('UnifiedPlanner');
    });

    test('should validate modular-backend directory structure', async () => {
      const mockResponse = DirectoryPlannerConfig.mockResponses['modular-backend'];
      
      const mockPlan = {
        steps: [
          {
            actions: [
              { type: 'create_directory', parameters: { name: 'routes', description: 'API route definitions' } },
              { type: 'create_directory', parameters: { name: 'models', description: 'Data models and schemas' } },
              { type: 'create_directory', parameters: { name: 'utils', description: 'Utility functions and helpers' } },
              { type: 'create_directory', parameters: { name: 'middleware', description: 'Express middleware functions' } },
              { type: 'create_file', parameters: { name: 'server.js' } },
              { type: 'create_file', parameters: { name: 'package.json' } }
            ]
          }
        ]
      };
      
      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);
      
      const result = await unifiedPlanner.planDirectoryStructure({
        projectType: 'backend',
        complexity: 'medium'
      });
      
      expect(result.directories).toContain('routes');
      expect(result.directories).toContain('models');
      expect(result.files).toContain('server.js');
      expect(result.files).toContain('package.json');
      expect(result.descriptions).toHaveProperty('routes');
    });

    test('should validate layered-fullstack directory structure', async () => {
      const mockResponse = DirectoryPlannerConfig.mockResponses['layered-fullstack'];
      
      const mockPlan = {
        steps: [
          {
            actions: mockResponse.directories.map(dir => ({
              type: 'create_directory',
              parameters: { name: dir, description: mockResponse.descriptions[dir] || `${dir} directory` }
            })).concat(
              mockResponse.files.map(file => ({
                type: 'create_file',
                parameters: { name: file }
              }))
            )
          }
        ]
      };
      
      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);
      
      const result = await unifiedPlanner.planDirectoryStructure({
        projectType: 'fullstack',
        complexity: 'high'
      });
      
      expect(result.directories).toContain('frontend');
      expect(result.directories).toContain('backend');
      expect(result.directories).toContain('shared');
      expect(result.files).toContain('package.json');
    });
  });

  describe('DependencyPlanner Mock Scenarios', () => {
    test('should validate simple-backend dependency plan', async () => {
      const mockResponse = DependencyPlannerConfig.mockResponses['simple-backend'];
      
      const mockPlan = {
        steps: [
          {
            actions: [
              { type: 'order_files', parameters: { order: mockResponse.creationOrder } }
            ]
          }
        ]
      };
      
      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);
      
      const result = await unifiedPlanner.planDependencies(
        { files: mockResponse.creationOrder },
        { projectType: 'backend', complexity: 'low' }
      );
      
      expect(result.creationOrder).toEqual(mockResponse.creationOrder);
      expect(result.conflicts).toEqual([]);
      expect(result.isValid).toBe(true);
    });

    test('should validate modular-backend dependency plan', async () => {
      const mockResponse = DependencyPlannerConfig.mockResponses['modular-backend'];
      
      const mockPlan = {
        steps: [
          {
            actions: [
              { type: 'order_files', parameters: { order: mockResponse.creationOrder } },
              ...Object.entries(mockResponse.dependencies).map(([from, to]) => ({
                type: 'resolve_dependency',
                parameters: { from, to: Array.isArray(to) ? to[0] : to }
              }))
            ]
          }
        ]
      };
      
      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);
      
      const result = await unifiedPlanner.planDependencies(
        { files: mockResponse.creationOrder },
        { projectType: 'backend', complexity: 'medium' }
      );
      
      // package.json should be first
      expect(result.creationOrder[0]).toBe('package.json');
      expect(result.creationOrder).toContain('server.js');
      expect(result.isValid).toBe(true);
    });
  });

  describe('FrontendArchitecture Mock Scenarios', () => {
    test('should validate simple-frontend architecture', async () => {
      const mockResponse = FrontendArchitecturePlannerConfig.mockResponses['simple-frontend'];
      
      const mockPlan = {
        steps: [
          {
            actions: mockResponse.components.map(component => ({
              type: 'create_component',
              parameters: component
            })).concat([
              { type: 'define_state_management', parameters: mockResponse.stateManagement },
              { type: 'plan_data_flow', parameters: mockResponse.dataFlow },
              { type: 'configure_styling', parameters: mockResponse.styling }
            ])
          }
        ]
      };
      
      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);
      
      const result = await unifiedPlanner.planFrontendArchitecture({
        projectType: 'frontend',
        complexity: 'low'
      });
      
      expect(result.components.length).toBeGreaterThan(0);
      expect(result.stateManagement).toBeDefined();
      expect(result.dataFlow).toBeDefined();
      expect(result.styling).toBeDefined();
    });

    test('should validate modular-frontend architecture', async () => {
      const mockResponse = FrontendArchitecturePlannerConfig.mockResponses['modular-frontend'];
      
      const mockPlan = {
        steps: [
          {
            actions: mockResponse.components.map(component => ({
              type: 'create_component',
              parameters: component
            })).concat([
              { type: 'define_state_management', parameters: mockResponse.stateManagement },
              { type: 'setup_routing', parameters: mockResponse.routing }
            ])
          }
        ]
      };
      
      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);
      
      const result = await unifiedPlanner.planFrontendArchitecture({
        projectType: 'frontend',
        complexity: 'medium'
      });
      
      expect(result.components.length).toBeGreaterThan(2);
      expect(result.stateManagement.strategy).toBeDefined();
      expect(result.routing).toBeDefined();
    });
  });

  describe('BackendArchitecture Mock Scenarios', () => {
    test('should validate simple-backend architecture', async () => {
      const mockResponse = BackendArchitecturePlannerConfig.mockResponses['simple-backend'];
      
      const mockPlan = {
        steps: [
          {
            actions: [
              { type: 'analyze_architecture_pattern', parameters: { pattern: mockResponse.pattern } },
              { type: 'design_api', parameters: mockResponse.apiDesign },
              { type: 'plan_data_layer', parameters: mockResponse.dataLayer },
              ...mockResponse.services.map(service => ({
                type: 'create_service',
                parameters: service
              }))
            ]
          }
        ]
      };
      
      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);
      
      const result = await unifiedPlanner.planBackendArchitecture({
        projectType: 'backend',
        complexity: 'low'
      });
      
      expect(result.pattern).toBeDefined();
      expect(result.apiDesign).toBeDefined();
      expect(result.dataLayer).toBeDefined();
      expect(result.services.length).toBeGreaterThan(0);
    });

    test('should validate layered-backend architecture', async () => {
      const mockResponse = BackendArchitecturePlannerConfig.mockResponses['layered-backend'];
      
      const mockPlan = {
        steps: [
          {
            actions: [
              { type: 'analyze_architecture_pattern', parameters: { pattern: mockResponse.pattern } },
              { type: 'design_api', parameters: mockResponse.apiDesign },
              { type: 'configure_security', parameters: mockResponse.security },
              { type: 'optimize_performance', parameters: mockResponse.performance }
            ]
          }
        ]
      };
      
      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);
      
      const result = await unifiedPlanner.planBackendArchitecture({
        projectType: 'backend',
        complexity: 'medium'
      });
      
      expect(result.pattern).toBeDefined();
      expect(result.security).toBeDefined();
      expect(result.performance).toBeDefined();
    });

    test('should validate microservices-backend architecture', async () => {
      const mockResponse = BackendArchitecturePlannerConfig.mockResponses['microservices-backend'];
      
      const mockPlan = {
        steps: [
          {
            actions: [
              { type: 'analyze_architecture_pattern', parameters: { pattern: mockResponse.pattern } },
              { type: 'design_api', parameters: mockResponse.apiDesign },
              { type: 'configure_security', parameters: mockResponse.security },
              { type: 'optimize_performance', parameters: mockResponse.performance }
            ]
          }
        ]
      };
      
      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);
      
      const result = await unifiedPlanner.planBackendArchitecture({
        projectType: 'backend',
        complexity: 'high'
      });
      
      expect(result.pattern).toBeDefined();
      expect(result.security).toBeDefined();
      expect(result.performance).toBeDefined();
    });
  });

  describe('APIInterface Mock Scenarios', () => {
    test('should validate simple-api interface', async () => {
      const mockResponse = APIInterfacePlannerConfig.mockResponses['simple-api'];
      
      const mockPlan = {
        steps: [
          {
            actions: mockResponse.contracts.map(contract => ({
              type: 'create_contract',
              parameters: contract
            })).concat([
              { type: 'configure_communication', parameters: mockResponse.communication },
              { type: 'setup_error_handling', parameters: mockResponse.errorHandling }
            ]).concat(
              Object.entries(mockResponse.dataTransferObjects).map(([model, dtos]) => ({
                type: 'define_dto',
                parameters: { model, definition: dtos }
              }))
            )
          }
        ]
      };
      
      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);
      
      const result = await unifiedPlanner.planAPIInterface(
        { components: [{ name: 'UserList', type: 'display' }] },
        { apiDesign: { style: 'REST' }, dataLayer: { models: ['User'] } }
      );
      
      expect(result.contracts.length).toBeGreaterThan(0);
      expect(result.communication).toBeDefined();
      expect(result.errorHandling).toBeDefined();
      expect(Object.keys(result.dataTransferObjects).length).toBeGreaterThan(0);
    });

    test('should validate authenticated-api interface', async () => {
      const mockResponse = APIInterfacePlannerConfig.mockResponses['authenticated-api'];
      
      const mockPlan = {
        steps: [
          {
            actions: mockResponse.contracts.map(contract => ({
              type: 'create_contract',
              parameters: contract
            })).concat([
              { type: 'configure_authentication', parameters: mockResponse.authentication },
              { type: 'setup_pagination', parameters: mockResponse.pagination }
            ])
          }
        ]
      };
      
      mockGenericPlanner.createPlan.mockResolvedValue(mockPlan);
      
      const result = await unifiedPlanner.planAPIInterface(
        { components: [{ name: 'UserList', type: 'display' }] },
        { apiDesign: { style: 'REST' }, dataLayer: { models: ['User'] } }
      );
      
      expect(result.contracts.length).toBeGreaterThan(0);
      expect(result.authentication).toBeDefined();
    });
  });

  describe('Mock Response Consistency', () => {
    test('should ensure all mock responses have required metadata', () => {
      const configs = [
        RequirementAnalyzerConfig,
        DirectoryPlannerConfig,
        DependencyPlannerConfig,
        FrontendArchitecturePlannerConfig,
        BackendArchitecturePlannerConfig,
        APIInterfacePlannerConfig
      ];

      configs.forEach(config => {
        Object.entries(config.mockResponses).forEach(([scenario, mockResponse]) => {
          expect(mockResponse.metadata).toBeDefined();
          expect(mockResponse.metadata.planner).toBeDefined();
          expect(mockResponse.metadata.plannedAt).toBeDefined();
          expect(mockResponse.metadata.mockScenario).toBe(scenario);
        });
      });
    });

    test('should ensure mock responses match expected output formats', () => {
      // RequirementAnalyzer format
      Object.values(RequirementAnalyzerConfig.mockResponses).forEach(mock => {
        expect(mock).toHaveProperty('task');
        expect(mock).toHaveProperty('projectType');
        expect(mock).toHaveProperty('components');
        expect(mock).toHaveProperty('complexity');
      });

      // DirectoryPlanner format
      Object.values(DirectoryPlannerConfig.mockResponses).forEach(mock => {
        expect(mock).toHaveProperty('directories');
        expect(mock).toHaveProperty('files');
        expect(mock).toHaveProperty('isValid');
        expect(Array.isArray(mock.directories)).toBe(true);
        expect(Array.isArray(mock.files)).toBe(true);
      });

      // DependencyPlanner format
      Object.values(DependencyPlannerConfig.mockResponses).forEach(mock => {
        expect(mock).toHaveProperty('creationOrder');
        expect(mock).toHaveProperty('dependencies');
        expect(mock).toHaveProperty('conflicts');
        expect(mock).toHaveProperty('isValid');
        expect(Array.isArray(mock.creationOrder)).toBe(true);
      });

      // FrontendArchitecture format
      Object.values(FrontendArchitecturePlannerConfig.mockResponses).forEach(mock => {
        expect(mock).toHaveProperty('components');
        expect(mock).toHaveProperty('stateManagement');
        expect(mock).toHaveProperty('dataFlow');
        expect(Array.isArray(mock.components)).toBe(true);
      });

      // BackendArchitecture format
      Object.values(BackendArchitecturePlannerConfig.mockResponses).forEach(mock => {
        expect(mock).toHaveProperty('pattern');
        expect(mock).toHaveProperty('apiDesign');
        expect(mock).toHaveProperty('dataLayer');
        expect(mock).toHaveProperty('services');
        expect(Array.isArray(mock.services)).toBe(true);
      });

      // APIInterface format
      Object.values(APIInterfacePlannerConfig.mockResponses).forEach(mock => {
        expect(mock).toHaveProperty('contracts');
        expect(mock).toHaveProperty('dataTransferObjects');
        expect(mock).toHaveProperty('communication');
        expect(Array.isArray(mock.contracts)).toBe(true);
      });
    });

    test('should validate mock scenarios cover different complexity levels', () => {
      // Check that we have scenarios for different complexity levels
      const reqMocks = RequirementAnalyzerConfig.mockResponses;
      const complexities = Object.values(reqMocks).map(m => m.complexity);
      
      expect(complexities).toContain('low');
      expect(complexities).toContain('medium');
      expect(complexities).toContain('high');
      
      // Check project types
      const projectTypes = Object.values(reqMocks).map(m => m.projectType);
      expect(projectTypes).toContain('frontend');
      expect(projectTypes).toContain('backend');
      expect(projectTypes).toContain('fullstack');
    });
  });
});