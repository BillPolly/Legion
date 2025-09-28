/**
 * Test package exports
 */

import { describe, it, expect } from '@jest/globals';
import * as BTTask from '../../src/index.js';

describe('Package Exports', () => {
  it('should export all core components', () => {
    expect(BTTask.BTTaskStrategy).toBeDefined();
    expect(BTTask.BTExecutor).toBeDefined();
    expect(BTTask.createBTTask).toBeDefined();
  });
  
  it('should export all strategy types', () => {
    expect(BTTask.SequenceStrategy).toBeDefined();
    expect(BTTask.SelectorStrategy).toBeDefined();
    expect(BTTask.ActionStrategy).toBeDefined();
    expect(BTTask.ConditionStrategy).toBeDefined();
    expect(BTTask.RetryStrategy).toBeDefined();
  });
  
  it('should export integration components', () => {
    expect(BTTask.BTLoader).toBeDefined();
    expect(BTTask.BTTool).toBeDefined();
  });
  
  it('should have correct export types', () => {
    expect(typeof BTTask.BTTaskStrategy).toBe('object');
    expect(typeof BTTask.BTExecutor).toBe('function');
    expect(typeof BTTask.createBTTask).toBe('function');
    expect(typeof BTTask.BTLoader).toBe('function');
    expect(typeof BTTask.BTTool).toBe('function');
  });
});