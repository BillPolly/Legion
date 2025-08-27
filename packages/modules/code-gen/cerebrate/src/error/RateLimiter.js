/**
 * Rate Limiting and Throttling System for Cerebrate Chrome Extension
 * Provides command rate limiting, request throttling, and violation tracking
 */
export class RateLimiter {

  constructor(options = {}) {
    this.config = this.validateAndNormalizeConfig(options);
    
    // Rate limiting storage
    this.limits = new Map(); // key -> { count, resetTime, violations }
    this.customLimits = new Map(); // key -> { limit, window }
    this.commandLimits = new Map(); // command -> { limit, window }
    
    // Throttling
    this.throttlers = new Map(); // key -> Throttler instance
    
    // Monitoring
    this.rateLimitCallbacks = [];
    
    // Penalty system
    this.penalties = new Map(); // key -> { count, lastViolation, penaltyTime }
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Validate and normalize configuration
   * @private
   */
  validateAndNormalizeConfig(options) {
    const defaults = {
      defaultLimit: 10,
      defaultWindow: 1000,
      burstLimit: 20,
      enableBurst: true,
      enablePenalties: false,
      penaltyMultiplier: 2,
      maxPenalty: 5000,
      storageType: 'memory',
      cleanupThreshold: 300000 // 5 minutes
    };

    const config = { ...defaults, ...options };

    // Validation
    if (typeof config.defaultLimit !== 'number' || config.defaultLimit <= 0) {
      throw new Error('Invalid configuration: defaultLimit must be > 0');
    }
    
    if (typeof config.defaultWindow !== 'number' || config.defaultWindow <= 0) {
      throw new Error('Invalid configuration: defaultWindow must be > 0');
    }

    return config;
  }

  /**
   * Check if request is within rate limit
   * @param {string} key - Rate limit key (e.g., command name)
   * @param {Object} options - Check options
   * @returns {Promise<Object>} - Rate limit result
   */
  async checkLimit(key, options = {}) {
    const now = Date.now();
    const { allowBurst = false } = options;
    
    // Get limits for this key
    const limits = this.getLimitsForKey(key);
    const { limit, window } = limits;
    
    // Get current usage
    let usage = this.limits.get(key) || {
      count: 0,
      burstCount: 0,
      resetTime: now + window,
      violations: [],
      firstRequest: now
    };

    // Reset if window expired
    if (now >= usage.resetTime) {
      usage = {
        count: 0,
        burstCount: 0,
        resetTime: now + window,
        violations: [],
        firstRequest: now
      };
    }

    // Check normal limit
    const normalRemaining = Math.max(0, limit - usage.count);
    
    if (usage.count < limit) {
      // Within normal limit
      usage.count++;
      this.limits.set(key, usage);
      
      return {
        allowed: true,
        limit,
        remaining: normalRemaining - 1,
        resetTime: usage.resetTime,
        retryAfter: null
      };
    }

    // Check burst limit if enabled and we're at normal limit
    if (allowBurst && this.config.enableBurst) {
      const totalUsage = usage.count + usage.burstCount;
      const burstRemaining = Math.max(0, this.config.burstLimit - totalUsage);
      
      if (totalUsage < this.config.burstLimit) {
        usage.burstCount++;
        this.limits.set(key, usage);
        
        return {
          allowed: true,
          limit,
          remaining: 0,
          resetTime: usage.resetTime,
          retryAfter: null,
          burst: true,
          burstRemaining: burstRemaining - 1
        };
      }
    }

    // Rate limit exceeded
    this.recordViolation(key, usage, now);
    
    const retryAfter = usage.resetTime - now;
    const penaltyTime = this.config.enablePenalties ? this.calculatePenalty(key) : 0;
    
    // Notify monitors - increment usage for violation count
    this.notifyRateLimitExceeded(key, limit, usage.count + usage.burstCount + 1);
    
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetTime: usage.resetTime,
      retryAfter: Math.max(retryAfter, penaltyTime),
      penaltyTime: penaltyTime > 0 ? penaltyTime : undefined
    };
  }

  /**
   * Get rate limits for a specific key
   * @private
   */
  getLimitsForKey(key) {
    // Check custom limits first
    if (this.customLimits.has(key)) {
      return this.customLimits.get(key);
    }
    
    // Check command-specific limits
    if (this.commandLimits.has(key)) {
      return this.commandLimits.get(key);
    }
    
    // Use defaults
    return {
      limit: this.config.defaultLimit,
      window: this.config.defaultWindow
    };
  }

  /**
   * Record a rate limit violation
   * @private
   */
  recordViolation(key, usage, timestamp) {
    const totalUsage = usage.count + usage.burstCount;
    const violationsSoFar = usage.violations.length;
    
    // If we're getting rapid violations (multiple in short time), consider it burst
    const recentViolations = usage.violations.filter(v => timestamp - v.timestamp < 1000).length;
    const isBurstPattern = violationsSoFar > 2 || recentViolations > 1;
    
    usage.violations.push({
      timestamp,
      type: isBurstPattern ? 'burst' : 'normal'
    });
    
    this.limits.set(key, usage);
  }

  /**
   * Calculate penalty time for violations
   * @private
   */
  calculatePenalty(key) {
    const penalty = this.penalties.get(key) || { count: 0, lastViolation: 0, penaltyTime: 0 };
    const now = Date.now();
    
    // Reset penalty if enough time has passed
    if (now - penalty.lastViolation > this.config.defaultWindow * 10) {
      penalty.count = 0;
      penalty.penaltyTime = 0;
    }
    
    penalty.count++;
    penalty.lastViolation = now;
    penalty.penaltyTime = Math.min(
      this.config.maxPenalty,
      penalty.penaltyTime * this.config.penaltyMultiplier || 1000
    );
    
    this.penalties.set(key, penalty);
    
    return penalty.penaltyTime;
  }

  /**
   * Set custom rate limit for specific key
   * @param {string} key - Rate limit key
   * @param {Object} limits - Custom limits
   */
  setCustomLimit(key, limits) {
    this.customLimits.set(key, limits);
  }

  /**
   * Set rate limits for specific commands
   * @param {Object} commandLimits - Map of command -> limits
   */
  setCommandLimits(commandLimits) {
    for (const [command, limits] of Object.entries(commandLimits)) {
      this.commandLimits.set(command, limits);
    }
  }

  /**
   * Enable penalty system
   * @param {Object} options - Penalty options
   */
  enablePenalties(options = {}) {
    this.config.enablePenalties = true;
    if (options.escalation !== undefined) this.config.escalation = options.escalation;
    if (options.maxPenalty !== undefined) this.config.maxPenalty = options.maxPenalty;
    if (options.penaltyMultiplier !== undefined) this.config.penaltyMultiplier = options.penaltyMultiplier;
  }

  /**
   * Create a throttler for managing concurrent requests
   * @param {string} key - Throttler key
   * @param {Object} options - Throttling options
   * @returns {Throttler} - Throttler instance
   */
  createThrottler(key, options = {}) {
    const throttler = new Throttler(options);
    this.throttlers.set(key, throttler);
    return throttler;
  }

  /**
   * Get rate limit statistics for a key
   * @param {string} key - Rate limit key
   * @returns {Object} - Statistics
   */
  getStats(key) {
    const usage = this.limits.get(key) || { count: 0, burstCount: 0, resetTime: Date.now() };
    const limits = this.getLimitsForKey(key);
    
    return {
      normalUsage: usage.count,
      burstUsage: usage.burstCount,
      totalUsage: usage.count + usage.burstCount,
      normalRemaining: Math.max(0, limits.limit - usage.count),
      burstRemaining: Math.max(0, this.config.burstLimit - usage.count - usage.burstCount),
      resetTime: usage.resetTime
    };
  }

  /**
   * Get violation information for a key
   * @param {string} key - Rate limit key
   * @returns {Object} - Violation information
   */
  getViolations(key) {
    const usage = this.limits.get(key);
    if (!usage || usage.violations.length === 0) {
      return { count: 0 };
    }
    
    const violations = usage.violations;
    const burstViolations = violations.filter(v => v.type === 'burst').length;
    const pattern = burstViolations > violations.length / 2 ? 'burst' : 'normal';
    
    return {
      count: violations.length,
      firstViolation: violations[0].timestamp,
      lastViolation: violations[violations.length - 1].timestamp,
      pattern
    };
  }

  /**
   * Generate rate limit error response
   * @param {string} key - Rate limit key
   * @returns {Object} - Error response
   */
  generateRateLimitError(key) {
    const limits = this.getLimitsForKey(key);
    const usage = this.limits.get(key) || { resetTime: Date.now() };
    
    return {
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit of ${limits.limit} requests per ${limits.window}ms exceeded`,
      retryAfter: Math.max(0, usage.resetTime - Date.now()),
      limit: limits.limit,
      window: limits.window
    };
  }

  /**
   * Generate user-friendly rate limit message
   * @param {string} key - Rate limit key
   * @returns {Object} - User message
   */
  getUserMessage(key) {
    const limits = this.getLimitsForKey(key);
    const windowSeconds = Math.round(limits.window / 1000);
    
    return {
      title: 'Rate Limit Reached',
      message: `You've reached the limit of ${limits.limit} requests per ${windowSeconds} second${windowSeconds > 1 ? 's' : ''}. Please wait before trying again.`,
      severity: 'warning',
      actions: [
        {
          label: 'Wait and Retry',
          action: 'wait'
        }
      ]
    };
  }

  /**
   * Get global rate limiting statistics
   * @returns {Object} - Global statistics
   */
  getGlobalStats() {
    const totalRequests = Array.from(this.limits.values())
      .reduce((sum, usage) => sum + usage.count + usage.burstCount, 0);
    
    const totalKeys = this.limits.size;
    const violatedKeys = Array.from(this.limits.values())
      .filter(usage => usage.violations.length > 0).length;
    
    const averageUsage = totalKeys > 0 ? Math.round(totalRequests / totalKeys) : 0;
    
    const topKeys = Array.from(this.limits.entries())
      .map(([key, usage]) => ({
        key,
        requests: usage.count + usage.burstCount
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
    
    return {
      totalRequests,
      totalKeys,
      violatedKeys,
      averageUsage,
      topKeys
    };
  }

  /**
   * Register rate limit monitoring callback
   * @param {Function} callback - Monitoring callback
   */
  onRateLimit(callback) {
    this.rateLimitCallbacks.push(callback);
  }

  /**
   * Notify monitors of rate limit exceeded
   * @private
   */
  notifyRateLimitExceeded(key, limit, usage) {
    const event = {
      key,
      limit,
      usage,
      violation: true,
      timestamp: Date.now()
    };
    
    this.rateLimitCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Rate limit callback error:', error);
      }
    });
  }

  /**
   * Cleanup expired rate limit entries
   */
  cleanup() {
    const now = Date.now();
    const threshold = this.config.cleanupThreshold;
    
    for (const [key, usage] of this.limits.entries()) {
      if (now >= usage.resetTime || now - usage.firstRequest > threshold) {
        this.limits.delete(key);
      }
    }
    
    // Cleanup old penalties
    for (const [key, penalty] of this.penalties.entries()) {
      if (now - penalty.lastViolation > threshold) {
        this.penalties.delete(key);
      }
    }
  }

  /**
   * Destroy rate limiter and cleanup resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.limits.clear();
    this.customLimits.clear();
    this.commandLimits.clear();
    this.throttlers.clear();
    this.rateLimitCallbacks.length = 0;
    this.penalties.clear();
  }
}

/**
 * Request Throttler for managing concurrent operations
 */
class Throttler {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 5;
    this.queueSize = options.queueSize || 50;
    
    this.executing = 0;
    this.queue = [];
    this.completed = 0;
    this.rejected = 0;
  }

  /**
   * Execute function with throttling
   * @param {Function} fn - Function to execute
   * @returns {Promise} - Execution result
   */
  async execute(fn) {
    return new Promise((resolve, reject) => {
      if (this.executing < this.maxConcurrent) {
        this.executeNow(fn, resolve, reject);
      } else if (this.queue.length < this.queueSize) {
        this.queue.push({ fn, resolve, reject });
      } else {
        this.rejected++;
        reject(new Error('Queue full'));
      }
    });
  }

  /**
   * Execute function immediately
   * @private
   */
  async executeNow(fn, resolve, reject) {
    this.executing++;
    
    try {
      const result = await fn();
      this.completed++;
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.executing--;
      this.processQueue();
    }
  }

  /**
   * Process queued requests
   * @private
   */
  processQueue() {
    if (this.queue.length > 0 && this.executing < this.maxConcurrent) {
      const { fn, resolve, reject } = this.queue.shift();
      this.executeNow(fn, resolve, reject);
    }
  }

  /**
   * Get throttling statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      executing: this.executing,
      queued: this.queue.length,
      completed: this.completed,
      rejected: this.rejected,
      maxConcurrent: this.maxConcurrent,
      queueSize: this.queueSize
    };
  }
}