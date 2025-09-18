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

    it('should preserve artifacts in child context', () => {
      context.addArtifact('shared_key', {
        type: 'data',
        value: 'value',
        description: 'Shared data for testing',
        purpose: 'Test artifact inheritance',
        timestamp: Date.now()
      });
      const child = context.createChild('child-task');
      
      expect(child.getArtifactValue('shared_key')).toBe('value');
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

    it('should copy artifacts to sibling context', () => {
      const child = context.createChild('child-task');
      child.addArtifact('test_artifact', {
        type: 'data',
        value: 'value',
        description: 'Test data for sibling context',
        purpose: 'Verify artifact copying',
        timestamp: Date.now()
      });
      const sibling = child.createSibling('sibling-task');
      
      expect(sibling.getArtifactValue('test_artifact')).toBe('value');
    });

    it('should preserve artifacts in sibling context', () => {
      const child = context.createChild('child-task');
      child.addArtifact('result_artifact', {
        type: 'data',
        value: { data: 'result' },
        description: 'Result data from child task',
        purpose: 'Store task execution result',
        timestamp: Date.now()
      });
      const sibling = child.createSibling('sibling-task');
      
      expect(sibling.getArtifactValue('result_artifact')).toEqual({ data: 'result' });
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
    it('should add artifacts to context', () => {
      const result = { data: 'test' };
      const contextCopy = context._clone();
      contextCopy.addArtifact('test_result', {
        type: 'data',
        value: result,
        description: 'Test result data',
        purpose: 'Store test execution result',
        timestamp: Date.now()
      });
      
      expect(contextCopy).not.toBe(context);
      expect(contextCopy.getArtifactValue('test_result')).toEqual(result);
      expect(context.listArtifacts().length).toBe(0);
    });

    it('should add artifacts to cloned context', () => {
      const contextCopy = context._clone();
      contextCopy.addArtifact('shared_key', {
        type: 'data',
        value: 'value',
        description: 'Shared state data',
        purpose: 'Store shared configuration',
        timestamp: Date.now()
      });
      
      expect(contextCopy).not.toBe(context);
      expect(contextCopy.getArtifactValue('shared_key')).toBe('value');
      expect(context.getArtifactValue('shared_key')).toBeUndefined();
    });

    it('should add multiple artifacts to context', () => {
      const contextCopy = context._clone();
      
      contextCopy.addArtifact('artifact1', {
        type: 'data',
        value: 'value1',
        description: 'First test artifact',
        purpose: 'Test multiple artifact storage',
        timestamp: Date.now()
      });
      contextCopy.addArtifact('artifact2', {
        type: 'data',
        value: 'value2',
        description: 'Second test artifact',
        purpose: 'Test multiple artifact storage',
        timestamp: Date.now()
      });
      contextCopy.addArtifact('artifact3', {
        type: 'data',
        value: 'value3',
        description: 'Third test artifact',
        purpose: 'Test multiple artifact storage',
        timestamp: Date.now()
      });
      
      expect(contextCopy).not.toBe(context);
      expect(contextCopy.getArtifactValue('artifact1')).toBe('value1');
      expect(contextCopy.getArtifactValue('artifact2')).toBe('value2');
      expect(contextCopy.getArtifactValue('artifact3')).toBe('value3');
    });

    it('should add dependency artifacts to context', () => {
      const dependency = { result: 'dep-result' };
      const contextCopy = context._clone();
      contextCopy.addArtifact('dep-task', {
        type: 'dependency',
        value: dependency,
        description: 'Dependency result from dep-task',
        purpose: 'Store task dependency result',
        timestamp: Date.now()
      });
      
      expect(contextCopy).not.toBe(context);
      expect(contextCopy.getArtifactValue('dep-task')).toBe(dependency);
      expect(context.getArtifact('dep-task')).toBeUndefined();
    });

    it('should create new context with metadata', () => {
      const withMeta = context.withMetadata('author', 'test-user');
      
      expect(withMeta).not.toBe(context);
      expect(withMeta.metadata.author).toBe('test-user');
      expect(context.metadata.author).toBeUndefined();
    });

    it('should preserve other properties during artifact updates', () => {
      const contextCopy = context._clone();
      contextCopy.addArtifact('test_key', {
        type: 'data',
        value: 'value',
        description: 'Test data',
        purpose: 'Test property preservation',
        timestamp: Date.now()
      });
      
      expect(contextCopy.taskId).toBe(context.taskId);
      expect(contextCopy.sessionId).toBe(context.sessionId);
      expect(contextCopy.depth).toBe(context.depth);
      expect(contextCopy.maxDepth).toBe(context.maxDepth);
    });
  });

  describe('Artifact Retrieval', () => {
    it('should get artifact values with fallback', () => {
      context.addArtifact('test_key', {
        type: 'data',
        value: 'value',
        description: 'Test artifact',
        purpose: 'Test artifact retrieval',
        timestamp: Date.now()
      });
      
      expect(context.getArtifactValue('test_key')).toBe('value');
      expect(context.getArtifactValue('missing')).toBeUndefined();
    });

    it('should list all artifacts', () => {
      context.addArtifact('artifact1', {
        type: 'data',
        value: 'value1',
        description: 'First artifact',
        purpose: 'Test artifact listing',
        timestamp: Date.now()
      });
      context.addArtifact('artifact2', {
        type: 'data',
        value: 'value2',
        description: 'Second artifact',
        purpose: 'Test artifact listing',
        timestamp: Date.now()
      });
      
      const allArtifacts = context.listArtifacts();
      expect(allArtifacts.length).toBe(2);
      expect(allArtifacts[0][0]).toBe('artifact1');
      expect(allArtifacts[0][1].value).toBe('value1');
      expect(allArtifacts[1][0]).toBe('artifact2');
      expect(allArtifacts[1][1].value).toBe('value2');
    });

    it('should check and get artifact records', () => {
      const artifactData = { result: 'test' };
      context.addArtifact('task-1-result', {
        type: 'data',
        value: artifactData,
        description: 'Task 1 result data',
        purpose: 'Store execution result',
        timestamp: Date.now()
      });
      
      expect(context.getArtifact('task-1-result')).toBeDefined();
      expect(context.getArtifact('task-2-result')).toBeUndefined();
      expect(context.getArtifactValue('task-1-result')).toBe(artifactData);
      expect(context.getArtifactValue('task-2-result')).toBeUndefined();
    });

    it('should get artifact metadata', () => {
      const timestamp = Date.now();
      context.addArtifact('metadata-test', {
        type: 'data',
        value: { result: 'dep1' },
        description: 'First dependency result',
        purpose: 'Store task dependency',
        timestamp: timestamp,
        metadata: { source: 'task-1' }
      });
      context.addArtifact('metadata-test-2', {
        type: 'data',
        value: { result: 'dep2' },
        description: 'Second dependency result',
        purpose: 'Store task dependency',
        timestamp: timestamp,
        metadata: { source: 'task-2' }
      });
      
      const artifact1 = context.getArtifact('metadata-test');
      const artifact2 = context.getArtifact('metadata-test-2');
      
      expect(artifact1.type).toBe('data');
      expect(artifact1.description).toBe('First dependency result');
      expect(artifact1.metadata.source).toBe('task-1');
      expect(artifact2.type).toBe('data');
      expect(artifact2.description).toBe('Second dependency result');
      expect(artifact2.metadata.source).toBe('task-2');
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
      
      // Add artifacts to parallel contexts
      parallelContexts[0].addArtifact('result1', {
        type: 'data',
        value: { data: 'result1' },
        description: 'Result from task 1',
        purpose: 'Store parallel execution result',
        timestamp: Date.now()
      });
      parallelContexts[1].addArtifact('result2', {
        type: 'data',
        value: { data: 'result2' },
        description: 'Result from task 2',
        purpose: 'Store parallel execution result',
        timestamp: Date.now()
      });
      
      // Add some shared artifacts
      parallelContexts[0].addArtifact('shared_key1', {
        type: 'data',
        value: 'value1',
        description: 'Shared data from task 1',
        purpose: 'Share data across parallel tasks',
        timestamp: Date.now()
      });
      parallelContexts[1].addArtifact('shared_key2', {
        type: 'data',
        value: 'value2',
        description: 'Shared data from task 2',
        purpose: 'Share data across parallel tasks',
        timestamp: Date.now()
      });
      
      // Merge results
      const merged = context.mergeParallelResults(parallelContexts);
      
      expect(merged).not.toBe(context);
      expect(merged.getArtifactValue('result1')).toEqual({ data: 'result1' });
      expect(merged.getArtifactValue('result2')).toEqual({ data: 'result2' });
      expect(merged.getArtifactValue('shared_key1')).toBe('value1');
      expect(merged.getArtifactValue('shared_key2')).toBe('value2');
    });

    it('should handle conflicting artifacts (last write wins)', () => {
      const taskIds = ['task-1', 'task-2'];
      const parallelContexts = context.createParallelContexts(taskIds);
      
      parallelContexts[0].addArtifact('conflict_artifact', {
        type: 'data',
        value: 'value1',
        description: 'Conflicting artifact from task 1',
        purpose: 'Test conflict resolution',
        timestamp: Date.now()
      });
      parallelContexts[1].addArtifact('conflict_artifact', {
        type: 'data',
        value: 'value2',
        description: 'Conflicting artifact from task 2',
        purpose: 'Test conflict resolution',
        timestamp: Date.now()
      });
      
      const merged = context.mergeParallelResults(parallelContexts);
      
      expect(merged.getArtifactValue('conflict_artifact')).toBe('value2');
    });
  });

  describe('Serialization', () => {
    it('should convert to plain object', () => {
      let ctx = context._clone();
      
      ctx.addArtifact('shared_key', {
        type: 'data',
        value: 'value',
        description: 'Shared data artifact',
        purpose: 'Store shared configuration',
        timestamp: Date.now()
      });
      ctx.addArtifact('result_data', {
        type: 'data',
        value: { data: 'result' },
        description: 'Result data artifact',
        purpose: 'Store execution result',
        timestamp: Date.now()
      });
      ctx.addArtifact('dep-1', {
        type: 'dependency',
        value: { dep: 'data' },
        description: 'Dependency artifact',
        purpose: 'Store task dependency',
        timestamp: Date.now()
      });
      ctx = ctx.withMetadata('meta', 'value');
      
      const obj = ctx.toObject();
      
      expect(obj.taskId).toBe('root-task');
      expect(obj.sessionId).toBe('session-123');
      expect(obj.depth).toBe(0);
      expect(obj.artifacts).toBeDefined();
      expect(obj.artifacts['shared_key'].value).toBe('value');
      expect(obj.artifacts['result_data'].value).toEqual({ data: 'result' });
      expect(obj.artifacts['dep-1'].value).toEqual({ dep: 'data' });
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
        artifacts: {
          'shared_key': {
            type: 'data',
            value: 'value',
            description: 'Shared artifact',
            purpose: 'Store shared data',
            timestamp: Date.now()
          },
          'result_data': {
            type: 'data',
            value: { data: 'result' },
            description: 'Result artifact',
            purpose: 'Store execution result',
            timestamp: Date.now()
          },
          'dep-1': {
            type: 'dependency',
            value: { dep: 'data' },
            description: 'Dependency artifact',
            purpose: 'Store task dependency',
            timestamp: Date.now()
          }
        },
        conversationHistory: [],
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
      expect(restored.getArtifactValue('shared_key')).toBe('value');
      expect(restored.getArtifactValue('result_data')).toEqual({ data: 'result' });
      expect(restored.getArtifactValue('dep-1')).toEqual({ dep: 'data' });
      expect(restored.metadata).toEqual(obj.metadata);
      expect(restored.userContext).toEqual(obj.userContext);
      expect(restored.config.maxDepth).toBe(5);
      expect(restored.config.timeout).toBe(10000);
    });

    it('should create lightweight summary', () => {
      const deadline = Date.now() + 1000;
      let ctx = context.withDeadline(deadline);
      
      ctx.addArtifact('artifact1', {
        type: 'data',
        value: 'value1',
        description: 'First artifact',
        purpose: 'Test summary creation',
        timestamp: Date.now()
      });
      ctx.addArtifact('artifact2', {
        type: 'data',
        value: 'value2',
        description: 'Second artifact',
        purpose: 'Test summary creation',
        timestamp: Date.now()
      });
      ctx.addArtifact('result_artifact', {
        type: 'data',
        value: { data: 'result' },
        description: 'Result artifact',
        purpose: 'Store execution result',
        timestamp: Date.now()
      });
      
      const summary = ctx.toSummary();
      
      expect(summary.taskId).toBe('root-task');
      expect(summary.sessionId).toBe('session-123');
      expect(summary.depth).toBe(0);
      expect(summary.path).toBe('');
      expect(summary.elapsed).toBeDefined();
      expect(summary.remaining).toBeGreaterThan(0);
      expect(summary.remaining).toBeLessThanOrEqual(1000);
      expect(summary.artifactCount).toBe(3);
      expect(summary.conversationLength).toBe(0);
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