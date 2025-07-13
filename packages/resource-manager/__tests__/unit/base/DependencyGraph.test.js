import { jest } from '@jest/globals';
import DependencyGraph from '../../../src/base/DependencyGraph.js';

describe('DependencyGraph', () => {
  let graph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('constructor', () => {
    it('should initialize with empty structures', () => {
      expect(graph.dependencies).toBeInstanceOf(Map);
      expect(graph.dependents).toBeInstanceOf(Map);
      expect(graph.nodes).toBeInstanceOf(Set);
      expect(graph.dependencies.size).toBe(0);
      expect(graph.dependents.size).toBe(0);
      expect(graph.nodes.size).toBe(0);
    });
  });

  describe('addResource', () => {
    it('should add a resource without dependencies', () => {
      graph.addResource('app');
      expect(graph.nodes.has('app')).toBe(true);
      expect(graph.dependencies.has('app')).toBe(true);
      expect(graph.dependencies.get('app').size).toBe(0);
    });

    it('should add a resource with dependencies', () => {
      graph.addResource('app', ['db', 'cache']);
      expect(graph.nodes.has('app')).toBe(true);
      expect(graph.nodes.has('db')).toBe(true);
      expect(graph.nodes.has('cache')).toBe(true);
      expect(graph.getDependencies('app')).toEqual(['db', 'cache']);
    });

    it('should throw error for invalid resource name', () => {
      expect(() => graph.addResource(null)).toThrow('Resource name must be a non-empty string');
      expect(() => graph.addResource('')).toThrow('Resource name must be a non-empty string');
      expect(() => graph.addResource(123)).toThrow('Resource name must be a non-empty string');
    });

    it('should handle adding same resource multiple times', () => {
      graph.addResource('app', ['db']);
      graph.addResource('app', ['cache']);
      const deps = graph.getDependencies('app');
      expect(deps).toContain('db');
      expect(deps).toContain('cache');
    });
  });

  describe('addDependency', () => {
    it('should add a dependency relationship', () => {
      graph.addDependency('app', 'db');
      expect(graph.getDependencies('app')).toEqual(['db']);
      expect(graph.getDependents('db')).toEqual(['app']);
    });

    it('should throw error for self-dependency', () => {
      expect(() => graph.addDependency('app', 'app')).toThrow("Resource 'app' cannot depend on itself");
    });

    it('should throw error for missing resource names', () => {
      expect(() => graph.addDependency(null, 'db')).toThrow('Both resource and dependency names are required');
      expect(() => graph.addDependency('app', null)).toThrow('Both resource and dependency names are required');
    });

    it('should detect and prevent circular dependencies', () => {
      graph.addDependency('app', 'db');
      graph.addDependency('db', 'cache');
      expect(() => graph.addDependency('cache', 'app')).toThrow('would create a circular dependency');
    });

    it('should allow adding same dependency multiple times', () => {
      graph.addDependency('app', 'db');
      graph.addDependency('app', 'db');
      expect(graph.getDependencies('app')).toEqual(['db']);
    });
  });

  describe('removeDependency', () => {
    beforeEach(() => {
      graph.addResource('app', ['db', 'cache']);
    });

    it('should remove an existing dependency', () => {
      graph.removeDependency('app', 'db');
      expect(graph.getDependencies('app')).toEqual(['cache']);
      expect(graph.getDependents('db')).toEqual([]);
    });

    it('should handle removing non-existent dependency', () => {
      graph.removeDependency('app', 'nonexistent');
      expect(graph.getDependencies('app')).toEqual(['db', 'cache']);
    });

    it('should handle removing from non-existent resource', () => {
      expect(() => graph.removeDependency('nonexistent', 'db')).not.toThrow();
    });
  });

  describe('removeResource', () => {
    beforeEach(() => {
      graph.addResource('db');
      graph.addResource('cache');
      graph.addResource('app', ['db', 'cache']);
      graph.addResource('api', ['app']);
    });

    it('should remove resource and all its relationships', () => {
      graph.removeResource('app');
      expect(graph.nodes.has('app')).toBe(false);
      expect(graph.getDependents('db')).toEqual([]);
      expect(graph.getDependents('cache')).toEqual([]);
      expect(graph.getDependencies('api')).toEqual([]);
    });

    it('should handle removing non-existent resource', () => {
      expect(() => graph.removeResource('nonexistent')).not.toThrow();
    });
  });

  describe('getDependencies and getDependents', () => {
    beforeEach(() => {
      graph.addResource('db');
      graph.addResource('app', ['db']);
      graph.addResource('api', ['app', 'db']);
    });

    it('should return correct dependencies', () => {
      expect(graph.getDependencies('db')).toEqual([]);
      expect(graph.getDependencies('app')).toEqual(['db']);
      expect(graph.getDependencies('api').sort()).toEqual(['app', 'db']);
    });

    it('should return correct dependents', () => {
      expect(graph.getDependents('db').sort()).toEqual(['api', 'app']);
      expect(graph.getDependents('app')).toEqual(['api']);
      expect(graph.getDependents('api')).toEqual([]);
    });

    it('should return empty array for non-existent resource', () => {
      expect(graph.getDependencies('nonexistent')).toEqual([]);
      expect(graph.getDependents('nonexistent')).toEqual([]);
    });
  });

  describe('getStartupDependencies', () => {
    beforeEach(() => {
      graph.addResource('db');
      graph.addResource('cache');
      graph.addResource('app', ['db', 'cache']);
      graph.addResource('api', ['app']);
    });

    it('should return all transitive dependencies', () => {
      const deps = graph.getStartupDependencies('api');
      expect(deps).toContain('db');
      expect(deps).toContain('cache');
      expect(deps).toContain('app');
      expect(deps).not.toContain('api');
    });

    it('should return empty array for resource with no dependencies', () => {
      expect(graph.getStartupDependencies('db')).toEqual([]);
    });

    it('should handle non-existent resource', () => {
      expect(graph.getStartupDependencies('nonexistent')).toEqual([]);
    });
  });

  describe('topologicalSort', () => {
    it('should return correct startup order', () => {
      graph.addResource('db');
      graph.addResource('cache');
      graph.addResource('app', ['db', 'cache']);
      graph.addResource('api', ['app']);
      
      const order = graph.topologicalSort();
      expect(order.indexOf('db')).toBeLessThan(order.indexOf('app'));
      expect(order.indexOf('cache')).toBeLessThan(order.indexOf('app'));
      expect(order.indexOf('app')).toBeLessThan(order.indexOf('api'));
    });

    it('should handle independent resources', () => {
      graph.addResource('service1');
      graph.addResource('service2');
      graph.addResource('service3');
      
      const order = graph.topologicalSort();
      expect(order).toHaveLength(3);
      expect(order).toContain('service1');
      expect(order).toContain('service2');
      expect(order).toContain('service3');
    });

    it('should throw error for circular dependencies', () => {
      // We need to build the circular dependency manually since addResource prevents it
      graph.addResource('a');
      graph.addResource('b');
      graph.addResource('c');
      
      // Initialize dependents sets if they don't exist
      if (!graph.dependents.has('a')) graph.dependents.set('a', new Set());
      if (!graph.dependents.has('b')) graph.dependents.set('b', new Set());
      if (!graph.dependents.has('c')) graph.dependents.set('c', new Set());
      
      // Manually add dependencies to create a cycle
      graph.dependencies.get('a').add('b');
      graph.dependents.get('b').add('a');
      graph.dependencies.get('b').add('c');
      graph.dependents.get('c').add('b');
      graph.dependencies.get('c').add('a');
      graph.dependents.get('a').add('c');
      
      expect(() => graph.topologicalSort()).toThrow('Circular dependency detected');
    });

    it('should handle empty graph', () => {
      expect(graph.topologicalSort()).toEqual([]);
    });
  });

  describe('getStartupOrder and getShutdownOrder', () => {
    beforeEach(() => {
      graph.addResource('db');
      graph.addResource('app', ['db']);
      graph.addResource('api', ['app']);
    });

    it('should return startup order', () => {
      const order = graph.getStartupOrder();
      expect(order.indexOf('db')).toBeLessThan(order.indexOf('app'));
      expect(order.indexOf('app')).toBeLessThan(order.indexOf('api'));
    });

    it('should return shutdown order as reverse of startup', () => {
      const startup = graph.getStartupOrder();
      const shutdown = graph.getShutdownOrder();
      expect(shutdown).toEqual([...startup].reverse());
    });
  });

  describe('hasCircularDependencies', () => {
    it('should return false for acyclic graph', () => {
      graph.addResource('db');
      graph.addResource('app', ['db']);
      expect(graph.hasCircularDependencies()).toBe(false);
    });

    it('should return true for cyclic graph', () => {
      // Build circular dependency manually
      graph.addResource('a');
      graph.addResource('b');
      graph.addResource('c');
      
      // Initialize dependents sets if they don't exist
      if (!graph.dependents.has('a')) graph.dependents.set('a', new Set());
      if (!graph.dependents.has('b')) graph.dependents.set('b', new Set());
      if (!graph.dependents.has('c')) graph.dependents.set('c', new Set());
      
      graph.dependencies.get('a').add('b');
      graph.dependents.get('b').add('a');
      graph.dependencies.get('b').add('c');
      graph.dependents.get('c').add('b');
      graph.dependencies.get('c').add('a');
      graph.dependents.get('a').add('c');
      
      expect(graph.hasCircularDependencies()).toBe(true);
    });

    it('should return false for empty graph', () => {
      expect(graph.hasCircularDependencies()).toBe(false);
    });
  });

  describe('findCircularDependencies', () => {
    it('should find simple cycle', () => {
      // Build circular dependency manually
      graph.addResource('a');
      graph.addResource('b');
      graph.addResource('c');
      
      // Initialize dependents sets if they don't exist
      if (!graph.dependents.has('a')) graph.dependents.set('a', new Set());
      if (!graph.dependents.has('b')) graph.dependents.set('b', new Set());
      if (!graph.dependents.has('c')) graph.dependents.set('c', new Set());
      
      graph.dependencies.get('a').add('b');
      graph.dependents.get('b').add('a');
      graph.dependencies.get('b').add('c');
      graph.dependents.get('c').add('b');
      graph.dependencies.get('c').add('a');
      graph.dependents.get('a').add('c');
      
      const cycles = graph.findCircularDependencies();
      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toEqual(['a', 'b', 'c', 'a']);
    });

    it('should find multiple cycles', () => {
      // Build two separate cycles manually
      graph.addResource('a');
      graph.addResource('b');
      graph.addResource('c');
      graph.addResource('d');
      
      // Initialize dependents sets if they don't exist
      if (!graph.dependents.has('a')) graph.dependents.set('a', new Set());
      if (!graph.dependents.has('b')) graph.dependents.set('b', new Set());
      if (!graph.dependents.has('c')) graph.dependents.set('c', new Set());
      if (!graph.dependents.has('d')) graph.dependents.set('d', new Set());
      
      // First cycle: a -> b -> a
      graph.dependencies.get('a').add('b');
      graph.dependents.get('b').add('a');
      graph.dependencies.get('b').add('a');
      graph.dependents.get('a').add('b');
      
      // Second cycle: c -> d -> c
      graph.dependencies.get('c').add('d');
      graph.dependents.get('d').add('c');
      graph.dependencies.get('d').add('c');
      graph.dependents.get('c').add('d');
      
      const cycles = graph.findCircularDependencies();
      expect(cycles).toHaveLength(2);
    });

    it('should return empty array for acyclic graph', () => {
      graph.addResource('db');
      graph.addResource('app', ['db']);
      expect(graph.findCircularDependencies()).toEqual([]);
    });
  });

  describe('getRootResources and getLeafResources', () => {
    beforeEach(() => {
      graph.addResource('db');
      graph.addResource('cache');
      graph.addResource('app', ['db', 'cache']);
      graph.addResource('api', ['app']);
    });

    it('should identify root resources', () => {
      const roots = graph.getRootResources();
      expect(roots.sort()).toEqual(['cache', 'db']);
    });

    it('should identify leaf resources', () => {
      const leaves = graph.getLeafResources();
      expect(leaves).toEqual(['api']);
    });

    it('should handle isolated nodes', () => {
      graph.addResource('isolated');
      const roots = graph.getRootResources();
      const leaves = graph.getLeafResources();
      expect(roots).toContain('isolated');
      expect(leaves).toContain('isolated');
    });
  });

  describe('dependsOn', () => {
    beforeEach(() => {
      graph.addResource('db');
      graph.addResource('cache');
      graph.addResource('app', ['db', 'cache']);
      graph.addResource('api', ['app']);
    });

    it('should detect direct dependencies', () => {
      expect(graph.dependsOn('app', 'db')).toBe(true);
      expect(graph.dependsOn('app', 'cache')).toBe(true);
    });

    it('should detect transitive dependencies', () => {
      expect(graph.dependsOn('api', 'db')).toBe(true);
      expect(graph.dependsOn('api', 'cache')).toBe(true);
    });

    it('should return false for non-dependencies', () => {
      expect(graph.dependsOn('db', 'app')).toBe(false);
      expect(graph.dependsOn('cache', 'api')).toBe(false);
    });

    it('should return false for self-dependency', () => {
      expect(graph.dependsOn('app', 'app')).toBe(false);
    });

    it('should handle non-existent resources', () => {
      expect(graph.dependsOn('nonexistent', 'db')).toBe(false);
      expect(graph.dependsOn('app', 'nonexistent')).toBe(false);
    });
  });

  describe('toDOT', () => {
    it('should generate valid DOT format', () => {
      graph.addResource('db');
      graph.addResource('app', ['db']);
      
      const dot = graph.toDOT();
      expect(dot).toContain('digraph Dependencies');
      expect(dot).toContain('"db"');
      expect(dot).toContain('"app"');
      expect(dot).toContain('"db" -> "app"');
    });

    it('should handle empty graph', () => {
      const dot = graph.toDOT();
      expect(dot).toContain('digraph Dependencies');
      expect(dot).not.toContain('->');
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', () => {
      graph.addResource('db');
      graph.addResource('cache');
      graph.addResource('app', ['db', 'cache']);
      graph.addResource('api', ['app']);
      
      const stats = graph.getStatistics();
      expect(stats).toMatchObject({
        nodeCount: 4,
        dependencyCount: 3,
        maxDependenciesPerNode: 2,
        rootCount: 2,
        leafCount: 1,
        hasCircularDependencies: false
      });
      expect(stats.roots.sort()).toEqual(['cache', 'db']);
      expect(stats.leaves).toEqual(['api']);
    });

    it('should handle empty graph', () => {
      const stats = graph.getStatistics();
      expect(stats).toMatchObject({
        nodeCount: 0,
        dependencyCount: 0,
        maxDependenciesPerNode: 0,
        rootCount: 0,
        leafCount: 0,
        hasCircularDependencies: false
      });
    });
  });

  describe('clear', () => {
    it('should remove all data', () => {
      graph.addResource('db');
      graph.addResource('app', ['db']);
      
      graph.clear();
      
      expect(graph.nodes.size).toBe(0);
      expect(graph.dependencies.size).toBe(0);
      expect(graph.dependents.size).toBe(0);
    });
  });

  describe('clone', () => {
    it('should create identical copy', () => {
      graph.addResource('db');
      graph.addResource('cache');
      graph.addResource('app', ['db', 'cache']);
      
      const clone = graph.clone();
      
      expect(clone.nodes.size).toBe(graph.nodes.size);
      expect(clone.getDependencies('app').sort()).toEqual(graph.getDependencies('app').sort());
      expect(clone.getStartupOrder()).toEqual(graph.getStartupOrder());
    });

    it('should create independent copy', () => {
      graph.addResource('db');
      const clone = graph.clone();
      
      clone.addResource('cache');
      expect(graph.nodes.has('cache')).toBe(false);
      expect(clone.nodes.has('cache')).toBe(true);
    });

    it('should handle empty graph', () => {
      const clone = graph.clone();
      expect(clone.nodes.size).toBe(0);
    });
  });
});