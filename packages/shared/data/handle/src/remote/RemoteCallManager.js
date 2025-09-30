/**
 * RemoteCallManager - Manages request/response pattern for remote Handle method calls
 *
 * Handles:
 * - Unique call ID generation
 * - Promise-based call tracking
 * - Response routing to correct promise
 * - Timeout handling
 * - Cleanup of completed calls
 *
 * Phase 5: Remote Call Mechanism
 */

export class RemoteCallManager {
  constructor(defaultTimeout = 30000) { // 30 second default timeout
    this._pendingCalls = new Map();
    this._callCounter = 0;
    this._defaultTimeout = defaultTimeout;
  }

  /**
   * Generate unique call ID
   * @private
   */
  _generateCallId() {
    this._callCounter++;
    return `call-${Date.now()}-${this._callCounter}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Register a pending call with resolve/reject handlers
   * Used internally by createCall()
   */
  registerCall(callId, resolve, reject) {
    this._pendingCalls.set(callId, { resolve, reject, timeout: null });
  }

  /**
   * Create a new remote call with automatic promise and timeout
   * Returns { callId, promise }
   */
  createCall(timeout = this._defaultTimeout) {
    const callId = this._generateCallId();

    const promise = new Promise((resolve, reject) => {
      // Setup timeout if specified
      let timeoutHandle = null;
      if (timeout && timeout > 0) {
        timeoutHandle = setTimeout(() => {
          // Call timed out
          this._pendingCalls.delete(callId);
          reject(new Error(`Remote call ${callId} timed out after ${timeout}ms`));
        }, timeout);
      }

      this._pendingCalls.set(callId, { resolve, reject, timeout: timeoutHandle });
    });

    return { callId, promise };
  }

  /**
   * Check if a call is pending
   */
  hasPendingCall(callId) {
    return this._pendingCalls.has(callId);
  }

  /**
   * Resolve a pending call with result
   */
  resolveCall(callId, result) {
    const pending = this._pendingCalls.get(callId);
    if (pending) {
      // Clear timeout if present
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }

      // Remove from pending
      this._pendingCalls.delete(callId);

      // Resolve promise
      pending.resolve(result);
    }
    // Silently ignore if call doesn't exist (may have timed out)
  }

  /**
   * Reject a pending call with error
   */
  rejectCall(callId, error) {
    const pending = this._pendingCalls.get(callId);
    if (pending) {
      // Clear timeout if present
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }

      // Remove from pending
      this._pendingCalls.delete(callId);

      // Reject promise
      const errorObj = error instanceof Error ? error : new Error(String(error));
      pending.reject(errorObj);
    }
    // Silently ignore if call doesn't exist (may have timed out)
  }

  /**
   * Manually cleanup a pending call without resolving/rejecting
   * Useful for forced cleanup scenarios
   */
  cleanupCall(callId) {
    const pending = this._pendingCalls.get(callId);
    if (pending) {
      // Clear timeout if present
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }

      // Remove from pending
      this._pendingCalls.delete(callId);
    }
  }

  /**
   * Get count of pending calls
   */
  getPendingCallCount() {
    return this._pendingCalls.size;
  }

  /**
   * Cleanup all pending calls (useful for shutdown)
   */
  cleanupAll() {
    for (const [callId, pending] of this._pendingCalls.entries()) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
    }
    this._pendingCalls.clear();
  }
}