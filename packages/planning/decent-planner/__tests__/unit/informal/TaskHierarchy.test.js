/**
 * Unit tests for TaskHierarchy structure
 */

// Test functions are provided by the test runner as globals
import { TaskHierarchy } from '../../../src/core/informal/types/TaskHierarchy.js';
import { TaskNode } from '../../../src/core/informal/types/TaskNode.js';

describe('TaskHierarchy', () => {
  describe('constructor', () => {
    it('should create hierarchy with root node', () => {
      const root = new TaskNode({
        description: 'Build REST API',
        complexity: 'COMPLEX'
      });

      const hierarchy = new TaskHierarchy(root);
      expect(hierarchy.root).toBe(root);
      expect(hierarchy.getNodeCount()).toBe(1);
    });

    it('should throw error if root is not provided', () => {
      expect(() => {
        new TaskHierarchy();
      }).toThrow('Root node is required');
    });

    it('should throw error if root is not a TaskNode', () => {
      expect(() => {
        new TaskHierarchy({ description: 'Not a TaskNode' });
      }).toThrow('Root must be a TaskNode instance');
    });
  });

  describe('tree operations', () => {
    it('should traverse all nodes in hierarchy', () => {
      const root = new TaskNode({
        description: 'Root',
        complexity: 'COMPLEX'
      });

      const child1 = new TaskNode({
        description: 'Child 1',
        complexity: 'SIMPLE'
      });

      const child2 = new TaskNode({
        description: 'Child 2',
        complexity: 'COMPLEX'
      });

      const grandchild = new TaskNode({
        description: 'Grandchild',
        complexity: 'SIMPLE'
      });

      root.addSubtask(child1);
      root.addSubtask(child2);
      child2.addSubtask(grandchild);

      const hierarchy = new TaskHierarchy(root);
      const allNodes = hierarchy.getAllNodes();

      expect(allNodes).toHaveLength(4);
      expect(allNodes.map(n => n.description)).toContain('Root');
      expect(allNodes.map(n => n.description)).toContain('Child 1');
      expect(allNodes.map(n => n.description)).toContain('Child 2');
      expect(allNodes.map(n => n.description)).toContain('Grandchild');
    });

    it('should get all SIMPLE tasks', () => {
      const root = new TaskNode({
        description: 'Root',
        complexity: 'COMPLEX'
      });

      const simple1 = new TaskNode({
        description: 'Simple 1',
        complexity: 'SIMPLE'
      });

      const complex = new TaskNode({
        description: 'Complex',
        complexity: 'COMPLEX'
      });

      const simple2 = new TaskNode({
        description: 'Simple 2',
        complexity: 'SIMPLE'
      });

      root.addSubtask(simple1);
      root.addSubtask(complex);
      complex.addSubtask(simple2);

      const hierarchy = new TaskHierarchy(root);
      const simpleTasks = hierarchy.getSimpleTasks();

      expect(simpleTasks).toHaveLength(2);
      expect(simpleTasks.map(n => n.description)).toContain('Simple 1');
      expect(simpleTasks.map(n => n.description)).toContain('Simple 2');
    });

    it('should get all COMPLEX tasks', () => {
      const root = new TaskNode({
        description: 'Root',
        complexity: 'COMPLEX'
      });

      const simple = new TaskNode({
        description: 'Simple',
        complexity: 'SIMPLE'
      });

      const complex = new TaskNode({
        description: 'Complex',
        complexity: 'COMPLEX'
      });

      root.addSubtask(simple);
      root.addSubtask(complex);

      const hierarchy = new TaskHierarchy(root);
      const complexTasks = hierarchy.getComplexTasks();

      expect(complexTasks).toHaveLength(2);
      expect(complexTasks.map(n => n.description)).toContain('Root');
      expect(complexTasks.map(n => n.description)).toContain('Complex');
    });

    it('should calculate maximum depth', () => {
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
        complexity: 'COMPLEX'
      });

      const level3 = new TaskNode({
        description: 'Level 3',
        complexity: 'SIMPLE'
      });

      root.addSubtask(level1);
      level1.addSubtask(level2);
      level2.addSubtask(level3);

      const hierarchy = new TaskHierarchy(root);
      expect(hierarchy.getMaxDepth()).toBe(3);
    });

    it('should calculate depth of single node', () => {
      const root = new TaskNode({
        description: 'Root',
        complexity: 'SIMPLE'
      });

      const hierarchy = new TaskHierarchy(root);
      expect(hierarchy.getMaxDepth()).toBe(0);
    });

    it('should find node by ID', () => {
      const root = new TaskNode({
        id: 'root-id',
        description: 'Root',
        complexity: 'COMPLEX'
      });

      const child = new TaskNode({
        id: 'child-id',
        description: 'Child',
        complexity: 'SIMPLE'
      });

      root.addSubtask(child);

      const hierarchy = new TaskHierarchy(root);
      
      expect(hierarchy.findNodeById('root-id')).toBe(root);
      expect(hierarchy.findNodeById('child-id')).toBe(child);
      expect(hierarchy.findNodeById('non-existent')).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should calculate hierarchy statistics', () => {
      const root = new TaskNode({
        description: 'Root',
        complexity: 'COMPLEX'
      });

      const complex1 = new TaskNode({
        description: 'Complex 1',
        complexity: 'COMPLEX'
      });

      const simple1 = new TaskNode({
        description: 'Simple 1',
        complexity: 'SIMPLE',
        feasible: true
      });

      const simple2 = new TaskNode({
        description: 'Simple 2',
        complexity: 'SIMPLE',
        feasible: false
      });

      const simple3 = new TaskNode({
        description: 'Simple 3',
        complexity: 'SIMPLE',
        feasible: true
      });

      root.addSubtask(complex1);
      root.addSubtask(simple1);
      complex1.addSubtask(simple2);
      complex1.addSubtask(simple3);

      const hierarchy = new TaskHierarchy(root);
      const stats = hierarchy.getStatistics();

      expect(stats.totalTasks).toBe(5);
      expect(stats.simpleTasks).toBe(3);
      expect(stats.complexTasks).toBe(2);
      expect(stats.maxDepth).toBe(2);
      expect(stats.feasibleTasks).toBe(2);
      expect(stats.infeasibleTasks).toBe(1);
    });
  });

  describe('validation', () => {
    it('should check if all simple tasks are feasible', () => {
      const root = new TaskNode({
        description: 'Root',
        complexity: 'COMPLEX'
      });

      const feasible = new TaskNode({
        description: 'Feasible',
        complexity: 'SIMPLE',
        feasible: true
      });

      const infeasible = new TaskNode({
        description: 'Infeasible',
        complexity: 'SIMPLE',
        feasible: false
      });

      root.addSubtask(feasible);
      root.addSubtask(infeasible);

      const hierarchy = new TaskHierarchy(root);
      expect(hierarchy.allSimpleTasksFeasible()).toBe(false);
    });

    it('should return true when all simple tasks are feasible', () => {
      const root = new TaskNode({
        description: 'Root',
        complexity: 'COMPLEX'
      });

      const feasible1 = new TaskNode({
        description: 'Feasible 1',
        complexity: 'SIMPLE',
        feasible: true
      });

      const feasible2 = new TaskNode({
        description: 'Feasible 2',
        complexity: 'SIMPLE',
        feasible: true
      });

      root.addSubtask(feasible1);
      root.addSubtask(feasible2);

      const hierarchy = new TaskHierarchy(root);
      expect(hierarchy.allSimpleTasksFeasible()).toBe(true);
    });

    it('should get infeasible tasks', () => {
      const root = new TaskNode({
        description: 'Root',
        complexity: 'COMPLEX'
      });

      const feasible = new TaskNode({
        description: 'Feasible',
        complexity: 'SIMPLE',
        feasible: true
      });

      const infeasible1 = new TaskNode({
        description: 'Infeasible 1',
        complexity: 'SIMPLE',
        feasible: false
      });

      const infeasible2 = new TaskNode({
        description: 'Infeasible 2',
        complexity: 'SIMPLE',
        feasible: false
      });

      root.addSubtask(feasible);
      root.addSubtask(infeasible1);
      root.addSubtask(infeasible2);

      const hierarchy = new TaskHierarchy(root);
      const infeasibleTasks = hierarchy.getInfeasibleTasks();

      expect(infeasibleTasks).toHaveLength(2);
      expect(infeasibleTasks.map(t => t.description)).toContain('Infeasible 1');
      expect(infeasibleTasks.map(t => t.description)).toContain('Infeasible 2');
    });
  });

  describe('serialization', () => {
    it('should convert hierarchy to object', () => {
      const root = new TaskNode({
        id: 'root',
        description: 'Root',
        complexity: 'COMPLEX'
      });

      const child = new TaskNode({
        id: 'child',
        description: 'Child',
        complexity: 'SIMPLE',
        feasible: true
      });

      root.addSubtask(child);

      const hierarchy = new TaskHierarchy(root);
      const obj = hierarchy.toObject();

      expect(obj.id).toBe('root');
      expect(obj.description).toBe('Root');
      expect(obj.complexity).toBe('COMPLEX');
      expect(obj.subtasks).toHaveLength(1);
      expect(obj.subtasks[0].id).toBe('child');
    });
  });
});