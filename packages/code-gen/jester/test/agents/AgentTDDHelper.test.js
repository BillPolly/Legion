/**
 * Agent TDD Helper Tests
 * Tests for the AI agent TDD workflow assistance functionality
 */

import { AgentTDDHelper } from '../../src/agents/AgentTDDHelper.js';
import { JestAgentWrapper } from '../../src/core/JestAgentWrapper.js';
import { promises as fs } from 'fs';

describe('AgentTDDHelper', () => {
  let helper;
  let mockJaw;
  const testDbPath = './test-agent-tdd.db';

  beforeEach(async () => {
    // Create a real JAW instance for testing
    mockJaw = new JestAgentWrapper({
      dbPath: testDbPath,
      storage: 'sqlite'
    });
    
    helper = new AgentTDDHelper(mockJaw);
  });

  afterEach(async () => {
    if (mockJaw) {
      await mockJaw.close();
    }
    
    // Clean up test database
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // File doesn't exist, that's fine
    }
  });

  describe('Initialization', () => {
    test('creates helper with JAW instance', () => {
      expect(helper).toBeDefined();
      expect(helper.jaw).toBe(mockJaw);
    });

    test('throws error when no JAW instance provided', () => {
      expect(() => new AgentTDDHelper(null)).toThrow();
    });
  });

  describe('TDD Cycle Management', () => {
    test('runTDDCycle returns green status when all tests pass', async () => {
      // Setup: Create a session with passing tests
      const session = await mockJaw.startSession();
      
      // Mock successful test run (no failures)
      const result = await helper.runTDDCycle('test/sample.test.js');
      
      expect(result.status).toBe('green');
      expect(result.message).toContain('All tests passing');
      expect(result.nextAction).toBe('refactor');
    });

    test('runTDDCycle returns red status when tests fail', async () => {
      // Mock JAW methods to return failing tests
      const originalRunTests = mockJaw.runTests;
      const originalGetFailedTests = mockJaw.getFailedTests;
      
      mockJaw.runTests = async () => ({ id: 'session-123' });
      mockJaw.getFailedTests = async () => [
        {
          fullName: 'Component should work',
          duration: 1000,
          errors: [{
            type: 'assertion',
            message: 'Expected true but received false'
          }]
        }
      ];
      
      const result = await helper.runTDDCycle('test/sample.test.js');
      
      expect(result.status).toBe('red');
      expect(result.failures).toBeGreaterThan(0);
      expect(result.suggestions).toBeDefined();
      expect(result.nextActions).toBeDefined();
      expect(result.detailedFailures).toBeDefined();
      
      // Restore original methods
      mockJaw.runTests = originalRunTests;
      mockJaw.getFailedTests = originalGetFailedTests;
    });

    test('runTDDCycle provides detailed failure analysis', async () => {
      // Mock JAW methods to return multiple failing tests
      const originalRunTests = mockJaw.runTests;
      const originalGetFailedTests = mockJaw.getFailedTests;
      
      mockJaw.runTests = async () => ({ id: 'session-123' });
      mockJaw.getFailedTests = async () => [
        {
          fullName: 'Component assertion test',
          duration: 500,
          errors: [{
            type: 'assertion',
            message: 'Expected 5 but received 3'
          }]
        },
        {
          fullName: 'Component runtime test',
          duration: 200,
          errors: [{
            type: 'runtime',
            message: 'Cannot read property of undefined'
          }]
        }
      ];
      
      const result = await helper.runTDDCycle('test/sample.test.js');
      
      expect(result.status).toBe('red');
      expect(result.failures).toBe(2);
      expect(result.errorSummary.totalFailures).toBe(2);
      expect(result.errorSummary.errorTypeDistribution.assertion).toBe(1);
      expect(result.errorSummary.errorTypeDistribution.runtime).toBe(1);
      expect(result.suggestions).toHaveLength(2);
      expect(result.nextActions).toHaveLength(2);
      
      // Restore original methods
      mockJaw.runTests = originalRunTests;
      mockJaw.getFailedTests = originalGetFailedTests;
    });
  });

  describe('Failure Analysis', () => {
    test('analyzeFailures categorizes error types correctly', async () => {
      const failures = [
        {
          errors: [
            { type: 'assertion', message: 'Expected true but got false' },
            { type: 'assertion', message: 'Expected 5 but got 3' }
          ]
        },
        {
          errors: [
            { type: 'runtime', message: 'Cannot read property' },
            { type: 'timeout', message: 'Test timed out' }
          ]
        }
      ];
      
      const analysis = await helper.analyzeFailures(failures);
      
      expect(analysis.totalFailures).toBe(2);
      expect(analysis.errorTypeDistribution.assertion).toBe(2);
      expect(analysis.errorTypeDistribution.runtime).toBe(1);
      expect(analysis.errorTypeDistribution.timeout).toBe(1);
      expect(analysis.commonMessages).toBeDefined();
      expect(analysis.commonMessages.length).toBeLessThanOrEqual(5);
    });

    test('analyzeFailures handles empty failures array', async () => {
      const analysis = await helper.analyzeFailures([]);
      
      expect(analysis.totalFailures).toBe(0);
      expect(analysis.errorTypeDistribution).toEqual({});
      expect(analysis.commonMessages).toEqual([]);
    });

    test('analyzeFailures handles failures without errors', async () => {
      const failures = [
        { errors: [] },
        { errors: undefined }
      ];
      
      const analysis = await helper.analyzeFailures(failures);
      
      expect(analysis.totalFailures).toBe(2);
      expect(analysis.errorTypeDistribution).toEqual({});
    });
  });

  describe('Implementation Hints Generation', () => {
    test('generateImplementationHints provides assertion hints', async () => {
      const errorSummary = {
        errorTypeDistribution: {
          assertion: 3,
          runtime: 1
        }
      };
      
      const hints = await helper.generateImplementationHints(errorSummary);
      
      const assertionHint = hints.find(h => h.type === 'assertion');
      expect(assertionHint).toBeDefined();
      expect(assertionHint.priority).toBe('high');
      expect(assertionHint.suggestion).toContain('core logic');
    });

    test('generateImplementationHints provides runtime hints', async () => {
      const errorSummary = {
        errorTypeDistribution: {
          runtime: 2
        }
      };
      
      const hints = await helper.generateImplementationHints(errorSummary);
      
      const runtimeHint = hints.find(h => h.type === 'runtime');
      expect(runtimeHint).toBeDefined();
      expect(runtimeHint.priority).toBe('medium');
      expect(runtimeHint.suggestion).toContain('undefined variables');
    });

    test('generateImplementationHints handles empty error summary', async () => {
      const errorSummary = {
        errorTypeDistribution: {}
      };
      
      const hints = await helper.generateImplementationHints(errorSummary);
      
      expect(hints).toEqual([]);
    });
  });

  describe('Action Prioritization', () => {
    test('prioritizeActions sorts by error count', () => {
      const failures = [
        {
          fullName: 'Test with many errors',
          errors: [{ type: 'assertion' }, { type: 'runtime' }, { type: 'timeout' }]
        },
        {
          fullName: 'Test with one error',
          errors: [{ type: 'assertion' }]
        },
        {
          fullName: 'Test with two errors',
          errors: [{ type: 'assertion' }, { type: 'runtime' }]
        }
      ];
      
      const actions = helper.prioritizeActions(failures);
      
      expect(actions).toHaveLength(3);
      expect(actions[0].test).toBe('Test with one error');
      expect(actions[0].priority).toBe('high');
      expect(actions[1].test).toBe('Test with two errors');
      expect(actions[1].priority).toBe('medium');
      expect(actions[2].test).toBe('Test with many errors');
      expect(actions[2].priority).toBe('medium');
    });

    test('prioritizeActions limits to 3 actions', () => {
      const failures = Array.from({ length: 10 }, (_, i) => ({
        fullName: `Test ${i}`,
        errors: [{ type: 'assertion' }]
      }));
      
      const actions = helper.prioritizeActions(failures);
      
      expect(actions).toHaveLength(3);
    });

    test('prioritizeActions handles failures without errors', () => {
      const failures = [
        { fullName: 'Test 1', errors: [] },
        { fullName: 'Test 2', errors: undefined }
      ];
      
      const actions = helper.prioritizeActions(failures);
      
      expect(actions).toHaveLength(2);
      expect(actions[0].priority).toBe('medium'); // 0 errors gets medium priority (only 1 error gets high)
    });
  });

  describe('Test History Analysis', () => {
    test('analyzeTestHistory provides comprehensive analysis', async () => {
      const testName = 'sample test';
      
      // Mock JAW method to return test history
      const originalGetTestHistory = mockJaw.getTestHistory;
      mockJaw.getTestHistory = async () => [
        { status: 'passed', duration: 1000 },
        { status: 'failed', duration: 500 },
        { status: 'passed', duration: 800 }
      ];
      
      const analysis = await helper.analyzeTestHistory(testName);
      
      expect(analysis.totalRuns).toBe(3);
      expect(analysis.successRate).toBe(67); // 2/3 * 100, rounded
      expect(analysis.averageDuration).toBe(767); // (1000 + 500 + 800) / 3, rounded
      expect(analysis.trend).toBeDefined();
      expect(analysis.recommendation).toBeDefined();
      
      // Restore original method
      mockJaw.getTestHistory = originalGetTestHistory;
    });

    test('analyzeTestHistory handles no history', async () => {
      const analysis = await helper.analyzeTestHistory('nonexistent test');
      
      expect(analysis.message).toContain('No history found');
    });
  });

  describe('Trend Detection', () => {
    test('detectTrend identifies stable passing', () => {
      const recentRuns = [
        { status: 'passed' },
        { status: 'passed' },
        { status: 'passed' }
      ];
      
      const trend = helper.detectTrend(recentRuns);
      
      expect(trend).toBe('stable_passing');
    });

    test('detectTrend identifies consistently failing', () => {
      const recentRuns = [
        { status: 'failed' },
        { status: 'failed' },
        { status: 'failed' }
      ];
      
      const trend = helper.detectTrend(recentRuns);
      
      expect(trend).toBe('consistently_failing');
    });

    test('detectTrend identifies mostly passing', () => {
      const recentRuns = [
        { status: 'passed' },
        { status: 'passed' },
        { status: 'failed' }
      ];
      
      const trend = helper.detectTrend(recentRuns);
      
      expect(trend).toBe('mostly_passing');
    });

    test('detectTrend identifies unstable', () => {
      const recentRuns = [
        { status: 'failed' },
        { status: 'failed' },
        { status: 'passed' }
      ];
      
      const trend = helper.detectTrend(recentRuns);
      
      expect(trend).toBe('unstable');
    });

    test('detectTrend handles insufficient data', () => {
      const recentRuns = [
        { status: 'passed' },
        { status: 'failed' }
      ];
      
      const trend = helper.detectTrend(recentRuns);
      
      expect(trend).toBe('insufficient_data');
    });
  });

  describe('Recommendation Generation', () => {
    test('generateRecommendation for stable tests', () => {
      const recommendation = helper.generateRecommendation(0.95, 'stable_passing');
      
      expect(recommendation).toContain('stable and reliable');
    });

    test('generateRecommendation for poor success rate', () => {
      const recommendation = helper.generateRecommendation(0.3, 'consistently_failing');
      
      expect(recommendation).toContain('needs attention');
    });

    test('generateRecommendation for flaky tests', () => {
      const recommendation = helper.generateRecommendation(0.7, 'unstable');
      
      expect(recommendation).toContain('flaky');
      expect(recommendation).toContain('race conditions');
    });

    test('generateRecommendation for acceptable performance', () => {
      const recommendation = helper.generateRecommendation(0.8, 'mostly_passing');
      
      expect(recommendation).toContain('acceptable');
      expect(recommendation).toContain('could be improved');
    });
  });

  describe('Integration with JAW', () => {
    test('uses JAW for test execution', async () => {
      const testFile = 'test/sample.test.js';
      
      // Mock JAW methods
      const originalRunTests = mockJaw.runTests;
      const originalGetFailedTests = mockJaw.getFailedTests;
      
      mockJaw.runTests = async () => ({ id: 'session-123' });
      mockJaw.getFailedTests = async () => [];
      
      const result = await helper.runTDDCycle(testFile);
      
      expect(result.status).toBe('green');
      
      // Restore original methods
      mockJaw.runTests = originalRunTests;
      mockJaw.getFailedTests = originalGetFailedTests;
    });

    test('uses JAW for test history retrieval', async () => {
      const testName = 'sample test';
      
      // Mock JAW method
      const originalGetTestHistory = mockJaw.getTestHistory;
      mockJaw.getTestHistory = async () => [
        { status: 'passed', duration: 1000 },
        { status: 'failed', duration: 500 }
      ];
      
      const analysis = await helper.analyzeTestHistory(testName);
      
      expect(analysis.totalRuns).toBe(2);
      expect(analysis.successRate).toBe(50);
      
      // Restore original method
      mockJaw.getTestHistory = originalGetTestHistory;
    });
  });

  describe('Error Handling', () => {
    test('handles JAW errors gracefully', async () => {
      // Mock JAW to throw error
      const originalRunTests = mockJaw.runTests;
      mockJaw.runTests = async () => {
        throw new Error('JAW error');
      };
      
      await expect(helper.runTDDCycle('test/sample.test.js')).rejects.toThrow('JAW error');
      
      // Restore original method
      mockJaw.runTests = originalRunTests;
    });

    test('handles missing test data gracefully', async () => {
      const result = await helper.runTDDCycle('test/nonexistent.test.js');
      
      // Should handle gracefully and return green status (no failures found)
      expect(result.status).toBe('green');
    });
  });

  describe('Performance', () => {
    test('analyzes large failure sets efficiently', async () => {
      const largeFailureSet = Array.from({ length: 1000 }, (_, i) => ({
        errors: [
          { type: 'assertion', message: `Error ${i}` },
          { type: 'runtime', message: `Runtime error ${i}` }
        ]
      }));
      
      const startTime = Date.now();
      const analysis = await helper.analyzeFailures(largeFailureSet);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
      expect(analysis.totalFailures).toBe(1000);
      expect(analysis.errorTypeDistribution.assertion).toBe(1000);
      expect(analysis.errorTypeDistribution.runtime).toBe(1000);
    });

    test('prioritizes actions efficiently for large datasets', () => {
      const largeFailureSet = Array.from({ length: 1000 }, (_, i) => ({
        fullName: `Test ${i}`,
        errors: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, () => ({ type: 'assertion' }))
      }));
      
      const startTime = Date.now();
      const actions = helper.prioritizeActions(largeFailureSet);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
      expect(actions).toHaveLength(3); // Should limit to 3 regardless of input size
    });
  });
});
