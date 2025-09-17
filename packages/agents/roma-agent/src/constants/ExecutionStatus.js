/**
 * Execution status constants
 * Use these instead of string literals for status values
 */

export const EXECUTION_STATUS = Object.freeze({
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ERROR: 'error',
  RETRY: 'retry',
  RECOVERED: 'recovered',
  SKIPPED: 'skipped',
  CANCELLED: 'cancelled'
});

export const TASK_STATUS = Object.freeze({
  PENDING: 'pending',
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  RETRY: 'retry',
  CANCELLED: 'cancelled',
  SKIPPED: 'skipped'
});

export const RECOVERY_ACTION = Object.freeze({
  RETRY_TASK: 'retry_task',
  FAIL_TASK: 'fail_task',
  STRATEGY_FALLBACK: 'strategy_fallback',
  WAIT_AND_RETRY: 'wait_and_retry',
  BREAK_DEPENDENCY: 'break_dependency',
  MANUAL_INTERVENTION: 'manual_intervention',
  RESOURCE_SUBSTITUTION: 'resource_substitution',
  FALLBACK_STRATEGY: 'fallback_strategy',
  WAIT_FOR_CAPACITY: 'wait_for_capacity',
  REDUCE_LOAD: 'reduce_load',
  NO_FALLBACK_AVAILABLE: 'no_fallback_available'
});

export const ERROR_TYPE = Object.freeze({
  TASK_ERROR: 'task_error',
  CIRCULAR_DEPENDENCY: 'circular_dependency',
  RESOURCE_ERROR: 'resource_error',
  STRATEGY_ERROR: 'strategy_error',
  QUEUE_ERROR: 'queue_error',
  SYSTEM_ERROR: 'system_error',
  VALIDATION_ERROR: 'validation_error',
  TIMEOUT_ERROR: 'timeout_error',
  NETWORK_ERROR: 'network_error',
  TOOL_NOT_FOUND: 'tool_not_found',
  AUTHENTICATION_ERROR: 'authentication_error',
  PERMISSION_ERROR: 'permission_error'
});

export const STRATEGY_NAME = Object.freeze({
  ATOMIC: 'AtomicExecutionStrategy',
  SEQUENTIAL: 'SequentialExecutionStrategy',
  PARALLEL: 'ParallelExecutionStrategy',
  RECURSIVE: 'RecursiveExecutionStrategy',
  OPTIMIZED: 'OptimizedExecutionStrategy'
});