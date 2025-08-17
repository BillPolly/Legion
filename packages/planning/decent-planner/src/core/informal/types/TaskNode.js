/**
 * TaskNode - Represents a single task in the decomposition hierarchy
 */

export class TaskNode {
  constructor(config = {}) {
    // Validate required fields
    if (!config.description) {
      throw new Error('description is required');
    }
    if (!config.complexity) {
      throw new Error('complexity is required');
    }

    // Validate complexity value
    if (config.complexity !== 'SIMPLE' && config.complexity !== 'COMPLEX') {
      throw new Error(`Invalid complexity: ${config.complexity}. Must be SIMPLE or COMPLEX`);
    }

    // Generate ID if not provided
    this.id = config.id || this._generateId();
    this.description = config.description;
    this.complexity = config.complexity;
    this.reasoning = config.reasoning;
    this.suggestedInputs = config.suggestedInputs || [];
    this.suggestedOutputs = config.suggestedOutputs || [];

    // SIMPLE-specific fields
    if (this.complexity === 'SIMPLE') {
      if (config.subtasks && config.subtasks.length > 0) {
        throw new Error('SIMPLE tasks cannot have subtasks');
      }
      
      if (config.tools) {
        this._validateTools(config.tools);
        this.tools = config.tools;
      }
      
      this.feasible = config.feasible;
    }

    // COMPLEX-specific fields
    if (this.complexity === 'COMPLEX') {
      if (config.tools) {
        throw new Error('COMPLEX tasks cannot have tools');
      }
      
      this.subtasks = config.subtasks || [];
    }
  }

  /**
   * Generate unique task ID
   * @private
   */
  _generateId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `task-${timestamp}-${random}`;
  }

  /**
   * Validate tool structure
   * @private
   */
  _validateTools(tools) {
    if (!Array.isArray(tools)) {
      throw new Error('Tools must be an array');
    }

    tools.forEach(tool => {
      if (!tool.name) {
        throw new Error('Tool must have name');
      }
      if (tool.confidence === undefined) {
        throw new Error('Tool must have confidence score');
      }
      if (tool.confidence < 0 || tool.confidence > 1) {
        throw new Error('Confidence must be between 0 and 1');
      }
    });
  }

  /**
   * Add a subtask to this node (only for COMPLEX tasks)
   */
  addSubtask(taskNode) {
    if (this.complexity !== 'COMPLEX') {
      throw new Error('Cannot add subtask to SIMPLE task');
    }
    
    if (!this.subtasks) {
      this.subtasks = [];
    }
    
    this.subtasks.push(taskNode);
  }

  /**
   * Check if this is a leaf node (SIMPLE task)
   */
  isLeaf() {
    return this.complexity === 'SIMPLE';
  }

  /**
   * Convert to plain object for serialization
   */
  toObject() {
    const obj = {
      id: this.id,
      description: this.description,
      complexity: this.complexity,
      reasoning: this.reasoning,
      suggestedInputs: this.suggestedInputs,
      suggestedOutputs: this.suggestedOutputs
    };

    if (this.complexity === 'SIMPLE') {
      obj.tools = this.tools;
      obj.feasible = this.feasible;
    } else {
      obj.subtasks = this.subtasks;
    }

    return obj;
  }
}