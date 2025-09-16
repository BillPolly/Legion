/**
 * CycleDetector - Detects circular dependencies in a graph
 * Single responsibility: Cycle detection algorithms
 */

export class CycleDetector {
  constructor() {
    this.visited = new Set();
    this.recursionStack = new Set();
    this.cycles = [];
  }

  /**
   * Detect all cycles in the graph
   * @param {DependencyGraph} graph - Dependency graph
   * @returns {Array<Array<string>>} - Array of cycle paths
   */
  detectCycles(graph) {
    this.reset();
    const nodes = graph.getAllNodes();
    
    for (const nodeId of nodes.keys()) {
      if (!this.visited.has(nodeId)) {
        this.dfs(nodeId, graph, []);
      }
    }
    
    return this.cycles;
  }

  /**
   * Check if graph has any cycles
   * @param {DependencyGraph} graph - Dependency graph
   * @returns {boolean} - True if cycles exist
   */
  hasCycles(graph) {
    const cycles = this.detectCycles(graph);
    return cycles.length > 0;
  }

  /**
   * Get strongly connected components
   * @param {DependencyGraph} graph - Dependency graph
   * @returns {Array<Array<string>>} - Strongly connected components
   */
  getStronglyConnectedComponents(graph) {
    const components = [];
    const stack = [];
    const indices = new Map();
    const lowlinks = new Map();
    const onStack = new Set();
    let index = 0;
    
    const strongconnect = (nodeId) => {
      indices.set(nodeId, index);
      lowlinks.set(nodeId, index);
      index++;
      stack.push(nodeId);
      onStack.add(nodeId);
      
      const dependencies = graph.getDependencies(nodeId);
      for (const depId of dependencies) {
        if (!indices.has(depId)) {
          strongconnect(depId);
          lowlinks.set(nodeId, Math.min(lowlinks.get(nodeId), lowlinks.get(depId)));
        } else if (onStack.has(depId)) {
          lowlinks.set(nodeId, Math.min(lowlinks.get(nodeId), indices.get(depId)));
        }
      }
      
      if (lowlinks.get(nodeId) === indices.get(nodeId)) {
        const component = [];
        let node;
        do {
          node = stack.pop();
          onStack.delete(node);
          component.push(node);
        } while (node !== nodeId);
        
        if (component.length > 1) {
          components.push(component);
        }
      }
    };
    
    const nodes = graph.getAllNodes();
    for (const nodeId of nodes.keys()) {
      if (!indices.has(nodeId)) {
        strongconnect(nodeId);
      }
    }
    
    return components;
  }

  /**
   * Find the shortest cycle from a node
   * @param {string} startNode - Starting node
   * @param {DependencyGraph} graph - Dependency graph
   * @returns {Array<string>|null} - Shortest cycle path or null
   */
  findShortestCycle(startNode, graph) {
    const queue = [{ node: startNode, path: [startNode] }];
    const visited = new Map();
    
    while (queue.length > 0) {
      const { node, path } = queue.shift();
      const dependencies = graph.getDependencies(node);
      
      for (const depId of dependencies) {
        if (depId === startNode) {
          return [...path, startNode];
        }
        
        if (!visited.has(depId) || visited.get(depId) > path.length) {
          visited.set(depId, path.length);
          queue.push({ node: depId, path: [...path, depId] });
        }
      }
    }
    
    return null;
  }

  /**
   * Depth-first search for cycle detection
   * @private
   */
  dfs(nodeId, graph, path) {
    if (this.recursionStack.has(nodeId)) {
      // Found a cycle
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart >= 0) {
        const cycle = [...path.slice(cycleStart), nodeId];
        this.cycles.push(cycle);
      }
      return;
    }
    
    if (this.visited.has(nodeId)) {
      return;
    }
    
    this.visited.add(nodeId);
    this.recursionStack.add(nodeId);
    path.push(nodeId);
    
    const dependencies = graph.getDependencies(nodeId);
    for (const depId of dependencies) {
      this.dfs(depId, graph, [...path]);
    }
    
    this.recursionStack.delete(nodeId);
  }

  /**
   * Reset detector state
   * @private
   */
  reset() {
    this.visited.clear();
    this.recursionStack.clear();
    this.cycles = [];
  }

  /**
   * Get cycle statistics
   * @param {Array<Array<string>>} cycles - Detected cycles
   * @returns {Object} - Cycle statistics
   */
  getCycleStatistics(cycles) {
    if (!cycles || cycles.length === 0) {
      return {
        cycleCount: 0,
        minCycleLength: 0,
        maxCycleLength: 0,
        averageCycleLength: 0,
        nodesInCycles: 0
      };
    }
    
    const allNodes = new Set();
    let minLength = Infinity;
    let maxLength = 0;
    let totalLength = 0;
    
    for (const cycle of cycles) {
      const length = cycle.length - 1; // Don't count repeated node
      minLength = Math.min(minLength, length);
      maxLength = Math.max(maxLength, length);
      totalLength += length;
      
      cycle.forEach(node => allNodes.add(node));
    }
    
    return {
      cycleCount: cycles.length,
      minCycleLength: minLength,
      maxCycleLength: maxLength,
      averageCycleLength: totalLength / cycles.length,
      nodesInCycles: allNodes.size
    };
  }
}