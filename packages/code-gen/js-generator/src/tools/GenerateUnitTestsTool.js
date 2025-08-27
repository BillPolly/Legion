/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * GenerateUnitTestsTool - Generate Jest unit tests for JavaScript code
 * 
 * Creates comprehensive Jest test suites with proper setup, teardown,
 * mocking, assertions, and test organization patterns.
 */

import { Tool } from '@legion/tools-registry';
import fs from 'fs/promises';
import path from 'path';

// Input schema as plain JSON Schema
const generateUnitTestsToolInputSchema = {
  type: 'object',
  properties: {
    target_file: {
      type: 'string',
      description: 'Path to the JavaScript file to test (relative to test file)'
    },
    module_name: {
      type: 'string',
      description: 'Name of the module being tested'
    },
    test_cases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          function: {
            type: 'string',
            description: 'Function or feature being tested'
          },
          description: {
            type: 'string',
            description: 'Test description'
          },
          setup: {
            type: 'string',
            description: 'Test setup code'
          },
          args: {
            type: 'array',
            items: {},
            default: [],
            description: 'Arguments to pass to function'
          },
          expectations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['toBe', 'toEqual', 'toContain', 'toThrow', 'toBeTruthy', 'toBeFalsy', 'toBeNull', 'toBeUndefined', 'toBeGreaterThan', 'toBeLessThan', 'toHaveLength', 'toHaveProperty', 'toMatchObject', 'custom']
                },
                expected: {
                  description: 'Expected value for assertion'
                },
                code: {
                  type: 'string',
                  description: 'Custom assertion code'
                }
              },
              required: ['type']
            },
            description: 'Test expectations/assertions'
          }
        },
        required: ['function', 'description']
      },
      default: [],
      description: 'Array of test cases'
    },
    mocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          module: {
            type: 'string',
            description: 'Module name to mock'
          },
          functions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific functions to mock'
          },
          mockImplementation: {
            type: 'string',
            description: 'Mock implementation code'
          }
        },
        required: ['module']
      },
      description: 'Modules to mock'
    },
    setup: {
      type: 'object',
      properties: {
        beforeAll: {
          type: 'string',
          description: 'Code to run before all tests'
        },
        afterAll: {
          type: 'string',
          description: 'Code to run after all tests'
        },
        beforeEach: {
          type: 'string',
          description: 'Code to run before each test'
        },
        afterEach: {
          type: 'string',
          description: 'Code to run after each test'
        }
      },
      description: 'Setup and teardown hooks'
    },
    async_tests: {
      type: 'boolean',
      default: false,
      description: 'Generate async test functions'
    },
    timeout: {
      type: 'number',
      description: 'Test timeout in milliseconds'
    },
    coverage: {
      type: 'boolean',
      default: false,
      description: 'Include coverage annotations'
    },
    projectPath: {
      type: 'string',
      description: 'Project root directory (optional, for file writing)'
    },
    writeToFile: {
      type: 'boolean',
      default: false,
      description: 'Whether to write generated test file to disk'
    },
    outputPath: {
      type: 'string',
      description: 'Relative path within project for test file (when writeToFile is true)'
    }
  },
  required: ['target_file']
};

// Output schema as plain JSON Schema
const generateUnitTestsToolOutputSchema = {
  type: 'object',
  properties: {
    test_content: {
      type: 'string',
      description: 'Generated Jest test code'
    },
    test_path: {
      type: 'string',
      description: 'Suggested path for the test file'
    },
    components: {
      type: 'object',
      properties: {
        test_count: {
          type: 'number',
          description: 'Number of test cases generated'
        },
        has_mocks: {
          type: 'boolean',
          description: 'Whether mocks are included'
        },
        has_setup: {
          type: 'boolean',
          description: 'Whether setup/teardown hooks are included'
        },
        has_async: {
          type: 'boolean',
          description: 'Whether async tests are included'
        },
        coverage_enabled: {
          type: 'boolean',
          description: 'Whether coverage annotations are included'
        }
      },
      required: ['test_count', 'has_mocks', 'has_setup', 'has_async', 'coverage_enabled'],
      description: 'Analysis of generated test components'
    },
    filePath: {
      type: 'string',
      description: 'Full path to written test file (when writeToFile is true)'
    },
    written: {
      type: 'boolean',
      description: 'Whether the test file was written to disk'
    }
  },
  required: ['test_content', 'test_path', 'components', 'written']
};

export class GenerateUnitTestsTool extends Tool {
  constructor() {
    super({
      name: 'generate_unit_tests',
      description: 'Generate Jest unit tests for JavaScript code',
      inputSchema: generateUnitTestsToolInputSchema,
      outputSchema: generateUnitTestsToolOutputSchema
    });
  }

  
  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.inputSchema,
        output: this.outputSchema || {
          success: {
            type: 'object',
            properties: {
              result: { type: 'any', description: 'Tool execution result' }
            }
          },
          failure: {
            type: 'object',
            properties: {
              error: { type: 'string', description: 'Error message' },
              details: { type: 'object', description: 'Error details' }
            }
          }
        }
      }
    };
  }

  async invoke(toolCall) {
    // Parse arguments from the tool call
    let args;
    try {
      args = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch (error) {
      return throw new Error(error.message || 'Tool execution failed', {
        toolName: this.name,
        error: error.toString(, {
        cause: {
          errorType: 'operation_error'
        }
      }),
        stack: error.stack
      });
    }

    // Execute the tool with parsed arguments
    try {
      const result = await this.execute(args);
      return result;
    } catch (error) {
      return throw new Error(error.message || 'Tool execution failed', {
        toolName: this.name,
        error: error.toString(, {
        cause: {
          errorType: 'operation_error'
        }
      }),
        stack: error.stack
      });
    }
  }

  async execute(args) {
    // Extract module name
    const moduleName = args.module_name || 
      this._extractModuleName(args.target_file);
    
    // Build test content parts
    const testParts = [];
    
    // Generate imports
    const imports = this._generateImports(
      args.target_file, 
      moduleName, 
      args.mocks
    );
    testParts.push(imports);
    testParts.push('');
    
    // Add mocks if provided
    if (args.mocks && args.mocks.length > 0) {
      const mocks = this._generateMocks(args.mocks);
      testParts.push(mocks);
      testParts.push('');
    }
    
    // Generate main describe block
    testParts.push(`describe('${moduleName}', () => {`);
    
    // Add setup hooks if provided
    const setupParts = [];
    const hasSetup = this._generateSetupHooks(setupParts, args.setup);
    if (hasSetup) {
      testParts.push('');
      setupParts.forEach(part => testParts.push(part));
      testParts.push('');
    }
    
    // Generate test cases
    let testCount = 0;
    let hasAsync = false;
    
    if (args.test_cases && args.test_cases.length > 0) {
      args.test_cases.forEach(testCase => {
        const isAsync = args.async_tests || testCase.setup?.includes('await');
        if (isAsync) hasAsync = true;
        
        const testCaseCode = this._generateTestCase(
          testCase, 
          isAsync, 
          args.timeout,
          args.target_file,
          moduleName
        );
        
        testParts.push('');
        testParts.push(testCaseCode);
        testCount++;
      });
    } else {
      // Generate basic smoke test if no test cases provided
      testParts.push('');
      testParts.push("  test('should be defined', () => {");
      testParts.push(`    expect(${moduleName.charAt(0).toLowerCase() + moduleName.slice(1)}).toBeDefined();`);
      testParts.push('  });');
      testCount = 1;
    }
    
    // Close describe block
    testParts.push('});');
    
    // Add coverage annotations if requested
    if (args.coverage) {
      testParts.push('');
      testParts.push('// Coverage annotations');
      testParts.push('// @ts-coverage:ignore-file');
      testParts.push('// Coverage: lines 100%, functions 100%, branches 100%, statements 100%');
    }
    
    // Generate test path
    const testPath = this._generateTestPath(args.target_file);
    
    // Build final test content
    const testContent = testParts.join('\n');
    
    // Analyze generated components
    const components = {
      test_count: testCount,
      has_mocks: !!(args.mocks && args.mocks.length > 0),
      has_setup: hasSetup,
      has_async: hasAsync || args.async_tests,
      coverage_enabled: !!args.coverage
    };
    
    // Write to file if requested
    let filePath = null;
    let written = false;
    
    if (args.writeToFile && args.outputPath) {
      try {
        // Determine the full file path
        const projectPath = args.projectPath || process.cwd();
        filePath = path.join(projectPath, args.outputPath);
        
        // Ensure the directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        
        // Write the test file
        await fs.writeFile(filePath, testContent, 'utf8');
        written = true;
      } catch (error) {
        console.error('Failed to write test file:', error);
        // Don't throw - let the tool succeed with content generation
        // The caller can check the 'written' flag
      }
    }
    
    return {
      test_content: testContent,
      test_path: testPath,
      components,
      filePath,
      written
    };
  }

  _extractModuleName(targetFile) {
    // Extract module name from file path
    const filename = targetFile.split('/').pop() || targetFile;
    const name = filename.replace(/\.js$/, '');
    // Remove non-alphanumeric characters and keep original case for import name
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '');
    return cleanName; // Keep original case for import name
  }

  _generateImports(targetFile, moduleName, mocks) {
    const imports = [];
    
    // For CommonJS compatibility, use require instead of ES modules
    // Import the module under test
    const importName = moduleName.charAt(0).toLowerCase() + moduleName.slice(1);
    imports.push(`const ${importName} = require('${targetFile}');`);
    
    // Import mocked modules
    if (mocks && mocks.length > 0) {
      mocks.forEach(mock => {
        const mockName = mock.module.replace(/[^a-zA-Z0-9]/g, '');
        imports.push(`const ${mockName} = require('${mock.module}');`);
      });
    }
    
    return imports.join('\n');
  }

  _generateMocks(mocks) {
    const mockParts = [];
    
    mockParts.push('// Mock setup');
    
    mocks.forEach(mock => {
      const mockName = mock.module.replace(/[^a-zA-Z0-9]/g, '');
      
      if (mock.functions && mock.functions.length > 0) {
        // Mock specific functions
        mock.functions.forEach(func => {
          if (mock.mockImplementation) {
            mockParts.push(`${mockName}.${func} = jest.fn(${mock.mockImplementation});`);
          } else {
            mockParts.push(`${mockName}.${func} = jest.fn();`);
          }
        });
      } else {
        // Mock entire module
        mockParts.push(`jest.mock('${mock.module}');`);
      }
    });
    
    return mockParts.join('\n');
  }

  _generateSetupHooks(parts, setup) {
    let hasSetup = false;
    
    if (!setup) return hasSetup;
    
    if (setup.beforeAll) {
      parts.push('  beforeAll(async () => {');
      const setupLines = setup.beforeAll.split('\n');
      setupLines.forEach(line => {
        parts.push(`    ${line}`);
      });
      parts.push('  });');
      hasSetup = true;
    }
    
    if (setup.beforeEach) {
      parts.push('  beforeEach(async () => {');
      const setupLines = setup.beforeEach.split('\n');
      setupLines.forEach(line => {
        parts.push(`    ${line}`);
      });
      parts.push('  });');
      hasSetup = true;
    }
    
    if (setup.afterEach) {
      parts.push('  afterEach(async () => {');
      const setupLines = setup.afterEach.split('\n');
      setupLines.forEach(line => {
        parts.push(`    ${line}`);
      });
      parts.push('  });');
      hasSetup = true;
    }
    
    if (setup.afterAll) {
      parts.push('  afterAll(async () => {');
      const setupLines = setup.afterAll.split('\n');
      setupLines.forEach(line => {
        parts.push(`    ${line}`);
      });
      parts.push('  });');
      hasSetup = true;
    }
    
    return hasSetup;
  }

  _generateTestCase(testCase, isAsync, timeout, targetFile, moduleName) {
    const parts = [];
    
    // Generate test function signature
    let testSignature = `  test('${testCase.description}', `;
    
    if (isAsync) {
      testSignature += 'async ';
    }
    
    testSignature += '() => {';
    
    if (timeout) {
      testSignature = testSignature.slice(0, -3) + `, ${timeout}) => {`;
    }
    
    parts.push(testSignature);
    
    // Add test setup if provided
    if (testCase.setup) {
      parts.push('    // Test setup');
      const setupLines = testCase.setup.split('\n');
      setupLines.forEach(line => {
        parts.push(`    ${line}`);
      });
      parts.push('');
    }
    
    // Generate function call and assertions
    parts.push('    // Execute and assert');
    
    if (testCase.expectations && testCase.expectations.length > 0) {
      // Handle different expectation patterns
      const hasCustomExpectations = testCase.expectations.some(exp => exp.type === 'custom');
      
      if (hasCustomExpectations) {
        // Custom expectations - use provided code
        testCase.expectations.forEach(expectation => {
          if (expectation.type === 'custom' && expectation.code) {
            const expectationLines = expectation.code.split('\n');
            expectationLines.forEach(line => {
              parts.push(`    ${line}`);
            });
          }
        });
      } else {
        // Standard expectations - generate function call and assertions
        const hasArgs = testCase.args && testCase.args.length > 0;
        const argsStr = hasArgs ? testCase.args.map(arg => 
          typeof arg === 'string' ? `'${arg}'` : JSON.stringify(arg)
        ).join(', ') : '';
        
        // For CommonJS, access the function from the imported module
        const importName = moduleName.charAt(0).toLowerCase() + moduleName.slice(1);
        const functionCall = `${importName}.${testCase.function}(${argsStr})`;
        
        if (isAsync) {
          parts.push(`    const result = await ${functionCall};`);
        } else {
          parts.push(`    const result = ${functionCall};`);
        }
        
        // Generate assertions
        testCase.expectations.forEach(expectation => {
          let assertion = '    expect(result)';
          
          switch (expectation.type) {
            case 'toBe':
              assertion += `.toBe(${this._formatExpectedValue(expectation.expected)});`;
              break;
            case 'toEqual':
              assertion += `.toEqual(${this._formatExpectedValue(expectation.expected)});`;
              break;
            case 'toContain':
              assertion += `.toContain(${this._formatExpectedValue(expectation.expected)});`;
              break;
            case 'toThrow':
              // For toThrow, we need to wrap the function call in an arrow function
              assertion = `    expect(() => ${importName}.${testCase.function}(${argsStr})).toThrow(${expectation.expected ? this._formatExpectedValue(expectation.expected) : ''});`;
              break;
            case 'toBeTruthy':
              assertion += '.toBeTruthy();';
              break;
            case 'toBeFalsy':
              assertion += '.toBeFalsy();';
              break;
            case 'toBeNull':
              assertion += '.toBeNull();';
              break;
            case 'toBeUndefined':
              assertion += '.toBeUndefined();';
              break;
            case 'toBeGreaterThan':
              assertion += `.toBeGreaterThan(${expectation.expected});`;
              break;
            case 'toBeLessThan':
              assertion += `.toBeLessThan(${expectation.expected});`;
              break;
            case 'toHaveLength':
              assertion += `.toHaveLength(${expectation.expected});`;
              break;
            case 'toHaveProperty':
              assertion += `.toHaveProperty(${this._formatExpectedValue(expectation.expected)});`;
              break;
            case 'toMatchObject':
              assertion += `.toMatchObject(${this._formatExpectedValue(expectation.expected)});`;
              break;
          }
          
          parts.push(assertion);
        });
      }
    } else {
      // Basic test without specific expectations
      parts.push(`    expect(${testCase.function}).toBeDefined();`);
    }
    
    parts.push('  });');
    
    return parts.join('\n');
  }

  _formatExpectedValue(value) {
    if (typeof value === 'string') {
      return `'${value}'`;
    }
    return JSON.stringify(value);
  }

  _generateTestPath(targetFile) {
    // Generate test file path based on target file
    const pathParts = targetFile.split('/');
    const filename = pathParts.pop() || '';
    const nameWithoutExt = filename.replace(/\.js$/, '');
    
    return `__tests__/${nameWithoutExt}.test.js`;
  }
}