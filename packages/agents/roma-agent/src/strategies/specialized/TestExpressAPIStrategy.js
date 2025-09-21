/**
 * TestExpressAPIStrategy - Specialized strategy for Express.js API testing
 * 
 * This is a true SOP (Standard Operating Procedure) for testing Express.js APIs.
 * It knows exactly what types of tests to create, how to structure API tests,
 * and how to test endpoints, middleware, authentication, and error handling.
 */

import { TaskStrategy } from '@legion/tasks';
import path from 'path';

export default class TestExpressAPIStrategy extends TaskStrategy {
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
    
    // Express API testing configuration
    this.testConfig = {
      testFramework: 'jest',
      httpLibrary: 'supertest',
      mockDatabase: true,
      testAuth: true,
      testValidation: true,
      testErrorHandling: true,
      generateLoadTests: false
    };
  }
  
  getName() {
    return 'TestExpressAPI';
  }
  
  /**
   * Handle messages from parent task
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        this.currentTask = parentTask;
        return await this._handleExpressAPITesting(parentTask);
        
      case 'abort':
        console.log(`🛑 TestExpressAPIStrategy received abort`);
        return { acknowledged: true, aborted: true };
        
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle messages from child tasks (not applicable)
   */
  async onChildMessage(childTask, message) {
    return { acknowledged: false, error: 'TestExpressAPIStrategy does not handle child messages' };
  }
  
  /**
   * Main Express API testing handler
   * @private
   */
  async _handleExpressAPITesting(task) {
    try {
      console.log(`🧪 TestExpressAPIStrategy creating tests for Express API: ${task.description}`);
      
      // Initialize components
      await this._initializeComponents(task);
      
      // Analyze the API to determine test requirements
      const apiTestSpec = await this._analyzeAPITestRequirements(task);
      task.addConversationEntry('system', `Express API test specification: ${JSON.stringify(apiTestSpec, null, 2)}`);
      
      // Create comprehensive test suite for the Express API
      const result = await this._createExpressAPITests(task, apiTestSpec);
      
      if (result.success) {
        task.complete(result);
        return result;
      } else {
        task.fail(new Error(result.error || 'Express API test creation failed'));
        return result;
      }
      
    } catch (error) {
      console.error(`❌ TestExpressAPIStrategy error:`, error);
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
      throw new Error('LLM client is required for TestExpressAPIStrategy');
    }
    
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required for TestExpressAPIStrategy');
    }
    
    // Load required tools
    await this._loadRequiredTools();
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
      
      console.log('🧪 TestExpressAPIStrategy tools loaded successfully');
      
    } catch (error) {
      throw new Error(`Failed to load required tools: ${error.message}`);
    }
  }
  
  /**
   * Analyze API test requirements from task description and artifacts
   * @private
   */
  async _analyzeAPITestRequirements(task) {
    const prompt = `Analyze this Express.js API testing task and extract specific test requirements:

Task: "${task.description}"

Available Artifacts: ${task.getArtifactsContext()}

Extract the following information and return as JSON:
{
  "apiName": "API name to test",
  "endpoints": [
    {
      "method": "GET|POST|PUT|DELETE",
      "path": "/endpoint/path",
      "description": "what this endpoint does",
      "requiresAuth": true/false,
      "parameters": {
        "query": ["param1", "param2"],
        "path": ["id", "userId"],
        "body": ["field1", "field2"]
      },
      "responses": {
        "200": "success response structure",
        "400": "validation error",
        "401": "authentication error",
        "404": "not found",
        "500": "server error"
      },
      "testScenarios": [
        "happy path test",
        "validation test",
        "error handling test"
      ]
    }
  ],
  "authentication": {
    "type": "jwt|session|apikey|none",
    "required": true/false,
    "testCases": ["valid token", "invalid token", "expired token", "missing token"]
  },
  "middleware": [
    {
      "name": "cors",
      "testCases": ["preflight request", "cross-origin request"]
    },
    {
      "name": "rateLimit",
      "testCases": ["within limit", "exceeded limit"]
    }
  ],
  "database": {
    "type": "mongodb|mysql|postgresql|memory|none",
    "mockStrategy": "mock|test-db|in-memory",
    "testData": "sample data needed for tests"
  },
  "testTypes": {
    "unit": true/false,
    "integration": true/false,
    "e2e": true/false,
    "load": true/false,
    "security": true/false
  },
  "dependencies": ["supertest", "jest", "mongodb-memory-server"],
  "testConfiguration": {
    "framework": "jest|mocha|vitest",
    "timeout": 5000,
    "setupFiles": ["setup-tests.js"],
    "teardownFiles": ["teardown-tests.js"]
  }
}

Focus on extracting comprehensive test requirements for Express.js API testing.`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return JSON.parse(response);
    } catch (error) {
      console.log(`⚠️ API test requirements analysis failed, using defaults: ${error.message}`);
      return this._getDefaultAPITestSpec();
    }
  }
  
  /**
   * Get default API test specification
   * @private
   */
  _getDefaultAPITestSpec() {
    return {
      apiName: 'Express API',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          description: 'Health check endpoint',
          requiresAuth: false,
          parameters: {
            query: [],
            path: [],
            body: []
          },
          responses: {
            "200": "{ status: 'ok' }",
            "500": "server error"
          },
          testScenarios: [
            'should return 200 status',
            'should return JSON response',
            'should handle server errors'
          ]
        }
      ],
      authentication: {
        type: 'none',
        required: false,
        testCases: []
      },
      middleware: [],
      database: {
        type: 'none',
        mockStrategy: 'mock',
        testData: '{}'
      },
      testTypes: {
        unit: true,
        integration: true,
        e2e: false,
        load: false,
        security: false
      },
      dependencies: ['supertest', 'jest'],
      testConfiguration: {
        framework: 'jest',
        timeout: 5000,
        setupFiles: [],
        teardownFiles: []
      }
    };
  }
  
  /**
   * Create comprehensive test suite for Express API
   * @private
   */
  async _createExpressAPITests(task, apiTestSpec) {
    console.log(`🏗️ Creating Express.js API test suite with ${apiTestSpec.endpoints.length} endpoints`);
    
    try {
      // Setup test directory
      const outputDir = await this._setupTestDirectory(task, apiTestSpec);
      
      // Create test directory structure
      await this._createTestDirectoryStructure(outputDir);
      
      // Generate all test files
      const generatedTests = {};
      
      // 1. Test setup and configuration files
      const setupFiles = await this._generateTestSetup(apiTestSpec);
      for (const [filename, content] of Object.entries(setupFiles)) {
        await this.tools.fileWrite.execute({
          filepath: path.join(outputDir, filename),
          content: content
        });
        generatedTests[filename] = content;
      }
      
      // 2. Unit tests for individual endpoints
      if (apiTestSpec.testTypes.unit) {
        const unitTests = await this._generateUnitTests(apiTestSpec);
        for (const [filename, content] of Object.entries(unitTests)) {
          const testPath = path.join(outputDir, 'tests', 'unit', filename);
          await this.tools.fileWrite.execute({ filepath: testPath, content });
          generatedTests[`tests/unit/${filename}`] = content;
        }
      }
      
      // 3. Integration tests for API workflows
      if (apiTestSpec.testTypes.integration) {
        const integrationTests = await this._generateIntegrationTests(apiTestSpec);
        for (const [filename, content] of Object.entries(integrationTests)) {
          const testPath = path.join(outputDir, 'tests', 'integration', filename);
          await this.tools.fileWrite.execute({ filepath: testPath, content });
          generatedTests[`tests/integration/${filename}`] = content;
        }
      }
      
      // 4. Security tests
      if (apiTestSpec.testTypes.security) {
        const securityTests = await this._generateSecurityTests(apiTestSpec);
        for (const [filename, content] of Object.entries(securityTests)) {
          const testPath = path.join(outputDir, 'tests', 'security', filename);
          await this.tools.fileWrite.execute({ filepath: testPath, content });
          generatedTests[`tests/security/${filename}`] = content;
        }
      }
      
      // 5. Load/Performance tests
      if (apiTestSpec.testTypes.load) {
        const loadTests = await this._generateLoadTests(apiTestSpec);
        for (const [filename, content] of Object.entries(loadTests)) {
          const testPath = path.join(outputDir, 'tests', 'load', filename);
          await this.tools.fileWrite.execute({ filepath: testPath, content });
          generatedTests[`tests/load/${filename}`] = content;
        }
      }
      
      // 6. Test utilities and helpers
      const testHelpers = await this._generateTestHelpers(apiTestSpec);
      for (const [filename, content] of Object.entries(testHelpers)) {
        const helperPath = path.join(outputDir, 'tests', 'helpers', filename);
        await this.tools.fileWrite.execute({ filepath: helperPath, content });
        generatedTests[`tests/helpers/${filename}`] = content;
      }
      
      // 7. Test package.json
      const testPackageJson = await this._generateTestPackageJson(apiTestSpec);
      await this.tools.fileWrite.execute({
        filepath: path.join(outputDir, 'package.json'),
        content: JSON.stringify(testPackageJson, null, 2)
      });
      generatedTests['package.json'] = testPackageJson;
      
      // 8. Test README
      const testReadme = await this._generateTestREADME(apiTestSpec);
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
          message: `Express.js API test suite for "${apiTestSpec.apiName}" created successfully`,
          outputDirectory: outputDir,
          filesGenerated: Object.keys(generatedTests).length,
          files: Object.keys(generatedTests),
          endpoints: apiTestSpec.endpoints.length,
          testTypes: Object.keys(apiTestSpec.testTypes).filter(t => apiTestSpec.testTypes[t])
        },
        artifacts: Object.values(task.getAllArtifacts())
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Express.js API test creation failed: ${error.message}`
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
      'tests/unit',
      'tests/integration',
      'tests/security',
      'tests/load',
      'tests/helpers',
      'tests/fixtures',
      'tests/mocks'
    ];
    
    for (const dir of directories) {
      await this.tools.directoryCreate.execute({ path: path.join(outputDir, dir) });
    }
  }
  
  /**
   * Generate test setup and configuration files
   * @private
   */
  async _generateTestSetup(apiTestSpec) {
    const setupFiles = {};
    
    // Jest configuration
    setupFiles['jest.config.js'] = await this._generateJestConfig(apiTestSpec);
    
    // Test setup file
    setupFiles['tests/setup.js'] = await this._generateTestSetupFile(apiTestSpec);
    
    // Test teardown file
    setupFiles['tests/teardown.js'] = await this._generateTestTeardownFile(apiTestSpec);
    
    return setupFiles;
  }
  
  /**
   * Generate Jest configuration
   * @private
   */
  async _generateJestConfig(apiTestSpec) {
    const prompt = `Generate a Jest configuration file for Express.js API testing with these requirements:

API Test Spec: ${JSON.stringify(apiTestSpec.testConfiguration, null, 2)}
Test Types: ${JSON.stringify(apiTestSpec.testTypes, null, 2)}
Database: ${apiTestSpec.database.type}

Requirements:
1. Configure test environment for Node.js
2. Set up test patterns for different test types
3. Configure coverage reporting
4. Set up database mocking if needed
5. Configure timeout settings
6. Set up test setup and teardown files
7. Configure module resolution
8. Set up test reporters

Generate a comprehensive Jest configuration.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate test setup file
   * @private
   */
  async _generateTestSetupFile(apiTestSpec) {
    const prompt = `Generate a test setup file for Express.js API testing with these requirements:

API Test Spec: ${JSON.stringify(apiTestSpec, null, 2)}

Requirements:
1. Set up test database connection/mocking
2. Configure authentication mocking
3. Set up request/response mocking
4. Initialize test fixtures
5. Configure environment variables for testing
6. Set up global test utilities
7. Configure error handling for tests
8. Set up cleanup procedures

Generate comprehensive test setup code.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate test teardown file
   * @private
   */
  async _generateTestTeardownFile(apiTestSpec) {
    const prompt = `Generate a test teardown file for Express.js API testing with these requirements:

Database: ${apiTestSpec.database.type}
Mock Strategy: ${apiTestSpec.database.mockStrategy}

Requirements:
1. Clean up test database
2. Close database connections
3. Clear mocks and stubs
4. Clean up temporary files
5. Reset global state
6. Close server connections
7. Clean up environment variables

Generate comprehensive test teardown code.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate unit tests for individual endpoints
   * @private
   */
  async _generateUnitTests(apiTestSpec) {
    const unitTests = {};
    
    for (const endpoint of apiTestSpec.endpoints) {
      const testContent = await this._generateEndpointUnitTest(endpoint, apiTestSpec);
      const testFilename = `${endpoint.method.toLowerCase()}-${this._pathToFilename(endpoint.path)}.test.js`;
      unitTests[testFilename] = testContent;
    }
    
    return unitTests;
  }
  
  /**
   * Generate unit test for a specific endpoint
   * @private
   */
  async _generateEndpointUnitTest(endpoint, apiTestSpec) {
    const prompt = `Generate comprehensive Jest unit tests for this Express.js API endpoint:

Endpoint: ${endpoint.method} ${endpoint.path}
Description: ${endpoint.description}
Authentication Required: ${endpoint.requiresAuth}
Parameters: ${JSON.stringify(endpoint.parameters, null, 2)}
Responses: ${JSON.stringify(endpoint.responses, null, 2)}
Test Scenarios: ${JSON.stringify(endpoint.testScenarios, null, 2)}

API Configuration: ${JSON.stringify(apiTestSpec.testConfiguration, null, 2)}
Authentication: ${JSON.stringify(apiTestSpec.authentication, null, 2)}

Requirements:
1. Use Jest and Supertest for HTTP testing
2. Test all response status codes
3. Test request validation
4. Test authentication/authorization
5. Test error handling and edge cases
6. Mock external dependencies
7. Use proper test data fixtures
8. Include performance assertions
9. Test middleware functionality
10. Include security test cases

Generate thorough, production-ready unit tests.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate integration tests
   * @private
   */
  async _generateIntegrationTests(apiTestSpec) {
    const integrationTests = {};
    
    // API workflow tests
    integrationTests['api-workflows.test.js'] = await this._generateWorkflowTests(apiTestSpec);
    
    // Database integration tests
    if (apiTestSpec.database.type !== 'none') {
      integrationTests['database-integration.test.js'] = await this._generateDatabaseIntegrationTests(apiTestSpec);
    }
    
    // Authentication flow tests
    if (apiTestSpec.authentication.required) {
      integrationTests['auth-integration.test.js'] = await this._generateAuthIntegrationTests(apiTestSpec);
    }
    
    return integrationTests;
  }
  
  /**
   * Generate workflow integration tests
   * @private
   */
  async _generateWorkflowTests(apiTestSpec) {
    const prompt = `Generate integration tests for Express.js API workflows:

API Name: ${apiTestSpec.apiName}
Endpoints: ${JSON.stringify(apiTestSpec.endpoints, null, 2)}
Authentication: ${JSON.stringify(apiTestSpec.authentication, null, 2)}

Requirements:
1. Test complete user workflows across multiple endpoints
2. Test data flow between endpoints
3. Test state persistence and consistency
4. Test error propagation and handling
5. Test transaction rollback scenarios
6. Use real database interactions (with test data)
7. Test concurrent request handling
8. Include performance benchmarks

Generate comprehensive workflow integration tests.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate database integration tests
   * @private
   */
  async _generateDatabaseIntegrationTests(apiTestSpec) {
    const prompt = `Generate database integration tests for Express.js API:

Database Type: ${apiTestSpec.database.type}
Mock Strategy: ${apiTestSpec.database.mockStrategy}
Test Data: ${apiTestSpec.database.testData}

Requirements:
1. Test database connection handling
2. Test CRUD operations
3. Test transaction handling
4. Test error scenarios (connection loss, timeout)
5. Test data validation and constraints
6. Test concurrent access
7. Test migration scenarios
8. Include performance tests

Generate comprehensive database integration tests.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate authentication integration tests
   * @private
   */
  async _generateAuthIntegrationTests(apiTestSpec) {
    const prompt = `Generate authentication integration tests for Express.js API:

Authentication Type: ${apiTestSpec.authentication.type}
Test Cases: ${JSON.stringify(apiTestSpec.authentication.testCases, null, 2)}

Requirements:
1. Test complete authentication flows
2. Test token generation and validation
3. Test session management
4. Test authorization levels
5. Test security edge cases
6. Test token refresh scenarios
7. Test logout and cleanup
8. Include security vulnerability tests

Generate comprehensive authentication integration tests.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate security tests
   * @private
   */
  async _generateSecurityTests(apiTestSpec) {
    const securityTests = {};
    
    securityTests['security-vulnerabilities.test.js'] = await this._generateSecurityVulnerabilityTests(apiTestSpec);
    securityTests['input-validation.test.js'] = await this._generateInputValidationTests(apiTestSpec);
    
    return securityTests;
  }
  
  /**
   * Generate security vulnerability tests
   * @private
   */
  async _generateSecurityVulnerabilityTests(apiTestSpec) {
    const prompt = `Generate security vulnerability tests for Express.js API:

API Endpoints: ${JSON.stringify(apiTestSpec.endpoints, null, 2)}
Authentication: ${JSON.stringify(apiTestSpec.authentication, null, 2)}

Test for these security vulnerabilities:
1. SQL Injection attacks
2. XSS (Cross-Site Scripting) attacks  
3. CSRF (Cross-Site Request Forgery)
4. Authentication bypass attempts
5. Authorization escalation
6. Rate limiting bypass
7. Input validation bypass
8. Header injection attacks
9. Path traversal attacks
10. DoS (Denial of Service) scenarios

Generate comprehensive security tests.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate input validation tests
   * @private
   */
  async _generateInputValidationTests(apiTestSpec) {
    const prompt = `Generate input validation tests for Express.js API:

Endpoints: ${JSON.stringify(apiTestSpec.endpoints, null, 2)}

Requirements:
1. Test malformed JSON payloads
2. Test oversized payloads
3. Test special characters and encoding
4. Test boundary values
5. Test type mismatches
6. Test missing required fields
7. Test extra unexpected fields
8. Test nested object validation

Generate comprehensive input validation tests.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate load tests
   * @private
   */
  async _generateLoadTests(apiTestSpec) {
    const loadTests = {};
    
    loadTests['load-performance.test.js'] = await this._generateLoadPerformanceTests(apiTestSpec);
    
    return loadTests;
  }
  
  /**
   * Generate load/performance tests
   * @private
   */
  async _generateLoadPerformanceTests(apiTestSpec) {
    const prompt = `Generate load and performance tests for Express.js API:

Endpoints: ${JSON.stringify(apiTestSpec.endpoints, null, 2)}

Requirements:
1. Test response time under normal load
2. Test throughput capabilities
3. Test concurrent user scenarios
4. Test memory usage patterns
5. Test database connection pooling
6. Test rate limiting effectiveness
7. Test error rates under load
8. Include stress testing scenarios

Generate comprehensive load and performance tests.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate test helper utilities
   * @private
   */
  async _generateTestHelpers(apiTestSpec) {
    const helpers = {};
    
    helpers['auth-helpers.js'] = await this._generateAuthHelpers(apiTestSpec);
    helpers['data-fixtures.js'] = await this._generateDataFixtures(apiTestSpec);
    helpers['request-helpers.js'] = await this._generateRequestHelpers(apiTestSpec);
    
    return helpers;
  }
  
  /**
   * Generate authentication test helpers
   * @private
   */
  async _generateAuthHelpers(apiTestSpec) {
    const prompt = `Generate authentication helper utilities for Express.js API testing:

Authentication Type: ${apiTestSpec.authentication.type}
Test Cases: ${JSON.stringify(apiTestSpec.authentication.testCases, null, 2)}

Requirements:
1. Helper functions for generating test tokens
2. Helper functions for creating test users
3. Helper functions for login/logout
4. Helper functions for authorization testing
5. Mock authentication middleware
6. Token validation helpers

Generate comprehensive authentication test helpers.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate data fixtures
   * @private
   */
  async _generateDataFixtures(apiTestSpec) {
    const prompt = `Generate test data fixtures for Express.js API testing:

Endpoints: ${JSON.stringify(apiTestSpec.endpoints, null, 2)}
Database: ${apiTestSpec.database.type}
Test Data: ${apiTestSpec.database.testData}

Requirements:
1. Sample data for all endpoints
2. Valid and invalid data variations
3. Edge case data scenarios
4. Database seed data
5. Mock response data
6. User account test data

Generate comprehensive test data fixtures.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate request helper utilities
   * @private
   */
  async _generateRequestHelpers(apiTestSpec) {
    const prompt = `Generate request helper utilities for Express.js API testing:

Endpoints: ${JSON.stringify(apiTestSpec.endpoints, null, 2)}
Authentication: ${JSON.stringify(apiTestSpec.authentication, null, 2)}

Requirements:
1. Helper functions for authenticated requests
2. Helper functions for different HTTP methods
3. Helper functions for request validation
4. Helper functions for response validation
5. Error handling helpers
6. Mock request/response generators

Generate comprehensive request test helpers.`;

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
  async _generateTestPackageJson(apiTestSpec) {
    const dependencies = {};
    const devDependencies = {
      jest: '^29.7.0',
      supertest: '^6.3.3'
    };
    
    // Add framework-specific dependencies
    if (apiTestSpec.testConfiguration.framework === 'jest') {
      devDependencies['@jest/globals'] = '^29.7.0';
    }
    
    // Add database testing dependencies
    if (apiTestSpec.database.type === 'mongodb') {
      devDependencies['mongodb-memory-server'] = '^9.1.1';
    }
    
    // Add specified dependencies
    if (apiTestSpec.dependencies) {
      for (const dep of apiTestSpec.dependencies) {
        devDependencies[dep] = 'latest';
      }
    }
    
    return {
      name: `${apiTestSpec.apiName.toLowerCase().replace(/\s+/g, '-')}-tests`,
      version: '1.0.0',
      description: `Test suite for ${apiTestSpec.apiName}`,
      scripts: {
        test: 'jest',
        'test:watch': 'jest --watch',
        'test:coverage': 'jest --coverage',
        'test:unit': 'jest tests/unit',
        'test:integration': 'jest tests/integration',
        'test:security': 'jest tests/security',
        'test:load': 'jest tests/load'
      },
      dependencies,
      devDependencies,
      jest: {
        testEnvironment: 'node',
        setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
        globalTeardown: '<rootDir>/tests/teardown.js',
        collectCoverageFrom: [
          'src/**/*.js',
          '!src/**/*.test.js'
        ],
        testTimeout: apiTestSpec.testConfiguration.timeout
      },
      keywords: ['express', 'api', 'testing', 'jest'],
      author: 'Generated by TestExpressAPIStrategy',
      license: 'MIT'
    };
  }
  
  /**
   * Generate test README
   * @private
   */
  async _generateTestREADME(apiTestSpec) {
    const prompt = `Generate a comprehensive README.md for this Express.js API test suite:

API Name: ${apiTestSpec.apiName}
Endpoints: ${apiTestSpec.endpoints.length} endpoints
Test Types: ${Object.keys(apiTestSpec.testTypes).filter(t => apiTestSpec.testTypes[t]).join(', ')}

Include:
1. Test suite overview and purpose
2. Prerequisites and setup instructions
3. Running different types of tests
4. Test structure and organization
5. Adding new tests
6. Mock and fixture management
7. CI/CD integration instructions
8. Coverage reporting
9. Performance benchmarks
10. Troubleshooting common issues

Make this professional and comprehensive.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Convert API path to filename
   * @private
   */
  _pathToFilename(path) {
    return path
      .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
      .replace(/[/:]/g, '-') // Replace slashes and colons with dashes
      .replace(/[{}]/g, '') // Remove parameter braces
      .toLowerCase() || 'root';
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
  async _setupTestDirectory(task, apiTestSpec) {
    const projectName = this._generateTestProjectName(apiTestSpec.apiName);
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
  _generateTestProjectName(apiName) {
    const cleanedName = apiName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(' ')
      .filter(word => word.length > 0)
      .join('-');
    
    const timestamp = new Date().toISOString().slice(0, 10);
    
    return `test-express-api-${cleanedName}-${timestamp}`;
  }
}