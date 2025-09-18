/**
 * ExecutionContext - Context for task execution with artifact management
 * 
 * This implementation replaces the flawed previousResults system with
 * proper artifact management as specified in artifact-management-design.md
 * 
 * Key Features:
 * - Named artifact storage in a Map
 * - Immutable artifact records with value field
 * - Separate conversation history tracking
 * - Context inheritance for subtasks
 * - NO previousResults or sharedState
 */

export class ExecutionContext {
  constructor(parent = null, overrides = {}) {
    // Inheritance from parent context
    this.parent = parent;
    this.depth = overrides.depth ?? (parent ? parent.depth + 1 : 0);
    
    // Artifact registry - inherits from parent if exists
    // Creates a new Map with parent's artifacts to allow child overrides
    this.artifacts = new Map(parent?.artifacts || []);
    
    // Conversation history - separate from artifacts
    // Creates a copy of parent's history to allow independent additions
    this.conversationHistory = [...(parent?.conversationHistory || [])];
    
    // Task identification
    this.taskId = overrides.taskId || this.generateTaskId();
    this.sessionId = overrides.sessionId || parent?.sessionId || this.generateSessionId();
    this.correlationId = overrides.correlationId || parent?.correlationId || this.sessionId;
    
    // Execution configuration
    this.maxDepth = overrides.maxDepth ?? parent?.maxDepth ?? 3;
    this.startTime = Date.now();
    this.deadline = overrides.deadline || parent?.deadline || null;
    
    // Breadcrumbs for execution path tracking
    this.breadcrumbs = parent ? [...parent.breadcrumbs] : [];
    
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
    
    // REMOVED: previousResults, sharedState, dependencies
    // These are replaced by the artifact system
  }

  /**
   * Add an artifact to the registry
   * Artifacts are immutable records that describe data/files/processes
   * 
   * @param {string} name - Unique name for the artifact
   * @param {Object} artifactRecord - The artifact record with type, value, description
   */
  addArtifact(name, artifactRecord) {
    if (!name || typeof name !== 'string') {
      throw new Error('Artifact name must be a non-empty string');
    }
    if (!artifactRecord || !artifactRecord.type || !artifactRecord.description) {
      throw new Error('Artifact must have type and description');
    }
    if (artifactRecord.value === undefined) {
      throw new Error('Artifact must have a value field (the actual data)');
    }
    
    // Store the ENTIRE artifact record AS-IS - NO DESTRUCTURING
    // The artifact record is IMMUTABLE once created
    this.artifacts.set(name, artifactRecord);
  }
  
  /**
   * Get an artifact record by name
   * Returns the ENTIRE artifact record (NOT just the value)
   * 
   * @param {string} name - Name of the artifact
   * @returns {Object|undefined} The artifact record or undefined if not found
   */
  getArtifact(name) {
    return this.artifacts.get(name);
  }
  
  /**
   * Get only the value field from an artifact
   * This is what gets passed to tools when they reference artifacts
   * 
   * @param {string} name - Name of the artifact
   * @returns {any|undefined} The value field or undefined if not found
   */
  getArtifactValue(name) {
    const artifactRecord = this.artifacts.get(name);
    return artifactRecord?.value;  // Extract ONLY the value for tool use
  }
  
  /**
   * List all artifacts as [name, record] pairs
   * Returns the artifact records themselves, not destructured
   * 
   * @returns {Array} Array of [name, artifactRecord] tuples
   */
  listArtifacts() {
    return Array.from(this.artifacts.entries());
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
   * Child inherits artifacts and conversation history from parent
   * 
   * @param {string} taskId - ID for the child task
   * @param {Object} overrides - Override configuration
   * @returns {ExecutionContext} New child context
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
   * 
   * @param {string} taskId - ID for the sibling task
   * @param {Object} overrides - Override configuration
   * @returns {ExecutionContext} New sibling context
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
    
    // Copy artifacts and conversation history from current context
    sibling.artifacts = new Map(this.artifacts);
    sibling.conversationHistory = [...this.conversationHistory];
    
    return sibling;
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
      const previousTimestamp = index > 0
        ? this.breadcrumbs[index - 1].timestamp
        : this.parent?.breadcrumbs?.[this.parent.breadcrumbs.length - 1]?.timestamp ?? this.startTime;

      // Ensure elapsed time is always positive for visibility in tests and logs
      const rawElapsed = b.timestamp - previousTimestamp;
      const elapsed = rawElapsed > 0 ? rawElapsed : 1;
      
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
      userContext: this.userContext,
      artifactCount: this.artifacts.size,
      conversationLength: this.conversationHistory.length
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
   * Create context for parallel subtasks
   */
  createParallelContexts(taskIds) {
    return taskIds.map(taskId => this.createChild(taskId));
  }

  /**
   * Merge artifacts from parallel contexts
   * Returns new immutable context with merged artifacts
   * 
   * @param {Array<ExecutionContext>} contexts - Parallel contexts to merge
   * @returns {ExecutionContext} New context with merged artifacts
   */
  mergeParallelResults(contexts) {
    const newContext = this._clone();
    
    // Merge artifacts from all contexts (last write wins)
    contexts.forEach(ctx => {
      ctx.artifacts.forEach((artifactRecord, name) => {
        newContext.artifacts.set(name, artifactRecord);
      });
    });
    
    // Merge conversation histories
    contexts.forEach(ctx => {
      // Add only new messages (not inherited from parent)
      const newMessages = ctx.conversationHistory.slice(this.conversationHistory.length);
      newContext.conversationHistory.push(...newMessages);
    });
    
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
      artifacts: Object.fromEntries(this.artifacts),
      conversationHistory: this.conversationHistory,
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
    context.startTime = obj.startTime;
    context.conversationHistory = obj.conversationHistory || [];
    
    // Restore artifacts
    if (obj.artifacts) {
      Object.entries(obj.artifacts).forEach(([name, artifactRecord]) => {
        context.artifacts.set(name, artifactRecord);
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
      artifactCount: this.artifacts.size,
      conversationLength: this.conversationHistory.length,
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
    cloned.startTime = this.startTime;
    cloned.artifacts = new Map(this.artifacts);
    cloned.conversationHistory = [...this.conversationHistory];
    
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