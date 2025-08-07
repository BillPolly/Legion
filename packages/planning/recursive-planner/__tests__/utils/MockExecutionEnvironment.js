/**
 * Mock execution environment for testing agents
 */

import { jest } from '@jest/globals';
import { AtomicTool } from '../../src/core/execution/tools/AtomicTool.js';
import { PlanStep } from '../../src/foundation/types/interfaces/interfaces.js';
import { IdGenerator } from '../../src/foundation/utils/generators/IdGenerator.js';

/**
 * Execution event types for logging
 */
export const ExecutionEventType = {
  TOOL_CALL: 'tool_call',
  TOOL_SUCCESS: 'tool_success',
  TOOL_FAILURE: 'tool_failure',
  AGENT_START: 'agent_start',
  AGENT_COMPLETE: 'agent_complete',
  AGENT_FAILURE: 'agent_failure',
  PLANNING: 'planning',
  REFLECTION: 'reflection'
};

/**
 * Execution event structure
 */
export class ExecutionEvent {
  constructor(type, data = {}) {
    this.type = type;
    this.timestamp = Date.now();
    this.id = IdGenerator.generateCorrelationId();
    this.toolName = data.toolName || null;
    this.stepId = data.stepId || null;
    this.agentId = data.agentId || null;
    this.duration = data.duration !== undefined ? data.duration : null;
    this.error = data.error || null;
    this.result = data.result || null;
    this.input = data.input || null;
    this.metadata = data.metadata || {};
  }
}

/**
 * Mock tool that wraps jest mocks with execution logging
 */
export class MockTool extends AtomicTool {
  constructor(name, mockImplementation, executionLog) {
    const description = `Mock tool: ${name}`;
    
    super(name, description, async (input) => {
      const startTime = Date.now();
      const stepId = input?.stepId || IdGenerator.generateStepId('mock');
      
      // Log tool call start
      executionLog.push(new ExecutionEvent(ExecutionEventType.TOOL_CALL, {
        toolName: name,
        stepId: stepId,
        input: input
      }));
      
      try {
        const result = await mockImplementation(input);
        const duration = Date.now() - startTime;
        
        // Log tool success
        executionLog.push(new ExecutionEvent(ExecutionEventType.TOOL_SUCCESS, {
          toolName: name,
          stepId: stepId,
          result: result,
          duration: duration
        }));
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Log tool failure
        executionLog.push(new ExecutionEvent(ExecutionEventType.TOOL_FAILURE, {
          toolName: name,
          stepId: stepId,
          error: error,
          duration: duration
        }));
        
        throw error;
      }
    });
    
    this.mockImplementation = mockImplementation;
  }
}

/**
 * Mock time controller for deterministic testing
 */
export class MockTimeController {
  constructor() {
    this.currentTime = Date.now();
    this.timeouts = [];
    this.intervals = [];
  }
  
  /**
   * Get current mock time
   * @returns {number} Current time
   */
  now() {
    return this.currentTime;
  }
  
  /**
   * Advance time by specified amount
   * @param {number} ms - Milliseconds to advance
   */
  advanceTime(ms) {
    this.currentTime += ms;
    
    // Process any timeouts that should fire
    const expiredTimeouts = this.timeouts.filter(t => t.executeAt <= this.currentTime);
    expiredTimeouts.forEach(timeout => {
      timeout.callback();
      this.timeouts = this.timeouts.filter(t => t.id !== timeout.id);
    });
  }
  
  /**
   * Mock setTimeout
   * @param {Function} callback - Callback function
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Timeout ID
   */
  setTimeout(callback, delay) {
    const id = Math.random();
    this.timeouts.push({
      id,
      callback,
      executeAt: this.currentTime + delay
    });
    return id;
  }
  
  /**
   * Mock clearTimeout
   * @param {number} id - Timeout ID to clear
   */
  clearTimeout(id) {
    this.timeouts = this.timeouts.filter(t => t.id !== id);
  }
}

/**
 * Test result structure
 */
export class TestResult {
  constructor(success = false) {
    this.success = success;
    this.result = null;
    this.error = null;
    this.executionLog = [];
    this.duration = 0;
    this.toolCallCount = 0;
    this.agentId = null;
  }
  
  /**
   * Set successful result
   * @param {any} result - The result
   * @param {Array} executionLog - Execution log
   * @param {number} duration - Execution duration
   * @param {number} toolCallCount - Number of tool calls
   */
  setSuccess(result, executionLog, duration, toolCallCount) {
    this.success = true;
    this.result = result;
    this.executionLog = executionLog;
    this.duration = duration;
    this.toolCallCount = toolCallCount;
  }
  
  /**
   * Set failure result
   * @param {Error} error - The error
   * @param {Array} executionLog - Execution log
   * @param {number} duration - Execution duration
   * @param {number} toolCallCount - Number of tool calls
   */
  setFailure(error, executionLog, duration, toolCallCount) {
    this.success = false;
    this.error = error;
    this.executionLog = executionLog;
    this.duration = duration;
    this.toolCallCount = toolCallCount;
  }
}

/**
 * Test options for agent execution
 */
export class TestOptions {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.maxToolCalls = options.maxToolCalls || 100;
    this.enableTracing = options.enableTracing !== false;
    this.enableLogging = options.enableLogging !== false;
    this.mockTime = options.mockTime || false;
    this.strictValidation = options.strictValidation !== false;
    this.expectedSteps = options.expectedSteps || null;
    this.expectedToolCalls = options.expectedToolCalls || null;
  }
}

/**
 * Main mock execution environment for testing agents
 */
export class MockExecutionEnvironment {
  constructor() {
    this.mockTools = new Map();
    this.executionLog = [];
    this.timeController = new MockTimeController();
    this.mockLLM = null;
    this.resourceUsage = {
      toolCalls: 0,
      llmCalls: 0,
      memoryMB: 0,
      executionTime: 0
    };
  }
  
  /**
   * Register a mock tool
   * @param {string} name - Tool name
   * @param {Function|jest.Mock} implementation - Implementation or mock
   * @param {Object} config - Tool configuration
   */
  registerMockTool(name, implementation, config = {}) {
    const mock = typeof implementation === 'function' 
      ? jest.fn(implementation) 
      : implementation;
    
    const mockTool = new MockTool(name, mock, this.executionLog);
    
    // Apply configuration
    if (config.timeout) mockTool.config.timeout = config.timeout;
    if (config.retries) mockTool.config.retries = config.retries;
    
    this.mockTools.set(name, mockTool);
  }
  
  /**
   * Register a mock LLM provider
   * @param {Object} mockLLM - Mock LLM implementation
   */
  registerMockLLM(mockLLM) {
    this.mockLLM = mockLLM;
  }
  
  /**
   * Create a simple mock LLM that returns JSON responses
   * @param {Array} responses - Array of responses to return in sequence
   * @returns {Object} Mock LLM provider
   */
  createSimpleMockLLM(responses = []) {
    let callCount = 0;
    
    return {
      provider: 'mock',
      model: 'mock-model',
      complete: jest.fn(async (prompt) => {
        const response = responses[callCount] || responses[responses.length - 1] || '{"type": "proceed"}';
        callCount++;
        this.resourceUsage.llmCalls++;
        return response;
      }),
      getTokenUsage: () => ({ input: 100, output: 50, total: 150 }),
      resetTokenUsage: () => {}
    };
  }
  
  /**
   * Run an agent in the mock environment
   * @param {PlanningAgent} agent - Agent to run
   * @param {string} goal - Goal for the agent
   * @param {TestOptions} options - Test options
   * @returns {Promise<TestResult>} Test result
   */
  async runAgent(agent, goal, options = new TestOptions()) {
    // Setup execution context
    const context = {
      testMode: true,
      mockTime: options.mockTime ? this.timeController : null,
      enableTracing: options.enableTracing,
      timeout: options.timeout
    };
    
    // Convert mock tools to array
    const tools = Array.from(this.mockTools.values());
    
    // Set up agent dependencies if LLM is available
    if (this.mockLLM) {
      agent.setDependencies({ llm: this.mockLLM });
    }
    
    // Log agent start
    this.executionLog.push(new ExecutionEvent(ExecutionEventType.AGENT_START, {
      agentId: agent.agentId,
      goal: goal
    }));
    
    const startTime = this.timeController.now();
    const result = new TestResult();
    
    try {
      // Run agent with timeout
      const agentResult = await this._withTimeout(
        agent.run(goal, tools, context),
        options.timeout
      );
      
      const duration = this.timeController.now() - startTime;
      const toolCallCount = this._getToolCallCount();
      
      // Check if the agent actually succeeded or failed internally
      if (agentResult.success) {
        // Log agent success
        this.executionLog.push(new ExecutionEvent(ExecutionEventType.AGENT_COMPLETE, {
          agentId: agent.agentId,
          duration: duration
        }));
        
        result.setSuccess(agentResult, [...this.executionLog], duration, toolCallCount);
      } else {
        // Agent failed internally but didn't throw - treat as failure
        this.executionLog.push(new ExecutionEvent(ExecutionEventType.AGENT_FAILURE, {
          agentId: agent.agentId,
          error: agentResult.error,
          duration: duration
        }));
        
        result.setFailure(agentResult.error, [...this.executionLog], duration, toolCallCount);
      }
      
      // Validate expectations if provided
      if (options.strictValidation) {
        this._validateExecution(result, options);
      }
      
      return result;
      
    } catch (error) {
      const duration = this.timeController.now() - startTime;
      const toolCallCount = this._getToolCallCount();
      
      // Log agent failure
      this.executionLog.push(new ExecutionEvent(ExecutionEventType.AGENT_FAILURE, {
        agentId: agent.agentId,
        error: error,
        duration: duration
      }));
      
      result.setFailure(error, [...this.executionLog], duration, toolCallCount);
      return result;
    }
  }
  
  /**
   * Get execution trace filtered by event types
   * @param {Array<string>} eventTypes - Event types to include
   * @returns {Array<ExecutionEvent>} Filtered execution events
   */
  getExecutionTrace(eventTypes = null) {
    if (!eventTypes) return [...this.executionLog];
    
    return this.executionLog.filter(event => eventTypes.includes(event.type));
  }
  
  /**
   * Get tool call count
   * @returns {number} Total tool calls
   */
  _getToolCallCount() {
    return this.executionLog.filter(e => e.type === ExecutionEventType.TOOL_CALL).length;
  }
  
  /**
   * Assert that a tool was called with specific parameters
   * @param {string} toolName - Tool name
   * @param {any} expectedParams - Expected parameters
   */
  assertToolCalledWith(toolName, expectedParams) {
    const mockTool = this.mockTools.get(toolName);
    if (!mockTool) {
      throw new Error(`Mock tool '${toolName}' not found`);
    }
    
    expect(mockTool.mockImplementation).toHaveBeenCalledWith(
      expect.objectContaining(expectedParams)
    );
  }
  
  /**
   * Assert execution order of tools
   * @param {Array<string>} expectedOrder - Expected order of tool calls
   */
  assertExecutionOrder(expectedOrder) {
    const actualOrder = this.executionLog
      .filter(e => e.type === ExecutionEventType.TOOL_CALL)
      .map(e => e.toolName);
    
    expect(actualOrder).toEqual(expectedOrder);
  }
  
  /**
   * Assert that specific steps were executed
   * @param {Array<string>} expectedSteps - Expected step descriptions or IDs
   */
  assertStepsExecuted(expectedSteps) {
    const executedSteps = this.executionLog
      .filter(e => e.type === ExecutionEventType.TOOL_SUCCESS)
      .map(e => e.stepId);
    
    expectedSteps.forEach(step => {
      expect(executedSteps).toContain(step);
    });
  }
  
  /**
   * Assert resource usage constraints
   * @param {Object} constraints - Resource constraints to check
   */
  assertResourceUsage(constraints) {
    if (constraints.maxToolCalls) {
      expect(this._getToolCallCount()).toBeLessThanOrEqual(constraints.maxToolCalls);
    }
    
    if (constraints.maxLLMCalls) {
      expect(this.resourceUsage.llmCalls).toBeLessThanOrEqual(constraints.maxLLMCalls);
    }
  }
  
  /**
   * Reset the mock environment
   */
  reset() {
    this.executionLog = [];
    this.resourceUsage = {
      toolCalls: 0,
      llmCalls: 0,
      memoryMB: 0,
      executionTime: 0
    };
    
    // Reset all tool mocks
    this.mockTools.forEach(tool => {
      if (jest.isMockFunction(tool.mockImplementation)) {
        tool.mockImplementation.mockClear();
      }
    });
    
    if (this.mockLLM && jest.isMockFunction(this.mockLLM.complete)) {
      this.mockLLM.complete.mockClear();
    }
  }
  
  /**
   * Execute with timeout
   * @param {Promise} promise - Promise to execute
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Promise that resolves or rejects based on timeout
   */
  async _withTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Test timeout after ${timeout}ms`)), timeout);
      })
    ]);
  }
  
  /**
   * Validate execution results against expectations
   * @param {TestResult} result - Test result
   * @param {TestOptions} options - Test options with expectations
   */
  _validateExecution(result, options) {
    if (options.expectedSteps) {
      this.assertStepsExecuted(options.expectedSteps);
    }
    
    if (options.expectedToolCalls) {
      expect(result.toolCallCount).toBe(options.expectedToolCalls);
    }
    
    if (options.maxToolCalls) {
      expect(result.toolCallCount).toBeLessThanOrEqual(options.maxToolCalls);
    }
  }
}

// Export helper functions
export function createMockTool(name, implementation = () => ({})) {
  return jest.fn(implementation);
}

export function createMockAgent(config = {}) {
  const mockAgent = {
    agentId: IdGenerator.generateAgentId('mock'),
    name: config.name || 'MockAgent',
    run: jest.fn(),
    setDependencies: jest.fn(),
    ...config
  };
  
  return mockAgent;
}