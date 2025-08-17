/**
 * ToolFeasibilityChecker - Discovers and validates tools for SIMPLE tasks
 */

export class ToolFeasibilityChecker {
  constructor(toolRegistry, options = {}) {
    if (!toolRegistry) {
      throw new Error('ToolRegistry is required');
    }
    
    this.toolRegistry = toolRegistry;
    this.confidenceThreshold = options.confidenceThreshold || 0.7;
    this.maxTools = options.maxTools || 10;
  }

  /**
   * Check if a task is feasible by discovering appropriate tools
   * @param {TaskNode} task - The task to check
   * @returns {Promise<Object>} Feasibility result with tools
   */
  async checkTaskFeasibility(task) {
    if (!task) {
      throw new Error('Task is required');
    }
    
    if (!task.description) {
      throw new Error('Invalid task: missing description');
    }
    
    // COMPLEX tasks don't need tools directly
    if (task.complexity === 'COMPLEX') {
      return {
        feasible: true,
        tools: [],
        reason: 'COMPLEX tasks do not require tools directly'
      };
    }
    
    // Build search query from description and I/O hints
    const searchQuery = this.buildSearchQuery(task);
    
    // Search for relevant tools
    const discoveredTools = await this.toolRegistry.searchTools(searchQuery, {
      limit: this.maxTools * 2 // Get more to filter by confidence
    });
    
    // Filter by confidence threshold and limit
    const qualifiedTools = discoveredTools
      .filter(tool => tool.confidence >= this.confidenceThreshold)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.maxTools);
    
    // Determine feasibility
    const feasible = qualifiedTools.length > 0;
    
    // Annotate task with tool information
    task.tools = qualifiedTools;
    task.feasible = feasible;
    
    return {
      feasible,
      tools: qualifiedTools,
      reason: feasible 
        ? `Found ${qualifiedTools.length} suitable tools`
        : qualifiedTools.length === 0 && discoveredTools.length === 0
          ? 'No tools found for this task'
          : `No tools with sufficient confidence (threshold: ${this.confidenceThreshold})`
    };
  }

  /**
   * Check feasibility of an entire task hierarchy
   * @param {TaskNode} root - Root of the task hierarchy
   * @returns {Promise<Object>} Aggregated feasibility result
   */
  async checkHierarchyFeasibility(root) {
    const results = {
      feasible: true,
      totalTasks: 0,
      simpleTasks: 0,
      feasibleTasks: 0,
      infeasibleTasks: [],
      toolCoverage: {}
    };
    
    // Traverse hierarchy and check each task
    await this.traverseAndCheck(root, results);
    
    // Overall feasibility: all SIMPLE tasks must be feasible
    results.feasible = results.infeasibleTasks.length === 0;
    
    return results;
  }

  /**
   * Recursively traverse and check tasks
   * @private
   */
  async traverseAndCheck(node, results) {
    results.totalTasks++;
    
    if (node.complexity === 'SIMPLE') {
      results.simpleTasks++;
      
      const feasibility = await this.checkTaskFeasibility(node);
      
      if (feasibility.feasible) {
        results.feasibleTasks++;
        
        // Track tool coverage
        feasibility.tools.forEach(tool => {
          results.toolCoverage[tool.name] = (results.toolCoverage[tool.name] || 0) + 1;
        });
      } else {
        results.infeasibleTasks.push({
          task: node.description,
          reason: feasibility.reason,
          path: this.getTaskPath(node)
        });
      }
    }
    
    // Check subtasks
    if (node.subtasks && node.subtasks.length > 0) {
      for (const subtask of node.subtasks) {
        await this.traverseAndCheck(subtask, results);
      }
    }
  }

  /**
   * Build search query from task information
   * @private
   */
  buildSearchQuery(task) {
    const parts = [task.description];
    
    // Add I/O hints if available
    if (task.suggestedInputs && task.suggestedInputs.length > 0) {
      parts.push(`inputs: ${task.suggestedInputs.join(', ')}`);
    }
    
    if (task.suggestedOutputs && task.suggestedOutputs.length > 0) {
      parts.push(`outputs: ${task.suggestedOutputs.join(', ')}`);
    }
    
    return parts.join(' ');
  }

  /**
   * Get the path to a task in the hierarchy
   * @private
   */
  getTaskPath(node) {
    // Simple implementation - could be enhanced to track actual path
    return node.id || node.description;
  }

  /**
   * Generate a feasibility report
   * @param {Object} results - Results from checkHierarchyFeasibility
   * @returns {string} Human-readable report
   */
  generateReport(results) {
    const lines = [
      '=== Tool Feasibility Report ===',
      '',
      `Total Tasks: ${results.totalTasks}`,
      `Simple Tasks: ${results.simpleTasks}`,
      `Feasible Tasks: ${results.feasibleTasks}`,
      `Overall Feasible: ${results.feasible ? 'YES' : 'NO'}`,
      ''
    ];
    
    if (results.infeasibleTasks.length > 0) {
      lines.push('Infeasible Tasks:');
      results.infeasibleTasks.forEach(task => {
        lines.push(`  - ${task.task}`);
        lines.push(`    Reason: ${task.reason}`);
      });
      lines.push('');
    }
    
    if (Object.keys(results.toolCoverage).length > 0) {
      lines.push('Tool Coverage:');
      Object.entries(results.toolCoverage)
        .sort((a, b) => b[1] - a[1])
        .forEach(([tool, count]) => {
          lines.push(`  - ${tool}: ${count} task(s)`);
        });
    }
    
    return lines.join('\n');
  }
}