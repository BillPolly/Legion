/**
 * Tests for StepExecutorTool
 * 
 * Tests manual progression execution tool for debugging
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { StepExecutorTool } from '../../tools/StepExecutorTool.js';
import { ExecutionContext } from '../../core/ExecutionContext.js';

describe('StepExecutorTool', () => {
  let tool;
  let mockContext;
  let mockPlan;

  beforeEach(() => {
    tool = new StepExecutorTool();
    
    mockPlan = {
      id: 'test-plan',
      name: 'Test Plan',
      steps: [
        { 
          id: 'step1', 
          title: 'First Step', 
          actions: [{ type: 'mock_action', parameters: { value: 'test1' } }] 
        },
        { 
          id: 'step2', 
          title: 'Second Step', 
          actions: [{ type: 'mock_action', parameters: { value: 'test2' } }] 
        },
        {
          id: 'step3',
          title: 'Step with substeps',
          steps: [
            { id: 'step3.1', title: 'Sub Step 1', actions: [{ type: 'mock_action' }] },
            { id: 'step3.2', title: 'Sub Step 2', actions: [{ type: 'mock_action' }] }
          ]
        }
      ]
    };

    mockContext = new ExecutionContext(mockPlan);
    
    // Mock the global execution context registry
    tool._getExecutionContext = jest.fn(() => mockContext);
    
    // Mock the executor for step execution
    tool._executeSingleStep = jest.fn(async (step) => ({
      success: true,
      stepId: step.id,
      result: `Executed ${step.id}`
    }));
  });

  describe('Constructor and Schema', () => {
    test('should have correct name', () => {
      expect(tool.name).toBe('plan_execute_step');
    });

    test('should have correct description', () => {
      expect(tool.description).toBe('Execute plan step-by-step with manual progression control');
    });

    test('should have correct input schema', () => {
      const schema = tool.inputSchema;
      
      expect(schema.type).toBe('object');
      expect(schema.properties.plan).toBeDefined();
      expect(schema.properties.sessionId).toBeDefined();
      expect(schema.properties.action).toBeDefined();
      expect(schema.properties.options).toBeDefined();
      expect(schema.required).toContain('plan');
      expect(schema.required).toContain('action');
    });

    test('should validate action enum values', () => {
      const schema = tool.inputSchema;
      const actionEnum = schema.properties.action.enum;
      
      expect(actionEnum).toContain('start');
      expect(actionEnum).toContain('next');
      expect(actionEnum).toContain('pause');
      expect(actionEnum).toContain('resume');
      expect(actionEnum).toContain('abort');
    });
  });

  describe('Session Creation and Management', () => {
    test('should create new session on start action', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        action: 'start'
      });
      
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.sessionCreated).toBe(true);
      expect(result.currentStep).toBeDefined();
      expect(result.executionState).toBe('paused');
    });

    test('should resume existing session', async () => {
      // Create session first
      const sessionId = mockContext.createSession();
      mockContext.enterStep(mockPlan.steps[0]);
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'resume'
      });
      
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(sessionId);
      expect(result.sessionCreated).toBe(false);
      expect(result.resumed).toBe(true);
    });

    test('should handle invalid session ID', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        sessionId: 'nonexistent',
        action: 'next'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session not found');
    });

    test('should create session if not provided on start', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        action: 'start'
      });
      
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.sessionCreated).toBe(true);
    });
  });

  describe('Step-by-Step Progression Logic', () => {
    test('should execute first step on start', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        action: 'start'
      });
      
      expect(result.success).toBe(true);
      expect(result.currentStep.id).toBe('step1');
      expect(result.stepExecuted).toBe(true);
      expect(tool._executeSingleStep).toHaveBeenCalledWith(mockPlan.steps[0]);
    });

    test('should advance to next step on next action', async () => {
      const sessionId = mockContext.createSession();
      mockContext.enterStep(mockPlan.steps[0]);
      mockContext.completeStep('step1');
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'next'
      });
      
      expect(result.success).toBe(true);
      expect(result.currentStep.id).toBe('step2');
      expect(result.stepExecuted).toBe(true);
      expect(tool._executeSingleStep).toHaveBeenCalledWith(mockPlan.steps[1]);
    });

    test('should handle completion when all steps done', async () => {
      const sessionId = mockContext.createSession();
      mockContext.completeStep('step1');
      mockContext.completeStep('step2');
      mockContext.completeStep('step3');
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'next'
      });
      
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
      expect(result.currentStep).toBeNull();
      expect(result.stepExecuted).toBe(false);
    });

    test('should handle hierarchical step progression', async () => {
      const sessionId = mockContext.createSession();
      mockContext.completeStep('step1');
      mockContext.completeStep('step2');
      mockContext.enterStep(mockPlan.steps[2]); // step3 with substeps
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'next'
      });
      
      expect(result.success).toBe(true);
      expect(result.currentStep.id).toBe('step3.1');
      expect(result.hierarchicalExecution).toBe(true);
    });
  });

  describe('Pause and Resume Between Steps', () => {
    test('should pause execution on pause action', async () => {
      const sessionId = mockContext.createSession();
      mockContext.enterStep(mockPlan.steps[0]);
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'pause'
      });
      
      expect(result.success).toBe(true);
      expect(result.paused).toBe(true);
      expect(result.executionState).toBe('paused');
      expect(mockContext.isPaused(sessionId)).toBe(true);
    });

    test('should resume execution on resume action', async () => {
      const sessionId = mockContext.createSession();
      mockContext.pauseExecution(sessionId);
      mockContext.enterStep(mockPlan.steps[1]);
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'resume'
      });
      
      expect(result.success).toBe(true);
      expect(result.resumed).toBe(true);
      expect(result.executionState).toBe('running');
      expect(mockContext.isPaused(sessionId)).toBe(false);
    });

    test('should maintain session state during pause', async () => {
      const sessionId = mockContext.createSession();
      mockContext.enterStep(mockPlan.steps[0]);
      mockContext.setVariable('testVar', 'testValue');
      
      // Pause
      await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'pause'
      });
      
      // Check state preserved
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'resume'
      });
      
      expect(result.success).toBe(true);
      expect(result.sessionContext).toBeDefined();
      expect(result.sessionContext.variables).toBeDefined();
    });
  });

  describe('Step Context Inspection', () => {
    test('should provide step context information', async () => {
      const sessionId = mockContext.createSession();
      mockContext.enterStep(mockPlan.steps[0]);
      mockContext.setVariable('stepVar', 'stepValue');
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'next'
      });
      
      expect(result.success).toBe(true);
      expect(result.sessionContext).toBeDefined();
      expect(result.sessionContext.currentPath).toBeDefined();
      expect(result.sessionContext.variables).toBeDefined();
    });

    test('should show execution progress between steps', async () => {
      const sessionId = mockContext.createSession();
      mockContext.completeStep('step1');
      mockContext.enterStep(mockPlan.steps[1]);
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'next'
      });
      
      expect(result.success).toBe(true);
      expect(result.progressInfo).toBeDefined();
      expect(result.progressInfo.completedSteps).toContain('step1');
      expect(result.progressInfo.totalSteps).toBe(3);
      expect(result.progressInfo.currentStepIndex).toBeDefined();
    });

    test('should provide step result information', async () => {
      const sessionId = mockContext.createSession();
      mockContext.setStepResult('step1', { output: 'test result' });
      mockContext.completeStep('step1');
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'next'
      });
      
      expect(result.success).toBe(true);
      expect(result.previousStepResult).toBeDefined();
      expect(result.previousStepResult).toEqual({ output: 'test result' });
    });
  });

  describe('Session Abort and Cleanup', () => {
    test('should abort session on abort action', async () => {
      const sessionId = mockContext.createSession();
      mockContext.enterStep(mockPlan.steps[0]);
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'abort'
      });
      
      expect(result.success).toBe(true);
      expect(result.aborted).toBe(true);
      expect(result.executionState).toBe('aborted');
      expect(mockContext.hasSession(sessionId)).toBe(false);
    });

    test('should clean up session resources on abort', async () => {
      const sessionId = mockContext.createSession();
      mockContext.enterStep(mockPlan.steps[0]);
      mockContext.setVariable('tempVar', 'tempValue');
      
      const initialSessions = mockContext.getActiveSessions().length;
      
      await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'abort'
      });
      
      expect(mockContext.getActiveSessions().length).toBe(initialSessions - 1);
    });
  });

  describe('Options and Configuration', () => {
    test('should respect execution options', async () => {
      const options = {
        emitProgress: true,
        timeout: 5000,
        includeContext: true
      };
      
      const result = await tool.execute({
        plan: mockPlan,
        action: 'start',
        options
      });
      
      expect(result.success).toBe(true);
      expect(result.options).toEqual(options);
      expect(result.sessionContext).toBeDefined();
    });

    test('should handle timeout options', async () => {
      const sessionId = mockContext.createSession();
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'next',
        options: { timeout: 1 } // Very short timeout for testing
      });
      
      expect(result.success).toBe(true);
      expect(result.options.timeout).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle plan validation errors', async () => {
      const invalidPlan = { id: 'invalid' };
      
      const result = await tool.execute({
        plan: invalidPlan,
        action: 'start'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid plan structure');
    });

    test('should handle step execution errors', async () => {
      tool._executeSingleStep = jest.fn(async () => {
        throw new Error('Step execution failed');
      });
      
      const result = await tool.execute({
        plan: mockPlan,
        action: 'start'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Step execution failed');
    });

    test('should handle missing execution context', async () => {
      tool._getExecutionContext = jest.fn(() => null);
      
      const result = await tool.execute({
        plan: mockPlan,
        action: 'start'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No execution context available');
    });

    test('should handle invalid action types', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        action: 'invalid_action'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid action');
    });
  });

  describe('Session Persistence', () => {
    test('should persist session state between operations', async () => {
      // Start session
      const startResult = await tool.execute({
        plan: mockPlan,
        action: 'start'
      });
      
      const sessionId = startResult.sessionId;
      
      // Pause
      await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'pause'
      });
      
      // Resume and check state
      const resumeResult = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'resume'
      });
      
      expect(resumeResult.success).toBe(true);
      expect(resumeResult.sessionId).toBe(sessionId);
      expect(resumeResult.sessionContext).toBeDefined();
    });

    test('should maintain variable state across steps', async () => {
      const sessionId = mockContext.createSession();
      mockContext.setVariable('globalVar', 'globalValue');
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'start'
      });
      
      expect(result.success).toBe(true);
      expect(result.sessionContext.variables.global).toHaveProperty('globalVar', 'globalValue');
    });
  });
});