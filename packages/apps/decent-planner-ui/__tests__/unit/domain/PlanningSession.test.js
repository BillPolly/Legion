/**
 * Unit tests for PlanningSession domain entity
 */

import { PlanningSession } from '../../../src/domain/entities/PlanningSession.js';

describe('PlanningSession Domain Entity', () => {
  describe('Construction and Initialization', () => {
    test('should create valid planning session with goal', () => {
      const session = new PlanningSession('Write Hello World to a file');
      
      expect(session.goal.toString()).toBe('Write Hello World to a file');
      expect(session.mode).toBe('IDLE');
      expect(session.id).toBeDefined();
      expect(session.isComplete()).toBe(false);
    });
    
    test('should throw error for empty goal', () => {
      expect(() => new PlanningSession('')).toThrow();
      expect(() => new PlanningSession('   ')).toThrow();
      expect(() => new PlanningSession(null)).toThrow();
    });
    
    test('should generate unique session IDs', () => {
      const session1 = new PlanningSession('Goal 1');
      const session2 = new PlanningSession('Goal 2');
      
      expect(session1.id).not.toBe(session2.id);
    });
  });
  
  describe('State Transitions', () => {
    let session;
    
    beforeEach(() => {
      session = new PlanningSession('Test goal');
    });
    
    test('should transition from IDLE to INFORMAL', () => {
      expect(session.mode).toBe('IDLE');
      
      session.startInformalPlanning();
      expect(session.mode).toBe('INFORMAL');
    });
    
    test('should transition from INFORMAL to INFORMAL_COMPLETE', () => {
      session.startInformalPlanning();
      
      const result = { hierarchy: { id: 'root' } };
      session.completeInformalPlanning(result);
      
      expect(session.mode).toBe('INFORMAL_COMPLETE');
      expect(session.informalResult).toBe(result);
    });
    
    test('should not allow invalid state transitions', () => {
      // Cannot go directly to formal from idle
      expect(() => session.startFormalPlanning()).toThrow();
      
      // Cannot complete without starting
      expect(() => session.completeInformalPlanning({})).toThrow();
    });
    
    test('should allow tool discovery after informal planning', () => {
      session.startInformalPlanning();
      session.completeInformalPlanning({ hierarchy: {} });
      
      session.startToolDiscovery();
      expect(session.mode).toBe('DISCOVERING_TOOLS');
      
      session.completeToolDiscovery({ tools: [] });
      expect(session.mode).toBe('TOOLS_DISCOVERED');
    });
    
    test('should allow formal planning after informal', () => {
      session.startInformalPlanning();
      session.completeInformalPlanning({ hierarchy: {} });
      
      expect(session.canStartFormalPlanning()).toBe(true);
      
      session.startFormalPlanning();
      expect(session.mode).toBe('FORMAL');
    });
    
    test('should handle cancellation from any state', () => {
      session.startInformalPlanning();
      session.cancel();
      
      expect(session.mode).toBe('CANCELLED');
      expect(session.completedAt).not.toBeNull();
    });
    
    test('should handle errors during planning', () => {
      session.startInformalPlanning();
      
      const error = new Error('Planning failed');
      session.setError(error);
      
      expect(session.mode).toBe('ERROR');
      expect(session.error).toBe(error);
    });
  });
  
  describe('State Queries', () => {
    let session;
    
    beforeEach(() => {
      session = new PlanningSession('Test goal');
    });
    
    test('should correctly report if informal planning is complete', () => {
      expect(session.informalResult).toBe(null);
      
      session.startInformalPlanning();
      expect(session.informalResult).toBe(null);
      
      session.completeInformalPlanning({ hierarchy: {} });
      expect(session.informalResult).not.toBe(null);
    });
    
    test('should correctly report if tools are discovered', () => {
      expect(session.toolDiscoveryResult).toBe(null);
      
      session.startInformalPlanning();
      session.completeInformalPlanning({ hierarchy: {} });
      session.startToolDiscovery();
      
      expect(session.toolDiscoveryResult).toBe(null);
      
      session.completeToolDiscovery({ tools: [] });
      expect(session.toolDiscoveryResult).not.toBe(null);
    });
    
    test('should correctly report if can start formal planning', () => {
      expect(session.canStartFormalPlanning()).toBe(false);
      
      session.startInformalPlanning();
      expect(session.canStartFormalPlanning()).toBe(false);
      
      session.completeInformalPlanning({ hierarchy: {} });
      expect(session.canStartFormalPlanning()).toBe(true);
      
      // Should still be able to start after tool discovery
      session.startToolDiscovery();
      session.completeToolDiscovery({ tools: [] });
      expect(session.canStartFormalPlanning()).toBe(true);
    });
    
    test('should correctly report completion status', () => {
      expect(session.isComplete()).toBe(false);
      
      // Go through full workflow
      session.startInformalPlanning();
      session.completeInformalPlanning({ hierarchy: {} });
      
      expect(session.isComplete()).toBe(false);
      
      session.startFormalPlanning();
      session.completeFormalPlanning({ behaviorTrees: [] });
      
      expect(session.isComplete()).toBe(true);
      expect(session.mode).toBe('COMPLETE');
    });
  });
  
  describe('Data Storage', () => {
    let session;
    
    beforeEach(() => {
      session = new PlanningSession('Test goal');
    });
    
    test('should store informal planning results', () => {
      const result = {
        hierarchy: { id: 'root', name: 'Test' },
        statistics: { totalTasks: 5 }
      };
      
      session.startInformalPlanning();
      session.completeInformalPlanning(result);
      
      expect(session.informalResult).toEqual(result);
    });
    
    test('should store tool discovery results', () => {
      const tools = [
        { name: 'tool1', description: 'Tool 1' },
        { name: 'tool2', description: 'Tool 2' }
      ];
      
      session.startInformalPlanning();
      session.completeInformalPlanning({ hierarchy: {} });
      session.startToolDiscovery();
      session.completeToolDiscovery({ tools });
      
      expect(session.toolDiscoveryResult.tools).toEqual(tools);
    });
    
    test('should store formal planning results', () => {
      const behaviorTrees = [
        { id: 'bt1', type: 'sequence' }
      ];
      
      session.startInformalPlanning();
      session.completeInformalPlanning({ hierarchy: {} });
      session.startFormalPlanning();
      session.completeFormalPlanning({ behaviorTrees });
      
      expect(session.formalResult.behaviorTrees).toEqual(behaviorTrees);
    });
    
    test('should preserve all results through workflow', () => {
      const informalResult = { hierarchy: { id: 'root' } };
      const toolResult = { tools: [{ name: 'tool1' }] };
      const formalResult = { behaviorTrees: [{ id: 'bt1' }] };
      
      session.startInformalPlanning();
      session.completeInformalPlanning(informalResult);
      
      session.startToolDiscovery();
      session.completeToolDiscovery(toolResult);
      
      session.startFormalPlanning();
      session.completeFormalPlanning(formalResult);
      
      expect(session.informalResult).toEqual(informalResult);
      expect(session.toolDiscoveryResult).toEqual(toolResult);
      expect(session.formalResult).toEqual(formalResult);
    });
  });
  
  describe('Session Metadata', () => {
    test('should track creation timestamp', () => {
      const before = Date.now();
      const session = new PlanningSession('Test goal');
      const after = Date.now();
      
      expect(session.startedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(session.startedAt.getTime()).toBeLessThanOrEqual(after);
    });
    
    test('should track completion timestamp', () => {
      const session = new PlanningSession('Test goal');
      expect(session.completedAt).toBeNull();
      
      // Complete planning
      session.startInformalPlanning();
      session.completeInformalPlanning({ hierarchy: {} });
      session.startFormalPlanning();
      session.completeFormalPlanning({ behaviorTrees: [] });
      
      expect(session.completedAt).not.toBeNull();
    });
    
    test('should provide session summary', () => {
      const session = new PlanningSession('Write Hello World');
      
      session.startInformalPlanning();
      session.completeInformalPlanning({ 
        hierarchy: { id: 'root' },
        statistics: { totalTasks: 5 }
      });
      
      // Check properties directly on session
      expect(session.id).toBeDefined();
      expect(session.goal.toString()).toBe('Write Hello World');
      expect(session.mode).toBe('INFORMAL_COMPLETE');
      expect(session.informalResult).not.toBe(null);
      expect(session.toolDiscoveryResult).toBe(null);
      expect(session.formalResult).toBe(null);
    });
  });
});