/**
 * Test for the new testApplication method
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { CodeAgent } from '../../../src/agent/CodeAgent.js';

describe('CodeAgent.testApplication', () => {
  let agent;
  let mockQualityPhase;

  beforeEach(() => {
    agent = new CodeAgent({
      projectType: 'backend'
    });

    // Mock the quality phase
    mockQualityPhase = {
      runJestTests: jest.fn().mockResolvedValue({
        passed: true,
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        coverage: 95.5,
        failures: [],
        testSuites: {
          total: 3,
          passed: 3,
          failed: 0
        }
      })
    };

    agent.qualityPhase = mockQualityPhase;
    agent.emit = jest.fn(); // Mock emit method
  });

  test('should run tests successfully when all pass', async () => {
    const result = await agent.testApplication();

    expect(result.success).toBe(true);
    expect(result.totalTests).toBe(10);
    expect(result.passedTests).toBe(10);
    expect(result.failedTests).toBe(0);
    expect(result.coverage).toBe(95.5);
    expect(result.testSuites).toEqual({
      total: 3,
      passed: 3,
      failed: 0
    });

    // Check emit calls
    expect(agent.emit).toHaveBeenCalledWith('progress', expect.objectContaining({
      phase: 'testing',
      step: 'starting',
      message: '🧪 Running application tests...'
    }));

    expect(agent.emit).toHaveBeenCalledWith('phase-complete', expect.objectContaining({
      phase: 'testing',
      message: 'Tests PASSED: 10/10 passed'
    }));
  });

  test('should handle test failures', async () => {
    mockQualityPhase.runJestTests.mockResolvedValue({
      passed: false,
      totalTests: 10,
      passedTests: 7,
      failedTests: 3,
      coverage: 75,
      failures: [
        { testFile: 'test.js', testName: 'should work', error: 'Failed' }
      ]
    });

    const result = await agent.testApplication();

    expect(result.success).toBe(false);
    expect(result.failedTests).toBe(3);
    expect(result.failures).toHaveLength(1);
    
    expect(agent.emit).toHaveBeenCalledWith('phase-complete', expect.objectContaining({
      phase: 'testing',
      message: 'Tests FAILED: 7/10 passed'
    }));
  });

  test('should handle exceptions', async () => {
    mockQualityPhase.runJestTests.mockRejectedValue(new Error('Jest not found'));

    const result = await agent.testApplication();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Jest not found');

    expect(agent.emit).toHaveBeenCalledWith('error', expect.objectContaining({
      phase: 'testing',
      message: 'Test execution failed: Jest not found'
    }));
  });

  test('should throw error if quality phase not initialized', async () => {
    agent.qualityPhase = null;

    await expect(agent.testApplication()).rejects.toThrow('Quality phase not initialized');
  });
});