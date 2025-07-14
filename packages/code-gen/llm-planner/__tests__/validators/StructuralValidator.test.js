/**
 * Tests for StructuralValidator
 * 
 * The StructuralValidator ensures all required fields are present,
 * types are correct, and the plan follows the expected schema.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { StructuralValidator } from '../../src/validators/StructuralValidator.js';
import { Plan } from '../../src/models/Plan.js';
import { PlanStep } from '../../src/models/PlanStep.js';
import { PlanAction } from '../../src/models/PlanAction.js';
import { PlanContext } from '../../src/models/PlanContext.js';

describe('StructuralValidator', () => {
  let validator;
  let validPlan;

  beforeEach(() => {
    validator = new StructuralValidator({
      strictMode: true,
      allowUnknownFields: false
    });

    // Create a valid plan for testing
    const context = new PlanContext({
      task: 'Create a todo app',
      projectType: 'frontend',
      technologies: ['html', 'css', 'javascript'],
      requirements: 'Create a simple todo application'
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
            content: '<!DOCTYPE html><html>...</html>',
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
            content: 'const todos = [];',
            description: 'Create JavaScript file'
          })
        ]
      })
    ];

    validPlan = new Plan({
      name: 'Todo Application Plan',
      description: 'Plan for creating a simple todo application',
      version: '1.0.0',
      context,
      steps,
      metadata: {
        createdAt: new Date().toISOString(),
        complexity: 'medium',
        estimatedDuration: '2 hours'
      },
      successCriteria: [
        'All todo operations work correctly',
        'UI is responsive and functional'
      ]
    });
  });

  describe('Constructor and Configuration', () => {
    test('should create validator with default configuration', () => {
      const defaultValidator = new StructuralValidator();
      expect(defaultValidator).toBeDefined();
      expect(defaultValidator.config.strictMode).toBe(true);
      expect(defaultValidator.config.allowUnknownFields).toBe(false);
    });

    test('should create validator with custom configuration', () => {
      const customValidator = new StructuralValidator({
        strictMode: false,
        allowUnknownFields: true
      });
      expect(customValidator.config.strictMode).toBe(false);
      expect(customValidator.config.allowUnknownFields).toBe(true);
    });
  });

  describe('Plan Structure Validation', () => {
    test('should validate a valid plan successfully', async () => {
      const result = await validator.validate(validPlan);
      
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeLessThanOrEqual(2); // May have minor warnings
    });

    test('should detect missing required plan fields', async () => {
      const invalidPlan = {
        // Missing name
        id: 'test-plan',
        description: 'Some description',
        steps: validPlan.steps
      };

      const result = await validator.validate(invalidPlan);
      
      expect(result.errors.some(e => 
        e.type === 'missing_required_field' && e.field === 'name'
      )).toBe(true);
    });

    test('should detect missing plan ID', async () => {
      const planWithoutId = { ...validPlan.toJSON() };
      delete planWithoutId.id;

      const result = await validator.validate(planWithoutId);
      
      expect(result.errors.some(e => 
        e.type === 'missing_required_field' && e.field === 'id'
      )).toBe(true);
    });

    test('should detect missing steps', async () => {
      const planWithoutSteps = {
        id: 'test-plan',
        name: 'Plan without steps',
        description: 'Test plan'
        // Missing steps
      };

      const result = await validator.validate(planWithoutSteps);
      
      expect(result.errors.some(e => 
        e.type === 'missing_required_field' && e.field === 'steps'
      )).toBe(true);
    });

    test('should detect empty steps array', async () => {
      const planWithEmptySteps = new Plan({
        name: 'Plan with empty steps',
        description: 'Test plan',
        steps: []
      });

      const result = await validator.validate(planWithEmptySteps);
      
      expect(result.errors.some(e => e.type === 'empty_steps')).toBe(true);
    });

    test('should validate field types', async () => {
      const planWithWrongTypes = {
        id: 123, // Should be string
        name: ['not', 'a', 'string'], // Should be string
        steps: 'not an array' // Should be array
      };

      const result = await validator.validate(planWithWrongTypes);
      
      expect(result.errors.some(e => 
        e.type === 'invalid_type' && e.field === 'id'
      )).toBe(true);
      expect(result.errors.some(e => 
        e.type === 'invalid_type' && e.field === 'name'
      )).toBe(true);
      expect(result.errors.some(e => 
        e.type === 'invalid_type' && e.field === 'steps'
      )).toBe(true);
    });

    test('should validate version format', async () => {
      const planWithBadVersion = new Plan({
        ...validPlan.toJSON(),
        version: 'not-a-valid-version'
      });

      const result = await validator.validate(planWithBadVersion);
      
      expect(result.warnings.some(w => w.type === 'invalid_version')).toBe(true);
    });

    test('should accept valid version formats', async () => {
      const validVersions = ['1.0.0', '2.1.3', '1.0.0-alpha', '1.0.0+build.1'];
      
      for (const version of validVersions) {
        const planWithVersion = new Plan({
          ...validPlan.toJSON(),
          version
        });

        const result = await validator.validate(planWithVersion);
        
        expect(result.warnings.some(w => w.type === 'invalid_version')).toBe(false);
      }
    });
  });

  describe('Step Structure Validation', () => {
    test('should detect missing required step fields', async () => {
      const planWithBadStep = new Plan({
        ...validPlan.toJSON(),
        steps: [
          {
            // Missing id, name, type, actions
            description: 'Incomplete step'
          }
        ]
      });

      const result = await validator.validate(planWithBadStep);
      
      const requiredFields = ['id', 'name', 'type', 'actions'];
      for (const field of requiredFields) {
        expect(result.errors.some(e => 
          e.type === 'missing_required_field' && e.field === field
        )).toBe(true);
      }
    });

    test('should validate step types', async () => {
      const stepWithInvalidType = {
        id: 'step-1',
        name: 'Step with invalid type',
        type: 'invalid-type',
        actions: []
      };

      const planWithInvalidStepType = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithInvalidType]
      });

      const result = await validator.validate(planWithInvalidStepType);
      
      expect(result.errors.some(e => 
        e.type === 'invalid_step_type' && e.value === 'invalid-type'
      )).toBe(true);
    });

    test('should validate dependencies format', async () => {
      const stepWithBadDependencies = new PlanStep({
        id: 'step-1',
        name: 'Step with bad dependencies',
        type: 'setup',
        dependencies: 'not-an-array', // Should be array
        actions: []
      });

      const planWithBadDeps = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithBadDependencies]
      });

      const result = await validator.validate(planWithBadDeps);
      
      expect(result.errors.some(e => 
        e.type === 'invalid_dependencies'
      )).toBe(true);
    });

    test('should validate dependency ID types', async () => {
      const stepWithBadDepIds = new PlanStep({
        id: 'step-1',
        name: 'Step with bad dependency IDs',
        type: 'setup',
        dependencies: [123, 'valid-id'], // 123 should be string
        actions: []
      });

      const planWithBadDepIds = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithBadDepIds]
      });

      const result = await validator.validate(planWithBadDepIds);
      
      expect(result.errors.some(e => 
        e.type === 'invalid_dependency'
      )).toBe(true);
    });

    test('should warn about empty actions', async () => {
      const stepWithNoActions = new PlanStep({
        id: 'step-1',
        name: 'Step with no actions',
        type: 'setup',
        actions: []
      });

      const planWithEmptyActions = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithNoActions]
      });

      const result = await validator.validate(planWithEmptyActions);
      
      expect(result.warnings.some(w => 
        w.type === 'empty_actions' && w.stepId === 'step-1'
      )).toBe(true);
    });

    test('should validate inputs/outputs types', async () => {
      const stepWithBadInputs = new PlanStep({
        id: 'step-1',
        name: 'Step with bad inputs',
        type: 'setup',
        inputs: 'not-an-object', // Should be object
        outputs: ['not', 'an', 'object'], // Should be object
        actions: [
          new PlanAction({
            type: 'create-directory',
            path: 'test'
          })
        ]
      });

      const planWithBadInputsOutputs = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithBadInputs]
      });

      const result = await validator.validate(planWithBadInputsOutputs);
      
      expect(result.warnings.some(w => 
        w.type === 'invalid_inputs'
      )).toBe(true);
      expect(result.warnings.some(w => 
        w.type === 'invalid_outputs'
      )).toBe(true);
    });
  });

  describe('Action Structure Validation', () => {
    test('should detect missing action type', async () => {
      const stepWithBadAction = new PlanStep({
        id: 'step-1',
        name: 'Step with bad action',
        type: 'setup',
        actions: [
          {
            // Missing type
            path: 'some/path',
            description: 'Action without type'
          }
        ]
      });

      const planWithBadAction = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithBadAction]
      });

      const result = await validator.validate(planWithBadAction);
      
      expect(result.errors.some(e => 
        e.type === 'missing_action_type'
      )).toBe(true);
    });

    test('should detect invalid action types', async () => {
      const stepWithInvalidAction = new PlanStep({
        id: 'step-1',
        name: 'Step with invalid action',
        type: 'setup',
        actions: [
          {
            type: 'invalid-action-type',
            description: 'Invalid action'
          }
        ]
      });

      const planWithInvalidAction = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithInvalidAction]
      });

      const result = await validator.validate(planWithInvalidAction);
      
      expect(result.errors.some(e => 
        e.type === 'invalid_action_type' && e.value === 'invalid-action-type'
      )).toBe(true);
    });

    test('should suggest adding descriptions in strict mode', async () => {
      const stepWithoutDescription = new PlanStep({
        id: 'step-1',
        name: 'Step without action description',
        type: 'setup',
        actions: [
          new PlanAction({
            type: 'create-directory',
            path: 'test'
            // Missing description
          })
        ]
      });

      const planWithoutDescription = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithoutDescription]
      });

      const result = await validator.validate(planWithoutDescription);
      
      expect(result.suggestions.some(s => 
        s.type === 'missing_description'
      )).toBe(true);
    });
  });

  describe('Action Type Specific Validation', () => {
    test('should validate create-file action requirements', async () => {
      const stepWithIncompleteCreateFile = new PlanStep({
        id: 'step-1',
        name: 'Step with incomplete create-file',
        type: 'setup',
        actions: [
          {
            type: 'create-file'
            // Missing path and content
          }
        ]
      });

      const planWithIncompleteAction = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithIncompleteCreateFile]
      });

      const result = await validator.validate(planWithIncompleteAction);
      
      expect(result.errors.some(e => 
        e.type === 'missing_required_field' && 
        e.field === 'path' && 
        e.actionType === 'create-file'
      )).toBe(true);
      expect(result.errors.some(e => 
        e.type === 'missing_required_field' && 
        e.field === 'content' && 
        e.actionType === 'create-file'
      )).toBe(true);
    });

    test('should validate update-file action requirements', async () => {
      const stepWithIncompleteUpdateFile = new PlanStep({
        id: 'step-1',
        name: 'Step with incomplete update-file',
        type: 'implementation',
        actions: [
          {
            type: 'update-file'
            // Missing path
          }
        ]
      });

      const planWithIncompleteAction = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithIncompleteUpdateFile]
      });

      const result = await validator.validate(planWithIncompleteAction);
      
      expect(result.errors.some(e => 
        e.type === 'missing_required_field' && 
        e.field === 'path' && 
        e.actionType === 'update-file'
      )).toBe(true);
    });

    test('should validate directory action requirements', async () => {
      const stepWithIncompleteDirectory = new PlanStep({
        id: 'step-1',
        name: 'Step with incomplete directory action',
        type: 'setup',
        actions: [
          {
            type: 'create-directory'
            // Missing path
          }
        ]
      });

      const planWithIncompleteAction = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithIncompleteDirectory]
      });

      const result = await validator.validate(planWithIncompleteAction);
      
      expect(result.errors.some(e => 
        e.type === 'missing_required_field' && 
        e.field === 'path' && 
        e.actionType === 'create-directory'
      )).toBe(true);
    });

    test('should validate run-command action requirements', async () => {
      const stepWithIncompleteCommand = new PlanStep({
        id: 'step-1',
        name: 'Step with incomplete command',
        type: 'setup',
        actions: [
          {
            type: 'run-command'
            // Missing command
          }
        ]
      });

      const planWithIncompleteAction = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithIncompleteCommand]
      });

      const result = await validator.validate(planWithIncompleteAction);
      
      expect(result.errors.some(e => 
        e.type === 'missing_required_field' && 
        e.field === 'command' && 
        e.actionType === 'run-command'
      )).toBe(true);
    });

    test('should validate install-dependency action requirements', async () => {
      const stepWithIncompleteInstall = new PlanStep({
        id: 'step-1',
        name: 'Step with incomplete install',
        type: 'setup',
        actions: [
          {
            type: 'install-dependency'
            // Missing package
          }
        ]
      });

      const planWithIncompleteAction = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithIncompleteInstall]
      });

      const result = await validator.validate(planWithIncompleteAction);
      
      expect(result.errors.some(e => 
        e.type === 'missing_required_field' && 
        e.field === 'package' && 
        e.actionType === 'install-dependency'
      )).toBe(true);
    });
  });

  describe('Metadata Validation', () => {
    test('should warn about missing metadata in strict mode', async () => {
      const planWithoutMetadata = new Plan({
        ...validPlan.toJSON()
      });
      delete planWithoutMetadata.metadata;

      const result = await validator.validate(planWithoutMetadata);
      
      expect(result.warnings.some(w => 
        w.type === 'missing_metadata'
      )).toBe(true);
    });

    test('should validate timestamp formats', async () => {
      const planWithBadTimestamps = new Plan({
        ...validPlan.toJSON(),
        metadata: {
          createdAt: 'not-a-valid-timestamp',
          updatedAt: 'also-invalid'
        }
      });

      const result = await validator.validate(planWithBadTimestamps);
      
      expect(result.warnings.some(w => 
        w.type === 'invalid_timestamp' && w.field === 'metadata.createdAt'
      )).toBe(true);
      expect(result.warnings.some(w => 
        w.type === 'invalid_timestamp' && w.field === 'metadata.updatedAt'
      )).toBe(true);
    });

    test('should accept valid timestamp formats', async () => {
      const validTimestamps = [
        new Date().toISOString(),
        '2024-01-15T10:00:00Z',
        Date.now(),
        1642248000000
      ];

      for (const timestamp of validTimestamps) {
        const planWithTimestamp = new Plan({
          ...validPlan.toJSON(),
          metadata: {
            createdAt: timestamp
          }
        });

        const result = await validator.validate(planWithTimestamp);
        
        expect(result.warnings.some(w => 
          w.type === 'invalid_timestamp'
        )).toBe(false);
      }
    });

    test('should validate complexity values', async () => {
      const planWithBadComplexity = new Plan({
        ...validPlan.toJSON(),
        metadata: {
          complexity: 'invalid-complexity'
        }
      });

      const result = await validator.validate(planWithBadComplexity);
      
      expect(result.warnings.some(w => 
        w.type === 'invalid_complexity' && w.value === 'invalid-complexity'
      )).toBe(true);
    });

    test('should accept valid complexity values', async () => {
      const validComplexities = ['low', 'medium', 'high'];

      for (const complexity of validComplexities) {
        const planWithComplexity = new Plan({
          ...validPlan.toJSON(),
          metadata: { complexity }
        });

        const result = await validator.validate(planWithComplexity);
        
        expect(result.warnings.some(w => 
          w.type === 'invalid_complexity'
        )).toBe(false);
      }
    });
  });

  describe('Context Validation', () => {
    test('should handle missing context gracefully', async () => {
      const planWithoutContext = new Plan({
        ...validPlan.toJSON()
      });
      delete planWithoutContext.context;

      const result = await validator.validate(planWithoutContext);
      
      // Should not error, context is optional
      expect(result.errors.some(e => e.field === 'context')).toBe(false);
    });

    test('should validate project type', async () => {
      const planWithBadProjectType = new Plan({
        ...validPlan.toJSON(),
        context: {
          projectType: 'invalid-project-type',
          requirements: 'Some requirements'
        }
      });

      const result = await validator.validate(planWithBadProjectType);
      
      expect(result.warnings.some(w => 
        w.type === 'invalid_project_type' && w.value === 'invalid-project-type'
      )).toBe(true);
    });

    test('should accept valid project types', async () => {
      const validTypes = ['frontend', 'backend', 'fullstack'];

      for (const projectType of validTypes) {
        const planWithProjectType = new Plan({
          ...validPlan.toJSON(),
          context: new PlanContext({
            projectType,
            requirements: 'Some requirements'
          })
        });

        const result = await validator.validate(planWithProjectType);
        
        expect(result.warnings.some(w => 
          w.type === 'invalid_project_type'
        )).toBe(false);
      }
    });

    test('should validate technologies format - object', async () => {
      const planWithObjectTechnologies = new Plan({
        ...validPlan.toJSON(),
        context: {
          technologies: {
            frontend: ['react', 'css'],
            backend: ['node', 'express'],
            database: 'not-an-array' // Should be array
          },
          requirements: 'Some requirements'
        }
      });

      const result = await validator.validate(planWithObjectTechnologies);
      
      expect(result.errors.some(e => 
        e.type === 'invalid_technologies' && e.category === 'database'
      )).toBe(true);
    });

    test('should validate technologies format - array', async () => {
      const planWithArrayTechnologies = new Plan({
        ...validPlan.toJSON(),
        context: {
          technologies: ['react', 'node', 123], // 123 should be string
          requirements: 'Some requirements'
        }
      });

      const result = await validator.validate(planWithArrayTechnologies);
      
      expect(result.errors.some(e => 
        e.type === 'invalid_technology'
      )).toBe(true);
    });

    test('should validate constraints format', async () => {
      const planWithBadConstraints = new Plan({
        ...validPlan.toJSON(),
        context: new PlanContext({
          constraints: 'not-an-array', // Should be array
          requirements: 'Some requirements'
        })
      });

      const result = await validator.validate(planWithBadConstraints);
      
      expect(result.warnings.some(w => 
        w.type === 'invalid_constraints'
      )).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null plan', async () => {
      const result = await validator.validate(null);
      
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle undefined plan', async () => {
      const result = await validator.validate(undefined);
      
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should handle plan with null steps', async () => {
      const planWithNullSteps = {
        id: 'plan-1',
        name: 'Plan with null steps',
        steps: null
      };

      const result = await validator.validate(planWithNullSteps);
      
      expect(result.errors.some(e => 
        e.type === 'invalid_type' && e.field === 'steps'
      )).toBe(true);
    });

    test('should handle steps with null actions', async () => {
      const stepWithNullActions = new PlanStep({
        id: 'step-1',
        name: 'Step with null actions',
        type: 'setup',
        actions: null
      });

      const planWithNullActions = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithNullActions]
      });

      const result = await validator.validate(planWithNullActions);
      
      // Should handle gracefully, may warn about empty actions
      expect(result).toBeDefined();
    });
  });

  describe('Non-Strict Mode', () => {
    test('should be more lenient in non-strict mode', async () => {
      const lenientValidator = new StructuralValidator({
        strictMode: false
      });

      const planWithoutMetadata = new Plan({
        ...validPlan.toJSON()
      });
      delete planWithoutMetadata.metadata;

      const result = await lenientValidator.validate(planWithoutMetadata);
      
      // Should not warn about missing metadata in non-strict mode
      expect(result.warnings.some(w => 
        w.type === 'missing_metadata'
      )).toBe(false);
    });

    test('should not suggest descriptions in non-strict mode', async () => {
      const lenientValidator = new StructuralValidator({
        strictMode: false
      });

      const stepWithoutDescription = new PlanStep({
        id: 'step-1',
        name: 'Step without action description',
        type: 'setup',
        actions: [
          new PlanAction({
            type: 'create-directory',
            path: 'test'
            // Missing description
          })
        ]
      });

      const planWithoutDescription = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithoutDescription]
      });

      const result = await lenientValidator.validate(planWithoutDescription);
      
      expect(result.suggestions.some(s => 
        s.type === 'missing_description'
      )).toBe(false);
    });
  });
});
