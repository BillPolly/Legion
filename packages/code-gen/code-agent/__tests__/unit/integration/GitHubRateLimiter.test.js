/**
 * Test GitHubRateLimiter - Rate limiting and throttling
 * Phase 2.1.3: GitHub API rate limiting and throttling
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import GitHubRateLimiter from '../../../src/integration/GitHubRateLimiter.js';
import GitHubAuthentication from '../../../src/integration/GitHubAuthentication.js';

describe('GitHubRateLimiter', () => {
  let resourceManager;
  let githubAuth;
  let rateLimiter;
  let mockResponse;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Register mock GitHub PAT
    resourceManager.register('GITHUB_PAT', 'ghp_mock_token_12345');
  });

  beforeEach(async () => {
    // Create mock GitHub authentication
    githubAuth = new GitHubAuthentication(resourceManager);
    await githubAuth.initialize();
    
    // Mock the makeAuthenticatedRequest method
    mockResponse = {
      statusCode: 200,
      data: JSON.stringify({ message: 'success' }),
      headers: {
        'x-ratelimit-remaining': '5000',
        'x-ratelimit-limit': '5000',
        'x-ratelimit-reset': Math.floor(Date.now() / 1000) + 3600
      }
    };
    
    githubAuth.makeAuthenticatedRequest = jest.fn().mockResolvedValue(mockResponse);
    githubAuth.getRateLimitInfo = jest.fn().mockResolvedValue({
      remaining: 5000,
      limit: 5000,
      reset: Math.floor(Date.now() / 1000) + 3600
    });
  });

  afterEach(async () => {
    if (rateLimiter && rateLimiter.cleanup && typeof rateLimiter.cleanup === 'function') {
      try {
        await rateLimiter.cleanup();
      } catch (error) {
        // Ignore cleanup errors during tests
      }
      rateLimiter = null;
    }
  });

  test('should initialize GitHubRateLimiter with default options', async () => {
    rateLimiter = new GitHubRateLimiter(githubAuth);
    
    expect(rateLimiter.initialized).toBe(false);
    expect(rateLimiter.options.maxRetries).toBe(3);
    expect(rateLimiter.options.throttleThreshold).toBe(100);
    expect(rateLimiter.options.enableThrottling).toBe(true);
    expect(rateLimiter.options.enableQueuing).toBe(true);
    
    await rateLimiter.initialize();
    
    expect(rateLimiter.initialized).toBe(true);
    expect(rateLimiter.rateLimitInfo).toBeDefined();
    expect(rateLimiter.rateLimitInfo.remaining).toBe(5000);
    
    console.log('✅ GitHubRateLimiter initialized with default options');
  });

  test('should initialize with custom options', async () => {
    const customOptions = {
      maxRetries: 5,
      retryDelay: 120000,
      throttleThreshold: 200,
      enableThrottling: false,
      maxQueueSize: 100
    };
    
    rateLimiter = new GitHubRateLimiter(githubAuth, customOptions);
    
    expect(rateLimiter.options.maxRetries).toBe(5);
    expect(rateLimiter.options.retryDelay).toBe(120000);
    expect(rateLimiter.options.throttleThreshold).toBe(200);
    expect(rateLimiter.options.enableThrottling).toBe(false);
    expect(rateLimiter.options.maxQueueSize).toBe(100);
    
    console.log('✅ Custom options applied correctly');
  });

  test('should make rate-limited requests when rate limits are healthy', async () => {
    rateLimiter = new GitHubRateLimiter(githubAuth);
    await rateLimiter.initialize();
    
    const response = await rateLimiter.makeRateLimitedRequest('/user');
    
    expect(response).toBeDefined();
    expect(response.statusCode).toBe(200);
    expect(githubAuth.makeAuthenticatedRequest).toHaveBeenCalledWith('/user', 'GET', null);
    expect(rateLimiter.metrics.totalRequests).toBe(1);
    expect(rateLimiter.metrics.throttledRequests).toBe(0);
    
    console.log('✅ Rate-limited request completed successfully');
  });

  test('should detect when throttling is needed', async () => {
    rateLimiter = new GitHubRateLimiter(githubAuth, { throttleThreshold: 100 });
    await rateLimiter.initialize();
    
    // Simulate low rate limit
    rateLimiter.rateLimitInfo = {
      remaining: 50,
      limit: 5000,
      reset: Math.floor(Date.now() / 1000) + 3600
    };
    
    const shouldThrottle = rateLimiter.shouldThrottleRequest();
    expect(shouldThrottle).toBe(true);
    
    // Simulate high rate limit
    rateLimiter.rateLimitInfo = {
      remaining: 4500,
      limit: 5000,
      reset: Math.floor(Date.now() / 1000) + 3600
    };
    
    const shouldNotThrottle = rateLimiter.shouldThrottleRequest();
    expect(shouldNotThrottle).toBe(false);
    
    console.log('✅ Throttling detection working correctly');
  });

  test('should detect when rate limit is exceeded', async () => {
    rateLimiter = new GitHubRateLimiter(githubAuth);
    await rateLimiter.initialize();
    
    // Simulate rate limit exceeded
    rateLimiter.rateLimitInfo = {
      remaining: 0,
      limit: 5000,
      reset: Math.floor(Date.now() / 1000) + 3600
    };
    
    const shouldThrottle = rateLimiter.shouldThrottleRequest();
    expect(shouldThrottle).toBe(true);
    
    console.log('✅ Rate limit exceeded detection working');
  });

  test('should calculate appropriate wait times', async () => {
    rateLimiter = new GitHubRateLimiter(githubAuth);
    await rateLimiter.initialize();
    
    // Test with rate limit info
    const futureReset = Math.floor(Date.now() / 1000) + 1800; // 30 minutes from now
    rateLimiter.rateLimitInfo = {
      remaining: 0,
      limit: 5000,
      reset: futureReset
    };
    
    const waitTime = rateLimiter.calculateWaitTime();
    expect(waitTime).toBeGreaterThan(1000); // Should be at least 1 second
    expect(waitTime).toBeLessThan(1800000 + 2000); // Should be less than 30 minutes + buffer
    
    // Test without rate limit info
    rateLimiter.rateLimitInfo = null;
    const defaultWaitTime = rateLimiter.calculateWaitTime();
    expect(defaultWaitTime).toBe(60000); // Should use default retry delay
    
    console.log('✅ Wait time calculation working correctly');
  });

  test('should update rate limit info from response headers', async () => {
    rateLimiter = new GitHubRateLimiter(githubAuth);
    await rateLimiter.initialize();
    
    const headers = {
      'x-ratelimit-remaining': '4800',
      'x-ratelimit-limit': '5000',
      'x-ratelimit-reset': Math.floor(Date.now() / 1000) + 1800
    };
    
    rateLimiter.updateRateLimitFromHeaders(headers);
    
    expect(rateLimiter.rateLimitInfo.remaining).toBe(4800);
    expect(rateLimiter.rateLimitInfo.limit).toBe(5000);
    expect(rateLimiter.rateLimitInfo.reset).toBe(parseInt(headers['x-ratelimit-reset']));
    
    console.log('✅ Rate limit header parsing working');
  });

  test('should handle request queuing when throttling is enabled', async () => {
    const testRateLimiter = new GitHubRateLimiter(githubAuth, { 
      enableQueuing: true,
      maxQueueSize: 5
    });
    await testRateLimiter.initialize();
    
    // Force throttling condition
    testRateLimiter.rateLimitInfo = {
      remaining: 10,
      limit: 5000,
      reset: Math.floor(Date.now() / 1000) + 300
    };
    
    // Mock the queue processing to avoid actual delays
    testRateLimiter.processQueue = jest.fn().mockResolvedValue();
    
    const requestPromise = testRateLimiter.makeRateLimitedRequest('/user');
    
    expect(testRateLimiter.requestQueue.length).toBe(1);
    expect(testRateLimiter.metrics.queuedRequests).toBe(1);
    expect(testRateLimiter.processQueue).toHaveBeenCalled();
    
    // Clean up the test rate limiter
    await testRateLimiter.cleanup();
    
    console.log('✅ Request queuing working correctly');
  });

  test('should process queued requests', async () => {
    // Create a separate rate limiter for this test to avoid cleanup issues
    const testRateLimiter = new GitHubRateLimiter(githubAuth);
    await testRateLimiter.initialize();
    
    // Create mock resolve/reject functions
    const mockResolve1 = jest.fn();
    const mockReject1 = jest.fn();
    const mockResolve2 = jest.fn();
    const mockReject2 = jest.fn();
    
    // Add mock requests to queue
    const mockRequests = [
      { 
        endpoint: '/user', 
        method: 'GET', 
        data: null, 
        options: {}, 
        resolve: mockResolve1, 
        reject: mockReject1, 
        timeout: setTimeout(() => {}, 1000),
        timestamp: new Date()
      },
      { 
        endpoint: '/repos', 
        method: 'GET', 
        data: null, 
        options: {}, 
        resolve: mockResolve2, 
        reject: mockReject2, 
        timeout: setTimeout(() => {}, 1000),
        timestamp: new Date()
      }
    ];
    
    testRateLimiter.requestQueue = [...mockRequests];
    
    // Mock executeRequest to resolve immediately
    testRateLimiter.executeRequest = jest.fn().mockResolvedValue(mockResponse);
    
    await testRateLimiter.processQueue();
    
    expect(testRateLimiter.requestQueue.length).toBe(0);
    expect(testRateLimiter.executeRequest).toHaveBeenCalledTimes(2);
    expect(mockResolve1).toHaveBeenCalledWith(mockResponse);
    expect(mockResolve2).toHaveBeenCalledWith(mockResponse);
    
    // Clean up the test rate limiter
    await testRateLimiter.cleanup();
    
    console.log('✅ Queue processing working correctly');
  });

  test('should handle rate limit errors with retries', async () => {
    rateLimiter = new GitHubRateLimiter(githubAuth, { maxRetries: 2 });
    await rateLimiter.initialize();
    
    // Reset the mock to ensure clean state
    githubAuth.makeAuthenticatedRequest.mockReset();
    
    // Mock rate limit error on first call, success on retry
    githubAuth.makeAuthenticatedRequest
      .mockRejectedValueOnce(new Error('API rate limit exceeded'))
      .mockResolvedValueOnce(mockResponse);
    
    // Mock wait function to avoid actual delays
    rateLimiter.waitForRateLimit = jest.fn().mockResolvedValue();
    
    const response = await rateLimiter.executeRequest('/user', 'GET', null, { retryCount: 0 });
    
    expect(response).toBeDefined();
    expect(rateLimiter.metrics.rateLimitHits).toBe(1);
    expect(rateLimiter.waitForRateLimit).toHaveBeenCalled();
    expect(githubAuth.makeAuthenticatedRequest).toHaveBeenCalledTimes(2);
    
    console.log('✅ Rate limit error retry handling working');
  });

  test('should fail after max retries', async () => {
    rateLimiter = new GitHubRateLimiter(githubAuth, { maxRetries: 1 });
    await rateLimiter.initialize();
    
    // Reset the mock to ensure clean state
    githubAuth.makeAuthenticatedRequest.mockReset();
    
    // Mock rate limit error on all calls
    githubAuth.makeAuthenticatedRequest.mockRejectedValue(new Error('API rate limit exceeded'));
    rateLimiter.waitForRateLimit = jest.fn().mockResolvedValue();
    
    await expect(rateLimiter.executeRequest('/user', 'GET', null, { retryCount: 0 }))
      .rejects.toThrow('API rate limit exceeded');
    
    expect(rateLimiter.metrics.rateLimitHits).toBe(2); // Initial call + 1 retry
    
    console.log('✅ Max retry handling working correctly');
  });

  test('should track metrics correctly', async () => {
    rateLimiter = new GitHubRateLimiter(githubAuth);
    await rateLimiter.initialize();
    
    const initialMetrics = rateLimiter.getMetrics();
    expect(initialMetrics.totalRequests).toBe(0);
    expect(initialMetrics.throttledRequests).toBe(0);
    expect(initialMetrics.queuedRequests).toBe(0);
    expect(initialMetrics.rateLimitHits).toBe(0);
    
    // Make some requests to update metrics
    await rateLimiter.makeRateLimitedRequest('/user');
    await rateLimiter.makeRateLimitedRequest('/repos');
    
    const updatedMetrics = rateLimiter.getMetrics();
    expect(updatedMetrics.totalRequests).toBe(2);
    expect(updatedMetrics.lastUpdate).toBeInstanceOf(Date);
    
    console.log('✅ Metrics tracking working correctly');
  });

  test('should clear queue when requested', async () => {
    rateLimiter = new GitHubRateLimiter(githubAuth);
    await rateLimiter.initialize();
    
    // Add mock requests to queue
    const mockReject = jest.fn();
    rateLimiter.requestQueue = [
      { reject: mockReject, timeout: setTimeout(() => {}, 1000) },
      { reject: mockReject, timeout: setTimeout(() => {}, 1000) }
    ];
    
    rateLimiter.clearQueue();
    
    expect(rateLimiter.requestQueue.length).toBe(0);
    expect(mockReject).toHaveBeenCalledTimes(2);
    expect(mockReject).toHaveBeenCalledWith(new Error('Queue cleared'));
    
    console.log('✅ Queue clearing working correctly');
  });

  test('should provide queue status information', async () => {
    rateLimiter = new GitHubRateLimiter(githubAuth, { maxQueueSize: 10 });
    await rateLimiter.initialize();
    
    const initialStatus = rateLimiter.getQueueStatus();
    expect(initialStatus.size).toBe(0);
    expect(initialStatus.isProcessing).toBe(false);
    expect(initialStatus.maxSize).toBe(10);
    
    // Add items to queue manually (prevent cleanup from clearing them)
    const originalCleanup = rateLimiter.cleanup;
    rateLimiter.cleanup = jest.fn();
    
    rateLimiter.requestQueue = [
      { timeout: setTimeout(() => {}, 1000), reject: jest.fn() }, 
      { timeout: setTimeout(() => {}, 1000), reject: jest.fn() }
    ];
    
    const updatedStatus = rateLimiter.getQueueStatus();
    expect(updatedStatus.size).toBe(2);
    
    // Restore original cleanup
    rateLimiter.cleanup = originalCleanup;
    
    console.log('✅ Queue status information working correctly');
  });

  test('should emit events during operation', async () => {
    rateLimiter = new GitHubRateLimiter(githubAuth);
    
    const events = [];
    rateLimiter.on('initialized', (data) => events.push(['initialized', data]));
    rateLimiter.on('requestCompleted', (data) => events.push(['requestCompleted', data]));
    rateLimiter.on('rateLimitUpdated', (data) => events.push(['rateLimitUpdated', data]));
    
    await rateLimiter.initialize();
    await rateLimiter.makeRateLimitedRequest('/user');
    
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(([type]) => type === 'initialized')).toBe(true);
    expect(events.some(([type]) => type === 'requestCompleted')).toBe(true);
    
    console.log('✅ Event emission working correctly');
  });

  test('should handle cleanup properly', async () => {
    rateLimiter = new GitHubRateLimiter(githubAuth, { enableMetrics: true });
    await rateLimiter.initialize();
    
    expect(rateLimiter.initialized).toBe(true);
    
    await rateLimiter.cleanup();
    
    expect(rateLimiter.initialized).toBe(false);
    expect(rateLimiter.requestQueue.length).toBe(0);
    expect(rateLimiter.metricsTimer).toBe(null);
    
    console.log('✅ Cleanup working correctly');
  });
});