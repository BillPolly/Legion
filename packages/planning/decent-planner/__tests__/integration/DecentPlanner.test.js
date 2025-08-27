/**
 * Integration tests for DecentPlanner
 * Following TDD principles - using real components, no mocks
 */

// Test functions are provided by the test runner as globals
import { DecentPlanner } from '../../src/DecentPlanner.js';
import { ResourceManager } from '@legion/resource-manager';
import { TaskComplexity } from '../../src/domain/value-objects/TaskComplexity.js';
import { PlanStatus } from '../../src/domain/value-objects/PlanStatus.js';

describe('DecentPlanner Integration Tests', () => {
  let planner;
  let resourceManager;

  beforeAll(async () => {
    // Use real ResourceManager and real LLM client
    resourceManager = await ResourceManager.getInstance();
    
    const llmClient = await resourceManager.get('llmClient');
    
    if (!llmClient) {
      throw new Error('LLM client required for integration tests');
    }

    // Create planner with real dependencies
    planner = new DecentPlanner({
      maxDepth: 3,
      confidenceThreshold: 0.7,
      enableFormalPlanning: true
    });
    
    await planner.initialize();
  });

  describe('Simple Task Planning', () => {
    it('should successfully plan a simple task without decomposition', async () => {
      const goal = 'Write "Hello World" to a file';
      const context = {
        domain: 'file_operations',
        inputs: ['content'],
        outputs: ['file_path']
      };

      const result = await planner.plan(goal, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.goal).toBe(goal);
      expect(result.data.status.value).toBe(PlanStatus.VALIDATED);
      
      // Check task hierarchy
      const rootTask = result.data.rootTask;
      expect(rootTask).toBeDefined();
      expect(rootTask.description).toBe(goal);
      expect(rootTask.complexity.isSimple()).toBe(true);
      
      // Check tool discovery
      expect(rootTask.feasible).toBeDefined();
      if (rootTask.feasible) {
        expect(rootTask.tools.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Complex Task Decomposition', () => {
    it('should decompose a complex task into subtasks', async () => {
      const goal = 'Build a simple REST API with user authentication';
      const context = {
        domain: 'web_development'
      };

      const result = await planner.plan(goal, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      const rootTask = result.data.rootTask;
      expect(rootTask.complexity.isComplex()).toBe(true);
      expect(rootTask.subtasks.length).toBeGreaterThan(0);
      
      // Verify all subtasks are properly classified
      rootTask.subtasks.forEach(subtask => {
        expect(subtask.complexity).toBeDefined();
        expect(subtask.complexity.value).toMatch(/^(SIMPLE|COMPLEX)$/);
      });
      
      // Check statistics
      const stats = result.data.statistics;
      expect(stats).toBeDefined();
      expect(stats.totalTasks).toBeGreaterThan(1);
      expect(stats.simpleTasks).toBeGreaterThan(0);
    });
  });

  describe('Tool Discovery', () => {
    it('should discover tools for feasible tasks', async () => {
      const goal = 'Read a JSON file and parse its contents';
      
      const result = await planner.plan(goal);

      expect(result.success).toBe(true);
      
      const rootTask = result.data.rootTask;
      
      // For a simple task, check direct tool assignment
      if (rootTask.isSimple()) {
        expect(rootTask.feasible).toBeDefined();
        if (rootTask.feasible) {
          expect(rootTask.tools).toBeDefined();
          expect(rootTask.tools.length).toBeGreaterThan(0);
          
          // Verify tool structure
          rootTask.tools.forEach(tool => {
            expect(tool.name).toBeDefined();
            expect(tool.confidence).toBeDefined();
            expect(tool.confidence).toBeGreaterThanOrEqual(0.7);
          });
        }
      }
    });
  });

  describe('Behavior Tree Generation', () => {
    it('should generate behavior trees for feasible simple tasks', async () => {
      const goal = 'Create a new directory and write a README file in it';
      
      const result = await planner.plan(goal);

      expect(result.success).toBe(true);
      
      // Check if behavior trees were generated
      if (result.data.behaviorTrees) {
        expect(Array.isArray(result.data.behaviorTrees)).toBe(true);
        
        result.data.behaviorTrees.forEach(bt => {
          expect(bt.id).toBeDefined();
          expect(bt.taskDescription).toBeDefined();
        });
      }
    });
  });

  describe('Cancellation Support', () => {
    it('should support cancelling a planning operation', async () => {
      const goal = 'Build a complete e-commerce platform with payment processing';
      
      // Start planning in background
      const planPromise = planner.plan(goal);
      
      // Cancel after a short delay
      setTimeout(() => {
        planner.cancel();
      }, 100);
      
      // Should fail with cancellation error
      const result = await planPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });
  });

  describe('Validation', () => {
    it('should validate the plan structure and completeness', async () => {
      const goal = 'Set up a database with user and product tables';
      
      const result = await planner.plan(goal);

      expect(result.success).toBe(true);
      
      // Check validation was performed
      const validation = result.data.validation;
      if (validation) {
        expect(validation.structure).toBeDefined();
        expect(validation.structure.valid).toBeDefined();
        expect(validation.completeness).toBeDefined();
        expect(validation.overall).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', async () => {
      const result = await planner.plan('');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Goal is required');
    });

    it('should handle null goal gracefully', async () => {
      const result = await planner.plan(null);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Report Generation', () => {
    it('should generate a human-readable report', async () => {
      const goal = 'Write a function to calculate factorial';
      
      const result = await planner.plan(goal);
      expect(result.success).toBe(true);
      
      const report = planner.generateReport(result.data);
      
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report).toContain('DECENT Planning Report');
      expect(report).toContain(goal);
      expect(report).toContain('Status:');
    });
  });

  describe('Configuration', () => {
    it('should respect configuration options', async () => {
      const customPlanner = new DecentPlanner({
        maxDepth: 2,
        confidenceThreshold: 0.9,
        enableFormalPlanning: false,
        logLevel: 'error'
      });
      
      await customPlanner.initialize();
      
      const goal = 'Build a complex multi-tier application';
      const result = await customPlanner.plan(goal);
      
      expect(result.success).toBe(true);
      
      // Check that formal planning was skipped
      expect(result.data.behaviorTrees).toBeUndefined();
      
      // Check max depth was respected
      const checkDepth = (task, currentDepth = 0) => {
        expect(currentDepth).toBeLessThanOrEqual(2);
        task.subtasks.forEach(subtask => {
          checkDepth(subtask, currentDepth + 1);
        });
      };
      checkDepth(result.data.rootTask);
    });
  });

  describe('Informal Planning Only', () => {
    it('should support informal-only planning', async () => {
      const goal = 'Create a machine learning model for image classification';
      
      const result = await planner.planInformalOnly(goal);
      
      expect(result.success).toBe(true);
      expect(result.data.rootTask).toBeDefined();
      expect(result.data.behaviorTrees).toBeUndefined();
    });
  });
});