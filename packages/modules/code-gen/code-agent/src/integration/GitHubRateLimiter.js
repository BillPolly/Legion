/**
 * GitHubRateLimiter - Advanced GitHub API rate limiting and throttling management
 * 
 * Provides intelligent rate limit detection, request queuing, and throttling
 * to ensure optimal API usage while preventing rate limit violations.
 */

import EventEmitter from 'events';

class GitHubRateLimiter extends EventEmitter {
  constructor(githubAuth, options = {}) {
    super();
    
    this.githubAuth = githubAuth;
    this.options = {
      // Rate limiting options
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 60000, // 1 minute default
      throttleThreshold: options.throttleThreshold || 100, // Remaining requests threshold
      enableThrottling: options.enableThrottling !== false,
      enableQueuing: options.enableQueuing !== false,
      
      // Queue options
      maxQueueSize: options.maxQueueSize || 50,
      queueTimeout: options.queueTimeout || 300000, // 5 minutes
      
      // Monitoring options
      enableMetrics: options.enableMetrics !== false,
      metricsInterval: options.metricsInterval || 60000, // 1 minute
      
      ...options
    };
    
    this.initialized = false;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.rateLimitInfo = null;
    this.metrics = {
      totalRequests: 0,
      throttledRequests: 0,
      queuedRequests: 0,
      rateLimitHits: 0,
      averageWaitTime: 0,
      lastUpdate: new Date()
    };
    
    this.metricsTimer = null;
  }
  
  async initialize() {
    if (!this.githubAuth.isInitialized()) {
      throw new Error('GitHub authentication not initialized');
    }
    
    // Get initial rate limit information
    await this.updateRateLimitInfo();
    
    // Start metrics collection if enabled
    if (this.options.enableMetrics) {
      this.startMetricsCollection();
    }
    
    this.initialized = true;
    this.emit('initialized', { rateLimitInfo: this.rateLimitInfo });
  }
  
  /**
   * Make a rate-limited GitHub API request
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} data - Request data
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  async makeRateLimitedRequest(endpoint, method = 'GET', data = null, options = {}) {
    if (!this.initialized) {
      throw new Error('GitHubRateLimiter not initialized');
    }
    
    this.metrics.totalRequests++;
    
    // Check if we need to throttle or queue the request
    if (this.shouldThrottleRequest()) {
      return await this.handleThrottledRequest(endpoint, method, data, options);
    }
    
    // Make the request directly
    return await this.executeRequest(endpoint, method, data, options);
  }
  
  /**
   * Check if request should be throttled based on current rate limits
   * @returns {boolean} True if request should be throttled
   */
  shouldThrottleRequest() {
    if (!this.options.enableThrottling || !this.rateLimitInfo) {
      return false;
    }
    
    const { remaining, limit, reset } = this.rateLimitInfo;
    const resetTime = new Date(reset * 1000);
    const now = new Date();
    const timeUntilReset = resetTime - now;
    
    // If we're close to the reset time and have very few requests left
    if (remaining < this.options.throttleThreshold && timeUntilReset > 0) {
      return true;
    }
    
    // If we have no requests remaining
    if (remaining <= 0) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Handle throttled requests through queuing or waiting
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} data - Request data
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  async handleThrottledRequest(endpoint, method, data, options) {
    this.metrics.throttledRequests++;
    
    if (this.options.enableQueuing && this.requestQueue.length < this.options.maxQueueSize) {
      return await this.queueRequest(endpoint, method, data, options);
    } else {
      // Wait for rate limit reset
      const waitTime = this.calculateWaitTime();
      await this.waitForRateLimit(waitTime);
      return await this.executeRequest(endpoint, method, data, options);
    }
  }
  
  /**
   * Queue a request for later execution
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} data - Request data
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  async queueRequest(endpoint, method, data, options) {
    this.metrics.queuedRequests++;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout in queue'));
      }, this.options.queueTimeout);
      
      this.requestQueue.push({
        endpoint,
        method,
        data,
        options,
        resolve,
        reject,
        timeout,
        timestamp: new Date()
      });
      
      this.emit('requestQueued', { 
        queueSize: this.requestQueue.length,
        endpoint 
      });
      
      // Start processing queue if not already processing
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }
  
  /**
   * Process queued requests
   */
  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    this.emit('queueProcessingStarted', { queueSize: this.requestQueue.length });
    
    while (this.requestQueue.length > 0) {
      // Check if we can make requests
      await this.updateRateLimitInfo();
      
      if (this.shouldThrottleRequest()) {
        const waitTime = this.calculateWaitTime();
        await this.waitForRateLimit(waitTime);
        continue;
      }
      
      // Process next request in queue
      const request = this.requestQueue.shift();
      clearTimeout(request.timeout);
      
      try {
        const response = await this.executeRequest(
          request.endpoint,
          request.method,
          request.data,
          request.options
        );
        request.resolve(response);
      } catch (error) {
        request.reject(error);
      }
      
      // Small delay between requests to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isProcessingQueue = false;
    this.emit('queueProcessingCompleted');
  }
  
  /**
   * Execute a GitHub API request
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} data - Request data
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  async executeRequest(endpoint, method, data, options) {
    const startTime = new Date();
    
    try {
      const response = await this.githubAuth.makeAuthenticatedRequest(endpoint, method, data);
      
      // Update rate limit info from response headers
      this.updateRateLimitFromHeaders(response.headers);
      
      // Update metrics
      const waitTime = new Date() - startTime;
      this.updateMetrics({ waitTime, success: true });
      
      this.emit('requestCompleted', { 
        endpoint, 
        method, 
        waitTime,
        rateLimitInfo: this.rateLimitInfo 
      });
      
      return response;
    } catch (error) {
      // Check if it's a rate limit error
      if (error.message.includes('rate limit') || error.message.includes('403')) {
        this.metrics.rateLimitHits++;
        this.emit('rateLimitHit', { endpoint, error: error.message });
        
        // If we have retries left, wait and retry
        if (options.retryCount < this.options.maxRetries) {
          const waitTime = this.calculateWaitTime();
          await this.waitForRateLimit(waitTime);
          
          return await this.executeRequest(endpoint, method, data, {
            ...options,
            retryCount: (options.retryCount || 0) + 1
          });
        }
      }
      
      this.updateMetrics({ waitTime: new Date() - startTime, success: false });
      throw error;
    }
  }
  
  /**
   * Calculate wait time based on rate limit info
   * @returns {number} Wait time in milliseconds
   */
  calculateWaitTime() {
    if (!this.rateLimitInfo) {
      return this.options.retryDelay;
    }
    
    const { reset } = this.rateLimitInfo;
    const resetTime = new Date(reset * 1000);
    const now = new Date();
    const timeUntilReset = resetTime - now;
    
    // Add small buffer to ensure we wait until after reset
    return Math.max(timeUntilReset + 1000, 1000);
  }
  
  /**
   * Wait for rate limit reset
   * @param {number} waitTime - Time to wait in milliseconds
   */
  async waitForRateLimit(waitTime) {
    this.emit('waitingForRateLimit', { waitTime });
    
    return new Promise(resolve => {
      setTimeout(resolve, waitTime);
    });
  }
  
  /**
   * Update rate limit information from GitHub API
   */
  async updateRateLimitInfo() {
    try {
      const rateLimitInfo = await this.githubAuth.getRateLimitInfo();
      this.rateLimitInfo = rateLimitInfo;
      this.emit('rateLimitUpdated', rateLimitInfo);
    } catch (error) {
      this.emit('error', new Error(`Failed to update rate limit info: ${error.message}`));
    }
  }
  
  /**
   * Update rate limit info from response headers
   * @param {Object} headers - Response headers
   */
  updateRateLimitFromHeaders(headers) {
    if (headers) {
      const remaining = parseInt(headers['x-ratelimit-remaining']);
      const limit = parseInt(headers['x-ratelimit-limit']);
      const reset = parseInt(headers['x-ratelimit-reset']);
      
      if (!isNaN(remaining) && !isNaN(limit) && !isNaN(reset)) {
        this.rateLimitInfo = { remaining, limit, reset };
        this.emit('rateLimitUpdated', this.rateLimitInfo);
      }
    }
  }
  
  /**
   * Update metrics
   * @param {Object} data - Metrics data
   */
  updateMetrics(data) {
    if (data.waitTime) {
      // Update average wait time
      const totalWaitTime = this.metrics.averageWaitTime * (this.metrics.totalRequests - 1) + data.waitTime;
      this.metrics.averageWaitTime = totalWaitTime / this.metrics.totalRequests;
    }
    
    this.metrics.lastUpdate = new Date();
  }
  
  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    this.metricsTimer = setInterval(() => {
      this.emit('metricsUpdate', this.getMetrics());
    }, this.options.metricsInterval);
  }
  
  /**
   * Stop metrics collection
   */
  stopMetricsCollection() {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
  }
  
  /**
   * Get current metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      queueSize: this.requestQueue.length,
      rateLimitInfo: this.rateLimitInfo
    };
  }
  
  /**
   * Get current rate limit information
   * @returns {Object} Rate limit information
   */
  getRateLimitInfo() {
    return this.rateLimitInfo;
  }
  
  /**
   * Clear the request queue
   */
  clearQueue() {
    // Reject all queued requests
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      if (request.reject && typeof request.reject === 'function') {
        request.reject(new Error('Queue cleared'));
      }
    }
    
    this.emit('queueCleared');
  }
  
  /**
   * Get queue status
   * @returns {Object} Queue status
   */
  getQueueStatus() {
    return {
      size: this.requestQueue.length,
      isProcessing: this.isProcessingQueue,
      maxSize: this.options.maxQueueSize
    };
  }
  
  /**
   * Check if rate limiter is initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this.initialized;
  }
  
  /**
   * Cleanup resources
   */
  async cleanup() {
    this.stopMetricsCollection();
    
    // Clear queue more gracefully for tests
    try {
      this.clearQueue();
    } catch (error) {
      // Ignore cleanup errors - this might be a test scenario
    }
    
    this.initialized = false;
    this.emit('cleanup');
  }
}

export default GitHubRateLimiter;