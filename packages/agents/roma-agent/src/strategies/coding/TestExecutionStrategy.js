/**
 * TestExecutionStrategy - TaskStrategy implementation for executing test files
 * 
 * Separated from TestingStrategy to provide single responsibility for test execution.
 * Focuses specifically on running tests and analyzing results without generating them.
 */

import { TaskStrategy } from '@legion/tasks';
import fs from 'fs/promises';
import path from 'path';

export default class TestExecutionStrategy extends TaskStrategy {
  constructor(llmClient = null, toolRegistry = null, options = {}) {
    super();
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.currentTask = null;
    
    // Configurable project root directory - defaults to /tmp but can be overridden
    this.projectRoot = options.projectRoot || process.env.PROJECT_ROOT || '/tmp';
    
    // Pre-instantiated tools (will be loaded during initialization)
    this.tools = {
      fileRead: null,
      commandExecutor: null,
      bashExecutor: null,
      directoryList: null
    };
  }
  
  getName() {
    return 'TestExecution';
  }
  
  /**
   * Handle messages from parent task (start work requests)
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        this.currentTask = parentTask;
        return await this._handleTestExecutionWork(parentTask);
        
      case 'abort':
        console.log(`🛑 TestExecutionStrategy received abort`);
        return { acknowledged: true, aborted: true };
        
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle messages from child tasks (not applicable - TestExecutionStrategy is leaf)
   */
  async onChildMessage(childTask, message) {
    return { acknowledged: false, error: 'TestExecutionStrategy does not handle child messages' };
  }
  
  /**
   * Main test execution work handler
   * @private
   */
  async _handleTestExecutionWork(task) {
    try {
      console.log(`▶️ TestExecutionStrategy handling: ${task.description}`);
      
      // Initialize components
      await this._initializeComponents(task);
      
      // Classify the test execution task type
      const executionType = await this._classifyTestExecutionTask(task);
      task.addConversationEntry('system', `Classified as test execution task: ${executionType.type} - ${executionType.reasoning}`);
      
      // Execute based on test execution task type
      let result;
      switch (executionType.type) {
        case 'RUN_ALL_TESTS':
          result = await this._runAllTests(task, executionType);
          break;
          
        case 'RUN_UNIT_TESTS':
          result = await this._runUnitTests(task, executionType);
          break;
          
        case 'RUN_INTEGRATION_TESTS':
          result = await this._runIntegrationTests(task, executionType);
          break;
          
        case 'RUN_E2E_TESTS':
          result = await this._runE2ETests(task, executionType);
          break;
          
        case 'RUN_SPECIFIC_TESTS':
          result = await this._runSpecificTests(task, executionType);
          break;
          
        case 'RUN_WITH_COVERAGE':
          result = await this._runTestsWithCoverage(task, executionType);
          break;
          
        default:
          result = await this._runGenericTests(task, executionType);
      }
      
      if (result.success) {
        task.complete(result);
        return result;
      } else {
        task.fail(new Error(result.error || 'Test execution failed'));
        return result;
      }
      
    } catch (error) {
      console.error(`❌ TestExecutionStrategy error:`, error);
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
      throw new Error('LLM client is required for TestExecutionStrategy');
    }
    
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required for TestExecutionStrategy');
    }
    
    // Load required tools if not already loaded
    await this._loadRequiredTools();
  }
  
  /**
   * Load and cache required tools during initialization
   * @private
   */
  async _loadRequiredTools() {
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required to load tools');
    }
    
    try {
      // Load file operations tools
      this.tools.fileRead = await this.toolRegistry.getTool('file_read');
      this.tools.directoryList = await this.toolRegistry.getTool('directory_list');
      
      // Load command execution tools (prioritize command_executor, fallback to Bash)
      this.tools.commandExecutor = await this.toolRegistry.getTool('command_executor');
      if (!this.tools.commandExecutor) {
        this.tools.bashExecutor = await this.toolRegistry.getTool('Bash');
      }
      
      // Validate that essential tools are available
      const requiredTools = ['fileRead'];
      for (const toolName of requiredTools) {
        if (!this.tools[toolName]) {
          throw new Error(`Required tool ${toolName} is not available`);
        }
      }
      
      // Ensure we have at least one command execution tool
      if (!this.tools.commandExecutor && !this.tools.bashExecutor) {
        throw new Error('No command execution tool available (need command_executor or Bash)');
      }
      
      console.log('▶️ TestExecutionStrategy tools loaded successfully');
      
    } catch (error) {
      throw new Error(`Failed to load required tools: ${error.message}`);
    }
  }
  
  /**
   * Extract context from task
   * @private
   */
  _getContextFromTask(task) {
    // Use ambient project root variable - prioritize task context, then strategy config, then default
    const workspaceDir = (task.lookup && task.lookup('workspaceDir')) || 
                        task.context?.workspaceDir || 
                        this.projectRoot;
    
    return {
      llmClient: (task.lookup && task.lookup('llmClient')) || task.context?.llmClient,
      toolRegistry: (task.lookup && task.lookup('toolRegistry')) || task.context?.toolRegistry,
      workspaceDir: workspaceDir,
    };
  }
  
  /**
   * Classify the type of test execution task
   * @private
   */
  async _classifyTestExecutionTask(task) {
    const prompt = `Classify this test execution task into one of these categories:

Task: "${task.description}"

Categories:
1. RUN_ALL_TESTS - Run all available tests (unit, integration, e2e)
2. RUN_UNIT_TESTS - Run only unit tests
3. RUN_INTEGRATION_TESTS - Run only integration tests
4. RUN_E2E_TESTS - Run only end-to-end tests
5. RUN_SPECIFIC_TESTS - Run specific test files or patterns
6. RUN_WITH_COVERAGE - Run tests with coverage analysis
7. GENERIC_TEST_EXECUTION - Other test execution tasks

Artifacts available: ${task.getArtifactsContext()}

Return JSON:
{
  "type": "RUN_ALL_TESTS|RUN_UNIT_TESTS|RUN_INTEGRATION_TESTS|RUN_E2E_TESTS|RUN_SPECIFIC_TESTS|RUN_WITH_COVERAGE|GENERIC_TEST_EXECUTION",
  "reasoning": "explanation of classification",
  "testFramework": "jest|mocha|vitest|pytest|junit|other",
  "scope": "unit|integration|e2e|all",
  "pattern": "specific test pattern if applicable"
}`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return JSON.parse(response);
    } catch (error) {
      console.log(`⚠️ Test execution task classification failed, defaulting to RUN_ALL_TESTS: ${error.message}`);
      return {
        type: 'RUN_ALL_TESTS',
        reasoning: 'Classification failed, using default',
        testFramework: 'jest',
        scope: 'all'
      };
    }
  }
  
  /**
   * Run all available tests
   * @private
   */
  async _runAllTests(task, executionType) {
    console.log(`🏃 Running all tests for: ${task.description}`);
    
    const context = this._getContextFromTask(task);
    
    try {
      // Use pre-instantiated command execution tool for running tests
      const commandTool = this.tools.commandExecutor || this.tools.bashExecutor;
      
      if (!commandTool) {
        return {
          success: false,
          error: 'No command execution tool available for running tests'
        };
      }
      
      // Build test command for all tests
      const testCommand = this._buildTestCommand(executionType.testFramework, 'all');
      
      // Execute tests
      const testResult = await commandTool.execute({
        command: testCommand,
        workingDirectory: context.workspaceDir
      });
      
      // Store test results as artifacts
      task.storeArtifact('test_results', testResult, 'All tests execution results', 'json');
      
      if (testResult.failures && testResult.failures.length > 0) {
        task.storeArtifact('test_failures', testResult.failures, 'Test failures for analysis', 'json');
      }
      
      return this._processTestResults(task, testResult, 'all tests');
      
    } catch (error) {
      return {
        success: false,
        error: `All tests execution failed: ${error.message}`
      };
    }
  }
  
  /**
   * Run unit tests only
   * @private
   */
  async _runUnitTests(task, executionType) {
    console.log(`🔬 Running unit tests for: ${task.description}`);
    
    return await this._runTestsByPattern(task, executionType, 'unit', '**/*.test.js');
  }
  
  /**
   * Run integration tests only
   * @private
   */
  async _runIntegrationTests(task, executionType) {
    console.log(`🔗 Running integration tests for: ${task.description}`);
    
    return await this._runTestsByPattern(task, executionType, 'integration', '**/integration/**/*.test.js');
  }
  
  /**
   * Run E2E tests only
   * @private
   */
  async _runE2ETests(task, executionType) {
    console.log(`🌐 Running E2E tests for: ${task.description}`);
    
    return await this._runTestsByPattern(task, executionType, 'e2e', '**/e2e/**/*.test.js');
  }
  
  /**
   * Run specific tests based on pattern
   * @private
   */
  async _runSpecificTests(task, executionType) {
    console.log(`🎯 Running specific tests for: ${task.description}`);
    
    const pattern = executionType.pattern || '**/*.test.js';
    return await this._runTestsByPattern(task, executionType, 'specific', pattern);
  }
  
  /**
   * Run tests with coverage analysis
   * @private
   */
  async _runTestsWithCoverage(task, executionType) {
    console.log(`📊 Running tests with coverage for: ${task.description}`);
    
    const context = this._getContextFromTask(task);
    
    try {
      const commandTool = this.tools.commandExecutor || this.tools.bashExecutor;
      
      if (!commandTool) {
        return {
          success: false,
          error: 'No command execution tool available for running tests'
        };
      }
      
      // Build test command with coverage
      const testCommand = this._buildCoverageCommand(executionType.testFramework, executionType.scope);
      
      // Execute tests with coverage
      const testResult = await commandTool.execute({
        command: testCommand,
        workingDirectory: context.workspaceDir
      });
      
      // Store test results and coverage data
      task.storeArtifact('test_results_with_coverage', testResult, 'Test execution results with coverage', 'json');
      
      if (testResult.coverage) {
        task.storeArtifact('coverage_report', testResult.coverage, 'Test coverage report', 'json');
      }
      
      if (testResult.failures && testResult.failures.length > 0) {
        task.storeArtifact('test_failures', testResult.failures, 'Test failures for analysis', 'json');
      }
      
      return this._processTestResults(task, testResult, 'tests with coverage');
      
    } catch (error) {
      return {
        success: false,
        error: `Coverage test execution failed: ${error.message}`
      };
    }
  }
  
  /**
   * Run generic tests
   * @private
   */
  async _runGenericTests(task, executionType) {
    console.log(`📝 Running generic tests for: ${task.description}`);
    
    // Default to running all tests for generic cases
    return await this._runAllTests(task, executionType);
  }
  
  /**
   * Run tests by specific pattern
   * @private
   */
  async _runTestsByPattern(task, executionType, testType, pattern) {
    const context = this._getContextFromTask(task);
    
    try {
      const commandTool = this.tools.commandExecutor || this.tools.bashExecutor;
      
      if (!commandTool) {
        return {
          success: false,
          error: 'No command execution tool available for running tests'
        };
      }
      
      // Build test command for specific pattern
      const testCommand = this._buildPatternCommand(executionType.testFramework, pattern);
      
      // Execute tests
      const testResult = await commandTool.execute({
        command: testCommand,
        workingDirectory: context.workspaceDir
      });
      
      // Store test results as artifacts
      task.storeArtifact(`${testType}_test_results`, testResult, `${testType} tests execution results`, 'json');
      
      if (testResult.failures && testResult.failures.length > 0) {
        task.storeArtifact(`${testType}_test_failures`, testResult.failures, `${testType} test failures for analysis`, 'json');
      }
      
      return this._processTestResults(task, testResult, `${testType} tests`);
      
    } catch (error) {
      return {
        success: false,
        error: `${testType} tests execution failed: ${error.message}`
      };
    }
  }
  
  /**
   * Process and format test results
   * @private
   */
  _processTestResults(task, testResult, testDescription) {
    const success = testResult.success || (testResult.testsFailed === 0 && testResult.testsRun > 0);
    
    return {
      success: success,
      result: {
        message: `${testDescription} ${success ? 'passed' : 'failed'}`,
        testsRun: testResult.testsRun || 0,
        testsPassed: testResult.testsPassed || 0,
        testsFailed: testResult.testsFailed || 0,
        testsSkipped: testResult.testsSkipped || 0,
        executionTime: testResult.executionTime || 0,
        coverage: testResult.coverage || null,
        summary: this._generateTestSummary(testResult)
      },
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Generate test summary
   * @private
   */
  _generateTestSummary(testResult) {
    const total = testResult.testsRun || 0;
    const passed = testResult.testsPassed || 0;
    const failed = testResult.testsFailed || 0;
    const skipped = testResult.testsSkipped || 0;
    
    if (total === 0) {
      return 'No tests found or executed';
    }
    
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    
    return `${total} tests: ${passed} passed (${passRate}%), ${failed} failed, ${skipped} skipped`;
  }
  
  /**
   * Build test command for framework
   * @private
   */
  _buildTestCommand(testFramework, scope) {
    const patterns = this._getTestPattern(testFramework, scope);
    
    switch (testFramework) {
      case 'jest':
        return scope === 'all' 
          ? `npm test -- --testMatch="${patterns}" --verbose`
          : `npm test -- --testMatch="${patterns}"`;
      
      case 'mocha':
        return scope === 'all'
          ? `npx mocha "${patterns}" --reporter json`
          : `npx mocha "${patterns}"`;
          
      case 'vitest':
        return scope === 'all'
          ? `npx vitest run --reporter=verbose`
          : `npx vitest run`;
          
      default:
        return 'npm test';
    }
  }
  
  /**
   * Build coverage command for framework
   * @private
   */
  _buildCoverageCommand(testFramework, scope) {
    switch (testFramework) {
      case 'jest':
        return `npm test -- --coverage --coverageReporters=json-summary --coverageReporters=text`;
      
      case 'mocha':
        return `npx nyc mocha "**/*.test.js" --reporter json`;
          
      case 'vitest':
        return `npx vitest run --coverage`;
          
      default:
        return 'npm test -- --coverage';
    }
  }
  
  /**
   * Build pattern-specific command
   * @private
   */
  _buildPatternCommand(testFramework, pattern) {
    switch (testFramework) {
      case 'jest':
        return `npm test -- --testMatch="${pattern}" --verbose`;
      
      case 'mocha':
        return `npx mocha "${pattern}" --reporter json`;
          
      case 'vitest':
        return `npx vitest run "${pattern}"`;
          
      default:
        return `npm test "${pattern}"`;
    }
  }
  
  /**
   * Get test pattern for framework and scope
   * @private
   */
  _getTestPattern(testFramework, scope) {
    const patterns = {
      jest: {
        all: '**/*.test.js',
        unit: '**/*.test.js',
        integration: '**/integration/**/*.test.js',
        e2e: '**/e2e/**/*.test.js'
      },
      mocha: {
        all: 'test/**/*.js',
        unit: 'test/unit/**/*.js',
        integration: 'test/integration/**/*.js',
        e2e: 'test/e2e/**/*.js'
      },
      vitest: {
        all: '**/*.test.js',
        unit: '**/*.test.js',
        integration: '**/integration/**/*.test.js',
        e2e: '**/e2e/**/*.test.js'
      }
    };
    
    return patterns[testFramework]?.[scope] || '**/*.test.js';
  }
  
  /**
   * Analyze test execution environment
   * @private
   */
  async _analyzeTestEnvironment(task, executionType) {
    const context = this._getContextFromTask(task);
    
    try {
      // Check for test files
      const testFiles = await this._findTestFiles(context.workspaceDir);
      
      // Check for test configuration
      const testConfig = await this._findTestConfiguration(context.workspaceDir, executionType.testFramework);
      
      // Check for package.json with test scripts
      const packageJson = await this._checkPackageJson(context.workspaceDir);
      
      return {
        testFiles: testFiles,
        testConfig: testConfig,
        packageJson: packageJson,
        framework: executionType.testFramework
      };
      
    } catch (error) {
      console.log(`⚠️ Test environment analysis failed: ${error.message}`);
      return {
        testFiles: [],
        testConfig: null,
        packageJson: null,
        framework: executionType.testFramework
      };
    }
  }
  
  /**
   * Find test files in workspace
   * @private
   */
  async _findTestFiles(workspaceDir) {
    try {
      if (this.tools.directoryList) {
        const result = await this.tools.directoryList.execute({ dirpath: workspaceDir });
        if (result.success && result.files) {
          return result.files.filter(file => file.endsWith('.test.js') || file.endsWith('.spec.js'));
        }
      }
      return [];
    } catch (error) {
      console.log(`⚠️ Could not list test files: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Find test configuration file
   * @private
   */
  async _findTestConfiguration(workspaceDir, testFramework) {
    const configFiles = {
      jest: ['jest.config.js', 'jest.config.json'],
      mocha: ['.mocharc.json', '.mocharc.js'],
      vitest: ['vitest.config.js', 'vite.config.js']
    };
    
    const possibleConfigs = configFiles[testFramework] || [];
    
    for (const configFile of possibleConfigs) {
      try {
        const configPath = path.join(workspaceDir, configFile);
        const content = await this.tools.fileRead.execute({ filepath: configPath });
        if (content.success) {
          return { filename: configFile, content: content.content };
        }
      } catch (error) {
        // Config file doesn't exist, continue checking
      }
    }
    
    return null;
  }
  
  /**
   * Check package.json for test scripts
   * @private
   */
  async _checkPackageJson(workspaceDir) {
    try {
      const packagePath = path.join(workspaceDir, 'package.json');
      const content = await this.tools.fileRead.execute({ filepath: packagePath });
      
      if (content.success) {
        const packageJson = JSON.parse(content.content);
        return {
          hasTestScript: !!packageJson.scripts?.test,
          testScript: packageJson.scripts?.test,
          dependencies: packageJson.dependencies || {},
          devDependencies: packageJson.devDependencies || {}
        };
      }
    } catch (error) {
      console.log(`⚠️ Could not read package.json: ${error.message}`);
    }
    
    return null;
  }
}