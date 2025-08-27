/**
 * TestCaseSchema - JSON Schema definition for test cases
 * 
 * Defines the structure for test cases used in automated testing
 */

export const TestCaseSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Test Case',
  description: 'Schema for tool test cases',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Unique test case identifier'
    },
    name: {
      type: 'string',
      description: 'Test case name',
      minLength: 1
    },
    description: {
      type: 'string',
      description: 'Test purpose and details'
    },
    type: {
      type: 'string',
      description: 'Type of test',
      enum: ['valid', 'invalid', 'edge', 'performance', 'error-handling', 'integration']
    },
    toolName: {
      type: 'string',
      description: 'Target tool name'
    },
    moduleName: {
      type: 'string',
      description: 'Target module name'
    },
    input: {
      type: 'object',
      description: 'Input parameters for test'
    },
    expectedOutput: {
      type: 'object',
      description: 'Expected output structure',
      properties: {
        schema: {
          type: 'object',
          description: 'Expected output schema compliance'
        },
        values: {
          type: 'object',
          description: 'Expected specific values (optional)'
        },
        constraints: {
          type: 'object',
          description: 'Output constraints to validate'
        }
      }
    },
    shouldFail: {
      type: 'boolean',
      description: 'Whether test should fail',
      default: false
    },
    expectedError: {
      type: 'object',
      description: 'Expected error details if shouldFail',
      properties: {
        code: {
          type: 'string'
        },
        message: {
          type: 'string'
        },
        pattern: {
          type: 'string',
          description: 'Regex pattern to match error message'
        }
      }
    },
    performance: {
      type: 'object',
      description: 'Performance requirements',
      properties: {
        maxTime: {
          type: 'number',
          description: 'Maximum execution time in ms'
        },
        maxMemory: {
          type: 'number',
          description: 'Maximum memory usage in MB'
        },
        minThroughput: {
          type: 'number',
          description: 'Minimum operations per second'
        }
      }
    },
    timeout: {
      type: 'number',
      description: 'Test timeout in ms',
      default: 10000
    },
    retries: {
      type: 'number',
      description: 'Number of retries on failure',
      minimum: 0,
      maximum: 3,
      default: 0
    },
    tags: {
      type: 'array',
      description: 'Test tags for filtering',
      items: {
        type: 'string'
      }
    },
    priority: {
      type: 'string',
      description: 'Test priority',
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium'
    },
    skip: {
      type: 'boolean',
      description: 'Skip this test',
      default: false
    },
    skipReason: {
      type: 'string',
      description: 'Reason for skipping'
    }
  },
  required: ['name', 'input'],
  if: {
    properties: { shouldFail: { const: true } }
  },
  then: {
    required: ['expectedError']
  },
  additionalProperties: true
};

export const TestSuiteSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Test Suite',
  description: 'Collection of test cases',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Test suite name'
    },
    description: {
      type: 'string',
      description: 'Test suite description'
    },
    version: {
      type: 'string',
      description: 'Test suite version'
    },
    targetModule: {
      type: 'string',
      description: 'Target module name'
    },
    targetTool: {
      type: 'string',
      description: 'Target tool name'
    },
    setup: {
      type: 'object',
      description: 'Setup configuration for tests'
    },
    teardown: {
      type: 'object',
      description: 'Teardown configuration for tests'
    },
    testCases: {
      type: 'array',
      description: 'Array of test cases',
      items: {
        $ref: '#/definitions/TestCase'
      }
    },
    configuration: {
      type: 'object',
      properties: {
        parallel: {
          type: 'boolean',
          description: 'Run tests in parallel',
          default: false
        },
        stopOnFailure: {
          type: 'boolean',
          description: 'Stop on first failure',
          default: false
        },
        timeout: {
          type: 'number',
          description: 'Global timeout for suite',
          default: 60000
        },
        retries: {
          type: 'number',
          description: 'Global retry count',
          default: 1
        }
      }
    },
    metadata: {
      type: 'object',
      description: 'Additional metadata'
    }
  },
  required: ['name', 'testCases'],
  definitions: {
    TestCase: TestCaseSchema
  }
};

export const TestResultSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Test Result',
  description: 'Test execution result',
  type: 'object',
  properties: {
    testId: {
      type: 'string',
      description: 'Test case identifier'
    },
    testName: {
      type: 'string',
      description: 'Test case name'
    },
    success: {
      type: 'boolean',
      description: 'Whether test passed'
    },
    status: {
      type: 'string',
      enum: ['passed', 'failed', 'skipped', 'error', 'timeout'],
      description: 'Test status'
    },
    output: {
      description: 'Actual output from test'
    },
    error: {
      type: 'object',
      description: 'Error details if failed',
      properties: {
        message: {
          type: 'string'
        },
        stack: {
          type: 'string'
        },
        code: {
          type: 'string'
        }
      }
    },
    performance: {
      type: 'object',
      properties: {
        executionTime: {
          type: 'number',
          description: 'Execution time in ms'
        },
        memoryUsed: {
          type: 'number',
          description: 'Memory used in MB'
        },
        cpuUsage: {
          type: 'number',
          description: 'CPU usage percentage'
        }
      }
    },
    validationErrors: {
      type: 'array',
      description: 'Schema validation errors',
      items: {
        type: 'object',
        properties: {
          path: {
            type: 'string'
          },
          message: {
            type: 'string'
          },
          code: {
            type: 'string'
          }
        }
      }
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'Test execution timestamp'
    },
    duration: {
      type: 'number',
      description: 'Test duration in ms'
    },
    retries: {
      type: 'number',
      description: 'Number of retries used'
    }
  },
  required: ['testName', 'success', 'status', 'timestamp']
};

export default TestCaseSchema;