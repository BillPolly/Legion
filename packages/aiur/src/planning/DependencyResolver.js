/**
 * DependencyResolver - Analyzes and optimizes plan step dependencies
 * 
 * Provides dependency tracking, execution order optimization,
 * parallel execution detection, and circular dependency detection
 */

export class DependencyResolver {
  constructor(plan) {
    this.plan = plan;
    this.dependencyGraph = new Map();
    this.reverseDependencyGraph = new Map();
    this.handleDependencies = {
      producers: {},
      consumers: {},
      implicitDependencies: {}
    };
    
    this._buildDependencyGraph();
  }

  /**
   * Build dependency graphs from plan
   * @private
   */
  _buildDependencyGraph() {
    // Clear existing graphs
    this.dependencyGraph.clear();
    this.reverseDependencyGraph.clear();
    this.handleDependencies = {
      producers: {},
      consumers: {},
      implicitDependencies: {}
    };
    
    // Initialize nodes
    for (const step of this.plan.steps) {
      this.dependencyGraph.set(step.id, new Set());
      this.reverseDependencyGraph.set(step.id, new Set());
    }
    
    // Build explicit dependencies
    for (const step of this.plan.steps) {
      if (step.dependsOn && Array.isArray(step.dependsOn)) {
        for (const dep of step.dependsOn) {
          this.dependencyGraph.get(dep)?.add(step.id);
          this.reverseDependencyGraph.get(step.id)?.add(dep);
        }
      }
    }
    
    // Build handle dependencies
    this._buildHandleDependencies();
  }

  /**
   * Build handle-based dependencies
   * @private
   */
  _buildHandleDependencies() {
    // Find handle producers
    for (const step of this.plan.steps) {
      if (step.expectedOutputs) {
        for (const output of step.expectedOutputs) {
          this.handleDependencies.producers[output] = step.id;
        }
      }
    }
    
    // Find handle consumers and create implicit dependencies
    for (const step of this.plan.steps) {
      if (step.parameters) {
        const handleRefs = this._extractHandleReferences(step.parameters);
        for (const handleRef of handleRefs) {
          // Track consumer
          if (!this.handleDependencies.consumers[handleRef]) {
            this.handleDependencies.consumers[handleRef] = [];
          }
          this.handleDependencies.consumers[handleRef].push(step.id);
          
          // Create implicit dependency
          const producer = this.handleDependencies.producers[handleRef];
          if (producer && producer !== step.id) {
            if (!this.handleDependencies.implicitDependencies[step.id]) {
              this.handleDependencies.implicitDependencies[step.id] = [];
            }
            this.handleDependencies.implicitDependencies[step.id].push(producer);
            
            // Add to dependency graphs
            this.dependencyGraph.get(producer)?.add(step.id);
            this.reverseDependencyGraph.get(step.id)?.add(producer);
          }
        }
      }
    }
  }

  /**
   * Extract handle references from parameters
   * @private
   */
  _extractHandleReferences(params) {
    const refs = [];
    const extract = (obj) => {
      if (typeof obj === 'string' && obj.startsWith('@')) {
        refs.push(obj.substring(1));
      } else if (typeof obj === 'object' && obj !== null) {
        for (const value of Object.values(obj)) {
          extract(value);
        }
      }
    };
    extract(params);
    return refs;
  }

  /**
   * Get dependency graph representation
   */
  getDependencyGraph() {
    const nodes = Array.from(this.dependencyGraph.keys());
    const edges = [];
    
    for (const [from, tos] of this.dependencyGraph.entries()) {
      for (const to of tos) {
        edges.push({ from, to });
      }
    }
    
    return { nodes, edges };
  }

  /**
   * Analyze dependencies
   */
  analyzeDependencies() {
    const analysis = {
      isLinear: true,
      hasParallelOpportunities: false,
      dependencyDepth: 0,
      criticalPath: [],
      parallelGroups: []
    };
    
    // Check if linear
    const independentSteps = this.getIndependentSteps();
    if (independentSteps.length > 1) {
      analysis.isLinear = false;
      analysis.hasParallelOpportunities = true;
    }
    
    // Find parallel groups
    analysis.parallelGroups = this._findParallelGroups();
    if (analysis.parallelGroups.some(group => group.length > 1)) {
      analysis.hasParallelOpportunities = true;
      analysis.isLinear = false;
    }
    
    // Calculate critical path
    analysis.criticalPath = this.getCriticalPath();
    analysis.dependencyDepth = analysis.criticalPath.length;
    
    return analysis;
  }

  /**
   * Get steps with no dependencies
   */
  getIndependentSteps() {
    const independent = [];
    for (const [step, deps] of this.reverseDependencyGraph.entries()) {
      if (deps.size === 0) {
        independent.push(step);
      }
    }
    return independent;
  }

  /**
   * Get handle dependencies
   */
  getHandleDependencies() {
    return { ...this.handleDependencies };
  }

  /**
   * Get transitive dependencies for a step
   */
  getTransitiveDependencies(stepId) {
    const visited = new Set();
    const dependencies = new Set();
    
    const visit = (id) => {
      const deps = this.reverseDependencyGraph.get(id) || new Set();
      for (const dep of deps) {
        if (!visited.has(dep) && dep !== stepId) {
          visited.add(dep);
          dependencies.add(dep);
          visit(dep);
        }
      }
    };
    
    visit(stepId);
    return Array.from(dependencies);
  }

  /**
   * Get optimal execution order using topological sort
   */
  getOptimalExecutionOrder() {
    const order = [];
    const visited = new Set();
    const temp = new Set();
    
    const visit = (node) => {
      if (temp.has(node)) {
        throw new Error('Circular dependency detected');
      }
      if (visited.has(node)) return;
      
      temp.add(node);
      const deps = this.reverseDependencyGraph.get(node) || new Set();
      for (const dep of deps) {
        visit(dep);
      }
      temp.delete(node);
      visited.add(node);
      order.push(node);
    };
    
    try {
      for (const node of this.dependencyGraph.keys()) {
        if (!visited.has(node)) {
          visit(node);
        }
      }
    } catch (error) {
      // Return empty on circular dependency
      return [];
    }
    
    return order;
  }

  /**
   * Get critical path (longest dependency chain)
   */
  getCriticalPath() {
    const weights = new Map();
    const paths = new Map();
    
    // Initialize weights
    for (const step of this.plan.steps) {
      weights.set(step.id, step.weight || 1);
      paths.set(step.id, [step.id]);
    }
    
    // Calculate longest paths
    const order = this.getOptimalExecutionOrder();
    for (const node of order) {
      const deps = this.reverseDependencyGraph.get(node) || new Set();
      let maxWeight = weights.get(node);
      let longestPath = paths.get(node);
      
      for (const dep of deps) {
        const depWeight = weights.get(dep) + weights.get(node);
        if (depWeight > maxWeight) {
          maxWeight = depWeight;
          longestPath = [...paths.get(dep), node];
        }
      }
      
      weights.set(node, maxWeight);
      paths.set(node, longestPath);
    }
    
    // Find the longest path overall
    let criticalPath = [];
    let maxLength = 0;
    
    for (const [node, path] of paths.entries()) {
      if (weights.get(node) > maxLength) {
        maxLength = weights.get(node);
        criticalPath = path;
      }
    }
    
    return criticalPath;
  }

  /**
   * Get parallel execution plan
   */
  getParallelExecutionPlan() {
    const stages = this._findParallelGroups();
    const maxParallelism = Math.max(...stages.map(s => s.length));
    
    return {
      stages,
      maxParallelism,
      totalStages: stages.length
    };
  }

  /**
   * Find groups of steps that can execute in parallel
   * @private
   */
  _findParallelGroups() {
    const groups = [];
    const remaining = new Set(this.dependencyGraph.keys());
    const completed = new Set();
    
    while (remaining.size > 0) {
      const group = [];
      
      for (const step of remaining) {
        const deps = this.reverseDependencyGraph.get(step) || new Set();
        const allDepsCompleted = [...deps].every(dep => completed.has(dep));
        
        if (allDepsCompleted) {
          group.push(step);
        }
      }
      
      if (group.length === 0) {
        // Circular dependency or error
        break;
      }
      
      groups.push(group);
      for (const step of group) {
        remaining.delete(step);
        completed.add(step);
      }
    }
    
    return groups;
  }

  /**
   * Validate dependencies
   */
  validateDependencies() {
    const validation = {
      valid: true,
      hasCircularDependencies: false,
      circularChains: [],
      missingDependencies: [],
      errors: []
    };
    
    // Check for missing dependencies
    for (const step of this.plan.steps) {
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!this.dependencyGraph.has(dep)) {
            validation.valid = false;
            validation.missingDependencies.push({
              step: step.id,
              missing: dep
            });
          }
        }
      }
    }
    
    // Check for circular dependencies
    const circles = this._detectCircularDependencies();
    if (circles.length > 0) {
      validation.valid = false;
      validation.hasCircularDependencies = true;
      validation.circularChains = circles;
    }
    
    // Check for self-dependencies
    for (const step of this.plan.steps) {
      if (step.dependsOn && step.dependsOn.includes(step.id)) {
        validation.valid = false;
        validation.errors.push(`Step ${step.id} depends on itself`);
      }
    }
    
    return validation;
  }

  /**
   * Detect circular dependencies using DFS
   * @private
   */
  _detectCircularDependencies() {
    const visited = new Set();
    const recStack = new Set();
    const circles = [];
    
    const detectCycle = (node, path = []) => {
      visited.add(node);
      recStack.add(node);
      path.push(node);
      
      const neighbors = this.dependencyGraph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (detectCycle(neighbor, [...path])) {
            return true;
          }
        } else if (recStack.has(neighbor)) {
          // Found cycle
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            circles.push(path.slice(cycleStart));
          }
          return true;
        }
      }
      
      recStack.delete(node);
      return false;
    };
    
    for (const node of this.dependencyGraph.keys()) {
      if (!visited.has(node)) {
        detectCycle(node);
      }
    }
    
    return circles;
  }

  /**
   * Get dependency metrics
   */
  getDependencyMetrics() {
    const totalSteps = this.plan.steps.length;
    let totalDependencies = 0;
    let maxInDegree = { step: null, count: 0 };
    let maxOutDegree = { step: null, count: 0 };
    
    for (const [step, deps] of this.reverseDependencyGraph.entries()) {
      totalDependencies += deps.size;
      if (deps.size > maxInDegree.count) {
        maxInDegree = { step, count: deps.size };
      }
    }
    
    for (const [step, deps] of this.dependencyGraph.entries()) {
      if (deps.size > maxOutDegree.count) {
        maxOutDegree = { step, count: deps.size };
      }
    }
    
    // Dependency density should be calculated as the ratio of actual dependencies
    // to the maximum possible dependencies in a DAG: n*(n-1)/2
    const maxPossibleDeps = (totalSteps * (totalSteps - 1)) / 2;
    const dependencyDensity = maxPossibleDeps > 0 ? totalDependencies / maxPossibleDeps : 0;
    
    return {
      totalSteps,
      totalDependencies,
      averageDependencies: totalSteps > 0 ? totalDependencies / totalSteps : 0,
      maxInDegree,
      maxOutDegree,
      dependencyDensity
    };
  }

  /**
   * Update dependencies after plan changes
   */
  updateDependencies() {
    this._buildDependencyGraph();
  }

  /**
   * Add a new step to the plan
   */
  addStep(step) {
    // This is a helper method - actual implementation would be in AiurPlan
    if (!this.plan.steps.find(s => s.id === step.id)) {
      this.plan.steps.push(step);
      this.updateDependencies();
    }
  }

  /**
   * Get dependency analysis tools
   */
  getDependencyTools() {
    return {
      analyze_dependencies: {
        name: 'analyze_dependencies',
        description: 'Analyze plan dependencies',
        inputSchema: {
          type: 'object',
          properties: {
            planId: { type: 'string' }
          }
        },
        execute: async (params) => {
          try {
            const analysis = this.analyzeDependencies();
            return {
              success: true,
              analysis
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }
      },
      optimize_execution: {
        name: 'optimize_execution',
        description: 'Get optimal execution order',
        inputSchema: {
          type: 'object',
          properties: {
            planId: { type: 'string' }
          }
        },
        execute: async (params) => {
          try {
            const order = this.getOptimalExecutionOrder();
            return {
              success: true,
              order
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }
      },
      validate_dependencies: {
        name: 'validate_dependencies',
        description: 'Validate plan dependencies',
        inputSchema: {
          type: 'object',
          properties: {
            planId: { type: 'string' }
          }
        },
        execute: async (params) => {
          try {
            const validation = this.validateDependencies();
            return {
              success: true,
              validation
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }
      },
      get_parallel_plan: {
        name: 'get_parallel_plan',
        description: 'Get parallel execution plan',
        inputSchema: {
          type: 'object',
          properties: {
            planId: { type: 'string' }
          }
        },
        execute: async (params) => {
          try {
            const plan = this.getParallelExecutionPlan();
            return {
              success: true,
              plan
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }
      }
    };
  }
}