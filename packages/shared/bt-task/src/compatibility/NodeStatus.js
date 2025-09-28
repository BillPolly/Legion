/**
 * NodeStatus constants for backward compatibility with actor-BT
 * 
 * Maps between bt-task's task statuses and actor-BT's NodeStatus values
 */

export const NodeStatus = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  RUNNING: 'RUNNING',
  PENDING: 'PENDING'
};

/**
 * Convert task status to NodeStatus
 */
export function taskStatusToNodeStatus(taskStatus) {
  const mapping = {
    'completed': NodeStatus.SUCCESS,
    'failed': NodeStatus.FAILURE,
    'in-progress': NodeStatus.RUNNING,
    'pending': NodeStatus.PENDING
  };
  return mapping[taskStatus] || NodeStatus.FAILURE;
}

/**
 * Convert NodeStatus to task status
 */
export function nodeStatusToTaskStatus(nodeStatus) {
  const mapping = {
    [NodeStatus.SUCCESS]: 'completed',
    [NodeStatus.FAILURE]: 'failed',
    [NodeStatus.RUNNING]: 'in-progress',
    [NodeStatus.PENDING]: 'pending'
  };
  return mapping[nodeStatus] || 'failed';
}