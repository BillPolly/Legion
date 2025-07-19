/**
 * Deployment status enum and transition validation
 */

export const DeploymentStatus = Object.freeze({
  PENDING: 'PENDING',
  DEPLOYING: 'DEPLOYING',
  RUNNING: 'RUNNING',
  UPDATING: 'UPDATING',
  STOPPING: 'STOPPING',
  STOPPED: 'STOPPED',
  FAILED: 'FAILED',
  REMOVED: 'REMOVED'
});

// Valid status transitions
const validTransitions = {
  [DeploymentStatus.PENDING]: [
    DeploymentStatus.DEPLOYING,
    DeploymentStatus.FAILED,
    DeploymentStatus.REMOVED
  ],
  [DeploymentStatus.DEPLOYING]: [
    DeploymentStatus.RUNNING,
    DeploymentStatus.FAILED
  ],
  [DeploymentStatus.RUNNING]: [
    DeploymentStatus.UPDATING,
    DeploymentStatus.STOPPING,
    DeploymentStatus.FAILED
  ],
  [DeploymentStatus.UPDATING]: [
    DeploymentStatus.RUNNING,
    DeploymentStatus.FAILED
  ],
  [DeploymentStatus.STOPPING]: [
    DeploymentStatus.STOPPED,
    DeploymentStatus.FAILED
  ],
  [DeploymentStatus.STOPPED]: [
    DeploymentStatus.DEPLOYING,
    DeploymentStatus.REMOVED
  ],
  [DeploymentStatus.FAILED]: [
    DeploymentStatus.DEPLOYING,
    DeploymentStatus.REMOVED
  ],
  [DeploymentStatus.REMOVED]: []
};

/**
 * Check if a status transition is valid
 */
export function isValidTransition(fromStatus, toStatus) {
  const allowed = validTransitions[fromStatus];
  return allowed ? allowed.includes(toStatus) : false;
}

/**
 * Get valid transitions from a given status
 */
export function getValidTransitions(status) {
  return validTransitions[status] || [];
}