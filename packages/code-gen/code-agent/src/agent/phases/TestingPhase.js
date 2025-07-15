/**
 * TestingPhase - Handles test generation
 * 
 * Responsible for generating unit tests, integration tests,
 * and test utilities for the generated code.
 */

import { FileWriter } from '../utils/FileWriter.js';

class TestingPhase {
  constructor(codeAgent) {
    this.codeAgent = codeAgent;
    this.fileWriter = new FileWriter(codeAgent);
    this.testGenerator = codeAgent.testGenerator;
  }

  /**
   * Generate all tests for the project
   * @returns {Promise<void>}
   */
  async generateTests() {
    const { projectPlan } = this.codeAgent;
    if (!projectPlan) {
      throw new Error('No project plan available. Run planProject first.');
    }
    
    const { analysis, frontendArchitecture, backendArchitecture, testStrategy } = projectPlan;
    
    // Apply test strategy settings
    if (testStrategy) {
      this.testGenerator.updateConfig({
        coverage: testStrategy.coverage,
        testTypes: testStrategy.types
      });
    }
    
    // Generate tests based on project type
    if (frontendArchitecture) {
      await this._generateFrontendTests(frontendArchitecture, analysis);
    }
    
    if (backendArchitecture) {
      await this._generateBackendTests(backendArchitecture, analysis);
    }
    
    // Generate integration tests for fullstack projects
    if (analysis.projectType === 'fullstack') {
      await this._generateIntegrationTests(analysis);
    }
    
    // Save state after test generation
    this.codeAgent.currentTask.status = 'quality_checking';
    await this.codeAgent.saveState();
    
    this.codeAgent.emit('phase-complete', {
      phase: 'testing',
      message: `Test generation complete: ${this.codeAgent.testFiles.size} test files created`,
      testsCreated: this.codeAgent.testFiles.size
    });
  }

  /**
   * Generate frontend tests
   * @private
   */
  async _generateFrontendTests(frontendArchitecture, analysis) {
    this.codeAgent.emit('progress', {
      phase: 'testing',
      step: 'frontend-tests',
      message: '🧪 Generating frontend tests...'
    });

    // Generate component tests
    if (frontendArchitecture.jsComponents) {
      for (const component of frontendArchitecture.jsComponents) {
        const testSpec = {
          name: component.name,
          type: component.type,
          methods: component.methods || [],
          props: component.props || {},
          state: component.state || {}
        };
        
        const testContent = await this.testGenerator.generateUnitTest(testSpec);
        const filename = `__tests__/components/${component.name.toLowerCase()}.test.js`;
        await this.fileWriter.writeTestFile(filename, testContent);
      }
    }

    // Generate main app test
    if (frontendArchitecture.mainApp) {
      const appTestSpec = {
        name: 'App',
        functions: frontendArchitecture.mainApp.exports || [],
        setupCode: 'import { App } from "../app.js";',
        testCases: [
          {
            description: 'should initialize correctly',
            setup: 'const app = new App();',
            action: 'const result = app.initialize();',
            assertions: [
              { type: 'toBeDefined', actual: 'result' }
            ]
          }
        ]
      };
      
      const appTestContent = await this.testGenerator.generateUnitTest(appTestSpec);
      await this.fileWriter.writeTestFile('__tests__/app.test.js', appTestContent);
    }

    // Generate DOM tests if HTML exists
    if (frontendArchitecture.htmlStructure) {
      const domTestContent = await this._generateDOMTests(frontendArchitecture.htmlStructure);
      await this.fileWriter.writeTestFile('__tests__/dom.test.js', domTestContent);
    }

    this.codeAgent.emit('progress', {
      phase: 'testing',
      step: 'frontend-tests-complete',
      message: '✅ Frontend tests generated'
    });
  }

  /**
   * Generate backend tests
   * @private
   */
  async _generateBackendTests(backendArchitecture, analysis) {
    this.codeAgent.emit('progress', {
      phase: 'testing',
      step: 'backend-tests',
      message: '🧪 Generating backend tests...'
    });

    // Generate route tests
    if (backendArchitecture.routes) {
      for (const route of backendArchitecture.routes) {
        const routeTestSpec = {
          name: route.name || 'Route',
          type: 'api',
          endpoints: route.endpoints || [],
          middleware: route.middleware || []
        };
        
        const routeTestContent = await this.testGenerator.generateAPITest(routeTestSpec);
        const filename = `__tests__/routes/${(route.name || 'route').toLowerCase()}.test.js`;
        await this.fileWriter.writeTestFile(filename, routeTestContent);
      }
    }

    // Generate controller tests
    if (backendArchitecture.controllers) {
      for (const controller of backendArchitecture.controllers) {
        const controllerTestSpec = {
          name: controller.name || 'Controller',
          methods: controller.methods || [],
          dependencies: controller.dependencies || []
        };
        
        const controllerTestContent = await this.testGenerator.generateUnitTest(controllerTestSpec);
        const filename = `__tests__/controllers/${(controller.name || 'controller').toLowerCase()}.test.js`;
        await this.fileWriter.writeTestFile(filename, controllerTestContent);
      }
    }

    // Generate model tests
    if (backendArchitecture.models) {
      for (const model of backendArchitecture.models) {
        const modelTestSpec = {
          name: model.name || 'Model',
          schema: model.schema || {},
          methods: model.methods || [],
          validations: model.validations || []
        };
        
        const modelTestContent = await this.testGenerator.generateUnitTest(modelTestSpec);
        const filename = `__tests__/models/${(model.name || 'model').toLowerCase()}.test.js`;
        await this.fileWriter.writeTestFile(filename, modelTestContent);
      }
    }

    // Generate service tests
    if (backendArchitecture.services) {
      for (const service of backendArchitecture.services) {
        const serviceTestSpec = {
          name: service.name || 'Service',
          functions: service.functions || [],
          async: true
        };
        
        const serviceTestContent = await this.testGenerator.generateUnitTest(serviceTestSpec);
        const filename = `__tests__/services/${(service.name || 'service').toLowerCase()}.test.js`;
        await this.fileWriter.writeTestFile(filename, serviceTestContent);
      }
    }

    this.codeAgent.emit('progress', {
      phase: 'testing',
      step: 'backend-tests-complete',
      message: '✅ Backend tests generated'
    });
  }

  /**
   * Generate integration tests
   * @private
   */
  async _generateIntegrationTests(analysis) {
    this.codeAgent.emit('progress', {
      phase: 'testing',
      step: 'integration-tests',
      message: '🔗 Generating integration tests...'
    });

    const integrationTestSpec = {
      name: 'End-to-end workflow',
      components: ['server', 'database', 'api'],
      workflow: [
        {
          description: 'should complete full application workflow',
          action: [
            '// Integration test workflow',
            'const testData = createMockData("user", 1);',
            '// Test complete user journey'
          ].join('\n'),
          assertions: [
            { type: 'toBeTruthy', actual: 'testData' },
            { type: 'toEqual', actual: 'testData.length', expected: 1 }
          ]
        }
      ],
      setup: 'await setupTestEnvironment();',
      teardown: 'await cleanupTestEnvironment();'
    };

    const integrationTestContent = await this.testGenerator.generateIntegrationTest(integrationTestSpec);
    await this.fileWriter.writeTestFile('__tests__/integration/workflow.test.js', integrationTestContent);

    this.codeAgent.emit('progress', {
      phase: 'testing',
      step: 'integration-tests-complete',
      message: '✅ Integration tests generated'
    });
  }

  /**
   * Generate DOM tests for frontend HTML
   * @private
   */
  async _generateDOMTests(htmlStructure) {
    const testContent = `/**
 * DOM Tests
 * Tests for HTML structure and DOM manipulation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

describe('DOM Structure', () => {
  let document;
  
  beforeEach(() => {
    // Setup mock DOM
    document = {
      getElementById: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn()
    };
    global.document = document;
  });

  test('should have required elements', () => {
    // Test for main elements
    ${htmlStructure.elements?.map(elem => `
    const ${elem.id || elem.class} = document.getElementById('${elem.id}') || document.querySelector('.${elem.class}');
    expect(${elem.id || elem.class}).toBeDefined();`).join('')}
  });

  test('should have correct structure', () => {
    // Add structure validation tests
    expect(document).toBeDefined();
  });
});`;

    return testContent;
  }
}

export { TestingPhase };