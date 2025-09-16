/**
 * TopologicalSorter - Performs topological sorting on dependency graphs
 * Single responsibility: Sorting algorithms for DAGs
 */

export class TopologicalSorter {
  /**
   * Perform topological sort using Kahn's algorithm
   * @param {DependencyGraph} graph - Dependency graph
   * @returns {Array<string>} - Topologically sorted node IDs
   * @throws {Error} - If graph contains cycles
   */
  sort(graph) {
    const sorted = [];
    const inDegree = new Map();
    const queue = [];
    const nodes = graph.getAllNodes();
    
    // Initialize in-degrees
    for (const [nodeId, node] of nodes) {
      inDegree.set(nodeId, node.dependencies.size);
      if (node.dependencies.size === 0) {
        queue.push(nodeId);
      }
    }
    
    // Process nodes with no dependencies
    while (queue.length > 0) {
      const current = queue.shift();
      sorted.push(current);
      
      const dependents = graph.getDependents(current);
      for (const dependent of dependents) {
        const newInDegree = inDegree.get(dependent) - 1;
        inDegree.set(dependent, newInDegree);
        
        if (newInDegree === 0) {
          queue.push(dependent);
        }
      }
    }
    
    if (sorted.length !== nodes.size) {
      throw new Error('Graph contains cycles - cannot perform topological sort');
    }
    
    return sorted;
  }

  /**
   * Perform DFS-based topological sort
   * @param {DependencyGraph} graph - Dependency graph
   * @returns {Array<string>} - Topologically sorted node IDs
   */
  sortDFS(graph) {
    const visited = new Set();
    const stack = [];
    const nodes = graph.getAllNodes();
    
    const visit = (nodeId) => {
      if (visited.has(nodeId)) {
        return;
      }
      
      visited.add(nodeId);
      
      const dependencies = graph.getDependencies(nodeId);
      for (const depId of dependencies) {
        visit(depId);
      }
      
      stack.push(nodeId);
    };
    
    for (const nodeId of nodes.keys()) {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    }
    
    return stack;
  }

  /**
   * Get execution levels (parallel groups)
   * @param {DependencyGraph} graph - Dependency graph
   * @returns {Array<Array<string>>} - Levels of nodes that can execute in parallel
   */
  getLevels(graph) {
    const levels = [];
    const visited = new Set();
    const inDegree = new Map();
    const nodes = graph.getAllNodes();
    
    // Initialize in-degrees
    for (const [nodeId, node] of nodes) {
      inDegree.set(nodeId, node.dependencies.size);
    }
    
    while (visited.size < nodes.size) {
      const currentLevel = [];
      
      // Find all nodes with no unvisited dependencies
      for (const [nodeId, degree] of inDegree) {
        if (degree === 0 && !visited.has(nodeId)) {
          currentLevel.push(nodeId);
          visited.add(nodeId);
        }
      }
      
      if (currentLevel.length === 0) {
        // No progress possible - likely a cycle
        break;
      }
      
      // Update in-degrees for next level
      for (const nodeId of currentLevel) {
        const dependents = graph.getDependents(nodeId);
        for (const dependent of dependents) {
          inDegree.set(dependent, inDegree.get(dependent) - 1);
        }
      }
      
      levels.push(currentLevel);
    }
    
    return levels;
  }

  /**
   * Get reverse topological order
   * @param {DependencyGraph} graph - Dependency graph
   * @returns {Array<string>} - Reverse topologically sorted node IDs
   */
  reverseSort(graph) {
    return this.sort(graph).reverse();
  }

  /**
   * Check if ordering is valid topological sort
   * @param {DependencyGraph} graph - Dependency graph
   * @param {Array<string>} ordering - Proposed ordering
   * @returns {boolean} - True if ordering is valid
   */
  isValidTopologicalOrder(graph, ordering) {
    const position = new Map();
    
    // Map nodes to their positions
    for (let i = 0; i < ordering.length; i++) {
      position.set(ordering[i], i);
    }
    
    // Check all edges
    for (const nodeId of ordering) {
      const dependencies = graph.getDependencies(nodeId);
      const nodePos = position.get(nodeId);
      
      for (const depId of dependencies) {
        const depPos = position.get(depId);
        if (depPos === undefined || depPos >= nodePos) {
          return false; // Dependency comes after or doesn't exist
        }
      }
    }
    
    return true;
  }

  /**
   * Get all valid topological orderings (warning: exponential complexity)
   * @param {DependencyGraph} graph - Dependency graph
   * @param {number} maxResults - Maximum results to return
   * @returns {Array<Array<string>>} - All valid orderings
   */
  getAllValidOrderings(graph, maxResults = 10) {
    const orderings = [];
    const nodes = graph.getAllNodes();
    const visited = new Set();
    const currentOrder = [];
    
    const backtrack = () => {
      if (orderings.length >= maxResults) {
        return;
      }
      
      if (currentOrder.length === nodes.size) {
        orderings.push([...currentOrder]);
        return;
      }
      
      for (const [nodeId, node] of nodes) {
        if (visited.has(nodeId)) {
          continue;
        }
        
        // Check if all dependencies are satisfied
        let canAdd = true;
        for (const depId of node.dependencies) {
          if (!visited.has(depId)) {
            canAdd = false;
            break;
          }
        }
        
        if (canAdd) {
          visited.add(nodeId);
          currentOrder.push(nodeId);
          backtrack();
          currentOrder.pop();
          visited.delete(nodeId);
        }
      }
    };
    
    backtrack();
    return orderings;
  }
}