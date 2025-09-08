/**
 * TestGenerationAgent - BT Agent for Test-Driven Development
 * 
 * Extends SDAgentBase to generate comprehensive test suites,
 * test fixtures, mocks, and test strategies following TDD
 */

import { SDAgentBase } from './SDAgentBase.js';

export class TestGenerationAgent extends SDAgentBase {
  constructor(config) {
    super({
      ...config,
      name: 'TestGenerationAgent',
      description: 'Generates comprehensive test suites following TDD principles',
      methodologyRules: {
        unitTest: {
          mustTestOneUnit: (artifact) => artifact.unitsUnderTest === 1,
          mustBeIsolated: (artifact) => artifact.isolated === true,
          mustHaveMocks: (artifact) => artifact.mocks && Array.isArray(artifact.mocks),
          mustBeFast: (artifact) => artifact.executionTime === undefined || artifact.executionTime < 100
        },
        integrationTest: {
          mustTestInteraction: (artifact) => artifact.testsInteraction === true,
          mustHaveRealDependencies: (artifact) => artifact.usesRealDependencies === true,
          mustValidateContracts: (artifact) => artifact.validatesContracts === true
        },
        testCase: {
          mustHaveArrange: (artifact) => artifact.arrange !== undefined,
          mustHaveAct: (artifact) => artifact.act !== undefined,
          mustHaveAssert: (artifact) => artifact.assert !== undefined,
          mustHaveDescription: (artifact) => artifact.description && artifact.description.length > 0
        },
        coverage: {
          mustCoverAllPublicMethods: (artifact) => artifact.publicMethodCoverage === 100,
          mustCoverEdgeCases: (artifact) => artifact.edgeCasesCovered === true,
          mustCoverErrorPaths: (artifact) => artifact.errorPathsCovered === true
        }
      }
    });
    
    this.workflowConfig = this.createWorkflowConfig();
  }

  getCurrentPhase() {
    return 'test-generation';
  }

  createWorkflowConfig() {
    return {
      type: 'sequence',
      id: 'test-generation-workflow',
      description: 'Generate comprehensive test suites',
      children: [
        {
          type: 'action',
          id: 'retrieve-all-artifacts',
          tool: 'retrieve_context',
          description: 'Retrieve all design artifacts',
          params: {
            query: {
              types: ['clean-architecture', 'state-design', 'flux-architecture'],
              projectId: '${input.projectId}'
            }
          }
        },
        {
          type: 'action',
          id: 'analyze-testable-components',
          tool: 'analyze_testable_components',
          description: 'Identify all testable components',
          params: {
            artifacts: '${results.retrieve-all-artifacts.context}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'parallel',
          id: 'generate-test-suites',
          description: 'Generate different test types in parallel',
          children: [
            {
              type: 'action',
              id: 'generate-unit-tests',
              tool: 'generate_unit_tests',
              description: 'Generate unit tests',
              params: {
                components: '${results.analyze-testable-components.components}',
                projectId: '${input.projectId}'
              }
            },
            {
              type: 'action',
              id: 'generate-integration-tests',
              tool: 'generate_integration_tests',
              description: 'Generate integration tests',
              params: {
                components: '${results.analyze-testable-components.components}',
                projectId: '${input.projectId}'
              }
            },
            {
              type: 'action',
              id: 'generate-e2e-tests',
              tool: 'generate_e2e_tests',
              description: 'Generate end-to-end tests',
              params: {
                userStories: '${results.retrieve-all-artifacts.context.requirements}',
                projectId: '${input.projectId}'
              }
            }
          ]
        },
        {
          type: 'action',
          id: 'generate-test-fixtures',
          tool: 'generate_test_fixtures',
          description: 'Generate test fixtures and data',
          params: {
            entities: '${results.retrieve-all-artifacts.context.domain.entities}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'action',
          id: 'generate-mocks',
          tool: 'generate_mocks',
          description: 'Generate mocks and stubs',
          params: {
            interfaces: '${results.retrieve-all-artifacts.context.architecture.interfaces}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'action',
          id: 'calculate-coverage',
          tool: 'calculate_coverage',
          description: 'Calculate test coverage metrics',
          params: {
            unitTests: '${results.generate-unit-tests.tests}',
            integrationTests: '${results.generate-integration-tests.tests}',
            e2eTests: '${results.generate-e2e-tests.tests}',
            components: '${results.analyze-testable-components.components}'
          }
        },
        {
          type: 'action',
          id: 'validate-test-quality',
          tool: 'validate_test_quality',
          description: 'Validate test quality and coverage',
          params: {
            coverage: '${results.calculate-coverage.coverage}',
            tests: {
              unit: '${results.generate-unit-tests.tests}',
              integration: '${results.generate-integration-tests.tests}',
              e2e: '${results.generate-e2e-tests.tests}'
            }
          }
        },
        {
          type: 'action',
          id: 'store-test-artifacts',
          tool: 'store_artifact',
          description: 'Store test generation artifacts',
          params: {
            artifact: {
              type: 'test-suite',
              data: {
                unitTests: '${results.generate-unit-tests.tests}',
                integrationTests: '${results.generate-integration-tests.tests}',
                e2eTests: '${results.generate-e2e-tests.tests}',
                fixtures: '${results.generate-test-fixtures.fixtures}',
                mocks: '${results.generate-mocks.mocks}',
                coverage: '${results.calculate-coverage.coverage}',
                validation: '${results.validate-test-quality}'
              },
              metadata: {
                phase: 'test-generation',
                agentId: '${agent.id}',
                timestamp: '${timestamp}'
              }
            },
            projectId: '${input.projectId}'
          }
        }
      ]
    };
  }

  async receive(message) {
    const { type, payload } = message;
    
    if (type !== 'generate_tests') {
      return {
        success: false,
        error: 'TestGenerationAgent only handles generate_tests messages'
      };
    }
    
    try {
      // Build context for test generation
      const context = await this.buildContext('testing', {
        projectId: payload.projectId
      });
      
      // Determine test strategy using LLM
      const testStrategy = await this.decideTestStrategy(context);
      
      // Create execution context
      const executionContext = this.createExecutionContext({
        input: {
          projectId: payload.projectId,
          testStrategy
        },
        context,
        agent: {
          id: this.id,
          name: this.name
        },
        timestamp: new Date().toISOString()
      });
      
      // Execute BT workflow
      const result = await this.executeBTWorkflow(this.workflowConfig, executionContext);
      
      // Validate test suite
      const validation = this.validateTestSuite(result);
      
      return {
        success: result.success,
        data: {
          ...result.data,
          validation,
          testStrategy,
          projectId: executionContext.input.projectId,
          phase: this.getCurrentPhase()
        }
      };
      
    } catch (error) {
      console.error(`[TestGenerationAgent] Error generating tests:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async decideTestStrategy(context) {
    const prompt = `Based on the application design, determine the test generation strategy:

Architecture Context:
${JSON.stringify(context.artifacts.architecture, null, 2)}

Domain Context:
${JSON.stringify(context.artifacts.domain, null, 2)}

State Context:
${JSON.stringify(context.artifacts.state, null, 2)}

Determine the test strategy including:
1. Test framework (Jest, Mocha, Vitest, etc.)
2. Coverage targets (percentage for each type)
3. Mock strategy (manual mocks, auto-mocks, test doubles)
4. Test organization (by feature, by layer, by type)
5. Priority focus (critical paths, complex logic, integrations)
6. Performance testing approach

Return as JSON:
{
  "framework": "jest|mocha|vitest|cypress",
  "coverageTargets": {
    "unit": 80,
    "integration": 70,
    "e2e": 60,
    "overall": 75
  },
  "mockStrategy": "manual|auto|hybrid",
  "organization": "by-feature|by-layer|by-type",
  "priorityFocus": ["critical-paths", "complex-logic", "integrations"],
  "performanceTesting": {
    "enabled": true/false,
    "thresholds": {
      "responseTime": 100,
      "throughput": 1000
    }
  },
  "reasoning": "explanation"
}`;

    const decision = await this.makeLLMDecision(prompt, context);
    return decision;
  }

  async executeBTWorkflow(workflow, context) {
    console.log(`[TestGenerationAgent] Executing workflow:`, workflow.id);
    
    // Placeholder implementation
    return {
      success: true,
      data: {
        workflowId: workflow.id,
        executionTime: Date.now(),
        results: {
          'analyze-testable-components': {
            components: [
              {
                id: 'comp-user-service',
                name: 'UserService',
                type: 'service',
                methods: ['create', 'update', 'delete', 'find']
              }
            ]
          },
          'generate-unit-tests': {
            tests: [
              {
                id: 'test-user-service-create',
                name: 'UserService.create',
                type: 'unit',
                unitsUnderTest: 1,
                isolated: true,
                mocks: ['database'],
                arrange: 'Setup mock database',
                act: 'Call create method',
                assert: 'Verify user created',
                description: 'Should create a new user'
              }
            ]
          },
          'generate-integration-tests': {
            tests: [
              {
                id: 'test-user-workflow',
                name: 'User creation workflow',
                type: 'integration',
                testsInteraction: true,
                usesRealDependencies: true,
                validatesContracts: true,
                arrange: 'Setup database',
                act: 'Execute workflow',
                assert: 'Verify end state',
                description: 'Should complete user creation workflow'
              }
            ]
          },
          'generate-e2e-tests': {
            tests: [
              {
                id: 'test-user-journey',
                name: 'User registration journey',
                type: 'e2e',
                userStory: 'As a user, I want to register',
                steps: ['Navigate', 'Fill form', 'Submit', 'Verify']
              }
            ]
          },
          'generate-test-fixtures': {
            fixtures: [
              {
                id: 'fixture-user',
                entity: 'User',
                data: { id: '1', name: 'Test User' }
              }
            ]
          },
          'generate-mocks': {
            mocks: [
              {
                id: 'mock-repository',
                interface: 'IUserRepository',
                methods: ['save', 'find', 'delete']
              }
            ]
          },
          'calculate-coverage': {
            coverage: {
              unit: 85,
              integration: 75,
              e2e: 65,
              overall: 78,
              publicMethodCoverage: 100,
              edgeCasesCovered: true,
              errorPathsCovered: true
            }
          }
        }
      }
    };
  }

  validateTestSuite(result) {
    const validationResults = {
      valid: true,
      violations: [],
      warnings: []
    };
    
    // Validate unit tests
    const unitTests = result.data?.results?.['generate-unit-tests']?.tests || [];
    unitTests.forEach(test => {
      const validation = this.validateMethodology({ ...test, type: 'unitTest' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `unit-test-${test.id}`,
          violations: validation.violations
        });
      }
    });
    
    // Validate integration tests
    const integrationTests = result.data?.results?.['generate-integration-tests']?.tests || [];
    integrationTests.forEach(test => {
      const validation = this.validateMethodology({ ...test, type: 'integrationTest' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `integration-test-${test.id}`,
          violations: validation.violations
        });
      }
    });
    
    // Validate test cases structure
    [...unitTests, ...integrationTests].forEach(test => {
      const validation = this.validateMethodology({ ...test, type: 'testCase' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `test-case-${test.id}`,
          violations: validation.violations
        });
      }
    });
    
    // Validate coverage
    const coverage = result.data?.results?.['calculate-coverage']?.coverage;
    if (coverage) {
      const validation = this.validateMethodology({ ...coverage, type: 'coverage' });
      if (!validation.valid) {
        validationResults.warnings.push({
          artifact: 'coverage',
          warnings: validation.violations
        });
      }
    }
    
    return validationResults;
  }

  getMetadata() {
    return {
      type: 'test-generation',
      name: this.name,
      phase: this.getCurrentPhase(),
      capabilities: [
        'analyze_testable_components',
        'generate_unit_tests',
        'generate_integration_tests',
        'generate_e2e_tests',
        'generate_test_fixtures',
        'generate_mocks',
        'calculate_coverage',
        'validate_test_quality'
      ],
      methodologyRules: Object.keys(this.methodologyRules),
      testPatterns: [
        'AAA Pattern (Arrange-Act-Assert)',
        'Test Isolation',
        'Test Doubles',
        'Coverage Analysis',
        'TDD Cycle'
      ]
    };
  }
}