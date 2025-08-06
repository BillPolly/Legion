/**
 * Test mocks and utilities for profile-planner
 */

import { jest } from '@jest/globals';

/**
 * Create a mock ResourceManager
 */
export function createMockResourceManager(overrides = {}) {
  const defaultValues = {
    'env.ANTHROPIC_API_KEY': 'test-anthropic-key',
    'moduleLoader': {
      getToolByNameOrAlias: jest.fn(),
      hasToolByNameOrAlias: jest.fn().mockResolvedValue(true),
      getAllToolNames: jest.fn().mockResolvedValue([])
    },
    ...overrides
  };

  return {
    get: jest.fn((key) => {
      if (key in defaultValues) {
        return defaultValues[key];
      }
      throw new Error(`Resource not found: ${key}`);
    }),
    register: jest.fn(),
    has: jest.fn((key) => key in defaultValues)
  };
}

/**
 * Create a mock LLM Client
 */
export function createMockLLMClient() {
  return {
    completeWithStructuredResponse: jest.fn().mockResolvedValue({
      name: 'Test Plan',
      description: 'A test plan',
      steps: [
        {
          id: 'step1',
          name: 'Test Step',
          type: 'implementation',
          dependencies: [],
          actions: [
            {
              type: 'create_js_file',
              parameters: { file_path: 'test.js', content: 'console.log("test");' }
            }
          ]
        }
      ]
    })
  };
}

/**
 * Create a mock module factory
 */
export function createMockModuleFactory() {
  return {
    createModule: jest.fn()
  };
}

/**
 * Valid test profile for testing
 */
export const testProfile = {
  name: 'test-profile',
  toolName: 'test_profile_planner',
  description: 'A test profile for unit testing',
  requiredModules: ['test-module'],
  allowableActions: [
    {
      type: 'test_action',
      inputs: ['input1'],
      outputs: ['output1'],
      description: 'A test action'
    }
  ],
  contextPrompts: [
    'This is a test environment'
  ],
  defaultInputs: ['user_request'],
  defaultOutputs: ['result'],
  maxSteps: 10
};

/**
 * Create a valid plan response for testing
 */
export const mockPlanResponse = {
  name: 'Calculator Implementation Plan',
  description: 'Create and test a calculator function',
  steps: [
    {
      id: 'create-function',
      name: 'Create Calculator Function',
      type: 'implementation',
      dependencies: [],
      actions: [
        {
          type: 'create_js_file',
          parameters: {
            file_path: 'calculator.js',
            content: 'function add(a, b) { return a + b; }\nmodule.exports = { add };'
          }
        }
      ]
    },
    {
      id: 'create-tests',
      name: 'Create Tests',
      type: 'testing',
      dependencies: ['create-function'],
      actions: [
        {
          type: 'create_test_file',
          parameters: {
            test_file_path: 'calculator.test.js',
            function_to_test: 'add'
          }
        }
      ]
    },
    {
      id: 'run-tests',
      name: 'Run Tests',
      type: 'testing',
      dependencies: ['create-tests'],
      actions: [
        {
          type: 'run_npm_test',
          parameters: {}
        }
      ]
    }
  ]
};