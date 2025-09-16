/**
 * ResourceAnalyzer - Analyzes resource requirements and conflicts
 * Single responsibility: Resource dependency analysis
 */

export class ResourceAnalyzer {
  constructor() {
    this.resourceMap = new Map();
    this.conflicts = [];
    this.missing = [];
  }

  /**
   * Analyze resource requirements for tasks
   * @param {Array<Object>} tasks - Tasks to analyze
   * @param {Object} context - Context with available resources
   * @returns {Object} - Resource analysis results
   */
  analyzeResources(tasks, context = {}) {
    this.reset();
    
    for (const task of tasks) {
      const taskId = this.getTaskId(task);
      const requirements = this.extractResourceRequirements(task);
      
      this.resourceMap.set(taskId, requirements);
      
      // Check for missing resources
      this.checkMissingResources(taskId, requirements, context);
      
      // Check for conflicts with other tasks
      this.checkResourceConflicts(taskId, requirements);
    }
    
    return {
      resourceMap: new Map(this.resourceMap),
      conflicts: [...this.conflicts],
      missing: [...this.missing],
      available: this.getAvailableResources(context),
      statistics: this.getStatistics()
    };
  }

  /**
   * Extract resource requirements from a task
   * @param {Object} task - Task to analyze
   * @returns {Object} - Resource requirements
   */
  extractResourceRequirements(task) {
    const requirements = {
      inputs: [],
      outputs: [],
      exclusive: [],
      shared: []
    };
    
    // Explicit resource declarations
    if (task.resources) {
      requirements.inputs.push(...(task.resources.inputs || []));
      requirements.outputs.push(...(task.resources.outputs || []));
      requirements.exclusive.push(...(task.resources.exclusive || []));
      requirements.shared.push(...(task.resources.shared || []));
    }
    
    // Infer from tool requirements
    if (task.tool || task.toolName) {
      const toolName = task.tool || task.toolName;
      requirements.inputs.push(`tool:${toolName}`);
      
      // Some tools require exclusive access
      if (this.isExclusiveTool(toolName)) {
        requirements.exclusive.push(`tool:${toolName}`);
      }
    }
    
    // Infer from parameters
    this.inferParameterResources(task, requirements);
    
    return requirements;
  }

  /**
   * Check for missing resources
   * @private
   */
  checkMissingResources(taskId, requirements, context) {
    const available = this.getAvailableResources(context);
    
    for (const resource of [...requirements.inputs, ...requirements.exclusive]) {
      if (!available.includes(resource)) {
        this.missing.push({
          taskId,
          resource,
          type: 'missing'
        });
      }
    }
  }

  /**
   * Check for resource conflicts
   * @private
   */
  checkResourceConflicts(taskId, requirements) {
    for (const [otherTaskId, otherRequirements] of this.resourceMap) {
      if (otherTaskId === taskId) continue;
      
      // Check exclusive resource conflicts
      for (const resource of requirements.exclusive) {
        if (otherRequirements.exclusive.includes(resource)) {
          this.conflicts.push({
            resource,
            tasks: [taskId, otherTaskId],
            type: 'exclusive_conflict'
          });
        }
      }
      
      // Check output/input conflicts
      for (const output of requirements.outputs) {
        if (otherRequirements.outputs.includes(output)) {
          this.conflicts.push({
            resource: output,
            tasks: [taskId, otherTaskId],
            type: 'output_conflict'
          });
        }
      }
    }
  }

  /**
   * Infer resources from parameters
   * @private
   */
  inferParameterResources(task, requirements) {
    if (task.inputs) {
      Object.keys(task.inputs).forEach(key => {
        requirements.inputs.push(`param:${key}`);
      });
    }
    
    if (task.outputs) {
      Object.keys(task.outputs).forEach(key => {
        requirements.outputs.push(`param:${key}`);
      });
    }
    
    if (task.params) {
      Object.keys(task.params).forEach(key => {
        requirements.inputs.push(`param:${key}`);
      });
    }
  }

  /**
   * Check if tool requires exclusive access
   * @private
   */
  isExclusiveTool(toolName) {
    const exclusiveTools = [
      'file_write',
      'database_write',
      'process_execute',
      'system_modify',
      'configuration_update'
    ];
    return exclusiveTools.includes(toolName);
  }

  /**
   * Get available resources from context
   * @private
   */
  getAvailableResources(context) {
    const resources = [];
    
    // Add explicitly declared resources
    if (context.availableResources) {
      resources.push(...context.availableResources);
    }
    
    // Add default system resources
    resources.push('cpu', 'memory', 'disk', 'network');
    
    // Add tool resources if available
    if (context.availableTools) {
      context.availableTools.forEach(tool => {
        resources.push(`tool:${tool}`);
      });
    }
    
    return [...new Set(resources)];
  }

  /**
   * Get resource conflict resolution suggestions
   * @returns {Array<Object>} - Resolution suggestions
   */
  getConflictResolutions() {
    const resolutions = [];
    
    for (const conflict of this.conflicts) {
      if (conflict.type === 'exclusive_conflict') {
        resolutions.push({
          conflict,
          suggestion: 'Serialize task execution',
          implementation: {
            type: 'add_dependency',
            from: conflict.tasks[0],
            to: conflict.tasks[1]
          }
        });
      } else if (conflict.type === 'output_conflict') {
        resolutions.push({
          conflict,
          suggestion: 'Rename output resources',
          implementation: {
            type: 'rename_resource',
            tasks: conflict.tasks,
            resource: conflict.resource
          }
        });
      }
    }
    
    return resolutions;
  }

  /**
   * Get statistics
   * @private
   */
  getStatistics() {
    let totalInputs = 0;
    let totalOutputs = 0;
    let totalExclusive = 0;
    let totalShared = 0;
    
    for (const requirements of this.resourceMap.values()) {
      totalInputs += requirements.inputs.length;
      totalOutputs += requirements.outputs.length;
      totalExclusive += requirements.exclusive.length;
      totalShared += requirements.shared.length;
    }
    
    return {
      taskCount: this.resourceMap.size,
      totalInputs,
      totalOutputs,
      totalExclusive,
      totalShared,
      conflictCount: this.conflicts.length,
      missingCount: this.missing.length
    };
  }

  /**
   * Get task ID
   * @private
   */
  getTaskId(task) {
    return task.id || task.taskId || task.name || `task-${Date.now()}`;
  }

  /**
   * Reset analyzer state
   * @private
   */
  reset() {
    this.resourceMap.clear();
    this.conflicts = [];
    this.missing = [];
  }
}