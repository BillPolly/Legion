/**
 * Test suite for ExecutionContext
 * Tests immutable context management, inheritance, and state propagation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExecutionContext } from '../../../src/core/ExecutionContext.js';

describe('ExecutionContext', () => {
  let context;

  beforeEach(() => {
    context = new ExecutionContext(null, {
      taskId: 'root-task',
      sessionId: 'session-123',
      maxDepth: 3,
      timeout: 5000,
      retryCount: 2
    });
  });

  describe('Context Creation', () => {
    it('should create root context', () => {
      expect(context.depth).toBe(0);
      expect(context.parent).toBeNull();
      expect(context.taskId).toBe('root-task');
      expect(context.sessionId).toBe('session-123');
      expect(context.maxDepth).toBe(3);
    });

    it('should auto-generate IDs if not provided', () => {
      const autoContext = new ExecutionContext();
      
      expect(autoContext.taskId).toMatch(/^task-/);
      expect(autoContext.sessionId).toMatch(/^session-/);
      expect(autoContext.correlationId).toBe(autoContext.sessionId);
    });

    it('should freeze configuration', () => {
      expect(() => {
        context.config.timeout = 10000;
      }).toThrow();
      
      expect(() => {
        context.config.newProp = 'value';
      }).toThrow();
    });

    it('should freeze breadcrumbs', () => {
      expect(() => {
        context.breadcrumbs.push({ taskId: 'new' });
      }).toThrow();
    });

    it('should set default values', () => {
      const defaultContext = new ExecutionContext();
      
      expect(defaultContext.depth).toBe(0);
      expect(defaultContext.maxDepth).toBe(3);
      expect(defaultContext.config.timeout).toBe(0);
      expect(defaultContext.config.retryCount).toBe(2);
      expect(defaultContext.config.parallelLimit).toBe(5);
      expect(defaultContext.config.cacheResults).toBe(true);
      expect(defaultContext.config.verboseLogging).toBe(false);
    });
  });

  describe('Child Context Creation', () => {
    it('should create child context with incremented depth', () => {
      const child = context.createChild('child-task');
      
      expect(child.depth).toBe(1);
      expect(child.parent).toBe(context);
      expect(child.taskId).toBe('child-task');
      expect(child.sessionId).toBe('session-123');
      expect(child.correlationId).toBe('session-123');
    });

    it('should inherit parent configuration', () => {
      const child = context.createChild('child-task');
      
      expect(child.maxDepth).toBe(3);
      expect(child.config.timeout).toBe(5000);
      expect(child.config.retryCount).toBe(2);
    });

    it('should override configuration in child', () => {
      const child = context.createChild('child-task', {
        timeout: 10000,
        retryCount: 5
      });
      
      expect(child.config.timeout).toBe(10000);
      expect(child.config.retryCount).toBe(5);
    });

    it('should add to breadcrumbs', () => {
      const child = context.createChild('child-task');
      
      expect(child.breadcrumbs.length).toBe(1);
      expect(child.breadcrumbs[0].taskId).toBe('child-task');
      expect(child.breadcrumbs[0].depth).toBe(1);
      expect(child.breadcrumbs[0].timestamp).toBeDefined();
    });

    it('should preserve shared state reference', () => {
      context = context.withSharedState('key', 'value');
      const child = context.createChild('child-task');
      
      expect(child.getSharedState('key')).toBe('value');
    });
  });

  describe('Sibling Context Creation', () => {
    it('should create sibling context at same depth', () => {
      const child = context.createChild('child-task');
      const sibling = child.createSibling('sibling-task');
      
      expect(sibling.depth).toBe(child.depth);
      expect(sibling.parent).toBe(child.parent);
      expect(sibling.taskId).toBe('sibling-task');
    });

    it('should copy shared state', () => {
      const child = context.createChild('child-task');
      const modifiedChild = child.withSharedState('key', 'value');
      const sibling = modifiedChild.createSibling('sibling-task');
      
      expect(sibling.getSharedState('key')).toBe('value');
    });

    it('should preserve previous results', () => {
      const child = context.createChild('child-task');
      const withResult = child.withResult({ data: 'result' });
      const sibling = withResult.createSibling('sibling-task');
      
      expect(sibling.previousResults).toEqual(withResult.previousResults);
    });
  });

  describe('Depth Management', () => {
    it('should track depth correctly', () => {
      const level1 = context.createChild('level-1');
      const level2 = level1.createChild('level-2');
      const level3 = level2.createChild('level-3');
      
      expect(context.depth).toBe(0);
      expect(level1.depth).toBe(1);
      expect(level2.depth).toBe(2);
      expect(level3.depth).toBe(3);
    });

    it('should check if decomposition is allowed', () => {
      expect(context.canDecompose()).toBe(true);
      
      const level1 = context.createChild('level-1');
      expect(level1.canDecompose()).toBe(true);
      
      const level2 = level1.createChild('level-2');
      expect(level2.canDecompose()).toBe(true);
      
      const level3 = level2.createChild('level-3');
      expect(level3.canDecompose()).toBe(false);
    });

    it('should identify root context', () => {
      expect(context.isRoot()).toBe(true);
      
      const child = context.createChild('child');
      expect(child.isRoot()).toBe(false);
    });

    it('should identify max depth', () => {
      const level1 = context.createChild('level-1');
      const level2 = level1.createChild('level-2');
      const level3 = level2.createChild('level-3');
      
      expect(context.isAtMaxDepth()).toBe(false);
      expect(level1.isAtMaxDepth()).toBe(false);
      expect(level2.isAtMaxDepth()).toBe(false);
      expect(level3.isAtMaxDepth()).toBe(true);
    });
  });

  describe('Deadline Management', () => {
    it('should check expiration', () => {
      const futureDeadline = Date.now() + 1000;
      const pastDeadline = Date.now() - 1000;
      
      const futureContext = context.withDeadline(futureDeadline);
      expect(futureContext.isExpired()).toBe(false);
      
      const pastContext = context.withDeadline(pastDeadline);
      expect(pastContext.isExpired()).toBe(true);
    });

    it('should calculate remaining time', () => {
      const deadline = Date.now() + 1000;
      const withDeadline = context.withDeadline(deadline);
      
      const remaining = withDeadline.getRemainingTime();
      expect(remaining).toBeGreaterThan(900);
      expect(remaining).toBeLessThanOrEqual(1000);
    });

    it('should handle no deadline', () => {
      expect(context.isExpired()).toBe(false);
      expect(context.getRemainingTime()).toBe(Infinity);
    });

    it('should inherit deadline', () => {
      const deadline = Date.now() + 1000;
      const withDeadline = context.withDeadline(deadline);
      const child = withDeadline.createChild('child');
      
      expect(child.deadline).toBe(deadline);
      expect(child.getRemainingTime()).toBeGreaterThan(0);
    });
  });

  describe('Immutable Updates', () => {
    it('should create new context with result', () => {
      const result = { data: 'test' };
      const withResult = context.withResult(result);
      
      expect(withResult).not.toBe(context);
      expect(withResult.previousResults).toContain(result);
      expect(context.previousResults.length).toBe(0);
    });

    it('should create new context with shared state', () => {
      const withState = context.withSharedState('key', 'value');
      
      expect(withState).not.toBe(context);
      expect(withState.getSharedState('key')).toBe('value');
      expect(context.getSharedState('key')).toBeUndefined();
    });

    it('should batch update shared states', () => {
      const updates = {
        key1: 'value1',
        key2: 'value2',
        key3: 'value3'
      };
      
      const withStates = context.withSharedStates(updates);
      
      expect(withStates).not.toBe(context);
      expect(withStates.getSharedState('key1')).toBe('value1');
      expect(withStates.getSharedState('key2')).toBe('value2');
      expect(withStates.getSharedState('key3')).toBe('value3');
    });

    it('should create new context with dependency', () => {
      const dependency = { result: 'dep-result' };
      const withDep = context.withDependency('dep-task', dependency);
      
      expect(withDep).not.toBe(context);
      expect(withDep.getDependency('dep-task')).toBe(dependency);
      expect(context.hasDependency('dep-task')).toBe(false);
    });

    it('should create new context with metadata', () => {
      const withMeta = context.withMetadata('author', 'test-user');
      
      expect(withMeta).not.toBe(context);
      expect(withMeta.metadata.author).toBe('test-user');
      expect(context.metadata.author).toBeUndefined();
    });

    it('should preserve other properties during updates', () => {
      const withState = context.withSharedState('key', 'value');
      
      expect(withState.taskId).toBe(context.taskId);
      expect(withState.sessionId).toBe(context.sessionId);
      expect(withState.depth).toBe(context.depth);
      expect(withState.maxDepth).toBe(context.maxDepth);
    });
  });

  describe('State Retrieval', () => {
    it('should get shared state with default', () => {
      const withState = context.withSharedState('key', 'value');
      
      expect(withState.getSharedState('key')).toBe('value');
      expect(withState.getSharedState('missing', 'default')).toBe('default');
    });

    it('should get all shared state as object', () => {
      let ctx = context;
      ctx = ctx.withSharedState('key1', 'value1');
      ctx = ctx.withSharedState('key2', 'value2');
      
      const allState = ctx.getAllSharedState();
      expect(allState).toEqual({
        key1: 'value1',
        key2: 'value2'
      });
    });

    it('should check and get dependencies', () => {
      const dep = { result: 'test' };
      const withDep = context.withDependency('task-1', dep);
      
      expect(withDep.hasDependency('task-1')).toBe(true);
      expect(withDep.hasDependency('task-2')).toBe(false);
      expect(withDep.getDependency('task-1')).toBe(dep);
      expect(withDep.getDependency('task-2')).toBeUndefined();
    });

    it('should get all dependencies', () => {
      let ctx = context;
      ctx = ctx.withDependency('task-1', { result: 'dep1' });
      ctx = ctx.withDependency('task-2', { result: 'dep2' });
      
      const allDeps = ctx.getAllDependencies();
      expect(allDeps).toEqual({
        'task-1': { result: 'dep1' },
        'task-2': { result: 'dep2' }
      });
    });
  });

  describe('Ancestry Navigation', () => {
    it('should get ancestors', () => {
      const level1 = context.createChild('level-1');
      const level2 = level1.createChild('level-2');
      const level3 = level2.createChild('level-3');
      
      const ancestors = level3.getAncestors();
      expect(ancestors.length).toBe(3);
      expect(ancestors[0]).toBe(level2);
      expect(ancestors[1]).toBe(level1);
      expect(ancestors[2]).toBe(context);
    });

    it('should find ancestor by predicate', () => {
      const level1 = context.createChild('level-1');
      const level2 = level1.createChild('level-2');
      const level3 = level2.createChild('level-3');
      
      const found = level3.findAncestor(ctx => ctx.taskId === 'level-1');
      expect(found).toBe(level1);
      
      const notFound = level3.findAncestor(ctx => ctx.taskId === 'non-existent');
      expect(notFound).toBeNull();
    });

    it('should get root context', () => {
      const level1 = context.createChild('level-1');
      const level2 = level1.createChild('level-2');
      const level3 = level2.createChild('level-3');
      
      expect(level3.getRoot()).toBe(context);
      expect(level2.getRoot()).toBe(context);
      expect(level1.getRoot()).toBe(context);
      expect(context.getRoot()).toBe(context);
    });
  });

  describe('Execution Path', () => {
    it('should get execution path as string', () => {
      const level1 = context.createChild('task-1');
      const level2 = level1.createChild('task-2');
      const level3 = level2.createChild('task-3');
      
      expect(level3.getExecutionPath()).toBe('task-1 → task-2 → task-3');
    });

    it('should get execution trace with timings', () => {
      const level1 = context.createChild('task-1');
      
      // Add a small delay to ensure timing difference
      const delay = 10;
      const startTime = Date.now();
      while (Date.now() - startTime < delay) {
        // Busy wait
      }
      
      const level2 = level1.createChild('task-2');
      
      const trace = level2.getExecutionTrace();
      expect(trace.length).toBe(2);
      expect(trace[0].taskId).toBe('task-1');
      expect(trace[1].taskId).toBe('task-2');
      expect(trace[0].elapsed).toBeGreaterThan(0);
      expect(trace[1].elapsed).toBeGreaterThan(0);
    });

    it('should get elapsed time', () => {
      const startTime = Date.now();
      const elapsed = context.getElapsedTime();
      
      expect(elapsed).toBeGreaterThanOrEqual(0);
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('Parallel Execution Support', () => {
    it('should create parallel contexts', () => {
      const taskIds = ['parallel-1', 'parallel-2', 'parallel-3'];
      const parallelContexts = context.createParallelContexts(taskIds);
      
      expect(parallelContexts.length).toBe(3);
      expect(parallelContexts[0].taskId).toBe('parallel-1');
      expect(parallelContexts[1].taskId).toBe('parallel-2');
      expect(parallelContexts[2].taskId).toBe('parallel-3');
      
      // All should have same depth
      parallelContexts.forEach(ctx => {
        expect(ctx.depth).toBe(1);
        expect(ctx.parent).toBe(context);
      });
    });

    it('should merge parallel results', () => {
      const taskIds = ['task-1', 'task-2'];
      const parallelContexts = context.createParallelContexts(taskIds);
      
      // Add results to parallel contexts
      const ctx1WithResult = parallelContexts[0].withResult({ data: 'result1' });
      const ctx2WithResult = parallelContexts[1].withResult({ data: 'result2' });
      
      // Add some shared state
      const ctx1WithState = ctx1WithResult.withSharedState('key1', 'value1');
      const ctx2WithState = ctx2WithResult.withSharedState('key2', 'value2');
      
      // Merge results
      const merged = context.mergeParallelResults([ctx1WithState, ctx2WithState]);
      
      expect(merged).not.toBe(context);
      expect(merged.previousResults.length).toBe(2);
      expect(merged.previousResults[0]).toEqual({ data: 'result1' });
      expect(merged.previousResults[1]).toEqual({ data: 'result2' });
      expect(merged.getSharedState('key1')).toBe('value1');
      expect(merged.getSharedState('key2')).toBe('value2');
    });

    it('should handle conflicting shared state (last write wins)', () => {
      const taskIds = ['task-1', 'task-2'];
      const parallelContexts = context.createParallelContexts(taskIds);
      
      const ctx1 = parallelContexts[0].withSharedState('conflict', 'value1');
      const ctx2 = parallelContexts[1].withSharedState('conflict', 'value2');
      
      const merged = context.mergeParallelResults([ctx1, ctx2]);
      
      expect(merged.getSharedState('conflict')).toBe('value2');
    });
  });

  describe('Serialization', () => {
    it('should convert to plain object', () => {
      let ctx = context;
      ctx = ctx.withSharedState('key', 'value');
      ctx = ctx.withResult({ data: 'result' });
      ctx = ctx.withDependency('dep-1', { dep: 'data' });
      ctx = ctx.withMetadata('meta', 'value');
      
      const obj = ctx.toObject();
      
      expect(obj.taskId).toBe('root-task');
      expect(obj.sessionId).toBe('session-123');
      expect(obj.depth).toBe(0);
      expect(obj.sharedState).toEqual({ key: 'value' });
      expect(obj.previousResults).toEqual([{ data: 'result' }]);
      expect(obj.dependencies).toEqual({ 'dep-1': { dep: 'data' } });
      expect(obj.metadata).toEqual({ meta: 'value' });
      expect(obj.config).toBeDefined();
      expect(obj.executionPath).toBe('');
      expect(obj.elapsedTime).toBeDefined();
    });

    it('should create from plain object', () => {
      const obj = {
        taskId: 'restored-task',
        sessionId: 'restored-session',
        correlationId: 'restored-correlation',
        depth: 2,
        breadcrumbs: [
          { taskId: 'parent', depth: 1, timestamp: Date.now() }
        ],
        sharedState: { key: 'value' },
        previousResults: [{ data: 'result' }],
        dependencies: { 'dep-1': { dep: 'data' } },
        metadata: { author: 'test' },
        userContext: { user: 'test-user' },
        config: {
          maxDepth: 5,
          timeout: 10000
        },
        startTime: Date.now() - 1000,
        deadline: Date.now() + 5000
      };
      
      const restored = ExecutionContext.fromObject(obj);
      
      expect(restored.taskId).toBe('restored-task');
      expect(restored.sessionId).toBe('restored-session');
      expect(restored.correlationId).toBe('restored-correlation');
      expect(restored.depth).toBe(2);
      expect(restored.breadcrumbs).toEqual(obj.breadcrumbs);
      expect(restored.getSharedState('key')).toBe('value');
      expect(restored.previousResults).toEqual(obj.previousResults);
      expect(restored.getDependency('dep-1')).toEqual({ dep: 'data' });
      expect(restored.metadata).toEqual(obj.metadata);
      expect(restored.userContext).toEqual(obj.userContext);
      expect(restored.config.maxDepth).toBe(5);
      expect(restored.config.timeout).toBe(10000);
    });

    it('should create lightweight summary', () => {
      const deadline = Date.now() + 1000;
      let ctx = context;
      ctx = ctx.withDeadline(deadline);
      ctx = ctx.withSharedState('key1', 'value1');
      ctx = ctx.withSharedState('key2', 'value2');
      ctx = ctx.withResult({ data: 'result' });
      
      const summary = ctx.toSummary();
      
      expect(summary.taskId).toBe('root-task');
      expect(summary.sessionId).toBe('session-123');
      expect(summary.depth).toBe(0);
      expect(summary.path).toBe('');
      expect(summary.elapsed).toBeDefined();
      expect(summary.remaining).toBeGreaterThan(0);
      expect(summary.remaining).toBeLessThanOrEqual(1000);
      expect(summary.resultsCount).toBe(1);
      expect(summary.sharedStateKeys).toEqual(['key1', 'key2']);
      expect(summary.isExpired).toBe(false);
      expect(summary.canDecompose).toBe(true);
    });
  });

  describe('User Context', () => {
    it('should preserve user context', () => {
      const userContext = {
        userId: 'user-123',
        preferences: { theme: 'dark' }
      };
      
      const withUser = new ExecutionContext(null, { userContext });
      const child = withUser.createChild('child');
      
      expect(child.userContext).toEqual(userContext);
    });

    it('should inherit user context', () => {
      const userContext = { userId: 'user-123' };
      const parent = new ExecutionContext(null, { userContext });
      const child = parent.createChild('child');
      const grandchild = child.createChild('grandchild');
      
      expect(grandchild.userContext).toEqual(userContext);
    });
  });
});