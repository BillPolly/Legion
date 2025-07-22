/**
 * Recovery and Retry Manager for Cerebrate Chrome Extension
 * Handles automatic recovery, session restoration, and retry logic
 */
export class RecoveryManager {

  constructor(options = {}) {
    this.config = this.validateAndNormalizeConfig(options);
    this.errorHandler = options.errorHandler;
    this.webSocketClient = options.webSocketClient;
    this.sessionManager = options.sessionManager;
    
    // Recovery state
    this.recoveryState = 'idle'; // idle, recovering, recovered, failed
    this.recoverySteps = [];
    this.stateChangeCallbacks = [];
    
    // Metrics tracking
    this.recoveryMetrics = {
      totalRecoveries: 0,
      connectionRecoveries: 0,
      sessionRecoveries: 0,
      commandRecoveries: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      recoveryTimes: [],
      recoveryPatterns: new Map()
    };
    
    // Health monitoring
    this.healthChecker = null;
    this.healthCheckInterval = null;
  }

  /**
   * Validate and normalize configuration
   * @private
   */
  validateAndNormalizeConfig(options) {
    const defaults = {
      maxRetries: 3,
      baseRetryDelay: 100,
      exponentialBackoff: true,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      healthCheckInterval: 30000, // 30 seconds
      progressiveRecovery: true
    };

    return { ...defaults, ...options };
  }

  /**
   * Automatically recover WebSocket connection
   * @param {Object} options - Recovery options
   * @returns {Promise<Object>} - Recovery result
   */
  async recoverConnection(options = {}) {
    const startTime = Date.now();
    const {
      maxRetries = this.config.maxRetries,
      exponentialBackoff = this.config.exponentialBackoff
    } = options;

    this.updateRecoveryState('recovering', 'connection');
    
    let attempts = 0;
    let lastError;

    try {
      for (attempts = 0; attempts <= maxRetries; attempts++) {
        try {
          await this.webSocketClient.connect();
          
          // Success
          this.recoveryMetrics.totalRecoveries++;
          this.recoveryMetrics.connectionRecoveries++;
          this.recoveryMetrics.successfulRecoveries++;
          this.recoveryMetrics.recoveryTimes.push(Date.now() - startTime);
          
          this.updateRecoveryState('recovered', 'connection', true);
          
          return {
            recovered: true,
            attempts: attempts + 1,
            strategy: 'connection_retry',
            duration: Date.now() - startTime
          };
          
        } catch (error) {
          lastError = error;
          
          if (attempts < maxRetries) {
            const delay = exponentialBackoff 
              ? this.config.baseRetryDelay * Math.pow(2, attempts)
              : this.config.baseRetryDelay;
            
            await this.sleep(delay);
          }
        }
      }

      // Failed after all attempts
      this.recoveryMetrics.totalRecoveries++;
      this.recoveryMetrics.connectionRecoveries++;
      this.recoveryMetrics.failedRecoveries++;
      
      this.updateRecoveryState('failed', 'connection', false);
      this.trackRecoveryPattern('connection_failure');

      return {
        recovered: false,
        attempts: attempts,
        strategy: 'connection_retry',
        duration: Date.now() - startTime,
        lastError
      };

    } catch (error) {
      await this.handleRecoveryError(error, { operation: 'connection_recovery', attempt: attempts });
      throw error;
    }
  }

  /**
   * Synchronize connection state
   * @returns {Promise<Object>} - Synchronization result
   */
  async synchronizeConnectionState() {
    const previousState = this.webSocketClient.getConnectionState();
    const currentlyConnected = this.webSocketClient.isConnected();
    const currentState = currentlyConnected ? 'connected' : 'disconnected';
    
    const actions = [];
    
    if (previousState !== currentState) {
      actions.push('state_updated');
    }
    
    return {
      synchronized: true,
      previousState,
      currentState,
      actions
    };
  }

  /**
   * Monitor connection health
   * @returns {Promise<Object>} - Health monitoring result
   */
  async monitorConnectionHealth() {
    if (!this.healthChecker) {
      throw new Error('Health checker not configured');
    }

    let checks = 0;
    let healthy = false;
    let recoveryAttempted = false;
    let recoverySuccessful = false;

    // First check
    checks++;
    const firstCheck = await this.healthChecker();
    healthy = firstCheck.healthy;

    // If unhealthy, attempt recovery
    if (!healthy) {
      recoveryAttempted = true;
      try {
        await this.recoverConnection({ maxRetries: 1 });
        checks++;
        const secondCheck = await this.healthChecker();
        healthy = secondCheck.healthy;
        recoverySuccessful = healthy;
      } catch (error) {
        recoverySuccessful = false;
      }
    }

    return {
      healthy,
      checks,
      recovery: {
        attempted: recoveryAttempted,
        successful: recoverySuccessful
      }
    };
  }

  /**
   * Set health checker function
   * @param {Function} healthChecker - Health check function
   */
  setHealthChecker(healthChecker) {
    this.healthChecker = healthChecker;
  }

  /**
   * Restore session after reconnection
   * @param {Object} options - Restoration options
   * @returns {Promise<Object>} - Restoration result
   */
  async restoreSession(options = {}) {
    try {
      const session = await this.sessionManager.restoreSession();
      
      if (!session) {
        return {
          restored: false,
          error: 'No session found'
        };
      }

      // Validate session integrity
      const validation = this.validateSession(session, options);
      if (!validation.valid) {
        return {
          restored: false,
          error: 'Session validation failed',
          issues: validation.issues
        };
      }

      // Check session expiration
      const maxAge = options.maxAge || this.config.sessionTimeout;
      if (Date.now() - session.timestamp > maxAge) {
        return {
          restored: false,
          error: 'Session expired',
          expiredAt: session.timestamp,
          maxAge
        };
      }

      // Process session commands
      const pendingCommands = [];
      const completedCommands = [];

      if (Array.isArray(session.commands)) {
        session.commands.forEach(cmd => {
          if (cmd.status === 'pending' || cmd.status === 'executing') {
            pendingCommands.push(cmd);
          } else if (cmd.status === 'completed') {
            completedCommands.push(cmd);
          }
        });
      }

      this.recoveryMetrics.totalRecoveries++;
      this.recoveryMetrics.sessionRecoveries++;
      this.recoveryMetrics.successfulRecoveries++;

      return {
        restored: true,
        session,
        pendingCommands,
        completedCommands
      };

    } catch (error) {
      await this.handleRecoveryError(error, { operation: 'session_restoration' });
      this.recoveryMetrics.totalRecoveries++;
      this.recoveryMetrics.sessionRecoveries++;
      this.recoveryMetrics.failedRecoveries++;
      
      return {
        restored: false,
        error: error.message
      };
    }
  }

  /**
   * Validate session integrity
   * @private
   */
  validateSession(session, options = {}) {
    const issues = [];

    if (!session.id || typeof session.id !== 'string') {
      issues.push('Invalid session ID');
    }

    if (!Array.isArray(session.commands) && typeof session.commands !== 'object') {
      issues.push('Invalid commands structure');
    }

    if (!session.timestamp || typeof session.timestamp !== 'number') {
      issues.push('Invalid timestamp');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Synchronize session state
   * @param {Object} currentState - Current application state
   * @param {Object} sessionState - State from restored session
   * @returns {Promise<Object>} - Synchronization result
   */
  async synchronizeSessionState(currentState, sessionState) {
    const conflicts = [];
    const mergedCommands = new Map(currentState.commands);

    // Process session commands
    if (Array.isArray(sessionState.commands)) {
      sessionState.commands.forEach(sessionCmd => {
        if (mergedCommands.has(sessionCmd.id)) {
          const currentCmd = mergedCommands.get(sessionCmd.id);
          
          if (currentCmd.status !== sessionCmd.status) {
            conflicts.push({
              commandId: sessionCmd.id,
              currentStatus: currentCmd.status,
              sessionStatus: sessionCmd.status,
              resolution: this.resolveStatusConflict(currentCmd.status, sessionCmd.status)
            });
          }
        } else {
          mergedCommands.set(sessionCmd.id, sessionCmd);
        }
      });
    }

    return {
      synchronized: true,
      conflicts,
      merged: {
        commands: mergedCommands
      }
    };
  }

  /**
   * Resolve status conflicts between current and session state
   * @private
   */
  resolveStatusConflict(currentStatus, sessionStatus) {
    // Priority order: executing > completed > pending > failed
    const priorities = {
      'executing': 4,
      'completed': 3,
      'pending': 2,
      'failed': 1
    };

    const currentPriority = priorities[currentStatus] || 0;
    const sessionPriority = priorities[sessionStatus] || 0;

    return currentPriority >= sessionPriority ? 
      `Keep current status: ${currentStatus}` :
      `Use session status: ${sessionStatus}`;
  }

  /**
   * Retry a failed command
   * @param {Object} command - Command to retry
   * @param {Function} executeCommand - Command execution function
   * @param {Object} options - Retry options
   * @returns {Promise<Object>} - Retry result
   */
  async retryCommand(command, executeCommand, options = {}) {
    const {
      maxRetries = this.config.maxRetries,
      timeout = 30000
    } = options;

    const initialAttempts = command.attempts || 0;
    let totalRetries = 0;
    let lastError;

    try {
      for (let retry = 0; retry <= maxRetries; retry++) {
        
        try {
          // Execute with timeout
          const result = await Promise.race([
            executeCommand(command),
            this.createTimeoutPromise(timeout)
          ]);

          this.recoveryMetrics.commandRecoveries++;
          this.recoveryMetrics.successfulRecoveries++;

          return {
            recovered: true,
            attempts: initialAttempts + retry + 1,
            finalResult: result,
            totalRetries: retry
          };

        } catch (error) {
          lastError = error;
          totalRetries = retry + 1;
          
          if (retry < maxRetries) {
            const delay = this.config.baseRetryDelay * Math.pow(2, retry);
            await this.sleep(delay);
          }
        }
      }

      // All retries exhausted
      this.recoveryMetrics.commandRecoveries++;
      this.recoveryMetrics.failedRecoveries++;

      return {
        recovered: false,
        attempts: initialAttempts + maxRetries + 1,
        finalError: lastError,
        exhausted: true
      };

    } catch (error) {
      await this.handleRecoveryError(error, { 
        operation: 'command_retry', 
        commandId: command.id 
      });
      throw error;
    }
  }

  /**
   * Create a timeout promise
   * @private
   */
  createTimeoutPromise(timeout) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), timeout);
    });
  }

  /**
   * Batch retry multiple failed commands
   * @param {Array} failedCommands - Commands to retry
   * @param {Function} executeCommand - Command execution function
   * @returns {Promise<Object>} - Batch retry result
   */
  async retryFailedCommands(failedCommands, executeCommand) {
    const results = [];
    let recovered = 0;
    let failed = 0;

    for (const command of failedCommands) {
      try {
        const result = await this.retryCommand(command, executeCommand);
        results.push({ 
          id: command.id, 
          recovered: result.recovered,
          result: result.finalResult || result.finalError
        });
        
        if (result.recovered) {
          recovered++;
        } else {
          failed++;
        }
      } catch (error) {
        results.push({ 
          id: command.id, 
          recovered: false, 
          error: error.message 
        });
        failed++;
      }
    }

    return {
      totalCommands: failedCommands.length,
      recovered,
      failed,
      results
    };
  }

  /**
   * Execute progressive recovery strategy
   * @param {Object} options - Recovery options
   * @returns {Promise<Object>} - Recovery result
   */
  async executeProgressiveRecovery(options = {}) {
    const {
      continueOnFailure = false,
      onProgress
    } = options;

    const startTime = Date.now();
    const results = [];
    const failedSteps = [];
    
    try {
      for (let i = 0; i < this.recoverySteps.length; i++) {
        const step = this.recoverySteps[i];
        
        if (onProgress) {
          onProgress({
            step: step.name,
            progress: Math.round(((i + 1) / this.recoverySteps.length) * 100),
            message: `Executing ${step.name}...`
          });
        }

        try {
          const result = await step.fn();
          results.push({
            name: step.name,
            success: true,
            result
          });
        } catch (error) {
          results.push({
            name: step.name,
            success: false,
            error: error.message
          });
          failedSteps.push(step.name);

          if (!continueOnFailure) {
            break;
          }
        }
      }

      const completed = failedSteps.length === 0;
      const partialSuccess = results.some(r => r.success) && !completed;

      const result = {
        completed,
        steps: results,
        duration: Date.now() - startTime
      };
      
      if (partialSuccess) {
        result.partialSuccess = partialSuccess;
      }
      
      if (failedSteps.length > 0) {
        result.failedSteps = failedSteps;
      }
      
      return result;

    } catch (error) {
      await this.handleRecoveryError(error, { operation: 'progressive_recovery' });
      throw error;
    }
  }

  /**
   * Set recovery steps for progressive recovery
   * @param {Array} steps - Recovery steps
   */
  setRecoverySteps(steps) {
    this.recoverySteps = steps;
  }

  /**
   * Get recovery metrics
   * @returns {Object} - Recovery metrics
   */
  getRecoveryMetrics() {
    const totalAttempts = this.recoveryMetrics.totalRecoveries;
    const successful = this.recoveryMetrics.successfulRecoveries;
    
    return {
      totalRecoveries: totalAttempts,
      connectionRecoveries: this.recoveryMetrics.connectionRecoveries,
      sessionRecoveries: this.recoveryMetrics.sessionRecoveries,
      commandRecoveries: this.recoveryMetrics.commandRecoveries,
      successRate: totalAttempts > 0 ? (successful / totalAttempts) * 100 : 0,
      averageRecoveryTime: this.calculateAverageRecoveryTime()
    };
  }

  /**
   * Calculate average recovery time
   * @private
   */
  calculateAverageRecoveryTime() {
    const times = this.recoveryMetrics.recoveryTimes;
    return times.length > 0 
      ? times.reduce((sum, time) => sum + time, 0) / times.length
      : 0;
  }

  /**
   * Generate comprehensive recovery report
   * @returns {Object} - Recovery report
   */
  generateRecoveryReport() {
    const metrics = this.getRecoveryMetrics();
    
    return {
      summary: {
        totalAttempts: metrics.totalRecoveries,
        successfulRecoveries: this.recoveryMetrics.successfulRecoveries,
        failedRecoveries: this.recoveryMetrics.failedRecoveries,
        averageTime: metrics.averageRecoveryTime
      },
      breakdown: {
        connection: {
          attempts: metrics.connectionRecoveries,
          successRate: this.calculateSuccessRate('connection')
        },
        session: {
          attempts: metrics.sessionRecoveries,
          successRate: this.calculateSuccessRate('session')
        },
        commands: {
          attempts: metrics.commandRecoveries,
          successRate: this.calculateSuccessRate('command')
        }
      },
      recommendations: this.generateRecoveryRecommendations()
    };
  }

  /**
   * Calculate success rate for specific recovery type
   * @private
   */
  calculateSuccessRate(type) {
    // Simplified calculation - in real implementation would track per-type success rates
    return this.recoveryMetrics.totalRecoveries > 0 
      ? (this.recoveryMetrics.successfulRecoveries / this.recoveryMetrics.totalRecoveries) * 100
      : 0;
  }

  /**
   * Analyze recovery patterns
   * @returns {Array} - Detected patterns
   */
  analyzeRecoveryPatterns() {
    const patterns = [];
    
    for (const [patternKey, count] of this.recoveryMetrics.recoveryPatterns.entries()) {
      if (count >= 3) {
        patterns.push({
          pattern: `repeated_${patternKey}`,
          count,
          recommendation: `Consider investigating recurring ${patternKey} issues`
        });
      }
    }
    
    return patterns;
  }

  /**
   * Track recovery patterns
   * @private
   */
  trackRecoveryPattern(pattern) {
    const current = this.recoveryMetrics.recoveryPatterns.get(pattern) || 0;
    this.recoveryMetrics.recoveryPatterns.set(pattern, current + 1);
  }

  /**
   * Generate recovery recommendations
   * @private
   */
  generateRecoveryRecommendations() {
    const recommendations = [];
    const metrics = this.getRecoveryMetrics();
    
    if (metrics.successRate < 80) {
      recommendations.push({
        type: 'success_rate',
        priority: 'high',
        message: 'Recovery success rate is below 80%. Consider investigating underlying issues.'
      });
    }
    
    if (metrics.averageRecoveryTime > 5000) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Recovery times are high. Consider optimizing recovery procedures.'
      });
    }
    
    return recommendations;
  }

  /**
   * Handle recovery errors
   * @param {Error} error - Recovery error
   * @param {Object} context - Error context
   * @returns {Promise<Object>} - Error handling result
   */
  async handleRecoveryError(error, context) {
    if (this.errorHandler) {
      const result = await this.errorHandler.handleError(error, {
        ...context,
        component: 'recovery'
      });
      
      const categorized = this.errorHandler.categorizeError(error, 'recovery');
      
      return {
        handled: result.handled,
        shouldRetry: categorized.retryable,
        waitTime: categorized.retryable ? this.config.baseRetryDelay : 0
      };
    }
    
    // Fallback error handling
    console.error('Recovery error:', error);
    return {
      handled: false,
      shouldRetry: false,
      waitTime: 0
    };
  }

  /**
   * Register recovery state change callback
   * @param {Function} callback - State change callback
   */
  onRecoveryStateChange(callback) {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * Update recovery state and notify callbacks
   * @private
   */
  updateRecoveryState(state, operation, success) {
    this.recoveryState = state;
    
    this.stateChangeCallbacks.forEach(callback => {
      callback({
        state,
        operation,
        progress: this.calculateRecoveryProgress(state),
        success
      });
    });
  }

  /**
   * Calculate recovery progress
   * @private
   */
  calculateRecoveryProgress(state) {
    const progressMap = {
      'idle': 0,
      'recovering': 50,
      'recovered': 100,
      'failed': 0
    };
    return progressMap[state] || 0;
  }

  /**
   * Sleep utility
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}