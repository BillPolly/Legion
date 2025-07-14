/**
 * Tests for CodeGenerationPlanner class
 * 
 * CodeGenerationPlanner handles detailed code generation planning
 * including file creation, component structure, and API design.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { CodeGenerationPlanner } from '../../src/planners/CodeGenerationPlanner.js';

describe('CodeGenerationPlanner', () => {
  let planner;

  beforeEach(() => {
    planner = new CodeGenerationPlanner();
  });

  describe('Constructor', () => {
    test('should create CodeGenerationPlanner with default configuration', () => {
      expect(planner).toBeDefined();
      expect(planner.config).toBeDefined();
      expect(planner.config.generateComments).toBe(true);
      expect(planner.config.useTypescript).toBe(false);
    });

    test('should accept custom configuration', () => {
      const customPlanner = new CodeGenerationPlanner({
        generateComments: false,
        useTypescript: true,
        codeStyle: 'airbnb'
      });

      expect(customPlanner.config.generateComments).toBe(false);
      expect(customPlanner.config.useTypescript).toBe(true);
      expect(customPlanner.config.codeStyle).toBe('airbnb');
    });

    test('should have file templates defined', () => {
      expect(planner.fileTemplates).toBeDefined();
      expect(planner.fileTemplates.html).toBeDefined();
      expect(planner.fileTemplates.css).toBeDefined();
      expect(planner.fileTemplates.javascript).toBeDefined();
    });
  });

  describe('File Generation Planning', () => {
    test('should plan HTML file generation', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form', 'navigation'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const fileSteps = planner.planFileGeneration(analysis);

      expect(fileSteps).toBeDefined();
      expect(fileSteps.length).toBeGreaterThan(0);
      
      const htmlStep = fileSteps.find(step => step.fileName === 'index.html');
      expect(htmlStep).toBeDefined();
      expect(htmlStep.content).toContain('<!DOCTYPE html>');
      expect(htmlStep.content).toContain('<title>');
    });

    test('should plan CSS file generation', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form', 'navigation'],
            technologies: ['html', 'css']
          }
        }
      };

      const fileSteps = planner.planFileGeneration(analysis);
      
      const cssStep = fileSteps.find(step => step.fileName === 'style.css');
      expect(cssStep).toBeDefined();
      expect(cssStep.content).toContain('/* Reset styles */');
      expect(cssStep.content).toContain('body');
    });

    test('should plan JavaScript file generation', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form', 'validation'],
            technologies: ['html', 'javascript']
          }
        }
      };

      const fileSteps = planner.planFileGeneration(analysis);
      
      const jsStep = fileSteps.find(step => step.fileName === 'script.js');
      expect(jsStep).toBeDefined();
      expect(jsStep.content).toContain('DOMContentLoaded');
    });

    test('should plan backend file generation', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api', 'auth'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const fileSteps = planner.planFileGeneration(analysis);
      
      const serverStep = fileSteps.find(step => step.fileName === 'server.js');
      expect(serverStep).toBeDefined();
      expect(serverStep.content).toContain('express');
      expect(serverStep.content).toContain('app.listen');
    });

    test('should include feature-specific code in generated files', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form', 'validation', 'auth'],
            technologies: ['html', 'javascript']
          }
        }
      };

      const fileSteps = planner.planFileGeneration(analysis);
      
      const htmlStep = fileSteps.find(step => step.fileName === 'index.html');
      expect(htmlStep.content).toContain('<form');
      
      const jsStep = fileSteps.find(step => step.fileName === 'script.js');
      expect(jsStep.content).toContain('validation');
    });

    test('should generate TypeScript files when configured', () => {
      const tsPlanner = new CodeGenerationPlanner({
        useTypescript: true
      });

      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'typescript']
          }
        }
      };

      const fileSteps = tsPlanner.planFileGeneration(analysis);
      
      const tsStep = fileSteps.find(step => step.fileName.endsWith('.ts'));
      expect(tsStep).toBeDefined();
      expect(tsStep.content).toContain('interface');
    });
  });

  describe('Component Planning', () => {
    test('should plan frontend component structure', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form', 'navigation', 'auth'],
            technologies: ['html', 'css', 'javascript']
          }
        }
      };

      const componentPlan = planner.planComponentStructure(analysis);

      expect(componentPlan.components).toBeDefined();
      expect(componentPlan.components.length).toBeGreaterThan(0);
      
      // Should have form component
      const formComponent = componentPlan.components.find(c => c.name === 'FormComponent');
      expect(formComponent).toBeDefined();
      expect(formComponent.type).toBe('functional');
      expect(formComponent.dependencies).toBeDefined();
    });

    test('should plan navigation component when nav features present', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['navigation', 'navbar'],
            technologies: ['html', 'javascript']
          }
        }
      };

      const componentPlan = planner.planComponentStructure(analysis);
      
      const navComponent = componentPlan.components.find(c => c.name === 'NavigationComponent');
      expect(navComponent).toBeDefined();
      expect(navComponent.files).toContain('navigation.html');
      expect(navComponent.files).toContain('navigation.js');
    });

    test('should plan authentication components when auth features present', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['auth', 'login'],
            technologies: ['html', 'javascript']
          }
        }
      };

      const componentPlan = planner.planComponentStructure(analysis);
      
      const authComponent = componentPlan.components.find(c => c.name === 'AuthComponent');
      expect(authComponent).toBeDefined();
      expect(authComponent.features).toContain('authentication');
    });

    test('should create component hierarchy based on dependencies', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form', 'validation', 'auth'],
            technologies: ['html', 'javascript']
          }
        }
      };

      const componentPlan = planner.planComponentStructure(analysis);
      
      expect(componentPlan.hierarchy).toBeDefined();
      expect(componentPlan.hierarchy.root).toBeDefined();
      expect(componentPlan.hierarchy.children).toBeDefined();
    });

    test('should handle backend component planning', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api', 'auth', 'database'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const componentPlan = planner.planComponentStructure(analysis);

      expect(componentPlan.components).toBeDefined();
      
      // Should have API components
      const routerComponent = componentPlan.components.find(c => c.name === 'ApiRouterComponent');
      expect(routerComponent).toBeDefined();
      
      const authComponent = componentPlan.components.find(c => c.name === 'AuthComponent');
      expect(authComponent).toBeDefined();
    });
  });

  describe('API Endpoint Planning', () => {
    test('should plan REST API endpoints for backend projects', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api', 'rest-api', 'crud'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const apiPlan = planner.planApiEndpoints(analysis);

      expect(apiPlan.endpoints).toBeDefined();
      expect(apiPlan.endpoints.length).toBeGreaterThan(0);
      
      // Should have CRUD endpoints
      const endpoints = apiPlan.endpoints.map(e => e.path);
      expect(endpoints).toContain('/api/items');
      expect(apiPlan.endpoints.some(endpoint => endpoint.method === 'GET')).toBe(true);
    });

    test('should plan authentication endpoints when auth features present', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api', 'auth', 'authentication'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const apiPlan = planner.planApiEndpoints(analysis);
      
      const authEndpoints = apiPlan.endpoints.filter(e => e.path.includes('/auth'));
      expect(authEndpoints.length).toBeGreaterThan(0);
      
      const loginEndpoint = apiPlan.endpoints.find(e => e.path === '/auth/login');
      expect(loginEndpoint).toBeDefined();
      expect(loginEndpoint.method).toBe('POST');
    });

    test('should plan entity-specific endpoints', () => {
      const analysis = {
        projectType: 'backend',
        task: 'Create API for managing users and products',
        components: {
          backend: {
            features: ['api', 'crud'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const apiPlan = planner.planApiEndpoints(analysis);
      
      const userEndpoints = apiPlan.endpoints.filter(e => e.path.includes('/users'));
      const productEndpoints = apiPlan.endpoints.filter(e => e.path.includes('/products'));
      
      expect(userEndpoints.length).toBeGreaterThan(0);
      expect(productEndpoints.length).toBeGreaterThan(0);
    });

    test('should include middleware planning for API endpoints', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api', 'auth', 'cors'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const apiPlan = planner.planApiEndpoints(analysis);
      
      expect(apiPlan.middleware).toBeDefined();
      expect(apiPlan.middleware.length).toBeGreaterThan(0);
      
      const authMiddleware = apiPlan.middleware.find(m => m.name === 'auth');
      expect(authMiddleware).toBeDefined();
    });

    test('should plan API documentation structure', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api', 'documentation'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const apiPlan = planner.planApiEndpoints(analysis);
      
      expect(apiPlan.documentation).toBeDefined();
      expect(apiPlan.documentation.format).toBeDefined();
      expect(apiPlan.documentation.endpoints).toBeDefined();
    });

    test('should handle fullstack API planning', () => {
      const analysis = {
        projectType: 'fullstack',
        components: {
          frontend: {
            features: ['form', 'dashboard'],
            technologies: ['html', 'javascript']
          },
          backend: {
            features: ['api', 'auth'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const apiPlan = planner.planApiEndpoints(analysis);
      
      expect(apiPlan.endpoints).toBeDefined();
      expect(apiPlan.clientIntegration).toBeDefined();
      expect(apiPlan.clientIntegration.fetchMethods).toBeDefined();
    });
  });

  describe('Code Quality and Standards', () => {
    test('should include code quality checks in planning', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'express']
          }
        }
      };

      const qualityPlan = planner.planCodeQuality(analysis);

      expect(qualityPlan.linting).toBeDefined();
      expect(qualityPlan.testing).toBeDefined();
      expect(qualityPlan.formatting).toBeDefined();
    });

    test('should plan testing structure based on project type', () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api', 'testing'],
            technologies: ['nodejs', 'express', 'jest']
          }
        }
      };

      const qualityPlan = planner.planCodeQuality(analysis);
      
      expect(qualityPlan.testing.framework).toBe('jest');
      expect(qualityPlan.testing.testFiles).toBeDefined();
      expect(qualityPlan.testing.testTypes).toContain('unit');
    });

    test('should include documentation planning', () => {
      const analysis = {
        projectType: 'fullstack',
        complexity: 'high',
        components: {
          frontend: { technologies: ['javascript'] },
          backend: { technologies: ['nodejs'] }
        }
      };

      const qualityPlan = planner.planCodeQuality(analysis);
      
      expect(qualityPlan.documentation).toBeDefined();
      expect(qualityPlan.documentation.includeJsdoc).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing analysis gracefully', () => {
      expect(() => planner.planFileGeneration(null)).toThrow('Analysis is required');
    });

    test('should handle missing project type', () => {
      const analysis = {
        components: { frontend: { technologies: ['html'] } }
      };

      expect(() => planner.planFileGeneration(analysis)).toThrow('Project type is required');
    });

    test('should provide fallback for unknown features', () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['unknown-feature'],
            technologies: ['html']
          }
        }
      };

      const fileSteps = planner.planFileGeneration(analysis);
      
      // Should still generate basic files
      expect(fileSteps.length).toBeGreaterThan(0);
      const htmlStep = fileSteps.find(step => step.fileName === 'index.html');
      expect(htmlStep).toBeDefined();
    });
  });

  describe('Integration with Existing Components', () => {
    test('should integrate with ProjectStructurePlanner output', () => {
      const structurePlan = {
        directories: ['components', 'services', 'utils'],
        files: ['index.html', 'package.json']
      };

      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form'],
            technologies: ['html', 'javascript']
          }
        }
      };

      const integrationPlan = planner.integrateWithStructure(analysis, structurePlan);

      expect(integrationPlan.fileMapping).toBeDefined();
      expect(integrationPlan.componentPlacement).toBeDefined();
    });

    test('should handle directory-based component organization', () => {
      const structurePlan = {
        directories: ['components', 'services'],
        files: ['index.html']
      };

      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form', 'navigation'],
            technologies: ['html', 'javascript']
          }
        }
      };

      const integrationPlan = planner.integrateWithStructure(analysis, structurePlan);

      expect(integrationPlan.componentPlacement['FormComponent']).toContain('components');
      expect(integrationPlan.componentPlacement['NavigationComponent']).toContain('components');
    });
  });
});