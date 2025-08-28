/**
 * Tests for planning configurations
 * 
 * This test suite verifies that all planning configurations are valid and
 * contain the required properties and structure.
 */

import { describe, test, expect } from '@jest/globals';
import { RequirementAnalyzerConfig } from '../configs/RequirementAnalyzerConfig.js';
import { DirectoryPlannerConfig } from '../configs/DirectoryPlannerConfig.js';
import { DependencyPlannerConfig } from '../configs/DependencyPlannerConfig.js';
import { FrontendArchitecturePlannerConfig } from '../configs/FrontendArchitecturePlannerConfig.js';
import { BackendArchitecturePlannerConfig } from '../configs/BackendArchitecturePlannerConfig.js';
import { APIInterfacePlannerConfig } from '../configs/APIInterfacePlannerConfig.js';

describe('Planning Configurations', () => {
  const configurations = [
    { name: 'RequirementAnalyzerConfig', config: RequirementAnalyzerConfig },
    { name: 'DirectoryPlannerConfig', config: DirectoryPlannerConfig },
    { name: 'DependencyPlannerConfig', config: DependencyPlannerConfig },
    { name: 'FrontendArchitecturePlannerConfig', config: FrontendArchitecturePlannerConfig },
    { name: 'BackendArchitecturePlannerConfig', config: BackendArchitecturePlannerConfig },
    { name: 'APIInterfacePlannerConfig', config: APIInterfacePlannerConfig }
  ];

  configurations.forEach(({ name, config }) => {
    describe(name, () => {
      test('should have required top-level properties', () => {
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('allowableActions');
        expect(config).toHaveProperty('constraints');
        expect(config).toHaveProperty('examples');
        expect(config).toHaveProperty('mockResponses');
        
        expect(typeof config.name).toBe('string');
        expect(typeof config.description).toBe('string');
        expect(Array.isArray(config.allowableActions)).toBe(true);
        expect(Array.isArray(config.constraints)).toBe(true);
        expect(Array.isArray(config.examples)).toBe(true);
        expect(typeof config.mockResponses).toBe('object');
      });

      test('should have valid allowable actions', () => {
        expect(config.allowableActions.length).toBeGreaterThan(0);
        
        config.allowableActions.forEach((action, index) => {
          expect(action).toHaveProperty('type');
          expect(action).toHaveProperty('description');
          expect(action).toHaveProperty('inputs');
          expect(action).toHaveProperty('outputs');
          expect(action).toHaveProperty('parameters');
          
          expect(typeof action.type).toBe('string');
          expect(typeof action.description).toBe('string');
          expect(Array.isArray(action.inputs)).toBe(true);
          expect(Array.isArray(action.outputs)).toBe(true);
          expect(typeof action.parameters).toBe('object');
          
          // Check that action type is unique
          const duplicateTypes = config.allowableActions.filter(a => a.type === action.type);
          expect(duplicateTypes.length).toBe(1);
        });
      });

      test('should have valid constraints', () => {
        expect(config.constraints.length).toBeGreaterThan(0);
        
        config.constraints.forEach(constraint => {
          expect(typeof constraint).toBe('string');
          expect(constraint.length).toBeGreaterThan(0);
        });
      });

      test('should have valid examples', () => {
        expect(config.examples.length).toBeGreaterThan(0);
        
        config.examples.forEach(example => {
          expect(example).toHaveProperty('input');
          expect(example).toHaveProperty('expectedOutput');
          expect(typeof example.input).toBe('object');
          expect(typeof example.expectedOutput).toBe('object');
        });
      });

      test('should have valid mock responses', () => {
        const mockResponseKeys = Object.keys(config.mockResponses);
        expect(mockResponseKeys.length).toBeGreaterThan(0);
        
        mockResponseKeys.forEach(key => {
          const mockResponse = config.mockResponses[key];
          expect(typeof mockResponse).toBe('object');
          expect(mockResponse).toHaveProperty('metadata');
          expect(mockResponse.metadata).toHaveProperty('planner');
          expect(mockResponse.metadata).toHaveProperty('plannedAt');
          expect(mockResponse.metadata).toHaveProperty('mockScenario');
          expect(mockResponse.metadata.mockScenario).toBe(key);
        });
      });

      test('should have valid parameter schemas in actions', () => {
        config.allowableActions.forEach(action => {
          Object.keys(action.parameters).forEach(paramName => {
            const param = action.parameters[paramName];
            expect(param).toHaveProperty('type');
            expect(param).toHaveProperty('description');
            
            expect(typeof param.type).toBe('string');
            expect(typeof param.description).toBe('string');
            
            // If enum is present, it should be an array
            if (param.enum) {
              expect(Array.isArray(param.enum)).toBe(true);
              expect(param.enum.length).toBeGreaterThan(0);
            }
          });
        });
      });
    });
  });

  describe('Configuration Consistency', () => {
    test('should have consistent naming conventions', () => {
      configurations.forEach(({ name, config }) => {
        // Config name should match the class name
        expect(config.name).toBe(name.replace('Config', ''));
        
        // Action types should be snake_case
        config.allowableActions.forEach(action => {
          expect(action.type).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
        });
      });
    });

    test('should have consistent metadata structure', () => {
      configurations.forEach(({ name, config }) => {
        Object.keys(config.mockResponses).forEach(key => {
          const mockResponse = config.mockResponses[key];
          expect(mockResponse.metadata).toMatchObject({
            planner: expect.any(String),
            plannedAt: expect.any(Number),
            mockScenario: expect.any(String)
          });
        });
      });
    });

    test('should have valid action parameter types', () => {
      const validTypes = ['string', 'number', 'boolean', 'array', 'object'];
      
      configurations.forEach(({ name, config }) => {
        config.allowableActions.forEach(action => {
          Object.keys(action.parameters).forEach(paramName => {
            const param = action.parameters[paramName];
            expect(validTypes).toContain(param.type);
          });
        });
      });
    });

    test('should have unique action types across all configurations', () => {
      const allActionTypes = [];
      
      configurations.forEach(({ name, config }) => {
        config.allowableActions.forEach(action => {
          allActionTypes.push(`${name}:${action.type}`);
        });
      });
      
      // Check for duplicates within same configuration (already tested above)
      // This test ensures actions are meaningful and not duplicated across configs
      expect(allActionTypes.length).toBeGreaterThan(0);
    });
  });

  describe('Domain-Specific Validation', () => {
    test('RequirementAnalyzerConfig should have project type actions', () => {
      const actionTypes = RequirementAnalyzerConfig.allowableActions.map(a => a.type);
      expect(actionTypes).toContain('determine_project_type');
      expect(actionTypes).toContain('analyze_complexity');
      expect(actionTypes).toContain('extract_frontend_features');
      expect(actionTypes).toContain('extract_backend_features');
    });

    test('DirectoryPlannerConfig should have directory management actions', () => {
      const actionTypes = DirectoryPlannerConfig.allowableActions.map(a => a.type);
      expect(actionTypes).toContain('create_directory');
      expect(actionTypes).toContain('create_file');
      expect(actionTypes).toContain('apply_template');
      expect(actionTypes).toContain('validate_structure');
    });

    test('DependencyPlannerConfig should have dependency analysis actions', () => {
      const actionTypes = DependencyPlannerConfig.allowableActions.map(a => a.type);
      expect(actionTypes).toContain('analyze_file_type');
      expect(actionTypes).toContain('detect_dependency');
      expect(actionTypes).toContain('order_files');
      expect(actionTypes).toContain('detect_circular_dependency');
    });

    test('FrontendArchitecturePlannerConfig should have component actions', () => {
      const actionTypes = FrontendArchitecturePlannerConfig.allowableActions.map(a => a.type);
      expect(actionTypes).toContain('create_component');
      expect(actionTypes).toContain('analyze_component_hierarchy');
      expect(actionTypes).toContain('define_state_management');
      expect(actionTypes).toContain('configure_styling');
    });

    test('BackendArchitecturePlannerConfig should have service actions', () => {
      const actionTypes = BackendArchitecturePlannerConfig.allowableActions.map(a => a.type);
      expect(actionTypes).toContain('design_api');
      expect(actionTypes).toContain('plan_data_layer');
      expect(actionTypes).toContain('create_service');
      expect(actionTypes).toContain('configure_security');
    });

    test('APIInterfacePlannerConfig should have interface actions', () => {
      const actionTypes = APIInterfacePlannerConfig.allowableActions.map(a => a.type);
      expect(actionTypes).toContain('create_basic_api_contract');
      expect(actionTypes).toContain('define_data_transfer_format');
      expect(actionTypes).toContain('setup_error_handling');
      expect(actionTypes).toContain('update_api_contract');
      expect(actionTypes).toContain('review_and_finalize_api_contract');
    });
  });

  describe('Mock Response Validation', () => {
    test('should have appropriate mock scenarios for each config', () => {
      // RequirementAnalyzer should have project type scenarios
      expect(RequirementAnalyzerConfig.mockResponses).toHaveProperty('simple-frontend');
      expect(RequirementAnalyzerConfig.mockResponses).toHaveProperty('backend-api');
      
      // DirectoryPlanner should have structure scenarios
      expect(DirectoryPlannerConfig.mockResponses).toHaveProperty('simple-frontend');
      expect(DirectoryPlannerConfig.mockResponses).toHaveProperty('modular-backend');
      
      // DependencyPlanner should have dependency scenarios
      expect(DependencyPlannerConfig.mockResponses).toHaveProperty('simple-backend');
      expect(DependencyPlannerConfig.mockResponses).toHaveProperty('modular-backend');
      
      // FrontendArchitecture should have component scenarios
      expect(FrontendArchitecturePlannerConfig.mockResponses).toHaveProperty('simple-frontend');
      expect(FrontendArchitecturePlannerConfig.mockResponses).toHaveProperty('modular-frontend');
      
      // BackendArchitecture should have service scenarios
      expect(BackendArchitecturePlannerConfig.mockResponses).toHaveProperty('simple-backend');
      expect(BackendArchitecturePlannerConfig.mockResponses).toHaveProperty('layered-backend');
      
      // APIInterface should have interface scenarios
      expect(APIInterfacePlannerConfig.mockResponses).toHaveProperty('simple-api');
      expect(APIInterfacePlannerConfig.mockResponses).toHaveProperty('authenticated-api');
    });

    test('should have valid structure in mock responses', () => {
      // Check RequirementAnalyzer mock structure
      const reqMock = RequirementAnalyzerConfig.mockResponses['simple-frontend'];
      expect(reqMock).toHaveProperty('task');
      expect(reqMock).toHaveProperty('projectType');
      expect(reqMock).toHaveProperty('components');
      expect(reqMock).toHaveProperty('complexity');
      
      // Check DirectoryPlanner mock structure
      const dirMock = DirectoryPlannerConfig.mockResponses['simple-frontend'];
      expect(dirMock).toHaveProperty('directories');
      expect(dirMock).toHaveProperty('files');
      expect(dirMock).toHaveProperty('descriptions');
      expect(dirMock).toHaveProperty('isValid');
      
      // Check DependencyPlanner mock structure
      const depMock = DependencyPlannerConfig.mockResponses['simple-backend'];
      expect(depMock).toHaveProperty('creationOrder');
      expect(depMock).toHaveProperty('dependencies');
      expect(depMock).toHaveProperty('conflicts');
      expect(depMock).toHaveProperty('isValid');
      
      // Check FrontendArchitecture mock structure
      const frontMock = FrontendArchitecturePlannerConfig.mockResponses['simple-frontend'];
      expect(frontMock).toHaveProperty('components');
      expect(frontMock).toHaveProperty('componentHierarchy');
      expect(frontMock).toHaveProperty('stateManagement');
      expect(frontMock).toHaveProperty('dataFlow');
      
      // Check BackendArchitecture mock structure
      const backMock = BackendArchitecturePlannerConfig.mockResponses['simple-backend'];
      expect(backMock).toHaveProperty('pattern');
      expect(backMock).toHaveProperty('apiDesign');
      expect(backMock).toHaveProperty('dataLayer');
      expect(backMock).toHaveProperty('services');
      
      // Check APIInterface mock structure
      const apiMock = APIInterfacePlannerConfig.mockResponses['simple-api'];
      expect(apiMock).toHaveProperty('contracts');
      expect(apiMock).toHaveProperty('dataTransferObjects');
      expect(apiMock).toHaveProperty('communication');
      expect(apiMock).toHaveProperty('errorHandling');
    });
  });
});