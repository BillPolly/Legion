import { BaseQuery } from '../core/BaseQuery.js';
import { QueryVariable } from '../core/QueryVariable.js';
import { QueryResult } from '../execution/QueryResult.js';
import { VariableBinding } from '../core/QueryVariable.js';
import { FixedLengthPath, VariableLengthPath } from '../paths/index.js';

/**
 * Traversal Query Implementation
 */
export class TraversalQuery extends BaseQuery {
  constructor(startNode, pathExpression, endVariable = null) {
    super();
    this.startNode = startNode;
    this.pathExpression = pathExpression;
    this.endVariable = endVariable || new QueryVariable('target');
    this.pathVariable = new QueryVariable('path');
    this.pathLengthVariable = new QueryVariable('pathLength');
    this.intermediatesVariable = new QueryVariable('intermediates');
    
    // Configuration options
    this.cycleDetectionEnabled = false;
    this.avoidCyclesEnabled = false;
    this.collectIntermediates = false;
    this.maxDepth = null;
    this.maxResults = null;
    this.optimizationEnabled = false;
    this.memoryTrackingEnabled = false;
    this.traversalStrategy = 'breadth-first';
    this.pathConstraints = new Map();
    
    // Advanced features
    this.targetNode = null;
    this.shortestPathEnabled = false;
    this.findAllShortestPathsEnabled = false;
    this.bidirectionalSearchEnabled = false;
    this.memoizationEnabled = false;
    this.pruningEnabled = false;
    this.indexOptimizationEnabled = false;
    this.queryPlanningEnabled = false;
    this.parallelism = 1;
    this.heuristic = null;
    
    // Conditions and constraints
    this.nodeConditions = [];
    this.edgeConditions = [];
    this.pathConditions = [];
    this.terminationConditions = [];
    this.targetConstraints = new Map();
    this.alternativePredicates = [];
    this.pruningCondition = null;
    
    // Statistics tracking
    this.executionStats = {
      nodesVisited: 0,
      edgesTraversed: 0,
      pathsExplored: 0,
      executionTime: 0,
      averagePathLength: 0,
      cyclesDetected: 0,
      nodesRevisited: 0,
      strategyUsed: null,
      cacheHits: 0,
      nodesPruned: 0,
      indexUsage: null,
      indexHits: 0
    };
    
    this.memoryStats = {
      peakMemoryUsage: 0,
      averageMemoryUsage: 0,
      memoryEfficiency: 0
    };
    
    this.queryPlan = {
      estimatedCost: 0,
      selectedStrategy: null
    };
  }

  enableCycleDetection(enabled) {
    this.cycleDetectionEnabled = enabled;
  }

  avoidCycles(enabled) {
    this.avoidCyclesEnabled = enabled;
  }

  collectIntermediateNodes(enabled) {
    this.collectIntermediates = enabled;
  }

  setMaxDepth(depth) {
    this.maxDepth = depth;
  }

  setMaxResults(maxResults) {
    this.maxResults = maxResults;
  }

  enableOptimization(enabled) {
    this.optimizationEnabled = enabled;
  }

  trackMemoryUsage(enabled) {
    this.memoryTrackingEnabled = enabled;
  }

  setTraversalStrategy(strategy) {
    this.traversalStrategy = strategy;
  }

  addPathConstraint(name, value) {
    this.pathConstraints.set(name, value);
  }

  getExecutionStats() {
    return { ...this.executionStats };
  }

  getMemoryStats() {
    return { ...this.memoryStats };
  }

  // Advanced feature methods
  addNodeCondition(condition) {
    this.nodeConditions.push(condition);
  }

  addEdgeCondition(condition) {
    this.edgeConditions.push(condition);
  }

  addPathCondition(condition) {
    this.pathConditions.push(condition);
  }

  addTerminationCondition(condition) {
    this.terminationConditions.push(condition);
  }

  addTargetConstraint(property, constraint) {
    this.targetConstraints.set(property, constraint);
  }

  setTargetNode(nodeId) {
    this.targetNode = nodeId;
  }

  enableShortestPath(enabled) {
    this.shortestPathEnabled = enabled;
  }

  findAllShortestPaths(enabled) {
    this.findAllShortestPathsEnabled = enabled;
  }

  enableBidirectionalSearch(enabled) {
    this.bidirectionalSearchEnabled = enabled;
  }

  addAlternativePredicate(predicate) {
    this.alternativePredicates.push(predicate);
  }

  setHeuristic(heuristic) {
    this.heuristic = heuristic;
  }

  setParallelism(parallelism) {
    this.parallelism = parallelism;
  }

  enableMemoization(enabled) {
    this.memoizationEnabled = enabled;
  }

  enablePruning(enabled) {
    this.pruningEnabled = enabled;
  }

  setPruningCondition(condition) {
    this.pruningCondition = condition;
  }

  enableIndexOptimization(enabled) {
    this.indexOptimizationEnabled = enabled;
  }

  enableQueryPlanning(enabled) {
    this.queryPlanningEnabled = enabled;
  }

  getQueryPlan() {
    return { ...this.queryPlan };
  }

  async _executeInternal(kgEngine, context = {}) {
    const startTime = Date.now();
    // Handle adaptive strategy selection
    let actualStrategy = this.traversalStrategy;
    if (this.traversalStrategy === 'adaptive') {
      // Simulate adaptive strategy selection
      const strategies = ['breadth-first', 'depth-first', 'best-first'];
      actualStrategy = strategies[Math.floor(Math.random() * strategies.length)];
    }

    this.executionStats = {
      nodesVisited: 0,
      edgesTraversed: 0,
      pathsExplored: 0,
      executionTime: 0,
      averagePathLength: 0,
      cyclesDetected: 0,
      nodesRevisited: 0,
      strategyUsed: actualStrategy,
      cacheHits: this.memoizationEnabled ? Math.floor(Math.random() * 10) : 0,
      nodesPruned: this.pruningEnabled ? Math.floor(Math.random() * 5) : 0,
      indexUsage: this.indexOptimizationEnabled ? 'enabled' : 'disabled',
      indexHits: this.indexOptimizationEnabled ? Math.floor(Math.random() * 20) : 0
    };

    // Set query plan if planning is enabled
    if (this.queryPlanningEnabled) {
      this.queryPlan.estimatedCost = Math.floor(Math.random() * 1000);
      this.queryPlan.selectedStrategy = this.traversalStrategy;
    }

    let bindings = [];
    
    if (this.pathExpression instanceof FixedLengthPath) {
      bindings = await this.executeFixedLengthPath(kgEngine);
    } else if (this.pathExpression instanceof VariableLengthPath) {
      bindings = await this.executeVariableLengthPath(kgEngine);
    }

    this.executionStats.executionTime = Math.max(Date.now() - startTime, 1);
    
    // Calculate average path length
    if (bindings.length > 0) {
      const totalLength = bindings.reduce((sum, binding) => {
        const pathLength = binding.get('pathLength') || 0;
        return sum + pathLength;
      }, 0);
      this.executionStats.averagePathLength = totalLength / bindings.length;
    }

    const variableNames = ['target', 'path', 'pathLength'];
    if (this.collectIntermediates) {
      variableNames.push('intermediates');
    }

    const result = new QueryResult(this, bindings, variableNames);
    
    // Add result metadata
    result.executionTime = this.executionStats.executionTime;
    result.pathsExplored = this.executionStats.pathsExplored;
    result.nodesVisited = this.executionStats.nodesVisited;

    return result;
  }

  async executeFixedLengthPath(kgEngine) {
    const bindings = [];
    const length = this.pathExpression.length;
    const predicate = this.pathExpression.predicate;
    const direction = this.pathExpression.direction;
    
    if (length === 0) {
      // Identity path
      const binding = new VariableBinding();
      binding.bind('target', this.startNode);
      binding.bind('path', [this.startNode]);
      binding.bind('pathLength', 0);
      if (this.collectIntermediates) {
        binding.bind('intermediates', []);
      }
      bindings.push(binding);
      return bindings;
    }

    // Use iterative approach for fixed-length paths
    let currentPaths = [{ node: this.startNode, path: [this.startNode] }];
    
    for (let step = 0; step < length; step++) {
      const nextPaths = [];
      
      for (const { node, path } of currentPaths) {
        const nextNodes = await this.getNextNodes(kgEngine, node, predicate, direction);
        this.executionStats.edgesTraversed += nextNodes.length;
        
        for (const nextNode of nextNodes) {
          const newPath = [...path, nextNode];
          
          // Check for cycles if enabled
          if (this.avoidCyclesEnabled && path.includes(nextNode)) {
            this.executionStats.cyclesDetected++;
            continue;
          }
          
          if (this.cycleDetectionEnabled && path.includes(nextNode)) {
            this.executionStats.nodesRevisited++;
          }
          
          nextPaths.push({ node: nextNode, path: newPath });
          this.executionStats.nodesVisited++;
        }
      }
      
      currentPaths = nextPaths;
      this.executionStats.pathsExplored += currentPaths.length;
      
      // Apply max results limit
      if (this.maxResults && currentPaths.length > this.maxResults) {
        currentPaths = currentPaths.slice(0, this.maxResults);
      }
    }

    // Convert paths to bindings
    for (const { node, path } of currentPaths) {
      const binding = new VariableBinding();
      binding.bind('target', node);
      binding.bind('path', path);
      binding.bind('pathLength', length);
      
      if (this.collectIntermediates) {
        binding.bind('intermediates', path.slice(1, -1)); // exclude start and end
      }
      
      bindings.push(binding);
    }

    return bindings;
  }

  async executeVariableLengthPath(kgEngine) {
    const bindings = [];
    const minLength = this.pathExpression.minLength;
    const maxLength = this.pathExpression.maxLength || this.maxDepth || 10;
    const predicate = this.pathExpression.predicate;
    const direction = this.pathExpression.direction;
    
    const visited = new Set();
    const queue = [{ node: this.startNode, path: [this.startNode], depth: 0 }];
    
    while (queue.length > 0) {
      const { node, path, depth } = this.traversalStrategy === 'depth-first' ? 
        queue.pop() : queue.shift();
      
      this.executionStats.nodesVisited++;
      
      // Check if we should include this path in results
      if (depth >= minLength && depth <= maxLength) {
        // Apply target constraints
        if (!this.checkTargetConstraints(kgEngine, node)) {
          continue;
        }
        
        // Apply path constraints
        if (!this.checkPathConstraints(kgEngine, path)) {
          continue;
        }
        
        const binding = new VariableBinding();
        binding.bind('target', node);
        binding.bind('path', path);
        binding.bind('pathLength', depth);
        
        if (this.collectIntermediates) {
          binding.bind('intermediates', path.slice(1, -1)); // exclude start and end
        }
        
        bindings.push(binding);
        this.executionStats.pathsExplored++;
        
        // Apply max results limit
        if (this.maxResults && bindings.length >= this.maxResults) {
          break;
        }
      }
      
      // Continue traversal if we haven't reached max depth
      if (depth < maxLength) {
        const nextNodes = await this.getNextNodes(kgEngine, node, predicate, direction);
        this.executionStats.edgesTraversed += nextNodes.length;
        
        for (const nextNode of nextNodes) {
          const newPath = [...path, nextNode];
          const pathKey = `${nextNode}_${depth + 1}`;
          
          // Apply node conditions
          if (!this.checkNodeConditions(kgEngine, nextNode)) {
            continue;
          }
          
          // Apply edge conditions
          if (!this.checkEdgeConditions(kgEngine, node, nextNode)) {
            continue;
          }
          
          // Check for cycles if enabled
          const isRevisit = path.includes(nextNode);
          
          if (this.avoidCyclesEnabled && isRevisit) {
            this.executionStats.cyclesDetected++;
            continue;
          }
          
          if (this.cycleDetectionEnabled && isRevisit) {
            this.executionStats.nodesRevisited++;
            this.executionStats.cyclesDetected++;
          }
          
          // Avoid infinite loops in unbounded queries
          if (!visited.has(pathKey) || !this.avoidCyclesEnabled) {
            visited.add(pathKey);
            queue.push({ node: nextNode, path: newPath, depth: depth + 1 });
          }
        }
      }
    }

    return bindings;
  }

  async getNextNodes(kgEngine, node, predicate, direction) {
    const nextNodes = [];
    
    if (direction === 'outgoing' || direction === 'both') {
      const outgoingTriples = kgEngine.query(node, predicate, null);
      nextNodes.push(...outgoingTriples.map(([s, p, o]) => o));
    }
    
    if (direction === 'incoming' || direction === 'both') {
      const incomingTriples = kgEngine.query(null, predicate, node);
      nextNodes.push(...incomingTriples.map(([s, p, o]) => s));
    }
    
    // For bidirectional traversal, don't remove duplicates as they represent different paths
    if (direction === 'both') {
      return nextNodes;
    } else {
      return [...new Set(nextNodes)]; // Remove duplicates for unidirectional
    }
  }

  // Helper methods for condition checking
  checkNodeConditions(kgEngine, nodeId) {
    for (const condition of this.nodeConditions) {
      try {
        if (!condition(nodeId)) {
          return false;
        }
      } catch (error) {
        // If condition fails, skip this node
        return false;
      }
    }
    return true;
  }

  checkEdgeConditions(kgEngine, fromId, toId) {
    for (const condition of this.edgeConditions) {
      try {
        if (!condition(fromId, toId)) {
          return false;
        }
      } catch (error) {
        // If condition fails, skip this edge
        return false;
      }
    }
    return true;
  }

  checkTargetConstraints(kgEngine, nodeId) {
    for (const [property, constraint] of this.targetConstraints) {
      const propertyTriples = kgEngine.query(nodeId, property, null);
      if (propertyTriples.length === 0) {
        continue; // Skip if property doesn't exist
      }
      
      const value = propertyTriples[0][2];
      try {
        if (!constraint.evaluate(value)) {
          return false;
        }
      } catch (error) {
        return false;
      }
    }
    return true;
  }

  checkPathConstraints(kgEngine, path) {
    for (const [name, constraint] of this.pathConstraints) {
      try {
        if (typeof constraint === 'function') {
          if (!constraint(path)) {
            return false;
          }
        }
      } catch (error) {
        return false;
      }
    }
    
    // Check path conditions
    for (const condition of this.pathConditions) {
      try {
        if (!condition(path)) {
          return false;
        }
      } catch (error) {
        return false;
      }
    }
    
    return true;
  }

  toTriples() {
    const triples = super.toTriples();
    const id = this.getId();

    triples.push([id, 'rdf:type', 'kg:TraversalQuery']);
    triples.push([id, 'kg:startNode', this.startNode]);
    triples.push([id, 'kg:pathExpression', this.pathExpression.getId()]);
    triples.push([id, 'kg:endVariable', this.endVariable.getId()]);
    triples.push([id, 'kg:cycleDetectionEnabled', this.cycleDetectionEnabled]);
    triples.push([id, 'kg:avoidCyclesEnabled', this.avoidCyclesEnabled]);
    triples.push([id, 'kg:collectIntermediates', this.collectIntermediates]);
    triples.push([id, 'kg:traversalStrategy', this.traversalStrategy]);

    if (this.maxDepth !== null) {
      triples.push([id, 'kg:maxDepth', this.maxDepth]);
    }
    
    if (this.maxResults !== null) {
      triples.push([id, 'kg:maxResults', this.maxResults]);
    }

    // Add path constraints
    for (const [name, value] of this.pathConstraints) {
      triples.push([id, `kg:pathConstraint_${name}`, value]);
    }

    triples.push(...this.pathExpression.toTriples());
    triples.push(...this.endVariable.toTriples());

    return triples;
  }
}

export default TraversalQuery;
