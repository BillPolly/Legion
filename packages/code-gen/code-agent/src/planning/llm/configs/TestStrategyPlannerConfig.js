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
      name: 'analyze_test_requirements',
      description: 'Analyze testing requirements based on project type and complexity',
      parameters: ['project_analysis'],
      output: 'test_requirements'
    },
    {
      name: 'determine_test_types',
      description: 'Determine which types of tests are needed (unit, integration, e2e)',
      parameters: ['project_analysis', 'test_requirements'],
      output: 'test_types'
    },
    {
      name: 'plan_unit_tests',
      description: 'Plan unit test strategy and coverage targets',
      parameters: ['project_analysis', 'test_requirements'],
      output: 'unit_test_strategy'
    },
    {
      name: 'plan_integration_tests',
      description: 'Plan integration test strategy for component interactions',
      parameters: ['project_analysis', 'test_requirements'],
      output: 'integration_test_strategy'
    },
    {
      name: 'plan_e2e_tests',
      description: 'Plan end-to-end test scenarios for user workflows',
      parameters: ['project_analysis', 'test_requirements'],
      output: 'e2e_test_strategy'
    },
    {
      name: 'define_test_coverage',
      description: 'Define test coverage targets and metrics',
      parameters: ['test_types', 'project_analysis'],
      output: 'coverage_targets'
    },
    {
      name: 'plan_test_data',
      description: 'Plan test data requirements and mock strategies',
      parameters: ['test_types', 'project_analysis'],
      output: 'test_data_strategy'
    },
    {
      name: 'plan_test_environment',
      description: 'Plan test environment setup and configuration',
      parameters: ['test_types', 'project_analysis'],
      output: 'test_environment'
    },
    {
      name: 'create_test_strategy',
      description: 'Create comprehensive test strategy document',
      parameters: [
        'test_types',
        'unit_test_strategy',
        'integration_test_strategy',
        'e2e_test_strategy',
        'coverage_targets',
        'test_data_strategy',
        'test_environment'
      ],
      output: 'test_strategy'
    }
  ],
  
  // Required outputs
  requiredOutputs: ['test_strategy'],
  
  // Maximum planning steps
  maxSteps: 12
};