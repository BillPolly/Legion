/**
 * DependencyValidator - Validates dependencies between plan steps
 * 
 * Ensures dependencies are valid, no circular dependencies exist,
 * and the dependency graph can be executed.
 */

class DependencyValidator {
  constructor(config = {}) {
    this.config = {
      allowParallelExecution: true,
      maxDependencyDepth: 10,
      ...config
    };
  }

  /**
   * Validate plan dependencies
   * 
   * @param {Plan} plan - Plan to validate
   * @returns {Object} Validation result with errors and warnings
   */
  async validate(plan) {
    const result = {
      errors: [],
      warnings: [],
      suggestions: []
    };

    if (!plan.steps || !Array.isArray(plan.steps)) {
      return result; // No steps to validate
    }

    // Create step ID set for validation
    const stepIds = new Set(plan.steps.map(step => step.id));

    // Validate each step's dependencies
    for (const step of plan.steps) {
      this._validateStepDependencies(step, stepIds, result);
    }

    // Check for circular dependencies
    const circularDeps = this._detectCircularDependencies(plan.steps);
    if (circularDeps.length > 0) {
      for (const cycle of circularDeps) {
        result.errors.push({
          type: 'circular_dependency',
          cycle: cycle,
          message: `Circular dependency detected: ${cycle.join(' -> ')} -> ${cycle[0]}`
        });
      }
    }

    // Validate dependency depth
    const depthAnalysis = this._analyzeDependencyDepth(plan.steps);
    if (depthAnalysis.maxDepth > this.config.maxDependencyDepth) {
      result.warnings.push({
        type: 'excessive_depth',
        depth: depthAnalysis.maxDepth,
        path: depthAnalysis.deepestPath,
        message: `Dependency chain is very deep (${depthAnalysis.maxDepth} levels). Consider simplifying.`
      });
    }

    // Check for orphaned steps
    const orphans = this._findOrphanedSteps(plan.steps);
    if (orphans.length > 0) {
      result.warnings.push({
        type: 'orphaned_steps',
        steps: orphans,
        message: `Found ${orphans.length} steps with no dependents and not marked as final steps`
      });
    }

    // Suggest parallelization opportunities
    if (this.config.allowParallelExecution) {
      const parallelSuggestions = this._suggestParallelization(plan.steps);
      if (parallelSuggestions.length > 0) {
        result.suggestions.push(...parallelSuggestions);
      }
    }

    return result;
  }

  /**
   * Validate individual step dependencies
   * @private
   */
  _validateStepDependencies(step, validStepIds, result) {
    if (!step.dependencies || step.dependencies.length === 0) {
      return; // No dependencies to validate
    }

    // Check each dependency
    for (const depId of step.dependencies) {
      // Check if dependency exists
      if (!validStepIds.has(depId)) {
        result.errors.push({
          type: 'invalid_dependency',
          stepId: step.id,
          dependencyId: depId,
          message: `Step '${step.id}' depends on non-existent step '${depId}'`
        });
      }

      // Check for self-dependency
      if (depId === step.id) {
        result.errors.push({
          type: 'self_dependency',
          stepId: step.id,
          message: `Step '${step.id}' cannot depend on itself`
        });
      }
    }

    // Check for duplicate dependencies
    const uniqueDeps = new Set(step.dependencies);
    if (uniqueDeps.size < step.dependencies.length) {
      result.warnings.push({
        type: 'duplicate_dependencies',
        stepId: step.id,
        message: `Step '${step.id}' has duplicate dependencies`
      });
    }
  }

  /**
   * Detect circular dependencies using DFS
   * @private
   */
  _detectCircularDependencies(steps) {
    const adjacencyMap = this._buildAdjacencyMap(steps);
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const dfs = (nodeId, path = []) => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart);
        cycles.push(cycle);
        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const dependencies = adjacencyMap.get(nodeId) || [];
      for (const dep of dependencies) {
        dfs(dep, [...path]);
      }

      recursionStack.delete(nodeId);
      return false;
    };

    // Run DFS from each node
    for (const step of steps) {
      if (!visited.has(step.id)) {
        dfs(step.id, []);
      }
    }

    return cycles;
  }

  /**
   * Build adjacency map from steps
   * @private
   */
  _buildAdjacencyMap(steps) {
    const map = new Map();
    
    for (const step of steps) {
      if (step.dependencies && step.dependencies.length > 0) {
        map.set(step.id, step.dependencies);
      } else {
        map.set(step.id, []);
      }
    }

    return map;
  }

  /**
   * Analyze dependency depth
   * @private
   */
  _analyzeDependencyDepth(steps) {
    const adjacencyMap = this._buildAdjacencyMap(steps);
    const depths = new Map();
    let maxDepth = 0;
    let deepestPath = [];

    const calculateDepth = (nodeId, visited = new Set(), path = []) => {
      if (depths.has(nodeId)) {
        return depths.get(nodeId);
      }

      if (visited.has(nodeId)) {
        return 0; // Circular dependency, handled elsewhere
      }

      visited.add(nodeId);
      path.push(nodeId);

      const dependencies = adjacencyMap.get(nodeId) || [];
      let depth = 0;

      for (const dep of dependencies) {
        const depDepth = calculateDepth(dep, new Set(visited), [...path]);
        depth = Math.max(depth, depDepth + 1);
      }

      depths.set(nodeId, depth);

      if (depth > maxDepth) {
        maxDepth = depth;
        deepestPath = [...path];
      }

      return depth;
    };

    // Calculate depth for all nodes
    for (const step of steps) {
      calculateDepth(step.id);
    }

    return { maxDepth, deepestPath, depths };
  }

  /**
   * Find orphaned steps (steps with no dependents)
   * @private
   */
  _findOrphanedSteps(steps) {
    const dependents = new Map();
    
    // Initialize all steps with empty dependent lists
    for (const step of steps) {
      dependents.set(step.id, []);
    }

    // Build dependent relationships
    for (const step of steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          const depList = dependents.get(dep) || [];
          depList.push(step.id);
          dependents.set(dep, depList);
        }
      }
    }

    // Find steps with no dependents (excluding final steps)
    const orphans = [];
    for (const [stepId, depList] of dependents) {
      const step = steps.find(s => s.id === stepId);
      if (depList.length === 0 && step && step.type !== 'deployment' && step.type !== 'validation') {
        orphans.push(stepId);
      }
    }

    return orphans;
  }

  /**
   * Suggest parallelization opportunities
   * @private
   */
  _suggestParallelization(steps) {
    const suggestions = [];
    const adjacencyMap = this._buildAdjacencyMap(steps);
    const depths = this._analyzeDependencyDepth(steps).depths;

    // Group steps by depth level
    const levelGroups = new Map();
    for (const [stepId, depth] of depths) {
      if (!levelGroups.has(depth)) {
        levelGroups.set(depth, []);
      }
      levelGroups.get(depth).push(stepId);
    }

    // Find parallelization opportunities at each level
    for (const [level, stepIds] of levelGroups) {
      if (stepIds.length > 1) {
        // Check if these steps can actually run in parallel
        const parallelizable = [];
        
        for (const stepId of stepIds) {
          const step = steps.find(s => s.id === stepId);
          if (step && !this._hasSharedDependencies(step, stepIds, steps)) {
            parallelizable.push(stepId);
          }
        }

        if (parallelizable.length > 1) {
          suggestions.push({
            type: 'parallelization_opportunity',
            level,
            steps: parallelizable,
            message: `Steps ${parallelizable.join(', ')} can be executed in parallel`
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Check if a step shares dependencies with other steps at the same level
   * @private
   */
  _hasSharedDependencies(step, levelSteps, allSteps) {
    if (!step.dependencies) return false;

    for (const otherId of levelSteps) {
      if (otherId === step.id) continue;
      
      const otherStep = allSteps.find(s => s.id === otherId);
      if (otherStep && otherStep.dependencies) {
        // Check for shared dependencies
        const shared = step.dependencies.some(dep => 
          otherStep.dependencies.includes(dep)
        );
        if (shared) return true;
      }
    }

    return false;
  }

  /**
   * Generate execution order based on dependencies
   * 
   * @param {Array} steps - Array of plan steps
   * @returns {Array} Ordered array of step IDs
   */
  generateExecutionOrder(steps) {
    const visited = new Set();
    const order = [];
    const adjacencyMap = this._buildAdjacencyMap(steps);

    const visit = (stepId) => {
      if (visited.has(stepId)) return;

      const dependencies = adjacencyMap.get(stepId) || [];
      for (const dep of dependencies) {
        visit(dep);
      }

      visited.add(stepId);
      order.push(stepId);
    };

    // Visit all steps
    for (const step of steps) {
      visit(step.id);
    }

    return order;
  }
}

export { DependencyValidator };