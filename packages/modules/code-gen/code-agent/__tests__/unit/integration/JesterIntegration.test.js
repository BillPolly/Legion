/**
 * Unit tests for JesterIntegration
 * 
 * Tests the integration layer for Jester (Jest Agent Wrapper)
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JesterIntegration } from '../../../src/integration/JesterIntegration.js';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

// Mock the jester imports
jest.mock('@legion/jester', () => ({
  JestAgentWrapper: jest.fn().mockImplementation(function(config) {
    this.config = config;
    this.on = jest.fn();
    this.removeAllListeners = jest.fn();
    this.startSession = jest.fn().mockResolvedValue({ id: 'test-session-123' });
    this.stopSession = jest.fn().mockResolvedValue();
    this.getTestSummary = jest.fn().mockResolvedValue({
      total: 10,
      passed: 8,
      failed: 2,
      skipped: 0
    });
    this.getFailedTests = jest.fn().mockResolvedValue([
      {
        id: 'test-1',
        name: 'should do something',
        error_message: 'Expected true to be false',
        error_suggestion: 'Check assertion logic'
      }
    ]);
    this.getSlowestTests = jest.fn().mockResolvedValue([
      { name: 'slow test', duration: 2000 }
    ]);
    this.getMostCommonErrors = jest.fn().mockResolvedValue([
      { error_type: 'assertion', count: 5 }
    ]);
    this.getErrorsByType = jest.fn().mockResolvedValue([]);
    this.getTestHistory = jest.fn().mockResolvedValue([]);
    this.searchLogs = jest.fn().mockResolvedValue([]);
    this.getSession = jest.fn().mockResolvedValue({
      id: 'test-session-123',
      start_time: '2024-01-01T00:00:00Z',
      end_time: '2024-01-01T00:01:00Z',
      config: {}
    });
    this.query = {
      getTestCase: jest.fn().mockResolvedValue({}),
      findTests: jest.fn().mockResolvedValue([])
    };
  }),
  JestAgentReporter: jest.fn(),
  AgentTDDHelper: jest.fn().mockImplementation(function(wrapper) {
    this.wrapper = wrapper;
    this.analyzeTDDProgress = jest.fn().mockResolvedValue({
      suggestions: ['Write more tests', 'Improve test coverage']
    });
  })
}));

// Mock fs
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue()
}));

describe('JesterIntegration', () => {
  let integration;
  let mockJestAgentWrapper;
  let mockAgentTDDHelper;

  beforeEach(() => {
    jest.clearAllMocks();
    integration = new JesterIntegration();
  });

  afterEach(async () => {
    if (integration) {
      await integration.cleanup();
    }
  });

  describe('Constructor', () => {
    test('should create JesterIntegration with default configuration', () => {
      expect(integration).toBeDefined();
      expect(integration).toBeInstanceOf(EventEmitter);
      expect(integration.config.enabled).toBe(true);
      expect(integration.config.dbPath).toBe('./test-results.db');
      expect(integration.config.collectConsole).toBe(true);
      expect(integration.config.collectCoverage).toBe(true);
      expect(integration.config.collectPerformance).toBe(true);
      expect(integration.config.realTimeEvents).toBe(true);
      expect(integration.config.cleanupAfterDays).toBe(7);
    });

    test('should create with custom configuration', () => {
      const customConfig = {
        enabled: false,
        dbPath: '/custom/path/test.db',
        collectConsole: false,
        cleanupAfterDays: 30
      };

      const customIntegration = new JesterIntegration(customConfig);
      
      expect(customIntegration.config.enabled).toBe(false);
      expect(customIntegration.config.dbPath).toBe('/custom/path/test.db');
      expect(customIntegration.config.collectConsole).toBe(false);
      expect(customIntegration.config.cleanupAfterDays).toBe(30);
    });
  });

  describe('Initialization', () => {
    test('should initialize successfully when enabled', async () => {
      const initHandler = jest.fn();
      integration.on('initialized', initHandler);
      
      await integration.initialize();
      
      expect(integration.isInitialized).toBe(true);
      expect(integration.jestWrapper).toBeDefined();
      expect(integration.tddHelper).toBeDefined();
      expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      expect(initHandler).toHaveBeenCalledWith({ timestamp: expect.any(Number) });
    });

    test('should not initialize when disabled', async () => {
      const disabledIntegration = new JesterIntegration({ enabled: false });
      const disabledHandler = jest.fn();
      disabledIntegration.on('disabled', disabledHandler);
      
      await disabledIntegration.initialize();
      
      expect(disabledIntegration.isInitialized).toBe(false);
      expect(disabledIntegration.jestWrapper).toBeNull();
      expect(disabledHandler).toHaveBeenCalledWith({
        message: 'Jester integration is disabled'
      });
    });

    test('should handle initialization errors', async () => {
      fs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));
      const errorHandler = jest.fn();
      integration.on('initialization-error', errorHandler);
      
      await expect(integration.initialize()).rejects.toThrow('Permission denied');
      expect(errorHandler).toHaveBeenCalledWith({ error: 'Permission denied' });
    });

    test('should not reinitialize if already initialized', async () => {
      await integration.initialize();
      const firstWrapper = integration.jestWrapper;
      
      await integration.initialize();
      
      expect(integration.jestWrapper).toBe(firstWrapper);
    });
  });

  describe('Event Forwarding', () => {
    test('should setup event forwarding when real-time events enabled', async () => {
      await integration.initialize();
      
      const events = [
        'sessionStart', 'sessionEnd',
        'suiteStart', 'suiteEnd',
        'testStart', 'testEnd',
        'log', 'assertion'
      ];
      
      events.forEach(eventName => {
        expect(integration.jestWrapper.on).toHaveBeenCalledWith(
          eventName,
          expect.any(Function)
        );
      });
    });

    test('should forward events with jester: prefix', async () => {
      await integration.initialize();
      
      // Simulate event forwarding
      const testData = { test: 'data' };
      const eventHandler = jest.fn();
      integration.on('jester:testStart', eventHandler);
      
      // Get the callback registered for testStart
      const onCalls = integration.jestWrapper.on.mock.calls;
      const testStartCall = onCalls.find(call => call[0] === 'testStart');
      const callback = testStartCall[1];
      
      // Trigger the callback
      callback(testData);
      
      expect(eventHandler).toHaveBeenCalledWith(testData);
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    test('should start a new session', async () => {
      const jestConfig = { coverage: true };
      const session = await integration.startSession(jestConfig);
      
      expect(session).toEqual({ id: 'test-session-123' });
      expect(integration.currentSession).toEqual({ id: 'test-session-123' });
      expect(integration.jestWrapper.startSession).toHaveBeenCalledWith(jestConfig);
    });

    test('should end current session', async () => {
      await integration.startSession();
      await integration.endSession();
      
      expect(integration.jestWrapper.stopSession).toHaveBeenCalled();
      expect(integration.currentSession).toBeNull();
    });

    test('should initialize if not initialized when starting session', async () => {
      const newIntegration = new JesterIntegration();
      const session = await newIntegration.startSession();
      
      expect(newIntegration.isInitialized).toBe(true);
      expect(session).toEqual({ id: 'test-session-123' });
    });
  });

  describe('Test Analysis', () => {
    beforeEach(async () => {
      await integration.initialize();
      await integration.startSession();
    });

    test('should analyze test results', async () => {
      const analysis = await integration.analyzeTestResults();
      
      expect(analysis).toHaveProperty('summary');
      expect(analysis).toHaveProperty('failedTests');
      expect(analysis).toHaveProperty('slowTests');
      expect(analysis).toHaveProperty('commonErrors');
      expect(analysis).toHaveProperty('errorsByType');
      expect(analysis).toHaveProperty('tddSuggestions');
      
      expect(analysis.summary).toEqual({
        total: 10,
        passed: 8,
        failed: 2,
        skipped: 0
      });
    });

    test('should analyze with specific session ID', async () => {
      const sessionId = 'custom-session-456';
      const analysis = await integration.analyzeTestResults(sessionId);
      
      expect(integration.jestWrapper.getTestSummary).toHaveBeenCalledWith(sessionId);
      expect(integration.jestWrapper.getFailedTests).toHaveBeenCalledWith(sessionId);
    });

    test('should throw error when no session ID available', async () => {
      integration.currentSession = null;
      
      await expect(integration.analyzeTestResults()).rejects.toThrow(
        'No session ID provided or active'
      );
    });

    test('should get TDD suggestions for failed tests', async () => {
      const analysis = await integration.analyzeTestResults();
      
      expect(analysis.tddSuggestions).toEqual({
        suggestions: ['Write more tests', 'Improve test coverage']
      });
      expect(integration.tddHelper.analyzeTDDProgress).toHaveBeenCalledWith({
        sessionId: 'test-session-123',
        includeRecommendations: true
      });
    });
  });

  describe('Test Suggestions', () => {
    beforeEach(async () => {
      await integration.initialize();
      await integration.startSession();
    });

    test('should generate test suggestions for failures', async () => {
      const suggestions = await integration.generateTestSuggestions('test-session-123');
      
      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      
      const failureSuggestion = suggestions.find(s => s.type === 'failures');
      expect(failureSuggestion).toBeDefined();
      expect(failureSuggestion.priority).toBe('high');
      expect(failureSuggestion.details).toBeInstanceOf(Array);
    });

    test('should generate performance suggestions for slow tests', async () => {
      const suggestions = await integration.generateTestSuggestions('test-session-123');
      
      const perfSuggestion = suggestions.find(s => s.type === 'performance');
      expect(perfSuggestion).toBeDefined();
      expect(perfSuggestion.priority).toBe('medium');
      expect(perfSuggestion.message).toContain('tests are running slowly');
    });

    test('should include TDD suggestions', async () => {
      const suggestions = await integration.generateTestSuggestions('test-session-123');
      
      const tddSuggestion = suggestions.find(s => s.type === 'tdd');
      expect(tddSuggestion).toBeDefined();
      expect(tddSuggestion.priority).toBe('high');
    });
  });

  describe('Reporter Configuration', () => {
    test('should return reporter config when enabled', () => {
      integration.config.enabled = true;
      const config = integration.getReporterConfig();
      
      expect(config).toBeInstanceOf(Array);
      expect(config[0]).toBe('default');
      expect(config[1]).toBeInstanceOf(Array);
      expect(config[1][0]).toContain('JesterReporter.js');
      expect(config[1][1]).toHaveProperty('dbPath');
    });

    test('should return null when disabled', () => {
      integration.config.enabled = false;
      const config = integration.getReporterConfig();
      
      expect(config).toBeNull();
    });
  });

  describe('Test History and Search', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    test('should get test history', async () => {
      const history = await integration.getTestHistory('test-name');
      
      expect(integration.jestWrapper.getTestHistory).toHaveBeenCalledWith('test-name');
      expect(history).toBeInstanceOf(Array);
    });

    test('should search logs', async () => {
      const results = await integration.searchLogs('error pattern');
      
      expect(integration.jestWrapper.searchLogs).toHaveBeenCalledWith('error pattern');
      expect(results).toBeInstanceOf(Array);
    });

    test('should get test case details', async () => {
      const testCase = await integration.getTestCase('test-id-123');
      
      expect(integration.jestWrapper.query.getTestCase).toHaveBeenCalledWith('test-id-123');
      expect(testCase).toBeDefined();
    });

    test('should find tests by criteria', async () => {
      const criteria = { status: 'failed' };
      const tests = await integration.findTests(criteria);
      
      expect(integration.jestWrapper.query.findTests).toHaveBeenCalledWith(criteria);
      expect(tests).toBeInstanceOf(Array);
    });
  });

  describe('Report Generation', () => {
    beforeEach(async () => {
      await integration.initialize();
      await integration.startSession();
    });

    test('should generate comprehensive test report', async () => {
      const report = await integration.generateTestReport('test-session-123');
      
      expect(report).toHaveProperty('session');
      expect(report).toHaveProperty('results');
      expect(report).toHaveProperty('analysis');
      expect(report).toHaveProperty('suggestions');
      expect(report).toHaveProperty('timestamp');
      
      expect(report.session.id).toBe('test-session-123');
      expect(report.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Configuration Management', () => {
    test('should check if enabled', () => {
      integration.config.enabled = true;
      integration.isInitialized = true;
      expect(integration.isEnabled()).toBe(true);
      
      integration.config.enabled = false;
      expect(integration.isEnabled()).toBe(false);
    });

    test('should get configuration copy', () => {
      const config = integration.getConfig();
      
      expect(config).toEqual(integration.config);
      expect(config).not.toBe(integration.config); // Should be a copy
    });

    test('should update configuration', async () => {
      await integration.initialize();
      
      integration.updateConfig({ dbPath: '/new/path.db' });
      
      expect(integration.config.dbPath).toBe('/new/path.db');
    });

    test('should cleanup when disabled via config update', async () => {
      await integration.initialize();
      const cleanupSpy = jest.spyOn(integration, 'cleanup');
      
      integration.updateConfig({ enabled: false });
      
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources', async () => {
      await integration.initialize();
      await integration.startSession();
      
      const cleanupHandler = jest.fn();
      integration.on('cleanup-complete', cleanupHandler);
      
      await integration.cleanup();
      
      expect(integration.jestWrapper.stopSession).toHaveBeenCalled();
      expect(integration.jestWrapper.removeAllListeners).toHaveBeenCalled();
      expect(integration.jestWrapper).toBeNull();
      expect(integration.tddHelper).toBeNull();
      expect(integration.isInitialized).toBe(false);
      expect(cleanupHandler).toHaveBeenCalledWith({ timestamp: expect.any(Number) });
    });

    test('should emit cleanup-needed for old data', async () => {
      const cleanupHandler = jest.fn();
      integration.on('cleanup-needed', cleanupHandler);
      
      await integration.initialize();
      
      // cleanupOldData is called during initialization
      expect(cleanupHandler).toHaveBeenCalledWith({
        cutoffDate: expect.any(String),
        message: 'Manual cleanup of old test data may be needed'
      });
    });
  });

  describe('Error Type Suggestions', () => {
    test('should provide appropriate suggestions for error types', () => {
      expect(integration.getErrorTypeSuggestion('assertion'))
        .toBe('Review expected vs actual values. Ensure test data matches implementation.');
      
      expect(integration.getErrorTypeSuggestion('timeout'))
        .toBe('Increase timeout or optimize async operations. Check for infinite loops.');
      
      expect(integration.getErrorTypeSuggestion('syntax'))
        .toBe('Fix syntax errors. Run linter to identify issues.');
      
      expect(integration.getErrorTypeSuggestion('import'))
        .toBe('Verify module paths and dependencies. Check for circular imports.');
      
      expect(integration.getErrorTypeSuggestion('runtime'))
        .toBe('Add error handling. Validate inputs and edge cases.');
      
      expect(integration.getErrorTypeSuggestion('unknown'))
        .toBe('Review test implementation for issues.');
    });
  });
});