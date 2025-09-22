/**
 * SimpleNodeTestStrategy - Strategy for testing simple Node.js applications
 * 
 * Focused on generating and running tests for Node.js servers and modules.
 * Uses PromptFactory for all LLM interactions with data-driven prompts.
 */

import { TaskStrategy } from '@legion/tasks';
import { EnhancedPromptRegistry } from '@legion/prompting-manager';
import PromptFactory from '../../utils/PromptFactory.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class SimpleNodeTestStrategy extends TaskStrategy {
  constructor(llmClient = null, toolRegistry = null, options = {}) {
    super();
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.projectRoot = options.projectRoot || '/tmp/roma-projects';
    
    // Pre-instantiated tools
    this.tools = {
      fileWrite: null,
      fileRead: null,
      commandExecutor: null
    };
    
    // Initialize prompt registry
    const promptsPath = path.resolve(__dirname, '../../../prompts');
    this.promptRegistry = new EnhancedPromptRegistry(promptsPath);
  }
  
  getName() {
    return 'SimpleNodeTest';
  }
  
  /**
   * Initialize strategy components and prompts
   */
  async initialize(task) {
    const context = this._getContextFromTask(task);
    this.llmClient = this.llmClient || context.llmClient;
    this.toolRegistry = this.toolRegistry || context.toolRegistry;
    
    if (!this.llmClient) {
      throw new Error('LLM client is required');
    }
    
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required');
    }
    
    // Load required tools
    this.tools.fileWrite = await this.toolRegistry.getTool('file_write');
    this.tools.fileRead = await this.toolRegistry.getTool('file_read');
    this.tools.commandExecutor = await this.toolRegistry.getTool('command_executor');
  }
  
  /**
   * Execute prompt with LLM
   */
  async _executePrompt(promptPath, variables) {
    const prompt = await this.promptRegistry.fill(promptPath, variables);
    const response = await this.llmClient.complete(prompt);
    
    // Parse response based on expected format
    const metadata = await this.promptRegistry.getMetadata(promptPath);
    
    if (metadata.responseFormat === 'json') {
      try {
        // Extract JSON from response
        const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/{[\s\S]*}/);        
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response;
        const data = JSON.parse(jsonStr);
        return { success: true, data };
      } catch (error) {
        return { success: false, errors: [`Failed to parse JSON: ${error.message}`] };
      }
    } else if (metadata.responseFormat === 'delimited') {
      // For delimited responses, extract code and description
      const codeMatch = response.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
      const descMatch = response.match(/description:\s*([^\n]+)/i);
      
      return {
        success: true,
        data: {
          testCode: codeMatch ? codeMatch[1].trim() : response,
          testDescription: descMatch ? descMatch[1].trim() : 'Test code generated'
        }
      };
    }
    
    return { success: true, data: response };
  }
  
  /**
   * DEPRECATED: Define all prompts as data
   */
  _getPromptDefinitions() {
    return {
      analyzeCodeForTesting: {
        template: `Analyze this Node.js code and identify what needs testing:

Code:
{{code}}

Identify:
1. Functions/methods to test
2. API endpoints to test
3. Edge cases to cover
4. Error scenarios`,
        responseSchema: PromptFactory.createJsonSchema({
          testTargets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string', enum: ['function', 'endpoint', 'class'] },
                description: { type: 'string' }
              }
            }
          },
          edgeCases: { type: 'array', items: { type: 'string' } },
          errorScenarios: { type: 'array', items: { type: 'string' } }
        }, ['testTargets']),
        examples: [
          {
            testTargets: [
              { name: 'calculateTotal', type: 'function', description: 'Calculates sum with tax' },
              { name: 'GET /api/users', type: 'endpoint', description: 'Returns list of users' },
              { name: 'UserService', type: 'class', description: 'Handles user operations' }
            ],
            edgeCases: ['empty input', 'negative numbers', 'very large numbers', 'null values'],
            errorScenarios: ['database connection fails', 'invalid user ID', 'missing required fields']
          },
          {
            testTargets: [
              { name: 'parseConfig', type: 'function', description: 'Parses configuration file' },
              { name: 'POST /api/login', type: 'endpoint', description: 'Authenticates user' }
            ],
            edgeCases: ['malformed JSON', 'missing config file', 'empty credentials'],
            errorScenarios: ['file read error', 'wrong password', 'user not found']
          }
        ]
      },
      
      generateTestCode: {
        template: `Generate Jest tests for this Node.js code:

Target: {{targetName}} ({{targetType}})
Description: {{targetDescription}}

Edge cases to test:
{{#each edgeCases}}
- {{this}}
{{/each}}

Requirements:
- Use Jest framework
- Include describe/it blocks
- Test happy path and error cases
- Use async/await for async tests
- Include setup/teardown if needed`,
        responseSchema: PromptFactory.createJsonSchema({
          testCode: { type: 'string' },
          testDescription: { type: 'string' }
        }, ['testCode'], 'delimited'),  // Use delimited format for code
        examples: [
          {
            testCode: `import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { calculateTotal } from './calculator.js';

describe('calculateTotal', () => {
  describe('happy path', () => {
    it('should calculate total with tax', () => {
      const result = calculateTotal(100, 0.1);
      expect(result).toBe(110);
    });
    
    it('should handle zero tax', () => {
      const result = calculateTotal(100, 0);
      expect(result).toBe(100);
    });
  });
  
  describe('edge cases', () => {
    it('should handle negative amounts', () => {
      const result = calculateTotal(-100, 0.1);
      expect(result).toBe(-110);
    });
    
    it('should handle null values', () => {
      expect(() => calculateTotal(null, 0.1)).toThrow();
    });
  });
});`,
            testDescription: 'Unit tests for calculateTotal function with edge cases'
          }
        ]
      },
      
      generateTestScript: {
        template: `Create a test runner script for Node.js project:

Test framework: Jest
Test files: {{testFiles}}

Include:
- npm test script
- Coverage reporting
- Watch mode option`,
        responseSchema: PromptFactory.createJsonSchema({
          scripts: { type: 'object' },
          jestConfig: { type: 'object' }
        }, ['scripts']),
        examples: [
          {
            scripts: {
              test: 'jest',
              'test:watch': 'jest --watch',
              'test:coverage': 'jest --coverage'
            },
            jestConfig: {
              testEnvironment: 'node',
              collectCoverage: false,
              coverageDirectory: 'coverage',
              testMatch: ['**/*.test.js'],
              transform: {},
              moduleFileExtensions: ['js', 'json'],
              verbose: true
            }
          }
        ]
      }
    };
  }
  
  /**
   * Handle parent messages
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        return await this._handleTestGeneration(parentTask);
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle child messages (not used - leaf strategy)
   */
  async onChildMessage(childTask, message) {
    return { acknowledged: false, error: 'SimpleNodeTestStrategy does not handle child messages' };
  }
  
  /**
   * Main test generation handler
   */
  async _handleTestGeneration(task) {
    try {
      console.log(`🧪 Generating tests for: ${task.description}`);
      
      // Initialize components
      await this.initialize(task);
      
      // Get code to test (from artifacts or description)
      const codeToTest = await this._getCodeToTest(task);
      if (!codeToTest) {
        throw new Error('No code found to test');
      }
      
      // Analyze code for testing
      const analysis = await this._analyzeCode(codeToTest);
      task.addConversationEntry('system', `Found ${analysis.testTargets.length} test targets`);
      
      // Generate tests for each target
      const tests = [];
      for (const target of analysis.testTargets) {
        const test = await this._generateTest(target, analysis.edgeCases);
        tests.push(test);
      }
      
      // Write test files
      const testDir = await this._setupTestDirectory(task);
      const testFiles = [];
      
      for (let i = 0; i < tests.length; i++) {
        const testFilename = `test-${i + 1}.test.js`;
        const testPath = path.join(testDir, testFilename);
        await this.tools.fileWrite.execute({ 
          filepath: testPath, 
          content: tests[i].testCode 
        });
        testFiles.push(testFilename);
        task.storeArtifact(testFilename, tests[i].testCode, tests[i].testDescription, 'file');
      }
      
      // Generate test configuration
      const testConfig = await this._generateTestConfig(testFiles);
      await this.tools.fileWrite.execute({ 
        filepath: path.join(testDir, 'jest.config.js'), 
        content: `module.exports = ${JSON.stringify(testConfig.jestConfig, null, 2)};` 
      });
      
      // Run tests if requested
      let testResults = null;
      if (task.description.includes('run') || task.description.includes('execute')) {
        testResults = await this._runTests(testDir);
      }
      
      const result = {
        success: true,
        message: `Generated ${tests.length} test files`,
        testDir: testDir,
        testFiles: testFiles,
        testResults: testResults,
        artifacts: Object.values(task.getAllArtifacts())
      };
      
      task.complete(result);
      return result;
      
    } catch (error) {
      console.error(`❌ Test generation error:`, error);
      task.fail(error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get code to test from task artifacts or file
   */
  async _getCodeToTest(task) {
    // Check artifacts first
    const artifacts = task.getAllArtifacts();
    for (const artifact of Object.values(artifacts)) {
      if (artifact.type === 'file' && artifact.name.endsWith('.js')) {
        return artifact.value;
      }
    }
    
    // Try to extract file path from description
    const fileMatch = task.description.match(/test\s+(.+\.js)/i);
    if (fileMatch && this.tools.fileRead) {
      try {
        const result = await this.tools.fileRead.execute({ filepath: fileMatch[1] });
        return result.content;
      } catch (error) {
        console.log(`Could not read file ${fileMatch[1]}: ${error.message}`);
      }
    }
    
    return null;
  }
  
  /**
   * Analyze code to identify test targets
   */
  async _analyzeCode(code) {
    const result = await this._executePrompt(
      'strategies/simple-node/test/analyze-code',
      { code: code }
    );
    
    if (!result.success) {
      throw new Error(`Failed to analyze code: ${result.errors?.join(', ') || 'Unknown error'}`);
    }
    
    return result.data;
  }
  
  /**
   * Generate test for a specific target
   */
  async _generateTest(target, edgeCases) {
    // Format edge cases for template
    const edgeCasesStr = (edgeCases || []).map(e => `- ${e}`).join('\n');
    
    const result = await this._executePrompt(
      'strategies/simple-node/test/generate-test',
      {
        targetName: target.name,
        targetType: target.type,
        targetDescription: target.description,
        edgeCases: edgeCasesStr
      }
    );
    
    if (!result.success) {
      throw new Error(`Failed to generate test: ${result.errors?.join(', ') || 'Unknown error'}`);
    }
    
    return result.data;
  }
  
  /**
   * Generate test configuration
   */
  async _generateTestConfig(testFiles) {
    const result = await this._executePrompt(
      'strategies/simple-node/test/generate-test-config',
      {
        testFiles: testFiles.join(', ')
      }
    );
    
    if (!result.success) {
      throw new Error(`Failed to generate test config: ${result.errors?.join(', ') || 'Unknown error'}`);
    }
    
    return result.data;
  }
  
  /**
   * Setup test directory
   */
  async _setupTestDirectory(task) {
    const timestamp = Date.now();
    const testDirName = `node-tests-${timestamp}`;
    const testDir = path.join(this.projectRoot, testDirName);
    
    await this.tools.fileWrite.execute({ 
      filepath: path.join(testDir, '.gitkeep'), 
      content: '' 
    });
    
    return testDir;
  }
  
  /**
   * Run tests using command executor
   */
  async _runTests(testDir) {
    if (!this.tools.commandExecutor) {
      return null;
    }
    
    try {
      // Install Jest first
      await this.tools.commandExecutor.execute({
        command: 'npm init -y && npm install --save-dev jest',
        cwd: testDir
      });
      
      // Run tests
      const result = await this.tools.commandExecutor.execute({
        command: 'npx jest',
        cwd: testDir
      });
      
      return {
        success: result.success,
        output: result.output,
        exitCode: result.exitCode
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Extract context from task
   */
  _getContextFromTask(task) {
    return {
      llmClient: (task.lookup && task.lookup('llmClient')) || task.context?.llmClient,
      toolRegistry: (task.lookup && task.lookup('toolRegistry')) || task.context?.toolRegistry,
      workspaceDir: (task.lookup && task.lookup('workspaceDir')) || task.context?.workspaceDir || this.projectRoot
    };
  }
}