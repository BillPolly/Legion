/**
 * TestingStrategy - TaskStrategy implementation for testing tasks
 * 
 * Adapts CodeAgent's testing phase methods to TaskStrategy interface.
 * Handles test generation, execution, and analysis tasks.
 */

import { TaskStrategy } from '@legion/tasks';
import fs from 'fs/promises';
import path from 'path';

export default class TestingStrategy extends TaskStrategy {
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
      fileWrite: null,
      directoryCreate: null,
      generateTest: null,
      commandExecutor: null,
      bashExecutor: null
    };
  }
  
  getName() {
    return 'Testing';
  }
  
  /**
   * Handle messages from parent task (start work requests)
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        this.currentTask = parentTask;
        return await this._handleTestingWork(parentTask);
        
      case 'abort':
        console.log(`🛑 TestingStrategy received abort`);
        return { acknowledged: true, aborted: true };
        
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle messages from child tasks (not applicable - TestingStrategy is leaf)
   */
  async onChildMessage(childTask, message) {
    return { acknowledged: false, error: 'TestingStrategy does not handle child messages' };
  }
  
  /**
   * Main testing work handler
   * @private
   */
  async _handleTestingWork(task) {
    try {
      console.log(`🧪 TestingStrategy handling: ${task.description}`);
      
      // Initialize components
      await this._initializeComponents(task);
      
      // Classify the testing task type
      const testingType = await this._classifyTestTask(task);
      task.addConversationEntry('system', `Classified as testing task: ${testingType.type} - ${testingType.reasoning}`);
      
      // Execute based on testing task type
      let result;
      switch (testingType.type) {
        case 'GENERATE_TESTS':
          result = await this._generateTests(task, testingType);
          break;
          
        case 'RUN_TESTS':
          result = await this._runTests(task, testingType);
          break;
          
        case 'ANALYZE_FAILURES':
          result = await this._analyzeFailures(task, testingType);
          break;
          
        case 'COVERAGE_ANALYSIS':
          result = await this._analyzeCoverage(task, testingType);
          break;
          
        case 'UNIT_TESTING':
          result = await this._generateUnitTests(task, testingType);
          break;
          
        case 'INTEGRATION_TESTING':
          result = await this._generateIntegrationTests(task, testingType);
          break;
          
        default:
          result = await this._generateGenericTests(task, testingType);
      }
      
      if (result.success) {
        task.complete(result);
        return result;
      } else {
        task.fail(new Error(result.error || 'Testing failed'));
        return result;
      }
      
    } catch (error) {
      console.error(`❌ TestingStrategy error:`, error);
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
      throw new Error('LLM client is required for TestingStrategy');
    }
    
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required for TestingStrategy');
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
      this.tools.fileWrite = await this.toolRegistry.getTool('file_write');
      this.tools.directoryCreate = await this.toolRegistry.getTool('directory_create');
      
      // Load test generation tools
      this.tools.generateTest = await this.toolRegistry.getTool('generate_test');
      
      // Load command execution tools (prioritize command_executor, fallback to Bash)
      this.tools.commandExecutor = await this.toolRegistry.getTool('command_executor');
      if (!this.tools.commandExecutor) {
        this.tools.bashExecutor = await this.toolRegistry.getTool('Bash');
      }
      
      // Validate that essential tools are available
      const requiredTools = ['fileRead', 'fileWrite'];
      for (const toolName of requiredTools) {
        if (!this.tools[toolName]) {
          throw new Error(`Required tool ${toolName} is not available`);
        }
      }
      
      // Ensure we have at least one command execution tool
      if (!this.tools.commandExecutor && !this.tools.bashExecutor) {
        throw new Error('No command execution tool available (need command_executor or Bash)');
      }
      
      console.log('🧪 TestingStrategy tools loaded successfully');
      
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
   * Classify the type of testing task
   * @private
   */
  async _classifyTestTask(task) {
    const prompt = `Classify this testing task into one of these categories:

Task: "${task.description}"

Categories:
1. GENERATE_TESTS - Generate test files for existing code
2. RUN_TESTS - Execute existing tests and report results
3. ANALYZE_FAILURES - Analyze test failures and suggest fixes
4. COVERAGE_ANALYSIS - Analyze test coverage and suggest improvements
5. UNIT_TESTING - Generate unit tests for specific functions/classes
6. INTEGRATION_TESTING - Generate integration tests for system components
7. GENERIC_TESTING - Other testing-related tasks

Artifacts available: ${task.getArtifactsContext()}

Return JSON:
{
  "type": "GENERATE_TESTS|RUN_TESTS|ANALYZE_FAILURES|COVERAGE_ANALYSIS|UNIT_TESTING|INTEGRATION_TESTING|GENERIC_TESTING",
  "reasoning": "explanation of classification",
  "testFramework": "jest|mocha|vitest|pytest|junit|other",
  "scope": "unit|integration|e2e|all"
}`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return JSON.parse(response);
    } catch (error) {
      console.log(`⚠️ Test task classification failed, defaulting to GENERATE_TESTS: ${error.message}`);
      return {
        type: 'GENERATE_TESTS',
        reasoning: 'Classification failed, using default',
        testFramework: 'jest',
        scope: 'unit'
      };
    }
  }
  
  /**
   * Generate tests for existing code
   * @private
   */
  async _generateTests(task, testingType) {
    console.log(`🏗️ Generating tests for: ${task.description}`);
    
    const context = this._getContextFromTask(task);
    
    // Setup organized project directory
    const outputDir = await this._setupProjectDirectory(task, testingType);
    await this.tools.directoryCreate.execute({ path: path.join(outputDir, 'tests') });
    
    // Find code files to test
    const codeFiles = await this._findCodeFiles(task);
    
    if (codeFiles.length === 0) {
      return {
        success: false,
        error: 'No code files found to generate tests for'
      };
    }
    
    const generatedTests = {};
    
    for (const codeFile of codeFiles) {
      try {
        const testContent = await this._generateTestForFile(task, codeFile, testingType);
        const testFilename = this._getTestFilename(codeFile.filename);
        const testPath = path.join(outputDir, testFilename);
        
        // Ensure test directory exists using tool
        const testDir = path.dirname(testPath);
        await this.tools.directoryCreate.execute({ path: testDir });
        
        // Write test file using tool
        await this.tools.fileWrite.execute({ filepath: testPath, content: testContent });
        
        generatedTests[testFilename] = testContent;
        task.storeArtifact(testFilename, testContent, `Generated test for ${codeFile.filename}`, 'test');
        
        console.log(`✅ Generated test ${testFilename} for ${codeFile.filename}`);
        
      } catch (error) {
        console.log(`❌ Failed to generate test for ${codeFile.filename}: ${error.message}`);
      }
    }
    
    return {
      success: Object.keys(generatedTests).length > 0,
      result: {
        message: `Generated ${Object.keys(generatedTests).length} test files`,
        testFiles: Object.keys(generatedTests),
        codeFilesTested: codeFiles.length
      },
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Run existing tests
   * @private
   */
  async _runTests(task, testingType) {
    console.log(`▶️ Running tests for: ${task.description}`);
    
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
      
      // Build test command based on framework
      const testCommand = this._buildTestCommand(testingType.testFramework, testingType.scope);
      
      // Execute tests
      const testResult = await commandTool.execute({
        command: testCommand,
        workingDirectory: context.workspaceDir
      });
      
      // Store test results as artifacts
      task.storeArtifact('test_results', testResult, 'Test execution results', 'json');
      
      if (testResult.failures && testResult.failures.length > 0) {
        task.storeArtifact('test_failures', testResult.failures, 'Test failures for analysis', 'json');
      }
      
      return {
        success: testResult.success,
        result: {
          message: `Tests ${testResult.success ? 'passed' : 'failed'}`,
          testsRun: testResult.testsRun || 0,
          testsPassed: testResult.testsPassed || 0,
          testsFailed: testResult.testsFailed || 0,
          coverage: testResult.coverage || null
        },
        artifacts: Object.values(task.getAllArtifacts())
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Test execution failed: ${error.message}`
      };
    }
  }
  
  /**
   * Analyze test failures
   * @private
   */
  async _analyzeFailures(task, testingType) {
    console.log(`🔍 Analyzing test failures for: ${task.description}`);
    
    // Get test failure artifacts
    const failures = task.getArtifact('test_failures');
    
    if (!failures) {
      return {
        success: false,
        error: 'No test failures found to analyze'
      };
    }
    
    // Analyze failures with LLM
    const analysis = await this._analyzeFailuresWithLLM(task, failures.value, testingType);
    
    // Store analysis as artifact
    task.storeArtifact('failure_analysis', analysis, 'Test failure analysis', 'json');
    
    return {
      success: true,
      result: {
        message: 'Test failure analysis completed',
        failuresAnalyzed: Array.isArray(failures.value) ? failures.value.length : 1,
        analysis: analysis
      },
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Analyze test coverage
   * @private
   */
  async _analyzeCoverage(task, testingType) {
    console.log(`📊 Analyzing test coverage for: ${task.description}`);
    
    // Get coverage data from artifacts
    const testResults = task.getArtifact('test_results');
    
    if (!testResults || !testResults.value.coverage) {
      return {
        success: false,
        error: 'No coverage data found to analyze'
      };
    }
    
    // Analyze coverage with LLM
    const analysis = await this._analyzeCoverageWithLLM(task, testResults.value.coverage, testingType);
    
    // Store analysis as artifact
    task.storeArtifact('coverage_analysis', analysis, 'Test coverage analysis', 'json');
    
    return {
      success: true,
      result: {
        message: 'Test coverage analysis completed',
        coveragePercentage: testResults.value.coverage.percentage || 0,
        analysis: analysis
      },
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Generate unit tests for specific functions/classes
   * @private
   */
  async _generateUnitTests(task, testingType) {
    console.log(`🔬 Generating unit tests for: ${task.description}`);
    
    // Similar to _generateTests but more focused on individual units
    return await this._generateTests(task, { ...testingType, scope: 'unit' });
  }
  
  /**
   * Generate integration tests
   * @private
   */
  async _generateIntegrationTests(task, testingType) {
    console.log(`🔗 Generating integration tests for: ${task.description}`);
    
    const context = this._getContextFromTask(task);
    
    // Setup organized project directory
    const outputDir = await this._setupProjectDirectory(task, testingType);
    await this.tools.directoryCreate.execute({ path: path.join(outputDir, 'tests') });
    
    // Generate integration test based on task description
    const integrationTestContent = await this._generateIntegrationTestContent(task, testingType);
    const testFilename = 'integration.test.js';
    const testPath = path.join(outputDir, 'tests', testFilename);
    
    try {
      await this.tools.directoryCreate.execute({ path: path.dirname(testPath) });
      await this.tools.fileWrite.execute({ filepath: testPath, content: integrationTestContent });
      
      task.storeArtifact(testFilename, integrationTestContent, 'Generated integration test', 'test');
      
      return {
        success: true,
        result: {
          message: 'Integration test generated successfully',
          testFile: testFilename
        },
        artifacts: Object.values(task.getAllArtifacts())
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Integration test generation failed: ${error.message}`
      };
    }
  }
  
  /**
   * Generate generic tests
   * @private
   */
  async _generateGenericTests(task, testingType) {
    console.log(`📝 Generating generic tests for: ${task.description}`);
    
    return await this._generateTests(task, testingType);
  }
  
  /**
   * Find code files to test
   * @private
   */
  async _findCodeFiles(task) {
    const artifacts = task.getAllArtifacts();
    const codeFiles = [];
    
    // Look for file artifacts
    for (const [name, artifact] of Object.entries(artifacts)) {
      if (artifact.type === 'file' && this._isCodeFile(name)) {
        codeFiles.push({
          filename: name,
          content: artifact.value
        });
      }
    }
    
    return codeFiles;
  }
  
  /**
   * Check if filename represents a code file
   * @private
   */
  _isCodeFile(filename) {
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs'];
    return codeExtensions.some(ext => filename.endsWith(ext));
  }
  
  /**
   * Get test filename for a code file
   * @private
   */
  _getTestFilename(codeFilename) {
    const ext = path.extname(codeFilename);
    const base = path.basename(codeFilename, ext);
    const dir = path.dirname(codeFilename);
    
    // Put tests in tests directory or alongside code with .test extension
    return path.join('tests', `${base}.test${ext}`);
  }
  
  /**
   * Generate test content for a specific file
   * @private
   */
  async _generateTestForFile(task, codeFile, testingType) {
    const prompt = `Generate ${testingType.testFramework} tests for this code file:

Filename: ${codeFile.filename}
Code:
\`\`\`
${codeFile.content}
\`\`\`

Generate comprehensive ${testingType.scope} tests including:
- Happy path scenarios
- Edge cases
- Error conditions
- Input validation

Use ${testingType.testFramework} syntax and best practices.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Build test command for framework
   * @private
   */
  _buildTestCommand(testFramework, scope) {
    const patterns = this._getTestPattern(testFramework);
    
    switch (testFramework) {
      case 'jest':
        return scope === 'all' 
          ? `npm test -- --coverage --testMatch="${patterns}"` 
          : `npm test -- --testMatch="${patterns}"`;
      
      case 'mocha':
        return scope === 'all'
          ? `npx mocha "${patterns}" --reporter json`
          : `npx mocha "${patterns}"`;
          
      case 'vitest':
        return scope === 'all'
          ? `npx vitest run --coverage`
          : `npx vitest run`;
          
      default:
        return scope === 'all'
          ? `npm test -- --coverage`
          : `npm test`;
    }
  }
  
  /**
   * Get test pattern for framework
   * @private
   */
  _getTestPattern(testFramework) {
    const patterns = {
      jest: '**/*.test.js',
      mocha: 'test/**/*.js',
      vitest: '**/*.test.js',
      pytest: 'test_*.py',
      junit: '**/*Test.java'
    };
    
    return patterns[testFramework] || '**/*.test.js';
  }
  
  /**
   * Analyze failures with LLM
   * @private
   */
  async _analyzeFailuresWithLLM(task, failures, testingType) {
    const prompt = `Analyze these test failures and suggest fixes:

Test Framework: ${testingType.testFramework}
Task Context: "${task.description}"

Failures:
${JSON.stringify(failures, null, 2)}

For each failure, provide:
1. Root cause analysis
2. Suggested fix
3. Prevention strategy

Return JSON with analysis results.`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return JSON.parse(response);
    } catch (error) {
      return {
        error: 'Failed to analyze failures',
        details: error.message
      };
    }
  }
  
  /**
   * Analyze coverage with LLM
   * @private
   */
  async _analyzeCoverageWithLLM(task, coverage, testingType) {
    const prompt = `Analyze this test coverage data and suggest improvements:

Test Framework: ${testingType.testFramework}
Task Context: "${task.description}"

Coverage Data:
${JSON.stringify(coverage, null, 2)}

Provide:
1. Coverage assessment
2. Areas needing more tests
3. Suggestions for improvement
4. Priority recommendations

Return JSON with analysis results.`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return JSON.parse(response);
    } catch (error) {
      return {
        error: 'Failed to analyze coverage',
        details: error.message
      };
    }
  }
  
  /**
   * Generate integration test content
   * @private
   */
  async _generateIntegrationTestContent(task, testingType) {
    const prompt = `Generate integration tests for this task:

Task: "${task.description}"
Test Framework: ${testingType.testFramework}
Available Artifacts: ${task.getArtifactsContext()}

Generate integration tests that verify:
- Component interactions
- Data flow between modules
- API endpoints (if applicable)
- Database interactions (if applicable)
- External service integrations (if applicable)

Use ${testingType.testFramework} syntax and best practices.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Setup organized project directory with descriptive name
   * @private
   */
  async _setupProjectDirectory(task, testingType) {
    const projectName = this._generateProjectName(task.description, testingType);
    const romaProjectsDir = '/tmp/roma-projects';
    const outputDir = path.join(romaProjectsDir, projectName);
    
    // Ensure roma-projects directory exists
    await this.tools.directoryCreate.execute({ path: romaProjectsDir });
    await this.tools.directoryCreate.execute({ path: outputDir });
    
    return outputDir;
  }
  
  /**
   * Generate a descriptive project name from task description
   * @private
   */
  _generateProjectName(description, testingType) {
    // Extract key words from description and create a clean project name
    const cleanedDescription = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .split(' ')
      .filter(word => word.length > 2) // Remove short words
      .slice(0, 4) // Take first 4 meaningful words
      .join('-');
    
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
    const projectType = testingType.type ? testingType.type.toLowerCase().replace('_', '-') : 'testing';
    
    return `${projectType}-${cleanedDescription}-${timestamp}`;
  }
}