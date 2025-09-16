/**
 * Simple integration test for ROMAAgent - New improved implementation
 * Tests basic agent creation and structure
 */

import { describe, it, expect } from '@jest/globals';
import { ROMAAgent } from '../../src/ROMAAgent.js';

describe('ROMAAgent Simple Integration', () => {
  describe('Agent Creation', () => {
    it('should create ROMAAgent with default options', () => {
      const agent = new ROMAAgent();
      
      expect(agent).toBeDefined();
      expect(agent.strategyResolver).toBeDefined();
      expect(agent.dependencyResolver).toBeDefined();
      expect(agent.options.maxConcurrency).toBe(5);
      expect(agent.options.defaultTimeout).toBe(30000);
      expect(agent.isInitialized).toBe(false);
    });

    it('should create ROMAAgent with custom options', () => {
      const options = {
        maxConcurrency: 10,
        defaultTimeout: 60000,
        enableSemanticAnalysis: false,
        maxExecutionDepth: 8
      };
      
      const agent = new ROMAAgent(options);
      
      expect(agent.options.maxConcurrency).toBe(10);
      expect(agent.options.defaultTimeout).toBe(60000);
      expect(agent.options.enableSemanticAnalysis).toBe(false);
      expect(agent.options.maxExecutionDepth).toBe(8);
    });

    it('should have all required methods', () => {
      const agent = new ROMAAgent();
      
      expect(typeof agent.initialize).toBe('function');
      expect(typeof agent.execute).toBe('function');
      expect(typeof agent.getStatistics).toBe('function');
      expect(typeof agent.getExecutionHistory).toBe('function');
      expect(typeof agent.getActiveExecutions).toBe('function');
      expect(typeof agent.cancelExecution).toBe('function');
      expect(typeof agent.clearHistory).toBe('function');
      expect(typeof agent.updateConfiguration).toBe('function');
      expect(typeof agent.shutdown).toBe('function');
    });

    it('should generate unique execution IDs', () => {
      const agent = new ROMAAgent();
      
      const id1 = agent.generateExecutionId();
      const id2 = agent.generateExecutionId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^roma-exec-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^roma-exec-\d+-[a-z0-9]+$/);
    });
  });

  describe('Agent Configuration', () => {
    it('should update configuration correctly', () => {
      const agent = new ROMAAgent({
        maxConcurrency: 3,
        defaultTimeout: 15000
      });
      
      expect(agent.options.maxConcurrency).toBe(3);
      expect(agent.options.defaultTimeout).toBe(15000);
      
      agent.updateConfiguration({
        maxConcurrency: 7,
        enableProgressTracking: false
      });
      
      expect(agent.options.maxConcurrency).toBe(7);
      expect(agent.options.defaultTimeout).toBe(15000); // Unchanged
      expect(agent.options.enableProgressTracking).toBe(false);
    });
  });

  describe('Agent Statistics', () => {
    it('should provide initial statistics', () => {
      const agent = new ROMAAgent();
      
      const stats = agent.getStatistics();
      
      expect(stats.totalExecutions).toBe(0);
      expect(stats.successful).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.totalDuration).toBe(0);
      expect(stats.activeExecutions).toBe(0);
    });

    it('should provide empty execution history initially', () => {
      const agent = new ROMAAgent();
      
      const history = agent.getExecutionHistory();
      
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(0);
    });

    it('should provide empty active executions initially', () => {
      const agent = new ROMAAgent();
      
      const active = agent.getActiveExecutions();
      
      expect(Array.isArray(active)).toBe(true);
      expect(active.length).toBe(0);
    });
  });

  describe('Agent Lifecycle', () => {
    it('should start uninitialized', () => {
      const agent = new ROMAAgent();
      
      expect(agent.isInitialized).toBe(false);
    });

    it('should clear history', () => {
      const agent = new ROMAAgent();
      
      // Add some mock history
      agent.executionHistory.push({
        executionId: 'test-1',
        status: 'completed',
        duration: 1000
      });
      
      expect(agent.executionHistory.length).toBe(1);
      
      agent.clearHistory();
      
      expect(agent.executionHistory.length).toBe(0);
      expect(agent.getExecutionHistory().length).toBe(0);
    });
  });
});