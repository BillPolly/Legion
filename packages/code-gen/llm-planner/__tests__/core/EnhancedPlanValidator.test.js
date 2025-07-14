/**
 * Tests for EnhancedPlanValidator
 * 
 * The EnhancedPlanValidator provides comprehensive validation using
 * a pipeline of specialized validators and domain-specific validation.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { EnhancedPlanValidator } from '../../src/core/EnhancedPlanValidator.js';
import { Plan } from '../../src/models/Plan.js';
import { PlanStep } from '../../src/models/PlanStep.js';
import { PlanAction } from '../../src/models/PlanAction.js';
import { PlanContext } from '../../src/models/PlanContext.js';

describe('EnhancedPlanValidator', () => {
  let validator;
  let validPlan;

  beforeEach(() => {
    validator = new EnhancedPlanValidator({
      strictMode: true,
      requireSuccessCriteria: true,
      validateSemantics: true
    });

    // Create a valid plan for testing
    const context = new PlanContext({
      task: 'Create a todo app',
      projectType: 'frontend',
      complexity: 'medium',
      requirements: 'Create a simple todo application with add, delete, and complete functionality'
    });

    const steps = [
      new PlanStep({
        id: 'setup-1',
        name: 'Initialize project structure',
        type: 'setup',
        description: 'Set up the basic project structure and files',
        dependencies: [],
        actions: [
          new PlanAction({
            type: 'create-directory',
            path: 'todo-app',
            description: 'Create main project directory'
          }),
          new PlanAction({
            type: 'create-file',
            path: 'todo-app/index.html',
            content: '<!DOCTYPE html>...',
            description: 'Create main HTML file'
          })
        ]
      }),
      new PlanStep({
        id: 'impl-1',
        name: 'Implement todo functionality',
        type: 'implementation',
        description: 'Add JavaScript functionality for todo operations',
        dependencies: ['setup-1'],
        actions: [
          new PlanAction({
            type: 'create-file',
            path: 'todo-app/script.js',
            content: 'const todos = [];...',
            description: 'Create JavaScript file'
          })
        ]
      }),
      new PlanStep({
        id: 'test-1',
        name: 'Add basic tests',
        type: 'testing',
        description: 'Create tests for todo functionality',
        dependencies: ['impl-1'],
        actions: [
          new PlanAction({
            type: 'create-file',
            path: 'todo-app/tests.js',
            content: 'describe("Todo App", () => {...',
            description: 'Create test file'
          })
        ]
      })
    ];

    validPlan = new Plan({
      name: 'Todo Application Plan',
      description: 'Plan for creating a simple todo application',
      context,
      steps,
      metadata: {
        createdAt: new Date(),
        version: '1.0.0',
        estimatedDuration: '2 hours',
        complexity: 'medium'
      },
      successCriteria: [
        'All todo operations work correctly',
        'Tests pass successfully',
        'UI is responsive and functional'
      ]
    });
  });

  describe('Constructor and Configuration', () => {
    test('should create validator with default configuration', () => {
      const defaultValidator = new EnhancedPlanValidator();
      expect(defaultValidator).toBeDefined();
      expect(defaultValidator.config.strictMode).toBe(false);
      expect(defaultValidator.config.requireSuccessCriteria).toBe(true);
    });

    test('should create validator with custom configuration', () => {
      const customValidator = new EnhancedPlanValidator({
        strictMode: true,
        maxSteps: 50,
        requireSuccessCriteria: false
      });
      expect(customValidator.config.strictMode).toBe(true);
      expect(customValidator.config.maxSteps).toBe(50);
      expect(customValidator.config.requireSuccessCriteria).toBe(false);
    });

    test('should initialize validation pipeline', () => {
      expect(validator.validationPipeline).toBeDefined();
      expect(validator.validationPipeline.length).toBe(4);
      expect(validator.validationPipeline[0].constructor.name).toBe('StructuralValidator');
      expect(validator.validationPipeline[1].constructor.name).toBe('DependencyValidator');
      expect(validator.validationPipeline[2].constructor.name).toBe('SemanticValidator');
      expect(validator.validationPipeline[3].constructor.name).toBe('CompletenessValidator');
    });

    test('should extend EventEmitter', () => {
      expect(typeof validator.on).toBe('function');
      expect(typeof validator.emit).toBe('function');
    });
  });

  describe('Basic Validation', () => {
    test('should validate a valid plan successfully', async () => {
      const result = await validator.validate(validPlan);
      
      // Debug: log errors if any
      if (result.errors.length > 0) {
        console.log('Validation errors:', result.errors);
      }
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(0);
      expect(result.executionReadiness).toBeDefined();
      expect(result.executionReadiness.ready).toBe(true);
    });

    test('should emit validation events', async () => {
      const events = [];
      validator.on('validation:start', (plan) => events.push({ type: 'start', plan }));
      validator.on('validator:start', (name) => events.push({ type: 'validator:start', name }));
      validator.on('validator:complete', (name) => events.push({ type: 'validator:complete', name }));
      validator.on('validation:complete', (result) => events.push({ type: 'complete', result }));

      await validator.validate(validPlan);

      expect(events.some(e => e.type === 'start')).toBe(true);
      expect(events.some(e => e.type === 'complete')).toBe(true);
      expect(events.filter(e => e.type === 'validator:start').length).toBe(4);
      expect(events.filter(e => e.type === 'validator:complete').length).toBe(4);
    });

    test('should handle validation errors gracefully', async () => {
      // Create a validator with a failing validator
      const failingValidator = new EnhancedPlanValidator();
      const badValidator = {
        validate: () => { throw new Error('Validator failed'); }
      };
      failingValidator.validationPipeline.push(badValidator);

      const result = await failingValidator.validate(validPlan);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('validation_error');
    });
  });

  describe('Structural Validation', () => {
    test('should detect missing required fields', async () => {
      const invalidPlan = new Plan({
        // Missing name
        description: 'Some description',
        context: validPlan.context,
        steps: validPlan.steps
      });

      const result = await validator.validate(invalidPlan);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'missing_required_field')).toBe(true);
    });

    test('should detect invalid step structure', async () => {
      const planWithBadStep = new Plan({
        ...validPlan.toJSON(),
        steps: [
          ...validPlan.steps,
          {
            // Missing required fields
            id: 'bad-step',
            // Missing name, type, actions
          }
        ]
      });

      const result = await validator.validate(planWithBadStep);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'missing_required_field')).toBe(true);
    });

    test('should detect invalid action types', async () => {
      // Create a step with a raw action object (not using PlanAction constructor)
      const stepWithBadAction = new PlanStep({
        id: 'step-bad',
        name: 'Step with bad action',
        type: 'setup',
        actions: [{
          type: 'invalid-action-type',
          description: 'Bad action'
        }]
      });

      const planWithBadAction = new Plan({
        ...validPlan.toJSON(),
        steps: [...validPlan.steps, stepWithBadAction]
      });

      const result = await validator.validate(planWithBadAction);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_action_type')).toBe(true);
    });
  });

  describe('Dependency Validation', () => {
    test('should detect circular dependencies', async () => {
      const circularSteps = [
        new PlanStep({
          id: 'step-a',
          name: 'Step A',
          type: 'setup',
          dependencies: ['step-b'],
          actions: []
        }),
        new PlanStep({
          id: 'step-b',
          name: 'Step B',
          type: 'setup',
          dependencies: ['step-a'],
          actions: []
        })
      ];

      const planWithCircular = new Plan({
        ...validPlan.toJSON(),
        steps: circularSteps
      });

      const result = await validator.validate(planWithCircular);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'circular_dependency')).toBe(true);
    });

    test('should detect missing dependencies', async () => {
      const stepWithMissingDep = new PlanStep({
        id: 'step-missing',
        name: 'Step with missing dependency',
        type: 'implementation',
        dependencies: ['non-existent-step'],
        actions: []
      });

      const planWithMissingDep = new Plan({
        ...validPlan.toJSON(),
        steps: [...validPlan.steps, stepWithMissingDep]
      });

      const result = await validator.validate(planWithMissingDep);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_dependency')).toBe(true);
    });

    test('should suggest parallelization opportunities', async () => {
      const parallelSteps = [
        new PlanStep({
          id: 'setup-1',
          name: 'Setup 1',
          type: 'setup',
          dependencies: [],
          actions: [
            new PlanAction({
              type: 'create-directory',
              path: 'project'
            })
          ]
        }),
        new PlanStep({
          id: 'impl-a',
          name: 'Implementation A',
          type: 'implementation',
          dependencies: ['setup-1'],
          actions: [
            new PlanAction({
              type: 'create-file',
              path: 'project/module-a.js',
              content: 'module A'
            })
          ]
        }),
        new PlanStep({
          id: 'impl-b',
          name: 'Implementation B',
          type: 'implementation',
          dependencies: ['setup-1'],
          actions: [
            new PlanAction({
              type: 'create-file',
              path: 'project/module-b.js',
              content: 'module B'
            })
          ]
        })
      ];

      const planWithParallel = new Plan({
        ...validPlan.toJSON(),
        steps: parallelSteps
      });

      const result = await validator.validate(planWithParallel);
      
      expect(result.suggestions.some(s => s.type === 'parallelization_opportunity')).toBe(true);
    });
  });

  describe('Semantic Validation', () => {
    test('should detect illogical step sequences', async () => {
      const illogicalSteps = [
        new PlanStep({
          id: 'test-1',
          name: 'Run tests',
          type: 'testing',
          dependencies: [],
          actions: []
        }),
        new PlanStep({
          id: 'impl-1',
          name: 'Implement features',
          type: 'implementation',
          dependencies: ['test-1'],
          actions: []
        })
      ];

      const planWithIllogical = new Plan({
        ...validPlan.toJSON(),
        steps: illogicalSteps
      });

      const result = await validator.validate(planWithIllogical);
      
      expect(result.warnings.some(w => w.type === 'unusual_sequence')).toBe(true);
    });

    test('should detect conflicting actions', async () => {
      const conflictingSteps = [
        new PlanStep({
          id: 'create-1',
          name: 'Create file',
          type: 'setup',
          actions: [
            new PlanAction({
              type: 'create-file',
              path: 'test.js',
              content: 'content1'
            })
          ]
        }),
        new PlanStep({
          id: 'delete-1',
          name: 'Delete file',
          type: 'setup',
          dependencies: ['create-1'],
          actions: [
            new PlanAction({
              type: 'delete-file',
              path: 'test.js'
            })
          ]
        })
      ];

      const planWithConflicts = new Plan({
        ...validPlan.toJSON(),
        steps: conflictingSteps
      });

      const result = await validator.validate(planWithConflicts);
      
      expect(result.errors.some(e => e.type === 'conflicting_actions')).toBe(true);
    });

    test('should validate resource availability', async () => {
      const stepWithMissingResource = new PlanStep({
        id: 'update-1',
        name: 'Update non-existent file',
        type: 'implementation',
        actions: [
          new PlanAction({
            type: 'update-file',
            path: 'non-existent.js',
            updates: 'some updates'
          })
        ]
      });

      const planWithMissingResource = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithMissingResource]
      });

      const result = await validator.validate(planWithMissingResource);
      
      expect(result.errors.some(e => e.type === 'missing_resource')).toBe(true);
    });
  });

  describe('Completeness Validation', () => {
    test('should detect missing success criteria', async () => {
      const planWithoutCriteria = new Plan({
        ...validPlan.toJSON(),
        successCriteria: []
      });

      const result = await validator.validate(planWithoutCriteria);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'missing_success_criteria')).toBe(true);
    });

    test('should warn about missing test steps', async () => {
      const planWithoutTests = new Plan({
        ...validPlan.toJSON(),
        steps: validPlan.steps.filter(s => s.type !== 'testing')
      });

      const result = await validator.validate(planWithoutTests);
      
      expect(result.warnings.some(w => w.type === 'missing_tests')).toBe(true);
    });

    test('should calculate completeness score', async () => {
      const result = await validator.validate(validPlan);
      
      expect(result.details.CompletenessValidator).toBeDefined();
      expect(result.details.CompletenessValidator.completenessScore).toBeDefined();
      expect(result.details.CompletenessValidator.completenessScore).toBeGreaterThan(0);
    });

    test('should check for missing documentation', async () => {
      const result = await validator.validate(validPlan);
      
      // Should suggest documentation since we're creating code files
      expect(result.suggestions.some(s => s.type === 'missing_documentation')).toBe(true);
    });
  });

  describe('Domain-Specific Validation', () => {
    test('should register domain validators', () => {
      const mockValidator = {
        validate: jest.fn().mockResolvedValue({ errors: [], warnings: [] })
      };

      validator.registerDomainValidator('code', mockValidator);
      
      expect(validator.domainValidators.has('code')).toBe(true);
    });

    test('should apply domain-specific validation', async () => {
      const domainValidator = {
        validate: jest.fn().mockResolvedValue({
          errors: [],
          warnings: [{ type: 'domain_warning', message: 'Domain-specific warning' }]
        })
      };

      validator.registerDomainValidator('code', domainValidator);

      const planWithDomain = new Plan({
        ...validPlan.toJSON(),
        domain: 'code'
      });

      const result = await validator.validate(planWithDomain);
      
      expect(domainValidator.validate).toHaveBeenCalledWith(planWithDomain);
      expect(result.warnings.some(w => w.message === 'Domain-specific warning')).toBe(true);
    });

    test('should handle domain validator errors', () => {
      const invalidValidator = { notAValidateMethod: true };
      
      expect(() => {
        validator.registerDomainValidator('test', invalidValidator);
      }).toThrow('Validator must have a validate method');
    });
  });

  describe('Quality Scoring', () => {
    test('should calculate quality score based on issues', async () => {
      const result = await validator.validate(validPlan);
      
      expect(result.score).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test('should reduce score for errors', async () => {
      const planWithErrors = new Plan({
        name: 'Plan with errors',
        description: 'Test plan',
        steps: [] // No steps will cause errors
      });

      const result = await validator.validate(planWithErrors);
      
      expect(result.score).toBeLessThan(100);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should factor in completeness score', async () => {
      const completeResult = await validator.validate(validPlan);
      
      const incompletePlan = new Plan({
        ...validPlan.toJSON(),
        metadata: {}, // Missing metadata reduces completeness
        successCriteria: []
      });

      const incompleteResult = await validator.validate(incompletePlan);
      
      expect(completeResult.score).toBeGreaterThan(incompleteResult.score);
    });
  });

  describe('Execution Readiness', () => {
    test('should assess execution readiness', async () => {
      const result = await validator.validate(validPlan);
      
      expect(result.executionReadiness).toBeDefined();
      expect(result.executionReadiness.ready).toBeDefined();
      expect(result.executionReadiness.confidence).toBeDefined();
      expect(result.executionReadiness.blockers).toBeDefined();
      expect(result.executionReadiness.recommendations).toBeDefined();
    });

    test('should block execution for critical errors', async () => {
      const planWithCriticalError = new Plan({
        ...validPlan.toJSON(),
        steps: [
          new PlanStep({
            id: 'step-1',
            name: 'Step 1',
            type: 'setup',
            dependencies: ['non-existent'], // Critical error
            actions: []
          })
        ]
      });

      const result = await validator.validate(planWithCriticalError);
      
      expect(result.executionReadiness.ready).toBe(false);
      expect(result.executionReadiness.blockers.length).toBeGreaterThan(0);
    });

    test('should provide recommendations for improvements', async () => {
      const planWithWarnings = new Plan({
        ...validPlan.toJSON(),
        steps: validPlan.steps.filter(s => s.type !== 'testing')
      });

      const result = await validator.validate(planWithWarnings);
      
      expect(result.executionReadiness.recommendations.length).toBeGreaterThan(0);
      expect(result.executionReadiness.recommendations.some(r => r.includes('test coverage'))).toBe(true);
    });
  });

  describe('Validation Pipeline', () => {
    test('should add custom validators to pipeline', () => {
      const customValidator = {
        validate: jest.fn().mockResolvedValue({ errors: [], warnings: [] })
      };

      const initialLength = validator.validationPipeline.length;
      validator.addValidator(customValidator);
      
      expect(validator.validationPipeline.length).toBe(initialLength + 1);
      expect(validator.validationPipeline[validator.validationPipeline.length - 1]).toBe(customValidator);
    });

    test('should insert validator at specific position', () => {
      const customValidator = {
        validate: jest.fn().mockResolvedValue({ errors: [], warnings: [] })
      };

      validator.addValidator(customValidator, 1);
      
      expect(validator.validationPipeline[1]).toBe(customValidator);
    });

    test('should handle invalid validator addition', () => {
      const invalidValidator = { notAValidateMethod: true };
      
      expect(() => {
        validator.addValidator(invalidValidator);
      }).toThrow('Validator must have a validate method');
    });
  });

  describe('Report Generation', () => {
    test('should generate validation report', async () => {
      const result = await validator.validate(validPlan);
      const report = validator.generateReport(result);
      
      expect(report).toContain('# Plan Validation Report');
      expect(report).toContain(`**Overall Score:** ${result.score}/100`);
      expect(report).toContain('**Status:** ✅ Valid');
      expect(report).toContain('## Summary');
    });

    test('should include errors in report', async () => {
      const invalidPlan = new Plan({
        name: 'Invalid Plan',
        steps: []
      });

      const result = await validator.validate(invalidPlan);
      const report = validator.generateReport(result);
      
      expect(report).toContain('## Errors');
      expect(report).toContain('**Status:** ❌ Invalid');
    });

    test('should include execution readiness in report', async () => {
      const result = await validator.validate(validPlan);
      const report = validator.generateReport(result);
      
      expect(report).toContain('## Execution Readiness');
      expect(report).toContain(`**Confidence:** ${result.executionReadiness.confidence}%`);
    });
  });

  describe('Quick Validation', () => {
    test('should perform quick validation', () => {
      const quickResult = validator.quickValidate(validPlan);
      expect(quickResult).toBe(true);
    });

    test('should fail quick validation for invalid plans', () => {
      const invalidPlans = [
        null,
        {},
        { name: 'No steps' },
        { name: 'Empty steps', steps: [] },
        { name: 'No ID', steps: [{ name: 'Step' }] }
      ];

      for (const plan of invalidPlans) {
        expect(validator.quickValidate(plan)).toBe(false);
      }
    });

    test('should detect duplicate step IDs in quick validation', () => {
      const planWithDuplicates = {
        id: 'plan-1',
        name: 'Plan with duplicates',
        steps: [
          { id: 'step-1', name: 'Step 1' },
          { id: 'step-1', name: 'Step 2' }
        ]
      };

      expect(validator.quickValidate(planWithDuplicates)).toBe(false);
    });
  });

  describe('ValidateOrThrow', () => {
    test('should pass validation for valid plan', async () => {
      await expect(validator.validateOrThrow(validPlan)).resolves.toBeDefined();
    });

    test('should throw for invalid plan', async () => {
      const invalidPlan = new Plan({
        name: 'Invalid',
        steps: []
      });

      await expect(validator.validateOrThrow(invalidPlan)).rejects.toThrow('Plan validation failed');
    });
  });
});