/**
 * ExecutionContext - Immutable context for task execution
 * Manages execution state, depth tracking, and context propagation
 * 
 * Features:
 * - Immutable design for predictable state management
 * - Automatic depth tracking for recursion control
 * - Context inheritance for subtasks
 * - Shared state management
 * - Breadcrumb tracking for debugging
 */

export class ExecutionContext {
  constructor(parent = null, overrides = {}) {
    // Inheritance from parent context
    this.parent = parent;
    this.depth = overrides.depth ?? (parent ? parent.depth + 1 : 0);
    this.breadcrumbs = parent ? [...parent.breadcrumbs] : [];
    this.sharedState = new Map(parent?.sharedState || []);
    
    // Task identification
    this.taskId = overrides.taskId || this.generateTaskId();
    this.sessionId = overrides.sessionId || parent?.sessionId || this.generateSessionId();
    this.correlationId = overrides.correlationId || parent?.correlationId || this.sessionId;
    
    // Execution configuration
    this.maxDepth = overrides.maxDepth ?? parent?.maxDepth ?? 3;
    this.startTime = Date.now();
    this.deadline = overrides.deadline || parent?.deadline || null;
    
    // Results and dependencies
    this.previousResults = parent?.previousResults ? [...parent.previousResults] : [];
    this.dependencies = new Map();
    
    // Metadata
    this.metadata = {
      ...parent?.metadata,
      ...overrides.metadata
    };
    
    // User context (from original task)
    this.userContext = overrides.userContext || parent?.userContext || {};
    
    // Immutable configuration
    Object.freeze(this.config = {
      maxDepth: this.maxDepth,
      timeout: overrides.timeout ?? parent?.config?.timeout ?? 0,
      retryCount: overrides.retryCount ?? parent?.config?.retryCount ?? 2,
      parallelLimit: overrides.parallelLimit ?? parent?.config?.parallelLimit ?? 5,
      cacheResults: overrides.cacheResults ?? parent?.config?.cacheResults ?? true,
      verboseLogging: overrides.verboseLogging ?? parent?.config?.verboseLogging ?? false
    });
    
    // Freeze breadcrumbs to prevent mutation
    Object.freeze(this.breadcrumbs);
  }

  /**
   * Check if decomposition is allowed at current depth
   */
  canDecompose() {
    return this.depth < this.maxDepth;
  }

  /**
   * Check if deadline has been exceeded
   */
  isExpired() {
    if (!this.deadline) return false;
    return Date.now() > this.deadline;
  }

  /**
   * Get remaining time until deadline
   */
  getRemainingTime() {
    if (!this.deadline) return Infinity;
    return Math.max(0, this.deadline - Date.now());
  }

  /**
   * Create child context for subtask
   * Returns new immutable context
   */
  createChild(taskId, overrides = {}) {
    const child = new ExecutionContext(this, {
      ...overrides,
      taskId,
      sessionId: this.sessionId,
      correlationId: this.correlationId
    });
    
    // Add to breadcrumbs
    child.breadcrumbs = Object.freeze([...this.breadcrumbs, {
      taskId,
      depth: child.depth,
      timestamp: Date.now()
    }]);
    
    return child;
  }

  /**
   * Create sibling context (same depth)
   * Useful for parallel execution
   */
  createSibling(taskId, overrides = {}) {
    const sibling = new ExecutionContext(this.parent, {
      ...overrides,
      taskId,
      sessionId: this.sessionId,
      correlationId: this.correlationId,
      userContext: this.userContext,
      metadata: this.metadata
    });
    
    // Copy state from current context
    sibling.previousResults = [...this.previousResults];
    sibling.sharedState = new Map(this.sharedState);
    
    return sibling;
  }

  /**
   * Add result to context
   * Returns new immutable context
   */
  withResult(result) {
    const newContext = this._clone();
    newContext.previousResults = Object.freeze([...this.previousResults, result]);
    return newContext;
  }

  /**
   * Update shared state
   * Returns new immutable context
   */
  withSharedState(key, value) {
    const newContext = this._clone();
    newContext.sharedState = new Map(this.sharedState);
    newContext.sharedState.set(key, value);
    return newContext;
  }

  /**
   * Batch update shared state
   * Returns new immutable context
   */
  withSharedStates(updates) {
    const newContext = this._clone();
    newContext.sharedState = new Map(this.sharedState);
    
    Object.entries(updates).forEach(([key, value]) => {
      newContext.sharedState.set(key, value);
    });
    
    return newContext;
  }

  /**
   * Add dependency
   * Returns new immutable context
   */
  withDependency(taskId, result) {
    const newContext = this._clone();
    newContext.dependencies = new Map(this.dependencies);
    newContext.dependencies.set(taskId, result);
    return newContext;
  }

  /**
   * Update metadata
   * Returns new immutable context
   */
  withMetadata(key, value) {
    const newContext = this._clone();
    newContext.metadata = {
      ...this.metadata,
      [key]: value
    };
    return newContext;
  }

  /**
   * Set deadline
   * Returns new immutable context
   */
  withDeadline(deadline) {
    const newContext = this._clone();
    newContext.deadline = deadline;
    return newContext;
  }

  /**
   * Get execution path as string
   */
  getExecutionPath() {
    return this.breadcrumbs
      .map(b => b.taskId)
      .join(' → ');
  }

  /**
   * Get execution trace with timings
   */
  getExecutionTrace() {
    if (this.breadcrumbs.length === 0) {
      return [];
    }
    
    return this.breadcrumbs.map((b, index) => {
      const elapsed = index > 0 
        ? Math.max(0, b.timestamp - this.breadcrumbs[index - 1].timestamp)
        : Math.max(0, b.timestamp - this.startTime);
      
      return {
        ...b,
        elapsed
      };
    });
  }

  /**
   * Provide metadata snapshot for logging/debugging
   */
  getMetadata() {
    return {
      taskId: this.taskId,
      sessionId: this.sessionId,
      correlationId: this.correlationId,
      depth: this.depth,
      executionPath: this.getExecutionPath(),
      breadcrumbs: this.breadcrumbs,
      config: this.config,
      metadata: this.metadata,
      userContext: this.userContext
    };
  }

  /**
   * Get elapsed time since context creation
   */
  getElapsedTime() {
    return Date.now() - this.startTime;
  }

  /**
   * Check if context is at root level
   */
  isRoot() {
    return this.depth === 0;
  }

  /**
   * Check if context is at maximum depth
   */
  isAtMaxDepth() {
    return this.depth >= this.maxDepth;
  }

  /**
   * Get all ancestor contexts
   */
  getAncestors() {
    const ancestors = [];
    let current = this.parent;
    
    while (current) {
      ancestors.push(current);
      current = current.parent;
    }
    
    return ancestors;
  }

  /**
   * Find ancestor context by predicate
   */
  findAncestor(predicate) {
    let current = this.parent;
    
    while (current) {
      if (predicate(current)) {
        return current;
      }
      current = current.parent;
    }
    
    return null;
  }

  /**
   * Get root context
   */
  getRoot() {
    let current = this;
    while (current.parent) {
      current = current.parent;
    }
    return current;
  }

  /**
   * Get shared state value
   */
  getSharedState(key, defaultValue = undefined) {
    return this.sharedState.has(key) 
      ? this.sharedState.get(key) 
      : defaultValue;
  }

  /**
   * Get all shared state as object
   */
  getAllSharedState() {
    return Object.fromEntries(this.sharedState);
  }

  /**
   * Check if has dependency result
   */
  hasDependency(taskId) {
    return this.dependencies.has(taskId);
  }

  /**
   * Get dependency result
   */
  getDependency(taskId) {
    return this.dependencies.get(taskId);
  }

  /**
   * Get all dependencies
   */
  getAllDependencies() {
    return Object.fromEntries(this.dependencies);
  }

  /**
   * Create context for parallel subtasks
   */
  createParallelContexts(taskIds) {
    return taskIds.map(taskId => this.createChild(taskId));
  }

  /**
   * Merge results from parallel contexts
   * Returns new immutable context
   */
  mergeParallelResults(contexts) {
    const newContext = this._clone();
    
    // Collect all results
    const results = contexts.map(ctx => 
      ctx.previousResults[ctx.previousResults.length - 1]
    ).filter(Boolean);
    
    newContext.previousResults = Object.freeze([...this.previousResults, ...results]);
    
    // Merge shared states (last write wins)
    const mergedState = new Map(this.sharedState);
    contexts.forEach(ctx => {
      ctx.sharedState.forEach((value, key) => {
        mergedState.set(key, value);
      });
    });
    newContext.sharedState = mergedState;
    
    return newContext;
  }

  /**
   * Convert to plain object for serialization
   */
  toObject() {
    return {
      taskId: this.taskId,
      sessionId: this.sessionId,
      correlationId: this.correlationId,
      depth: this.depth,
      breadcrumbs: this.breadcrumbs,
      sharedState: this.getAllSharedState(),
      previousResults: this.previousResults,
      dependencies: this.getAllDependencies(),
      metadata: this.metadata,
      userContext: this.userContext,
      config: this.config,
      startTime: this.startTime,
      deadline: this.deadline,
      elapsedTime: this.getElapsedTime(),
      executionPath: this.getExecutionPath()
    };
  }

  /**
   * Create context from plain object
   */
  static fromObject(obj) {
    const context = new ExecutionContext(null, {
      taskId: obj.taskId,
      sessionId: obj.sessionId,
      correlationId: obj.correlationId,
      maxDepth: obj.config?.maxDepth,
      deadline: obj.deadline,
      userContext: obj.userContext,
      metadata: obj.metadata,
      ...obj.config
    });
    
    // Restore state
    context.depth = obj.depth;
    context.breadcrumbs = Object.freeze(obj.breadcrumbs || []);
    context.previousResults = obj.previousResults || [];
    context.startTime = obj.startTime;
    
    // Restore shared state
    if (obj.sharedState) {
      Object.entries(obj.sharedState).forEach(([key, value]) => {
        context.sharedState.set(key, value);
      });
    }
    
    // Restore dependencies
    if (obj.dependencies) {
      Object.entries(obj.dependencies).forEach(([key, value]) => {
        context.dependencies.set(key, value);
      });
    }
    
    return context;
  }

  /**
   * Create lightweight summary for logging
   */
  toSummary() {
    return {
      taskId: this.taskId,
      sessionId: this.sessionId,
      depth: this.depth,
      path: this.getExecutionPath(),
      elapsed: this.getElapsedTime(),
      remaining: this.getRemainingTime(),
      resultsCount: this.previousResults.length,
      sharedStateKeys: Array.from(this.sharedState.keys()),
      isExpired: this.isExpired(),
      canDecompose: this.canDecompose()
    };
  }

  /**
   * Clone context (internal helper)
   */
  _clone() {
    const cloned = new ExecutionContext(this.parent, {
      taskId: this.taskId,
      sessionId: this.sessionId,
      correlationId: this.correlationId,
      maxDepth: this.maxDepth,
      deadline: this.deadline,
      userContext: this.userContext,
      metadata: this.metadata,
      ...this.config
    });
    
    cloned.depth = this.depth;
    cloned.breadcrumbs = this.breadcrumbs;
    cloned.previousResults = [...this.previousResults];
    cloned.startTime = this.startTime;
    cloned.sharedState = new Map(this.sharedState);
    cloned.dependencies = new Map(this.dependencies);
    
    return cloned;
  }

  /**
   * Generate unique task ID
   */
  generateTaskId() {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
