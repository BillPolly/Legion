/**
 * Tests for ExecutionStatusTool
 * 
 * Tests real-time execution state inspection tool
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ExecutionStatusTool } from '../../tools/ExecutionStatusTool.js';
import { ExecutionContext } from '../../core/ExecutionContext.js';

describe('ExecutionStatusTool', () => {
  let tool;
  let mockContext;
  let mockPlan;

  beforeEach(() => {
    tool = new ExecutionStatusTool();
    
    mockPlan = {
      id: 'test-plan',
      name: 'Test Plan',
      steps: [
        { id: 'step1', title: 'First Step', actions: [{ type: 'mock_action' }] },
        { id: 'step2', title: 'Second Step', actions: [{ type: 'mock_action' }] }
      ]
    };

    mockContext = new ExecutionContext(mockPlan);
    
    // Mock the global execution context registry
    tool._getExecutionContext = jest.fn(() => mockContext);
  });

  describe('Constructor and Schema', () => {
    test('should have correct name', () => {
      expect(tool.name).toBe('plan_status');
    });

    test('should have correct description', () => {
      expect(tool.description).toBe('Inspect execution state and monitor active plan executions');
    });

    test('should have correct input schema', () => {
      const schema = tool.inputSchema;
      
      expect(schema.type).toBe('object');
      expect(schema.properties.sessionId).toBeDefined();
      expect(schema.properties.includeContext).toBeDefined();
      expect(schema.properties.includeResults).toBeDefined();
    });
  });

  describe('Active Session Monitoring', () => {
    test('should report active sessions', async () => {
      const session1 = mockContext.createSession();
      const session2 = mockContext.createSession();
      
      const result = await tool.execute({});
      
      expect(result.success).toBe(true);
      expect(result.activeSessions).toHaveLength(2);
      expect(result.activeSessions).toContain(session1);
      expect(result.activeSessions).toContain(session2);
    });

    test('should report no sessions when none exist', async () => {
      const result = await tool.execute({});
      
      expect(result.success).toBe(true);
      expect(result.activeSessions).toHaveLength(0);
    });

    test('should filter by specific session ID', async () => {
      const session1 = mockContext.createSession();
      const session2 = mockContext.createSession();
      
      const result = await tool.execute({ sessionId: session1 });
      
      expect(result.success).toBe(true);
      expect(result.sessionInfo).toBeDefined();
      expect(result.sessionInfo.id).toBe(session1);
    });
  });

  describe('Execution Context Inspection', () => {
    test('should include context details when requested', async () => {
      const sessionId = mockContext.createSession();
      mockContext.enterStep({ id: 'step1', title: 'Test Step' });
      mockContext.setVariable('testVar', 'testValue');
      
      const result = await tool.execute({ 
        sessionId, 
        includeContext: true 
      });
      
      expect(result.success).toBe(true);
      expect(result.contextDetails).toBeDefined();
      expect(result.contextDetails.currentPath).toBeDefined();
      expect(result.contextDetails.executionStack).toBeDefined();
      expect(result.contextDetails.variables).toBeDefined();
    });

    test('should not include context details by default', async () => {
      const sessionId = mockContext.createSession();
      
      const result = await tool.execute({ sessionId });
      
      expect(result.success).toBe(true);
      expect(result.contextDetails).toBeUndefined();
    });

    test('should capture hierarchical variable state', async () => {
      const sessionId = mockContext.createSession();
      mockContext.setVariable('globalVar', 'globalValue');
      mockContext.enterStep({ id: 'step1' });
      mockContext.setVariable('stepVar', 'stepValue');
      
      const result = await tool.execute({ 
        sessionId, 
        includeContext: true 
      });
      
      expect(result.success).toBe(true);
      expect(result.contextDetails.variables.global).toHaveProperty('globalVar', 'globalValue');
      expect(result.contextDetails.variables.stepScoped).toHaveLength(1);
      expect(result.contextDetails.variables.stepScoped[0].variables).toHaveProperty('stepVar', 'stepValue');
    });
  });

  describe('Progress State Reporting', () => {
    test('should report execution progress', async () => {
      const sessionId = mockContext.createSession();
      mockContext.completeStep('step1');
      mockContext.failStep('step2', new Error('Test error'));
      
      const result = await tool.execute({ sessionId });
      
      expect(result.success).toBe(true);
      expect(result.executionState).toBeDefined();
      expect(result.executionState.completedSteps).toContain('step1');
      expect(result.executionState.failedSteps).toContain('step2');
    });

    test('should include step results when requested', async () => {
      const sessionId = mockContext.createSession();
      mockContext.setStepResult('step1', { output: 'test result' });
      
      const result = await tool.execute({ 
        sessionId, 
        includeResults: true 
      });
      
      expect(result.success).toBe(true);
      expect(result.stepResults).toBeDefined();
      expect(result.stepResults['step1']).toEqual({ output: 'test result' });
    });

    test('should not include step results by default', async () => {
      const sessionId = mockContext.createSession();
      mockContext.setStepResult('step1', { output: 'test result' });
      
      const result = await tool.execute({ sessionId });
      
      expect(result.success).toBe(true);
      expect(result.stepResults).toBeUndefined();
    });
  });

  describe('Execution Stack Visualization', () => {
    test('should show execution stack position', async () => {
      const sessionId = mockContext.createSession();
      mockContext.enterStep({ id: 'step1', title: 'First Step' });
      mockContext.enterStep({ id: 'step1.1', title: 'Sub Step' });
      
      const result = await tool.execute({ 
        sessionId, 
        includeContext: true 
      });
      
      expect(result.success).toBe(true);
      expect(result.contextDetails.executionStack).toHaveLength(2);
      expect(result.contextDetails.currentPath).toEqual(['step1', 'step1.1']);
    });

    test('should show empty stack when at root', async () => {
      const sessionId = mockContext.createSession();
      
      const result = await tool.execute({ 
        sessionId, 
        includeContext: true 
      });
      
      expect(result.success).toBe(true);
      expect(result.contextDetails.executionStack).toHaveLength(0);
      expect(result.contextDetails.currentPath).toEqual([]);
    });
  });

  describe('Session State Information', () => {
    test('should report session pause state', async () => {
      const sessionId = mockContext.createSession();
      mockContext.pauseExecution(sessionId, { reason: 'breakpoint', stepId: 'step1' });
      
      const result = await tool.execute({ sessionId });
      
      expect(result.success).toBe(true);
      expect(result.sessionInfo.isPaused).toBe(true);
      expect(result.sessionInfo.pausePoint).toBeDefined();
      expect(result.sessionInfo.pausePoint.reason).toBe('breakpoint');
    });

    test('should report session breakpoints', async () => {
      const sessionId = mockContext.createSession();
      mockContext.setBreakpoints(sessionId, ['step1', 'step2']);
      
      const result = await tool.execute({ sessionId });
      
      expect(result.success).toBe(true);
      expect(result.sessionInfo.breakpoints).toEqual(['step1', 'step2']);
    });

    test('should report session creation time', async () => {
      const sessionId = mockContext.createSession();
      
      const result = await tool.execute({ sessionId });
      
      expect(result.success).toBe(true);
      expect(result.sessionInfo.createdAt).toBeDefined();
      expect(result.sessionInfo.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid session ID', async () => {
      const result = await tool.execute({ sessionId: 'nonexistent' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session not found');
    });

    test('should handle execution context not available', async () => {
      tool._getExecutionContext = jest.fn(() => null);
      
      const result = await tool.execute({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No execution context available');
    });

    test('should handle sessionId "all" for all sessions', async () => {
      const session1 = mockContext.createSession();
      const session2 = mockContext.createSession();
      
      const result = await tool.execute({ sessionId: 'all' });
      
      expect(result.success).toBe(true);
      expect(result.allSessions).toBeDefined();
      expect(result.allSessions).toHaveLength(2);
    });
  });

  describe('Real-time State Reporting', () => {
    test('should provide timestamp for state inspection', async () => {
      const sessionId = mockContext.createSession();
      
      const result = await tool.execute({ sessionId });
      
      expect(result.success).toBe(true);
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });

    test('should indicate if execution is active', async () => {
      const sessionId = mockContext.createSession();
      mockContext.state.status = 'running';
      
      const result = await tool.execute({ sessionId });
      
      expect(result.success).toBe(true);
      expect(result.executionState.status).toBe('running');
    });
  });
});