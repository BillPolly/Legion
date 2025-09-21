/**
 * TestWritingStrategy - TaskStrategy implementation for generating test files
 * 
 * Separated from TestingStrategy to provide single responsibility for test generation.
 * Focuses specifically on creating test files without executing them.
 */

import { TaskStrategy } from '@legion/tasks';
import fs from 'fs/promises';
import path from 'path';

export default class TestWritingStrategy extends TaskStrategy {
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
      generateTest: null
    };
  }
  
  getName() {
    return 'TestWriting';
  }
  
  /**
   * Handle messages from parent task (start work requests)
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        this.currentTask = parentTask;
        return await this._handleTestWritingWork(parentTask);
        
      case 'abort':
        console.log(`🛑 TestWritingStrategy received abort`);
        return { acknowledged: true, aborted: true };
        
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle messages from child tasks (not applicable - TestWritingStrategy is leaf)
   */
  async onChildMessage(childTask, message) {
    return { acknowledged: false, error: 'TestWritingStrategy does not handle child messages' };
  }
  
  /**
   * Main test writing work handler
   * @private
   */
  async _handleTestWritingWork(task) {
    try {
      console.log(`📝 TestWritingStrategy handling: ${task.description}`);
      
      // Initialize components
      await this._initializeComponents(task);
      
      // Classify the test writing task type
      const testingType = await this._classifyTestWritingTask(task);
      task.addConversationEntry('system', `Classified as test writing task: ${testingType.type} - ${testingType.reasoning}`);
      
      // Execute based on test writing task type
      let result;
      switch (testingType.type) {
        case 'UNIT_TEST_GENERATION':
          result = await this._generateUnitTests(task, testingType);
          break;
          
        case 'INTEGRATION_TEST_GENERATION':
          result = await this._generateIntegrationTests(task, testingType);
          break;
          
        case 'E2E_TEST_GENERATION':
          result = await this._generateE2ETests(task, testingType);
          break;
          
        case 'TEST_SUITE_GENERATION':
          result = await this._generateTestSuite(task, testingType);
          break;
          
        default:
          result = await this._generateGenericTests(task, testingType);
      }
      
      if (result.success) {
        task.complete(result);
        return result;
      } else {
        task.fail(new Error(result.error || 'Test writing failed'));
        return result;
      }
      
    } catch (error) {
      console.error(`❌ TestWritingStrategy error:`, error);
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
      throw new Error('LLM client is required for TestWritingStrategy');
    }
    
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required for TestWritingStrategy');
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
      
      // Validate that essential tools are available
      const requiredTools = ['fileRead', 'fileWrite', 'directoryCreate'];
      for (const toolName of requiredTools) {
        if (!this.tools[toolName]) {
          throw new Error(`Required tool ${toolName} is not available`);
        }
      }
      
      console.log('📝 TestWritingStrategy tools loaded successfully');
      
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
   * Classify the type of test writing task
   * @private
   */
  async _classifyTestWritingTask(task) {
    const prompt = `Classify this test writing task into one of these categories:

Task: "${task.description}"

Categories:
1. UNIT_TEST_GENERATION - Generate unit tests for specific functions/classes
2. INTEGRATION_TEST_GENERATION - Generate integration tests for system components
3. E2E_TEST_GENERATION - Generate end-to-end tests for user workflows
4. TEST_SUITE_GENERATION - Generate comprehensive test suites for entire modules
5. GENERIC_TEST_GENERATION - Other test generation tasks

Artifacts available: ${task.getArtifactsContext()}

Return JSON:
{
  "type": "UNIT_TEST_GENERATION|INTEGRATION_TEST_GENERATION|E2E_TEST_GENERATION|TEST_SUITE_GENERATION|GENERIC_TEST_GENERATION",
  "reasoning": "explanation of classification",
  "testFramework": "jest|mocha|vitest|pytest|junit|other",
  "scope": "unit|integration|e2e|all",
  "complexity": "simple|medium|complex"
}`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return JSON.parse(response);
    } catch (error) {
      console.log(`⚠️ Test writing task classification failed, defaulting to UNIT_TEST_GENERATION: ${error.message}`);
      return {
        type: 'UNIT_TEST_GENERATION',
        reasoning: 'Classification failed, using default',
        testFramework: 'jest',
        scope: 'unit',
        complexity: 'medium'
      };
    }
  }
  
  /**
   * Generate unit tests for specific functions/classes
   * @private
   */
  async _generateUnitTests(task, testingType) {
    console.log(`🔬 Generating unit tests for: ${task.description}`);
    
    const context = this._getContextFromTask(task);
    
    // Setup organized project directory
    const outputDir = await this._setupProjectDirectory(task, testingType);
    await this.tools.directoryCreate.execute({ path: path.join(outputDir, 'tests', 'unit') });
    
    // Find code files to test
    const codeFiles = await this._findCodeFiles(task);
    
    if (codeFiles.length === 0) {
      return {
        success: false,
        error: 'No code files found to generate unit tests for'
      };
    }
    
    const generatedTests = {};
    
    for (const codeFile of codeFiles) {
      try {
        const testContent = await this._generateUnitTestForFile(task, codeFile, testingType);
        const testFilename = this._getUnitTestFilename(codeFile.filename);
        const testPath = path.join(outputDir, 'tests', 'unit', testFilename);
        
        // Ensure test directory exists using tool
        const testDir = path.dirname(testPath);
        await this.tools.directoryCreate.execute({ path: testDir });
        
        // Write test file using tool
        await this.tools.fileWrite.execute({ filepath: testPath, content: testContent });
        
        generatedTests[testFilename] = testContent;
        task.storeArtifact(testFilename, testContent, `Generated unit test for ${codeFile.filename}`, 'test');
        
        console.log(`✅ Generated unit test ${testFilename} for ${codeFile.filename}`);
        
      } catch (error) {
        console.log(`❌ Failed to generate unit test for ${codeFile.filename}: ${error.message}`);
      }
    }
    
    return {
      success: Object.keys(generatedTests).length > 0,
      result: {
        message: `Generated ${Object.keys(generatedTests).length} unit test files`,
        testFiles: Object.keys(generatedTests),
        codeFilesTested: codeFiles.length,
        testType: 'unit'
      },
      artifacts: Object.values(task.getAllArtifacts())
    };
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
    await this.tools.directoryCreate.execute({ path: path.join(outputDir, 'tests', 'integration') });
    
    // Generate integration test based on task description
    const integrationTestContent = await this._generateIntegrationTestContent(task, testingType);
    const testFilename = 'integration.test.js';
    const testPath = path.join(outputDir, 'tests', 'integration', testFilename);
    
    try {
      await this.tools.directoryCreate.execute({ path: path.dirname(testPath) });
      await this.tools.fileWrite.execute({ filepath: testPath, content: integrationTestContent });
      
      task.storeArtifact(testFilename, integrationTestContent, 'Generated integration test', 'test');
      
      return {
        success: true,
        result: {
          message: 'Integration test generated successfully',
          testFiles: [testFilename],
          testType: 'integration'
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
   * Generate end-to-end tests
   * @private
   */
  async _generateE2ETests(task, testingType) {
    console.log(`🌐 Generating E2E tests for: ${task.description}`);
    
    const context = this._getContextFromTask(task);
    
    // Setup organized project directory
    const outputDir = await this._setupProjectDirectory(task, testingType);
    await this.tools.directoryCreate.execute({ path: path.join(outputDir, 'tests', 'e2e') });
    
    // Generate E2E test based on task description
    const e2eTestContent = await this._generateE2ETestContent(task, testingType);
    const testFilename = 'e2e.test.js';
    const testPath = path.join(outputDir, 'tests', 'e2e', testFilename);
    
    try {
      await this.tools.directoryCreate.execute({ path: path.dirname(testPath) });
      await this.tools.fileWrite.execute({ filepath: testPath, content: e2eTestContent });
      
      task.storeArtifact(testFilename, e2eTestContent, 'Generated E2E test', 'test');
      
      return {
        success: true,
        result: {
          message: 'E2E test generated successfully',
          testFiles: [testFilename],
          testType: 'e2e'
        },
        artifacts: Object.values(task.getAllArtifacts())
      };
      
    } catch (error) {
      return {
        success: false,
        error: `E2E test generation failed: ${error.message}`
      };
    }
  }
  
  /**
   * Generate comprehensive test suite
   * @private
   */
  async _generateTestSuite(task, testingType) {
    console.log(`📋 Generating test suite for: ${task.description}`);
    
    const context = this._getContextFromTask(task);
    
    // Setup organized project directory
    const outputDir = await this._setupProjectDirectory(task, testingType);
    
    // Generate all types of tests
    const unitResult = await this._generateUnitTests(task, { ...testingType, type: 'UNIT_TEST_GENERATION' });
    const integrationResult = await this._generateIntegrationTests(task, { ...testingType, type: 'INTEGRATION_TEST_GENERATION' });
    
    // Generate test configuration files
    await this._generateTestConfiguration(task, testingType, outputDir);
    
    const allTestFiles = [
      ...(unitResult.success ? unitResult.result.testFiles : []),
      ...(integrationResult.success ? integrationResult.result.testFiles : [])
    ];
    
    return {
      success: allTestFiles.length > 0,
      result: {
        message: `Generated complete test suite with ${allTestFiles.length} test files`,
        testFiles: allTestFiles,
        testTypes: ['unit', 'integration'],
        unitTests: unitResult.success ? unitResult.result.testFiles.length : 0,
        integrationTests: integrationResult.success ? integrationResult.result.testFiles.length : 0
      },
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Generate generic tests
   * @private
   */
  async _generateGenericTests(task, testingType) {
    console.log(`📝 Generating generic tests for: ${task.description}`);
    
    // Default to unit test generation for generic cases
    return await this._generateUnitTests(task, testingType);
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
   * Get unit test filename for a code file
   * @private
   */
  _getUnitTestFilename(codeFilename) {
    const ext = path.extname(codeFilename);
    const base = path.basename(codeFilename, ext);
    return `${base}.test${ext}`;
  }
  
  /**
   * Generate unit test content for a specific file
   * @private
   */
  async _generateUnitTestForFile(task, codeFile, testingType) {
    const prompt = `You are an expert test engineer. Generate comprehensive ${testingType.testFramework} unit tests for this code file:

## Code to Test
**Filename**: ${codeFile.filename}
\`\`\`${codeFile.filename.split('.').pop()}
${codeFile.content}
\`\`\`

## Test Requirements
- **Framework**: ${testingType.testFramework}
- **Scope**: ${testingType.scope}
- **Complexity**: ${testingType.complexity}

## Test Coverage Requirements
1. **Function Coverage**: Test all public functions/methods
2. **Branch Coverage**: Test all conditional paths
3. **Edge Cases**: Boundary conditions, empty inputs, null values
4. **Error Handling**: Exception scenarios and error conditions
5. **Input Validation**: Invalid inputs and type checking
6. **Integration Points**: Mock external dependencies appropriately

## Test Structure Guidelines
1. **Organization**: Group tests by function/class using describe blocks
2. **Naming**: Use descriptive test names that explain what is being tested
3. **Setup/Teardown**: Include beforeEach/afterEach for proper test isolation
4. **Assertions**: Use appropriate matchers for clear test intent
5. **Mocking**: Mock external dependencies, databases, APIs, file system
6. **Data**: Use realistic test data and edge cases

## ${testingType.testFramework} Best Practices
- Use proper describe/it structure
- Include setup and teardown logic
- Mock external dependencies with jest.mock() or similar
- Test both success and failure scenarios
- Use appropriate assertions (toEqual, toBe, toThrow, etc.)
- Include async/await testing where applicable
- Add performance tests for complex operations

## Expected Test Categories
1. **Happy Path Tests**: Normal operation with valid inputs
2. **Edge Case Tests**: Boundary values, empty arrays, null/undefined
3. **Error Tests**: Invalid inputs, network failures, exceptions
4. **Integration Tests**: Mocked dependencies and interactions
5. **Performance Tests**: For complex algorithms or operations

## Code Quality
- Clear, descriptive test names
- Proper test isolation (no shared state)
- Comprehensive error message assertions
- Realistic mock data
- Complete coverage of public API

Generate complete, production-ready unit tests:`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
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
- Component interactions and data flow
- API endpoints and request/response cycles
- Database operations and data persistence
- External service integrations
- Module communication and interfaces
- System behavior under realistic conditions

Use ${testingType.testFramework} syntax and best practices.
Focus on testing how components work together.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate E2E test content
   * @private
   */
  async _generateE2ETestContent(task, testingType) {
    const prompt = `Generate end-to-end tests for this task:

Task: "${task.description}"
Test Framework: ${testingType.testFramework}
Available Artifacts: ${task.getArtifactsContext()}

Generate E2E tests that verify:
- Complete user workflows and scenarios
- UI interactions and user experience
- Data flow from frontend to backend
- Real browser/application behavior
- Critical user journeys
- System behavior in production-like environment

Use ${testingType.testFramework} or appropriate E2E framework (Playwright, Cypress, etc.).
Focus on testing complete user scenarios from start to finish.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Generate test configuration files
   * @private
   */
  async _generateTestConfiguration(task, testingType, outputDir) {
    const configContent = await this._generateTestConfigContent(task, testingType);
    const configFilename = this._getConfigFilename(testingType.testFramework);
    const configPath = path.join(outputDir, configFilename);
    
    try {
      await this.tools.fileWrite.execute({ filepath: configPath, content: configContent });
      task.storeArtifact(configFilename, configContent, 'Test configuration file', 'config');
      console.log(`✅ Generated test configuration: ${configFilename}`);
    } catch (error) {
      console.log(`⚠️ Failed to generate test configuration: ${error.message}`);
    }
  }
  
  /**
   * Generate test configuration content
   * @private
   */
  async _generateTestConfigContent(task, testingType) {
    const prompt = `Generate a ${testingType.testFramework} configuration file for this project:

Task: "${task.description}"
Test Framework: ${testingType.testFramework}
Test Types: unit, integration

Generate appropriate configuration including:
- Test file patterns and locations
- Setup and teardown scripts
- Coverage settings
- Environment variables
- Module resolution
- Transform settings (if needed)

Return the configuration file content in the appropriate format.`;

    const response = await this.llmClient.generateResponse([{
      role: 'user',
      content: prompt
    }]);
    
    return response;
  }
  
  /**
   * Get configuration filename for test framework
   * @private
   */
  _getConfigFilename(testFramework) {
    const configFiles = {
      jest: 'jest.config.js',
      mocha: '.mocharc.json',
      vitest: 'vitest.config.js',
      pytest: 'pytest.ini',
      junit: 'junit.xml'
    };
    
    return configFiles[testFramework] || 'test.config.js';
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
    const projectType = testingType.type ? testingType.type.toLowerCase().replace('_', '-') : 'test-writing';
    
    return `${projectType}-${cleanedDescription}-${timestamp}`;
  }
}