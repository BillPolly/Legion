/**
 * Unit tests for LevelProcessingState class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LevelProcessingState } from '../../LevelProcessingState.js';
import { SyntheticTool } from '../../SyntheticTool.js';

describe('LevelProcessingState', () => {
  let state;

  beforeEach(() => {
    state = new LevelProcessingState();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(state.currentLevel).toBe(0);
      expect(state.processedNodes).toEqual([]);
      expect(state.pendingNodes).toEqual([]);
      expect(state.syntheticTools).toEqual(new Map());
      expect(state.levelPlans).toEqual({});
      expect(state.errors).toEqual([]);
    });

    it('should accept initial configuration', () => {
      const customState = new LevelProcessingState({
        currentLevel: 2,
        pendingNodes: [{ id: 'node1' }]
      });

      expect(customState.currentLevel).toBe(2);
      expect(customState.pendingNodes).toHaveLength(1);
    });
  });

  describe('node management', () => {
    it('should add nodes to pending', () => {
      const node1 = { id: 'task1', description: 'Task 1', level: 1 };
      const node2 = { id: 'task2', description: 'Task 2', level: 1 };

      state.addPendingNode(node1);
      state.addPendingNode(node2);

      expect(state.pendingNodes).toHaveLength(2);
      expect(state.pendingNodes[0]).toBe(node1);
      expect(state.pendingNodes[1]).toBe(node2);
    });

    it('should move node from pending to processed', () => {
      const node = { id: 'task1', description: 'Task 1' };
      state.addPendingNode(node);

      state.markNodeProcessed('task1');

      expect(state.pendingNodes).toHaveLength(0);
      expect(state.processedNodes).toHaveLength(1);
      expect(state.processedNodes[0]).toBe(node);
    });

    it('should get nodes by level', () => {
      const level1Node = { id: 'l1', level: 1 };
      const level2Node1 = { id: 'l2a', level: 2 };
      const level2Node2 = { id: 'l2b', level: 2 };

      state.addPendingNode(level1Node);
      state.addPendingNode(level2Node1);
      state.addPendingNode(level2Node2);

      const level2Nodes = state.getNodesAtLevel(2);
      expect(level2Nodes).toHaveLength(2);
      expect(level2Nodes).toContain(level2Node1);
      expect(level2Nodes).toContain(level2Node2);
    });

    it('should check if level is complete', () => {
      const node1 = { id: 'n1', level: 1 };
      const node2 = { id: 'n2', level: 1 };

      state.addPendingNode(node1);
      state.addPendingNode(node2);

      expect(state.isLevelComplete(1)).toBe(false);

      state.markNodeProcessed('n1');
      expect(state.isLevelComplete(1)).toBe(false);

      state.markNodeProcessed('n2');
      expect(state.isLevelComplete(1)).toBe(true);
    });
  });

  describe('synthetic tool management', () => {
    it('should register synthetic tools', () => {
      const tool = new SyntheticTool({
        name: 'test_tool',
        description: 'Test tool',
        executionPlan: { type: 'action' }
      });

      state.registerSyntheticTool('task1', tool);

      expect(state.syntheticTools.has('task1')).toBe(true);
      expect(state.syntheticTools.get('task1')).toBe(tool);
    });

    it('should get synthetic tools for level', () => {
      const tool1 = new SyntheticTool({
        name: 'tool1',
        description: 'Tool 1',
        executionPlan: { type: 'action' },
        metadata: { level: 2 }
      });

      const tool2 = new SyntheticTool({
        name: 'tool2', 
        description: 'Tool 2',
        executionPlan: { type: 'action' },
        metadata: { level: 2 }
      });

      const tool3 = new SyntheticTool({
        name: 'tool3',
        description: 'Tool 3',
        executionPlan: { type: 'action' },
        metadata: { level: 1 }
      });

      state.registerSyntheticTool('task1', tool1);
      state.registerSyntheticTool('task2', tool2);
      state.registerSyntheticTool('task3', tool3);

      const level2Tools = state.getSyntheticToolsForLevel(2);
      expect(level2Tools).toHaveLength(2);
      expect(level2Tools).toContain(tool1);
      expect(level2Tools).toContain(tool2);
      expect(level2Tools).not.toContain(tool3);
    });

    it('should get all synthetic tools', () => {
      const tool1 = new SyntheticTool({
        name: 'tool1',
        description: 'Tool 1',
        executionPlan: { type: 'action' }
      });

      const tool2 = new SyntheticTool({
        name: 'tool2',
        description: 'Tool 2',
        executionPlan: { type: 'action' }
      });

      state.registerSyntheticTool('task1', tool1);
      state.registerSyntheticTool('task2', tool2);

      const allTools = state.getAllSyntheticTools();
      expect(allTools).toHaveLength(2);
      expect(allTools).toContain(tool1);
      expect(allTools).toContain(tool2);
    });
  });

  describe('level plan management', () => {
    it('should store level plans', () => {
      const plan1 = { type: 'sequence', children: [] };
      const plan2 = { type: 'action', tool: 'test' };

      state.addLevelPlan(1, 'task1', plan1);
      state.addLevelPlan(1, 'task2', plan2);

      expect(state.levelPlans[1]).toBeDefined();
      expect(state.levelPlans[1]['task1']).toBe(plan1);
      expect(state.levelPlans[1]['task2']).toBe(plan2);
    });

    it('should get plans for level', () => {
      const plan1 = { type: 'sequence' };
      const plan2 = { type: 'action' };

      state.addLevelPlan(1, 'task1', plan1);
      state.addLevelPlan(1, 'task2', plan2);
      state.addLevelPlan(2, 'task3', { type: 'parallel' });

      const level1Plans = state.getPlansForLevel(1);
      expect(Object.keys(level1Plans)).toHaveLength(2);
      expect(level1Plans['task1']).toBe(plan1);
      expect(level1Plans['task2']).toBe(plan2);
    });
  });

  describe('state transitions', () => {
    it('should advance to next level', () => {
      state.currentLevel = 2;
      state.advanceLevel();
      expect(state.currentLevel).toBe(1);
    });

    it('should track if processing is complete', () => {
      const node1 = { id: 'n1', level: 0 };
      const node2 = { id: 'n2', level: 0 };

      state.addPendingNode(node1);
      state.addPendingNode(node2);

      expect(state.isComplete()).toBe(false);

      state.markNodeProcessed('n1');
      state.markNodeProcessed('n2');

      expect(state.isComplete()).toBe(true);
    });

    it('should reset state', () => {
      state.currentLevel = 3;
      state.addPendingNode({ id: 'node1' });
      state.registerSyntheticTool('task1', new SyntheticTool({
        name: 'tool',
        description: 'Tool',
        executionPlan: {}
      }));
      state.addError('Test error');

      state.reset();

      expect(state.currentLevel).toBe(0);
      expect(state.pendingNodes).toEqual([]);
      expect(state.processedNodes).toEqual([]);
      expect(state.syntheticTools.size).toBe(0);
      expect(state.errors).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should track errors', () => {
      state.addError('Error 1');
      state.addError('Error 2');

      expect(state.errors).toHaveLength(2);
      expect(state.errors[0]).toBe('Error 1');
      expect(state.errors[1]).toBe('Error 2');
    });

    it('should check if has errors', () => {
      expect(state.hasErrors()).toBe(false);

      state.addError('Test error');
      expect(state.hasErrors()).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should provide processing statistics', () => {
      const node1 = { id: 'n1', level: 2 };
      const node2 = { id: 'n2', level: 2 };
      const node3 = { id: 'n3', level: 1 };

      state.addPendingNode(node1);
      state.addPendingNode(node2);
      state.addPendingNode(node3);
      state.markNodeProcessed('n1');

      const stats = state.getStatistics();

      expect(stats.totalNodes).toBe(3);
      expect(stats.processedNodes).toBe(1);
      expect(stats.pendingNodes).toBe(2);
      expect(stats.syntheticTools).toBe(0);
      expect(stats.currentLevel).toBe(0);
      expect(stats.errors).toBe(0);
    });
  });
});