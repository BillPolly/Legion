/**
 * Tests for DependencyValidator
 * 
 * The DependencyValidator ensures dependencies are valid, no circular dependencies exist,
 * and the dependency graph can be executed.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { DependencyValidator } from '../../src/validators/DependencyValidator.js';
import { Plan } from '../../src/models/Plan.js';
import { PlanStep } from '../../src/models/PlanStep.js';
import { PlanAction } from '../../src/models/PlanAction.js';
import { PlanContext } from '../../src/models/PlanContext.js';

describe('DependencyValidator', () => {
  let validator;
  let validPlan;

  beforeEach(() => {
    validator = new DependencyValidator({
      allowParallelExecution: true,
      maxDependencyDepth: 10
    });

    // Create a valid plan with proper dependencies
    const context = new PlanContext({
      task: 'Create a todo app',
      projectType: 'frontend',
      requirements: 'Create a simple todo application'
    });

    const steps = [
      new PlanStep({
        id: 'setup-1',
        name: 'Initialize project structure',
        type: 'setup',
        description: 'Set up the basic project structure',
        dependencies: [],
        actions: [
          new PlanAction({
            type: 'create-directory',
            path: 'todo-app',
            description: 'Create main directory'
          })
        ]
      }),
      new PlanStep({
        id: 'impl-1',
        name: 'Implement core functionality',
        type: 'implementation',
        description: 'Add main application logic',
        dependencies: ['setup-1'],
        actions: [
          new PlanAction({
            type: 'create-file',
            path: 'todo-app/app.js',
            content: 'const app = {};',
            description: 'Create main app file'
          })
        ]
      }),
      new PlanStep({
        id: 'impl-2',
        name: 'Implement UI components',
        type: 'implementation',
        description: 'Add user interface components',
        dependencies: ['setup-1'],
        actions: [
          new PlanAction({
            type: 'create-file',
            path: 'todo-app/ui.js',
            content: 'const ui = {};',
            description: 'Create UI file'
          })
        ]
      }),
      new PlanStep({
        id: 'test-1',
        name: 'Add tests',
        type: 'testing',
        description: 'Create test suite',
        dependencies: ['impl-1', 'impl-2'],
        actions: [
          new PlanAction({
            type: 'create-file',
            path: 'todo-app/tests.js',
            content: 'describe("tests", () => {});',
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
      successCriteria: ['All tests pass', 'Application works correctly']
    });
  });

  describe('Constructor and Configuration', () => {
    test('should create validator with default configuration', () => {
      const defaultValidator = new DependencyValidator();
      expect(defaultValidator).toBeDefined();
      expect(defaultValidator.config.allowParallelExecution).toBe(true);
      expect(defaultValidator.config.maxDependencyDepth).toBe(10);
    });

    test('should create validator with custom configuration', () => {
      const customValidator = new DependencyValidator({
        allowParallelExecution: false,
        maxDependencyDepth: 5
      });
      expect(customValidator.config.allowParallelExecution).toBe(false);
      expect(customValidator.config.maxDependencyDepth).toBe(5);
    });
  });

  describe('Basic Dependency Validation', () => {
    test('should validate a valid plan successfully', async () => {
      const result = await validator.validate(validPlan);
      
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeLessThanOrEqual(1); // May have minor warnings
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

  describe('Step Dependency Validation', () => {
    test('should detect invalid dependencies', async () => {
      const stepWithInvalidDep = new PlanStep({
        id: 'step-1',
        name: 'Step with invalid dependency',
        type: 'implementation',
        dependencies: ['non-existent-step'],
        actions: []
      });

      const planWithInvalidDep = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithInvalidDep]
      });

      const result = await validator.validate(planWithInvalidDep);
      
      expect(result.errors.some(e => 
        e.type === 'invalid_dependency' && 
        e.stepId === 'step-1' && 
        e.dependencyId === 'non-existent-step'
      )).toBe(true);
    });

    test('should detect self-dependencies', async () => {
      const stepWithSelfDep = new PlanStep({
        id: 'step-1',
        name: 'Step with self dependency',
        type: 'implementation',
        dependencies: ['step-1'], // Self-dependency
        actions: []
      });

      const planWithSelfDep = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithSelfDep]
      });

      const result = await validator.validate(planWithSelfDep);
      
      expect(result.errors.some(e => 
        e.type === 'self_dependency' && e.stepId === 'step-1'
      )).toBe(true);
    });

    test('should warn about duplicate dependencies', async () => {
      const stepWithDuplicateDeps = new PlanStep({
        id: 'step-1',
        name: 'Step with duplicate dependencies',
        type: 'implementation',
        dependencies: ['setup-1', 'setup-1'], // Duplicate
        actions: []
      });

      const planWithDuplicateDeps = new Plan({
        ...validPlan.toJSON(),
        steps: [...validPlan.steps, stepWithDuplicateDeps]
      });

      const result = await validator.validate(planWithDuplicateDeps);
      
      expect(result.warnings.some(w => 
        w.type === 'duplicate_dependencies' && w.stepId === 'step-1'
      )).toBe(true);
    });

    test('should handle steps with no dependencies', async () => {
      const stepWithoutDeps = new PlanStep({
        id: 'step-1',
        name: 'Independent step',
        type: 'setup',
        dependencies: [],
        actions: []
      });

      const planWithIndependentStep = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithoutDeps]
      });

      const result = await validator.validate(planWithIndependentStep);
      
      // Should not cause errors
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Circular Dependency Detection', () => {
    test('should detect simple circular dependencies', async () => {
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
      
      expect(result.errors.some(e => 
        e.type === 'circular_dependency'
      )).toBe(true);
    });

    test('should detect complex circular dependencies', async () => {
      const complexCircularSteps = [
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
          type: 'implementation',
          dependencies: ['step-c'],
          actions: []
        }),
        new PlanStep({
          id: 'step-c',
          name: 'Step C',
          type: 'testing',
          dependencies: ['step-a'], // Creates cycle: a -> b -> c -> a
          actions: []
        })
      ];

      const planWithComplexCircular = new Plan({
        ...validPlan.toJSON(),
        steps: complexCircularSteps
      });

      const result = await validator.validate(planWithComplexCircular);
      
      expect(result.errors.some(e => 
        e.type === 'circular_dependency'
      )).toBe(true);
    });

    test('should not flag valid dependency chains as circular', async () => {
      const validChainSteps = [
        new PlanStep({
          id: 'step-a',
          name: 'Step A',
          type: 'setup',
          dependencies: [],
          actions: []
        }),
        new PlanStep({
          id: 'step-b',
          name: 'Step B',
          type: 'implementation',
          dependencies: ['step-a'],
          actions: []
        }),
        new PlanStep({
          id: 'step-c',
          name: 'Step C',
          type: 'testing',
          dependencies: ['step-b'],
          actions: []
        })
      ];

      const planWithValidChain = new Plan({
        ...validPlan.toJSON(),
        steps: validChainSteps
      });

      const result = await validator.validate(planWithValidChain);
      
      expect(result.errors.some(e => 
        e.type === 'circular_dependency'
      )).toBe(false);
    });
  });

  describe('Dependency Depth Analysis', () => {
    test('should warn about excessive dependency depth', async () => {
      const deepValidator = new DependencyValidator({
        maxDependencyDepth: 2
      });

      // Create a chain deeper than the limit
      const deepSteps = [
        new PlanStep({
          id: 'step-1',
          name: 'Step 1',
          type: 'setup',
          dependencies: [],
          actions: []
        }),
        new PlanStep({
          id: 'step-2',
          name: 'Step 2',
          type: 'implementation',
          dependencies: ['step-1'],
          actions: []
        }),
        new PlanStep({
          id: 'step-3',
          name: 'Step 3',
          type: 'testing',
          dependencies: ['step-2'],
          actions: []
        }),
        new PlanStep({
          id: 'step-4',
          name: 'Step 4',
          type: 'validation',
          dependencies: ['step-3'], // Depth = 3, exceeds limit of 2
          actions: []
        })
      ];

      const planWithDeepDeps = new Plan({
        ...validPlan.toJSON(),
        steps: deepSteps
      });

      const result = await deepValidator.validate(planWithDeepDeps);
      
      expect(result.warnings.some(w => 
        w.type === 'excessive_depth' && w.depth > 2
      )).toBe(true);
    });

    test('should not warn about acceptable dependency depth', async () => {
      const result = await validator.validate(validPlan);
      
      expect(result.warnings.some(w => 
        w.type === 'excessive_depth'
      )).toBe(false);
    });
  });

  describe('Orphaned Steps Detection', () => {
    test('should detect orphaned steps', async () => {
      const stepsWithOrphan = [
        ...validPlan.steps,
        new PlanStep({
          id: 'orphan-1',
          name: 'Orphaned step',
          type: 'implementation', // Not a final type like deployment
          dependencies: [],
          actions: []
        })
      ];

      const planWithOrphan = new Plan({
        ...validPlan.toJSON(),
        steps: stepsWithOrphan
      });

      const result = await validator.validate(planWithOrphan);
      
      expect(result.warnings.some(w => 
        w.type === 'orphaned_steps' && w.steps.includes('orphan-1')
      )).toBe(true);
    });

    test('should not flag deployment steps as orphaned', async () => {
      const stepsWithDeployment = [
        ...validPlan.steps,
        new PlanStep({
          id: 'deploy-1',
          name: 'Deploy application',
          type: 'deployment', // Final step type
          dependencies: ['test-1'],
          actions: []
        })
      ];

      const planWithDeployment = new Plan({
        ...validPlan.toJSON(),
        steps: stepsWithDeployment
      });

      const result = await validator.validate(planWithDeployment);
      
      expect(result.warnings.some(w => 
        w.type === 'orphaned_steps' && w.steps.includes('deploy-1')
      )).toBe(false);
    });

    test('should not flag validation steps as orphaned', async () => {
      const stepsWithValidation = [
        ...validPlan.steps,
        new PlanStep({
          id: 'validate-1',
          name: 'Validate application',
          type: 'validation', // Final step type
          dependencies: ['test-1'],
          actions: []
        })
      ];

      const planWithValidation = new Plan({
        ...validPlan.toJSON(),
        steps: stepsWithValidation
      });

      const result = await validator.validate(planWithValidation);
      
      expect(result.warnings.some(w => 
        w.type === 'orphaned_steps' && w.steps.includes('validate-1')
      )).toBe(false);
    });
  });

  describe('Parallelization Suggestions', () => {
    test('should suggest parallelization opportunities', async () => {
      const result = await validator.validate(validPlan);
      
      // impl-1 and impl-2 can run in parallel (both depend only on setup-1)
      expect(result.suggestions.some(s => 
        s.type === 'parallelization_opportunity' &&
        s.steps.includes('impl-1') &&
        s.steps.includes('impl-2')
      )).toBe(true);
    });

    test('should not suggest parallelization when disabled', async () => {
      const noParallelValidator = new DependencyValidator({
        allowParallelExecution: false
      });

      const result = await noParallelValidator.validate(validPlan);
      
      expect(result.suggestions.some(s => 
        s.type === 'parallelization_opportunity'
      )).toBe(false);
    });

    test('should not suggest parallelization for steps with shared dependencies', async () => {
      const stepsWithSharedDeps = [
        new PlanStep({
          id: 'setup-1',
          name: 'Setup',
          type: 'setup',
          dependencies: [],
          actions: []
        }),
        new PlanStep({
          id: 'shared-dep',
          name: 'Shared dependency',
          type: 'setup',
          dependencies: ['setup-1'],
          actions: []
        }),
        new PlanStep({
          id: 'step-a',
          name: 'Step A',
          type: 'implementation',
          dependencies: ['setup-1', 'shared-dep'],
          actions: []
        }),
        new PlanStep({
          id: 'step-b',
          name: 'Step B',
          type: 'implementation',
          dependencies: ['setup-1', 'shared-dep'], // Same dependencies as step-a
          actions: []
        })
      ];

      const planWithSharedDeps = new Plan({
        ...validPlan.toJSON(),
        steps: stepsWithSharedDeps
      });

      const result = await validator.validate(planWithSharedDeps);
      
      // Should not suggest parallelization due to shared dependencies
      const parallelSuggestion = result.suggestions.find(s => 
        s.type === 'parallelization_opportunity' &&
        s.steps.includes('step-a') &&
        s.steps.includes('step-b')
      );
      
      expect(parallelSuggestion).toBeUndefined();
    });
  });

  describe('Execution Order Generation', () => {
    test('should generate correct execution order', () => {
      const order = validator.generateExecutionOrder(validPlan.steps);
      
      expect(order).toContain('setup-1');
      expect(order).toContain('impl-1');
      expect(order).toContain('impl-2');
      expect(order).toContain('test-1');
      
      // setup-1 should come before impl-1 and impl-2
      expect(order.indexOf('setup-1')).toBeLessThan(order.indexOf('impl-1'));
      expect(order.indexOf('setup-1')).toBeLessThan(order.indexOf('impl-2'));
      
      // impl-1 and impl-2 should come before test-1
      expect(order.indexOf('impl-1')).toBeLessThan(order.indexOf('test-1'));
      expect(order.indexOf('impl-2')).toBeLessThan(order.indexOf('test-1'));
    });

    test('should handle steps with no dependencies', () => {
      const independentSteps = [
        new PlanStep({
          id: 'step-1',
          name: 'Independent step 1',
          type: 'setup',
          dependencies: [],
          actions: []
        }),
        new PlanStep({
          id: 'step-2',
          name: 'Independent step 2',
          type: 'setup',
          dependencies: [],
          actions: []
        })
      ];

      const order = validator.generateExecutionOrder(independentSteps);
      
      expect(order).toHaveLength(2);
      expect(order).toContain('step-1');
      expect(order).toContain('step-2');
    });

    test('should handle complex dependency chains', () => {
      const complexSteps = [
        new PlanStep({
          id: 'a',
          name: 'Step A',
          type: 'setup',
          dependencies: [],
          actions: []
        }),
        new PlanStep({
          id: 'b',
          name: 'Step B',
          type: 'setup',
          dependencies: ['a'],
          actions: []
        }),
        new PlanStep({
          id: 'c',
          name: 'Step C',
          type: 'implementation',
          dependencies: ['a'],
          actions: []
        }),
        new PlanStep({
          id: 'd',
          name: 'Step D',
          type: 'testing',
          dependencies: ['b', 'c'],
          actions: []
        })
      ];

      const order = validator.generateExecutionOrder(complexSteps);
      
      expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
      expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
      expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'));
      expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty dependency arrays', async () => {
      const stepWithEmptyDeps = new PlanStep({
        id: 'step-1',
        name: 'Step with empty dependencies',
        type: 'setup',
        dependencies: [],
        actions: []
      });

      const planWithEmptyDeps = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithEmptyDeps]
      });

      const result = await validator.validate(planWithEmptyDeps);
      
      expect(result.errors).toHaveLength(0);
    });

    test('should handle steps with undefined dependencies', async () => {
      const stepWithUndefinedDeps = new PlanStep({
        id: 'step-1',
        name: 'Step with undefined dependencies',
        type: 'setup',
        // dependencies is undefined
        actions: []
      });

      const planWithUndefinedDeps = new Plan({
        ...validPlan.toJSON(),
        steps: [stepWithUndefinedDeps]
      });

      const result = await validator.validate(planWithUndefinedDeps);
      
      expect(result.errors).toHaveLength(0);
    });

    test('should handle single step plans', async () => {
      const singleStepPlan = new Plan({
        name: 'Single Step Plan',
        description: 'Plan with only one step',
        steps: [
          new PlanStep({
            id: 'only-step',
            name: 'Only step',
            type: 'setup',
            dependencies: [],
            actions: []
          })
        ]
      });

      const result = await validator.validate(singleStepPlan);
      
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.some(w => w.type === 'orphaned_steps')).toBe(true);
    });

    test('should handle plans with duplicate step IDs gracefully', async () => {
      const stepsWithDuplicateIds = [
        new PlanStep({
          id: 'duplicate-id',
          name: 'First step',
          type: 'setup',
          dependencies: [],
          actions: []
        }),
        new PlanStep({
          id: 'duplicate-id', // Same ID
          name: 'Second step',
          type: 'implementation',
          dependencies: ['duplicate-id'], // Self-reference due to duplicate
          actions: []
        })
      ];

      const planWithDuplicates = new Plan({
        ...validPlan.toJSON(),
        steps: stepsWithDuplicateIds
      });

      const result = await validator.validate(planWithDuplicates);
      
      // Should handle gracefully, may detect as self-dependency
      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should handle large dependency graphs efficiently', async () => {
      // Create a large but valid dependency graph
      const largeSteps = [];
      
      // Create 50 steps with linear dependencies
      for (let i = 0; i < 50; i++) {
        largeSteps.push(new PlanStep({
          id: `step-${i}`,
          name: `Step ${i}`,
          type: 'implementation',
          dependencies: i > 0 ? [`step-${i-1}`] : [],
          actions: []
        }));
      }

      const largePlan = new Plan({
        ...validPlan.toJSON(),
        steps: largeSteps
      });

      const startTime = Date.now();
      const result = await validator.validate(largePlan);
      const endTime = Date.now();
      
      // Should complete within reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(result).toBeDefined();
    });
  });
});
