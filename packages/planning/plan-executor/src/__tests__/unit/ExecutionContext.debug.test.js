/**
 * Tests for ExecutionContext debugging extensions
 * 
 * Tests session management, pause/resume functionality, and breakpoint detection
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ExecutionContext } from '../../core/ExecutionContext.js';

describe('ExecutionContext Debugging Extensions', () => {
  let context;
  let mockPlan;

  beforeEach(() => {
    mockPlan = {
      id: 'test-plan',
      name: 'Test Plan',
      steps: [
        {
          id: 'step1',
          title: 'First Step',
          actions: [
            { type: 'mock_action', parameters: { value: 10 } }
          ]
        },
        {
          id: 'step2',
          title: 'Second Step',
          actions: [
            { type: 'mock_action', parameters: { value: 20 } }
          ]
        }
      ]
    };

    context = new ExecutionContext(mockPlan);
  });

  describe('Session Management', () => {
    test('should create session with unique ID', () => {
      const sessionId = context.createSession();
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    test('should store session state', () => {
      const sessionId = context.createSession();
      
      expect(context.hasSession(sessionId)).toBe(true);
      expect(context.getSessionState(sessionId)).toBeDefined();
    });

    test('should destroy session', () => {
      const sessionId = context.createSession();
      
      context.destroySession(sessionId);
      
      expect(context.hasSession(sessionId)).toBe(false);
      expect(context.getSessionState(sessionId)).toBeNull();
    });

    test('should list active sessions', () => {
      const session1 = context.createSession();
      const session2 = context.createSession();
      
      const sessions = context.getActiveSessions();
      
      expect(sessions).toHaveLength(2);
      expect(sessions).toContain(session1);
      expect(sessions).toContain(session2);
    });
  });

  describe('Pause/Resume Functionality', () => {
    test('should pause execution', () => {
      const sessionId = context.createSession();
      
      context.pauseExecution(sessionId);
      
      expect(context.isPaused(sessionId)).toBe(true);
    });

    test('should resume execution', () => {
      const sessionId = context.createSession();
      
      context.pauseExecution(sessionId);
      context.resumeExecution(sessionId);
      
      expect(context.isPaused(sessionId)).toBe(false);
    });

    test('should store pause point information', () => {
      const sessionId = context.createSession();
      const pausePoint = {
        stepId: 'step1',
        reason: 'manual',
        timestamp: new Date()
      };
      
      context.pauseExecution(sessionId, pausePoint);
      
      const sessionState = context.getSessionState(sessionId);
      expect(sessionState.pausePoint).toEqual(pausePoint);
    });
  });

  describe('Breakpoint Detection and Handling', () => {
    test('should set breakpoints', () => {
      const sessionId = context.createSession();
      const breakpoints = ['step1', 'step2'];
      
      context.setBreakpoints(sessionId, breakpoints);
      
      const sessionState = context.getSessionState(sessionId);
      expect(sessionState.breakpoints).toEqual(breakpoints);
    });

    test('should detect when at breakpoint', () => {
      const sessionId = context.createSession();
      context.setBreakpoints(sessionId, ['step1']);
      
      const isAtBreakpoint = context.isAtBreakpoint(sessionId, 'step1');
      
      expect(isAtBreakpoint).toBe(true);
    });

    test('should not detect when not at breakpoint', () => {
      const sessionId = context.createSession();
      context.setBreakpoints(sessionId, ['step1']);
      
      const isAtBreakpoint = context.isAtBreakpoint(sessionId, 'step2');
      
      expect(isAtBreakpoint).toBe(false);
    });

    test('should add breakpoint to existing set', () => {
      const sessionId = context.createSession();
      context.setBreakpoints(sessionId, ['step1']);
      
      context.addBreakpoint(sessionId, 'step2');
      
      const sessionState = context.getSessionState(sessionId);
      expect(sessionState.breakpoints).toContain('step1');
      expect(sessionState.breakpoints).toContain('step2');
    });

    test('should remove breakpoint', () => {
      const sessionId = context.createSession();
      context.setBreakpoints(sessionId, ['step1', 'step2']);
      
      context.removeBreakpoint(sessionId, 'step1');
      
      const sessionState = context.getSessionState(sessionId);
      expect(sessionState.breakpoints).not.toContain('step1');
      expect(sessionState.breakpoints).toContain('step2');
    });
  });

  describe('Variable State Capture and Inspection', () => {
    test('should capture variable state snapshot', () => {
      context.setVariable('var1', 'value1');
      context.enterStep({ id: 'step1' });
      context.setVariable('var2', 'value2');
      
      const snapshot = context.captureVariableSnapshot();
      
      expect(snapshot.global).toHaveProperty('var1', 'value1');
      expect(snapshot.stepScoped).toHaveLength(1);
      expect(snapshot.stepScoped[0].variables).toHaveProperty('var2', 'value2');
    });

    test('should capture execution stack snapshot', () => {
      context.enterStep({ id: 'step1', title: 'First Step' });
      context.enterStep({ id: 'step2', title: 'Second Step' });
      
      const snapshot = context.captureExecutionSnapshot();
      
      expect(snapshot.executionStack).toHaveLength(2);
      expect(snapshot.executionStack[0].stepId).toBe('step1');
      expect(snapshot.executionStack[1].stepId).toBe('step2');
      expect(snapshot.currentPath).toEqual(['step1', 'step2']);
    });

    test('should inspect variable state at session', () => {
      const sessionId = context.createSession();
      context.setVariable('sessionVar', 'sessionValue');
      
      const inspection = context.inspectSessionVariables(sessionId);
      
      expect(inspection).toBeDefined();
      expect(inspection.global).toHaveProperty('sessionVar', 'sessionValue');
    });
  });

  describe('Session State Persistence', () => {
    test('should persist execution state in session', () => {
      const sessionId = context.createSession();
      context.enterStep({ id: 'step1' });
      context.setVariable('test', 'value');
      
      context.persistSessionState(sessionId);
      
      const sessionState = context.getSessionState(sessionId);
      expect(sessionState.executionSnapshot).toBeDefined();
      expect(sessionState.variableSnapshot).toBeDefined();
    });

    test('should restore execution state from session', () => {
      const sessionId = context.createSession();
      context.enterStep({ id: 'step1' });
      context.setVariable('test', 'value');
      context.persistSessionState(sessionId);
      
      // Clear current state
      context.exitStep();
      context.state.variables.clear();
      
      context.restoreSessionState(sessionId);
      
      expect(context.getCurrentStep()).toBeDefined();
      expect(context.getCurrentStep().id).toBe('step1');
      expect(context.getVariable('test')).toBe('value');
    });
  });
});