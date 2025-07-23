/**
 * Tests for DebugExecutorTool
 * 
 * Tests interactive debugging tool with breakpoint and inspection capabilities
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { DebugExecutorTool } from '../../tools/DebugExecutorTool.js';
import { ExecutionContext } from '../../core/ExecutionContext.js';

describe('DebugExecutorTool', () => {
  let tool;
  let mockContext;
  let mockPlan;

  beforeEach(() => {
    tool = new DebugExecutorTool();
    
    mockPlan = {
      id: 'debug-test-plan',
      name: 'Debug Test Plan',
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
          title: 'Third Step',
          actions: [{ type: 'mock_action', parameters: { value: 'conditional' } }]
        },
        {
          id: 'step4',
          title: 'Step with substeps',
          steps: [
            { id: 'step4.1', title: 'Sub Step 1', actions: [{ type: 'mock_action' }] },
            { id: 'step4.2', title: 'Sub Step 2', actions: [{ type: 'mock_action' }] }
          ]
        }
      ]
    };

    mockContext = new ExecutionContext(mockPlan);
    
    // Mock the global execution context registry
    tool._getExecutionContext = jest.fn(() => mockContext);
    
    // Mock the executor for step execution
    tool._executeSingleStep = jest.fn(async (step) => {
      const result = {
        success: true,
        stepId: step.id,
        result: `Executed ${step.id}`,
        variables: { [`${step.id}_result`]: `result_${step.id}` }
      };
      
      // Add value property for conditional breakpoint testing
      if (step.actions && step.actions[0] && step.actions[0].parameters && step.actions[0].parameters.value) {
        result.value = step.actions[0].parameters.value;
      }
      
      return result;
    });
  });

  describe('Constructor and Schema', () => {
    test('should have correct name', () => {
      expect(tool.name).toBe('plan_debug');
    });

    test('should have correct description', () => {
      expect(tool.description).toBe('Interactive debugging tool with breakpoint and inspection capabilities');
    });

    test('should have correct input schema', () => {
      const schema = tool.inputSchema;
      
      expect(schema.type).toBe('object');
      expect(schema.properties.plan).toBeDefined();
      expect(schema.properties.breakpoints).toBeDefined();
      expect(schema.properties.inspectVariables).toBeDefined();
      expect(schema.properties.traceExecution).toBeDefined();
      expect(schema.required).toContain('plan');
    });

    test('should have breakpoints as array type', () => {
      const schema = tool.inputSchema;
      expect(schema.properties.breakpoints.type).toBe('array');
      expect(schema.properties.breakpoints.items.type).toBe('string');
    });
  });

  describe('Breakpoint Management', () => {
    test('should set breakpoints for execution', async () => {
      const breakpoints = ['step1', 'step3'];
      
      const result = await tool.execute({
        plan: mockPlan,
        breakpoints,
        inspectVariables: true
      });
      
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.breakpoints).toEqual(breakpoints);
      expect(result.pausedAtBreakpoint).toBe(true);
      expect(result.currentBreakpoint).toBe('step1');
    });

    test('should automatically pause at breakpoints', async () => {
      const breakpoints = ['step2'];
      
      const result = await tool.execute({
        plan: mockPlan,
        breakpoints
      });
      
      expect(result.success).toBe(true);
      expect(result.pausedAtBreakpoint).toBe(true);
      expect(result.currentBreakpoint).toBe('step2');
      expect(result.executionTrace).toBeDefined();
      expect(result.executionTrace.stepsExecuted).toContain('step1');
    });

    test('should continue until next breakpoint', async () => {
      const breakpoints = ['step1', 'step3'];
      
      // First execution - should pause at step1
      const result1 = await tool.execute({
        plan: mockPlan,
        breakpoints
      });
      
      expect(result1.currentBreakpoint).toBe('step1');
      
      // Mock continuing from breakpoint
      mockContext.completeStep('step1');
      mockContext.resumeExecution(result1.sessionId);
      
      const result2 = await tool.execute({
        plan: mockPlan,
        sessionId: result1.sessionId,
        action: 'continue'
      });
      
      expect(result2.success).toBe(true);
      expect(result2.currentBreakpoint).toBe('step3');
      expect(result2.executionTrace.stepsExecuted).toContain('step2');
    });

    test('should handle no breakpoints', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        breakpoints: []
      });
      
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
      expect(result.pausedAtBreakpoint).toBe(false);
      expect(result.executionTrace.stepsExecuted).toHaveLength(5);
    });
  });

  describe('Conditional Breakpoints', () => {
    test('should support conditional breakpoints based on step outcomes', async () => {
      const conditionalBreakpoints = [
        {
          stepId: 'step3',
          condition: 'result.value === "conditional"'
        }
      ];
      
      const result = await tool.execute({
        plan: mockPlan,
        conditionalBreakpoints
      });
      
      expect(result.success).toBe(true);
      expect(result.currentBreakpoint).toBe('step3');
      expect(result.breakpointReason).toBe('conditional');
      expect(result.conditionResult).toBe(true);
    });

    test('should support conditional breakpoints based on variable values', async () => {
      const conditionalBreakpoints = [
        {
          stepId: 'step2',
          condition: 'variables.step1_result === "result_step1"'
        }
      ];
      
      const result = await tool.execute({
        plan: mockPlan,
        conditionalBreakpoints,
        inspectVariables: true
      });
      
      expect(result.success).toBe(true);
      expect(result.currentBreakpoint).toBe('step2');
      expect(result.variableInspection).toBeDefined();
      expect(result.variableInspection.step1_result).toBe('result_step1');
    });

    test('should skip conditional breakpoints when condition is false', async () => {
      const conditionalBreakpoints = [
        {
          stepId: 'step2',
          condition: 'variables.nonexistent === "value"'
        }
      ];
      
      const result = await tool.execute({
        plan: mockPlan,
        conditionalBreakpoints
      });
      
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
      expect(result.pausedAtBreakpoint).toBe(false);
    });
  });

  describe('Variable Inspection at Breakpoints', () => {
    test('should provide variable state when inspectVariables is true', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        breakpoints: ['step2'],
        inspectVariables: true
      });
      
      expect(result.success).toBe(true);
      expect(result.variableInspection).toBeDefined();
      expect(result.variableInspection.global).toBeDefined();
      expect(result.variableInspection.stepScoped).toBeDefined();
      expect(result.variableInspection.step1_result).toBe('result_step1');
    });

    test('should not include variable state by default', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        breakpoints: ['step2']
      });
      
      expect(result.success).toBe(true);
      expect(result.variableInspection).toBeUndefined();
    });

    test('should show hierarchical variable scoping', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        breakpoints: ['step4.1'],
        inspectVariables: true
      });
      
      expect(result.success).toBe(true);
      expect(result.variableInspection.stepScoped).toBeDefined();
      expect(result.variableInspection.stepScoped.length).toBeGreaterThan(0);
      expect(result.executionContext.currentPath).toContain('step4.1');
    });

    test('should capture variable changes between breakpoints', async () => {
      const breakpoints = ['step1', 'step2'];
      
      // First breakpoint
      const result1 = await tool.execute({
        plan: mockPlan,
        breakpoints,
        inspectVariables: true
      });
      
      expect(result1.variableInspection.step1_result).toBe('result_step1');
      
      // Continue to next breakpoint
      mockContext.completeStep('step1');
      mockContext.resumeExecution(result1.sessionId);
      
      // Set up session state properly for continue action
      const sessionState = mockContext.getSessionState(result1.sessionId);
      sessionState.breakpoints = ['step1', 'step2'];
      sessionState.conditionalBreakpoints = [];
      sessionState.executionTrace = result1.executionTrace || { stepsExecuted: ['step1'], timing: {} };
      
      const result2 = await tool.execute({
        plan: mockPlan,
        sessionId: result1.sessionId,
        action: 'continue',
        inspectVariables: true
      });
      
      expect(result2.variableInspection.step2_result).toBe('result_step2');
      expect(result2.variableChanges).toBeDefined();
      expect(result2.variableChanges.added).toContain('step2_result');
    });
  });

  describe('Execution Trace Generation', () => {
    test('should provide detailed execution traces when requested', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        breakpoints: ['step3'],
        traceExecution: true
      });
      
      expect(result.success).toBe(true);
      expect(result.executionTrace).toBeDefined();
      expect(result.executionTrace.stepsExecuted).toHaveLength(3);
      expect(result.executionTrace.executionPath).toBeDefined();
      expect(result.executionTrace.timing).toBeDefined();
    });

    test('should not include execution traces by default', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        breakpoints: ['step2']
      });
      
      expect(result.success).toBe(true);
      expect(result.executionTrace.detailed).toBeUndefined();
    });

    test('should include step timing information in traces', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        breakpoints: ['step2'],
        traceExecution: true
      });
      
      expect(result.success).toBe(true);
      expect(result.executionTrace.timing).toBeDefined();
      expect(result.executionTrace.timing.step1).toBeDefined();
      expect(result.executionTrace.timing.step1.duration).toBeGreaterThan(0);
    });

    test('should track hierarchical execution in traces', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        breakpoints: ['step4.2'],
        traceExecution: true
      });
      
      expect(result.success).toBe(true);
      expect(result.executionTrace.hierarchicalPath).toContain('step4');
      expect(result.executionTrace.hierarchicalPath).toContain('step4.1');
      expect(result.executionTrace.stackDepth).toBeGreaterThan(0);
    });
  });

  describe('Interactive Debugging Actions', () => {
    test('should support continue action', async () => {
      const sessionId = mockContext.createSession();
      mockContext.setBreakpoints(sessionId, ['step1', 'step3']);
      
      // Set up session state properly (like the tool would)
      const sessionState = mockContext.getSessionState(sessionId);
      sessionState.breakpoints = ['step1', 'step3'];
      sessionState.conditionalBreakpoints = [];
      sessionState.executionTrace = { stepsExecuted: [], timing: {} };
      
      mockContext.pauseExecution(sessionId, { reason: 'breakpoint', stepId: 'step1' });
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'continue'
      });
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('continue');
      expect(result.resumed).toBe(true);
    });

    test('should support step action for single step execution', async () => {
      const sessionId = mockContext.createSession();
      mockContext.pauseExecution(sessionId, { reason: 'breakpoint', stepId: 'step1' });
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'step'
      });
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('step');
      expect(result.stepExecuted).toBe(true);
      expect(result.nextPausePoint).toBeDefined();
    });

    test('should support inspect action for variable inspection', async () => {
      const sessionId = mockContext.createSession();
      mockContext.setVariable('debugVar', 'debugValue');
      mockContext.pauseExecution(sessionId);
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'inspect'
      });
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('inspect');
      expect(result.variableInspection).toBeDefined();
      expect(result.variableInspection.global.debugVar).toBe('debugValue');
    });

    test('should support abort action', async () => {
      const sessionId = mockContext.createSession();
      mockContext.pauseExecution(sessionId);
      
      const result = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'abort'
      });
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('abort');
      expect(result.aborted).toBe(true);
      expect(mockContext.hasSession(sessionId)).toBe(false);
    });
  });

  describe('Complex Debugging Scenarios', () => {
    test('should handle multiple breakpoints with variable inspection', async () => {
      const breakpoints = ['step1', 'step3', 'step4.1'];
      
      const result = await tool.execute({
        plan: mockPlan,
        breakpoints,
        inspectVariables: true,
        traceExecution: true
      });
      
      expect(result.success).toBe(true);
      expect(result.breakpoints).toEqual(breakpoints);
      expect(result.currentBreakpoint).toBe('step1');
      expect(result.variableInspection).toBeDefined();
      expect(result.executionTrace).toBeDefined();
    });

    test('should maintain debugging session across multiple calls', async () => {
      // Start debugging with breakpoints
      const result1 = await tool.execute({
        plan: mockPlan,
        breakpoints: ['step1', 'step3']
      });
      
      const sessionId = result1.sessionId;
      
      // Continue from first breakpoint
      const result2 = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'continue'
      });
      
      expect(result2.sessionId).toBe(sessionId);
      expect(result2.currentBreakpoint).toBe('step3');
      
      // Inspect variables at second breakpoint
      const result3 = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'inspect'
      });
      
      expect(result3.sessionId).toBe(sessionId);
      expect(result3.variableInspection).toBeDefined();
    });

    test('should handle debugging with no executable steps', async () => {
      const emptyPlan = {
        id: 'empty-plan',
        steps: []
      };
      
      const result = await tool.execute({
        plan: emptyPlan,
        breakpoints: ['nonexistent']
      });
      
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
      expect(result.pausedAtBreakpoint).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid plan structure', async () => {
      const result = await tool.execute({
        plan: { invalid: true },
        breakpoints: ['step1']
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid plan structure');
    });

    test('should handle step execution errors during debugging', async () => {
      tool._executeSingleStep = jest.fn(async () => {
        throw new Error('Step execution failed');
      });
      
      const result = await tool.execute({
        plan: mockPlan,
        breakpoints: []
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Step execution failed');
    });

    test('should handle invalid session ID', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        sessionId: 'nonexistent',
        action: 'continue'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session not found');
    });

    test('should handle missing execution context', async () => {
      tool._getExecutionContext = jest.fn(() => null);
      
      const result = await tool.execute({
        plan: mockPlan,
        breakpoints: ['step1']
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No execution context available');
    });

    test('should handle invalid breakpoint references', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        breakpoints: ['nonexistent_step']
      });
      
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
      expect(result.warnings).toContain('Breakpoint nonexistent_step not found in plan');
    });
  });

  describe('Session State and Persistence', () => {
    test('should persist debugging state across breakpoints', async () => {
      const result1 = await tool.execute({
        plan: mockPlan,
        breakpoints: ['step1', 'step3'],
        inspectVariables: true
      });
      
      const sessionId = result1.sessionId;
      
      // Verify session state is maintained
      expect(mockContext.hasSession(sessionId)).toBe(true);
      expect(mockContext.getSessionState(sessionId).breakpoints).toEqual(['step1', 'step3']);
      
      const result2 = await tool.execute({
        plan: mockPlan,
        sessionId,
        action: 'continue'
      });
      
      expect(result2.sessionState).toBeDefined();
      expect(result2.sessionState.persistedVariables).toBeDefined();
    });

    test('should clean up debugging session on completion', async () => {
      const result = await tool.execute({
        plan: mockPlan,
        breakpoints: []
      });
      
      expect(result.success).toBe(true);
      expect(result.completed).toBe(true);
      expect(result.sessionCleanedUp).toBe(true);
    });
  });
});