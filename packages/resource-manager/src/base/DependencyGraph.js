/**
 * Dependency graph for managing resource startup/shutdown order
 * Provides topological sorting and circular dependency detection
 */
class DependencyGraph {
  constructor() {
    this.dependencies = new Map(); // resource -> Set of dependencies
    this.dependents = new Map();   // resource -> Set of dependents
    this.nodes = new Set();        // All known resources
  }

  /**
   * Add a resource to the graph
   * @param {string} resource - Resource name
   * @param {string[]} dependencies - Array of dependency names
   */
  addResource(resource, dependencies = []) {
    if (!resource || typeof resource !== 'string') {
      throw new Error('Resource name must be a non-empty string');
    }

    this.nodes.add(resource);
    
    // Initialize dependencies set
    if (!this.dependencies.has(resource)) {
      this.dependencies.set(resource, new Set());
    }
    
    // Add dependencies
    for (const dep of dependencies) {
      this.addDependency(resource, dep);
    }
  }

  /**
   * Add a dependency relationship
   * @param {string} resource - Resource that depends on something
   * @param {string} dependency - Resource that is depended upon
   */
  addDependency(resource, dependency) {
    if (!resource || !dependency) {
      throw new Error('Both resource and dependency names are required');
    }

    if (resource === dependency) {
      throw new Error(`Resource '${resource}' cannot depend on itself`);
    }

    // Add both resources to the graph
    this.nodes.add(resource);
    this.nodes.add(dependency);

    // Initialize sets if needed
    if (!this.dependencies.has(resource)) {
      this.dependencies.set(resource, new Set());
    }
    if (!this.dependents.has(dependency)) {
      this.dependents.set(dependency, new Set());
    }

    // Add the dependency
    this.dependencies.get(resource).add(dependency);
    this.dependents.get(dependency).add(resource);

    // Check for circular dependencies
    if (this.hasCircularDependencies()) {
      // Remove the dependency we just added
      this.dependencies.get(resource).delete(dependency);
      this.dependents.get(dependency).delete(resource);
      throw new Error(`Adding dependency '${dependency}' to '${resource}' would create a circular dependency`);
    }
  }

  /**
   * Remove a dependency relationship
   * @param {string} resource - Resource name
   * @param {string} dependency - Dependency to remove
   */
  removeDependency(resource, dependency) {
    if (this.dependencies.has(resource)) {
      this.dependencies.get(resource).delete(dependency);
    }
    
    if (this.dependents.has(dependency)) {
      this.dependents.get(dependency).delete(resource);
    }
  }

  /**
   * Remove a resource from the graph completely
   * @param {string} resource - Resource to remove
   */
  removeResource(resource) {
    // Remove from nodes
    this.nodes.delete(resource);

    // Remove all dependencies of this resource
    if (this.dependencies.has(resource)) {
      for (const dep of this.dependencies.get(resource)) {
        if (this.dependents.has(dep)) {
          this.dependents.get(dep).delete(resource);
        }
      }
      this.dependencies.delete(resource);
    }

    // Remove this resource as a dependency of others
    if (this.dependents.has(resource)) {
      for (const dependent of this.dependents.get(resource)) {
        if (this.dependencies.has(dependent)) {
          this.dependencies.get(dependent).delete(resource);
        }
      }
      this.dependents.delete(resource);
    }
  }

  /**
   * Get direct dependencies of a resource
   * @param {string} resource - Resource name
   * @returns {string[]} Array of dependency names
   */
  getDependencies(resource) {
    const deps = this.dependencies.get(resource);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Get direct dependents of a resource
   * @param {string} resource - Resource name
   * @returns {string[]} Array of dependent names
   */
  getDependents(resource) {
    const deps = this.dependents.get(resource);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Get all resources that must start before the given resource
   * @param {string} resource - Resource name
   * @returns {string[]} Array of resources in startup order
   */
  getStartupDependencies(resource) {
    const visited = new Set();
    const result = [];

    const visit = (node) => {
      if (visited.has(node)) return;
      visited.add(node);

      const deps = this.getDependencies(node);
      for (const dep of deps) {
        visit(dep);
      }
      
      if (node !== resource) {
        result.push(node);
      }
    };

    visit(resource);
    return result;
  }

  /**
   * Get startup order for all resources using topological sort
   * @returns {string[]} Array of resources in startup order
   */
  getStartupOrder() {
    return this.topologicalSort();
  }

  /**
   * Get shutdown order (reverse of startup order)
   * @returns {string[]} Array of resources in shutdown order
   */
  getShutdownOrder() {
    return this.getStartupOrder().reverse();
  }

  /**
   * Perform topological sort of the dependency graph
   * @returns {string[]} Topologically sorted resource names
   */
  topologicalSort() {
    const visited = new Set();
    const visiting = new Set(); // For cycle detection
    const result = [];

    const visit = (node) => {
      if (visiting.has(node)) {
        throw new Error(`Circular dependency detected involving '${node}'`);
      }
      
      if (visited.has(node)) {
        return;
      }

      visiting.add(node);
      visited.add(node);

      // Visit all dependencies first
      const deps = this.getDependencies(node);
      for (const dep of deps) {
        visit(dep);
      }

      visiting.delete(node);
      result.push(node);
    };

    // Visit all nodes
    for (const node of this.nodes) {
      if (!visited.has(node)) {
        visit(node);
      }
    }

    return result;
  }

  /**
   * Check if the graph has circular dependencies
   * @returns {boolean} True if circular dependencies exist
   */
  hasCircularDependencies() {
    try {
      this.topologicalSort();
      return false;
    } catch (error) {
      return error.message.includes('Circular dependency');
    }
  }

  /**
   * Find circular dependencies in the graph
   * @returns {string[][]} Array of dependency cycles
   */
  findCircularDependencies() {
    const visited = new Set();
    const visiting = new Set();
    const cycles = [];

    const visit = (node, path = []) => {
      if (visiting.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        if (cycleStart >= 0) {
          cycles.push([...path.slice(cycleStart), node]);
        }
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visiting.add(node);
      const newPath = [...path, node];

      const deps = this.getDependencies(node);
      for (const dep of deps) {
        visit(dep, newPath);
      }

      visiting.delete(node);
      visited.add(node);
    };

    for (const node of this.nodes) {
      if (!visited.has(node)) {
        visit(node);
      }
    }

    return cycles;
  }

  /**
   * Get all resources with no dependencies (can start immediately)
   * @returns {string[]} Array of resources with no dependencies
   */
  getRootResources() {
    const roots = [];
    for (const node of this.nodes) {
      const deps = this.getDependencies(node);
      if (deps.length === 0) {
        roots.push(node);
      }
    }
    return roots;
  }

  /**
   * Get all resources with no dependents (can stop last)
   * @returns {string[]} Array of resources with no dependents
   */
  getLeafResources() {
    const leaves = [];
    for (const node of this.nodes) {
      const deps = this.getDependents(node);
      if (deps.length === 0) {
        leaves.push(node);
      }
    }
    return leaves;
  }

  /**
   * Check if resource A depends on resource B (directly or indirectly)
   * @param {string} resourceA - Resource that might depend
   * @param {string} resourceB - Resource that might be depended upon
   * @returns {boolean} True if A depends on B
   */
  dependsOn(resourceA, resourceB) {
    if (resourceA === resourceB) return false;
    
    const visited = new Set();
    const toVisit = [resourceA];

    while (toVisit.length > 0) {
      const current = toVisit.pop();
      if (visited.has(current)) continue;
      visited.add(current);

      const deps = this.getDependencies(current);
      if (deps.includes(resourceB)) {
        return true;
      }

      toVisit.push(...deps);
    }

    return false;
  }

  /**
   * Get a visual representation of the dependency graph
   * @returns {string} DOT format graph representation
   */
  toDOT() {
    let dot = 'digraph Dependencies {\n';
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box];\n\n';

    // Add nodes
    for (const node of this.nodes) {
      dot += `  "${node}";\n`;
    }

    dot += '\n';

    // Add edges
    for (const [resource, deps] of this.dependencies) {
      for (const dep of deps) {
        dot += `  "${dep}" -> "${resource}";\n`;
      }
    }

    dot += '}\n';
    return dot;
  }

  /**
   * Get summary statistics about the graph
   * @returns {Object} Graph statistics
   */
  getStatistics() {
    const roots = this.getRootResources();
    const leaves = this.getLeafResources();
    
    let totalDependencies = 0;
    let maxDependencies = 0;
    
    for (const deps of this.dependencies.values()) {
      totalDependencies += deps.size;
      maxDependencies = Math.max(maxDependencies, deps.size);
    }

    return {
      nodeCount: this.nodes.size,
      dependencyCount: totalDependencies,
      maxDependenciesPerNode: maxDependencies,
      rootCount: roots.length,
      leafCount: leaves.length,
      hasCircularDependencies: this.hasCircularDependencies(),
      roots,
      leaves
    };
  }

  /**
   * Clear all dependencies and nodes
   */
  clear() {
    this.dependencies.clear();
    this.dependents.clear();
    this.nodes.clear();
  }

  /**
   * Clone the dependency graph
   * @returns {DependencyGraph} New graph with same dependencies
   */
  clone() {
    const clone = new DependencyGraph();
    
    for (const node of this.nodes) {
      const deps = this.getDependencies(node);
      clone.addResource(node, deps);
    }
    
    return clone;
  }
}

export default DependencyGraph;