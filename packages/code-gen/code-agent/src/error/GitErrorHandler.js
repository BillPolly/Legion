/**
 * GitErrorHandler - Comprehensive Git error classification and recovery
 * 
 * Handles all types of Git errors including authentication, network,
 * conflicts, repository issues, and provides automated recovery strategies.
 */

import { EventEmitter } from 'events';

class GitErrorHandler extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableAutoRecovery: config.enableAutoRecovery !== false,
      maxRetryAttempts: config.maxRetryAttempts || 3,
      retryDelayMs: config.retryDelayMs || 1000,
      enableLogging: config.enableLogging !== false,
      backoffMultiplier: config.backoffMultiplier || 2,
      enableMetrics: config.enableMetrics !== false,
      ...config
    };
    
    // Error classification patterns
    this.errorPatterns = {
      authentication: [
        /authentication failed/i,
        /invalid credentials/i,
        /bad credentials/i,
        /permission denied/i,
        /unauthorized/i,
        /403.*forbidden/i,
        /401.*unauthorized/i
      ],
      network: [
        /network.*unreachable/i,
        /connection.*timed.*out/i,
        /unable to connect/i,
        /connection refused/i,
        /network.*error/i,
        /timeout/i,
        /socket.*error/i,
        /ENOTFOUND/i,
        /ECONNREFUSED/i
      ],
      conflict: [
        /merge conflict/i,
        /conflict.*detected/i,
        /automatic merge failed/i,
        /conflicted/i,
        /both modified/i,
        /unmerged paths/i
      ],
      repository: [
        /not a git repository/i,
        /repository.*not.*found/i,
        /repository.*does.*not.*exist/i,
        /fatal:.*not.*git.*repository/i,
        /repository.*corrupted/i,
        /invalid.*repository/i
      ],
      branch: [
        /branch.*not.*found/i,
        /branch.*already.*exists/i,
        /cannot.*switch.*branch/i,
        /branch.*creation.*failed/i,
        /invalid.*branch.*name/i
      ],
      commit: [
        /nothing to commit/i,
        /commit.*failed/i,
        /invalid.*commit/i,
        /commit.*message.*required/i,
        /pre-commit.*hook.*failed/i
      ],
      push: [
        /failed to push/i,
        /push.*rejected/i,
        /remote.*rejected/i,
        /non-fast-forward/i,
        /updates.*rejected/i,
        /push.*failed.*to.*remote/i
      ],
      pull: [
        /pull.*failed/i,
        /cannot.*pull/i,
        /your.*branch.*behind/i,
        /divergent.*branches/i,
        /pull.*rejected/i
      ],
      remote: [
        /remote.*not.*found/i,
        /remote.*url.*invalid/i,
        /remote.*connection.*failed/i,
        /remote.*repository.*not.*found/i
      ],
      rateLimit: [
        /rate.*limit.*exceeded/i,
        /api.*rate.*limit/i,
        /abuse.*detection/i,
        /secondary.*rate.*limit/i,
        /403.*rate.*limit/i
      ]
    };
    
    // Recovery strategies
    this.recoveryStrategies = {
      authentication: this.recoverAuthentication.bind(this),
      network: this.recoverNetwork.bind(this),
      conflict: this.recoverConflict.bind(this),
      repository: this.recoverRepository.bind(this),
      branch: this.recoverBranch.bind(this),
      commit: this.recoverCommit.bind(this),
      push: this.recoverPush.bind(this),
      pull: this.recoverPull.bind(this),
      remote: this.recoverRemote.bind(this),
      rateLimit: this.recoverRateLimit.bind(this)
    };
    
    // Error metrics
    this.metrics = {
      totalErrors: 0,
      errorsByType: {},
      successfulRecoveries: 0,
      failedRecoveries: 0,
      retryAttempts: 0
    };
    
    this.initialized = false;
  }
  
  /**
   * Initialize the error handler
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    // Initialize error tracking
    for (const errorType of Object.keys(this.errorPatterns)) {
      this.metrics.errorsByType[errorType] = {
        count: 0,
        recovered: 0,
        failed: 0
      };
    }
    
    this.initialized = true;
    
    if (this.config.enableLogging) {
      console.log('✅ GitErrorHandler initialized');
    }
  }
  
  /**
   * Handle a Git error with classification and recovery
   * @param {Error} error - The error to handle
   * @param {Object} context - Additional context about the operation
   * @returns {Object} Recovery result
   */
  async handleError(error, context = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const errorInfo = this.classifyError(error, context);
    this.recordError(errorInfo);
    
    this.emit('error-classified', {
      classification: errorInfo.classification,
      severity: errorInfo.severity,
      context,
      timestamp: new Date().toISOString()
    });
    
    // Attempt recovery if enabled
    if (this.config.enableAutoRecovery && errorInfo.recoverable) {
      const recoveryResult = await this.attemptRecovery(errorInfo, context);
      this.recordRecoveryAttempt(recoveryResult);
      return recoveryResult;
    }
    
    return {
      success: false,
      error: errorInfo,
      recovery: 'disabled',
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Classify an error by type and determine recovery strategy
   * @param {Error} error - The error to classify
   * @param {Object} context - Operation context
   * @returns {Object} Error classification
   */
  classifyError(error, context = {}) {
    const errorMessage = error.message || error.toString();
    let classification = 'unknown';
    let severity = 'medium';
    let recoverable = false;
    let strategy = null;
    
    // Check each error pattern
    for (const [errorType, patterns] of Object.entries(this.errorPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(errorMessage)) {
          classification = errorType;
          strategy = this.recoveryStrategies[errorType];
          break;
        }
      }
      if (classification !== 'unknown') break;
    }
    
    // Determine severity and recoverability
    switch (classification) {
      case 'authentication':
        severity = 'high';
        recoverable = true;
        break;
      case 'network':
        severity = 'medium';
        recoverable = true;
        break;
      case 'conflict':
        severity = 'medium';
        recoverable = true;
        break;
      case 'repository':
        severity = 'high';
        recoverable = true;
        break;
      case 'rateLimit':
        severity = 'low';
        recoverable = true;
        break;
      case 'branch':
      case 'commit':
      case 'push':
      case 'pull':
      case 'remote':
        severity = 'medium';
        recoverable = true;
        break;
      default:
        severity = 'unknown';
        recoverable = false;
    }
    
    return {
      classification,
      severity,
      recoverable,
      strategy,
      originalError: error,
      message: errorMessage,
      context,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Attempt to recover from an error
   * @param {Object} errorInfo - Classified error information
   * @param {Object} context - Operation context
   * @returns {Object} Recovery result
   */
  async attemptRecovery(errorInfo, context) {
    const { classification, strategy } = errorInfo;
    
    if (!strategy) {
      return {
        success: false,
        error: errorInfo,
        recovery: 'no-strategy',
        timestamp: new Date().toISOString()
      };
    }
    
    try {
      this.emit('recovery-start', {
        classification,
        context,
        timestamp: new Date().toISOString()
      });
      
      const result = await strategy(errorInfo, context);
      
      this.emit('recovery-complete', {
        classification,
        success: result.success,
        context,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: result.success,
        recovery: result,
        error: errorInfo,
        timestamp: new Date().toISOString()
      };
      
    } catch (recoveryError) {
      this.emit('recovery-failed', {
        classification,
        error: recoveryError.message,
        context,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        error: errorInfo,
        recovery: 'failed',
        recoveryError: recoveryError.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Recovery strategy for authentication errors
   */
  async recoverAuthentication(errorInfo, context) {
    const strategies = [
      'refresh-credentials',
      'check-permissions',
      'validate-token',
      'fallback-auth'
    ];
    
    for (const strategy of strategies) {
      try {
        switch (strategy) {
          case 'refresh-credentials':
            // Attempt to refresh authentication
            if (context.refreshCredentials) {
              await context.refreshCredentials();
              return { success: true, strategy, action: 'credentials-refreshed' };
            }
            break;
            
          case 'check-permissions':
            // Verify permissions
            if (context.checkPermissions) {
              const hasPermission = await context.checkPermissions();
              if (!hasPermission) {
                return { success: false, strategy, action: 'insufficient-permissions' };
              }
            }
            break;
            
          case 'validate-token':
            // Validate token format
            if (context.validateToken) {
              const isValid = await context.validateToken();
              if (!isValid) {
                return { success: false, strategy, action: 'invalid-token-format' };
              }
            }
            break;
            
          case 'fallback-auth':
            // Use fallback authentication method
            if (context.fallbackAuth) {
              await context.fallbackAuth();
              return { success: true, strategy, action: 'fallback-auth-used' };
            }
            break;
        }
      } catch (error) {
        continue; // Try next strategy
      }
    }
    
    return { success: false, strategy: 'all-failed', action: 'manual-intervention-required' };
  }
  
  /**
   * Recovery strategy for network errors
   */
  async recoverNetwork(errorInfo, context) {
    const maxAttempts = this.config.maxRetryAttempts;
    let delay = this.config.retryDelayMs;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Wait with exponential backoff
        if (attempt > 1) {
          await this.sleep(delay);
          delay *= this.config.backoffMultiplier;
        }
        
        // Retry the operation
        if (context.retryOperation) {
          await context.retryOperation();
          return { 
            success: true, 
            strategy: 'retry-with-backoff', 
            attempts: attempt,
            action: 'operation-succeeded'
          };
        }
        
        // Test connectivity
        if (context.testConnectivity) {
          const isConnected = await context.testConnectivity();
          if (isConnected) {
            return { 
              success: true, 
              strategy: 'connectivity-restored', 
              attempts: attempt,
              action: 'network-available'
            };
          }
        }
        
      } catch (error) {
        if (attempt === maxAttempts) {
          return { 
            success: false, 
            strategy: 'retry-exhausted', 
            attempts: attempt,
            action: 'network-still-unavailable'
          };
        }
      }
    }
    
    return { success: false, strategy: 'network-recovery-failed', action: 'check-network-configuration' };
  }
  
  /**
   * Recovery strategy for merge conflicts
   */
  async recoverConflict(errorInfo, context) {
    const strategies = [
      'auto-merge',
      'prefer-ours',
      'prefer-theirs',
      'interactive-resolve'
    ];
    
    for (const strategy of strategies) {
      try {
        switch (strategy) {
          case 'auto-merge':
            if (context.autoMerge) {
              const result = await context.autoMerge();
              if (result.success) {
                return { success: true, strategy, action: 'conflicts-auto-resolved' };
              }
            }
            break;
            
          case 'prefer-ours':
            if (context.preferOurs) {
              await context.preferOurs();
              return { success: true, strategy, action: 'conflicts-resolved-prefer-ours' };
            }
            break;
            
          case 'prefer-theirs':
            if (context.preferTheirs) {
              await context.preferTheirs();
              return { success: true, strategy, action: 'conflicts-resolved-prefer-theirs' };
            }
            break;
            
          case 'interactive-resolve':
            if (context.interactiveResolve) {
              const resolved = await context.interactiveResolve();
              if (resolved) {
                return { success: true, strategy, action: 'conflicts-manually-resolved' };
              }
            }
            break;
        }
      } catch (error) {
        continue; // Try next strategy
      }
    }
    
    return { success: false, strategy: 'conflict-resolution-failed', action: 'manual-conflict-resolution-required' };
  }
  
  /**
   * Recovery strategy for repository errors
   */
  async recoverRepository(errorInfo, context) {
    const strategies = [
      'reinitialize',
      'repair',
      'clone-fresh',
      'reset-state'
    ];
    
    for (const strategy of strategies) {
      try {
        switch (strategy) {
          case 'reinitialize':
            if (context.reinitializeRepository) {
              await context.reinitializeRepository();
              return { success: true, strategy, action: 'repository-reinitialized' };
            }
            break;
            
          case 'repair':
            if (context.repairRepository) {
              const repaired = await context.repairRepository();
              if (repaired) {
                return { success: true, strategy, action: 'repository-repaired' };
              }
            }
            break;
            
          case 'clone-fresh':
            if (context.cloneFresh) {
              await context.cloneFresh();
              return { success: true, strategy, action: 'repository-cloned-fresh' };
            }
            break;
            
          case 'reset-state':
            if (context.resetState) {
              await context.resetState();
              return { success: true, strategy, action: 'repository-state-reset' };
            }
            break;
        }
      } catch (error) {
        continue; // Try next strategy
      }
    }
    
    return { success: false, strategy: 'repository-recovery-failed', action: 'manual-repository-intervention-required' };
  }
  
  /**
   * Recovery strategy for branch errors
   */
  async recoverBranch(errorInfo, context) {
    const strategies = [
      'switch-to-main',
      'create-alternative',
      'force-checkout',
      'cleanup-branches'
    ];
    
    for (const strategy of strategies) {
      try {
        switch (strategy) {
          case 'switch-to-main':
            if (context.switchToMain) {
              await context.switchToMain();
              return { success: true, strategy, action: 'switched-to-main-branch' };
            }
            break;
            
          case 'create-alternative':
            if (context.createAlternativeBranch) {
              const branchName = await context.createAlternativeBranch();
              return { success: true, strategy, action: `created-alternative-branch-${branchName}` };
            }
            break;
            
          case 'force-checkout':
            if (context.forceCheckout) {
              await context.forceCheckout();
              return { success: true, strategy, action: 'forced-branch-checkout' };
            }
            break;
            
          case 'cleanup-branches':
            if (context.cleanupBranches) {
              await context.cleanupBranches();
              return { success: true, strategy, action: 'branches-cleaned-up' };
            }
            break;
        }
      } catch (error) {
        continue; // Try next strategy
      }
    }
    
    return { success: false, strategy: 'branch-recovery-failed', action: 'manual-branch-intervention-required' };
  }
  
  /**
   * Recovery strategy for commit errors
   */
  async recoverCommit(errorInfo, context) {
    const strategies = [
      'stage-changes',
      'fix-message',
      'amend-commit',
      'reset-and-retry'
    ];
    
    for (const strategy of strategies) {
      try {
        switch (strategy) {
          case 'stage-changes':
            if (context.stageChanges) {
              await context.stageChanges();
              return { success: true, strategy, action: 'changes-staged' };
            }
            break;
            
          case 'fix-message':
            if (context.fixCommitMessage) {
              await context.fixCommitMessage();
              return { success: true, strategy, action: 'commit-message-fixed' };
            }
            break;
            
          case 'amend-commit':
            if (context.amendCommit) {
              await context.amendCommit();
              return { success: true, strategy, action: 'commit-amended' };
            }
            break;
            
          case 'reset-and-retry':
            if (context.resetAndRetry) {
              await context.resetAndRetry();
              return { success: true, strategy, action: 'reset-and-retried' };
            }
            break;
        }
      } catch (error) {
        continue; // Try next strategy
      }
    }
    
    return { success: false, strategy: 'commit-recovery-failed', action: 'manual-commit-intervention-required' };
  }
  
  /**
   * Recovery strategy for push errors
   */
  async recoverPush(errorInfo, context) {
    const strategies = [
      'pull-before-push',
      'force-push',
      'rebase-and-push',
      'create-new-branch'
    ];
    
    for (const strategy of strategies) {
      try {
        switch (strategy) {
          case 'pull-before-push':
            if (context.pullBeforePush) {
              await context.pullBeforePush();
              return { success: true, strategy, action: 'pulled-before-push' };
            }
            break;
            
          case 'force-push':
            if (context.forcePush && context.allowForcePush) {
              await context.forcePush();
              return { success: true, strategy, action: 'force-pushed' };
            }
            break;
            
          case 'rebase-and-push':
            if (context.rebaseAndPush) {
              await context.rebaseAndPush();
              return { success: true, strategy, action: 'rebased-and-pushed' };
            }
            break;
            
          case 'create-new-branch':
            if (context.createNewBranch) {
              const branchName = await context.createNewBranch();
              return { success: true, strategy, action: `created-new-branch-${branchName}` };
            }
            break;
        }
      } catch (error) {
        continue; // Try next strategy
      }
    }
    
    return { success: false, strategy: 'push-recovery-failed', action: 'manual-push-intervention-required' };
  }
  
  /**
   * Recovery strategy for pull errors
   */
  async recoverPull(errorInfo, context) {
    const strategies = [
      'stash-and-pull',
      'reset-and-pull',
      'fetch-and-merge',
      'rebase-instead'
    ];
    
    for (const strategy of strategies) {
      try {
        switch (strategy) {
          case 'stash-and-pull':
            if (context.stashAndPull) {
              await context.stashAndPull();
              return { success: true, strategy, action: 'stashed-and-pulled' };
            }
            break;
            
          case 'reset-and-pull':
            if (context.resetAndPull) {
              await context.resetAndPull();
              return { success: true, strategy, action: 'reset-and-pulled' };
            }
            break;
            
          case 'fetch-and-merge':
            if (context.fetchAndMerge) {
              await context.fetchAndMerge();
              return { success: true, strategy, action: 'fetched-and-merged' };
            }
            break;
            
          case 'rebase-instead':
            if (context.rebaseInstead) {
              await context.rebaseInstead();
              return { success: true, strategy, action: 'rebased-instead-of-merge' };
            }
            break;
        }
      } catch (error) {
        continue; // Try next strategy
      }
    }
    
    return { success: false, strategy: 'pull-recovery-failed', action: 'manual-pull-intervention-required' };
  }
  
  /**
   * Recovery strategy for remote errors
   */
  async recoverRemote(errorInfo, context) {
    const strategies = [
      'update-remote-url',
      'recreate-remote',
      'test-connectivity',
      'fallback-remote'
    ];
    
    for (const strategy of strategies) {
      try {
        switch (strategy) {
          case 'update-remote-url':
            if (context.updateRemoteUrl) {
              await context.updateRemoteUrl();
              return { success: true, strategy, action: 'remote-url-updated' };
            }
            break;
            
          case 'recreate-remote':
            if (context.recreateRemote) {
              await context.recreateRemote();
              return { success: true, strategy, action: 'remote-recreated' };
            }
            break;
            
          case 'test-connectivity':
            if (context.testRemoteConnectivity) {
              const connected = await context.testRemoteConnectivity();
              if (connected) {
                return { success: true, strategy, action: 'remote-connectivity-verified' };
              }
            }
            break;
            
          case 'fallback-remote':
            if (context.useFallbackRemote) {
              await context.useFallbackRemote();
              return { success: true, strategy, action: 'fallback-remote-used' };
            }
            break;
        }
      } catch (error) {
        continue; // Try next strategy
      }
    }
    
    return { success: false, strategy: 'remote-recovery-failed', action: 'manual-remote-intervention-required' };
  }
  
  /**
   * Recovery strategy for rate limiting errors
   */
  async recoverRateLimit(errorInfo, context) {
    const resetTime = this.extractResetTime(errorInfo.message) || 3600; // Default 1 hour
    const waitTime = Math.min(resetTime * 1000, 300000); // Max 5 minutes wait
    
    this.emit('rate-limit-hit', {
      resetTime,
      waitTime,
      timestamp: new Date().toISOString()
    });
    
    // Wait for rate limit reset (with reduced time for testing)
    await this.sleep(waitTime);
    
    // Retry the operation
    if (context.retryOperation) {
      try {
        await context.retryOperation();
        return { 
          success: true, 
          strategy: 'wait-and-retry', 
          waitTime,
          action: 'rate-limit-reset-operation-retried'
        };
      } catch (error) {
        return { 
          success: false, 
          strategy: 'rate-limit-recovery-failed',
          action: 'operation-still-fails-after-wait'
        };
      }
    }
    
    return { 
      success: true, 
      strategy: 'rate-limit-wait', 
      waitTime,
      action: 'waited-for-rate-limit-reset'
    };
  }
  
  /**
   * Extract rate limit reset time from error message
   */
  extractResetTime(message) {
    const resetMatch = message.match(/reset.*?(\d+)/i);
    if (resetMatch) {
      return parseInt(resetMatch[1]);
    }
    
    const timeMatch = message.match(/(\d+)\s*(second|minute|hour)/i);
    if (timeMatch) {
      const value = parseInt(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      
      switch (unit) {
        case 'second': return value;
        case 'minute': return value * 60;
        case 'hour': return value * 3600;
      }
    }
    
    return null;
  }
  
  /**
   * Record error occurrence for metrics
   */
  recordError(errorInfo) {
    if (!this.config.enableMetrics) {
      return;
    }
    
    this.metrics.totalErrors++;
    
    const { classification } = errorInfo;
    if (this.metrics.errorsByType[classification]) {
      this.metrics.errorsByType[classification].count++;
    }
    
    if (this.config.enableLogging) {
      console.warn(`🚨 Git error classified: ${classification} - ${errorInfo.message}`);
    }
  }
  
  /**
   * Record recovery attempt result
   */
  recordRecoveryAttempt(result) {
    if (!this.config.enableMetrics) {
      return;
    }
    
    this.metrics.retryAttempts++;
    
    if (result.success) {
      this.metrics.successfulRecoveries++;
      
      const errorType = result.error?.classification;
      if (errorType && this.metrics.errorsByType[errorType]) {
        this.metrics.errorsByType[errorType].recovered++;
      }
      
      if (this.config.enableLogging) {
        console.log(`✅ Git error recovery successful: ${result.recovery?.strategy || 'unknown'}`);
      }
    } else {
      this.metrics.failedRecoveries++;
      
      const errorType = result.error?.classification;
      if (errorType && this.metrics.errorsByType[errorType]) {
        this.metrics.errorsByType[errorType].failed++;
      }
      
      if (this.config.enableLogging) {
        console.warn(`❌ Git error recovery failed: ${result.recovery || 'unknown'}`);
      }
    }
  }
  
  /**
   * Get error handling metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalErrors > 0 
        ? (this.metrics.successfulRecoveries / this.metrics.totalErrors) * 100 
        : 0
    };
  }
  
  /**
   * Reset error metrics
   */
  resetMetrics() {
    this.metrics = {
      totalErrors: 0,
      errorsByType: {},
      successfulRecoveries: 0,
      failedRecoveries: 0,
      retryAttempts: 0
    };
    
    // Reinitialize error type metrics
    for (const errorType of Object.keys(this.errorPatterns)) {
      this.metrics.errorsByType[errorType] = {
        count: 0,
        recovered: 0,
        failed: 0
      };
    }
  }
  
  /**
   * Utility function for delays
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Clean up resources
   */
  async cleanup() {
    this.removeAllListeners();
    
    if (this.config.enableLogging) {
      console.log('✅ GitErrorHandler cleanup completed');
    }
  }
}

export default GitErrorHandler;