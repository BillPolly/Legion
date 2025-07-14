/**
 * Tests for SemanticValidator
 * 
 * The SemanticValidator ensures the plan makes logical sense, steps achieve stated goals,
 * and actions are appropriate for their context.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { SemanticValidator } from '../../src/validators/SemanticValidator.js';
import { Plan } from '../../src/models/Plan.js';
import { PlanStep } from '../../src/models/PlanStep.js';
import { PlanAction } from '../../src/models/PlanAction.js';
import { PlanContext } from '../../src/models/PlanContext.js';

describe('SemanticValidator', () => {
  let validator;
  let validPlan;

  beforeEach(() => {
    validator = new SemanticValidator({
      validateLogicalFlow: true,
      checkResourceAvailability: true,
      validateNaming: true
    });

    // Create a valid plan with logical flow
    const context = new PlanContext({
      task: 'Create a todo app',
      projectType: 'frontend',
      requirements: 'Create a simple todo application with add, delete, and complete functionality',
      goals: ['user interface', 'todo operations', 'data persistence']
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
        ],
        outputs: {
          directories: ['todo-app'],
          files: ['todo-app/index.html']
        }
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
            content: 'const todos = []; function addTodo() {}',
            description: 'Create JavaScript file with todo operations'
          })
        ],
        outputs: {
          files: ['todo-app/script.js'],
          features: ['todo operations']
        }
      }),
      new PlanStep({
        id: 'test-1',
        name: 'Add unit tests',
        type: 'testing',
        description: 'Create tests for todo functionality',
        dependencies: ['impl-1'],
        actions: [
          new PlanAction({
            type: 'create-file',
            path: 'todo-app/tests.js',
            content: 'describe("Todo App", () => { test("adds todo", () => {}); });',
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
      successCriteria: [
        'All todo operations work correctly',
        'Tests pass successfully',
        'UI is responsive and functional'
      ]
    });
  });

  describe('Constructor and Configuration', () => {
    test('should create validator with default configuration', () => {
      const defaultValidator = new SemanticValidator();
      expect(defaultValidator).toBeDefined();
      expect(defaultValidator.config.validateLogicalFlow).toBe(true);
      expect(defaultValidator.config.checkResourceAvailability).toBe(true);
      expect(defaultValidator.config.validateNaming).toBe(true);
    });

    test('should create validator with custom configuration', () => {
      const customValidator = new SemanticValidator({
        validateLogicalFlow: false,
        checkResourceAvailability: false,
        validateNaming: false
      });
      expect(customValidator.config.validateLogicalFlow).toBe(false);
      expect(customValidator.config.checkResourceAvailability).toBe(false);
      expect(customValidator.config.validateNaming).toBe(false);
    });

    test('should initialize logical sequences', () => {
      expect(validator.logicalSequences).toBeDefined();
      expect(validator.logicalSequences.setup).toContain('implementation');
      expect(validator.logicalSequences.implementation).toContain('testing');
      expect(validator.logicalSequences.testing).toContain('validation');
    });

    test('should initialize conflicting actions', () => {
      expect(validator.conflictingActions).toBeDefined();
      expect(validator.conflictingActions).toContainEqual(['create-file', 'delete-file']);
      expect(validator.conflictingActions).toContainEqual(['create-directory', 'delete-directory']);
    });
  });

  describe('Basic Semantic Validation', () => {
    test('should validate a valid plan successfully', async () => {
      const result = await validator.validate(validPlan);
      
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeLessThanOrEqual(2); // May have minor warnings
    });

    test('should handle plans with no steps', async () => {
      const planWithoutSteps = new Plan({
        name: 'Empty Plan',
        description: 'Plan with no steps',
        steps: []
      });

      const result = await validator.validate(planWithoutSteps);
      
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should handle plans with null steps', async () => {
      const planWithNullSteps = new Plan({
        name: 'Plan with null steps',
        description: 'Test plan'
      });

      const result = await validator.validate(planWithNullSteps);
      
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Logical Flow Validation', () => {
    test('should warn about missing setup dependencies', async () => {
      const stepsWithoutSetupDep = [
        new PlanStep({
          id: 'setup-1',
          name: 'Initialize project',
          type: 'setup',
          dependencies: [],
          actions: []
        }),
        new PlanStep({
          id: 'impl-1',
          name: 'Implement features',
          type: 'implementation',
          dependencies: [], // Should depend on setup-1
          actions: []
        })
      ];

      const planWithoutSetupDep = new Plan({
        ...validPlan.toJSON(),
        steps: stepsWithoutSetupDep
      });

      const result = await validator.validate(planWithoutSetupDep);
      
      expect(result.warnings.some(w => 
        w.type === 'illogical_sequence' && 
        w.setupStepId === 'setup-1' && 
        w.otherStepId === 'impl-1'
      )).toBe(true);
    });

    test('should warn about unusual step sequences', async () => {
      const unusualSteps = [
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
          dependencies: ['test-1'], // Unusual: implementing after testing
          actions: []
        })
      ];

      const planWithUnusualSequence = new Plan({
        ...validPlan.toJSON(),
        steps: unusualSteps
      });

      const result = await validator.validate(planWithUnusualSequence);
      
      expect(result.warnings.some(w => 
        w.type === 'unusual_sequence' && 
        w.fromType === 'testing' && 
        w.toType === 'implementation'
      )).toBe(true);
    });

    test('should warn about missing essential step types', async () => {
      const stepsWithoutSetup = [
        new PlanStep({
          id: 'impl-1',
          name: 'Implement features',
          type: 'implementation',
          dependencies: [],
          actions: []
        })
        // Missing setup step
      ];

      const planWithoutSetup = new Plan({
        ...validPlan.toJSON(),
        steps: stepsWithoutSetup
      });

      const result = await validator.validate(planWithoutSetup);
      
      expect(result.warnings.some(w => 
        w.type === 'missing_essential_step' && w.stepType === 'setup'
      )).toBe(true);
    });

    test('should not validate logical flow when disabled', async () => {
      const noFlowValidator = new SemanticValidator({
        validateLogicalFlow: false
      });

      const unusualSteps = [
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

      const planWithUnusualSequence = new Plan({
        ...validPlan.toJSON(),
        steps: unusualSteps
      });

      const result = await noFlowValidator.validate(planWithUnusualSequence);
      
      expect(result.warnings.some(w => w.type === 'unusual_sequence')).toBe(false);
    });
  });

  describe('Action Conflict Detection', () => {
    test('should detect conflicting actions on same target', async () => {
      const conflictingSteps = [
        new PlanStep({
          id: 'create-1',
          name: 'Create file',
          type: 'setup',
          actions: [
            new PlanAction({
              type: 'create-file',
              path: 'test.js',
              content: 'content1',
              description: 'Create test file'
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
              path: 'test.js',
              description: 'Delete test file'
            })
          ]
        })
      ];

      const planWithConflicts = new Plan({
        ...validPlan.toJSON(),
        steps: conflictingSteps
      });

      const result = await validator.validate(planWithConflicts);
      
      expect(result.errors.some(e => 
        e.type === 'conflicting_actions' && 
        e.target === 'test.js'
      )).toBe(true);
    });

    test('should detect directory conflicts', async () => {
      const directoryConflictSteps = [
        new PlanStep({
          id: 'create-dir',
          name: 'Create directory',
          type: 'setup',
          actions: [
            new PlanAction({
              type: 'create-directory',
              path: 'mydir',
              description: 'Create directory'
            })
          ]
        }),
        new PlanStep({
          id: 'delete-dir',
          name: 'Delete directory',
          type: 'setup',
          actions: [
            new PlanAction({
              type: 'delete-directory',
              path: 'mydir',
              description: 'Delete directory'
            })
          ]
        })
      ];

      const planWithDirConflicts = new Plan({
        ...validPlan.toJSON(),
        steps: directoryConflictSteps
      });

      const result = await validator.validate(planWithDirConflicts);
      
      expect(result.errors.some(e => 
        e.type === 'conflicting_actions' && 
        e.target === 'mydir'
      )).toBe(true);
    });

    test('should warn about redundant actions', async () => {
      const redundantSteps = [
        new PlanStep({
          id: 'create-1',
          name: 'Create file first time',
          type: 'setup',
          actions: [
            new PlanAction({
              type: 'create-file',
              path: 'duplicate.js',
              content: 'content1',
              description: 'Create file'
            })
          ]
        }),
        new PlanStep({
          id: 'create-2',
          name: 'Create file second time',
          type: 'setup',
          actions: [
            new PlanAction({
              type: 'create-file',
              path: 'duplicate.js',
              content: 'content2',
              description: 'Create file again'
            })
          ]
        })
      ];

      const planWithRedundant = new Plan({
        ...validPlan.toJSON(),
        steps: redundantSteps
      });

      const result = await validator.validate(planWithRedundant);
      
      expect(result.warnings.some(w => 
        w.type === 'redundant_actions' && 
        w.target === 'duplicate.js'
      )).toBe(true);
    });

    test('should handle actions without targets', async () => {
      const stepWithoutTarget = new PlanStep({
        id: 'step-1',
        name: 'Step without target',
        type: 'setup',
        actions: [
          {
            type: 'custom-action',
            description: 'Custom action without path'
          }
        ]
      });

      const planWithoutTarget = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithoutTarget]
      });

      const result = await validator.validate(planWithoutTarget);
      
      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Resource Availability Validation', () => {
    test('should detect missing file resources', async () => {
      const stepWithMissingResource = new PlanStep({
        id: 'update-1',
        name: 'Update non-existent file',
        type: 'implementation',
        actions: [
          new PlanAction({
            type: 'update-file',
            path: 'non-existent.js',
            updates: 'some updates',
            description: 'Update missing file'
          })
        ]
      });

      const planWithMissingResource = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithMissingResource]
      });

      const result = await validator.validate(planWithMissingResource);
      
      expect(result.errors.some(e => 
        e.type === 'missing_resource' && 
        e.resource === 'non-existent.js'
      )).toBe(true);
    });

    test('should warn about possibly missing dependencies', async () => {
      const stepWithCommand = new PlanStep({
        id: 'test-1',
        name: 'Run Jest tests',
        type: 'testing',
        actions: [
          new PlanAction({
            type: 'run-command',
            command: 'jest --coverage',
            description: 'Run tests with Jest'
          })
        ]
      });

      const planWithCommand = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithCommand]
      });

      const result = await validator.validate(planWithCommand);
      
      expect(result.warnings.some(w => 
        w.type === 'possibly_missing_dependency' && 
        w.command === 'jest'
      )).toBe(true);
    });

    test('should not warn when dependencies are installed', async () => {
      const stepsWithInstallAndUse = [
        new PlanStep({
          id: 'install-1',
          name: 'Install Jest',
          type: 'setup',
          actions: [
            new PlanAction({
              type: 'install-dependency',
              package: 'jest',
              description: 'Install Jest testing framework'
            })
          ]
        }),
        new PlanStep({
          id: 'test-1',
          name: 'Run Jest tests',
          type: 'testing',
          dependencies: ['install-1'],
          actions: [
            new PlanAction({
              type: 'run-command',
              command: 'jest --coverage',
              description: 'Run tests with Jest'
            })
          ]
        })
      ];

      const planWithInstallAndUse = new Plan({
        ...validPlan.toJSON(),
        steps: stepsWithInstallAndUse
      });

      const result = await validator.validate(planWithInstallAndUse);
      
      expect(result.warnings.some(w => 
        w.type === 'possibly_missing_dependency' && 
        w.command === 'jest'
      )).toBe(false);
    });

    test('should not validate resources when disabled', async () => {
      const noResourceValidator = new SemanticValidator({
        checkResourceAvailability: false
      });

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

      const result = await noResourceValidator.validate(planWithMissingResource);
      
      expect(result.errors.some(e => e.type === 'missing_resource')).toBe(false);
    });
  });

  describe('Naming Convention Validation', () => {
    test('should suggest better plan names', async () => {
      const planWithBadName = new Plan({
        ...validPlan.toJSON(),
        name: 'bad' // Too short, no capitalization
      });

      const result = await validator.validate(planWithBadName);
      
      expect(result.suggestions.some(s => 
        s.type === 'naming_convention' && 
        s.field === 'plan.name'
      )).toBe(true);
    });

    test('should suggest better step names', async () => {
      const stepWithBadName = new PlanStep({
        id: 'step-1',
        name: 'bad step name', // Doesn't start with verb
        type: 'setup',
        actions: []
      });

      const planWithBadStepName = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithBadName]
      });

      const result = await validator.validate(planWithBadStepName);
      
      expect(result.suggestions.some(s => 
        s.type === 'naming_convention' && 
        s.field === 'step.name' && 
        s.stepId === 'step-1'
      )).toBe(true);
    });

    test('should warn about poor file naming', async () => {
      const stepWithBadFileName = new PlanStep({
        id: 'step-1',
        name: 'Create file with bad name',
        type: 'setup',
        actions: [
          new PlanAction({
            type: 'create-file',
            path: 'BadFileName.JS', // Poor naming convention
            content: 'content',
            description: 'Create file'
          })
        ]
      });

      const planWithBadFileName = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithBadFileName]
      });

      const result = await validator.validate(planWithBadFileName);
      
      expect(result.warnings.some(w => 
        w.type === 'file_naming_convention' && 
        w.fileName === 'BadFileName.JS'
      )).toBe(true);
    });

    test('should accept good naming conventions', async () => {
      const goodNames = [
        'camelCase.js',
        'kebab-case.css',
        'snake_case.py',
        'PascalCase.tsx',
        'package.json',
        'README.md',
        '.eslintrc.js'
      ];

      for (const fileName of goodNames) {
        const stepWithGoodName = new PlanStep({
          id: 'step-1',
          name: 'Create well-named file',
          type: 'setup',
          actions: [
            new PlanAction({
              type: 'create-file',
              path: fileName,
              content: 'content'
            })
          ]
        });

        const planWithGoodName = new Plan({
          ...validPlan.toJSON(),
          steps: [stepWithGoodName]
        });

        const result = await validator.validate(planWithGoodName);
        
        expect(result.warnings.some(w => 
          w.type === 'file_naming_convention' && 
          w.fileName === fileName
        )).toBe(false);
      }
    });

    test('should not validate naming when disabled', async () => {
      const noNamingValidator = new SemanticValidator({
        validateNaming: false
      });

      const planWithBadName = new Plan({
        ...validPlan.toJSON(),
        name: 'bad'
      });

      const result = await noNamingValidator.validate(planWithBadName);
      
      expect(result.suggestions.some(s => s.type === 'naming_convention')).toBe(false);
    });
  });

  describe('Completeness Validation', () => {
    test('should warn about unachieved goals', async () => {
      const contextWithUnachievableGoal = new PlanContext({
        ...validPlan.context.toJSON(),
        goals: ['user interface', 'todo operations', 'unachievable goal']
      });

      const planWithUnachievableGoal = new Plan({
        ...validPlan.toJSON(),
        context: contextWithUnachievableGoal
      });

      const result = await validator.validate(planWithUnachievableGoal);
      
      expect(result.warnings.some(w => 
        w.type === 'unachieved_goal' && 
        w.goal === 'unachievable goal'
      )).toBe(true);
    });

    test('should warn about missing tests for implementation', async () => {
      const stepsWithoutTests = validPlan.steps.filter(s => s.type !== 'testing');

      const planWithoutTests = new Plan({
        ...validPlan.toJSON(),
        steps: stepsWithoutTests
      });

      const result = await validator.validate(planWithoutTests);
      
      expect(result.warnings.some(w => w.type === 'missing_tests')).toBe(true);
    });

    test('should suggest documentation for code files', async () => {
      const result = await validator.validate(validPlan);
      
      // Plan creates .js files but no documentation
      expect(result.suggestions.some(s => s.type === 'missing_documentation')).toBe(true);
    });

    test('should not suggest documentation when present', async () => {
      const stepsWithDocumentation = [
        ...validPlan.steps,
        new PlanStep({
          id: 'doc-1',
          name: 'Create documentation',
          type: 'implementation',
          actions: [
            new PlanAction({
              type: 'create-file',
              path: 'README.md',
              content: '# Todo App\n\nThis is a todo application.',
              description: 'Create documentation'
            })
          ]
        })
      ];

      const planWithDocumentation = new Plan({
        ...validPlan.toJSON(),
        steps: stepsWithDocumentation
      });

      const result = await validator.validate(planWithDocumentation);
      
      expect(result.suggestions.some(s => s.type === 'missing_documentation')).toBe(false);
    });

    test('should handle plans without context goals', async () => {
      const contextWithoutGoals = new PlanContext({
        task: 'Create a todo app',
        projectType: 'frontend',
        requirements: 'Create a simple todo application'
        // No goals
      });

      const planWithoutGoals = new Plan({
        ...validPlan.toJSON(),
        context: contextWithoutGoals
      });

      const result = await validator.validate(planWithoutGoals);
      
      // Should not error
      expect(result.errors.some(e => e.type === 'unachieved_goal')).toBe(false);
    });
  });

  describe('Action Appropriateness Validation', () => {
    test('should warn about inappropriate actions for step types', async () => {
      const stepWithInappropriateAction = new PlanStep({
        id: 'test-1',
        name: 'Testing step with file creation',
        type: 'testing',
        actions: [
          new PlanAction({
            type: 'create-directory', // Unusual for testing step
            path: 'test-dir',
            description: 'Create directory in test step'
          })
        ]
      });

      const planWithInappropriateAction = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithInappropriateAction]
      });

      const result = await validator.validate(planWithInappropriateAction);
      
      expect(result.warnings.some(w => 
        w.type === 'inappropriate_action' && 
        w.stepType === 'testing' && 
        w.actionType === 'create-directory'
      )).toBe(true);
    });

    test('should accept appropriate actions for step types', async () => {
      const appropriateSteps = [
        new PlanStep({
          id: 'setup-1',
          name: 'Setup step',
          type: 'setup',
          actions: [
            new PlanAction({
              type: 'create-directory',
              path: 'project',
              description: 'Create project directory'
            })
          ]
        }),
        new PlanStep({
          id: 'impl-1',
          name: 'Implementation step',
          type: 'implementation',
          actions: [
            new PlanAction({
              type: 'create-file',
              path: 'app.js',
              content: 'code',
              description: 'Create application file'
            })
          ]
        }),
        new PlanStep({
          id: 'test-1',
          name: 'Testing step',
          type: 'testing',
          actions: [
            new PlanAction({
              type: 'run-command',
              command: 'npm test',
              description: 'Run tests'
            })
          ]
        })
      ];

      const planWithAppropriateActions = new Plan({
        ...validPlan.toJSON(),
        steps: appropriateSteps
      });

      const result = await validator.validate(planWithAppropriateActions);
      
      expect(result.warnings.some(w => w.type === 'inappropriate_action')).toBe(false);
    });

    test('should handle unknown step types gracefully', async () => {
      const stepWithUnknownType = new PlanStep({
        id: 'unknown-1',
        name: 'Unknown step type',
        type: 'unknown-type',
        actions: [
          new PlanAction({
            type: 'create-file',
            path: 'file.js',
            content: 'content'
          })
        ]
      });

      const planWithUnknownType = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithUnknownType]
      });

      const result = await validator.validate(planWithUnknownType);
      
      // Should handle gracefully, no inappropriate action warnings
      expect(result.warnings.some(w => 
        w.type === 'inappropriate_action' && 
        w.stepId === 'unknown-1'
      )).toBe(false);
    });
  });

  describe('Helper Methods', () => {
    test('should correctly identify action targets', () => {
      const actions = [
        { path: 'file.js' },
        { directory: 'mydir' },
        { package: 'express' },
        { type: 'custom' } // No target
      ];

      expect(validator._getActionTarget(actions[0])).toBe('file.js');
      expect(validator._getActionTarget(actions[1])).toBe('mydir');
      expect(validator._getActionTarget(actions[2])).toBe('package:express');
      expect(validator._getActionTarget(actions[3])).toBeNull();
    });

    test('should correctly identify conflicting actions', () => {
      const createFile = { type: 'create-file' };
      const deleteFile = { type: 'delete-file' };
      const updateFile = { type: 'update-file' };

      expect(validator._areActionsConflicting(createFile, deleteFile)).toBe(true);
      expect(validator._areActionsConflicting(createFile, updateFile)).toBe(false);
      expect(validator._areActionsConflicting(updateFile, deleteFile)).toBe(false);
    });

    test('should validate plan names correctly', () => {
      expect(validator._isValidPlanName('Good Plan Name')).toBe(true);
      expect(validator._isValidPlanName('bad')).toBe(false);
      expect(validator._isValidPlanName('lowercase plan')).toBe(false);
      expect(validator._isValidPlanName('')).toBe(false);
    });

    test('should validate step names correctly', () => {
      expect(validator._isValidStepName('Create project structure')).toBe(true);
      expect(validator._isValidStepName('Initialize database')).toBe(true);
      expect(validator._isValidStepName('bad step name')).toBe(false);
      expect(validator._isValidStepName('Short')).toBe(false);
    });

    test('should validate file names correctly', () => {
      const validNames = [
        'camelCase.js',
        'kebab-case.css',
        'snake_case.py',
        'PascalCase.tsx',
        'package.json',
        'README.md'
      ];

      const invalidNames = [
        'BadFileName.JS',
        'spaces in name.js',
        'ALLCAPS.JS',
        'mixed-CASE_name.js'
      ];

      for (const name of validNames) {
        expect(validator._isValidFileName(name)).toBe(true);
      }

      for (const name of invalidNames) {
        expect(validator._isValidFileName(name)).toBe(false);
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle steps without actions', async () => {
      const stepWithoutActions = new PlanStep({
        id: 'step-1',
        name: 'Step without actions',
        type: 'setup',
        dependencies: []
        // No actions
      });

      const planWithoutActions = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithoutActions]
      });

      const result = await validator.validate(planWithoutActions);
      
      // Should handle gracefully
      expect(result).toBeDefined();
    });

    test('should handle actions with null properties', async () => {
      const stepWithNullAction = new PlanStep({
        id: 'step-1',
        name: 'Step with null action properties',
        type: 'setup',
        actions: [
          {
            type: 'create-file',
            path: null,
            content: null
          }
        ]
      });

      const planWithNullAction = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithNullAction]
      });

      const result = await validator.validate(planWithNullAction);
      
      // Should handle gracefully
      expect(result).toBeDefined();
    });

    test('should handle plans with circular step references in outputs', async () => {
      const stepWithCircularOutput = new PlanStep({
        id: 'step-1',
        name: 'Step with circular output reference',
        type: 'setup',
        actions: [],
        outputs: {
          references: ['step-1'] // Self-reference
        }
      });

      const planWithCircularOutput = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithCircularOutput]
      });

      const result = await validator.validate(planWithCircularOutput);
      
      // Should handle gracefully
      expect(result).toBeDefined();
    });

    test('should handle empty context', async () => {
      const planWithEmptyContext = new Plan({
        ...validPlan.toJSON(),
        context: new PlanContext({})
      });

      const result = await validator.validate(planWithEmptyContext);
      
      // Should not error
      expect(result.errors).toHaveLength(0);
    });

    test('should handle malformed step inputs', async () => {
      const stepWithBadInputs = new PlanStep({
        id: 'step-1',
        name: 'Step with bad inputs',
        type: 'implementation',
        actions: [],
        inputs: {
          'file-path': 'non-existent.js'
        }
      });

      const planWithBadInputs = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithBadInputs]
      });

      const result = await validator.validate(planWithBadInputs);
      
      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should handle large plans efficiently', async () => {
      // Create a large plan with many steps
      const largeSteps = [];
      
      for (let i = 0; i < 100; i++) {
        largeSteps.push(new PlanStep({
          id: `step-${i}`,
          name: `Step ${i}`,
          type: 'implementation',
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
    });
  });
});
