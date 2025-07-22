/**
 * JesterIntegration - Integration layer for Jester (Jest Agent Wrapper)
 * 
 * Provides enhanced test reporting and analytics through Jester integration.
 * Captures detailed test execution data, assertions, and provides AI-friendly
 * test insights for better TDD support.
 */

import { JestAgentWrapper, JestAgentReporter, AgentTDDHelper } from '@legion/jester';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

/**
 * JesterIntegration class for managing Jester functionality
 */
class JesterIntegration extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enabled: true,
      dbPath: './.jester/test-results.db',
      collectConsole: true,
      collectCoverage: true,
      collectPerformance: true,
      realTimeEvents: true,
      cleanupAfterDays: 7,
      ...config
    };
    
    this.jestWrapper = null;
    this.tddHelper = null;
    this.currentSession = null;
    this.isInitialized = false;
  }

  /**
   * Initialize Jester integration
   */
  async initialize() {
    if (!this.config.enabled) {
      this.emit('disabled', { message: 'Jester integration is disabled' });
      return;
    }
    
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.config.dbPath);
      await fs.mkdir(dbDir, { recursive: true });
      
      // Initialize JestAgentWrapper
      this.jestWrapper = new JestAgentWrapper({
        storage: 'sqlite',
        dbPath: this.config.dbPath,
        collectConsole: this.config.collectConsole,
        collectCoverage: this.config.collectCoverage,
        collectPerformance: this.config.collectPerformance,
        realTimeEvents: this.config.realTimeEvents
      });
      
      // Initialize TDD Helper
      this.tddHelper = new AgentTDDHelper(this.jestWrapper);
      
      // Setup event forwarding if real-time events are enabled
      if (this.config.realTimeEvents) {
        this.setupEventForwarding();
      }
      
      // Cleanup old data
      await this.cleanupOldData();
      
      this.isInitialized = true;
      this.emit('initialized', { timestamp: Date.now() });
      
    } catch (error) {
      this.emit('initialization-error', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup event forwarding from Jester to integration layer
   */
  setupEventForwarding() {
    // Forward all Jester events
    const events = [
      'sessionStart', 'sessionEnd',
      'suiteStart', 'suiteEnd',
      'testStart', 'testEnd',
      'log', 'assertion'
    ];
    
    events.forEach(eventName => {
      this.jestWrapper.on(eventName, (data) => {
        this.emit(`jester:${eventName}`, data);
      });
    });
  }

  /**
   * Get Jest reporter configuration
   */
  getReporterConfig() {
    if (!this.config.enabled) {
      return null;
    }
    
    return [
      'default',
      [path.join(import.meta.url.replace('file://', ''), '../reporter/JesterReporter.js'), {
        dbPath: this.config.dbPath,
        collectConsole: this.config.collectConsole,
        collectCoverage: this.config.collectCoverage,
        realTimeEvents: this.config.realTimeEvents
      }]
    ];
  }

  /**
   * Start a new test session
   */
  async startSession(jestConfig = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    this.currentSession = await this.jestWrapper.startSession(jestConfig);
    return this.currentSession;
  }

  /**
   * End the current test session
   */
  async endSession() {
    if (this.currentSession) {
      await this.jestWrapper.stopSession();
      this.currentSession = null;
    }
  }

  /**
   * Analyze test results using Jester
   */
  async analyzeTestResults(sessionId = null) {
    const targetSessionId = sessionId || this.currentSession?.id;
    
    if (!targetSessionId) {
      throw new Error('No session ID provided or active');
    }
    
    const analysis = {
      summary: await this.jestWrapper.getTestSummary(targetSessionId),
      failedTests: await this.jestWrapper.getFailedTests(targetSessionId),
      slowTests: await this.jestWrapper.getSlowestTests(10),
      commonErrors: await this.jestWrapper.getMostCommonErrors(5),
      errorsByType: {},
      tddSuggestions: null
    };
    
    // Get errors by type
    const errorTypes = ['assertion', 'timeout', 'syntax', 'import', 'runtime'];
    for (const errorType of errorTypes) {
      analysis.errorsByType[errorType] = await this.jestWrapper.getErrorsByType(errorType);
    }
    
    // Get TDD suggestions if there are failures
    if (analysis.failedTests.length > 0) {
      analysis.tddSuggestions = await this.tddHelper.analyzeTDDProgress({
        sessionId: targetSessionId,
        includeRecommendations: true
      });
    }
    
    return analysis;
  }

  /**
   * Get test history for a specific test
   */
  async getTestHistory(testName) {
    return this.jestWrapper.getTestHistory(testName);
  }

  /**
   * Search logs for specific patterns
   */
  async searchLogs(query) {
    return this.jestWrapper.searchLogs(query);
  }

  /**
   * Get detailed test case information
   */
  async getTestCase(testId) {
    const queryEngine = this.jestWrapper.query;
    return queryEngine.getTestCase(testId);
  }

  /**
   * Find tests by criteria
   */
  async findTests(criteria) {
    const queryEngine = this.jestWrapper.query;
    return queryEngine.findTests(criteria);
  }

  /**
   * Generate test improvement suggestions
   */
  async generateTestSuggestions(sessionId) {
    const analysis = await this.analyzeTestResults(sessionId);
    const suggestions = [];
    
    // Analyze failed tests
    if (analysis.failedTests.length > 0) {
      suggestions.push({
        type: 'failures',
        priority: 'high',
        message: `${analysis.failedTests.length} tests are failing`,
        details: analysis.failedTests.map(test => ({
          name: test.name,
          error: test.error_message,
          suggestion: test.error_suggestion
        }))
      });
    }
    
    // Analyze slow tests
    if (analysis.slowTests.length > 0) {
      const slowThreshold = 1000; // 1 second
      const verySlow = analysis.slowTests.filter(test => test.duration > slowThreshold);
      
      if (verySlow.length > 0) {
        suggestions.push({
          type: 'performance',
          priority: 'medium',
          message: `${verySlow.length} tests are running slowly (>1s)`,
          details: verySlow.map(test => ({
            name: test.name,
            duration: test.duration,
            suggestion: 'Consider optimizing test setup/teardown or mocking expensive operations'
          }))
        });
      }
    }
    
    // Analyze common errors
    if (analysis.commonErrors.length > 0) {
      suggestions.push({
        type: 'patterns',
        priority: 'medium',
        message: 'Common error patterns detected',
        details: analysis.commonErrors.map(error => ({
          type: error.error_type,
          count: error.count,
          suggestion: this.getErrorTypeSuggestion(error.error_type)
        }))
      });
    }
    
    // Add TDD suggestions
    if (analysis.tddSuggestions) {
      suggestions.push({
        type: 'tdd',
        priority: 'high',
        message: 'TDD improvement suggestions',
        details: analysis.tddSuggestions
      });
    }
    
    return suggestions;
  }

  /**
   * Get error type specific suggestions
   */
  getErrorTypeSuggestion(errorType) {
    const suggestions = {
      'assertion': 'Review expected vs actual values. Ensure test data matches implementation.',
      'timeout': 'Increase timeout or optimize async operations. Check for infinite loops.',
      'syntax': 'Fix syntax errors. Run linter to identify issues.',
      'import': 'Verify module paths and dependencies. Check for circular imports.',
      'runtime': 'Add error handling. Validate inputs and edge cases.'
    };
    
    return suggestions[errorType] || 'Review test implementation for issues.';
  }

  /**
   * Generate comprehensive test report
   */
  async generateTestReport(sessionId) {
    const session = await this.jestWrapper.getSession(sessionId);
    const analysis = await this.analyzeTestResults(sessionId);
    const suggestions = await this.generateTestSuggestions(sessionId);
    
    return {
      session: {
        id: session.id,
        startTime: session.start_time,
        endTime: session.end_time,
        duration: session.end_time ? 
          new Date(session.end_time) - new Date(session.start_time) : null,
        config: session.config
      },
      results: analysis.summary,
      analysis: {
        failedTests: analysis.failedTests,
        slowTests: analysis.slowTests,
        commonErrors: analysis.commonErrors,
        errorsByType: analysis.errorsByType
      },
      suggestions,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Cleanup old test data
   */
  async cleanupOldData() {
    if (this.config.cleanupAfterDays <= 0) {
      return;
    }
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.cleanupAfterDays);
      
      // This would require adding a cleanup method to Jester
      // For now, we'll just emit an event
      this.emit('cleanup-needed', { 
        cutoffDate: cutoffDate.toISOString(),
        message: 'Manual cleanup of old test data may be needed'
      });
      
    } catch (error) {
      this.emit('cleanup-error', { error: error.message });
    }
  }

  /**
   * Check if Jester is enabled
   */
  isEnabled() {
    return this.config.enabled && this.isInitialized;
  }

  /**
   * Get Jester configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update Jester configuration
   */
  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
    
    // Reinitialize if needed
    if (this.isInitialized && updates.enabled === false) {
      this.cleanup();
    } else if (!this.isInitialized && updates.enabled === true) {
      this.initialize();
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.currentSession) {
      await this.endSession();
    }
    
    // Remove event listeners
    if (this.jestWrapper) {
      this.jestWrapper.removeAllListeners();
    }
    
    this.jestWrapper = null;
    this.tddHelper = null;
    this.isInitialized = false;
    
    this.emit('cleanup-complete', { timestamp: Date.now() });
  }
}

export { JesterIntegration };