/**
 * Unit tests for DecompositionValidator
 */

// Test functions are provided by the test runner as globals
import { DecompositionValidator } from '../../../src/core/informal/DecompositionValidator.js';
import { TaskNode } from '../../../src/core/informal/types/TaskNode.js';
import { TaskHierarchy } from '../../../src/core/informal/types/TaskHierarchy.js';

describe('DecompositionValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new DecompositionValidator();
  });

  describe('structure validation', () => {
    it('should validate well-formed hierarchy', () => {
      const root = new TaskNode({
        description: 'Build system',
        complexity: 'COMPLEX'
      });

      const subtask1 = new TaskNode({
        description: 'Setup database',
        complexity: 'SIMPLE'
      });

      const subtask2 = new TaskNode({
        description: 'Create API',
        complexity: 'SIMPLE'
      });

      root.addSubtask(subtask1);
      root.addSubtask(subtask2);

      const result = validator.validateStructure(root);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect COMPLEX leaf nodes', () => {
      const root = new TaskNode({
        description: 'Build system',
        complexity: 'COMPLEX'
      });

      // COMPLEX task with no subtasks - invalid!
      const complexLeaf = new TaskNode({
        description: 'Build subsystem',
        complexity: 'COMPLEX'
      });

      root.addSubtask(complexLeaf);

      const result = validator.validateStructure(root);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        type: 'COMPLEX_LEAF',
        task: 'Build subsystem',
        message: 'COMPLEX task has no subtasks'
      });
    });

    it('should allow SIMPLE leaf nodes', () => {
      const root = new TaskNode({
        description: 'Simple task',
        complexity: 'SIMPLE'
      });

      const result = validator.validateStructure(root);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing complexity', () => {
      const root = new TaskNode({
        description: 'Task without complexity',
        complexity: 'COMPLEX'
      });

      // Manually create invalid node
      const invalidTask = {
        description: 'Invalid task',
        // Missing complexity
        subtasks: []
      };

      root.subtasks.push(invalidTask);

      const result = validator.validateStructure(root);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        type: 'MISSING_COMPLEXITY',
        task: 'Invalid task',
        message: 'Task missing complexity classification'
      });
    });

    it('should validate deep hierarchies', () => {
      const root = new TaskNode({
        description: 'Level 0',
        complexity: 'COMPLEX'
      });

      const level1 = new TaskNode({
        description: 'Level 1',
        complexity: 'COMPLEX'
      });

      const level2 = new TaskNode({
        description: 'Level 2',
        complexity: 'SIMPLE'
      });

      root.addSubtask(level1);
      level1.addSubtask(level2);

      const result = validator.validateStructure(root);

      expect(result.valid).toBe(true);
    });
  });

  describe('dependency validation', () => {
    it('should validate I/O connections between tasks', () => {
      const root = new TaskNode({
        description: 'Process data',
        complexity: 'COMPLEX'
      });

      const task1 = new TaskNode({
        description: 'Load data',
        complexity: 'SIMPLE',
        suggestedOutputs: ['data_array']
      });

      const task2 = new TaskNode({
        description: 'Transform data',
        complexity: 'SIMPLE',
        suggestedInputs: ['data_array'],
        suggestedOutputs: ['transformed_data']
      });

      root.addSubtask(task1);
      root.addSubtask(task2);

      const result = validator.validateDependencies(root);

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('should detect unmet dependencies', () => {
      const root = new TaskNode({
        description: 'Process data',
        complexity: 'COMPLEX'
      });

      const task1 = new TaskNode({
        description: 'Transform data',
        complexity: 'SIMPLE',
        suggestedInputs: ['raw_data'],  // Requires raw_data
        suggestedOutputs: ['processed_data']
      });

      const task2 = new TaskNode({
        description: 'Save results',
        complexity: 'SIMPLE',
        suggestedInputs: ['processed_data', 'config'],  // Requires config
        suggestedOutputs: ['output_file']
      });

      root.addSubtask(task1);
      root.addSubtask(task2);

      const result = validator.validateDependencies(root);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        type: 'UNMET_DEPENDENCY',
        task: 'Transform data',
        dependency: 'raw_data',
        message: 'Input dependency not satisfied by previous tasks'
      });
    });

    it('should track outputs across sibling tasks', () => {
      const root = new TaskNode({
        description: 'Pipeline',
        complexity: 'COMPLEX'
      });

      const producer = new TaskNode({
        description: 'Generate data',
        complexity: 'SIMPLE',
        suggestedOutputs: ['dataset']
      });

      const consumer = new TaskNode({
        description: 'Process data',
        complexity: 'SIMPLE',
        suggestedInputs: ['dataset']
      });

      root.addSubtask(producer);
      root.addSubtask(consumer);

      const result = validator.validateDependencies(root);

      expect(result.valid).toBe(true);
    });

    it('should handle optional dependencies gracefully', () => {
      const root = new TaskNode({
        description: 'Task with optional inputs',
        complexity: 'COMPLEX'
      });

      const task = new TaskNode({
        description: 'Flexible task',
        complexity: 'SIMPLE',
        suggestedInputs: ['optional_config'],
        suggestedOutputs: ['result']
      });

      root.addSubtask(task);

      const result = validator.validateDependencies(root, {
        strictDependencies: false
      });

      // With non-strict mode, missing optional dependencies are warnings, not errors
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('completeness validation', () => {
    it('should verify all COMPLEX tasks are decomposed', () => {
      const root = new TaskNode({
        description: 'Build app',
        complexity: 'COMPLEX'
      });

      const subtask1 = new TaskNode({
        description: 'Setup',
        complexity: 'SIMPLE'
      });

      const subtask2 = new TaskNode({
        description: 'Build features',
        complexity: 'COMPLEX'
      });

      const feature1 = new TaskNode({
        description: 'Feature A',
        complexity: 'SIMPLE'
      });

      root.addSubtask(subtask1);
      root.addSubtask(subtask2);
      subtask2.addSubtask(feature1);

      const result = validator.validateCompleteness(root);

      expect(result.valid).toBe(true);
      expect(result.stats.totalTasks).toBe(4);
      expect(result.stats.complexTasks).toBe(2);
      expect(result.stats.simpleTasks).toBe(2);
      expect(result.stats.fullyDecomposed).toBe(true);
    });

    it('should detect incomplete decomposition', () => {
      const root = new TaskNode({
        description: 'Build app',
        complexity: 'COMPLEX'
      });

      const complexChild = new TaskNode({
        description: 'Build component',
        complexity: 'COMPLEX'
        // No subtasks - incomplete!
      });

      root.addSubtask(complexChild);

      const result = validator.validateCompleteness(root);

      expect(result.valid).toBe(false);
      expect(result.stats.fullyDecomposed).toBe(false);
      expect(result.issues).toContainEqual({
        type: 'INCOMPLETE_DECOMPOSITION',
        task: 'Build component',
        message: 'COMPLEX task not decomposed into subtasks'
      });
    });

    it('should check minimum subtask requirements', () => {
      const root = new TaskNode({
        description: 'Complex task',
        complexity: 'COMPLEX'
      });

      // Only one subtask - might be too few
      const onlyChild = new TaskNode({
        description: 'Single subtask',
        complexity: 'SIMPLE'
      });

      root.addSubtask(onlyChild);

      const result = validator.validateCompleteness(root, {
        minSubtasks: 2
      });

      expect(result.warnings).toContainEqual({
        type: 'TOO_FEW_SUBTASKS',
        task: 'Complex task',
        count: 1,
        minimum: 2,
        message: 'COMPLEX task has fewer subtasks than recommended'
      });
    });

    it('should check maximum depth', () => {
      // Create very deep hierarchy
      let current = new TaskNode({
        description: 'Root',
        complexity: 'COMPLEX'
      });

      const root = current;

      for (let i = 1; i <= 10; i++) {
        const next = new TaskNode({
          description: `Level ${i}`,
          complexity: i < 10 ? 'COMPLEX' : 'SIMPLE'
        });
        current.addSubtask(next);
        current = next;
      }

      const result = validator.validateCompleteness(root, {
        maxDepth: 5
      });

      expect(result.warnings).toContainEqual({
        type: 'EXCESSIVE_DEPTH',
        depth: 10,
        maximum: 5,
        message: 'Hierarchy exceeds recommended maximum depth'
      });
    });
  });

  describe('feasibility aggregation', () => {
    it('should aggregate feasibility from leaf tasks', () => {
      const root = new TaskNode({
        description: 'Build feature',
        complexity: 'COMPLEX'
      });

      const feasibleTask = new TaskNode({
        description: 'Task 1',
        complexity: 'SIMPLE',
        feasible: true,
        tools: [{ name: 'tool1', confidence: 0.9 }]
      });

      const anotherFeasibleTask = new TaskNode({
        description: 'Task 2',
        complexity: 'SIMPLE',
        feasible: true,
        tools: [{ name: 'tool2', confidence: 0.85 }]
      });

      root.addSubtask(feasibleTask);
      root.addSubtask(anotherFeasibleTask);

      const result = validator.aggregateFeasibility(root);

      expect(result.overallFeasible).toBe(true);
      expect(result.feasibleCount).toBe(2);
      expect(result.infeasibleCount).toBe(0);
    });

    it('should detect infeasible hierarchies', () => {
      const root = new TaskNode({
        description: 'Build feature',
        complexity: 'COMPLEX'
      });

      const feasibleTask = new TaskNode({
        description: 'Task 1',
        complexity: 'SIMPLE',
        feasible: true,
        tools: [{ name: 'tool1', confidence: 0.9 }]
      });

      const infeasibleTask = new TaskNode({
        description: 'Task 2',
        complexity: 'SIMPLE',
        feasible: false,
        tools: []
      });

      root.addSubtask(feasibleTask);
      root.addSubtask(infeasibleTask);

      const result = validator.aggregateFeasibility(root);

      expect(result.overallFeasible).toBe(false);
      expect(result.feasibleCount).toBe(1);
      expect(result.infeasibleCount).toBe(1);
      expect(result.infeasibleTasks).toContain('Task 2');
    });

    it('should handle mixed feasibility in deep hierarchies', () => {
      const root = new TaskNode({
        description: 'System',
        complexity: 'COMPLEX'
      });

      const subsystem = new TaskNode({
        description: 'Subsystem',
        complexity: 'COMPLEX'
      });

      const feasible1 = new TaskNode({
        description: 'Feasible 1',
        complexity: 'SIMPLE',
        feasible: true,
        tools: [{ name: 'tool1', confidence: 0.8 }]
      });

      const feasible2 = new TaskNode({
        description: 'Feasible 2',
        complexity: 'SIMPLE',
        feasible: true,
        tools: [{ name: 'tool2', confidence: 0.85 }]
      });

      const infeasible = new TaskNode({
        description: 'Infeasible task',
        complexity: 'SIMPLE',
        feasible: false
      });

      root.addSubtask(subsystem);
      root.addSubtask(infeasible);
      subsystem.addSubtask(feasible1);
      subsystem.addSubtask(feasible2);

      const result = validator.aggregateFeasibility(root);

      expect(result.overallFeasible).toBe(false);
      expect(result.feasibleCount).toBe(2);
      expect(result.infeasibleCount).toBe(1);
    });
  });

  describe('comprehensive validation', () => {
    it('should run all validations and combine results', () => {
      const root = new TaskNode({
        description: 'Complete system',
        complexity: 'COMPLEX'
      });

      const task1 = new TaskNode({
        description: 'Setup',
        complexity: 'SIMPLE',
        suggestedOutputs: ['config'],
        feasible: true,
        tools: [{ name: 'setup_tool', confidence: 0.9 }]
      });

      const task2 = new TaskNode({
        description: 'Process',
        complexity: 'SIMPLE',
        suggestedInputs: ['config'],
        feasible: true,
        tools: [{ name: 'process_tool', confidence: 0.85 }]
      });

      root.addSubtask(task1);
      root.addSubtask(task2);

      const result = validator.validate(root);

      expect(result.valid).toBe(true);
      expect(result.structure.valid).toBe(true);
      expect(result.dependencies.valid).toBe(true);
      expect(result.completeness.valid).toBe(true);
      expect(result.feasibility.overallFeasible).toBe(true);
    });

    it('should provide detailed validation report', () => {
      const root = new TaskNode({
        description: 'System',
        complexity: 'COMPLEX'
      });

      const invalidTask = new TaskNode({
        description: 'Problem task',
        complexity: 'COMPLEX'
        // No subtasks - will fail completeness
      });

      root.addSubtask(invalidTask);

      const result = validator.validate(root);
      const report = validator.generateReport(result);

      expect(result.valid).toBe(false);
      expect(report).toContain('Validation Report');
      expect(report).toContain('Structure');
      expect(report).toContain('Dependencies');
      expect(report).toContain('Completeness');
      expect(report).toContain('COMPLEX task has no subtasks');
    });
  });
});