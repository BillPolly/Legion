/**
 * TestGenerator - Generates comprehensive Jest test suites
 * 
 * Creates unit tests, integration tests, end-to-end tests, and test utilities
 * based on code analysis and testing specifications.
 */

class TestGenerator {
  constructor(config = {}) {
    this.config = {
      framework: 'jest', // 'jest', 'mocha', 'jasmine'
      testPattern: '**/*.test.js',
      coverage: {
        threshold: 80,
        functions: 80,
        branches: 80,
        lines: 80,
        statements: 80
      },
      mocking: 'jest', // 'jest', 'sinon', 'none'
      assertions: 'jest', // 'jest', 'chai', 'expect'
      setup: true,
      teardown: true,
      async: true,
      ...config
    };

    // Test patterns and templates
    this.patterns = {
      unit: this._getUnitTestPattern(),
      integration: this._getIntegrationTestPattern(),
      e2e: this._getE2ETestPattern(),
      mock: this._getMockPattern()
    };

    // Common test data generators
    this.testDataGenerators = {
      string: () => 'test-string',
      number: () => 42,
      boolean: () => true,
      array: () => [1, 2, 3],
      object: () => ({ key: 'value' }),
      date: () => new Date('2023-01-01'),
      null: () => null,
      undefined: () => undefined
    };

    // Test cache for performance
    this.testCache = new Map();
  }

  /**
   * Generate complete test suite
   * 
   * @param {Object} spec - Test specification
   * @returns {Promise<string>} Generated test code
   */
  async generateTestSuite(spec) {
    const validation = await this.validateSpec(spec);
    if (!validation.isValid) {
      throw new Error(`Invalid test spec: ${validation.errors.join(', ')}`);
    }

    const parts = [];

    // Add test file header
    if (spec.header) {
      parts.push(this._generateHeader(spec));
    }

    // Add imports and setup
    parts.push(this._generateImports(spec));

    // Add test setup
    if (spec.setup || this.config.setup) {
      parts.push(this._generateSetup(spec.setup || this.config.setup));
    }

    // Add mock definitions
    if (spec.mocks) {
      parts.push(this._generateMocks(spec.mocks));
    }

    // Add test suites
    if (spec.testSuites) {
      for (const suite of spec.testSuites) {
        parts.push(await this.generateTestSuite(suite));
      }
    }

    // Add individual tests
    if (spec.tests) {
      for (const test of spec.tests) {
        parts.push(await this.generateTest(test));
      }
    }

    // Add teardown
    if (spec.teardown || this.config.teardown) {
      parts.push(this._generateTeardown(spec.teardown));
    }

    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * Generate unit test for a function
   * 
   * @param {Object} functionSpec - Function specification
   * @returns {Promise<string>} Generated unit test
   */
  async generateUnitTest(functionSpec) {
    const {
      name,
      params = [],
      returnType,
      module,
      async: isAsync = false,
      cases = []
    } = functionSpec;

    const testCases = cases.length > 0 ? cases : this._generateDefaultTestCases(functionSpec);
    const tests = [];

    for (const testCase of testCases) {
      tests.push(await this._generateTestCase(name, testCase, isAsync));
    }

    const suiteBody = tests.join('\n\n');
    
    return `describe('${name}', () => {\n${this._indentCode(suiteBody)}\n});`;
  }

  /**
   * Generate integration test
   * 
   * @param {Object} integrationSpec - Integration test specification
   * @returns {Promise<string>} Generated integration test
   */
  async generateIntegrationTest(integrationSpec) {
    const {
      name,
      components = [],
      workflow = [],
      setup,
      teardown,
      mocks = []
    } = integrationSpec;

    const parts = [];

    // Setup mocks for integration
    if (mocks.length > 0) {
      parts.push(this._generateIntegrationMocks(mocks));
    }

    // Setup integration environment
    if (setup) {
      parts.push(`beforeEach(async () => {\n${this._indentCode(setup)}\n});`);
    }

    // Generate workflow tests
    const workflowTests = [];
    for (const step of workflow) {
      workflowTests.push(await this._generateWorkflowStep(step));
    }

    if (workflowTests.length > 0) {
      parts.push(workflowTests.join('\n\n'));
    }

    // Teardown integration environment
    if (teardown) {
      parts.push(`afterEach(async () => {\n${this._indentCode(teardown)}\n});`);
    }

    const suiteBody = parts.join('\n\n');
    
    return `describe('${name} Integration', () => {\n${this._indentCode(suiteBody)}\n});`;
  }

  /**
   * Generate API test
   * 
   * @param {Object} apiSpec - API test specification
   * @returns {Promise<string>} Generated API test
   */
  async generateAPITest(apiSpec) {
    const {
      endpoint,
      method = 'GET',
      baseUrl = '',
      auth = null,
      testCases = []
    } = apiSpec;

    const tests = [];

    // Generate tests for different scenarios
    const scenarios = testCases.length > 0 ? testCases : this._generateDefaultAPIScenarios(apiSpec);
    
    for (const scenario of scenarios) {
      tests.push(await this._generateAPITestCase(endpoint, method, scenario));
    }

    const suiteBody = tests.join('\n\n');
    
    return `describe('${method} ${endpoint}', () => {\n${this._indentCode(suiteBody)}\n});`;
  }

  /**
   * Generate component test (for UI components)
   * 
   * @param {Object} componentSpec - Component test specification
   * @returns {Promise<string>} Generated component test
   */
  async generateComponentTest(componentSpec) {
    const {
      name,
      props = {},
      events = [],
      states = [],
      rendering = true,
      interactions = true
    } = componentSpec;

    const tests = [];

    // Rendering tests
    if (rendering) {
      tests.push(this._generateRenderingTest(name, props));
    }

    // Props tests
    if (Object.keys(props).length > 0) {
      tests.push(this._generatePropsTests(name, props));
    }

    // Event tests
    if (events.length > 0) {
      for (const event of events) {
        tests.push(this._generateEventTest(name, event));
      }
    }

    // State tests
    if (states.length > 0) {
      for (const state of states) {
        tests.push(this._generateStateTest(name, state));
      }
    }

    // Interaction tests
    if (interactions) {
      tests.push(this._generateInteractionTests(name));
    }

    const suiteBody = tests.join('\n\n');
    
    return `describe('${name} Component', () => {\n${this._indentCode(suiteBody)}\n});`;
  }

  /**
   * Generate test for individual test case
   * 
   * @param {Object} testSpec - Test specification
   * @returns {Promise<string>} Generated test
   */
  async generateTest(testSpec) {
    const {
      description,
      type = 'unit', // 'unit', 'integration', 'e2e'
      async: isAsync = false,
      setup,
      teardown,
      assertions = [],
      timeout
    } = testSpec;

    const testFunction = isAsync ? 'async () => {' : '() => {';
    const testBody = [];

    // Add setup if provided
    if (setup) {
      testBody.push(setup);
      testBody.push('');
    }

    // Add test logic
    if (testSpec.arrange) {
      testBody.push('// Arrange');
      testBody.push(testSpec.arrange);
      testBody.push('');
    }

    if (testSpec.act) {
      testBody.push('// Act');
      testBody.push(testSpec.act);
      testBody.push('');
    }

    if (testSpec.assert || assertions.length > 0) {
      testBody.push('// Assert');
      if (testSpec.assert) {
        testBody.push(testSpec.assert);
      }
      for (const assertion of assertions) {
        testBody.push(this._generateAssertion(assertion));
      }
    }

    // Add teardown if provided
    if (teardown) {
      testBody.push('');
      testBody.push(teardown);
    }

    const testContent = this._indentCode(testBody.join('\n'));
    const timeoutConfig = timeout ? `, ${timeout}` : '';
    
    return `test('${description}', ${testFunction}\n${testContent}\n}${timeoutConfig});`;
  }

  /**
   * Validate test specification
   * 
   * @param {Object} spec - Specification to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateSpec(spec) {
    const errors = [];

    if (!spec || typeof spec !== 'object') {
      errors.push('Specification must be an object');
      return { isValid: false, errors };
    }

    // Validate test suites
    if (spec.testSuites) {
      if (!Array.isArray(spec.testSuites)) {
        errors.push('Test suites must be an array');
      }
    }

    // Validate individual tests
    if (spec.tests) {
      if (!Array.isArray(spec.tests)) {
        errors.push('Tests must be an array');
      } else {
        spec.tests.forEach((test, index) => {
          if (!test.description) {
            errors.push(`Test at index ${index} missing description`);
          }
        });
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  // Private helper methods

  _generateHeader(spec) {
    const lines = [];
    lines.push('/**');
    
    if (spec.description) {
      lines.push(` * ${spec.description}`);
    } else if (spec.name) {
      lines.push(` * Test suite for ${spec.name}`);
    }
    
    lines.push(' * @generated by TestGenerator');
    lines.push(` * @date ${new Date().toISOString()}`);
    lines.push(' */');
    
    return lines.join('\n');
  }

  _generateImports(spec) {
    const imports = [];
    
    // Default Jest imports
    if (this.config.framework === 'jest') {
      imports.push("import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';");
    }

    // Import modules under test
    if (spec.imports) {
      for (const imp of spec.imports) {
        if (typeof imp === 'string') {
          imports.push(`import '${imp}';`);
        } else {
          imports.push(`import { ${imp.named.join(', ')} } from '${imp.from}';`);
        }
      }
    }

    // Import test utilities
    if (spec.testUtils) {
      imports.push("import { setupTestEnvironment, cleanupTestEnvironment } from './testUtils';");
    }

    return imports.join('\n');
  }

  _generateSetup(setup) {
    if (typeof setup === 'string') {
      return `beforeEach(() => {\n${this._indentCode(setup)}\n});`;
    }
    
    // If setup is boolean true or undefined/null, provide default setup
    if (!setup || typeof setup === 'boolean') {
      return `beforeEach(() => {\n${this._indentCode('// Setup code here')}\n});`;
    }
    
    const setupCode = setup.code || '// Setup code here';
    const isAsync = setup.async || false;
    const asyncKeyword = isAsync ? 'async ' : '';
    
    return `beforeEach(${asyncKeyword}() => {\n${this._indentCode(setupCode)}\n});`;
  }

  _generateTeardown(teardown) {
    if (typeof teardown === 'string') {
      return `afterEach(() => {\n${this._indentCode(teardown)}\n});`;
    }
    
    // If teardown is boolean true or undefined/null, provide default teardown
    if (!teardown || typeof teardown === 'boolean') {
      return `afterEach(() => {\n${this._indentCode('// Teardown code here')}\n});`;
    }
    
    const teardownCode = teardown.code || '// Teardown code here';
    const isAsync = teardown.async || false;
    const asyncKeyword = isAsync ? 'async ' : '';
    
    return `afterEach(${asyncKeyword}() => {\n${this._indentCode(teardownCode)}\n});`;
  }

  _generateMocks(mocks) {
    const mockDefinitions = [];
    
    for (const mock of mocks) {
      if (mock.type === 'function') {
        mockDefinitions.push(`const ${mock.name} = jest.fn(${mock.implementation || ''});`);
      } else if (mock.type === 'module') {
        mockDefinitions.push(`jest.mock('${mock.path}', () => (${mock.implementation || '{}'}));`);
      } else if (mock.type === 'object') {
        mockDefinitions.push(`const ${mock.name} = ${JSON.stringify(mock.value, null, 2)};`);
      }
    }
    
    return mockDefinitions.join('\n');
  }

  _generateDefaultTestCases(functionSpec) {
    const { params = [], returnType } = functionSpec;
    const testCases = [];

    // Happy path test
    testCases.push({
      description: 'should work with valid inputs',
      inputs: params.map(param => this._generateTestData(param.type || 'string')),
      expected: this._generateTestData(returnType || 'any'),
      type: 'success'
    });

    // Edge cases
    if (params.length > 0) {
      testCases.push({
        description: 'should handle edge cases',
        inputs: params.map(() => null),
        expected: null,
        type: 'edge'
      });
    }

    // Error cases
    testCases.push({
      description: 'should handle invalid inputs',
      inputs: params.map(() => undefined),
      shouldThrow: true,
      type: 'error'
    });

    return testCases;
  }

  _generateTestCase(functionName, testCase, isAsync) {
    const { description, inputs = [], expected, shouldThrow = false } = testCase;
    const asyncKeyword = isAsync ? 'async ' : '';
    const awaitKeyword = isAsync ? 'await ' : '';

    const inputsStr = inputs.map(input => JSON.stringify(input)).join(', ');
    
    let testBody;
    if (shouldThrow) {
      testBody = `expect(${asyncKeyword}() => ${awaitKeyword}${functionName}(${inputsStr})).${isAsync ? 'rejects.' : ''}toThrow();`;
    } else {
      testBody = `const result = ${awaitKeyword}${functionName}(${inputsStr});\n  expect(result).toEqual(${JSON.stringify(expected)});`;
    }

    return `test('${description}', ${asyncKeyword}() => {\n${this._indentCode(testBody)}\n});`;
  }

  _generateWorkflowStep(step) {
    const { description, action, assertions = [] } = step;
    
    const testBody = [action];
    
    for (const assertion of assertions) {
      testBody.push(this._generateAssertion(assertion));
    }

    return `test('${description}', async () => {\n${this._indentCode(testBody.join('\n'))}\n});`;
  }

  _generateAPITestCase(endpoint, method, scenario) {
    const { description, data, headers = {}, expectedStatus = 200, expectedData } = scenario;
    
    const testBody = [];
    testBody.push(`const response = await request(app)`);
    testBody.push(`  .${method.toLowerCase()}('${endpoint}')`);
    
    if (data) {
      testBody.push(`  .send(${JSON.stringify(data)})`);
    }
    
    for (const [key, value] of Object.entries(headers)) {
      testBody.push(`  .set('${key}', '${value}')`);
    }
    
    testBody.push(`  .expect(${expectedStatus});`);
    
    if (expectedData) {
      testBody.push('');
      testBody.push(`expect(response.body).toMatchObject(${JSON.stringify(expectedData, null, 2)});`);
    }

    return `test('${description}', async () => {\n${this._indentCode(testBody.join('\n'))}\n});`;
  }

  _generateRenderingTest(componentName, props) {
    const propsStr = Object.keys(props).length > 0 ? JSON.stringify(props) : '';
    
    return `test('should render without crashing', () => {\n  const component = render(<${componentName} ${propsStr} />);\n  expect(component).toBeTruthy();\n});`;
  }

  _generatePropsTests(componentName, props) {
    const tests = [];
    
    for (const [propName, propValue] of Object.entries(props)) {
      tests.push(`test('should handle ${propName} prop', () => {\n  const { getByTestId } = render(<${componentName} ${propName}={${JSON.stringify(propValue)}} />);\n  // Add specific assertions for ${propName}\n});`);
    }
    
    return tests.join('\n\n');
  }

  _generateEventTest(componentName, event) {
    const { name, trigger, assertion } = event;
    
    return `test('should handle ${name} event', () => {\n  const ${name}Handler = jest.fn();\n  const { ${trigger.selector} } = render(<${componentName} ${name}={${name}Handler} />);\n  \n  ${trigger.action}\n  \n  expect(${name}Handler).toHaveBeenCalled();\n});`;
  }

  _generateStateTest(componentName, state) {
    const { name, initialValue, action, expectedValue } = state;
    
    return `test('should manage ${name} state', () => {\n  const { getByTestId, rerender } = render(<${componentName} />);\n  \n  // Initial state\n  expect(getByTestId('${name}')).toHaveTextContent('${initialValue}');\n  \n  // State change\n  ${action}\n  \n  // Updated state\n  expect(getByTestId('${name}')).toHaveTextContent('${expectedValue}');\n});`;
  }

  _generateInteractionTests(componentName) {
    return `test('should handle user interactions', () => {\n  const { getByRole } = render(<${componentName} />);\n  \n  // Test interactions\n  // TODO: Add specific interaction tests\n});`;
  }

  _generateAssertion(assertion) {
    const { type, actual, expected, not = false } = assertion;
    const notStr = not ? '.not' : '';
    
    switch (type) {
      case 'equal':
        return `expect(${actual})${notStr}.toEqual(${JSON.stringify(expected)});`;
      case 'toBe':
        return `expect(${actual})${notStr}.toBe(${JSON.stringify(expected)});`;
      case 'toContain':
        return `expect(${actual})${notStr}.toContain(${JSON.stringify(expected)});`;
      case 'toThrow':
        return `expect(${actual})${notStr}.toThrow();`;
      case 'toBeTruthy':
        return `expect(${actual})${notStr}.toBeTruthy();`;
      case 'toBeFalsy':
        return `expect(${actual})${notStr}.toBeFalsy();`;
      default:
        return `expect(${actual})${notStr}.${type}(${expected ? JSON.stringify(expected) : ''});`;
    }
  }

  _generateDefaultAPIScenarios(apiSpec) {
    const scenarios = [];
    
    // Success scenario
    scenarios.push({
      description: 'should return success response',
      expectedStatus: 200,
      expectedData: { success: true }
    });
    
    // Error scenarios
    if (apiSpec.method !== 'GET') {
      scenarios.push({
        description: 'should handle invalid data',
        data: {},
        expectedStatus: 400
      });
    }
    
    scenarios.push({
      description: 'should handle server errors',
      expectedStatus: 500
    });
    
    return scenarios;
  }

  _generateIntegrationMocks(mocks) {
    return mocks.map(mock => `jest.mock('${mock.module}', () => (${mock.implementation}));`).join('\n');
  }

  _generateTestData(type) {
    return this.testDataGenerators[type] ? this.testDataGenerators[type]() : 'test-value';
  }

  _indentCode(code, level = 1) {
    const indent = '  '.repeat(level);
    return code.split('\n').map(line => line.trim() ? `${indent}${line}` : line).join('\n');
  }

  // Pattern generators
  _getUnitTestPattern() {
    return {
      function: 'describe(\'{name}\', () => {\n  {tests}\n});',
      class: 'describe(\'{name} class\', () => {\n  {tests}\n});'
    };
  }

  _getIntegrationTestPattern() {
    return {
      workflow: 'describe(\'{name} integration\', () => {\n  {setup}\n  {tests}\n  {teardown}\n});'
    };
  }

  _getE2ETestPattern() {
    return {
      scenario: 'describe(\'{name} E2E\', () => {\n  {tests}\n});'
    };
  }

  _getMockPattern() {
    return {
      function: 'const {name} = jest.fn();',
      module: 'jest.mock(\'{path}\', () => ({implementation}));'
    };
  }
}

export { TestGenerator };