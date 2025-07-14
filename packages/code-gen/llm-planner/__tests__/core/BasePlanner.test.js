/**
 * Tests for BasePlanner abstract class
 * 
 * BasePlanner provides the template method pattern for creating plans
 * and defines the abstract interface that concrete planners must implement.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BasePlanner } from '../../src/core/BasePlanner.js';
import { Plan } from '../../src/models/Plan.js';
import { PlanContext } from '../../src/models/PlanContext.js';

// Concrete implementation for testing
class TestPlanner extends BasePlanner {
  constructor(config = {}) {
    super(config);
  }

  async analyzeRequirements(requirements, context) {
    return {
      projectType: 'test',
      features: ['feature1', 'feature2'],
      complexity: 'medium'
    };
  }

  async generatePlanStructure(analysis, context) {
    return {
      steps: [
        {
          id: 'step1',
          name: 'Test Step 1',
          type: 'implementation',
          actions: []
        }
      ]
    };
  }

  async validatePlan(plan, context) {
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  async refinePlan(plan, validationResult, context) {
    return plan;
  }
}

describe('BasePlanner', () => {
  let planner;

  beforeEach(() => {
    planner = new TestPlanner();
  });

  describe('Constructor', () => {
    test('should create BasePlanner with default configuration', () => {
      expect(planner).toBeDefined();
      expect(planner.config).toBeDefined();
      expect(planner.config.maxIterations).toBe(3);
      expect(planner.config.autoRefine).toBe(true);
    });

    test('should accept custom configuration', () => {
      const customPlanner = new TestPlanner({
        maxIterations: 5,
        autoRefine: false,
        customOption: 'test'
      });

      expect(customPlanner.config.maxIterations).toBe(5);
      expect(customPlanner.config.autoRefine).toBe(false);
      expect(customPlanner.config.customOption).toBe('test');
    });

    test('should throw error when instantiating abstract BasePlanner directly', () => {
      expect(() => new BasePlanner()).toThrow('BasePlanner is an abstract class');
    });
  });

  describe('Template Method Pattern', () => {
    test('should execute createPlan template method', async () => {
      const requirements = {
        task: 'Create a test application',
        features: ['feature1', 'feature2']
      };

      const context = new PlanContext({
        projectType: 'test',
        technologies: { frontend: ['html', 'javascript'] }
      });

      const plan = await planner.createPlan(requirements, context);

      expect(plan).toBeInstanceOf(Plan);
      expect(plan.name).toBe('Create a test application');
      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].name).toBe('Test Step 1');
    });

    test('should call template methods in correct order', async () => {
      const spy = jest.spyOn(planner, 'analyzeRequirements');
      const spy2 = jest.spyOn(planner, 'generatePlanStructure');
      const spy3 = jest.spyOn(planner, 'validatePlan');
      const spy4 = jest.spyOn(planner, 'refinePlan');

      const requirements = { task: 'Test task' };
      const context = new PlanContext();

      await planner.createPlan(requirements, context);

      expect(spy).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
      expect(spy3).toHaveBeenCalled();
      // refinePlan should not be called since validation passes
      expect(spy4).not.toHaveBeenCalled();
    });

    test('should emit events during plan creation', async () => {
      const events = [];
      planner.on('analysis:start', () => events.push('analysis:start'));
      planner.on('analysis:complete', () => events.push('analysis:complete'));
      planner.on('generation:start', () => events.push('generation:start'));
      planner.on('generation:complete', () => events.push('generation:complete'));
      planner.on('validation:start', () => events.push('validation:start'));
      planner.on('validation:complete', () => events.push('validation:complete'));

      const requirements = { task: 'Test task' };
      const context = new PlanContext();

      await planner.createPlan(requirements, context);

      expect(events).toEqual([
        'analysis:start',
        'analysis:complete',
        'generation:start',
        'generation:complete',
        'validation:start',
        'validation:complete'
      ]);
    });

    test('should handle refinement iterations', async () => {
      class RefinementTestPlanner extends TestPlanner {
        constructor() {
          super();
          this.refinementCount = 0;
        }

        async validatePlan(plan, context) {
          this.refinementCount++;
          if (this.refinementCount < 2) {
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

        async refinePlan(plan, validationResult, context) {
          plan.metadata.refinements = (plan.metadata.refinements || 0) + 1;
          return plan;
        }
      }

      const refinementPlanner = new RefinementTestPlanner();
      const requirements = { task: 'Test task' };
      const context = new PlanContext();

      const plan = await refinementPlanner.createPlan(requirements, context);

      expect(plan.metadata.refinements).toBe(1);
      expect(refinementPlanner.refinementCount).toBe(2);
    });

    test('should respect max iterations limit', async () => {
      class FailingPlanner extends TestPlanner {
        async validatePlan(plan, context) {
          return {
            isValid: false,
            errors: ['Persistent error'],
            warnings: []
          };
        }
      }

      const failingPlanner = new FailingPlanner({ maxIterations: 2 });
      const requirements = { task: 'Test task' };
      const context = new PlanContext();

      await expect(failingPlanner.createPlan(requirements, context))
        .rejects.toThrow(/Maximum refinement iterations.*exceeded/);
    });

    test('should skip refinement when autoRefine is false', async () => {
      class NoRefinePlanner extends TestPlanner {
        async validatePlan(plan, context) {
          return {
            isValid: false,
            errors: ['Test error'],
            warnings: []
          };
        }
      }

      const noRefinePlanner = new NoRefinePlanner({ autoRefine: false, validateBeforeReturn: false });
      const refineSpy = jest.spyOn(noRefinePlanner, 'refinePlan');

      const requirements = { task: 'Test task' };
      const context = new PlanContext();

      const plan = await noRefinePlanner.createPlan(requirements, context);

      expect(refineSpy).not.toHaveBeenCalled();
      expect(plan).toBeDefined();
    });
  });

  describe('Abstract Method Interface', () => {
    test('should define abstract analyzeRequirements method', () => {
      expect(typeof planner.analyzeRequirements).toBe('function');
    });

    test('should define abstract generatePlanStructure method', () => {
      expect(typeof planner.generatePlanStructure).toBe('function');
    });

    test('should define abstract validatePlan method', () => {
      expect(typeof planner.validatePlan).toBe('function');
    });

    test('should define abstract refinePlan method', () => {
      expect(typeof planner.refinePlan).toBe('function');
    });

    test('should throw error for missing abstract method implementations', () => {
      class IncompleteTestPlanner extends BasePlanner {
        // Missing abstract method implementations
      }

      const incompletePlanner = new IncompleteTestPlanner();
      const requirements = { task: 'Test task' };
      const context = new PlanContext();

      expect(incompletePlanner.createPlan(requirements, context))
        .rejects.toThrow();
    });
  });

  describe('Context Handling', () => {
    test('should create default context if not provided', async () => {
      const requirements = { task: 'Test task' };

      const plan = await planner.createPlan(requirements);

      expect(plan).toBeDefined();
      expect(plan.context).toBeDefined();
    });

    test('should preserve provided context', async () => {
      const requirements = { task: 'Test task' };
      const context = new PlanContext({
        projectType: 'frontend',
        technologies: { frontend: ['react', 'typescript'] }
      });

      const plan = await planner.createPlan(requirements, context);

      expect(plan.context.projectType).toBe('frontend');
      expect(plan.context.technologies.frontend).toContain('react');
      expect(plan.context.technologies.frontend).toContain('typescript');
    });

    test('should update context during planning process', async () => {
      class ContextUpdatingPlanner extends TestPlanner {
        async analyzeRequirements(requirements, context) {
          context.addTechnology('backend', 'nodejs');
          return super.analyzeRequirements(requirements, context);
        }
      }

      const contextPlanner = new ContextUpdatingPlanner();
      const requirements = { task: 'Test task' };
      const context = new PlanContext();

      const plan = await contextPlanner.createPlan(requirements, context);

      expect(plan.context.technologies.backend).toContain('nodejs');
    });
  });

  describe('Error Handling', () => {
    test('should handle analysis errors gracefully', async () => {
      class FailingAnalysisPlanner extends TestPlanner {
        async analyzeRequirements(requirements, context) {
          throw new Error('Analysis failed');
        }
      }

      const failingPlanner = new FailingAnalysisPlanner();
      const requirements = { task: 'Test task' };
      const context = new PlanContext();

      await expect(failingPlanner.createPlan(requirements, context))
        .rejects.toThrow('Analysis failed');
    });

    test('should handle generation errors gracefully', async () => {
      class FailingGenerationPlanner extends TestPlanner {
        async generatePlanStructure(analysis, context) {
          throw new Error('Generation failed');
        }
      }

      const failingPlanner = new FailingGenerationPlanner();
      const requirements = { task: 'Test task' };
      const context = new PlanContext();

      await expect(failingPlanner.createPlan(requirements, context))
        .rejects.toThrow('Generation failed');
    });

    test('should validate input parameters', async () => {
      const requirements = null;
      const context = new PlanContext();

      await expect(planner.createPlan(requirements, context))
        .rejects.toThrow('Requirements must be provided');
    });

    test('should validate requirements structure', async () => {
      const requirements = { /* missing task */ };
      const context = new PlanContext();

      await expect(planner.createPlan(requirements, context))
        .rejects.toThrow('Requirements must include a task description');
    });
  });

  describe('Event System', () => {
    test('should emit analysis events', async () => {
      const analysisEvents = [];
      planner.on('analysis:start', (data) => analysisEvents.push({ event: 'start', data }));
      planner.on('analysis:complete', (data) => analysisEvents.push({ event: 'complete', data }));

      const requirements = { task: 'Test task' };
      const context = new PlanContext();

      await planner.createPlan(requirements, context);

      expect(analysisEvents).toHaveLength(2);
      expect(analysisEvents[0].event).toBe('start');
      expect(analysisEvents[1].event).toBe('complete');
      expect(analysisEvents[1].data.projectType).toBe('test');
    });

    test('should emit generation events', async () => {
      const generationEvents = [];
      planner.on('generation:start', (data) => generationEvents.push({ event: 'start', data }));
      planner.on('generation:complete', (data) => generationEvents.push({ event: 'complete', data }));

      const requirements = { task: 'Test task' };
      const context = new PlanContext();

      await planner.createPlan(requirements, context);

      expect(generationEvents).toHaveLength(2);
      expect(generationEvents[0].event).toBe('start');
      expect(generationEvents[1].event).toBe('complete');
    });

    test('should emit validation events', async () => {
      const validationEvents = [];
      planner.on('validation:start', () => validationEvents.push('start'));
      planner.on('validation:complete', (result) => validationEvents.push({ event: 'complete', result }));

      const requirements = { task: 'Test task' };
      const context = new PlanContext();

      await planner.createPlan(requirements, context);

      expect(validationEvents).toHaveLength(2);
      expect(validationEvents[0]).toBe('start');
      expect(validationEvents[1].result.isValid).toBe(true);
    });
  });

  describe('Metadata Management', () => {
    test('should track planning metadata', async () => {
      const requirements = { task: 'Test task' };
      const context = new PlanContext();

      const plan = await planner.createPlan(requirements, context);

      expect(plan.metadata).toBeDefined();
      expect(plan.metadata.createdAt).toBeDefined();
      expect(plan.metadata.planner).toBe('TestPlanner');
      expect(plan.metadata.version).toBeDefined();
    });

    test('should track refinement iterations', async () => {
      class IterationTrackingPlanner extends TestPlanner {
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

      const iterationPlanner = new IterationTrackingPlanner();
      const requirements = { task: 'Test task' };
      const context = new PlanContext();

      const plan = await iterationPlanner.createPlan(requirements, context);

      expect(plan.metadata.iterations).toBe(2);
    });
  });
});