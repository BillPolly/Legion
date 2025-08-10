/**
 * ValidatedSubtree - Encapsulates a validated behavior tree component
 * 
 * Represents a validated subtree that can be treated as an atomic unit
 * at higher levels of the hierarchy. Each subtree has clear input/output
 * contracts and can be composed into larger behavior trees.
 */

export class ValidatedSubtree {
  constructor(taskNode, behaviorTree, validation) {
    this.id = taskNode.id;
    this.description = taskNode.description;
    this.level = taskNode.level;
    this.complexity = taskNode.complexity;
    
    // The behavior tree for this subtree
    this.behaviorTree = behaviorTree;
    
    // Validation results
    this.validation = validation;
    this.isValid = validation?.valid || false;
    
    // I/O contract
    this.inputs = new Set();
    this.outputs = new Set();
    this.internalArtifacts = new Set();
    
    // Child subtrees (for complex tasks)
    this.children = [];
    
    // Parent reference
    this.parent = null;
    
    // Extract I/O from task node
    this._extractIO(taskNode);
  }
  
  /**
   * Extract inputs and outputs from task node
   * @private
   */
  _extractIO(taskNode) {
    // Add suggested I/O from task node
    if (taskNode.suggestedInputs) {
      taskNode.suggestedInputs.forEach(input => this.inputs.add(input));
    }
    
    if (taskNode.suggestedOutputs) {
      taskNode.suggestedOutputs.forEach(output => this.outputs.add(output));
    }
  }
  
  /**
   * Add a child subtree
   * @param {ValidatedSubtree} childSubtree - Child to add
   */
  addChild(childSubtree) {
    this.children.push(childSubtree);
    childSubtree.parent = this;
    
    // Update I/O contract based on child
    this._aggregateChildIO(childSubtree);
  }
  
  /**
   * Aggregate I/O from child subtree
   * @private
   */
  _aggregateChildIO(childSubtree) {
    // Child inputs that aren't satisfied by siblings become parent inputs
    for (const input of childSubtree.inputs) {
      if (!this._isProvidedBySibling(input, childSubtree)) {
        this.inputs.add(input);
      } else {
        // It's an internal artifact
        this.internalArtifacts.add(input);
      }
    }
    
    // All child outputs bubble up
    for (const output of childSubtree.outputs) {
      this.outputs.add(output);
    }
  }
  
  /**
   * Check if an input is provided by a sibling
   * @private
   */
  _isProvidedBySibling(input, childSubtree) {
    for (const sibling of this.children) {
      if (sibling !== childSubtree && sibling.outputs.has(input)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Compose behavior tree from children
   * Creates a sequence or parallel node containing all child BTs
   */
  composeBehaviorTree() {
    if (this.complexity === 'SIMPLE' || this.children.length === 0) {
      // Simple task or no children - use existing BT
      return this.behaviorTree;
    }
    
    // Analyze dependencies to determine composition strategy
    const hasInterdependencies = this._hasInterdependencies();
    
    if (hasInterdependencies) {
      // Use sequence for dependent tasks
      return this._composeSequence();
    } else {
      // Use parallel for independent tasks
      return this._composeParallel();
    }
  }
  
  /**
   * Check if children have interdependencies
   * @private
   */
  _hasInterdependencies() {
    for (let i = 0; i < this.children.length; i++) {
      for (let j = i + 1; j < this.children.length; j++) {
        const child1 = this.children[i];
        const child2 = this.children[j];
        
        // Check if child2 depends on child1's outputs
        for (const output of child1.outputs) {
          if (child2.inputs.has(output)) {
            return true;
          }
        }
        
        // Check if child1 depends on child2's outputs
        for (const output of child2.outputs) {
          if (child1.inputs.has(output)) {
            return true;
          }
        }
      }
    }
    return false;
  }
  
  /**
   * Compose children as a sequence
   * @private
   */
  _composeSequence() {
    // Sort children by dependencies
    const sorted = this._topologicalSort();
    
    return {
      type: 'sequence',
      id: `${this.id}-sequence`,
      description: `Sequential execution of: ${this.description}`,
      children: sorted.map(child => child.behaviorTree)
    };
  }
  
  /**
   * Compose children as parallel execution
   * @private
   */
  _composeParallel() {
    return {
      type: 'parallel',
      id: `${this.id}-parallel`,
      description: `Parallel execution of: ${this.description}`,
      successPolicy: 'all', // All children must succeed
      children: this.children.map(child => child.behaviorTree)
    };
  }
  
  /**
   * Topologically sort children based on dependencies
   * @private
   */
  _topologicalSort() {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();
    
    const visit = (node) => {
      if (visited.has(node)) return;
      if (visiting.has(node)) {
        throw new Error(`Circular dependency detected at ${node.description}`);
      }
      
      visiting.add(node);
      
      // Visit dependencies first
      for (const dep of this._getDependencies(node)) {
        visit(dep);
      }
      
      visiting.delete(node);
      visited.add(node);
      sorted.push(node);
    };
    
    for (const child of this.children) {
      visit(child);
    }
    
    return sorted;
  }
  
  /**
   * Get dependencies of a child (other children that produce its inputs)
   * @private
   */
  _getDependencies(child) {
    const deps = [];
    
    for (const input of child.inputs) {
      for (const other of this.children) {
        if (other !== child && other.outputs.has(input)) {
          deps.push(other);
        }
      }
    }
    
    return deps;
  }
  
  /**
   * Get the final I/O contract after all children are added
   */
  getContract() {
    // Recalculate to ensure accuracy
    this._recalculateContract();
    
    return {
      inputs: Array.from(this.inputs),
      outputs: Array.from(this.outputs),
      internal: Array.from(this.internalArtifacts)
    };
  }
  
  /**
   * Recalculate I/O contract from children
   * @private
   */
  _recalculateContract() {
    if (this.children.length === 0) return;
    
    // Clear and rebuild
    const newInputs = new Set();
    const newOutputs = new Set();
    const newInternal = new Set();
    
    // Collect all child outputs first
    const allChildOutputs = new Set();
    for (const child of this.children) {
      for (const output of child.outputs) {
        allChildOutputs.add(output);
        newOutputs.add(output);
      }
    }
    
    // Now determine which inputs are external vs internal
    for (const child of this.children) {
      for (const input of child.inputs) {
        if (allChildOutputs.has(input)) {
          // Satisfied internally
          newInternal.add(input);
        } else {
          // External input needed
          newInputs.add(input);
        }
      }
    }
    
    this.inputs = newInputs;
    this.outputs = newOutputs;
    this.internalArtifacts = newInternal;
  }
  
  /**
   * Validate the subtree and all its children
   */
  async validate(validator, tools) {
    // If simple task, validate its behavior tree
    if (this.complexity === 'SIMPLE') {
      this.validation = await validator.validate(this.behaviorTree, tools);
      this.isValid = this.validation.valid;
      return this.validation;
    }
    
    // For complex tasks, validate all children first
    let allValid = true;
    const childValidations = [];
    
    for (const child of this.children) {
      const childValidation = await child.validate(validator, tools);
      childValidations.push(childValidation);
      if (!childValidation.valid) {
        allValid = false;
      }
    }
    
    // If all children are valid, validate the composed tree
    if (allValid) {
      const composedTree = this.composeBehaviorTree();
      this.behaviorTree = composedTree;
      this.validation = await validator.validate(composedTree, tools);
      this.isValid = this.validation.valid;
    } else {
      this.validation = {
        valid: false,
        errors: ['One or more child subtrees failed validation'],
        childValidations
      };
      this.isValid = false;
    }
    
    return this.validation;
  }
  
  /**
   * Convert to a flat execution plan
   */
  toExecutionPlan() {
    const tasks = [];
    
    if (this.complexity === 'SIMPLE') {
      // Simple task - add directly
      tasks.push({
        taskId: this.id,
        description: this.description,
        behaviorTree: this.behaviorTree,
        inputs: Array.from(this.inputs),
        outputs: Array.from(this.outputs),
        level: this.level
      });
    } else {
      // Complex task - recursively add children
      for (const child of this.children) {
        tasks.push(...child.toExecutionPlan());
      }
    }
    
    return tasks;
  }
  
  /**
   * Get a summary of this subtree
   */
  getSummary() {
    return {
      id: this.id,
      description: this.description,
      complexity: this.complexity,
      level: this.level,
      isValid: this.isValid,
      contract: this.getContract(),
      childCount: this.children.length,
      totalTasks: this.complexity === 'SIMPLE' ? 1 : 
                  this.children.reduce((sum, child) => sum + child.getTotalTasks(), 0)
    };
  }
  
  /**
   * Get total number of simple tasks in this subtree
   */
  getTotalTasks() {
    if (this.complexity === 'SIMPLE') {
      return 1;
    }
    return this.children.reduce((sum, child) => sum + child.getTotalTasks(), 0);
  }
}