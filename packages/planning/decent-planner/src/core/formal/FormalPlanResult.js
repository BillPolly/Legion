/**
 * FormalPlanResult - Structure for final synthesis output
 */

export class FormalPlanResult {
  constructor(config = {}) {
    // Overall success flag
    this.success = config.success || false;
    
    // Complete executable BT for root task
    this.rootBehaviorTree = config.rootBehaviorTree || null;
    
    // All synthetic tools created during synthesis (name -> tool)
    this.syntheticTools = config.syntheticTools || {};
    
    // BTs for each level (level -> { taskId -> BT })
    this.levelPlans = config.levelPlans || {};
    
    // Expected artifacts at each level
    this.artifacts = config.artifacts || {};
    
    // Validation results for entire plan
    this.validation = config.validation || {
      valid: false,
      errors: [],
      warnings: []
    };
    
    // Metadata about the synthesis
    this.metadata = {
      createdAt: Date.now(),
      ...config.metadata
    };
  }

  /**
   * Set the root behavior tree
   */
  setRootBehaviorTree(bt) {
    this.rootBehaviorTree = bt;
    this.success = bt !== null;
  }

  /**
   * Add a synthetic tool
   */
  addSyntheticTool(tool) {
    this.syntheticTools[tool.name] = tool;
  }

  /**
   * Add multiple synthetic tools
   */
  addSyntheticTools(tools) {
    for (const tool of tools) {
      this.addSyntheticTool(tool);
    }
  }

  /**
   * Get a synthetic tool by name
   */
  getSyntheticTool(name) {
    return this.syntheticTools[name] || null;
  }

  /**
   * Add level plans
   */
  addLevelPlan(level, plans) {
    this.levelPlans[level] = plans;
  }

  /**
   * Get plans for a specific level
   */
  getLevelPlans(level) {
    return this.levelPlans[level] || {};
  }

  /**
   * Set artifacts for a level
   */
  setArtifacts(level, artifacts) {
    this.artifacts[level] = artifacts;
  }

  /**
   * Get all artifacts aggregated
   */
  getAllArtifacts() {
    const all = {};
    for (const levelArtifacts of Object.values(this.artifacts)) {
      Object.assign(all, levelArtifacts);
    }
    return all;
  }

  /**
   * Set validation result
   */
  setValidation(validation) {
    this.validation = validation;
  }

  /**
   * Add validation error
   */
  addValidationError(error) {
    this.validation.errors.push(error);
    this.validation.valid = false;
  }

  /**
   * Add validation warning
   */
  addValidationWarning(warning) {
    this.validation.warnings.push(warning);
  }

  /**
   * Check if result is valid
   */
  isValid() {
    return this.success && this.validation.valid;
  }

  /**
   * Add metadata
   */
  addMetadata(key, value) {
    this.metadata[key] = value;
  }

  /**
   * Get statistics about the result
   */
  getStatistics() {
    return {
      syntheticToolCount: Object.keys(this.syntheticTools).length,
      levelCount: Object.keys(this.levelPlans).length,
      totalPlans: Object.values(this.levelPlans).reduce(
        (sum, level) => sum + Object.keys(level).length, 0
      ),
      validationErrors: this.validation.errors.length,
      validationWarnings: this.validation.warnings.length,
      isValid: this.isValid()
    };
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      success: this.success,
      rootBehaviorTree: this.rootBehaviorTree,
      syntheticTools: this.syntheticTools,
      levelPlans: this.levelPlans,
      artifacts: this.artifacts,
      validation: this.validation,
      metadata: this.metadata
    };
  }

  /**
   * Create a summary string
   */
  getSummary() {
    const stats = this.getStatistics();
    const status = this.success ? 'SUCCESS' : 'FAILURE';
    
    return `Formal Plan Result: ${status}
- ${stats.syntheticToolCount} synthetic tools created
- ${stats.levelCount} levels processed
- ${stats.totalPlans} total plans generated
- Validation: ${stats.validationErrors} errors, ${stats.validationWarnings} warning${stats.validationWarnings !== 1 ? 's' : ''}
- Valid: ${stats.isValid}`;
  }
}