/**
 * Enumerations used throughout the framework
 */

/**
 * Error classification types for recovery strategies
 */
export const ErrorType = {
  TRANSIENT: 'TRANSIENT',         // Network issues, rate limits
  INVALID_INPUT: 'INVALID_INPUT', // Bad parameters
  TOOL_FAILURE: 'TOOL_FAILURE',   // Tool crashed
  PLANNING_ERROR: 'PLANNING_ERROR', // Invalid plan
  RESOURCE_LIMIT: 'RESOURCE_LIMIT', // Out of time/memory/budget
  UNRECOVERABLE: 'UNRECOVERABLE'   // Fatal error
};

/**
 * Recovery action types
 */
export const RecoveryActionType = {
  RETRY: 'retry',
  SUBSTITUTE: 'substitute',
  REPLAN: 'replan',
  ESCALATE: 'escalate',
  TERMINATE: 'terminate'
};

/**
 * Agent decision types for reflection
 */
export const DecisionType = {
  PROCEED: 'proceed',
  RETRY: 'retry',
  INSERT_STEP: 'insert_step',
  REPLAN: 'replan',
  TERMINATE: 'terminate'
};

/**
 * Trace span status codes
 */
export const SpanStatus = {
  UNSET: 'unset',
  OK: 'ok',
  ERROR: 'error'
};

/**
 * Message types for inter-agent communication
 */
export const MessageType = {
  REQUEST: 'request',
  RESPONSE: 'response',
  STREAM: 'stream',
  ERROR: 'error',
  CANCEL: 'cancel'
};

/**
 * Message priority levels
 */
export const MessagePriority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Artifact types
 */
export const ArtifactType = {
  CODE: 'code',
  DOCUMENT: 'document',
  DATA: 'data',
  MODEL: 'model',
  BINARY: 'binary'
};

/**
 * Plan step status values
 */
export const StepStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  ERROR: 'error',
  SKIPPED: 'skipped'
};

/**
 * Resource constraint types
 */
export const ResourceType = {
  TIME: 'time',
  MEMORY: 'memory',
  TOOL_CALLS: 'tool_calls',
  COST: 'cost',
  RECURSION_DEPTH: 'recursion_depth',
  CONCURRENT_STEPS: 'concurrent_steps'
};

/**
 * Security policy actions
 */
export const SecurityAction = {
  ALLOW: 'allow',
  DENY: 'deny',
  AUDIT: 'audit',
  SANDBOX: 'sandbox'
};

/**
 * Visualization render types
 */
export const VisualizationType = {
  TREE: 'tree',
  TIMELINE: 'timeline',
  RESOURCE_GRAPH: 'resource_graph',
  DEPENDENCY_GRAPH: 'dependency_graph'
};

/**
 * Planning strategy types
 */
export const PlanningStrategyType = {
  LLM: 'llm',
  RULE_BASED: 'rule_based',
  TEMPLATE: 'template',
  HYBRID: 'hybrid'
};

/**
 * Execution modes
 */
export const ExecutionMode = {
  SEQUENTIAL: 'sequential',
  PARALLEL: 'parallel',
  MIXED: 'mixed'
};

// Freeze all enums to prevent modification
Object.freeze(ErrorType);
Object.freeze(RecoveryActionType);
Object.freeze(DecisionType);
Object.freeze(SpanStatus);
Object.freeze(MessageType);
Object.freeze(MessagePriority);
Object.freeze(ArtifactType);
Object.freeze(StepStatus);
Object.freeze(ResourceType);
Object.freeze(SecurityAction);
Object.freeze(VisualizationType);
Object.freeze(PlanningStrategyType);
Object.freeze(ExecutionMode);