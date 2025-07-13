/**
 * Test helpers for agent tests
 */

import { ToolResult } from '@jsenvoy/module-loader';

/**
 * Create a mock tool for testing
 */
export function createMockTool(name, identifier, options = {}) {
  return {
    name,
    identifier,
    abilities: options.abilities || [`${name} abilities`],
    instructions: options.instructions || [`Use ${name} for testing`],
    functions: options.functions || [
      {
        name: 'default_function',
        purpose: 'Default test function',
        arguments: ['input'],
        response: 'string'
      }
    ],
    invoke: options.invoke || jest.fn().mockResolvedValue(
      ToolResult.success({ result: 'mock result' })
    ),
    safeInvoke: options.safeInvoke || jest.fn().mockResolvedValue(
      ToolResult.success({ result: 'mock result' })
    ),
    setExecutingAgent: jest.fn()
  };
}

/**
 * Create a mock model configuration
 */
export function createMockModelConfig(overrides = {}) {
  return {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    apiKey: 'test-api-key',
    ...overrides
  };
}

/**
 * Create a mock agent configuration
 */
export function createMockAgentConfig(overrides = {}) {
  return {
    name: 'TestAgent',
    bio: 'A test agent',
    tools: [],
    modelConfig: createMockModelConfig(),
    steps: ['Test step 1', 'Test step 2'],
    ...overrides
  };
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(condition, timeout = 5000, interval = 100) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('Timeout waiting for condition');
}

/**
 * Create a mock LLM response
 */
export function createMockLLMResponse(content, options = {}) {
  return {
    choices: [{
      message: {
        content: typeof content === 'object' ? JSON.stringify(content) : content,
        role: 'assistant'
      },
      finish_reason: options.finish_reason || 'stop',
      index: 0
    }],
    id: options.id || 'test-response-id',
    model: options.model || 'gpt-3.5-turbo',
    usage: options.usage || {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30
    }
  };
}

/**
 * Create a valid agent response object
 */
export function createValidAgentResponse(options = {}) {
  return {
    task_completed: options.task_completed !== undefined ? options.task_completed : true,
    response: options.response || {
      type: 'string',
      message: options.message || 'Test response'
    },
    use_tool: options.use_tool || undefined
  };
}

/**
 * Mock console methods and return spies
 */
export function mockConsole() {
  const logSpy = jest.spyOn(console, 'log').mockImplementation();
  const errorSpy = jest.spyOn(console, 'error').mockImplementation();
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
  
  return {
    log: logSpy,
    error: errorSpy,
    warn: warnSpy,
    restore: () => {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  };
}

/**
 * Create a test environment with common mocks
 */
export function createTestEnvironment() {
  const console = mockConsole();
  const processExit = jest.spyOn(process, 'exit').mockImplementation();
  
  return {
    console,
    processExit,
    cleanup: () => {
      console.restore();
      processExit.mockRestore();
    }
  };
}