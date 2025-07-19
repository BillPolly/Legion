/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ParallelTestExecutor } from '../../../src/execution/ParallelTestExecutor.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';

describe('ParallelTestExecutor Simple', () => {
  let executor;
  let mockConfig;

  beforeEach(() => {
    mockConfig = new RuntimeConfig({
      parallel: {
        maxWorkers: 2,
        minWorkers: 1,
        workerIdleTimeout: 30000,
        testTimeout: 120000
      }
    });
    executor = new ParallelTestExecutor(mockConfig);
  });

  afterEach(async () => {
    // Ensure cleanup
    if (executor.monitoringInterval) {
      clearInterval(executor.monitoringInterval);
    }
    executor.workers.forEach(worker => {
      if (worker.worker && worker.worker.terminate) {
        worker.worker.terminate();
      }
    });
  });

  test('should create executor', () => {
    expect(executor).toBeDefined();
    expect(executor.config).toBeDefined();
    expect(executor.workers).toBeInstanceOf(Map);
  });

  test('should have correct initial state', () => {
    expect(executor.testQueue).toEqual([]);
    expect(executor.runningTests.size).toBe(0);
    expect(executor.completedTests.size).toBe(0);
    expect(executor.metrics.totalWorkers).toBe(0);
  });

  test('should group tests by affinity', () => {
    const tests = [
      { id: '1', affinityGroup: 'A' },
      { id: '2', affinityGroup: 'B' },
      { id: '3', affinityGroup: 'A' }
    ];
    
    executor.groupTestsByAffinity(tests);
    
    expect(executor.testGroups.size).toBe(2);
    expect(executor.testGroups.get('A')).toHaveLength(2);
    expect(executor.testGroups.get('B')).toHaveLength(1);
  });

  test('should calculate metrics', () => {
    executor.metrics.testsExecuted = 5;
    executor.updateAverageExecutionTime(100);
    
    expect(executor.metrics.averageExecutionTime).toBe(20);
  });
});