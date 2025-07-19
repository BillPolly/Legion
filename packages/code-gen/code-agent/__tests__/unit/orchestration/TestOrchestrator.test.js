/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { TestOrchestrator } from '../../../src/orchestration/TestOrchestrator.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';

describe('TestOrchestrator Simple', () => {
  let orchestrator;
  let mockConfig;

  beforeEach(() => {
    mockConfig = new RuntimeConfig({
      orchestration: {
        maxParallelTests: 4,
        adaptiveParallelism: false,
        priorityScheduling: true
      }
    });
    orchestrator = new TestOrchestrator(mockConfig);
  });

  afterEach(async () => {
    if (orchestrator && orchestrator.resourceMonitor) {
      clearInterval(orchestrator.resourceMonitor);
    }
  });

  test('should create orchestrator', () => {
    expect(orchestrator).toBeDefined();
    expect(orchestrator.config).toBeDefined();
  });

  test('should initialize without hanging', async () => {
    await orchestrator.initialize();
    expect(orchestrator.resourceMonitor).toBeDefined();
  });

  test('should analyze simple dependencies', async () => {
    const tests = [
      { id: 'A', dependencies: [] },
      { id: 'B', dependencies: ['A'] }
    ];
    
    const graph = await orchestrator.analyzeDependencies(tests);
    expect(graph.size).toBe(2);
    expect(graph.get('B').dependencies).toEqual(['A']);
  });

  test('should detect no cycles', () => {
    const graph = new Map([
      ['A', { dependencies: [], dependents: ['B'] }],
      ['B', { dependencies: ['A'], dependents: [] }]
    ]);
    
    expect(orchestrator.hasCycles(graph)).toBe(false);
  });
});