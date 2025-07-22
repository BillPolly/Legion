/**
 * Tests for Dependency Resolution System
 * 
 * Tests handle dependency tracking, execution order optimization,
 * parallel execution detection, and circular dependency detection
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { DependencyResolver } from '../../../src/planning/DependencyResolver.js';
import { AiurPlan } from '../../../src/planning/AiurPlan.js';
import { HandleRegistry } from '../../../src/handles/HandleRegistry.js';

describe('DependencyResolver', () => {
  let plan;
  let handleRegistry;
  let dependencyResolver;

  beforeEach(() => {
    handleRegistry = new HandleRegistry();
  });

  describe('Basic Dependency Resolution', () => {
    test('should create dependency resolver with plan', () => {
      const mockPlan = new AiurPlan({
        id: 'test-plan',
        title: 'Test Plan',
        steps: [
          { id: 'dummy', action: 'noop' }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(mockPlan);
      
      expect(dependencyResolver.plan).toBe(mockPlan);
      expect(dependencyResolver.getDependencyGraph()).toBeDefined();
    });

    test('should analyze linear dependencies', () => {
      plan = new AiurPlan({
        id: 'linear-plan',
        title: 'Linear Dependencies',
        steps: [
          { id: 'step1', action: 'init' },
          { id: 'step2', action: 'process', dependsOn: ['step1'] },
          { id: 'step3', action: 'finalize', dependsOn: ['step2'] }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      const analysis = dependencyResolver.analyzeDependencies();
      
      expect(analysis.isLinear).toBe(true);
      expect(analysis.hasParallelOpportunities).toBe(false);
      expect(analysis.dependencyDepth).toBe(3);
      expect(analysis.criticalPath).toEqual(['step1', 'step2', 'step3']);
    });

    test('should analyze parallel dependencies', () => {
      plan = new AiurPlan({
        id: 'parallel-plan',
        title: 'Parallel Dependencies',
        steps: [
          { id: 'init', action: 'init' },
          { id: 'process1', action: 'process', dependsOn: ['init'] },
          { id: 'process2', action: 'process', dependsOn: ['init'] },
          { id: 'merge', action: 'merge', dependsOn: ['process1', 'process2'] }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      const analysis = dependencyResolver.analyzeDependencies();
      
      expect(analysis.isLinear).toBe(false);
      expect(analysis.hasParallelOpportunities).toBe(true);
      expect(analysis.parallelGroups).toHaveLength(3);
      expect(analysis.parallelGroups[1]).toContain('process1');
      expect(analysis.parallelGroups[1]).toContain('process2');
    });

    test('should detect independent steps', () => {
      plan = new AiurPlan({
        id: 'independent-plan',
        title: 'Independent Steps',
        steps: [
          { id: 'task1', action: 'task' },
          { id: 'task2', action: 'task' },
          { id: 'task3', action: 'task' }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      const independent = dependencyResolver.getIndependentSteps();
      
      expect(independent).toHaveLength(3);
      expect(independent).toContain('task1');
      expect(independent).toContain('task2');
      expect(independent).toContain('task3');
    });
  });

  describe('Handle Dependencies', () => {
    test('should track handle creation dependencies', () => {
      plan = new AiurPlan({
        id: 'handle-deps',
        title: 'Handle Dependencies',
        steps: [
          { 
            id: 'creator',
            action: 'create',
            expectedOutputs: ['dataHandle']
          },
          { 
            id: 'consumer',
            action: 'process',
            parameters: { data: '@dataHandle' }
          }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      const handleDeps = dependencyResolver.getHandleDependencies();
      
      expect(handleDeps.producers['dataHandle']).toBe('creator');
      expect(handleDeps.consumers['dataHandle']).toContain('consumer');
      expect(handleDeps.implicitDependencies['consumer']).toContain('creator');
    });

    test('should resolve transitive handle dependencies', () => {
      plan = new AiurPlan({
        id: 'transitive-deps',
        title: 'Transitive Dependencies',
        steps: [
          { 
            id: 'step1',
            action: 'create',
            expectedOutputs: ['handle1']
          },
          { 
            id: 'step2',
            action: 'transform',
            parameters: { input: '@handle1' },
            expectedOutputs: ['handle2']
          },
          { 
            id: 'step3',
            action: 'finalize',
            parameters: { data: '@handle2' }
          }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      const deps = dependencyResolver.getTransitiveDependencies('step3');
      
      expect(deps).toContain('step1');
      expect(deps).toContain('step2');
      expect(deps).toHaveLength(2);
    });

    test('should handle multiple handle consumers', () => {
      plan = new AiurPlan({
        id: 'multi-consumer',
        title: 'Multiple Consumers',
        steps: [
          { 
            id: 'producer',
            action: 'create',
            expectedOutputs: ['sharedHandle']
          },
          { 
            id: 'consumer1',
            action: 'process',
            parameters: { data: '@sharedHandle' }
          },
          { 
            id: 'consumer2',
            action: 'analyze',
            parameters: { input: '@sharedHandle' }
          }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      const handleDeps = dependencyResolver.getHandleDependencies();
      
      expect(handleDeps.consumers['sharedHandle']).toHaveLength(2);
      expect(handleDeps.consumers['sharedHandle']).toContain('consumer1');
      expect(handleDeps.consumers['sharedHandle']).toContain('consumer2');
    });
  });

  describe('Execution Order Optimization', () => {
    test('should generate optimal execution order', () => {
      plan = new AiurPlan({
        id: 'execution-order',
        title: 'Execution Order',
        steps: [
          { id: 'c', action: 'task', dependsOn: ['a', 'b'] },
          { id: 'a', action: 'task' },
          { id: 'b', action: 'task', dependsOn: ['a'] },
          { id: 'd', action: 'task', dependsOn: ['c'] }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      const order = dependencyResolver.getOptimalExecutionOrder();
      
      expect(order).toEqual(['a', 'b', 'c', 'd']);
      expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
      expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
      expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
    });

    test('should prioritize critical path', () => {
      plan = new AiurPlan({
        id: 'critical-path',
        title: 'Critical Path',
        steps: [
          { id: 'start', action: 'init' },
          { id: 'long1', action: 'process', dependsOn: ['start'], weight: 10 },
          { id: 'long2', action: 'process', dependsOn: ['long1'], weight: 10 },
          { id: 'short', action: 'process', dependsOn: ['start'], weight: 1 },
          { id: 'end', action: 'finalize', dependsOn: ['long2', 'short'] }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      const criticalPath = dependencyResolver.getCriticalPath();
      
      expect(criticalPath).toEqual(['start', 'long1', 'long2', 'end']);
      expect(criticalPath).not.toContain('short');
    });

    test('should optimize for parallel execution', () => {
      plan = new AiurPlan({
        id: 'parallel-optimization',
        title: 'Parallel Optimization',
        steps: [
          { id: 'init', action: 'init' },
          { id: 'a1', action: 'task', dependsOn: ['init'] },
          { id: 'a2', action: 'task', dependsOn: ['a1'] },
          { id: 'b1', action: 'task', dependsOn: ['init'] },
          { id: 'b2', action: 'task', dependsOn: ['b1'] },
          { id: 'merge', action: 'merge', dependsOn: ['a2', 'b2'] }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      const parallelPlan = dependencyResolver.getParallelExecutionPlan();
      
      expect(parallelPlan.stages).toHaveLength(4);
      expect(parallelPlan.stages[0]).toEqual(['init']);
      expect(parallelPlan.stages[1]).toContain('a1');
      expect(parallelPlan.stages[1]).toContain('b1');
      expect(parallelPlan.maxParallelism).toBe(2);
    });
  });

  describe('Circular Dependency Detection', () => {
    test('should detect simple circular dependency', () => {
      plan = new AiurPlan({
        id: 'circular-simple',
        title: 'Simple Circular',
        steps: [
          { id: 'a', action: 'task', dependsOn: ['b'] },
          { id: 'b', action: 'task', dependsOn: ['a'] }
        ]
      }, handleRegistry, { validateOnCreate: false });
      
      dependencyResolver = new DependencyResolver(plan);
      const validation = dependencyResolver.validateDependencies();
      
      expect(validation.valid).toBe(false);
      expect(validation.hasCircularDependencies).toBe(true);
      expect(validation.circularChains).toHaveLength(1);
      expect(validation.circularChains[0]).toContain('a');
      expect(validation.circularChains[0]).toContain('b');
    });

    test('should detect complex circular dependency', () => {
      plan = new AiurPlan({
        id: 'circular-complex',
        title: 'Complex Circular',
        steps: [
          { id: 'a', action: 'task', dependsOn: ['c'] },
          { id: 'b', action: 'task', dependsOn: ['a'] },
          { id: 'c', action: 'task', dependsOn: ['b'] },
          { id: 'd', action: 'task', dependsOn: ['a'] }
        ]
      }, handleRegistry, { validateOnCreate: false });
      
      dependencyResolver = new DependencyResolver(plan);
      const validation = dependencyResolver.validateDependencies();
      
      expect(validation.valid).toBe(false);
      expect(validation.hasCircularDependencies).toBe(true);
      expect(validation.circularChains[0]).toContain('a');
      expect(validation.circularChains[0]).toContain('b');
      expect(validation.circularChains[0]).toContain('c');
    });

    test('should handle self-dependency', () => {
      plan = new AiurPlan({
        id: 'self-dependency',
        title: 'Self Dependency',
        steps: [
          { id: 'self', action: 'task', dependsOn: ['self'] }
        ]
      }, handleRegistry, { validateOnCreate: false });
      
      dependencyResolver = new DependencyResolver(plan);
      const validation = dependencyResolver.validateDependencies();
      
      expect(validation.valid).toBe(false);
      expect(validation.hasCircularDependencies).toBe(true);
      expect(validation.errors).toContain('Step self depends on itself');
    });

    test('should validate missing dependencies', () => {
      plan = new AiurPlan({
        id: 'missing-deps',
        title: 'Missing Dependencies',
        steps: [
          { id: 'step1', action: 'task', dependsOn: ['nonexistent'] }
        ]
      }, handleRegistry, { validateOnCreate: false });
      
      dependencyResolver = new DependencyResolver(plan);
      const validation = dependencyResolver.validateDependencies();
      
      expect(validation.valid).toBe(false);
      expect(validation.missingDependencies).toHaveLength(1);
      expect(validation.missingDependencies[0]).toMatchObject({
        step: 'step1',
        missing: 'nonexistent'
      });
    });
  });

  describe('Dependency Visualization', () => {
    test('should generate dependency graph', () => {
      plan = new AiurPlan({
        id: 'graph-plan',
        title: 'Graph Plan',
        steps: [
          { id: 'a', action: 'task' },
          { id: 'b', action: 'task', dependsOn: ['a'] },
          { id: 'c', action: 'task', dependsOn: ['a'] },
          { id: 'd', action: 'task', dependsOn: ['b', 'c'] }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      const graph = dependencyResolver.getDependencyGraph();
      
      expect(graph.nodes).toHaveLength(4);
      expect(graph.edges).toHaveLength(4);
      expect(graph.edges).toContainEqual({ from: 'a', to: 'b' });
      expect(graph.edges).toContainEqual({ from: 'a', to: 'c' });
      expect(graph.edges).toContainEqual({ from: 'b', to: 'd' });
      expect(graph.edges).toContainEqual({ from: 'c', to: 'd' });
    });

    test('should calculate dependency metrics', () => {
      plan = new AiurPlan({
        id: 'metrics-plan',
        title: 'Metrics Plan',
        steps: [
          { id: 'hub', action: 'init' },
          { id: 'spoke1', action: 'task', dependsOn: ['hub'] },
          { id: 'spoke2', action: 'task', dependsOn: ['hub'] },
          { id: 'spoke3', action: 'task', dependsOn: ['hub'] },
          { id: 'end', action: 'finalize', dependsOn: ['spoke1', 'spoke2', 'spoke3'] }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      const metrics = dependencyResolver.getDependencyMetrics();
      
      expect(metrics.totalSteps).toBe(5);
      expect(metrics.totalDependencies).toBe(6);
      expect(metrics.averageDependencies).toBe(1.2);
      expect(metrics.maxInDegree).toMatchObject({ step: 'end', count: 3 });
      expect(metrics.maxOutDegree).toMatchObject({ step: 'hub', count: 3 });
      expect(metrics.dependencyDensity).toBeCloseTo(0.6, 1);
    });
  });

  describe('Dynamic Dependency Resolution', () => {
    test('should update dependencies when plan changes', () => {
      plan = new AiurPlan({
        id: 'dynamic-plan',
        title: 'Dynamic Plan',
        steps: [
          { id: 'a', action: 'task' },
          { id: 'b', action: 'task', dependsOn: ['a'] }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      
      // Add new step
      plan.addStep({
        id: 'c',
        action: 'task',
        dependsOn: ['b']
      });
      
      dependencyResolver.updateDependencies();
      const order = dependencyResolver.getOptimalExecutionOrder();
      
      expect(order).toEqual(['a', 'b', 'c']);
    });

    test('should handle dynamic handle dependencies', () => {
      plan = new AiurPlan({
        id: 'dynamic-handles',
        title: 'Dynamic Handles',
        steps: [
          { 
            id: 'step1',
            action: 'create',
            expectedOutputs: ['handle1']
          }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      
      // Add step that uses the handle
      plan.addStep({
        id: 'step2',
        action: 'process',
        parameters: { data: '@handle1' }
      });
      
      dependencyResolver.updateDependencies();
      const handleDeps = dependencyResolver.getHandleDependencies();
      
      expect(handleDeps.consumers['handle1']).toContain('step2');
      expect(handleDeps.implicitDependencies['step2']).toContain('step1');
    });
  });

  describe('Dependency Tools Integration', () => {
    test('should provide dependency analysis tool', () => {
      plan = new AiurPlan({
        id: 'tool-plan',
        title: 'Tool Plan',
        steps: [
          { id: 'step1', action: 'task' }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      const tools = dependencyResolver.getDependencyTools();
      
      expect(tools).toHaveProperty('analyze_dependencies');
      expect(tools).toHaveProperty('optimize_execution');
      expect(tools).toHaveProperty('validate_dependencies');
      expect(tools).toHaveProperty('get_parallel_plan');
    });

    test('should execute dependency analysis tool', async () => {
      plan = new AiurPlan({
        id: 'analysis-tool',
        title: 'Analysis Tool',
        steps: [
          { id: 'a', action: 'task' },
          { id: 'b', action: 'task', dependsOn: ['a'] }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      const analyzeTool = dependencyResolver.getDependencyTools().analyze_dependencies;
      
      const result = await analyzeTool.execute({ planId: plan.id });
      
      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis.isLinear).toBe(true);
      expect(result.analysis.dependencyDepth).toBe(2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty plan', () => {
      plan = new AiurPlan({
        id: 'empty-plan',
        title: 'Empty Plan',
        steps: [
          { id: 'dummy', action: 'noop' }
        ]
      }, handleRegistry);
      
      // Remove the dummy step to test empty plan
      plan.steps = [];
      
      dependencyResolver = new DependencyResolver(plan);
      const order = dependencyResolver.getOptimalExecutionOrder();
      
      expect(order).toEqual([]);
    });

    test('should handle complex dependency scenarios', () => {
      plan = new AiurPlan({
        id: 'complex-plan',
        title: 'Complex Plan',
        steps: [
          { id: 'root', action: 'init' },
          { id: 'a1', action: 'task', dependsOn: ['root'] },
          { id: 'a2', action: 'task', dependsOn: ['a1'] },
          { id: 'b1', action: 'task', dependsOn: ['root'] },
          { id: 'b2', action: 'task', dependsOn: ['b1'] },
          { id: 'c1', action: 'task', dependsOn: ['root'] },
          { id: 'merge1', action: 'merge', dependsOn: ['a2', 'b2'] },
          { id: 'merge2', action: 'merge', dependsOn: ['merge1', 'c1'] },
          { id: 'final', action: 'finalize', dependsOn: ['merge2'] }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      const analysis = dependencyResolver.analyzeDependencies();
      
      expect(analysis.hasParallelOpportunities).toBe(true);
      expect(analysis.parallelGroups.length).toBeGreaterThan(3);
      expect(analysis.criticalPath).toContain('root');
      expect(analysis.criticalPath).toContain('final');
    });

    test('should handle dependency removal', () => {
      plan = new AiurPlan({
        id: 'removal-plan',
        title: 'Removal Plan',
        steps: [
          { id: 'a', action: 'task' },
          { id: 'b', action: 'task', dependsOn: ['a'] },
          { id: 'c', action: 'task', dependsOn: ['b'] }
        ]
      }, handleRegistry);
      
      dependencyResolver = new DependencyResolver(plan);
      
      // Remove dependency
      plan.steps[2].dependsOn = [];
      dependencyResolver.updateDependencies();
      
      const independent = dependencyResolver.getIndependentSteps();
      expect(independent).toContain('a');
      expect(independent).toContain('c');
      expect(independent).not.toContain('b');
    });
  });
});