/**
 * Resource status constants and utilities
 * Provides standardized status values and status management functionality
 */

/**
 * Standard resource status values
 */
export const RESOURCE_STATUS = {
  STOPPED: 'stopped',
  STARTING: 'starting', 
  RUNNING: 'running',
  STOPPING: 'stopping',
  ERROR: 'error',
  UNHEALTHY: 'unhealthy',
  READY: 'ready'
};

/**
 * Resource status transitions - defines valid state changes
 */
export const STATUS_TRANSITIONS = {
  [RESOURCE_STATUS.STOPPED]: [RESOURCE_STATUS.STARTING],
  [RESOURCE_STATUS.STARTING]: [RESOURCE_STATUS.RUNNING, RESOURCE_STATUS.ERROR, RESOURCE_STATUS.STOPPED],
  [RESOURCE_STATUS.RUNNING]: [RESOURCE_STATUS.STOPPING, RESOURCE_STATUS.UNHEALTHY, RESOURCE_STATUS.ERROR, RESOURCE_STATUS.READY],
  [RESOURCE_STATUS.READY]: [RESOURCE_STATUS.STOPPING, RESOURCE_STATUS.UNHEALTHY, RESOURCE_STATUS.ERROR],
  [RESOURCE_STATUS.STOPPING]: [RESOURCE_STATUS.STOPPED, RESOURCE_STATUS.ERROR],
  [RESOURCE_STATUS.ERROR]: [RESOURCE_STATUS.STARTING, RESOURCE_STATUS.STOPPED],
  [RESOURCE_STATUS.UNHEALTHY]: [RESOURCE_STATUS.RUNNING, RESOURCE_STATUS.STOPPING, RESOURCE_STATUS.ERROR]
};

/**
 * Utility class for managing resource status
 */
class ResourceStatus {
  /**
   * Create a new ResourceStatus manager
   * @param {string} initialStatus - Initial status (defaults to STOPPED)
   */
  constructor(initialStatus = RESOURCE_STATUS.STOPPED) {
    this.currentStatus = initialStatus;
    this.statusHistory = [{
      status: initialStatus,
      timestamp: new Date(),
      reason: 'Initial status'
    }];
    this.listeners = new Map(); // Event listeners for status changes
  }

  /**
   * Get current status
   * @returns {string} Current status
   */
  get status() {
    return this.currentStatus;
  }

  /**
   * Change status with validation
   * @param {string} newStatus - New status to set
   * @param {string} reason - Reason for status change
   * @returns {boolean} True if status change was successful
   */
  changeStatus(newStatus, reason = '') {
    // Validate status value
    if (!Object.values(RESOURCE_STATUS).includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    // Check if transition is allowed
    if (!this.isValidTransition(this.currentStatus, newStatus)) {
      console.warn(
        `Invalid status transition from ${this.currentStatus} to ${newStatus}. ` +
        `Valid transitions: ${STATUS_TRANSITIONS[this.currentStatus]?.join(', ') || 'none'}`
      );
      return false;
    }

    const oldStatus = this.currentStatus;
    this.currentStatus = newStatus;
    
    // Record status change
    this.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      reason,
      previousStatus: oldStatus
    });

    // Notify listeners
    this.notifyListeners(oldStatus, newStatus, reason);

    return true;
  }

  /**
   * Check if a status transition is valid
   * @param {string} fromStatus - Current status
   * @param {string} toStatus - Desired status
   * @returns {boolean} True if transition is allowed
   */
  isValidTransition(fromStatus, toStatus) {
    if (fromStatus === toStatus) {
      return true; // Allow staying in same state
    }
    
    const allowedTransitions = STATUS_TRANSITIONS[fromStatus];
    return allowedTransitions ? allowedTransitions.includes(toStatus) : false;
  }

  /**
   * Check if resource is in a healthy state
   * @returns {boolean} True if resource is healthy
   */
  isHealthy() {
    return [
      RESOURCE_STATUS.RUNNING,
      RESOURCE_STATUS.READY,
      RESOURCE_STATUS.STARTING
    ].includes(this.currentStatus);
  }

  /**
   * Check if resource is currently operational
   * @returns {boolean} True if resource can handle requests
   */
  isOperational() {
    return [
      RESOURCE_STATUS.RUNNING,
      RESOURCE_STATUS.READY
    ].includes(this.currentStatus);
  }

  /**
   * Check if resource is in an error state
   * @returns {boolean} True if resource has errors
   */
  hasError() {
    return [
      RESOURCE_STATUS.ERROR,
      RESOURCE_STATUS.UNHEALTHY
    ].includes(this.currentStatus);
  }

  /**
   * Get status history
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Status history entries
   */
  getHistory(limit = 10) {
    return this.statusHistory.slice(-limit);
  }

  /**
   * Get time in current status
   * @returns {number} Milliseconds in current status
   */
  getTimeInCurrentStatus() {
    const lastEntry = this.statusHistory[this.statusHistory.length - 1];
    return Date.now() - lastEntry.timestamp.getTime();
  }

  /**
   * Add a status change listener
   * @param {string} id - Listener identifier
   * @param {Function} callback - Callback function (oldStatus, newStatus, reason) => void
   */
  addListener(id, callback) {
    this.listeners.set(id, callback);
  }

  /**
   * Remove a status change listener
   * @param {string} id - Listener identifier
   */
  removeListener(id) {
    this.listeners.delete(id);
  }

  /**
   * Notify all listeners of status change
   * @private
   */
  notifyListeners(oldStatus, newStatus, reason) {
    for (const [id, callback] of this.listeners) {
      try {
        callback(oldStatus, newStatus, reason);
      } catch (error) {
        console.error(`Error in status listener ${id}:`, error);
      }
    }
  }

  /**
   * Get a formatted status summary
   * @returns {Object} Status summary
   */
  getSummary() {
    const lastEntry = this.statusHistory[this.statusHistory.length - 1];
    
    return {
      current: this.currentStatus,
      since: lastEntry.timestamp,
      duration: this.getTimeInCurrentStatus(),
      isHealthy: this.isHealthy(),
      isOperational: this.isOperational(),
      hasError: this.hasError(),
      changeCount: this.statusHistory.length - 1
    };
  }

  /**
   * Reset status to initial state
   * @param {string} reason - Reason for reset
   */
  reset(reason = 'Status reset') {
    this.changeStatus(RESOURCE_STATUS.STOPPED, reason);
  }

  /**
   * Convert to JSON representation
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      current: this.currentStatus,
      history: this.getHistory(),
      summary: this.getSummary()
    };
  }
}

export default ResourceStatus;