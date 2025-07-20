/**
 * TestStrategyPlannerConfig - Configuration for test strategy planning
 * 
 * Defines the allowable actions and outputs for planning test strategies
 * based on project analysis and architecture.
 */

export const TestStrategyPlannerConfig = {
  // Actions that can be used in test strategy planning
  allowableActions: [
    {
      type: 'analyze_test_requirements',
      description: 'Analyze testing requirements based on project type and complexity',
      inputs: ['project_analysis'],
      outputs: ['test_requirements'],
      parameters: {
        projectType: { type: 'string', description: 'Type of project' },
        complexity: { type: 'string', description: 'Project complexity' },
        features: { type: 'array', description: 'List of features to test' }
      }
    },
    {
      type: 'determine_test_types',
      description: 'Determine which types of tests are needed (unit, integration, e2e)',
      inputs: ['project_analysis', 'test_requirements'],
      outputs: ['test_types'],
      parameters: {
        types: { type: 'array', description: 'List of test types needed' },
        rationale: { type: 'string', description: 'Reasoning for test type selection' }
      }
    },
    {
      type: 'plan_unit_tests',
      description: 'Plan unit test strategy and coverage targets',
      inputs: ['project_analysis', 'test_requirements'],
      outputs: ['unit_test_strategy'],
      parameters: {
        pattern: { type: 'string', description: 'Unit test pattern to follow' },
        mockExternal: { type: 'boolean', description: 'Whether to mock external dependencies' },
        testDoubles: { type: 'boolean', description: 'Whether to use test doubles' },
        coverage: { type: 'number', description: 'Target coverage percentage' }
      }
    },
    {
      type: 'plan_integration_tests',
      description: 'Plan integration test strategy for component interactions',
      inputs: ['project_analysis', 'test_requirements'],
      outputs: ['integration_test_strategy'],
      parameters: {
        pattern: { type: 'string', description: 'Integration test pattern' },
        testAPIs: { type: 'boolean', description: 'Whether to test APIs' },
        testDatabase: { type: 'boolean', description: 'Whether to test database' },
        coverage: { type: 'number', description: 'Target coverage percentage' }
      }
    },
    {
      type: 'plan_e2e_tests',
      description: 'Plan end-to-end test scenarios for user workflows',
      inputs: ['project_analysis', 'test_requirements'],
      outputs: ['e2e_test_strategy'],
      parameters: {
        pattern: { type: 'string', description: 'E2E test pattern' },
        browsers: { type: 'array', description: 'List of browsers to test' },
        viewport: { type: 'object', description: 'Viewport dimensions' },
        coverage: { type: 'number', description: 'Target coverage percentage' }
      }
    },
    {
      type: 'define_test_coverage',
      description: 'Define test coverage targets and metrics',
      inputs: ['test_types', 'project_analysis'],
      outputs: ['coverage_targets'],
      parameters: {
        overall: { type: 'number', description: 'Overall coverage target' },
        unit: { type: 'number', description: 'Unit test coverage target' },
        integration: { type: 'number', description: 'Integration test coverage target' },
        e2e: { type: 'number', description: 'E2E test coverage target' }
      }
    },
    {
      type: 'plan_test_data',
      description: 'Plan test data requirements and mock strategies',
      inputs: ['test_types', 'project_analysis'],
      outputs: ['test_data_strategy'],
      parameters: {
        approach: { type: 'string', description: 'Test data approach' },
        locations: { type: 'array', description: 'Test data locations' },
        mocking: { type: 'boolean', description: 'Whether to use mocking' }
      }
    },
    {
      type: 'plan_test_environment',
      description: 'Plan test environment setup and configuration',
      inputs: ['test_types', 'project_analysis'],
      outputs: ['test_environment'],
      parameters: {
        framework: { type: 'string', description: 'Test framework to use' },
        runner: { type: 'string', description: 'Test runner to use' },
        browsers: { type: 'array', description: 'Browsers for testing' }
      }
    },
    {
      type: 'create_test_strategy',
      description: 'Create comprehensive test strategy document',
      inputs: [
        'test_types',
        'unit_test_strategy',
        'integration_test_strategy',
        'e2e_test_strategy',
        'coverage_targets',
        'test_data_strategy',
        'test_environment'
      ],
      outputs: ['test_strategy'],
      parameters: {
        testTypes: { type: 'object', description: 'Enabled test types and coverage' },
        coverageTargets: { type: 'object', description: 'Coverage targets' },
        testEnvironment: { type: 'object', description: 'Test environment configuration' },
        testData: { type: 'object', description: 'Test data configuration' }
      }
    }
  ],
  
  // Required outputs
  requiredOutputs: ['test_strategy'],
  
  // Maximum planning steps
  maxSteps: 12
};