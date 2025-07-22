/**
 * WorkingSet - Active tool management system
 * 
 * Manages the active subset of tools with priority-based selection,
 * context-aware suggestions, and size-limited working sets
 */

export class WorkingSet {
  constructor(toolRegistry, options = {}) {
    this.registry = toolRegistry;
    this.options = {
      maxSize: options.maxSize || 20,
      evictionPolicy: options.evictionPolicy || 'lru', // 'lru', 'priority', 'fifo'
      autoActivation: options.autoActivation || false,
      autoActivationThreshold: options.autoActivationThreshold || 0.8,
      maxAutoActivations: options.maxAutoActivations || 3,
      maxSuggestions: options.maxSuggestions || 5,
      ...options
    };

    // Core storage
    this.activeTools = new Set();
    this.toolPriorities = new Map();
    this.toolUsage = new Map();
    this.activationOrder = [];
    this.activationHistory = [];
    
    // Context tracking
    this.context = {
      recentOperations: [],
      dataTypes: [],
      workflowStage: null
    };
  }

  /**
   * Activate a tool in the working set
   */
  activateTool(toolName, options = {}) {
    if (!this.registry.hasTool(toolName)) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    if (this.activeTools.has(toolName)) {
      return true; // Already active
    }

    // Handle size limits
    this._ensureCapacity();

    // Add to active set
    this.activeTools.add(toolName);
    this.activationOrder.push({
      tool: toolName,
      timestamp: new Date()
    });

    // Set priority
    const priority = options.priority || 1;
    this.toolPriorities.set(toolName, priority);

    // Initialize usage tracking
    if (!this.toolUsage.has(toolName)) {
      this.toolUsage.set(toolName, {
        count: 0,
        lastUsed: null,
        activatedAt: new Date()
      });
    }

    // Record in history
    this.activationHistory.push({
      action: 'activate',
      tool: toolName,
      timestamp: new Date(),
      priority: priority
    });

    return true;
  }

  /**
   * Deactivate a tool from the working set
   */
  deactivateTool(toolName) {
    if (!this.activeTools.has(toolName)) {
      return false;
    }

    this.activeTools.delete(toolName);
    this.toolPriorities.delete(toolName);
    
    // Remove from activation order
    this.activationOrder = this.activationOrder.filter(
      entry => entry.tool !== toolName
    );

    // Record in history
    this.activationHistory.push({
      action: 'deactivate',
      tool: toolName,
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Check if a tool is active
   */
  isActive(toolName) {
    return this.activeTools.has(toolName);
  }

  /**
   * Get all active tool names
   */
  getActiveTools() {
    return Array.from(this.activeTools);
  }

  /**
   * Get active tool count
   */
  getActiveToolCount() {
    return this.activeTools.size;
  }

  /**
   * Update tool priority
   */
  updateToolPriority(toolName, priority) {
    if (!this.activeTools.has(toolName)) {
      throw new Error(`Tool not active: ${toolName}`);
    }

    this.toolPriorities.set(toolName, priority);
  }

  /**
   * Get tool priorities
   */
  getToolPriorities() {
    return Object.fromEntries(this.toolPriorities);
  }

  /**
   * Get tools ordered by priority (highest first)
   */
  getToolsByPriority() {
    return Array.from(this.activeTools).sort((a, b) => {
      const priorityA = this.toolPriorities.get(a) || 1;
      const priorityB = this.toolPriorities.get(b) || 1;
      return priorityB - priorityA;
    });
  }

  /**
   * Set maximum working set size
   */
  setMaxSize(newSize) {
    this.options.maxSize = newSize;
    this._enforceSize();
  }

  /**
   * Record tool usage
   */
  recordUsage(toolName) {
    if (!this.toolUsage.has(toolName)) {
      this.toolUsage.set(toolName, {
        count: 0,
        lastUsed: null,
        activatedAt: null
      });
    }

    const usage = this.toolUsage.get(toolName);
    usage.count++;
    usage.lastUsed = new Date();

    // Also record in registry if tool exists there
    if (this.registry.hasTool(toolName)) {
      this.registry.recordUsage(toolName);
    }
  }

  /**
   * Get tool usage statistics
   */
  getToolUsage(toolName) {
    return this.toolUsage.get(toolName) || { count: 0, lastUsed: null };
  }

  /**
   * Get context-aware tool suggestions
   */
  getSuggestedTools() {
    const suggestions = [];
    const activeToolNames = Array.from(this.activeTools);

    // Get suggestions from registry based on active tools
    for (const activeTool of activeToolNames) {
      const registrySuggestions = this.registry.getSuggestedTools(activeTool);
      suggestions.push(...registrySuggestions);
    }

    // Add usage-based suggestions
    const usageStats = this.registry.getUsageStatistics();
    if (usageStats.mostUsed && usageStats.mostUsed.length > 0) {
      for (const { tool, count } of usageStats.mostUsed.slice(0, 3)) {
        if (!this.activeTools.has(tool) && count > 1) {
          suggestions.push({
            name: tool,
            reason: `frequently used (${count} times)`,
            score: 0.7
          });
        }
      }
    }

    // Add dependency-based suggestions
    for (const activeTool of activeToolNames) {
      const dependents = this.registry.getDependents(activeTool);
      for (const dependent of dependents) {
        if (!this.activeTools.has(dependent)) {
          suggestions.push({
            name: dependent,
            reason: `depends on active tool: ${activeTool}`,
            score: 0.9
          });
        }
      }
    }

    // Remove duplicates and filter out active tools
    const uniqueSuggestions = suggestions
      .filter(s => !this.activeTools.has(s.name))
      .filter((suggestion, index, array) => 
        array.findIndex(s => s.name === suggestion.name) === index
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, this.options.maxSuggestions);

    return uniqueSuggestions;
  }

  /**
   * Update context for auto-activation
   */
  updateContext(newContext) {
    this.context = { ...this.context, ...newContext };
  }

  /**
   * Process auto-activation based on context
   */
  processAutoActivation() {
    if (!this.options.autoActivation) {
      return;
    }

    const { recentOperations = [], dataTypes = [] } = this.context;
    const candidates = new Map(); // tool -> score

    // Score tools based on context
    for (const tool of this.registry.getAllTools()) {
      if (this.activeTools.has(tool.name)) {
        continue; // Already active
      }

      let score = 0;
      const metadata = this.registry.getToolMetadata(tool.name);
      
      if (metadata) {
        // Score based on recent operations
        for (const op of recentOperations) {
          if (metadata.tags && metadata.tags.some(tag => 
            op.toLowerCase().includes(tag.toLowerCase())
          )) {
            score += 0.3;
          }
          
          if (metadata.description && 
            metadata.description.toLowerCase().includes(op.toLowerCase())) {
            score += 0.2;
          }
        }

        // Score based on data types
        for (const type of dataTypes) {
          if (metadata.tags && metadata.tags.some(tag => 
            tag.toLowerCase().includes(type.toLowerCase())
          )) {
            score += 0.2;
          }
        }
      }

      if (score >= this.options.autoActivationThreshold) {
        candidates.set(tool.name, score);
      }
    }

    // Activate top candidates up to limit
    const sortedCandidates = Array.from(candidates.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, this.options.maxAutoActivations);

    for (const [toolName] of sortedCandidates) {
      this.activateTool(toolName, { priority: 2 }); // Medium priority for auto-activated
    }
  }

  /**
   * Get activation history
   */
  getActivationHistory() {
    return [...this.activationHistory];
  }

  /**
   * Get working set statistics
   */
  getStatistics() {
    const totalUsage = Array.from(this.toolUsage.values())
      .reduce((sum, usage) => sum + usage.count, 0);

    const priorities = Array.from(this.toolPriorities.values());
    const averagePriority = priorities.length > 0 ? 
      priorities.reduce((sum, p) => sum + p, 0) / priorities.length : 0;

    return {
      activeToolCount: this.activeTools.size,
      totalUsage,
      averagePriority,
      maxSize: this.options.maxSize,
      evictionPolicy: this.options.evictionPolicy,
      autoActivationEnabled: this.options.autoActivation
    };
  }

  /**
   * Get tool effectiveness metrics
   */
  getToolEffectiveness(toolName) {
    const usage = this.toolUsage.get(toolName);
    if (!usage || !usage.activatedAt) {
      return { usageRate: 0, effectiveness: 0 };
    }

    const timeActive = Date.now() - usage.activatedAt.getTime();
    const hoursActive = timeActive / (1000 * 60 * 60);
    const usageRate = hoursActive > 0 ? usage.count / hoursActive : 0;

    return {
      usageRate,
      effectiveness: Math.min(usageRate * 10, 1) // Normalize to 0-1
    };
  }

  /**
   * Save working set state
   */
  saveState() {
    return {
      activeTools: Array.from(this.activeTools),
      toolPriorities: Object.fromEntries(this.toolPriorities),
      toolUsage: Object.fromEntries(
        Array.from(this.toolUsage.entries()).map(([name, usage]) => [
          name,
          { ...usage, activatedAt: usage.activatedAt?.toISOString() || null }
        ])
      ),
      activationHistory: this.activationHistory.map(entry => ({
        ...entry,
        timestamp: entry.timestamp.toISOString()
      })),
      context: this.context,
      options: this.options
    };
  }

  /**
   * Restore working set state
   */
  restoreState(state) {
    this.clear();

    // Restore active tools and priorities
    for (const toolName of state.activeTools) {
      if (this.registry.hasTool(toolName)) {
        this.activeTools.add(toolName);
        const priority = state.toolPriorities[toolName] || 1;
        this.toolPriorities.set(toolName, priority);
      }
    }

    // Restore usage data
    if (state.toolUsage) {
      for (const [name, usage] of Object.entries(state.toolUsage)) {
        this.toolUsage.set(name, {
          ...usage,
          activatedAt: usage.activatedAt ? new Date(usage.activatedAt) : null
        });
      }
    }

    // Restore history
    if (state.activationHistory) {
      this.activationHistory = state.activationHistory.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp)
      }));
    }

    // Restore context
    if (state.context) {
      this.context = state.context;
    }

    // Restore options
    if (state.options) {
      this.options = { ...this.options, ...state.options };
    }
  }

  /**
   * Clear working set
   */
  clear() {
    this.activeTools.clear();
    this.toolPriorities.clear();
    this.activationOrder = [];
    this.activationHistory = [];
  }

  /**
   * Clone working set
   */
  clone() {
    const cloned = new WorkingSet(this.registry, this.options);
    cloned.restoreState(this.saveState());
    return cloned;
  }

  /**
   * Sync with registry changes
   */
  syncWithRegistry() {
    // Remove tools that no longer exist in registry
    const toRemove = [];
    for (const toolName of this.activeTools) {
      if (!this.registry.hasTool(toolName)) {
        toRemove.push(toolName);
      }
    }

    for (const toolName of toRemove) {
      this.deactivateTool(toolName);
    }
  }

  /**
   * Get active tool information from registry
   */
  getActiveToolInfo(toolName) {
    if (!this.activeTools.has(toolName)) {
      return null;
    }

    const tool = this.registry.getTool(toolName);
    const metadata = this.registry.getToolMetadata(toolName);
    const priority = this.toolPriorities.get(toolName);
    const usage = this.toolUsage.get(toolName);

    return {
      ...tool,
      ...metadata,
      priority,
      usage
    };
  }

  /**
   * Ensure capacity for new tool activation
   * @private
   */
  _ensureCapacity() {
    if (this.activeTools.size < this.options.maxSize) {
      return;
    }

    // Evict one tool to make room
    const toolToEvict = this._selectToolForEviction();
    if (toolToEvict) {
      this.deactivateTool(toolToEvict);
    }
  }

  /**
   * Enforce size limits by evicting tools
   * @private
   */
  _enforceSize() {
    while (this.activeTools.size > this.options.maxSize) {
      const toolToEvict = this._selectToolForEviction();
      if (toolToEvict) {
        this.deactivateTool(toolToEvict);
      } else {
        break; // Safety break
      }
    }
  }

  /**
   * Select a tool for eviction based on policy
   * @private
   */
  _selectToolForEviction() {
    const activeTools = Array.from(this.activeTools);
    if (activeTools.length === 0) {
      return null;
    }

    switch (this.options.evictionPolicy) {
      case 'lru':
        return this._selectLRUTool();
      case 'priority':
        return this._selectLowestPriorityTool();
      case 'fifo':
        return this._selectFIFOTool();
      default:
        return this._selectLRUTool();
    }
  }

  /**
   * Select least recently used tool
   * @private
   */
  _selectLRUTool() {
    let lruTool = null;
    let oldestUsage = Date.now();

    for (const toolName of this.activeTools) {
      const usage = this.toolUsage.get(toolName);
      const lastUsed = usage?.lastUsed?.getTime() || 0;
      
      if (lastUsed < oldestUsage) {
        oldestUsage = lastUsed;
        lruTool = toolName;
      }
    }

    return lruTool;
  }

  /**
   * Select tool with lowest priority
   * @private
   */
  _selectLowestPriorityTool() {
    let lowestPriorityTool = null;
    let lowestPriority = Infinity;

    for (const toolName of this.activeTools) {
      const priority = this.toolPriorities.get(toolName) || 1;
      
      if (priority < lowestPriority) {
        lowestPriority = priority;
        lowestPriorityTool = toolName;
      }
    }

    return lowestPriorityTool;
  }

  /**
   * Select first activated tool (FIFO)
   * @private
   */
  _selectFIFOTool() {
    if (this.activationOrder.length === 0) {
      return Array.from(this.activeTools)[0] || null;
    }

    return this.activationOrder[0].tool;
  }
}