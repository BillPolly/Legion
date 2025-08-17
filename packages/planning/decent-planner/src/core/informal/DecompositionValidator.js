/**
 * DecompositionValidator - Validates task hierarchy decomposition
 */

export class DecompositionValidator {
  constructor() {
    // No dependencies needed for validation
  }

  /**
   * Validate entire decomposition hierarchy
   * @param {TaskNode} root - Root of the hierarchy
   * @param {Object} options - Validation options
   * @returns {Object} Comprehensive validation result
   */
  validate(root, options = {}) {
    const structure = this.validateStructure(root, options);
    const dependencies = this.validateDependencies(root, options);
    const completeness = this.validateCompleteness(root, options);
    const feasibility = this.aggregateFeasibility(root, options);

    const valid = structure.valid && 
                  dependencies.valid && 
                  completeness.valid && 
                  feasibility.overallFeasible;

    return {
      valid,
      structure,
      dependencies,
      completeness,
      feasibility,
      summary: this.generateSummary({ structure, dependencies, completeness, feasibility })
    };
  }

  /**
   * Validate structural integrity of the hierarchy
   * @param {TaskNode} root - Root node
   * @returns {Object} Structure validation result
   */
  validateStructure(root, options = {}) {
    const errors = [];
    
    this.traverseStructure(root, (node, depth, path) => {
      // Check for missing complexity
      if (!node.complexity) {
        errors.push({
          type: 'MISSING_COMPLEXITY',
          task: node.description,
          message: 'Task missing complexity classification'
        });
      }
      
      // Check for COMPLEX leaf nodes
      if (node.complexity === 'COMPLEX' && (!node.subtasks || node.subtasks.length === 0)) {
        errors.push({
          type: 'COMPLEX_LEAF',
          task: node.description,
          message: 'COMPLEX task has no subtasks'
        });
      }
      
      // Check for invalid complexity values
      if (node.complexity && node.complexity !== 'SIMPLE' && node.complexity !== 'COMPLEX') {
        errors.push({
          type: 'INVALID_COMPLEXITY',
          task: node.description,
          value: node.complexity,
          message: `Invalid complexity value: ${node.complexity}`
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate dependencies between tasks
   * @param {TaskNode} root - Root node
   * @param {Object} options - Validation options
   * @returns {Object} Dependency validation result
   */
  validateDependencies(root, options = {}) {
    const { strictDependencies = true } = options;
    const warnings = [];
    const errors = [];
    
    // Track available outputs at each level
    this.validateDependenciesRecursive(root, [], warnings, errors, strictDependencies);

    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
  }

  /**
   * Recursively validate dependencies
   * @private
   */
  validateDependenciesRecursive(node, availableOutputs, warnings, errors, strict) {
    const localOutputs = [...availableOutputs];
    
    // Process subtasks in order
    if (node.subtasks && node.subtasks.length > 0) {
      for (const subtask of node.subtasks) {
        // Check if subtask's inputs are satisfied
        if (subtask.suggestedInputs && subtask.suggestedInputs.length > 0) {
          for (const input of subtask.suggestedInputs) {
            if (!localOutputs.includes(input)) {
              const issue = {
                type: 'UNMET_DEPENDENCY',
                task: subtask.description,
                dependency: input,
                message: 'Input dependency not satisfied by previous tasks'
              };
              
              if (strict) {
                errors.push(issue);
              } else {
                warnings.push(issue);
              }
            }
          }
        }
        
        // Add subtask's outputs to available outputs
        if (subtask.suggestedOutputs && subtask.suggestedOutputs.length > 0) {
          localOutputs.push(...subtask.suggestedOutputs);
        }
        
        // Recurse into subtask
        this.validateDependenciesRecursive(subtask, localOutputs, warnings, errors, strict);
      }
    }
  }

  /**
   * Validate completeness of decomposition
   * @param {TaskNode} root - Root node
   * @param {Object} options - Validation options
   * @returns {Object} Completeness validation result
   */
  validateCompleteness(root, options = {}) {
    const { minSubtasks = 2, maxDepth = 10 } = options;
    const issues = [];
    const warnings = [];
    
    const stats = {
      totalTasks: 0,
      complexTasks: 0,
      simpleTasks: 0,
      maxDepthReached: 0,
      fullyDecomposed: true
    };
    
    this.traverseStructure(root, (node, depth, path) => {
      stats.totalTasks++;
      
      if (node.complexity === 'COMPLEX') {
        stats.complexTasks++;
        
        // Check if COMPLEX task is decomposed
        if (!node.subtasks || node.subtasks.length === 0) {
          stats.fullyDecomposed = false;
          issues.push({
            type: 'INCOMPLETE_DECOMPOSITION',
            task: node.description,
            message: 'COMPLEX task not decomposed into subtasks'
          });
        } else if (node.subtasks.length < minSubtasks) {
          warnings.push({
            type: 'TOO_FEW_SUBTASKS',
            task: node.description,
            count: node.subtasks.length,
            minimum: minSubtasks,
            message: 'COMPLEX task has fewer subtasks than recommended'
          });
        }
      } else if (node.complexity === 'SIMPLE') {
        stats.simpleTasks++;
      }
      
      // Track maximum depth
      if (depth > stats.maxDepthReached) {
        stats.maxDepthReached = depth;
      }
    });
    
    // Check maximum depth
    if (stats.maxDepthReached > maxDepth) {
      warnings.push({
        type: 'EXCESSIVE_DEPTH',
        depth: stats.maxDepthReached,
        maximum: maxDepth,
        message: 'Hierarchy exceeds recommended maximum depth'
      });
    }
    
    return {
      valid: issues.length === 0,
      stats,
      issues,
      warnings
    };
  }

  /**
   * Aggregate feasibility from leaf tasks
   * @param {TaskNode} root - Root node
   * @returns {Object} Aggregated feasibility result
   */
  aggregateFeasibility(root, options = {}) {
    const result = {
      overallFeasible: true,
      feasibleCount: 0,
      infeasibleCount: 0,
      infeasibleTasks: [],
      toolCoverage: {}
    };
    
    this.traverseStructure(root, (node, depth, path) => {
      // Only check SIMPLE tasks for feasibility
      if (node.complexity === 'SIMPLE') {
        if (node.feasible === true) {
          result.feasibleCount++;
          
          // Track tool usage
          if (node.tools && node.tools.length > 0) {
            node.tools.forEach(tool => {
              result.toolCoverage[tool.name] = (result.toolCoverage[tool.name] || 0) + 1;
            });
          }
        } else if (node.feasible === false) {
          result.infeasibleCount++;
          result.infeasibleTasks.push(node.description);
          result.overallFeasible = false;
        }
        // If feasible is undefined, we don't count it either way
      }
    });
    
    return result;
  }

  /**
   * Traverse hierarchy structure
   * @private
   */
  traverseStructure(node, callback, depth = 0, path = []) {
    const currentPath = [...path, node.description];
    callback(node, depth, currentPath);
    
    if (node.subtasks && node.subtasks.length > 0) {
      for (const subtask of node.subtasks) {
        this.traverseStructure(subtask, callback, depth + 1, currentPath);
      }
    }
  }

  /**
   * Generate validation summary
   * @private
   */
  generateSummary(results) {
    const issues = [];
    
    if (!results.structure.valid) {
      issues.push(`Structure errors: ${results.structure.errors.length}`);
    }
    
    if (!results.dependencies.valid) {
      issues.push(`Dependency errors: ${results.dependencies.errors.length}`);
    }
    
    if (!results.completeness.valid) {
      issues.push(`Completeness issues: ${results.completeness.issues.length}`);
    }
    
    if (!results.feasibility.overallFeasible) {
      issues.push(`Infeasible tasks: ${results.feasibility.infeasibleCount}`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
      message: issues.length === 0 
        ? 'Decomposition is valid and feasible' 
        : `Validation failed: ${issues.join(', ')}`
    };
  }

  /**
   * Generate human-readable validation report
   * @param {Object} validationResult - Result from validate()
   * @returns {string} Formatted report
   */
  generateReport(validationResult) {
    const lines = [
      '=== Decomposition Validation Report ===',
      '',
      `Overall Valid: ${validationResult.valid ? 'YES' : 'NO'}`,
      ''
    ];
    
    // Structure section
    lines.push('## Structure Validation');
    lines.push(`Valid: ${validationResult.structure.valid}`);
    if (validationResult.structure.errors.length > 0) {
      lines.push('Errors:');
      validationResult.structure.errors.forEach(error => {
        lines.push(`  - ${error.task}: ${error.message}`);
      });
    }
    lines.push('');
    
    // Dependencies section
    lines.push('## Dependencies Validation');
    lines.push(`Valid: ${validationResult.dependencies.valid}`);
    if (validationResult.dependencies.errors && validationResult.dependencies.errors.length > 0) {
      lines.push('Errors:');
      validationResult.dependencies.errors.forEach(error => {
        lines.push(`  - ${error.task}: ${error.message}`);
      });
    }
    if (validationResult.dependencies.warnings && validationResult.dependencies.warnings.length > 0) {
      lines.push('Warnings:');
      validationResult.dependencies.warnings.forEach(warning => {
        lines.push(`  - ${warning.task}: ${warning.message}`);
      });
    }
    lines.push('');
    
    // Completeness section
    lines.push('## Completeness Validation');
    lines.push(`Valid: ${validationResult.completeness.valid}`);
    if (validationResult.completeness.stats) {
      const stats = validationResult.completeness.stats;
      lines.push('Statistics:');
      lines.push(`  Total Tasks: ${stats.totalTasks}`);
      lines.push(`  Complex Tasks: ${stats.complexTasks}`);
      lines.push(`  Simple Tasks: ${stats.simpleTasks}`);
      lines.push(`  Max Depth: ${stats.maxDepthReached}`);
      lines.push(`  Fully Decomposed: ${stats.fullyDecomposed}`);
    }
    if (validationResult.completeness.issues && validationResult.completeness.issues.length > 0) {
      lines.push('Issues:');
      validationResult.completeness.issues.forEach(issue => {
        lines.push(`  - ${issue.task}: ${issue.message}`);
      });
    }
    lines.push('');
    
    // Feasibility section
    lines.push('## Feasibility Aggregation');
    lines.push(`Overall Feasible: ${validationResult.feasibility.overallFeasible}`);
    lines.push(`Feasible Tasks: ${validationResult.feasibility.feasibleCount}`);
    lines.push(`Infeasible Tasks: ${validationResult.feasibility.infeasibleCount}`);
    if (validationResult.feasibility.infeasibleTasks && validationResult.feasibility.infeasibleTasks.length > 0) {
      lines.push('Infeasible:');
      validationResult.feasibility.infeasibleTasks.forEach(task => {
        lines.push(`  - ${task}`);
      });
    }
    lines.push('');
    
    // Summary
    lines.push('## Summary');
    lines.push(validationResult.summary.message);
    
    return lines.join('\n');
  }
}