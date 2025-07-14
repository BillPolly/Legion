/**
 * Tests for CodePlanner class
 * 
 * CodePlanner extends BasePlanner to provide specialized planning
 * for software development projects.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { CodePlanner } from '../../src/planners/CodePlanner.js';
import { PlanContext } from '../../src/models/PlanContext.js';
import { Plan } from '../../src/models/Plan.js';

describe('CodePlanner', () => {
  let planner;

  beforeEach(() => {
    planner = new CodePlanner();
  });

  describe('Constructor', () => {
    test('should create CodePlanner with default configuration', () => {
      expect(planner).toBeDefined();
      expect(planner.config.projectTypes).toEqual(['frontend', 'backend', 'fullstack']);
      expect(planner.config.analysisDepth).toBe('standard');
    });

    test('should accept custom configuration', () => {
      const customPlanner = new CodePlanner({
        projectTypes: ['frontend'],
        analysisDepth: 'deep'
      });

      expect(customPlanner.config.projectTypes).toEqual(['frontend']);
      expect(customPlanner.config.analysisDepth).toBe('deep');
    });

    test('should have feature keywords defined', () => {
      expect(planner.featureKeywords.frontend).toBeDefined();
      expect(planner.featureKeywords.backend).toBeDefined();
      expect(planner.featureKeywords.frontend.form).toContain('form');
      expect(planner.featureKeywords.backend.api).toContain('api');
    });
  });

  describe('Project Type Support', () => {
    test('should support frontend projects', () => {
      expect(planner.supportsProjectType('frontend')).toBe(true);
    });

    test('should support backend projects', () => {
      expect(planner.supportsProjectType('backend')).toBe(true);
    });

    test('should support fullstack projects', () => {
      expect(planner.supportsProjectType('fullstack')).toBe(true);
    });

    test('should not support unsupported project types', () => {
      expect(planner.supportsProjectType('mobile')).toBe(false);
    });

    test('should return supported project types', () => {
      const supportedTypes = planner.getSupportedProjectTypes();
      expect(supportedTypes).toEqual(['frontend', 'backend', 'fullstack']);
    });
  });

  describe('Requirements Analysis', () => {
    test('should analyze frontend requirements', async () => {
      const requirements = {
        task: 'Create a contact form',
        requirements: {
          frontend: 'Create a form with name, email, and message fields with validation'
        }
      };

      const context = new PlanContext();
      const analysis = await planner.analyzeRequirements(requirements, context);

      expect(analysis.projectType).toBe('frontend');
      expect(analysis.components.frontend.features).toContain('form');
      expect(analysis.components.frontend.features).toContain('validation');
      expect(analysis.components.frontend.technologies).toContain('html');
      expect(analysis.components.frontend.technologies).toContain('javascript');
    });

    test('should analyze backend requirements', async () => {
      const requirements = {
        task: 'Create REST API',
        requirements: {
          backend: 'Create REST API with CRUD operations and MongoDB storage'
        }
      };

      const context = new PlanContext();
      const analysis = await planner.analyzeRequirements(requirements, context);

      expect(analysis.projectType).toBe('backend');
      expect(analysis.components.backend.features).toContain('rest-api');
      expect(analysis.components.backend.features).toContain('crud');
      expect(analysis.components.backend.storage).toBe('mongodb');
      expect(analysis.components.backend.technologies).toContain('nodejs');
      expect(analysis.components.backend.technologies).toContain('express');
    });

    test('should analyze fullstack requirements', async () => {
      const requirements = {
        task: 'Create fullstack app',
        requirements: {
          frontend: 'User interface with forms',
          backend: 'API with database'
        }
      };

      const context = new PlanContext();
      const analysis = await planner.analyzeRequirements(requirements, context);

      expect(analysis.projectType).toBe('fullstack');
      expect(analysis.components.frontend).toBeDefined();
      expect(analysis.components.backend).toBeDefined();
      expect(analysis.apiInterface).toBeDefined();
    });

    test('should analyze from task description when no specific requirements', async () => {
      const requirements = {
        task: 'Create a login form with validation'
      };

      const context = new PlanContext();
      const analysis = await planner.analyzeRequirements(requirements, context);

      expect(analysis.projectType).toBe('frontend');
      expect(analysis.components.frontend.features).toContain('form');
      expect(analysis.components.frontend.features).toContain('login');
      expect(analysis.components.frontend.features).toContain('validation');
    });

    test('should determine complexity correctly', async () => {
      const simpleRequirements = {
        task: 'Create a simple webpage'
      };

      const complexRequirements = {
        task: 'Create complex app',
        requirements: {
          frontend: 'Multiple forms, tables, charts, authentication, navigation',
          backend: 'REST API, CRUD, authentication, real-time features, file upload'
        }
      };

      const context = new PlanContext();
      
      const simpleAnalysis = await planner.analyzeRequirements(simpleRequirements, context);
      expect(simpleAnalysis.complexity).toBe('low');

      const complexAnalysis = await planner.analyzeRequirements(complexRequirements, context);
      expect(complexAnalysis.complexity).toBe('high');
    });

    test('should analyze security requirements', async () => {
      const requirements = {
        task: 'Create app with authentication',
        requirements: {
          frontend: 'Login form',
          backend: 'JWT authentication'
        }
      };

      const context = new PlanContext();
      const analysis = await planner.analyzeRequirements(requirements, context);

      expect(analysis.security.authentication).toBe(true);
    });

    test('should update context with analysis results', async () => {
      const requirements = {
        task: 'Create React app',
        requirements: {
          frontend: 'React components'
        }
      };

      const context = new PlanContext();
      await planner.analyzeRequirements(requirements, context);

      expect(context.projectType).toBe('frontend');
      expect(context.technologies.frontend).toContain('html');
      expect(context.technologies.frontend).toContain('javascript');
    });
  });

  describe('Plan Structure Generation', () => {
    test('should generate frontend plan structure', async () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form'],
            technologies: ['html', 'css', 'javascript']
          }
        },
        complexity: 'low'
      };

      const context = new PlanContext();
      const structure = await planner.generatePlanStructure(analysis, context);

      expect(structure.steps).toBeDefined();
      expect(structure.executionOrder).toBeDefined();
      
      // Should have project setup and frontend steps
      const stepIds = structure.steps.map(s => s.id);
      expect(stepIds).toContain('project-setup');
      expect(stepIds).toContain('frontend-setup');
      expect(stepIds).toContain('testing');
      expect(stepIds).toContain('documentation');
    });

    test('should generate backend plan structure', async () => {
      const analysis = {
        projectType: 'backend',
        components: {
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'express']
          }
        },
        complexity: 'medium'
      };

      const context = new PlanContext();
      const structure = await planner.generatePlanStructure(analysis, context);

      const stepIds = structure.steps.map(s => s.id);
      expect(stepIds).toContain('project-setup');
      expect(stepIds).toContain('backend-setup');
      expect(stepIds).toContain('testing');
      expect(stepIds).toContain('documentation');
    });

    test('should generate fullstack plan structure', async () => {
      const analysis = {
        projectType: 'fullstack',
        components: {
          frontend: {
            features: ['form'],
            technologies: ['html', 'css', 'javascript']
          },
          backend: {
            features: ['api'],
            technologies: ['nodejs', 'express']
          }
        },
        complexity: 'high'
      };

      const context = new PlanContext();
      const structure = await planner.generatePlanStructure(analysis, context);

      const stepIds = structure.steps.map(s => s.id);
      expect(stepIds).toContain('project-setup');
      expect(stepIds).toContain('frontend-setup');
      expect(stepIds).toContain('backend-setup');
      expect(stepIds).toContain('integration');
      expect(stepIds).toContain('testing');
      expect(stepIds).toContain('documentation');
    });

    test('should create steps with proper dependencies', async () => {
      const analysis = {
        projectType: 'fullstack',
        components: {
          frontend: { features: [], technologies: [] },
          backend: { features: [], technologies: [] }
        }
      };

      const context = new PlanContext();
      const structure = await planner.generatePlanStructure(analysis, context);

      const setupStep = structure.steps.find(s => s.id === 'project-setup');
      const frontendStep = structure.steps.find(s => s.id === 'frontend-setup');
      const backendStep = structure.steps.find(s => s.id === 'backend-setup');
      const integrationStep = structure.steps.find(s => s.id === 'integration');

      expect(setupStep.dependencies).toEqual([]);
      expect(frontendStep.dependencies).toContain('project-setup');
      expect(backendStep.dependencies).toContain('project-setup');
      expect(integrationStep.dependencies).toContain('frontend-setup');
      expect(integrationStep.dependencies).toContain('backend-setup');
    });

    test('should create steps with actions', async () => {
      const analysis = {
        projectType: 'frontend',
        components: {
          frontend: { features: [], technologies: [] }
        }
      };

      const context = new PlanContext();
      const structure = await planner.generatePlanStructure(analysis, context);

      const setupStep = structure.steps.find(s => s.id === 'project-setup');
      expect(setupStep.actions).toBeDefined();
      expect(setupStep.actions.length).toBeGreaterThan(0);
      expect(setupStep.actions[0].type).toBe('create-directory');
    });
  });

  describe('Plan Validation', () => {
    test('should validate complete plan successfully', async () => {
      const plan = {
        steps: [
          { id: 'project-setup', dependencies: [] },
          { id: 'frontend-setup', dependencies: ['project-setup'] },
          { id: 'testing', dependencies: ['frontend-setup'] }
        ]
      };

      const context = new PlanContext({ projectType: 'frontend' });
      const validation = await planner.validatePlan(plan, context);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect missing required steps', async () => {
      const plan = {
        steps: [
          { id: 'frontend-setup', dependencies: [] }
        ]
      };

      const context = new PlanContext();
      const validation = await planner.validatePlan(plan, context);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Missing required step: project-setup');
    });

    test('should detect invalid dependencies', async () => {
      const plan = {
        steps: [
          { id: 'project-setup', dependencies: [] },
          { id: 'frontend-setup', dependencies: ['nonexistent-step'] }
        ]
      };

      const context = new PlanContext();
      const validation = await planner.validatePlan(plan, context);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('depends on non-existent step'))).toBe(true);
    });

    test('should warn about missing implementation steps', async () => {
      const plan = {
        steps: [
          { id: 'project-setup', dependencies: [], type: 'setup' }
        ]
      };

      const context = new PlanContext({ projectType: 'frontend' });
      const validation = await planner.validatePlan(plan, context);

      expect(validation.warnings).toContain('No frontend implementation steps found');
    });
  });

  describe('Plan Refinement', () => {
    test('should add missing required steps', async () => {
      const plan = {
        steps: [
          { id: 'frontend-setup', dependencies: [] }
        ],
        metadata: {}
      };

      const validationResult = {
        errors: ['Missing required step: project-setup'],
        warnings: []
      };

      const context = new PlanContext();
      const refinedPlan = await planner.refinePlan(plan, validationResult, context);

      const stepIds = refinedPlan.steps.map(s => s.id);
      expect(stepIds).toContain('project-setup');
    });

    test('should fix dependency order', async () => {
      const plan = {
        steps: [
          { id: 'frontend-setup', dependencies: ['project-setup'] },
          { id: 'project-setup', dependencies: [] }
        ]
      };

      const validationResult = { errors: [], warnings: [] };
      const context = new PlanContext();
      const refinedPlan = await planner.refinePlan(plan, validationResult, context);

      expect(refinedPlan.steps[0].id).toBe('project-setup');
      expect(refinedPlan.steps[1].id).toBe('frontend-setup');
    });

    test('should detect circular dependencies', async () => {
      const plan = {
        steps: [
          { id: 'step1', dependencies: ['step2'] },
          { id: 'step2', dependencies: ['step1'] }
        ]
      };

      const validationResult = { errors: [], warnings: [] };
      const context = new PlanContext();

      await expect(planner.refinePlan(plan, validationResult, context))
        .rejects.toThrow('Circular dependency detected');
    });
  });

  describe('Feature Extraction', () => {
    test('should extract frontend features from text', () => {
      const features = planner._extractFeatures('Create a login form with validation');
      
      expect(features).toContain('form');
      expect(features).toContain('login');
      expect(features).toContain('validation');
    });

    test('should extract backend features from text', () => {
      const features = planner._extractFeatures('Build REST API with CRUD operations');
      
      expect(features).toContain('rest-api');
      expect(features).toContain('crud');
    });

    test('should handle empty text', () => {
      const features = planner._extractFeatures('');
      expect(features).toEqual([]);
    });

    test('should handle null/undefined text', () => {
      expect(planner._extractFeatures(null)).toEqual([]);
      expect(planner._extractFeatures(undefined)).toEqual([]);
    });
  });

  describe('Integration with BasePlanner', () => {
    test('should create complete plan using template method', async () => {
      const requirements = {
        task: 'Create a simple contact form',
        requirements: {
          frontend: 'HTML form with validation'
        }
      };

      const context = new PlanContext();
      const plan = await planner.createPlan(requirements, context);

      expect(plan).toBeInstanceOf(Plan);
      expect(plan.name).toBe('Create a simple contact form');
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.metadata.planner).toBe('CodePlanner');
    });

    test('should emit events during planning', async () => {
      const events = [];
      planner.on('analysis:start', () => events.push('analysis:start'));
      planner.on('analysis:complete', () => events.push('analysis:complete'));
      planner.on('generation:start', () => events.push('generation:start'));
      planner.on('generation:complete', () => events.push('generation:complete'));

      const requirements = {
        task: 'Create simple webpage'
      };

      await planner.createPlan(requirements);

      expect(events).toContain('analysis:start');
      expect(events).toContain('analysis:complete');
      expect(events).toContain('generation:start');
      expect(events).toContain('generation:complete');
    });

    test('should handle refinement iterations', async () => {
      class TestCodePlanner extends CodePlanner {
        constructor() {
          super();
          this.validationCount = 0;
        }

        async validatePlan(plan, context) {
          this.validationCount++;
          if (this.validationCount < 2) {
            return {
              isValid: false,
              errors: ['Test error'],
              warnings: []
            };
          }
          return {
            isValid: true,
            errors: [],
            warnings: []
          };
        }
      }

      const testPlanner = new TestCodePlanner();
      const requirements = { task: 'Test task' };
      
      const plan = await testPlanner.createPlan(requirements);
      
      expect(plan.metadata.iterations).toBe(2);
      expect(testPlanner.validationCount).toBe(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid requirements', async () => {
      const context = new PlanContext();

      await expect(planner.analyzeRequirements(null, context))
        .rejects.toThrow();

      await expect(planner.analyzeRequirements({}, context))
        .rejects.toThrow();
    });

    test('should handle missing task in requirements', async () => {
      const requirements = {
        requirements: {
          frontend: 'Some frontend requirements'
        }
      };

      const context = new PlanContext();

      await expect(planner.createPlan(requirements, context))
        .rejects.toThrow('Requirements must include a task description');
    });
  });
});