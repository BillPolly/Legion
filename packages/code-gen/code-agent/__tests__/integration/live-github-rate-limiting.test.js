/**
 * Test Live GitHub Rate Limiting
 * Phase 2.1.3: Real GitHub API rate limiting and throttling tests
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import GitHubRateLimiter from '../../src/integration/GitHubRateLimiter.js';
import GitHubAuthentication from '../../src/integration/GitHubAuthentication.js';

describe('Live GitHub Rate Limiting', () => {
  let resourceManager;
  let githubAuth;
  let rateLimiter;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Register GitHub environment variables
    if (resourceManager.has('env.GITHUB_PAT')) {
      resourceManager.register('GITHUB_PAT', resourceManager.get('env.GITHUB_PAT'));
    }
    
    // Initialize GitHub authentication
    githubAuth = new GitHubAuthentication(resourceManager);
    await githubAuth.initialize();
    
    console.log('🚦 Starting live GitHub rate limiting tests');
  });

  afterAll(async () => {
    if (rateLimiter) {
      await rateLimiter.cleanup();
    }
    console.log('🏁 Rate limiting tests completed');
  });

  test('should initialize rate limiter and get current rate limits', async () => {
    rateLimiter = new GitHubRateLimiter(githubAuth, {
      enableMetrics: true,
      throttleThreshold: 1000
    });
    
    await rateLimiter.initialize();
    
    expect(rateLimiter.isInitialized()).toBe(true);
    
    const rateLimitInfo = rateLimiter.getRateLimitInfo();
    expect(rateLimitInfo).toBeDefined();
    expect(rateLimitInfo.remaining).toBeGreaterThanOrEqual(0);
    expect(rateLimitInfo.limit).toBeGreaterThan(0);
    expect(rateLimitInfo.reset).toBeGreaterThan(0);
    
    console.log(`✅ Rate limit info: ${rateLimitInfo.remaining}/${rateLimitInfo.limit} remaining`);
    console.log(`⏰ Reset time: ${new Date(rateLimitInfo.reset * 1000).toISOString()}`);
  }, 10000);

  test('should make rate-limited requests and track metrics', async () => {
    if (!rateLimiter) {
      rateLimiter = new GitHubRateLimiter(githubAuth, { enableMetrics: true });
      await rateLimiter.initialize();
    }
    
    const initialMetrics = rateLimiter.getMetrics();
    const initialRequests = initialMetrics.totalRequests;
    
    // Make several API requests
    const requests = [
      rateLimiter.makeRateLimitedRequest('/user'),
      rateLimiter.makeRateLimitedRequest('/user/repos?per_page=1'),
      rateLimiter.makeRateLimitedRequest('/orgs/AgentResults')
    ];
    
    const responses = await Promise.all(requests);
    
    // Verify all requests succeeded
    for (const response of responses) {
      expect(response.statusCode).toBe(200);
      expect(response.data).toBeDefined();
    }
    
    const finalMetrics = rateLimiter.getMetrics();
    expect(finalMetrics.totalRequests).toBe(initialRequests + 3);
    expect(finalMetrics.lastUpdate).toBeInstanceOf(Date);
    
    console.log(`✅ Made ${responses.length} rate-limited requests successfully`);
    console.log(`📊 Metrics: ${finalMetrics.totalRequests} total, ${finalMetrics.throttledRequests} throttled`);
  }, 15000);

  test('should detect rate limit changes during requests', async () => {
    if (!rateLimiter) {
      rateLimiter = new GitHubRateLimiter(githubAuth);
      await rateLimiter.initialize();
    }
    
    const initialRateLimit = rateLimiter.getRateLimitInfo();
    
    // Make a request to consume rate limit
    const response = await rateLimiter.makeRateLimitedRequest('/user/emails');
    expect(response.statusCode).toBe(200);
    
    const updatedRateLimit = rateLimiter.getRateLimitInfo();
    
    // Rate limit remaining should have decreased
    expect(updatedRateLimit.remaining).toBeLessThanOrEqual(initialRateLimit.remaining);
    expect(updatedRateLimit.limit).toBe(initialRateLimit.limit);
    
    console.log(`✅ Rate limit updated: ${initialRateLimit.remaining} -> ${updatedRateLimit.remaining}`);
  }, 10000);

  test('should handle rate limit monitoring and events', async () => {
    if (!rateLimiter) {
      rateLimiter = new GitHubRateLimiter(githubAuth);
      await rateLimiter.initialize();
    }
    
    const events = [];
    rateLimiter.on('requestCompleted', (data) => events.push(['requestCompleted', data]));
    rateLimiter.on('rateLimitUpdated', (data) => events.push(['rateLimitUpdated', data]));
    
    // Make a request to trigger events
    await rateLimiter.makeRateLimitedRequest('/user/following?per_page=1');
    
    expect(events.length).toBeGreaterThan(0);
    
    const requestCompletedEvents = events.filter(([type]) => type === 'requestCompleted');
    const rateLimitUpdatedEvents = events.filter(([type]) => type === 'rateLimitUpdated');
    
    expect(requestCompletedEvents.length).toBeGreaterThanOrEqual(1);
    expect(rateLimitUpdatedEvents.length).toBeGreaterThanOrEqual(1);
    
    console.log(`✅ Captured ${events.length} rate limiting events`);
  }, 10000);

  test('should handle multiple concurrent requests efficiently', async () => {
    if (!rateLimiter) {
      rateLimiter = new GitHubRateLimiter(githubAuth);
      await rateLimiter.initialize();
    }
    
    const startTime = Date.now();
    
    // Make multiple concurrent requests
    const concurrentRequests = Array.from({ length: 5 }, (_, i) => 
      rateLimiter.makeRateLimitedRequest(`/user/repos?per_page=1&page=${i + 1}`)
    );
    
    const responses = await Promise.all(concurrentRequests);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // All requests should succeed
    for (const response of responses) {
      expect(response.statusCode).toBe(200);
    }
    
    const metrics = rateLimiter.getMetrics();
    
    console.log(`✅ Completed ${responses.length} concurrent requests in ${duration}ms`);
    console.log(`📊 Average wait time: ${metrics.averageWaitTime.toFixed(2)}ms`);
    
    expect(responses.length).toBe(5);
    expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
  }, 35000);

  test('should provide accurate queue status', async () => {
    // Create a new rate limiter with specific queue configuration
    const queueRateLimiter = new GitHubRateLimiter(githubAuth, { 
      enableQueuing: true,
      maxQueueSize: 10
    });
    await queueRateLimiter.initialize();
    
    const queueStatus = queueRateLimiter.getQueueStatus();
    
    expect(queueStatus).toBeDefined();
    expect(typeof queueStatus.size).toBe('number');
    expect(typeof queueStatus.isProcessing).toBe('boolean');
    expect(typeof queueStatus.maxSize).toBe('number');
    expect(queueStatus.maxSize).toBe(10);
    
    await queueRateLimiter.cleanup();
    
    console.log(`✅ Queue status: ${queueStatus.size}/${queueStatus.maxSize}, processing: ${queueStatus.isProcessing}`);
  });

  test('should handle error scenarios gracefully', async () => {
    if (!rateLimiter) {
      rateLimiter = new GitHubRateLimiter(githubAuth);
      await rateLimiter.initialize();
    }
    
    // Test invalid endpoint (GitHub returns 404 as a valid HTTP response)
    const response = await rateLimiter.makeRateLimitedRequest('/invalid/endpoint/that/does/not/exist');
    
    // Should get a 404 response, not throw an error
    expect(response.statusCode).toBe(404);
    expect(response.data).toContain('Not Found');
    
    // Metrics should still be tracked for failed requests
    const metrics = rateLimiter.getMetrics();
    expect(metrics.totalRequests).toBeGreaterThan(0);
    
    console.log('✅ Error handling working correctly');
  }, 10000);

  test('should provide comprehensive metrics', async () => {
    if (!rateLimiter) {
      rateLimiter = new GitHubRateLimiter(githubAuth, { enableMetrics: true });
      await rateLimiter.initialize();
    }
    
    const metrics = rateLimiter.getMetrics();
    
    expect(metrics).toBeDefined();
    expect(typeof metrics.totalRequests).toBe('number');
    expect(typeof metrics.throttledRequests).toBe('number');
    expect(typeof metrics.queuedRequests).toBe('number');
    expect(typeof metrics.rateLimitHits).toBe('number');
    expect(typeof metrics.averageWaitTime).toBe('number');
    expect(metrics.lastUpdate).toBeInstanceOf(Date);
    expect(typeof metrics.queueSize).toBe('number');
    expect(metrics.rateLimitInfo).toBeDefined();
    
    console.log('✅ Comprehensive metrics available:');
    console.log(`   Total requests: ${metrics.totalRequests}`);
    console.log(`   Throttled requests: ${metrics.throttledRequests}`);
    console.log(`   Queued requests: ${metrics.queuedRequests}`);
    console.log(`   Rate limit hits: ${metrics.rateLimitHits}`);
    console.log(`   Average wait time: ${metrics.averageWaitTime.toFixed(2)}ms`);
    console.log(`   Current queue size: ${metrics.queueSize}`);
  });

  test('should handle configuration changes correctly', async () => {
    // Test with different configuration
    const customRateLimiter = new GitHubRateLimiter(githubAuth, {
      maxRetries: 5,
      throttleThreshold: 2000,
      enableThrottling: true,
      enableQueuing: true,
      maxQueueSize: 20
    });
    
    await customRateLimiter.initialize();
    
    expect(customRateLimiter.options.maxRetries).toBe(5);
    expect(customRateLimiter.options.throttleThreshold).toBe(2000);
    expect(customRateLimiter.options.maxQueueSize).toBe(20);
    
    // Test a request with custom configuration
    const response = await customRateLimiter.makeRateLimitedRequest('/user/starred?per_page=1');
    expect(response.statusCode).toBe(200);
    
    await customRateLimiter.cleanup();
    
    console.log('✅ Custom configuration handling working correctly');
  }, 10000);
});