/**
 * SimpleNodeTestStrategy - Strategy for testing simple Node.js applications
 * Converted to pure prototypal pattern
 * 
 * Focused on generating and running tests for Node.js servers and modules.
 * Uses TemplatedPrompt for all LLM interactions with schema validation.
 */

import { TaskStrategy } from '@legion/tasks';
import { TemplatedPrompt } from '@legion/prompting-manager';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Define prompt schemas for TemplatedPrompt
 * Each prompt will be loaded from a file and validated against these schemas
 */
const PROMPT_SCHEMAS = {
  analyzeCode: {
    type: 'object',
    properties: {
      testTargets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string' },
            description: { type: 'string' }
          },
          required: ['name', 'type']
        }
      },
      edgeCases: {
        type: 'array',
        items: { type: 'string' }
      },
      errorScenarios: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['testTargets']
  },
  
  generateTest: {
    type: 'object',
    properties: {
      testCode: { type: 'string' },
      testDescription: { type: 'string' },
      debugNotes: { type: 'string' }
    },
    required: ['testCode']
  },
  
  generateTestConfig: {
    type: 'object',
    properties: {
      jestConfig: { type: 'object' },
      instructions: { type: 'string' }
    },
    required: ['jestConfig']
  }
};

/**
 * Load a prompt template from the prompts directory
 */
async function loadPromptTemplate(promptPath) {
  const fullPath = path.join(__dirname, '../../../prompts', promptPath + '.md');
  try {
    return await fs.readFile(fullPath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to load prompt template at ${fullPath}: ${error.message}`);
  }
}

/**
 * Create a SimpleNodeTestStrategy prototype
 * This factory function creates the strategy with its dependencies
 */
export function createSimpleNodeTestStrategy(context = {}, options = {}) {
  // Support legacy signature for backward compatibility
  let actualContext = context;
  let actualOptions = options;
  if (arguments.length === 3) {
    // Called with old signature: (llmClient, toolRegistry, options)
    actualContext = { llmClient: arguments[0], toolRegistry: arguments[1] };
    actualOptions = arguments[2] || {};
  } else if (arguments.length === 2 && arguments[1] && !arguments[1].llmClient && !arguments[1].toolRegistry) {
    // Second arg is options, not toolRegistry
    if (context.llmClient || context.toolRegistry) {
      actualOptions = arguments[1];
    } else {
      // Old signature: (llmClient, toolRegistry)
      actualContext = { llmClient: arguments[0], toolRegistry: arguments[1] };
      actualOptions = {};
    }
  }
  
  // Create the strategy as an object that inherits from TaskStrategy
  const strategy = Object.create(TaskStrategy);
  
  // Store llmClient and sessionLogger for creating TemplatedPrompts
  strategy.llmClient = actualContext.llmClient;
  strategy.sessionLogger = actualOptions.sessionLogger;
  
  // Store prompt schemas for lazy initialization
  strategy.promptSchemas = PROMPT_SCHEMAS;
  strategy.prompts = {};
  
  // Store configuration
  const config = {
    context: actualContext,
    projectRoot: actualOptions.projectRoot || '/tmp/roma-projects',
    
    // Pre-instantiated tools
    tools: {
      fileWrite: null,
      fileRead: null,
      commandExecutor: null
    }
  };
  
  // Store config on strategy for access
  strategy.config = config;
  
  /**
   * Lazily create a TemplatedPrompt instance
   */
  strategy.getPrompt = async function(promptName) {
    if (!this.prompts[promptName]) {
      if (!this.promptSchemas[promptName]) {
        throw new Error(`Unknown prompt: ${promptName}`);
      }
      
      if (!this.llmClient) {
        throw new Error('LLMClient is required for TemplatedPrompt');
      }
      
      // Load the prompt template
      const templatePath = `simple-node-test/${promptName.replace(/([A-Z])/g, '-$1').toLowerCase().slice(1)}`;
      const template = await loadPromptTemplate(templatePath);
      
      // Create TemplatedPrompt instance
      this.prompts[promptName] = new TemplatedPrompt({
        prompt: template,
        responseSchema: this.promptSchemas[promptName],
        llmClient: this.llmClient,
        maxRetries: 3,
        sessionLogger: this.sessionLogger
      });
    }
    return this.prompts[promptName];
  };
  
  /**
   * The only required method - handles all messages
   */
  strategy.onMessage = function onMessage(senderTask, message) {
    // 'this' is the task instance that received the message
    
    try {
      // Determine if message is from child or parent/initiator
      if (senderTask.parent === this) {
        // Message from child task
        switch (message.type) {
          case 'completed':
            console.log(`✅ SimpleNodeTest child task completed: ${senderTask.description}`);
            // Handle child task completion
            handleChildComplete.call(this, senderTask, message.result, config).catch(error => {
              console.error(`❌ SimpleNodeTestStrategy child completion handling failed: ${error.message}`);
              try {
                this.fail(error);
                if (this.parent) {
                  this.send(this.parent, { type: 'failed', error });
                }
              } catch (innerError) {
                console.error(`❌ Failed to handle child completion error: ${innerError.message}`);
              }
            });
            break;
            
          case 'failed':
            console.log(`❌ SimpleNodeTest child task failed: ${senderTask.description}`);
            this.send(this.parent, { type: 'child-failed', child: senderTask, error: message.error });
            break;
            
          default:
            console.log(`ℹ️ SimpleNodeTestStrategy received unhandled message from child: ${message.type}`);
        }
      } else {
        // Message from parent or initiator
        switch (message.type) {
          case 'start':
          case 'work':
            // Fire-and-forget async operation with error boundary
            handleTestGeneration.call(this, config).catch(error => {
              console.error(`❌ SimpleNodeTestStrategy async operation failed: ${error.message}`);
              try {
                this.fail(error);
                if (this.parent) {
                  this.send(this.parent, { type: 'failed', error });
                }
              } catch (innerError) {
                console.error(`❌ Failed to handle async error: ${innerError.message}`);
              }
            });
            break;
            
          default:
            console.log(`ℹ️ SimpleNodeTestStrategy received unhandled message: ${message.type}`);
        }
      }
    } catch (error) {
      // Catch any synchronous errors in message handling
      console.error(`❌ SimpleNodeTestStrategy message handler error: ${error.message}`);
      // Don't let errors escape the message handler - handle them gracefully
      try {
        if (this.addConversationEntry) {
          this.addConversationEntry('system', `Message handling error: ${error.message}`);
        }
      } catch (innerError) {
        console.error(`❌ Failed to log message handling error: ${innerError.message}`);
      }
    }
  };
  
  return strategy;
}

// Export default for backward compatibility
export default createSimpleNodeTestStrategy;

// ============================================================================
// Internal implementation functions
// These work with the task instance and strategy config  
// ============================================================================

/**
 * Handle child task completion
 */
async function handleChildComplete(senderTask, result, config) {
  console.log(`✅ Child task completed: ${senderTask.description}`);
  
  // Copy artifacts from child to parent
  const childArtifacts = senderTask.getAllArtifacts();
  for (const [name, artifact] of Object.entries(childArtifacts)) {
    this.storeArtifact(name, artifact.content, artifact.description, artifact.type);
  }
  
  console.log(`📦 Copied ${Object.keys(childArtifacts).length} artifacts from child`);
  
  return { acknowledged: true, childComplete: true };
}

/**
 * Initialize strategy components and prompts
 * Called with task as 'this' context
 */
async function initializeDependencies(config, task) {
  // Get services from task context
  const context = getContextFromTask(task);
  config.llmClient = config.llmClient || config.context?.llmClient || context.llmClient;
  config.toolRegistry = config.toolRegistry || config.context?.toolRegistry || context.toolRegistry;
  
  if (!config.llmClient) {
    throw new Error('LLM client is required');
  }
  
  if (!config.toolRegistry) {
    throw new Error('ToolRegistry is required');
  }
  
  // Load required tools
  config.tools.fileWrite = await config.toolRegistry.getTool('file_write');
  config.tools.fileRead = await config.toolRegistry.getTool('file_read');
  config.tools.commandExecutor = await config.toolRegistry.getTool('command_executor');
}
/**
 * Main test generation handler
 */
async function handleTestGeneration(config) {
  try {
    console.log(`🧪 Generating tests for: ${this.description}`);
    
    // Initialize components
    await initializeDependencies(config, this);
    
    // Get code to test (from artifacts or description)
    const codeToTest = await getCodeToTest(config, this);
    if (!codeToTest) {
      throw new Error('No code found to test');
    }
    
    // Analyze code for testing
    const analysis = await analyzeCode(this, codeToTest);
    this.addConversationEntry('system', `Found ${analysis.testTargets.length} test targets`);
    
    // Generate tests for each target
    const tests = [];
    for (const target of analysis.testTargets) {
      const test = await generateTest(this, target, analysis.edgeCases);
      tests.push(test);
    }
    
    // Write test files
    const testDir = await setupTestDirectory(config, this);
    const testFiles = [];
    
    for (let i = 0; i < tests.length; i++) {
      const testFilename = `test-${i + 1}.test.js`;
      const testPath = path.join(testDir, testFilename);
      await config.tools.fileWrite.execute({ 
        filepath: testPath, 
        content: tests[i].testCode 
      });
      testFiles.push(testFilename);
      this.storeArtifact(testFilename, tests[i].testCode, tests[i].testDescription, 'file');
    }
    
    // Generate test configuration
    const testConfig = await generateTestConfig(this, testFiles);
    await config.tools.fileWrite.execute({ 
      filepath: path.join(testDir, 'jest.config.js'), 
      content: `module.exports = ${JSON.stringify(testConfig.jestConfig, null, 2)};` 
    });
    
    // Run tests if requested
    let testResults = null;
    if (this.description.includes('run') || this.description.includes('execute')) {
      testResults = await runTests(config, testDir);
    }
    
    const result = {
      success: true,
      message: `Generated ${tests.length} test files`,
      testDir: testDir,
      testFiles: testFiles,
      testResults: testResults,
      artifacts: Object.values(this.getAllArtifacts())
    };
    
    this.complete(result);
    
    // Notify parent if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'completed', result });
    }
    
  } catch (error) {
    console.error(`❌ Test generation error:`, error);
    
    this.addConversationEntry('system', 
      `Test generation failed: ${error.message}`);
    
    this.fail(error);
    
    // Notify parent of failure if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'failed', error });
    }
  }
}

/**
 * Get code to test from task artifacts or file
 */
async function getCodeToTest(config, task) {
  // Check artifacts first
  const artifacts = task.getAllArtifacts();
  for (const artifact of Object.values(artifacts)) {
    if (artifact.type === 'file' && artifact.name.endsWith('.js')) {
      return artifact.value;
    }
  }
  
  // Try to extract file path from description
  const fileMatch = task.description.match(/test\s+(.+\.js)/i);
  if (fileMatch && config.tools.fileRead) {
    try {
      const result = await config.tools.fileRead.execute({ filepath: fileMatch[1] });
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
async function analyzeCode(task, code) {
  // Get the TemplatedPrompt instance through the strategy
  const prompt = await task.getPrompt('analyzeCode');
  
  const result = await prompt.execute({ code });
  
  if (!result.success) {
    throw new Error(`Failed to analyze code: ${result.errors?.join(', ') || 'Unknown error'}`);
  }
  
  return result.data;
}

/**
 * Generate test for a specific target
 */
async function generateTest(task, target, edgeCases) {
  // Format edge cases for template
  const edgeCasesStr = (edgeCases || []).map(e => `- ${e}`).join('\n');
  
  // Get the TemplatedPrompt instance through the strategy
  const prompt = await task.getPrompt('generateTest');
  
  const result = await prompt.execute({
    targetName: target.name,
    targetType: target.type,
    targetDescription: target.description,
    edgeCases: edgeCasesStr
  });
  
  if (!result.success) {
    throw new Error(`Failed to generate test: ${result.errors?.join(', ') || 'Unknown error'}`);
  }
  
  return result.data;
}

/**
 * Generate test configuration
 */
async function generateTestConfig(task, testFiles) {
  // Get the TemplatedPrompt instance through the strategy
  const prompt = await task.getPrompt('generateTestConfig');
  
  const result = await prompt.execute({
    testFiles: testFiles.join(', ')
  });
  
  if (!result.success) {
    throw new Error(`Failed to generate test config: ${result.errors?.join(', ') || 'Unknown error'}`);
  }
  
  return result.data;
}

/**
 * Setup test directory
 */
async function setupTestDirectory(config, task) {
  const timestamp = Date.now();
  const testDirName = `node-tests-${timestamp}`;
  const testDir = path.join(config.projectRoot, testDirName);
  
  await config.tools.fileWrite.execute({ 
    filepath: path.join(testDir, '.gitkeep'), 
    content: '' 
  });
  
  return testDir;
}

/**
 * Run tests using command executor
 */
async function runTests(config, testDir) {
  if (!config.tools.commandExecutor) {
    return null;
  }
  
  try {
    // Install Jest first
    await config.tools.commandExecutor.execute({
      command: 'npm init -y && npm install --save-dev jest',
      cwd: testDir
    });
    
    // Run tests
    const result = await config.tools.commandExecutor.execute({
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
 * Helper to extract context from task
 */
function getContextFromTask(task) {
  return {
    llmClient: (task.lookup && task.lookup('llmClient')) || task.context?.llmClient,
    toolRegistry: (task.lookup && task.lookup('toolRegistry')) || task.context?.toolRegistry,
    workspaceDir: (task.lookup && task.lookup('workspaceDir')) || task.context?.workspaceDir
  };
}
