/**
 * Core interfaces for the Recursive Planning Agent Framework
 */

/**
 * Common interface for anything callable in the framework
 */
export class Executable {
  constructor(name, description) {
    if (new.target === Executable) {
      throw new Error('Executable is abstract and cannot be instantiated directly');
    }
    this.name = name;
    this.description = description;
  }

  /**
   * Execute the functionality
   * @param {any} input - Input parameters
   * @returns {Promise<any>} Execution result
   */
  async run(input) {
    throw new Error('run method must be implemented by subclass');
  }
}

/**
 * Agent state management structure
 */
export class AgentState {
  constructor(goal, context = {}) {
    this.goal = goal;
    this.plan = [];
    this.stepPointer = 0;
    this.workingMemory = null; // Will be ArtifactStore instance
    this.lastResult = null;
    this.resourceUsage = {
      timeElapsed: 0,
      memoryMB: 0,
      toolCalls: 0,
      llmTokens: 0,
      recursionDepth: 0,
      totalCost: 0
    };
    this.executionTrace = [];
    this.context = context;
    this.startTime = Date.now();
  }
}

/**
 * Individual plan step structure
 */
export class PlanStep {
  constructor(id, description, tool, params = {}, dependencies = [], saveOutputs = null) {
    this.id = id;
    this.description = description;
    this.tool = tool;
    this.params = params;
    this.dependencies = dependencies;
    this.saveOutputs = saveOutputs; // Map of output field to { name, description }
    this.status = 'pending'; // pending | in_progress | done | error | skipped
    this.result = null;
    this.error = null;
    this.retryCount = 0;
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Mark step as started
   */
  start() {
    this.status = 'in_progress';
    this.startTime = Date.now();
  }

  /**
   * Mark step as completed with result
   * @param {any} result - Step execution result
   */
  complete(result) {
    this.status = 'done';
    this.result = result;
    this.endTime = Date.now();
  }

  /**
   * Mark step as failed with error
   * @param {Error} error - Error that occurred
   */
  fail(error) {
    this.status = 'error';
    this.error = error;
    this.endTime = Date.now();
  }

  /**
   * Get step duration in milliseconds
   * @returns {number|null} Duration or null if not completed
   */
  getDuration() {
    if (this.startTime && this.endTime) {
      return this.endTime - this.startTime;
    }
    return null;
  }
}

/**
 * Agent execution result wrapper
 */
export class AgentResult {
  constructor(success = false) {
    this.success = success;
    this.result = null;
    this.error = null;
    this.artifacts = new Map();
    this.trace = [];
    this.metrics = null;
    this.partialResult = null;
  }

  /**
   * Set successful result
   * @param {any} result - The result data
   * @param {Map} artifacts - Generated artifacts
   * @param {Array} trace - Execution trace
   * @param {Object} metrics - Resource usage metrics
   */
  setSuccess(result, artifacts = new Map(), trace = [], metrics = null) {
    this.success = true;
    this.result = result;
    this.artifacts = artifacts;
    this.trace = trace;
    this.metrics = metrics;
  }

  /**
   * Set failed result
   * @param {Error} error - The error that occurred
   * @param {any} partialResult - Any partial results before failure
   */
  setFailure(error, partialResult = null) {
    this.success = false;
    this.error = error;
    this.partialResult = partialResult;
  }
}

/**
 * Execution context for agents
 */
export class ExecutionContext {
  constructor(options = {}) {
    this.testMode = options.testMode || false;
    this.mockTime = options.mockTime || null;
    this.parentTrace = options.parentTrace || null;
    this.domainContext = options.domainContext || null;
    this.userPreferences = options.userPreferences || {};
    this.resourceConstraints = options.resourceConstraints || null;
    this.securityPolicy = options.securityPolicy || null;
  }
}

/**
 * Agent decision structure for reflection
 */
export class AgentDecision {
  constructor(type, details = {}, reasoning = '') {
    this.type = type; // proceed | retry | insert_step | replan | terminate
    this.details = details;
    this.reasoning = reasoning;
    this.timestamp = Date.now();
  }
}