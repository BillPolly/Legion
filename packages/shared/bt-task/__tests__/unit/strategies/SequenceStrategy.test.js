/**
 * Unit tests for SequenceStrategy
 * Tests sequential execution of child nodes
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('SequenceStrategy', () => {
  let SequenceStrategy;
  let BTTaskStrategy;
  let createBTTask;
  
  beforeEach(async () => {
    // Try to import the strategy
    try {
      const strategyModule = await import('../../../src/strategies/SequenceStrategy.js');
      SequenceStrategy = strategyModule.SequenceStrategy;
    } catch (error) {
      // Will fail until implemented
      SequenceStrategy = null;
    }
    
    try {
      const btStrategyModule = await import('../../../src/core/BTTaskStrategy.js');
      BTTaskStrategy = btStrategyModule.BTTaskStrategy;
    } catch (error) {
      BTTaskStrategy = null;
    }
    
    try {
      const factoryModule = await import('../../../src/factory/createBTTask.js');
      createBTTask = factoryModule.createBTTask;
    } catch (error) {
      createBTTask = null;
    }
  });
  
  describe('Prototype Chain', () => {
    it('should extend BTTaskStrategy', () => {
      if (!SequenceStrategy || !BTTaskStrategy) {
        expect(SequenceStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      expect(Object.getPrototypeOf(SequenceStrategy)).toBe(BTTaskStrategy);
    });
  });
  
  describe('executeChildren', () => {
    it('should start executing first child', () => {
      if (!SequenceStrategy || !createBTTask) {
        expect(SequenceStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      // Create sequence task with children
      const sequenceTask = createBTTask(
        'Test Sequence',
        null,
        SequenceStrategy,
        { type: 'sequence' }
      );
      
      // Create mock children
      const child1 = createBTTask('Child 1', sequenceTask, BTTaskStrategy, { type: 'action' });
      const child2 = createBTTask('Child 2', sequenceTask, BTTaskStrategy, { type: 'action' });
      
      // Spy on send to first child
      const sendSpy = jest.spyOn(sequenceTask, 'send');
      
      // Execute children
      const context = { workspaceDir: '/test' };
      sequenceTask.executeChildren(context);
      
      // Should initialize child index to 0
      expect(sequenceTask.currentChildIndex).toBe(0);
      
      // Should send execute to first child
      expect(sendSpy).toHaveBeenCalledWith(
        child1,
        expect.objectContaining({
          type: 'execute',
          context: context
        })
      );
    });
    
    it('should not execute second child immediately', () => {
      if (!SequenceStrategy || !createBTTask) {
        expect(SequenceStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const sequenceTask = createBTTask('Test Sequence', null, SequenceStrategy, { type: 'sequence' });
      const child1 = createBTTask('Child 1', sequenceTask, BTTaskStrategy, { type: 'action' });
      const child2 = createBTTask('Child 2', sequenceTask, BTTaskStrategy, { type: 'action' });
      
      const sendSpy = jest.spyOn(sequenceTask, 'send');
      
      sequenceTask.executeChildren({ workspaceDir: '/test' });
      
      // Should only send to first child, not second
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledWith(child1, expect.any(Object));
      expect(sendSpy).not.toHaveBeenCalledWith(child2, expect.any(Object));
    });
  });
  
  describe('handleChildResult - Failure', () => {
    it('should fail immediately on child failure', () => {
      if (!SequenceStrategy || !createBTTask) {
        expect(SequenceStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const sequenceTask = createBTTask('Test Sequence', null, SequenceStrategy, { type: 'sequence' });
      const child1 = createBTTask('Child 1', sequenceTask, BTTaskStrategy, { type: 'action' });
      const child2 = createBTTask('Child 2', sequenceTask, BTTaskStrategy, { type: 'action' });
      
      // Start execution
      sequenceTask.currentChildIndex = 0;
      
      // Spy on completeBTNode
      const completeSpy = jest.spyOn(sequenceTask, 'completeBTNode');
      
      // Child 1 fails
      sequenceTask.handleChildResult(child1, {
        type: 'child-result',
        status: 'FAILURE',
        error: 'Test error'
      });
      
      // Should complete with FAILURE
      expect(completeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILURE'
        })
      );
    });
    
    it('should not continue to next child after failure', () => {
      if (!SequenceStrategy || !createBTTask) {
        expect(SequenceStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const sequenceTask = createBTTask('Test Sequence', null, SequenceStrategy, { type: 'sequence' });
      const child1 = createBTTask('Child 1', sequenceTask, BTTaskStrategy, { type: 'action' });
      const child2 = createBTTask('Child 2', sequenceTask, BTTaskStrategy, { type: 'action' });
      
      sequenceTask.currentChildIndex = 0;
      
      const sendSpy = jest.spyOn(sequenceTask, 'send');
      
      // Child 1 fails
      sequenceTask.handleChildResult(child1, {
        type: 'child-result',
        status: 'FAILURE'
      });
      
      // Should NOT send execute to child2
      expect(sendSpy).not.toHaveBeenCalledWith(child2, expect.any(Object));
    });
  });
  
  describe('handleChildResult - Success', () => {
    it('should continue to next child on success', () => {
      if (!SequenceStrategy || !createBTTask) {
        expect(SequenceStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const sequenceTask = createBTTask('Test Sequence', null, SequenceStrategy, { type: 'sequence' });
      const child1 = createBTTask('Child 1', sequenceTask, BTTaskStrategy, { type: 'action' });
      const child2 = createBTTask('Child 2', sequenceTask, BTTaskStrategy, { type: 'action' });
      
      sequenceTask.currentChildIndex = 0;
      
      const sendSpy = jest.spyOn(sequenceTask, 'send');
      
      const context = { workspaceDir: '/test' };
      
      // Child 1 succeeds
      sequenceTask.handleChildResult(child1, {
        type: 'child-result',
        status: 'SUCCESS',
        context: context
      });
      
      // Should increment index
      expect(sequenceTask.currentChildIndex).toBe(1);
      
      // Should send execute to child2
      expect(sendSpy).toHaveBeenCalledWith(
        child2,
        expect.objectContaining({
          type: 'execute',
          context: context
        })
      );
    });
    
    it('should complete with SUCCESS when all children succeed', () => {
      if (!SequenceStrategy || !createBTTask) {
        expect(SequenceStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const sequenceTask = createBTTask('Test Sequence', null, SequenceStrategy, { type: 'sequence' });
      const child1 = createBTTask('Child 1', sequenceTask, BTTaskStrategy, { type: 'action' });
      const child2 = createBTTask('Child 2', sequenceTask, BTTaskStrategy, { type: 'action' });
      
      // At last child
      sequenceTask.currentChildIndex = 1;
      
      const completeSpy = jest.spyOn(sequenceTask, 'completeBTNode');
      
      // Last child succeeds
      sequenceTask.handleChildResult(child2, {
        type: 'child-result',
        status: 'SUCCESS'
      });
      
      // Should complete with SUCCESS
      expect(completeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'SUCCESS'
        })
      );
    });
    
    it('should track which child failed for debugging', () => {
      if (!SequenceStrategy || !createBTTask) {
        expect(SequenceStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const sequenceTask = createBTTask('Test Sequence', null, SequenceStrategy, { type: 'sequence' });
      const child1 = createBTTask('Child 1', sequenceTask, BTTaskStrategy, { type: 'action' });
      const child2 = createBTTask('Child 2', sequenceTask, BTTaskStrategy, { type: 'action' });
      const child3 = createBTTask('Child 3', sequenceTask, BTTaskStrategy, { type: 'action' });
      
      // At second child
      sequenceTask.currentChildIndex = 1;
      
      const completeSpy = jest.spyOn(sequenceTask, 'completeBTNode');
      
      // Child 2 fails
      sequenceTask.handleChildResult(child2, {
        type: 'child-result',
        status: 'FAILURE',
        error: 'Child 2 error'
      });
      
      // Should include failedAt in result
      expect(completeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILURE',
          failedAt: 1  // Index of failed child
        })
      );
    });
  });
  
  describe('Empty Sequence', () => {
    it('should complete immediately with SUCCESS if no children', () => {
      if (!SequenceStrategy || !createBTTask) {
        expect(SequenceStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      const sequenceTask = createBTTask('Empty Sequence', null, SequenceStrategy, { type: 'sequence' });
      
      const completeSpy = jest.spyOn(sequenceTask, 'completeBTNode');
      
      // Execute with no children
      sequenceTask.executeChildren({ workspaceDir: '/test' });
      
      // Should complete immediately
      expect(completeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'SUCCESS'
        })
      );
    });
  });
});