/**
 * LevelProcessingState - Tracks state during level-by-level processing
 */

export class LevelProcessingState {
  constructor(config = {}) {
    // Current processing level (starts at deepest, works up to 0)
    this.currentLevel = config.currentLevel || 0;
    
    // Nodes that have been processed
    this.processedNodes = config.processedNodes || [];
    
    // Nodes waiting to be processed
    this.pendingNodes = config.pendingNodes || [];
    
    // Synthetic tools created (taskId -> SyntheticTool)
    this.syntheticTools = config.syntheticTools || new Map();
    
    // BT plans for each level (level -> { taskId -> BT })
    this.levelPlans = config.levelPlans || {};
    
    // Processing errors
    this.errors = config.errors || [];
  }

  /**
   * Add a node to pending queue
   */
  addPendingNode(node) {
    this.pendingNodes.push(node);
  }

  /**
   * Mark a node as processed
   */
  markNodeProcessed(nodeId) {
    const nodeIndex = this.pendingNodes.findIndex(n => n.id === nodeId);
    if (nodeIndex !== -1) {
      const node = this.pendingNodes.splice(nodeIndex, 1)[0];
      this.processedNodes.push(node);
    }
  }

  /**
   * Get all nodes at a specific level
   */
  getNodesAtLevel(level) {
    return [
      ...this.pendingNodes.filter(n => n.level === level),
      ...this.processedNodes.filter(n => n.level === level)
    ];
  }

  /**
   * Check if all nodes at a level are processed
   */
  isLevelComplete(level) {
    const pendingAtLevel = this.pendingNodes.filter(n => n.level === level);
    return pendingAtLevel.length === 0;
  }

  /**
   * Register a synthetic tool
   */
  registerSyntheticTool(taskId, tool) {
    this.syntheticTools.set(taskId, tool);
  }

  /**
   * Get synthetic tools created at a specific level
   */
  getSyntheticToolsForLevel(level) {
    const tools = [];
    for (const tool of this.syntheticTools.values()) {
      if (tool.metadata && tool.metadata.level === level) {
        tools.push(tool);
      }
    }
    return tools;
  }

  /**
   * Get all synthetic tools
   */
  getAllSyntheticTools() {
    return Array.from(this.syntheticTools.values());
  }

  /**
   * Add a level plan
   */
  addLevelPlan(level, taskId, plan) {
    if (!this.levelPlans[level]) {
      this.levelPlans[level] = {};
    }
    this.levelPlans[level][taskId] = plan;
  }

  /**
   * Get plans for a level
   */
  getPlansForLevel(level) {
    return this.levelPlans[level] || {};
  }

  /**
   * Advance to next level (moving up the hierarchy)
   */
  advanceLevel() {
    this.currentLevel--;
  }

  /**
   * Check if processing is complete
   */
  isComplete() {
    return this.pendingNodes.length === 0;
  }

  /**
   * Add an error
   */
  addError(error) {
    this.errors.push(error);
  }

  /**
   * Check if there are errors
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Get processing statistics
   */
  getStatistics() {
    return {
      totalNodes: this.pendingNodes.length + this.processedNodes.length,
      processedNodes: this.processedNodes.length,
      pendingNodes: this.pendingNodes.length,
      syntheticTools: this.syntheticTools.size,
      currentLevel: this.currentLevel,
      errors: this.errors.length
    };
  }

  /**
   * Reset state
   */
  reset() {
    this.currentLevel = 0;
    this.processedNodes = [];
    this.pendingNodes = [];
    this.syntheticTools.clear();
    this.levelPlans = {};
    this.errors = [];
  }

  /**
   * Clone the current state
   */
  clone() {
    return new LevelProcessingState({
      currentLevel: this.currentLevel,
      processedNodes: [...this.processedNodes],
      pendingNodes: [...this.pendingNodes],
      syntheticTools: new Map(this.syntheticTools),
      levelPlans: JSON.parse(JSON.stringify(this.levelPlans)),
      errors: [...this.errors]
    });
  }
}