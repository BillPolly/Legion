/**
 * ExecutionStatus Value Object
 * Immutable enumeration of execution states
 */

export const ExecutionStatus = Object.freeze({
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  STEPPING: 'STEPPING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
});

export function isExecutionActive(status) {
  return status === ExecutionStatus.RUNNING ||
         status === ExecutionStatus.PAUSED ||
         status === ExecutionStatus.STEPPING;
}

export function canStartExecution(status) {
  return status === ExecutionStatus.IDLE ||
         status === ExecutionStatus.COMPLETED ||
         status === ExecutionStatus.FAILED;
}

export function getStatusIcon(status) {
  const icons = {
    [ExecutionStatus.IDLE]: '⏸️',
    [ExecutionStatus.RUNNING]: '▶️',
    [ExecutionStatus.PAUSED]: '⏸️',
    [ExecutionStatus.STEPPING]: '⏭️',
    [ExecutionStatus.COMPLETED]: '✅',
    [ExecutionStatus.FAILED]: '❌'
  };
  return icons[status] || '❓';
}