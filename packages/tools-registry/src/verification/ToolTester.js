/**
 * ToolTester - Automated testing framework for Legion tools
 * 
 * Generates test cases from schemas and executes comprehensive tests
 * Uses @legion/schema for validation
 */

import { createValidator, jsonSchemaToZod } from '@legion/schema';
import { TestCaseSchema, TestResultSchema } from './schemas/index.js';
import { generateTestDataFromSchema } from './utils/TestDataGenerator.js';

export class ToolTester {
  constructor(options = {}) {
    this.options = {
      parallel: options.parallel || false,
      concurrency: options.concurrency || 5,
      timeout: options.timeout || 10000,
      retries: options.retries || 1,
      stopOnFailure: options.stopOnFailure || false,
      verbose: options.verbose || false,
      ...options
    };
    
    // Validators
    this.testCaseValidator = createValidator(TestCaseSchema);
    this.testResultValidator = createValidator(TestResultSchema);
    
    // Test results storage
    this.testResults = new Map();
    this.testSuites = new Map();
  }
  
  /**
   * Generate test cases from tool schema
   * @param {Object} tool - Tool with schemas
   * @returns {Object} Generated test cases categorized by type
   */
  generateTestCases(tool) {
    if (!tool.inputSchema) {
      throw new Error(`Tool ${tool.name} has no input schema`);
    }
    
    const inputValidator = jsonSchemaToZod(tool.inputSchema);
    
    // Generate different types of test data
    const validCases = generateTestDataFromSchema(tool.inputSchema, 'valid');
    const edgeCases = generateTestDataFromSchema(tool.inputSchema, 'edge');
    const invalidCases = generateTestDataFromSchema(tool.inputSchema, 'invalid');
    
    // Include tool's own test cases if provided
    const customCases = tool.testCases || [];
    
    return {
      valid: validCases.map((input, index) => ({
        id: `${tool.name}_valid_${index}`,
        name: `Valid case ${index + 1}`,
        description: `Valid input test for ${tool.name}`,
        type: 'valid',
        toolName: tool.name,
        input,
        shouldFail: false,
        validator: inputValidator,
        timeout: this.options.timeout
      })),
      
      edge: edgeCases.map((input, index) => ({
        id: `${tool.name}_edge_${index}`,
        name: `Edge case ${index + 1}`,
        description: `Edge case test for ${tool.name}`,
        type: 'edge',
        toolName: tool.name,
        input,
        shouldFail: false,
        validator: inputValidator,
        timeout: this.options.timeout
      })),
      
      invalid: invalidCases.map((input, index) => ({
        id: `${tool.name}_invalid_${index}`,
        name: `Invalid case ${index + 1}`,
        description: `Invalid input test for ${tool.name}`,
        type: 'invalid',
        toolName: tool.name,
        input,
        shouldFail: true,
        expectedError: {
          message: 'Validation error expected'
        },
        validator: inputValidator,
        timeout: this.options.timeout
      })),
      
      custom: customCases.map((testCase, index) => ({
        id: `${tool.name}_custom_${index}`,
        name: testCase.name || `Custom case ${index + 1}`,
        description: testCase.description || `Custom test for ${tool.name}`,
        type: 'custom',
        toolName: tool.name,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        shouldFail: testCase.shouldFail || false,
        expectedError: testCase.expectedError,
        validator: inputValidator,
        timeout: testCase.timeout || this.options.timeout
      }))
    };
  }
  
  /**
   * Run test cases for a tool
   * @param {Object} tool - Tool to test
   * @param {Array} testCases - Test cases to run
   * @returns {Array} Test results
   */
  async runTests(tool, testCases) {
    if (!tool.outputSchema) {
      throw new Error(`Tool ${tool.name} has no output schema`);
    }
    
    const outputValidator = createValidator(tool.outputSchema);
    const results = [];
    
    // Run tests in parallel or serial
    if (this.options.parallel) {
      const batches = this.batchTests(testCases, this.options.concurrency);
      
      for (const batch of batches) {
        const batchPromises = batch.map(testCase =>
          this.runSingleTest(tool, testCase, outputValidator)
        );
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Check for stop on failure
        if (this.options.stopOnFailure && batchResults.some(r => !r.success)) {
          break;
        }
      }
    } else {
      // Run tests serially
      for (const testCase of testCases) {
        const result = await this.runSingleTest(tool, testCase, outputValidator);
        results.push(result);
        
        // Check for stop on failure
        if (this.options.stopOnFailure && !result.success) {
          break;
        }
      }
    }
    
    // Store results
    if (tool.name) {
      this.testResults.set(tool.name, results);
    }
    
    return results;
  }
  
  /**
   * Run a single test case
   * @private
   */
  async runSingleTest(tool, testCase, outputValidator) {
    const result = {
      testId: testCase.id,
      testName: testCase.name,
      timestamp: new Date().toISOString(),
      success: false,
      status: 'pending',
      output: null,
      error: null,
      performance: {},
      validationErrors: [],
      retries: 0
    };
    
    let lastError = null;
    let attempts = 0;
    const maxAttempts = testCase.retries !== undefined ? testCase.retries + 1 : this.options.retries + 1;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        // Validate input if validator provided
        if (testCase.validator) {
          try {
            const inputValidation = testCase.validator.safeParse(testCase.input);
            if (!inputValidation.success && !testCase.shouldFail) {
              result.status = 'failed';
              result.validationErrors.push({
                phase: 'input',
                errors: inputValidation.errors
              });
              throw new Error('Input validation failed for valid test case');
            }
          } catch (error) {
            if (!testCase.shouldFail) {
              throw error;
            }
            // Expected to fail validation for invalid cases
          }
        }
        
        // Execute tool with timeout
        const startTime = Date.now();
        const startMemory = process.memoryUsage().heapUsed;
        
        const executionPromise = tool.execute(testCase.input);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Test timeout')), testCase.timeout || this.options.timeout)
        );
        
        const output = await Promise.race([executionPromise, timeoutPromise]);
        
        const executionTime = Date.now() - startTime;
        const memoryUsed = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024;
        
        result.performance = {
          executionTime,
          memoryUsed: Math.round(memoryUsed * 100) / 100
        };
        
        // Tool succeeded but should have failed
        if (testCase.shouldFail) {
          result.status = 'failed';
          result.error = {
            message: 'Test expected to fail but succeeded',
            expected: 'failure',
            actual: 'success'
          };
          result.output = output;
          break;
        }
        
        // Validate output
        const outputValidation = outputValidator.validate(output);
        if (!outputValidation.valid) {
          result.validationErrors.push({
            phase: 'output',
            errors: outputValidation.errors
          });
        }
        
        // Check expected output if provided
        if (testCase.expectedOutput) {
          const matches = this.checkExpectedOutput(output, testCase.expectedOutput);
          if (!matches.success) {
            result.status = 'failed';
            result.error = {
              message: 'Output does not match expected',
              differences: matches.differences
            };
            result.output = output;
            break;
          }
        }
        
        // Success
        result.success = true;
        result.status = 'passed';
        result.output = output;
        result.duration = executionTime;
        break;
        
      } catch (error) {
        lastError = error;
        result.retries = attempts - 1;
        
        if (testCase.shouldFail) {
          // Check if error matches expected
          if (testCase.expectedError) {
            const errorMatches = this.checkExpectedError(error, testCase.expectedError);
            if (errorMatches) {
              result.success = true;
              result.status = 'passed';
              result.error = {
                message: error.message,
                expected: true
              };
              break;
            } else {
              result.status = 'failed';
              result.error = {
                message: error.message,
                expected: testCase.expectedError.message || testCase.expectedError.pattern,
                actual: error.message
              };
            }
          } else {
            // Any error is acceptable for shouldFail without specific expectation
            result.success = true;
            result.status = 'passed';
            result.error = {
              message: error.message,
              expected: true
            };
            break;
          }
        } else {
          // Unexpected error
          result.status = attempts >= maxAttempts ? 'error' : 'retrying';
          result.error = {
            message: error.message,
            stack: this.options.verbose ? error.stack : undefined
          };
        }
        
        // Don't retry if test passed (for shouldFail cases)
        if (result.success) break;
      }
    }
    
    // Final status if still retrying
    if (result.status === 'retrying') {
      result.status = 'error';
      result.error = lastError ? {
        message: lastError.message,
        stack: this.options.verbose ? lastError.stack : undefined
      } : { message: 'Test failed after retries' };
    }
    
    return result;
  }
  
  /**
   * Check if output matches expected output
   * @private
   */
  checkExpectedOutput(actual, expected) {
    const result = {
      success: true,
      differences: []
    };
    
    // Check schema compliance if provided
    if (expected.schema) {
      try {
        const schemaValidator = jsonSchemaToZod(expected.schema);
        schemaValidator.parse(actual);
      } catch (error) {
        result.success = false;
        result.differences.push({
          type: 'schema',
          message: `Output does not match expected schema: ${error.message}`
        });
      }
    }
    
    // Check specific values if provided
    if (expected.values) {
      for (const [key, value] of Object.entries(expected.values)) {
        if (actual[key] !== value) {
          result.success = false;
          result.differences.push({
            type: 'value',
            field: key,
            expected: value,
            actual: actual[key]
          });
        }
      }
    }
    
    // Check constraints if provided
    if (expected.constraints) {
      for (const [field, constraint] of Object.entries(expected.constraints)) {
        if (!this.checkConstraint(actual[field], constraint)) {
          result.success = false;
          result.differences.push({
            type: 'constraint',
            field,
            constraint,
            actual: actual[field]
          });
        }
      }
    }
    
    return result;
  }
  
  /**
   * Check if a value meets a constraint
   * @private
   */
  checkConstraint(value, constraint) {
    if (constraint.min !== undefined && value < constraint.min) return false;
    if (constraint.max !== undefined && value > constraint.max) return false;
    if (constraint.pattern && !new RegExp(constraint.pattern).test(value)) return false;
    if (constraint.includes && !value.includes(constraint.includes)) return false;
    if (constraint.type && typeof value !== constraint.type) return false;
    return true;
  }
  
  /**
   * Check if error matches expected error
   * @private
   */
  checkExpectedError(actual, expected) {
    if (expected.message && actual.message !== expected.message) {
      return false;
    }
    if (expected.pattern && !new RegExp(expected.pattern).test(actual.message)) {
      return false;
    }
    if (expected.code && actual.code !== expected.code) {
      return false;
    }
    return true;
  }
  
  /**
   * Batch tests for parallel execution
   * @private
   */
  batchTests(tests, batchSize) {
    const batches = [];
    for (let i = 0; i < tests.length; i += batchSize) {
      batches.push(tests.slice(i, i + batchSize));
    }
    return batches;
  }
  
  /**
   * Validate test results against expected schema
   * @param {Array} results - Test results to validate
   * @param {Object} expectedSchema - Expected output schema
   * @returns {Array} Results with validation status
   */
  validateResults(results, expectedSchema) {
    const validator = createValidator(expectedSchema);
    
    return results.map(result => ({
      ...result,
      outputValid: result.output ? validator.isValid(result.output) : false,
      outputValidation: result.output ? validator.safeParse(result.output) : null
    }));
  }
  
  /**
   * Generate test report
   * @param {Object} tool - Tool that was tested
   * @param {Array} results - Test results
   * @returns {Object} Test report
   */
  generateTestReport(tool, results) {
    const report = {
      toolName: tool.name,
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        passed: 0,
        failed: 0,
        skipped: 0,
        errors: 0,
        successRate: 0,
        avgExecutionTime: 0,
        avgMemoryUsed: 0
      },
      testsByType: {
        valid: { total: 0, passed: 0, failed: 0 },
        invalid: { total: 0, passed: 0, failed: 0 },
        edge: { total: 0, passed: 0, failed: 0 },
        custom: { total: 0, passed: 0, failed: 0 }
      },
      results: results,
      recommendations: []
    };
    
    // Calculate summary statistics
    let totalExecutionTime = 0;
    let totalMemoryUsed = 0;
    let executionCount = 0;
    
    for (const result of results) {
      // Overall stats
      if (result.status === 'passed') {
        report.summary.passed++;
      } else if (result.status === 'failed') {
        report.summary.failed++;
      } else if (result.status === 'skipped') {
        report.summary.skipped++;
      } else {
        report.summary.errors++;
      }
      
      // Performance stats
      if (result.performance && result.performance.executionTime) {
        totalExecutionTime += result.performance.executionTime;
        totalMemoryUsed += result.performance.memoryUsed || 0;
        executionCount++;
      }
      
      // Stats by type
      const testType = result.testId ? result.testId.split('_')[1] : 'custom';
      if (report.testsByType[testType]) {
        report.testsByType[testType].total++;
        if (result.status === 'passed') {
          report.testsByType[testType].passed++;
        } else {
          report.testsByType[testType].failed++;
        }
      }
    }
    
    // Calculate averages
    if (report.summary.total > 0) {
      report.summary.successRate = (report.summary.passed / report.summary.total) * 100;
    }
    if (executionCount > 0) {
      report.summary.avgExecutionTime = totalExecutionTime / executionCount;
      report.summary.avgMemoryUsed = totalMemoryUsed / executionCount;
    }
    
    // Generate recommendations
    if (report.summary.failed > 0) {
      report.recommendations.push({
        priority: 'high',
        message: `${report.summary.failed} tests failed - review error messages and fix issues`
      });
    }
    
    if (report.summary.errors > 0) {
      report.recommendations.push({
        priority: 'critical',
        message: `${report.summary.errors} tests had errors - check test implementation`
      });
    }
    
    if (report.summary.avgExecutionTime > 1000) {
      report.recommendations.push({
        priority: 'medium',
        message: `Average execution time is ${Math.round(report.summary.avgExecutionTime)}ms - consider optimization`
      });
    }
    
    if (report.testsByType.invalid.failed > 0) {
      report.recommendations.push({
        priority: 'high',
        message: 'Tool is not properly handling invalid inputs'
      });
    }
    
    return report;
  }
  
  /**
   * Test tool integration (chaining)
   * @param {Object} tool1 - First tool in chain
   * @param {Object} tool2 - Second tool in chain
   * @param {Object} testInput - Input for first tool
   * @returns {Object} Integration test result
   */
  async testToolIntegration(tool1, tool2, testInput) {
    const result = {
      success: false,
      tool1Name: tool1.name,
      tool2Name: tool2.name,
      compatible: false,
      errors: [],
      dataFlow: {}
    };
    
    try {
      // Validate that tool1's output schema matches tool2's input schema
      const tool1OutputValidator = createValidator(tool1.outputSchema);
      const tool2InputValidator = createValidator(tool2.inputSchema);
      
      // Execute tool1
      const tool1Output = await tool1.execute(testInput);
      result.dataFlow.tool1Output = tool1Output;
      
      // Validate tool1 output
      const outputValidation = tool1OutputValidator.validate(tool1Output);
      if (!outputValidation.valid) {
        result.errors.push({
          phase: 'tool1-output',
          message: 'Tool1 output does not match its schema',
          errors: outputValidation.errors
        });
      }
      
      // Check if tool1 output is valid input for tool2
      const inputValidation = tool2InputValidator.validate(tool1Output);
      if (!inputValidation.valid) {
        result.compatible = false;
        result.errors.push({
          phase: 'compatibility',
          message: 'Tool1 output is not compatible with Tool2 input',
          errors: inputValidation.errors
        });
        return result;
      }
      
      result.compatible = true;
      
      // Execute tool2 with tool1's output
      const tool2Output = await tool2.execute(tool1Output);
      result.dataFlow.tool2Output = tool2Output;
      
      // Validate tool2 output
      const tool2OutputValidator = createValidator(tool2.outputSchema);
      const tool2OutputValidation = tool2OutputValidator.validate(tool2Output);
      if (!tool2OutputValidation.valid) {
        result.errors.push({
          phase: 'tool2-output',
          message: 'Tool2 output does not match its schema',
          errors: tool2OutputValidation.errors
        });
      }
      
      result.success = result.compatible && result.errors.length === 0;
      
    } catch (error) {
      result.errors.push({
        phase: 'execution',
        message: error.message,
        stack: this.options.verbose ? error.stack : undefined
      });
    }
    
    return result;
  }
  
  /**
   * Create a test suite
   * @param {string} name - Suite name
   * @param {Array} testCases - Test cases
   * @returns {Object} Test suite
   */
  createTestSuite(name, testCases) {
    const suite = {
      name,
      description: `Test suite for ${name}`,
      version: '1.0.0',
      testCases,
      configuration: {
        parallel: this.options.parallel,
        stopOnFailure: this.options.stopOnFailure,
        timeout: this.options.timeout,
        retries: this.options.retries
      },
      metadata: {
        created: new Date().toISOString(),
        totalTests: testCases.length
      }
    };
    
    this.testSuites.set(name, suite);
    return suite;
  }
  
  /**
   * Run a test suite
   * @param {string} suiteName - Suite name
   * @param {Object} tool - Tool to test
   * @returns {Object} Suite execution results
   */
  async runTestSuite(suiteName, tool) {
    const suite = this.testSuites.get(suiteName);
    if (!suite) {
      throw new Error(`Test suite ${suiteName} not found`);
    }
    
    const results = await this.runTests(tool, suite.testCases);
    const report = this.generateTestReport(tool, results);
    
    return {
      suite: suite.name,
      tool: tool.name,
      timestamp: new Date().toISOString(),
      results,
      report
    };
  }
  
  /**
   * Clear test results cache
   */
  clearResults() {
    this.testResults.clear();
    this.testSuites.clear();
  }
  
  /**
   * Get test results for a tool
   * @param {string} toolName - Tool name
   * @returns {Array|null} Test results
   */
  getTestResults(toolName) {
    return this.testResults.get(toolName);
  }
}

export default ToolTester;