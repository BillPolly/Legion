/**
 * Tests for CompletenessValidator
 * 
 * The CompletenessValidator validates that plans are complete and ready for execution,
 * ensuring all necessary information is present and goals are achievable.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { CompletenessValidator } from '../../src/validators/CompletenessValidator.js';
import { Plan } from '../../src/models/Plan.js';
import { PlanStep } from '../../src/models/PlanStep.js';
import { PlanAction } from '../../src/models/PlanAction.js';
import { PlanContext } from '../../src/models/PlanContext.js';

describe('CompletenessValidator', () => {
  let validator;
  let validPlan;

  beforeEach(() => {
    validator = new CompletenessValidator({
      requireSuccessCriteria: true,
      requireEstimates: true,
      requireRollback: false,
      minStepDetail: 'medium'
    });

    // Create a comprehensive valid plan
    const context = new PlanContext({
      task: 'Create a todo app',
      projectType: 'frontend',
      technologies: ['html', 'css', 'javascript'],
      requirements: 'Create a simple todo application with authentication and CRUD operations',
      goals: ['user interface', 'authentication', 'crud operations']
    });

    const steps = [
      new PlanStep({
        id: 'setup-1',
        name: 'Initialize project structure',
        type: 'setup',
        description: 'Set up the basic project structure and configuration files',
        rationale: 'A proper project structure is essential for maintainability',
        dependencies: [],
        inputs: {
          projectName: 'todo-app',
          framework: 'vanilla-js'
        },
        outputs: {
          directories: ['todo-app', 'todo-app/src', 'todo-app/css'],
          files: ['todo-app/index.html', 'todo-app/package.json']
        },
        actions: [
          new PlanAction({
            type: 'create-directory',
            path: 'todo-app',
            description: 'Create main project directory'
          }),
          new PlanAction({
            type: 'create-file',
            path: 'todo-app/index.html',
            content: '<!DOCTYPE html><html>...</html>',
            description: 'Create main HTML file'
          })
        ],
        validation: {
          criteria: [
            'Directory structure exists',
            'HTML file is valid',
            'Package.json is properly formatted'
          ]
        },
        estimatedDuration: '30 minutes',
        rollback: {
          actions: [
            {
              type: 'delete-directory',
              path: 'todo-app'
            }
          ]
        }
      }),
      new PlanStep({
        id: 'impl-1',
        name: 'Implement authentication system',
        type: 'implementation',
        description: 'Create user authentication with login and registration',
        rationale: 'Authentication is required for user-specific todo lists',
        dependencies: ['setup-1'],
        inputs: {
          authMethod: 'local-storage',
          validationRules: 'email-password'
        },
        outputs: {
          files: ['todo-app/src/auth.js'],
          features: ['login', 'registration', 'logout']
        },
        actions: [
          new PlanAction({
            type: 'create-file',
            path: 'todo-app/src/auth.js',
            content: 'class AuthSystem { login() {} register() {} }',
            description: 'Create authentication module'
          })
        ],
        validation: {
          criteria: [
            'Login functionality works',
            'Registration creates new users',
            'Logout clears session'
          ]
        },
        estimatedDuration: '2 hours'
      }),
      new PlanStep({
        id: 'impl-2',
        name: 'Implement CRUD operations',
        type: 'implementation',
        description: 'Create todo item management functionality',
        rationale: 'Core functionality for managing todo items',
        dependencies: ['impl-1'],
        inputs: {
          storageMethod: 'local-storage',
          todoStructure: 'id-title-completed-date'
        },
        outputs: {
          files: ['todo-app/src/todos.js'],
          features: ['create todo', 'read todos', 'update todo', 'delete todo']
        },
        actions: [
          new PlanAction({
            type: 'create-file',
            path: 'todo-app/src/todos.js',
            content: 'class TodoManager { create() {} read() {} update() {} delete() {} }',
            description: 'Create todo management module'
          })
        ],
        validation: {
          criteria: [
            'Can create new todos',
            'Can list all todos',
            'Can mark todos as complete',
            'Can delete todos'
          ]
        },
        estimatedDuration: '3 hours'
      }),
      new PlanStep({
        id: 'test-1',
        name: 'Create comprehensive test suite',
        type: 'testing',
        description: 'Add unit and integration tests for all functionality',
        rationale: 'Tests ensure reliability and prevent regressions',
        dependencies: ['impl-2'],
        inputs: {
          testFramework: 'jest',
          coverageTarget: '90%'
        },
        outputs: {
          files: ['todo-app/tests/auth.test.js', 'todo-app/tests/todos.test.js'],
          coverage: '90%'
        },
        actions: [
          new PlanAction({
            type: 'create-file',
            path: 'todo-app/tests/auth.test.js',
            content: 'describe("Authentication", () => { test("login works", () => {}); });',
            description: 'Create authentication tests'
          }),
          new PlanAction({
            type: 'create-file',
            path: 'todo-app/tests/todos.test.js',
            content: 'describe("Todo CRUD", () => { test("creates todo", () => {}); });',
            description: 'Create todo functionality tests'
          })
        ],
        validation: {
          criteria: [
            'All tests pass',
            'Code coverage above 90%',
            'No test failures'
          ]
        },
        estimatedDuration: '2 hours'
      })
    ];

    validPlan = new Plan({
      name: 'Comprehensive Todo Application Plan',
      description: 'A detailed plan for creating a full-featured todo application with authentication and CRUD operations',
      version: '1.0.0',
      context,
      steps,
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: 'CodePlanner',
        complexity: 'medium',
        estimatedDuration: '7.5 hours',
        tags: ['frontend', 'javascript', 'authentication', 'crud']
      },
      successCriteria: [
        'All authentication features work correctly',
        'All CRUD operations function properly',
        'All tests pass with 90% coverage',
        'Application is responsive and user-friendly',
        'Code follows best practices and is well-documented'
      ]
    });
  });

  describe('Constructor and Configuration', () => {
    test('should create validator with default configuration', () => {
      const defaultValidator = new CompletenessValidator();
      expect(defaultValidator).toBeDefined();
      expect(defaultValidator.config.requireSuccessCriteria).toBe(true);
      expect(defaultValidator.config.requireEstimates).toBe(true);
      expect(defaultValidator.config.requireRollback).toBe(false);
      expect(defaultValidator.config.minStepDetail).toBe('medium');
    });

    test('should create validator with custom configuration', () => {
      const customValidator = new CompletenessValidator({
        requireSuccessCriteria: false,
        requireEstimates: false,
        requireRollback: true,
        minStepDetail: 'high'
      });
      expect(customValidator.config.requireSuccessCriteria).toBe(false);
      expect(customValidator.config.requireEstimates).toBe(false);
      expect(customValidator.config.requireRollback).toBe(true);
      expect(customValidator.config.minStepDetail).toBe('high');
    });
  });

  describe('Basic Completeness Validation', () => {
    test('should validate a complete plan successfully', async () => {
      const result = await validator.validate(validPlan);
      
      expect(result.errors).toHaveLength(0);
      expect(result.completenessScore).toBeGreaterThan(80);
      expect(result.warnings.length).toBeLessThanOrEqual(2); // May have minor warnings
    });

    test('should handle plans with no steps', async () => {
      const planWithoutSteps = new Plan({
        name: 'Empty Plan',
        description: 'Plan with no steps',
        steps: []
      });

      const result = await validator.validate(planWithoutSteps);
      
      expect(result.errors.some(e => e.type === 'no_steps')).toBe(true);
    });

    test('should handle plans with null steps', async () => {
      const planWithNullSteps = new Plan({
        name: 'Plan with null steps',
        description: 'Test plan'
      });

      const result = await validator.validate(planWithNullSteps);
      
      expect(result.errors.some(e => e.type === 'no_steps')).toBe(true);
    });
  });

  describe('Plan-Level Completeness', () => {
    test('should warn about missing description', async () => {
      const planWithoutDescription = new Plan({
        ...validPlan.toJSON(),
        description: 'Short' // Too short
      });

      const result = await validator.validate(planWithoutDescription);
      
      expect(result.warnings.some(w => 
        w.type === 'missing_description' && w.field === 'plan.description'
      )).toBe(true);
    });

    test('should error on missing context', async () => {
      const planWithoutContext = new Plan({
        ...validPlan.toJSON()
      });
      delete planWithoutContext.context;

      const result = await validator.validate(planWithoutContext);
      
      expect(result.errors.some(e => e.type === 'missing_context')).toBe(true);
    });

    test('should warn about incomplete context', async () => {
      const incompleteContext = new PlanContext({
        task: 'Create app'
        // Missing projectType, technologies, requirements
      });

      const planWithIncompleteContext = new Plan({
        ...validPlan.toJSON(),
        context: incompleteContext
      });

      const result = await validator.validate(planWithIncompleteContext);
      
      expect(result.warnings.some(w => 
        w.type === 'incomplete_context' && w.field === 'context.projectType'
      )).toBe(true);
      expect(result.warnings.some(w => 
        w.type === 'incomplete_context' && w.field === 'context.technologies'
      )).toBe(true);
      expect(result.warnings.some(w => 
        w.type === 'incomplete_context' && w.field === 'context.requirements'
      )).toBe(true);
    });

    test('should warn about missing metadata', async () => {
      const planWithoutMetadata = new Plan({
        ...validPlan.toJSON()
      });
      delete planWithoutMetadata.metadata;

      const result = await validator.validate(planWithoutMetadata);
      
      expect(result.warnings.some(w => w.type === 'missing_metadata')).toBe(true);
    });
  });

  describe('Step Completeness Validation', () => {
    test('should warn about missing step descriptions', async () => {
      const stepWithoutDescription = new PlanStep({
        id: 'step-1',
        name: 'Step without description',
        type: 'setup',
        description: 'Short', // Too short
        actions: []
      });

      const planWithBadStep = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithoutDescription]
      });

      const result = await validator.validate(planWithBadStep);
      
      expect(result.warnings.some(w => 
        w.type === 'missing_step_description' && w.stepId === 'step-1'
      )).toBe(true);
    });

    test('should suggest rationale for medium detail level', async () => {
      const stepWithoutRationale = new PlanStep({
        id: 'step-1',
        name: 'Step without rationale',
        type: 'setup',
        description: 'A step that lacks rationale explanation',
        actions: []
        // Missing rationale
      });

      const planWithoutRationale = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithoutRationale]
      });

      const result = await validator.validate(planWithoutRationale);
      
      expect(result.suggestions.some(s => 
        s.type === 'missing_rationale' && s.stepId === 'step-1'
      )).toBe(true);
    });

    test('should warn about missing inputs/outputs for high detail level', async () => {
      const highDetailValidator = new CompletenessValidator({
        minStepDetail: 'high'
      });

      const stepWithoutInputsOutputs = new PlanStep({
        id: 'step-1',
        name: 'Step without inputs/outputs',
        type: 'implementation',
        description: 'A step that lacks inputs and outputs',
        actions: []
        // Missing inputs and outputs
      });

      const planWithoutInputsOutputs = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithoutInputsOutputs]
      });

      const result = await highDetailValidator.validate(planWithoutInputsOutputs);
      
      expect(result.warnings.some(w => 
        w.type === 'missing_inputs' && w.stepId === 'step-1'
      )).toBe(true);
      expect(result.warnings.some(w => 
        w.type === 'missing_outputs' && w.stepId === 'step-1'
      )).toBe(true);
    });

    test('should error on steps without actions', async () => {
      const stepWithoutActions = new PlanStep({
        id: 'step-1',
        name: 'Step without actions',
        type: 'setup',
        description: 'A step that has no actions',
        actions: []
      });

      const planWithoutActions = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithoutActions]
      });

      const result = await validator.validate(planWithoutActions);
      
      expect(result.errors.some(e => 
        e.type === 'no_actions' && e.stepId === 'step-1'
      )).toBe(true);
    });

    test('should suggest validation criteria for implementation steps', async () => {
      const stepWithoutValidation = new PlanStep({
        id: 'impl-1',
        name: 'Implementation step',
        type: 'implementation',
        description: 'Implementation without validation criteria',
        actions: [
          new PlanAction({
            type: 'create-file',
            path: 'app.js',
            content: 'code'
          })
        ]
        // Missing validation criteria
      });

      const planWithoutValidation = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithoutValidation]
      });

      const result = await validator.validate(planWithoutValidation);
      
      expect(result.suggestions.some(s => 
        s.type === 'missing_validation_criteria' && s.stepId === 'impl-1'
      )).toBe(true);
    });
  });

  describe('Action Completeness Validation', () => {
    test('should warn about missing action descriptions', async () => {
      const stepWithBadAction = new PlanStep({
        id: 'step-1',
        name: 'Step with incomplete action',
        type: 'setup',
        description: 'Step with action missing description',
        actions: [
          new PlanAction({
            type: 'create-file',
            path: 'file.js',
            content: 'content'
            // Missing description
          })
        ]
      });

      const planWithBadAction = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithBadAction]
      });

      const result = await validator.validate(planWithBadAction);
      
      expect(result.warnings.some(w => 
        w.type === 'missing_action_description' && 
        w.stepId === 'step-1' && 
        w.actionType === 'create-file'
      )).toBe(true);
    });

    test('should error on create-file without content', async () => {
      const stepWithIncompleteAction = new PlanStep({
        id: 'step-1',
        name: 'Step with incomplete create-file',
        type: 'setup',
        description: 'Step with incomplete action',
        actions: [
          {
            type: 'create-file',
            path: 'file.js'
            // Missing content
          }
        ]
      });

      const planWithIncompleteAction = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithIncompleteAction]
      });

      const result = await validator.validate(planWithIncompleteAction);
      
      expect(result.errors.some(e => 
        e.type === 'incomplete_action' && 
        e.stepId === 'step-1' && 
        e.actionType === 'create-file'
      )).toBe(true);
    });

    test('should warn about missing working directory for run-command', async () => {
      const highDetailValidator = new CompletenessValidator({
        minStepDetail: 'high'
      });

      const stepWithIncompleteCommand = new PlanStep({
        id: 'step-1',
        name: 'Step with incomplete command',
        type: 'testing',
        description: 'Step with command missing working directory',
        actions: [
          new PlanAction({
            type: 'run-command',
            command: 'npm test'
            // Missing workingDirectory
          })
        ]
      });

      const planWithIncompleteCommand = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithIncompleteCommand]
      });

      const result = await highDetailValidator.validate(planWithIncompleteCommand);
      
      expect(result.warnings.some(w => 
        w.type === 'missing_working_directory' && w.stepId === 'step-1'
      )).toBe(true);
    });

    test('should suggest expected output for commands', async () => {
      const stepWithCommandNoOutput = new PlanStep({
        id: 'step-1',
        name: 'Step with command without expected output',
        type: 'testing',
        description: 'Step with command missing expected output',
        actions: [
          new PlanAction({
            type: 'run-command',
            command: 'npm test',
            workingDirectory: 'project'
            // Missing expectedOutput
          })
        ]
      });

      const planWithCommandNoOutput = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithCommandNoOutput]
      });

      const result = await validator.validate(planWithCommandNoOutput);
      
      expect(result.suggestions.some(s => 
        s.type === 'missing_expected_output' && s.stepId === 'step-1'
      )).toBe(true);
    });

    test('should error on update-file without updates', async () => {
      const stepWithIncompleteUpdate = new PlanStep({
        id: 'step-1',
        name: 'Step with incomplete update-file',
        type: 'implementation',
        description: 'Step with incomplete update action',
        actions: [
          {
            type: 'update-file',
            path: 'file.js'
            // Missing updates or patch
          }
        ]
      });

      const planWithIncompleteUpdate = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithIncompleteUpdate]
      });

      const result = await validator.validate(planWithIncompleteUpdate);
      
      expect(result.errors.some(e => 
        e.type === 'incomplete_action' && 
        e.stepId === 'step-1' && 
        e.actionType === 'update-file'
      )).toBe(true);
    });
  });

  describe('Requirements Coverage Validation', () => {
    test('should warn about uncovered requirements', async () => {
      const contextWithUncoveredReq = new PlanContext({
        ...validPlan.context.toJSON(),
        requirements: 'Create a todo app with authentication, CRUD operations, and real-time sync'
        // 'real-time sync' is not implemented in the plan
      });

      const planWithUncoveredReq = new Plan({
        ...validPlan.toJSON(),
        context: contextWithUncoveredReq
      });

      const result = await validator.validate(planWithUncoveredReq);
      
      // Should detect that 'sync' feature is not covered
      expect(result.warnings.some(w => w.type === 'uncovered_requirement')).toBe(true);
    });

    test('should warn about low requirement coverage', async () => {
      const contextWithManyReqs = new PlanContext({
        ...validPlan.context.toJSON(),
        requirements: 'Create a todo app with authentication, CRUD operations, real-time sync, offline support, push notifications, analytics, and reporting'
        // Many requirements that are not covered
      });

      const planWithManyReqs = new Plan({
        ...validPlan.toJSON(),
        context: contextWithManyReqs
      });

      const result = await validator.validate(planWithManyReqs);
      
      expect(result.warnings.some(w => w.type === 'low_requirement_coverage')).toBe(true);
    });

    test('should handle plans without requirements', async () => {
      const contextWithoutReqs = new PlanContext({
        task: 'Create a todo app',
        projectType: 'frontend'
        // No requirements
      });

      const planWithoutReqs = new Plan({
        ...validPlan.toJSON(),
        context: contextWithoutReqs
      });

      const result = await validator.validate(planWithoutReqs);
      
      // Should not error or warn about coverage
      expect(result.warnings.some(w => w.type === 'uncovered_requirement')).toBe(false);
    });

    test('should handle array-format requirements', async () => {
      const contextWithArrayReqs = new PlanContext({
        ...validPlan.context.toJSON(),
        requirements: ['authentication', 'crud operations', 'testing']
      });

      const planWithArrayReqs = new Plan({
        ...validPlan.toJSON(),
        context: contextWithArrayReqs
      });

      const result = await validator.validate(planWithArrayReqs);
      
      // Should validate coverage for array format
      expect(result).toBeDefined();
    });

    test('should handle object-format requirements', async () => {
      const contextWithObjectReqs = new PlanContext({
        ...validPlan.context.toJSON(),
        requirements: {
          features: ['authentication', 'crud operations', 'testing'],
          constraints: ['responsive', 'accessible']
        }
      });

      const planWithObjectReqs = new Plan({
        ...validPlan.toJSON(),
        context: contextWithObjectReqs
      });

      const result = await validator.validate(planWithObjectReqs);
      
      // Should validate coverage for object format
      expect(result).toBeDefined();
    });
  });

  describe('Success Criteria Validation', () => {
    test('should error on missing success criteria', async () => {
      const planWithoutCriteria = new Plan({
        ...validPlan.toJSON(),
        successCriteria: []
      });

      const result = await validator.validate(planWithoutCriteria);
      
      expect(result.errors.some(e => e.type === 'missing_success_criteria')).toBe(true);
    });

    test('should warn about vague success criteria', async () => {
      const planWithVagueCriteria = new Plan({
        ...validPlan.toJSON(),
        successCriteria: ['It works', 'Good'] // Too vague
      });

      const result = await validator.validate(planWithVagueCriteria);
      
      expect(result.warnings.some(w => 
        w.type === 'vague_success_criterion' && w.criterion === 'It works'
      )).toBe(true);
      expect(result.warnings.some(w => 
        w.type === 'vague_success_criterion' && w.criterion === 'Good'
      )).toBe(true);
    });

    test('should suggest measurable criteria', async () => {
      const planWithUnmeasurableCriteria = new Plan({
        ...validPlan.toJSON(),
        successCriteria: ['Application looks nice', 'Users will like it']
      });

      const result = await validator.validate(planWithUnmeasurableCriteria);
      
      expect(result.suggestions.some(s => 
        s.type === 'unmeasurable_criterion' && s.criterion === 'Application looks nice'
      )).toBe(true);
      expect(result.suggestions.some(s => 
        s.type === 'unmeasurable_criterion' && s.criterion === 'Users will like it'
      )).toBe(true);
    });

    test('should warn about missing test criteria when tests exist', async () => {
      const planWithoutTestCriteria = new Plan({
        ...validPlan.toJSON(),
        successCriteria: ['Authentication works', 'CRUD operations function']
        // Missing test-related criteria despite having test steps
      });

      const result = await validator.validate(planWithoutTestCriteria);
      
      expect(result.warnings.some(w => w.type === 'missing_test_criteria')).toBe(true);
    });

    test('should not require success criteria when disabled', async () => {
      const noSuccessValidator = new CompletenessValidator({
        requireSuccessCriteria: false
      });

      const planWithoutCriteria = new Plan({
        ...validPlan.toJSON(),
        successCriteria: []
      });

      const result = await noSuccessValidator.validate(planWithoutCriteria);
      
      expect(result.errors.some(e => e.type === 'missing_success_criteria')).toBe(false);
    });
  });

  describe('Estimates Validation', () => {
    test('should warn about missing duration estimate', async () => {
      const planWithoutEstimate = new Plan({
        ...validPlan.toJSON(),
        metadata: {
          ...validPlan.metadata,
          estimatedDuration: undefined
        }
      });

      const result = await validator.validate(planWithoutEstimate);
      
      expect(result.warnings.some(w => w.type === 'missing_duration_estimate')).toBe(true);
    });

    test('should suggest step-level estimates for high detail', async () => {
      const highDetailValidator = new CompletenessValidator({
        minStepDetail: 'high'
      });

      const stepWithoutEstimate = new PlanStep({
        ...validPlan.steps[0].toJSON(),
        estimatedDuration: undefined
      });

      const planWithoutStepEstimate = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithoutEstimate, ...validPlan.steps.slice(1)]
      });

      const result = await highDetailValidator.validate(planWithoutStepEstimate);
      
      expect(result.suggestions.some(s => 
        s.type === 'missing_step_estimate' && s.stepId === stepWithoutEstimate.id
      )).toBe(true);
    });

    test('should suggest complexity rating', async () => {
      const planWithoutComplexity = new Plan({
        ...validPlan.toJSON(),
        metadata: {
          ...validPlan.metadata,
          complexity: undefined
        }
      });

      const result = await validator.validate(planWithoutComplexity);
      
      expect(result.suggestions.some(s => s.type === 'missing_complexity_rating')).toBe(true);
    });

    test('should not require estimates when disabled', async () => {
      const noEstimatesValidator = new CompletenessValidator({
        requireEstimates: false
      });

      const planWithoutEstimate = new Plan({
        ...validPlan.toJSON(),
        metadata: {
          ...validPlan.metadata,
          estimatedDuration: undefined
        }
      });

      const result = await noEstimatesValidator.validate(planWithoutEstimate);
      
      expect(result.warnings.some(w => w.type === 'missing_duration_estimate')).toBe(false);
    });
  });

  describe('Rollback Provisions Validation', () => {
    test('should error on missing rollback when required', async () => {
      const rollbackValidator = new CompletenessValidator({
        requireRollback: true
      });

      const stepWithoutRollback = new PlanStep({
        ...validPlan.steps[0].toJSON(),
        rollback: undefined
      });

      const planWithoutRollback = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithoutRollback, ...validPlan.steps.slice(1)]
      });

      const result = await rollbackValidator.validate(planWithoutRollback);
      
      expect(result.errors.some(e => e.type === 'no_rollback_provisions')).toBe(true);
    });

    test('should warn about incomplete rollback', async () => {
      const rollbackValidator = new CompletenessValidator({
        requireRollback: true
      });

      const stepWithIncompleteRollback = new PlanStep({
        ...validPlan.steps[0].toJSON(),
        rollback: {
          actions: [
            // Missing delete actions for created resources
            {
              type: 'log-message',
              message: 'Rolling back'
            }
          ]
        }
      });

      const planWithIncompleteRollback = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithIncompleteRollback, ...validPlan.steps.slice(1)]
      });

      const result = await rollbackValidator.validate(planWithIncompleteRollback);
      
      expect(result.warnings.some(w => 
        w.type === 'incomplete_rollback' && w.stepId === stepWithIncompleteRollback.id
      )).toBe(true);
    });

    test('should warn about missing rollback for critical steps', async () => {
      const rollbackValidator = new CompletenessValidator({
        requireRollback: true
      });

      const deploymentStepWithoutRollback = new PlanStep({
        id: 'deploy-1',
        name: 'Deploy application',
        type: 'deployment',
        description: 'Deploy to production',
        actions: [
          new PlanAction({
            type: 'run-command',
            command: 'npm run deploy'
          })
        ]
        // Missing rollback for deployment step
      });

      const planWithDeploymentNoRollback = new Plan({
        ...validPlan.toJSON(),
        steps: [deploymentStepWithoutRollback]
      });

      const result = await rollbackValidator.validate(planWithDeploymentNoRollback);
      
      expect(result.warnings.some(w => 
        w.type === 'missing_rollback' && w.stepId === 'deploy-1'
      )).toBe(true);
    });

    test('should not require rollback when disabled', async () => {
      const noRollbackValidator = new CompletenessValidator({
        requireRollback: false
      });

      const stepWithoutRollback = new PlanStep({
        ...validPlan.steps[0].toJSON(),
        rollback: undefined
      });

      const planWithoutRollback = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithoutRollback]
      });

      const result = await noRollbackValidator.validate(planWithoutRollback);
      
      expect(result.errors.some(e => e.type === 'no_rollback_provisions')).toBe(false);
    });
  });

  describe('Completeness Score Calculation', () => {
    test('should calculate high score for complete plans', async () => {
      const result = await validator.validate(validPlan);
      
      expect(result.completenessScore).toBeGreaterThan(90);
    });

    test('should reduce score for missing elements', async () => {
      const incompleteContext = new PlanContext({
        task: 'Create app'
        // Missing many fields
      });

      const incompletePlan = new Plan({
        name: 'Incomplete Plan',
        description: 'Short',
        context: incompleteContext,
        steps: [
          new PlanStep({
            id: 'step-1',
            name: 'Basic step',
            type: 'setup',
            description: 'Basic description',
            actions: [
              new PlanAction({
                type: 'create-directory',
                path: 'dir'
              })
            ]
          })
        ],
        successCriteria: ['Works']
      });

      const result = await validator.validate(incompletePlan);
      
      expect(result.completenessScore).toBeLessThan(80);
    });

    test('should give bonus points for comprehensive features', async () => {
      const comprehensivePlan = new Plan({
        ...validPlan.toJSON(),
        successCriteria: [
          'Feature 1 works correctly',
          'Feature 2 functions properly',
          'All tests pass with 95% coverage',
          'Performance meets requirements',
          'Security standards are met'
        ]
      });

      const result = await validator.validate(comprehensivePlan);
      
      expect(result.completenessScore).toBeGreaterThan(85);
    });

    test('should warn about low completeness score', async () => {
      const lowScorePlan = new Plan({
        name: 'Low Score Plan',
        description: 'Bad',
        steps: [
          new PlanStep({
            id: 'step-1',
            name: 'Bad step',
            type: 'setup',
            description: 'Bad',
            actions: []
          })
        ]
      });

      const result = await validator.validate(lowScorePlan);
      
      expect(result.warnings.some(w => 
        w.type === 'low_completeness_score' && w.score < 70
      )).toBe(true);
    });
  });

  describe('Helper Methods', () => {
    test('should calculate average step detail correctly', () => {
      const avgDetail = validator._calculateAverageStepDetail(validPlan);
      
      expect(avgDetail).toBeGreaterThan(0.5);
      expect(avgDetail).toBeLessThanOrEqual(1.0);
    });

    test('should handle plans with no steps in detail calculation', () => {
      const emptyPlan = new Plan({
        name: 'Empty',
        steps: []
      });

      const avgDetail = validator._calculateAverageStepDetail(emptyPlan);
      
      expect(avgDetail).toBe(0);
    });

    test('should extract features from string requirements', () => {
      const features = validator._extractFeaturesFromRequirements(
        'Create an app with authentication, database, and testing'
      );
      
      expect(features).toContain('authentication');
      expect(features).toContain('database');
      expect(features).toContain('testing');
    });

    test('should extract features from array requirements', () => {
      const features = validator._extractFeaturesFromRequirements([
        'user management',
        'api integration',
        'frontend design'
      ]);
      
      expect(features).toEqual(['user management', 'api integration', 'frontend design']);
    });

    test('should extract features from object requirements', () => {
      const features = validator._extractFeaturesFromRequirements({
        features: ['authentication', 'crud', 'testing'],
        constraints: ['responsive', 'accessible']
      });
      
      expect(features).toEqual(['authentication', 'crud', 'testing']);
    });

    test('should extract implemented features from plan', () => {
      const implemented = validator._extractImplementedFeatures(validPlan);
      
      expect(implemented.has('authentication')).toBe(true);
      expect(implemented.has('crud')).toBe(true);
      expect(implemented.has('testing')).toBe(true);
    });

    test('should detect features from step names and descriptions', () => {
      const planWithFeatureNames = new Plan({
        ...validPlan.toJSON(),
        steps: [
          new PlanStep({
            id: 'api-1',
            name: 'Create API endpoints',
            type: 'implementation',
            description: 'Build REST API for data access',
            actions: []
          }),
          new PlanStep({
            id: 'ui-1',
            name: 'Design user interface',
            type: 'implementation',
            description: 'Create responsive frontend components',
            actions: []
          })
        ]
      });

      const implemented = validator._extractImplementedFeatures(planWithFeatureNames);
      
      expect(implemented.has('api')).toBe(true);
      expect(implemented.has('frontend')).toBe(true);
    });

    test('should detect features from action paths', () => {
      const planWithFeaturePaths = new Plan({
        ...validPlan.toJSON(),
        steps: [
          new PlanStep({
            id: 'step-1',
            name: 'Create files',
            type: 'implementation',
            description: 'Create application files',
            actions: [
              new PlanAction({
                type: 'create-file',
                path: 'src/auth/login.js',
                content: 'auth code'
              }),
              new PlanAction({
                type: 'create-file',
                path: 'tests/api.test.js',
                content: 'test code'
              })
            ]
          })
        ]
      });

      const implemented = validator._extractImplementedFeatures(planWithFeaturePaths);
      
      expect(implemented.has('authentication')).toBe(true);
      expect(implemented.has('testing')).toBe(true);
      expect(implemented.has('api')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle plans with null context', async () => {
      const planWithNullContext = new Plan({
        ...validPlan.toJSON(),
        context: null
      });

      const result = await validator.validate(planWithNullContext);
      
      expect(result.errors.some(e => e.type === 'missing_context')).toBe(true);
    });

    test('should handle steps with null actions', async () => {
      const stepWithNullActions = new PlanStep({
        id: 'step-1',
        name: 'Step with null actions',
        type: 'setup',
        description: 'Step description',
        actions: null
      });

      const planWithNullActions = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithNullActions]
      });

      const result = await validator.validate(planWithNullActions);
      
      expect(result.errors.some(e => 
        e.type === 'no_actions' && e.stepId === 'step-1'
      )).toBe(true);
    });

    test('should handle empty success criteria array', async () => {
      const planWithEmptyCriteria = new Plan({
        ...validPlan.toJSON(),
        successCriteria: []
      });

      const result = await validator.validate(planWithEmptyCriteria);
      
      expect(result.errors.some(e => e.type === 'missing_success_criteria')).toBe(true);
    });

    test('should handle malformed metadata', async () => {
      const planWithBadMetadata = new Plan({
        ...validPlan.toJSON(),
        metadata: 'not an object'
      });

      const result = await validator.validate(planWithBadMetadata);
      
      // Should handle gracefully
      expect(result).toBeDefined();
    });

    test('should handle steps with undefined properties', async () => {
      const stepWithUndefinedProps = new PlanStep({
        id: 'step-1',
        name: 'Step with undefined properties',
        type: 'setup',
        description: undefined,
        actions: [
          new PlanAction({
            type: 'create-directory',
            path: 'dir'
          })
        ]
      });

      const planWithUndefinedProps = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithUndefinedProps]
      });

      const result = await validator.validate(planWithUndefinedProps);
      
      expect(result.warnings.some(w => 
        w.type === 'missing_step_description' && w.stepId === 'step-1'
      )).toBe(true);
    });
  });

  describe('Configuration Variations', () => {
    test('should work with low detail level', async () => {
      const lowDetailValidator = new CompletenessValidator({
        minStepDetail: 'low'
      });

      const basicPlan = new Plan({
        name: 'Basic Plan',
        description: 'A basic plan for testing',
        steps: [
          new PlanStep({
            id: 'step-1',
            name: 'Basic step',
            type: 'setup',
            description: 'Basic step description',
            actions: [
              new PlanAction({
                type: 'create-directory',
                path: 'project'
              })
            ]
          })
        ],
        successCriteria: ['Project is created successfully']
      });

      const result = await lowDetailValidator.validate(basicPlan);
      
      // Should not suggest rationale for low detail level
      expect(result.suggestions.some(s => s.type === 'missing_rationale')).toBe(false);
    });

    test('should work with all requirements disabled', async () => {
      const lenientValidator = new CompletenessValidator({
        requireSuccessCriteria: false,
        requireEstimates: false,
        requireRollback: false,
        minStepDetail: 'low'
      });

      const minimalPlan = new Plan({
        name: 'Minimal Plan',
        description: 'Minimal plan for testing',
        steps: [
          new PlanStep({
            id: 'step-1',
            name: 'Minimal step',
            type: 'setup',
            description: 'Minimal step description',
            actions: [
              new PlanAction({
                type: 'create-directory',
                path: 'project'
              })
            ]
          })
        ]
      });

      const result = await lenientValidator.validate(minimalPlan);
      
      expect(result.errors).toHaveLength(0);
      expect(result.completenessScore).toBeGreaterThan(50);
    });
  });

  describe('Performance', () => {
    test('should handle large plans efficiently', async () => {
      // Create a large plan with many steps
      const largeSteps = [];
      
      for (let i = 0; i < 50; i++) {
        largeSteps.push(new PlanStep({
          id: `step-${i}`,
          name: `Step ${i}`,
          type: 'implementation',
          description: `Description for step ${i}`,
          actions: [
            new PlanAction({
              type: 'create-file',
              path: `file-${i}.js`,
              content: `const module${i} = {};`,
              description: `Create file ${i}`
            })
          ]
        }));
      }

      const largePlan = new Plan({
        ...validPlan.toJSON(),
        steps: largeSteps
      });

      const startTime = Date.now();
      const result = await validator.validate(largePlan);
      const endTime = Date.now();
      
      // Should complete within reasonable time (< 2 seconds)
      expect(endTime - startTime).toBeLessThan(2000);
      expect(result).toBeDefined();
      expect(result.completenessScore).toBeDefined();
    });
  });
});
