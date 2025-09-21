/**
 * TestJavaScriptFunctionStrategy - Specialized strategy for testing pure JavaScript functions
 * 
 * This is a true SOP (Standard Operating Procedure) for testing individual JavaScript functions.
 * It knows exactly how to create comprehensive unit tests for functions, including edge cases,
 * type validation, error conditions, and performance testing.
 * 
 * This strategy uses data-driven prompt definitions for all LLM interactions.
 */

import { TaskStrategy } from '@legion/tasks';
import PromptFactory from '../../utils/PromptFactory.js';
import path from 'path';

export default class TestJavaScriptFunctionStrategy extends TaskStrategy {
  constructor(llmClient = null, toolRegistry = null, options = {}) {
    super();
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.currentTask = null;
    
    // Configurable project root directory
    this.projectRoot = options.projectRoot || process.env.PROJECT_ROOT || '/tmp';
    
    // Pre-instantiated tools (loaded during initialization)
    this.tools = {
      fileWrite: null,
      directoryCreate: null
    };
    
    // JavaScript function testing configuration
    this.testConfig = {
      testFramework: 'jest',
      includeTypeTests: true,
      includeEdgeCases: true,
      includePerformanceTests: false,
      includeMutationTests: false,
      testCoverage: true,
      asyncSupport: true
    };
    
    // Prompt objects (instantiated during initialization)
    this.prompts = {};
    
    // Data-driven prompt definitions
    this.promptDefinitions = this._getPromptDefinitions();
  }
  
  getName() {
    return 'TestJavaScriptFunction';
  }
  
  /**
   * Handle messages from parent task
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        this.currentTask = parentTask;
        return await this._handleJavaScriptFunctionTesting(parentTask);
        
      case 'abort':
        console.log(`🛑 TestJavaScriptFunctionStrategy received abort`);
        return { acknowledged: true, aborted: true };
        
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle messages from child tasks (not applicable)
   */
  async onChildMessage(childTask, message) {
    return { acknowledged: false, error: 'TestJavaScriptFunctionStrategy does not handle child messages' };
  }
  
  /**
   * Main JavaScript function testing handler
   * @private
   */
  async _handleJavaScriptFunctionTesting(task) {
    try {
      console.log(`🔬 TestJavaScriptFunctionStrategy creating tests for JavaScript functions: ${task.description}`);
      
      // Initialize components
      await this._initializeComponents(task);
      
      // Analyze the functions to determine test requirements
      const functionTestSpec = await this._analyzeFunctionTestRequirements(task);
      task.addConversationEntry('system', `JavaScript function test specification: ${JSON.stringify(functionTestSpec, null, 2)}`);
      
      // Create comprehensive test suite for the JavaScript functions
      const result = await this._createJavaScriptFunctionTests(task, functionTestSpec);
      
      if (result.success) {
        task.complete(result);
        return result;
      } else {
        task.fail(new Error(result.error || 'JavaScript function test creation failed'));
        return result;
      }
      
    } catch (error) {
      console.error(`❌ TestJavaScriptFunctionStrategy error:`, error);
      task.fail(error);
      return {
        success: false,
        error: error.message,
        artifacts: Object.values(task.getAllArtifacts())
      };
    }
  }
  
  /**
   * Initialize strategy components
   * @private
   */
  async _initializeComponents(task) {
    const context = this._getContextFromTask(task);
    
    this.llmClient = this.llmClient || context.llmClient;
    this.toolRegistry = this.toolRegistry || context.toolRegistry;
    
    if (!this.llmClient) {
      throw new Error('LLM client is required for TestJavaScriptFunctionStrategy');
    }
    
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required for TestJavaScriptFunctionStrategy');
    }
    
    // Load required tools
    await this._loadRequiredTools();
    
    // Create prompt objects from data definitions
    this.prompts = PromptFactory.createPrompts(this.promptDefinitions, this.llmClient);
  }
  
  /**
   * Load required tools
   * @private
   */
  async _loadRequiredTools() {
    try {
      this.tools.fileWrite = await this.toolRegistry.getTool('file_write');
      this.tools.directoryCreate = await this.toolRegistry.getTool('directory_create');
      
      if (!this.tools.fileWrite || !this.tools.directoryCreate) {
        throw new Error('Required tools (file_write, directory_create) are not available');
      }
      
      console.log('🔬 TestJavaScriptFunctionStrategy tools loaded successfully');
      
    } catch (error) {
      throw new Error(`Failed to load required tools: ${error.message}`);
    }
  }
  
  /**
   * Analyze function test requirements from task description and artifacts
   * @private
   */
  async _analyzeFunctionTestRequirements(task) {
    try {
      const result = await PromptFactory.executePrompt(
        this.prompts.analyzeFunctionTestRequirements,
        {
          taskDescription: task.description,
          artifacts: task.getArtifactsContext()
        }
      );
      
      return result;
    } catch (error) {
      console.log(`⚠️ Function test requirements analysis failed, using defaults: ${error.message}`);
      return this._getDefaultFunctionTestSpec();
    }
  }
  
  /**
   * Get default function test specification
   * @private
   */
  _getDefaultFunctionTestSpec() {
    return {
      functions: [
        {
          name: 'testFunction',
          description: 'A function to test',
          parameters: [
            {
              name: 'input',
              type: 'any',
              required: true,
              description: 'Input parameter',
              defaultValue: null
            }
          ],
          returnType: 'any',
          returnDescription: 'Function result',
          isAsync: false,
          isPure: true,
          sideEffects: [],
          complexity: 'simple',
          testScenarios: [
            {
              name: 'basic functionality',
              type: 'happy-path',
              description: 'Test basic function behavior',
              inputs: ['test'],
              expectedOutput: 'result',
              shouldThrow: false,
              errorType: null
            }
          ]
        }
      ],
      testEnvironment: {
        framework: 'jest',
        browser: false,
        node: true,
        requiresMocks: false,
        externalDependencies: []
      },
      testTypes: {
        unit: true,
        integration: false,
        property: false,
        performance: false,
        mutation: false
      },
      coverageTargets: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    };
  }
  
  /**
   * Create comprehensive test suite for JavaScript functions
   * @private
   */
  async _createJavaScriptFunctionTests(task, functionTestSpec) {
    console.log(`🏗️ Creating JavaScript function test suite for ${functionTestSpec.functions.length} functions`);
    
    try {
      // Setup test directory
      const outputDir = await this._setupTestDirectory(task, functionTestSpec);
      
      // Create test directory structure
      await this._createTestDirectoryStructure(outputDir);
      
      // Generate all test files
      const generatedTests = {};
      
      // 1. Test setup and configuration files
      const setupFiles = await this._generateTestSetup(functionTestSpec);
      for (const [filename, content] of Object.entries(setupFiles)) {
        await this.tools.fileWrite.execute({
          filepath: path.join(outputDir, filename),
          content: content
        });
        generatedTests[filename] = content;
      }
      
      // 2. Individual function test files
      for (const functionSpec of functionTestSpec.functions) {
        const testContent = await this._generateFunctionTestFile(functionSpec, functionTestSpec);
        const testFilename = `${functionSpec.name}.test.js`;
        await this.tools.fileWrite.execute({
          filepath: path.join(outputDir, 'tests', testFilename),
          content: testContent
        });
        generatedTests[`tests/${testFilename}`] = testContent;
      }
      
      // 3. Property-based tests (if enabled)
      if (functionTestSpec.testTypes.property) {
        const propertyTests = await this._generatePropertyTests(functionTestSpec);
        for (const [filename, content] of Object.entries(propertyTests)) {
          const testPath = path.join(outputDir, 'tests', 'property', filename);
          await this.tools.fileWrite.execute({ filepath: testPath, content });
          generatedTests[`tests/property/${filename}`] = content;
        }
      }
      
      // 4. Performance tests (if enabled)
      if (functionTestSpec.testTypes.performance) {
        const performanceTests = await this._generatePerformanceTests(functionTestSpec);
        for (const [filename, content] of Object.entries(performanceTests)) {
          const testPath = path.join(outputDir, 'tests', 'performance', filename);
          await this.tools.fileWrite.execute({ filepath: testPath, content });
          generatedTests[`tests/performance/${filename}`] = content;
        }
      }
      
      // 5. Test utilities and helpers
      const testUtilities = await this._generateTestUtilities(functionTestSpec);
      for (const [filename, content] of Object.entries(testUtilities)) {
        const utilPath = path.join(outputDir, 'tests', 'utils', filename);
        await this.tools.fileWrite.execute({ filepath: utilPath, content });
        generatedTests[`tests/utils/${filename}`] = content;
      }
      
      // 6. Mock data and fixtures
      if (functionTestSpec.testEnvironment.requiresMocks) {
        const mockData = await this._generateMockData(functionTestSpec);
        for (const [filename, content] of Object.entries(mockData)) {
          const mockPath = path.join(outputDir, 'tests', 'mocks', filename);
          await this.tools.fileWrite.execute({ filepath: mockPath, content });
          generatedTests[`tests/mocks/${filename}`] = content;
        }
      }
      
      // 7. Test package.json
      const testPackageJson = await this._generateTestPackageJson(functionTestSpec);
      await this.tools.fileWrite.execute({
        filepath: path.join(outputDir, 'package.json'),
        content: JSON.stringify(testPackageJson, null, 2)
      });
      generatedTests['package.json'] = testPackageJson;
      
      // 8. Test README
      const testReadme = await this._generateTestREADME(functionTestSpec);
      await this.tools.fileWrite.execute({
        filepath: path.join(outputDir, 'README.md'),
        content: testReadme
      });
      generatedTests['README.md'] = testReadme;
      
      // Store all artifacts
      for (const [filename, content] of Object.entries(generatedTests)) {
        task.storeArtifact(filename, content, `Generated ${filename}`, 'test');
      }
      
      return {
        success: true,
        result: {
          message: `JavaScript function test suite for ${functionTestSpec.functions.length} functions created successfully`,
          outputDirectory: outputDir,
          filesGenerated: Object.keys(generatedTests).length,
          files: Object.keys(generatedTests),
          functions: functionTestSpec.functions.length,
          testTypes: Object.keys(functionTestSpec.testTypes).filter(t => functionTestSpec.testTypes[t])
        },
        artifacts: Object.values(task.getAllArtifacts())
      };
      
    } catch (error) {
      return {
        success: false,
        error: `JavaScript function test creation failed: ${error.message}`
      };
    }
  }
  
  /**
   * Create test directory structure
   * @private
   */
  async _createTestDirectoryStructure(outputDir) {
    const directories = [
      'tests',
      'tests/utils',
      'tests/mocks',
      'tests/fixtures',
      'tests/property',
      'tests/performance',
      'src'
    ];
    
    for (const dir of directories) {
      await this.tools.directoryCreate.execute({ path: path.join(outputDir, dir) });
    }
  }
  
  /**
   * Generate test setup and configuration files
   * @private
   */
  async _generateTestSetup(functionTestSpec) {
    const setupFiles = {};
    
    // Jest configuration
    setupFiles['jest.config.js'] = await this._generateJestConfig(functionTestSpec);
    
    // Test setup file
    setupFiles['tests/setup.js'] = await this._generateTestSetupFile(functionTestSpec);
    
    return setupFiles;
  }
  
  /**
   * Generate Jest configuration for function testing
   * @private
   */
  async _generateJestConfig(functionTestSpec) {
    const prompt = `Generate a Jest configuration file for JavaScript function testing with these requirements:

Test Environment: ${JSON.stringify(functionTestSpec.testEnvironment, null, 2)}
Test Types: ${JSON.stringify(functionTestSpec.testTypes, null, 2)}
Coverage Targets: ${JSON.stringify(functionTestSpec.coverageTargets, null, 2)}

Requirements:
1. Configure test environment (${functionTestSpec.testEnvironment.node ? 'Node.js' : 'Browser'})
2. Set up coverage reporting with specified thresholds
3. Configure test patterns for different test types
4. Set up performance testing if enabled
5. Configure property-based testing if enabled
6. Set up module resolution
7. Configure test reporters
8. Set up timeout settings appropriate for function testing

Generate comprehensive Jest configuration for function testing.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate test setup file for function testing
   * @private
   */
  async _generateTestSetupFile(functionTestSpec) {
    const prompt = `Generate a test setup file for JavaScript function testing with these requirements:

Functions to test: ${functionTestSpec.functions.length}
Test Environment: ${JSON.stringify(functionTestSpec.testEnvironment, null, 2)}
External Dependencies: ${functionTestSpec.testEnvironment.externalDependencies.join(', ')}

Requirements:
1. Set up global test utilities
2. Configure mock implementations for external dependencies
3. Set up performance measurement utilities
4. Configure property-based testing generators
5. Set up test data factories
6. Configure environment variables for testing
7. Set up custom matchers for function testing
8. Configure cleanup procedures

Generate comprehensive test setup code for function testing.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate test file for a specific function
   * @private
   */
  async _generateFunctionTestFile(functionSpec, functionTestSpec) {
    const prompt = `Generate comprehensive Jest tests for this JavaScript function:

Function: ${functionSpec.name}
Description: ${functionSpec.description}
Parameters: ${JSON.stringify(functionSpec.parameters, null, 2)}
Return Type: ${functionSpec.returnType}
Is Async: ${functionSpec.isAsync}
Is Pure: ${functionSpec.isPure}
Side Effects: ${JSON.stringify(functionSpec.sideEffects, null, 2)}
Test Scenarios: ${JSON.stringify(functionSpec.testScenarios, null, 2)}

Test Framework: ${functionTestSpec.testEnvironment.framework}
Coverage Targets: ${JSON.stringify(functionTestSpec.coverageTargets, null, 2)}

Requirements:
1. Test all specified scenarios comprehensively
2. Include happy path tests
3. Include edge case tests (null, undefined, empty values)
4. Include boundary value tests
5. Include type validation tests
6. Include error handling tests
7. Include performance assertions if complex function
8. Test side effects if function is not pure
9. Test async behavior if function is async
10. Use proper test organization (describe/it blocks)
11. Include setup and teardown as needed
12. Use appropriate assertions and matchers
13. Include test data factories for complex inputs
14. Test parameter validation
15. Test return value validation

Generate thorough, production-ready function tests.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate property-based tests
   * @private
   */
  async _generatePropertyTests(functionTestSpec) {
    const propertyTests = {};
    
    for (const functionSpec of functionTestSpec.functions) {
      if (functionSpec.isPure) {
        const testContent = await this._generatePropertyTestForFunction(functionSpec, functionTestSpec);
        propertyTests[`${functionSpec.name}.property.test.js`] = testContent;
      }
    }
    
    return propertyTests;
  }
  
  /**
   * Generate property-based test for a function
   * @private
   */
  async _generatePropertyTestForFunction(functionSpec, functionTestSpec) {
    const prompt = `Generate property-based tests for this pure function:

Function: ${functionSpec.name}
Description: ${functionSpec.description}
Parameters: ${JSON.stringify(functionSpec.parameters, null, 2)}
Return Type: ${functionSpec.returnType}

Requirements:
1. Use fast-check or similar property-based testing library
2. Test function properties (invariants that should always hold)
3. Generate random inputs within valid ranges
4. Test idempotency if applicable
5. Test commutativity if applicable
6. Test associativity if applicable
7. Test inverse operations if applicable
8. Test error boundaries with invalid inputs
9. Include shrinking for failed test cases
10. Test performance properties (no exponential blowup)

Generate comprehensive property-based tests.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate performance tests
   * @private
   */
  async _generatePerformanceTests(functionTestSpec) {
    const performanceTests = {};
    
    for (const functionSpec of functionTestSpec.functions) {
      if (functionSpec.complexity !== 'simple') {
        const testContent = await this._generatePerformanceTestForFunction(functionSpec, functionTestSpec);
        performanceTests[`${functionSpec.name}.performance.test.js`] = testContent;
      }
    }
    
    return performanceTests;
  }
  
  /**
   * Generate performance test for a function
   * @private
   */
  async _generatePerformanceTestForFunction(functionSpec, functionTestSpec) {
    const prompt = `Generate performance tests for this function:

Function: ${functionSpec.name}
Description: ${functionSpec.description}
Complexity: ${functionSpec.complexity}
Parameters: ${JSON.stringify(functionSpec.parameters, null, 2)}

Requirements:
1. Test execution time with different input sizes
2. Test memory usage patterns
3. Test with small, medium, and large inputs
4. Set reasonable performance benchmarks
5. Test for memory leaks if applicable
6. Test CPU usage patterns
7. Include stress testing scenarios
8. Test concurrent execution if applicable
9. Use performance.now() for accurate timing
10. Include statistical analysis of results

Generate comprehensive performance tests.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate test utilities
   * @private
   */
  async _generateTestUtilities(functionTestSpec) {
    const utilities = {};
    
    utilities['testDataFactory.js'] = await this._generateTestDataFactory(functionTestSpec);
    utilities['assertionHelpers.js'] = await this._generateAssertionHelpers(functionTestSpec);
    utilities['performanceHelpers.js'] = await this._generatePerformanceHelpers(functionTestSpec);
    
    return utilities;
  }
  
  /**
   * Generate test data factory
   * @private
   */
  async _generateTestDataFactory(functionTestSpec) {
    const prompt = `Generate test data factory utilities for JavaScript function testing:

Functions: ${JSON.stringify(functionTestSpec.functions, null, 2)}

Requirements:
1. Factory functions for generating test inputs
2. Boundary value generators
3. Invalid input generators
4. Random data generators
5. Edge case data generators
6. Complex object generators
7. Array generators with various lengths
8. String generators with different patterns
9. Number generators with different ranges
10. Boolean and null value generators

Generate comprehensive test data factory utilities.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate assertion helpers
   * @private
   */
  async _generateAssertionHelpers(functionTestSpec) {
    const prompt = `Generate custom assertion helpers for JavaScript function testing:

Functions: ${JSON.stringify(functionTestSpec.functions, null, 2)}

Requirements:
1. Type assertion helpers
2. Value range assertion helpers
3. Object structure assertion helpers
4. Array content assertion helpers
5. Function behavior assertion helpers
6. Error assertion helpers
7. Performance assertion helpers
8. Async behavior assertion helpers
9. Side effect assertion helpers
10. Custom matchers for Jest

Generate comprehensive assertion helper utilities.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate performance helpers
   * @private
   */
  async _generatePerformanceHelpers(functionTestSpec) {
    const prompt = `Generate performance testing helpers for JavaScript function testing:

Requirements:
1. Timing measurement utilities
2. Memory usage measurement utilities
3. Benchmark comparison utilities
4. Statistical analysis utilities
5. Performance regression detection
6. Load testing utilities
7. Concurrency testing utilities
8. Resource usage monitoring
9. Performance reporting utilities
10. Threshold checking utilities

Generate comprehensive performance testing helpers.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate mock data
   * @private
   */
  async _generateMockData(functionTestSpec) {
    const mockData = {};
    
    mockData['mockData.js'] = await this._generateMockDataFile(functionTestSpec);
    
    return mockData;
  }
  
  /**
   * Generate mock data file
   * @private
   */
  async _generateMockDataFile(functionTestSpec) {
    const prompt = `Generate mock data for JavaScript function testing:

Functions: ${JSON.stringify(functionTestSpec.functions, null, 2)}
External Dependencies: ${functionTestSpec.testEnvironment.externalDependencies.join(', ')}

Requirements:
1. Mock implementations for external dependencies
2. Test data sets for various scenarios
3. Mock responses for async operations
4. Error simulation data
5. Edge case data sets
6. Valid and invalid input examples
7. Complex nested object mocks
8. Array mocks with various structures
9. Function mocks with different behaviors
10. State mocks for stateful testing

Generate comprehensive mock data and implementations.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate test package.json
   * @private
   */
  async _generateTestPackageJson(functionTestSpec) {
    const dependencies = {};
    const devDependencies = {
      jest: '^29.7.0'
    };
    
    // Add framework-specific dependencies
    if (functionTestSpec.testEnvironment.framework === 'jest') {
      devDependencies['@jest/globals'] = '^29.7.0';
    }
    
    // Add property-based testing dependencies
    if (functionTestSpec.testTypes.property) {
      devDependencies['fast-check'] = '^3.15.0';
    }
    
    // Add performance testing dependencies
    if (functionTestSpec.testTypes.performance) {
      devDependencies['benchmark'] = '^2.1.4';
    }
    
    // Add external dependencies for testing
    if (functionTestSpec.testEnvironment.externalDependencies) {
      for (const dep of functionTestSpec.testEnvironment.externalDependencies) {
        devDependencies[dep] = 'latest';
      }
    }
    
    return {
      name: 'javascript-function-tests',
      version: '1.0.0',
      description: 'Test suite for JavaScript functions',
      scripts: {
        test: 'jest',
        'test:watch': 'jest --watch',
        'test:coverage': 'jest --coverage',
        'test:property': 'jest --testPathPattern=property',
        'test:performance': 'jest --testPathPattern=performance'
      },
      dependencies,
      devDependencies,
      jest: {
        testEnvironment: functionTestSpec.testEnvironment.node ? 'node' : 'jsdom',
        setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
        collectCoverageFrom: [
          'src/**/*.js',
          '!src/**/*.test.js'
        ],
        coverageThreshold: {
          global: functionTestSpec.coverageTargets
        },
        testTimeout: 10000
      },
      keywords: ['javascript', 'functions', 'testing', 'jest'],
      author: 'Generated by TestJavaScriptFunctionStrategy',
      license: 'MIT'
    };
  }
  
  /**
   * Generate test README
   * @private
   */
  async _generateTestREADME(functionTestSpec) {
    const prompt = `Generate a comprehensive README.md for this JavaScript function test suite:

Functions: ${functionTestSpec.functions.length} functions
Test Types: ${Object.keys(functionTestSpec.testTypes).filter(t => functionTestSpec.testTypes[t]).join(', ')}
Test Framework: ${functionTestSpec.testEnvironment.framework}

Include:
1. Test suite overview and purpose
2. Function testing methodology
3. Running different types of tests
4. Coverage requirements and targets
5. Property-based testing approach (if applicable)
6. Performance testing approach (if applicable)
7. Test data management
8. Adding new function tests
9. Debugging test failures
10. CI/CD integration instructions

Make this professional and comprehensive.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Extract context from task
   * @private
   */
  _getContextFromTask(task) {
    return {
      llmClient: (task.lookup && task.lookup('llmClient')) || task.context?.llmClient,
      toolRegistry: (task.lookup && task.lookup('toolRegistry')) || task.context?.toolRegistry,
      workspaceDir: (task.lookup && task.lookup('workspaceDir')) || task.context?.workspaceDir || this.projectRoot,
    };
  }
  
  /**
   * Setup test directory
   * @private
   */
  async _setupTestDirectory(task, functionTestSpec) {
    const projectName = this._generateTestProjectName(functionTestSpec.functions);
    const romaProjectsDir = '/tmp/roma-projects';
    const outputDir = path.join(romaProjectsDir, projectName);
    
    await this.tools.directoryCreate.execute({ path: romaProjectsDir });
    await this.tools.directoryCreate.execute({ path: outputDir });
    
    return outputDir;
  }
  
  /**
   * Generate test project name
   * @private
   */
  _generateTestProjectName(functions) {
    const functionNames = functions.map(f => f.name).slice(0, 3).join('-');
    const timestamp = new Date().toISOString().slice(0, 10);
    
    return `test-js-functions-${functionNames}-${timestamp}`;
  }
  
  /**
   * Get prompt definitions (data-driven approach)
   * @private
   */
  _getPromptDefinitions() {
    return {
      analyzeFunctionTestRequirements: {
        template: `Analyze this JavaScript function testing task and extract specific test requirements:

Task: "{{taskDescription}}"

Available Artifacts: {{artifacts}}

Extract the following information and return as JSON:
{
  "functions": [
    {
      "name": "functionName",
      "description": "what this function does",
      "parameters": [
        {
          "name": "paramName",
          "type": "string|number|boolean|object|array|function",
          "required": true/false,
          "description": "parameter description",
          "defaultValue": "default value if any"
        }
      ],
      "returnType": "string|number|boolean|object|array|function|void|Promise",
      "returnDescription": "description of return value",
      "isAsync": true/false,
      "isPure": true/false,
      "sideEffects": ["description of side effects"],
      "complexity": "simple|medium|complex",
      "testScenarios": [
        {
          "name": "test scenario name",
          "type": "happy-path|edge-case|error-case|boundary|performance",
          "description": "what this test validates",
          "inputs": ["input1", "input2"],
          "expectedOutput": "expected result",
          "shouldThrow": true/false,
          "errorType": "Error|TypeError|RangeError|etc"
        }
      ]
    }
  ],
  "testEnvironment": {
    "framework": "jest|mocha|vitest",
    "browser": true/false,
    "node": true/false,
    "requiresMocks": true/false,
    "externalDependencies": ["dependency1", "dependency2"]
  },
  "testTypes": {
    "unit": true/false,
    "integration": true/false,
    "property": true/false,
    "performance": true/false,
    "mutation": true/false
  },
  "coverageTargets": {
    "statements": 100,
    "branches": 100,
    "functions": 100,
    "lines": 100
  }
}

Focus on extracting comprehensive test requirements for JavaScript function testing.`,
        responseSchema: PromptFactory.createJsonSchema({
          functions: { type: 'array' },
          testEnvironment: { type: 'object' },
          testTypes: { type: 'object' },
          coverageTargets: { type: 'object' }
        }, ['functions', 'testEnvironment', 'testTypes', 'coverageTargets'])
      },
      
      generateJestConfig: {
        template: `Generate a Jest configuration file for JavaScript function testing with these requirements:

Test Environment: {{testEnvironment}}
Test Types: {{testTypes}}
Coverage Targets: {{coverageTargets}}

Requirements:
1. Configure test environment ({{nodeOrBrowser}})
2. Set up coverage reporting with specified thresholds
3. Configure test patterns for different test types
4. Set up performance testing if enabled
5. Configure property-based testing if enabled
6. Set up module resolution
7. Configure test reporters
8. Set up timeout settings appropriate for function testing

Generate comprehensive Jest configuration for function testing.`,
        responseSchema: {
          type: 'string',
          format: 'text',
          description: 'Jest configuration file content'
        }
      },
      
      generateTestSetupFile: {
        template: `Generate a test setup file for JavaScript function testing with these requirements:

Functions to test: {{functionsCount}}
Test Environment: {{testEnvironment}}
External Dependencies: {{externalDependencies}}

Requirements:
1. Set up global test utilities
2. Configure mock implementations for external dependencies
3. Set up performance measurement utilities
4. Configure property-based testing generators
5. Set up test data factories
6. Configure environment variables for testing
7. Set up custom matchers for function testing
8. Configure cleanup procedures

Generate comprehensive test setup code for function testing.`,
        responseSchema: {
          type: 'string',
          format: 'text',
          description: 'Test setup file content'
        }
      },
      
      generateFunctionTestFile: {
        template: `Generate comprehensive Jest tests for this JavaScript function:

Function: {{functionName}}
Description: {{functionDescription}}
Parameters: {{parameters}}
Return Type: {{returnType}}
Is Async: {{isAsync}}
Is Pure: {{isPure}}
Side Effects: {{sideEffects}}
Test Scenarios: {{testScenarios}}

Test Framework: {{testFramework}}
Coverage Targets: {{coverageTargets}}

Requirements:
1. Test all specified scenarios comprehensively
2. Include happy path tests
3. Include edge case tests (null, undefined, empty values)
4. Include boundary value tests
5. Include type validation tests
6. Include error handling tests
7. Include performance assertions if complex function
8. Test side effects if function is not pure
9. Test async behavior if function is async
10. Use proper test organization (describe/it blocks)
11. Include setup and teardown as needed
12. Use appropriate assertions and matchers
13. Include test data factories for complex inputs
14. Test parameter validation
15. Test return value validation

Generate thorough, production-ready function tests.`,
        responseSchema: {
          type: 'string',
          format: 'text',
          description: 'Test file content'
        }
      },
      
      generatePropertyTestForFunction: {
        template: `Generate property-based tests for this pure function:

Function: {{functionName}}
Description: {{functionDescription}}
Parameters: {{parameters}}
Return Type: {{returnType}}

Requirements:
1. Use fast-check or similar property-based testing library
2. Test function properties (invariants that should always hold)
3. Generate random inputs within valid ranges
4. Test idempotency if applicable
5. Test commutativity if applicable
6. Test associativity if applicable
7. Test inverse operations if applicable
8. Test error boundaries with invalid inputs
9. Include shrinking for failed test cases
10. Test performance properties (no exponential blowup)

Generate comprehensive property-based tests.`,
        responseSchema: {
          type: 'string',
          format: 'text',
          description: 'Property test file content'
        }
      },
      
      generatePerformanceTestForFunction: {
        template: `Generate performance tests for this function:

Function: {{functionName}}
Description: {{functionDescription}}
Complexity: {{complexity}}
Parameters: {{parameters}}

Requirements:
1. Test execution time with different input sizes
2. Test memory usage patterns
3. Test with small, medium, and large inputs
4. Set reasonable performance benchmarks
5. Test for memory leaks if applicable
6. Test CPU usage patterns
7. Include stress testing scenarios
8. Test concurrent execution if applicable
9. Use performance.now() for accurate timing
10. Include statistical analysis of results

Generate comprehensive performance tests.`,
        responseSchema: {
          type: 'string',
          format: 'text',
          description: 'Performance test file content'
        }
      },
      
      generateTestDataFactory: {
        template: `Generate test data factory utilities for JavaScript function testing:

Functions: {{functions}}

Requirements:
1. Factory functions for generating test inputs
2. Boundary value generators
3. Invalid input generators
4. Random data generators
5. Edge case data generators
6. Complex object generators
7. Array generators with various lengths
8. String generators with different patterns
9. Number generators with different ranges
10. Boolean and null value generators

Generate comprehensive test data factory utilities.`,
        responseSchema: {
          type: 'string',
          format: 'text',
          description: 'Test data factory file content'
        }
      },
      
      generateAssertionHelpers: {
        template: `Generate custom assertion helpers for JavaScript function testing:

Functions: {{functions}}

Requirements:
1. Type assertion helpers
2. Value range assertion helpers
3. Object structure assertion helpers
4. Array content assertion helpers
5. Function behavior assertion helpers
6. Error assertion helpers
7. Performance assertion helpers
8. Async behavior assertion helpers
9. Side effect assertion helpers
10. Custom matchers for Jest

Generate comprehensive assertion helper utilities.`,
        responseSchema: {
          type: 'string',
          format: 'text',
          description: 'Assertion helpers file content'
        }
      },
      
      generatePerformanceHelpers: {
        template: `Generate performance testing helpers for JavaScript function testing:

Requirements:
1. Timing measurement utilities
2. Memory usage measurement utilities
3. Benchmark comparison utilities
4. Statistical analysis utilities
5. Performance regression detection
6. Load testing utilities
7. Concurrency testing utilities
8. Resource usage monitoring
9. Performance reporting utilities
10. Threshold checking utilities

Generate comprehensive performance testing helpers.`,
        responseSchema: {
          type: 'string',
          format: 'text',
          description: 'Performance helpers file content'
        }
      },
      
      generateMockDataFile: {
        template: `Generate mock data for JavaScript function testing:

Functions: {{functions}}
External Dependencies: {{externalDependencies}}

Requirements:
1. Mock implementations for external dependencies
2. Test data sets for various scenarios
3. Mock responses for async operations
4. Error simulation data
5. Edge case data sets
6. Valid and invalid input examples
7. Complex nested object mocks
8. Array mocks with various structures
9. Function mocks with different behaviors
10. State mocks for stateful testing

Generate comprehensive mock data and implementations.`,
        responseSchema: {
          type: 'string',
          format: 'text',
          description: 'Mock data file content'
        }
      },
      
      generateTestREADME: {
        template: `Generate a comprehensive README.md for this JavaScript function test suite:

Functions: {{functionsCount}} functions
Test Types: {{testTypes}}
Test Framework: {{testFramework}}

Include:
1. Test suite overview and purpose
2. Function testing methodology
3. Running different types of tests
4. Coverage requirements and targets
5. Property-based testing approach (if applicable)
6. Performance testing approach (if applicable)
7. Test data management
8. Adding new function tests
9. Debugging test failures
10. CI/CD integration instructions

Make this professional and comprehensive.`,
        responseSchema: {
          type: 'string',
          format: 'text',
          description: 'README file content'
        }
      }
    };
  }
}