/**
 * SimpleNodeDebugStrategy - Strategy for debugging Node.js applications
 * Converted to pure prototypal pattern
 * 
 * Focused on identifying and fixing issues in Node.js code.
 * Uses PromptFactory for all LLM interactions with data-driven prompts.
 */

import { TaskStrategy } from '@legion/tasks';
import { PromptRegistry } from '@legion/prompting-manager';
import PromptFactory from '../../utils/PromptFactory.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create a SimpleNodeDebugStrategy prototype
 * This factory function creates the strategy with its dependencies
 */
export function createSimpleNodeDebugStrategy(llmClient = null, toolRegistry = null, options = {}) {
  // Create the strategy as an object that inherits from TaskStrategy
  const strategy = Object.create(TaskStrategy);
  
  // Store configuration
  const config = {
    llmClient: llmClient,
    toolRegistry: toolRegistry,
    projectRoot: options.projectRoot || '/tmp/roma-projects',
    
    // Pre-instantiated tools
    tools: {
      fileRead: null,
      fileWrite: null,
      commandExecutor: null
    },
    
    // Initialize prompt registry
    promptRegistry: null,

    // Cached prompt instances
    prompts: null
  };
  
  // Initialize prompt registry
  const promptsPath = path.resolve(__dirname, '../../../prompts');
  config.promptRegistry = new PromptRegistry();
  config.promptRegistry.addDirectory(promptsPath);
  
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
            console.log(`✅ SimpleNodeDebug child task completed: ${senderTask.description}`);
            // Handle child task completion
            handleChildComplete.call(this, senderTask, message.result, config).catch(error => {
              console.error(`❌ SimpleNodeDebugStrategy child completion handling failed: ${error.message}`);
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
            console.log(`❌ SimpleNodeDebug child task failed: ${senderTask.description}`);
            this.send(this.parent, { type: 'child-failed', child: senderTask, error: message.error });
            break;
            
          default:
            console.log(`ℹ️ SimpleNodeDebugStrategy received unhandled message from child: ${message.type}`);
        }
      } else {
        // Message from parent or initiator
        switch (message.type) {
          case 'start':
          case 'work':
            // Fire-and-forget async operation with error boundary
            handleDebugging.call(this, config).catch(error => {
              console.error(`❌ SimpleNodeDebugStrategy async operation failed: ${error.message}`);
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
            console.log(`ℹ️ SimpleNodeDebugStrategy received unhandled message: ${message.type}`);
        }
      }
    } catch (error) {
      // Catch any synchronous errors in message handling
      console.error(`❌ SimpleNodeDebugStrategy message handler error: ${error.message}`);
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
export default createSimpleNodeDebugStrategy;

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
  config.llmClient = config.llmClient || context.llmClient;
  config.toolRegistry = config.toolRegistry || context.toolRegistry;
  
  if (!config.llmClient) {
    throw new Error('LLM client is required');
  }
  
  if (!config.toolRegistry) {
    throw new Error('ToolRegistry is required');
  }
  
  // Load required tools
  config.tools.fileRead = await config.toolRegistry.getTool('file_read');
  config.tools.fileWrite = await config.toolRegistry.getTool('file_write');
  config.tools.commandExecutor = await config.toolRegistry.getTool('command_executor');

  await ensurePrompts(config);
}
/**
 * Main debugging handler
 */
async function handleDebugging(config) {
  try {
    console.log(`🐛 Debugging: ${this.description}`);
    
    // Initialize components
    await initializeDependencies(config, this);
    
    // Determine debug type from task
    const debugType = determineDebugType(this.description);
    
    let result;
    switch (debugType) {
      case 'error':
        result = await debugError(config, this);
        break;
      case 'performance':
        result = await debugPerformance(config, this);
        break;
      case 'logic':
        result = await debugLogic(config, this);
        break;
      default:
        result = await addDebugging(config, this);
    }
    
    this.complete(result);
    
    // Notify parent if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'completed', result });
    }
    
  } catch (error) {
    console.error(`❌ Debugging error:`, error);
    
    this.addConversationEntry('system', 
      `Debugging failed: ${error.message}`);
    
    this.fail(error);
    
    // Notify parent of failure if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'failed', error });
    }
  }
}

async function ensurePrompts(config) {
  if (config.prompts) {
    return config.prompts;
  }

  if (!config.llmClient) {
    throw new Error('LLM client is required to initialize prompts');
  }

  const prompts = {};

  const analyzeTemplate = await config.promptRegistry.load('strategies/simple-node/debug/analyze-error');
  const analyzeSchema = PromptFactory.createJsonSchema({
    rootCause: { type: 'string' },
    errorType: { type: 'string' },
    location: {
      type: 'object',
      properties: {
        file: { type: 'string' },
        line: { type: 'number' },
        function: { type: 'string' }
      },
      required: ['file']
    },
    suggestedFix: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] }
  }, ['rootCause', 'errorType', 'suggestedFix']);

  const analyzeExamples = [{
    rootCause: 'Unhandled null input when parsing user data',
    errorType: 'TypeError',
    location: {
      file: 'controllers/userController.js',
      line: 42,
      function: 'createUser'
    },
    suggestedFix: 'Add null check before accessing user.email',
    confidence: 'high'
  }];

  prompts.analyzeError = PromptFactory.createPrompt({
    template: analyzeTemplate.content,
    responseSchema: analyzeSchema,
    examples: analyzeExamples
  }, config.llmClient);

  const fixTemplate = await config.promptRegistry.load('strategies/simple-node/debug/generate-fix');
  const fixSchema = PromptFactory.createJsonSchema({
    fixedCode: { type: 'string' },
    explanation: { type: 'string' },
    testInstructions: { type: 'string' }
  }, ['fixedCode', 'explanation'], 'delimited');

  const fixExamples = [{
    fixedCode: `function createUser(req, res) {
  if (!req.body || !req.body.email) {
    return res.status(400).json({ error: 'Email required' });
  }
  // ...rest of implementation
}`,
    explanation: 'Adds input validation before accessing email',
    testInstructions: 'Run POST /users with and without email to confirm validation.'
  }];

  prompts.generateFix = PromptFactory.createPrompt({
    template: fixTemplate.content,
    responseSchema: fixSchema,
    examples: fixExamples
  }, config.llmClient);

  const debugTemplate = await config.promptRegistry.load('strategies/simple-node/debug/add-debugging');
  const debugSchema = PromptFactory.createJsonSchema({
    debugCode: { type: 'string' },
    debugPoints: {
      type: 'array',
      items: { type: 'string' }
    },
    recommendations: { type: 'string' }
  }, ['debugCode'], 'delimited');

  const debugExamples = [{
    debugCode: `app.get('/users', async (req, res) => {
  console.time('getUsers');
  console.log('Fetching users for tenant', req.headers['x-tenant']);
  const users = await userService.list();
  console.timeEnd('getUsers');
  res.json(users);
});`,
    debugPoints: ['Log tenant header', 'Capture execution time'],
    recommendations: 'Review logs to identify slow database calls.'
  }];

  prompts.addDebugging = PromptFactory.createPrompt({
    template: debugTemplate.content,
    responseSchema: debugSchema,
    examples: debugExamples
  }, config.llmClient);

  config.prompts = prompts;
  return config.prompts;
}
/**
 * Determine type of debugging needed
 */
function determineDebugType(description) {
  const lower = description.toLowerCase();
  
  if (lower.includes('error') || lower.includes('exception') || lower.includes('crash')) {
    return 'error';
  }
  if (lower.includes('slow') || lower.includes('performance') || lower.includes('timeout')) {
    return 'performance';
  }
  if (lower.includes('wrong') || lower.includes('incorrect') || lower.includes('bug')) {
    return 'logic';
  }
  
  return 'general';
}

/**
 * Debug error/exception issues
 */
async function debugError(config, task) {
  // Get error information from task
  const errorInfo = await extractErrorInfo(config, task);
  const prompts = await ensurePrompts(config);
  
  // Analyze the error
  const analysis = await prompts.analyzeError.execute({
    errorMessage: errorInfo.message,
    stackTrace: errorInfo.stack,
    codeContext: errorInfo.code
  });
  
  if (!analysis.success) {
    throw new Error(`Failed to analyze error: ${analysis.errors?.join(', ') || 'Unknown error'}`);
  }
  
  task.addConversationEntry('system', `Error type: ${analysis.data.errorType}, Cause: ${analysis.data.rootCause}`);
  
  // Generate fix if code is available
  if (errorInfo.code) {
    const fix = await prompts.generateFix.execute({
      problem: errorInfo.message,
      rootCause: analysis.data.rootCause,
      originalCode: errorInfo.code
    });
    
    if (!fix.success) {
      throw new Error(`Failed to generate fix: ${fix.errors?.join(', ') || 'Unknown error'}`);
    }
    
    // Write fixed code
    const fixedPath = await writeFixedCode(config, task, fix.data.fixedCode);
    
    task.storeArtifact('fixed_code.js', fix.data.fixedCode, 'Fixed code', 'file');
    task.storeArtifact('fix_explanation.md', fix.data.explanation, 'Fix explanation', 'text');
    
    return {
      success: true,
      message: `Fixed ${analysis.data.errorType} error`,
      analysis: analysis.data,
      fix: fix.data,
      fixedFile: fixedPath,
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  return {
    success: true,
    message: 'Error analyzed',
    analysis: analysis.data,
    artifacts: Object.values(task.getAllArtifacts())
  };
}

/**
 * Debug performance issues
 */
async function debugPerformance(config, task) {
  const code = await getCodeFromTask(config, task);
  
  if (!code) {
    throw new Error('No code provided for performance debugging');
  }
  
  const prompts = await ensurePrompts(config);

  // Add performance debugging
  const result = await prompts.addDebugging.execute({ code });
  
  if (!result.success) {
    throw new Error(`Failed to add debugging: ${result.errors?.join(', ') || 'Unknown error'}`);
  }
  
  // Write debug version
  const debugPath = await writeDebugCode(config, task, result.data.debugCode);
  
  task.storeArtifact('debug_code.js', result.data.debugCode, 'Code with performance debugging', 'file');
  
  return {
    success: true,
    message: 'Added performance debugging',
    debugPoints: result.data.debugPoints,
    debugFile: debugPath,
    artifacts: Object.values(task.getAllArtifacts())
  };
}

/**
 * Debug logic issues
 */
async function debugLogic(config, task) {
  const code = await getCodeFromTask(config, task);
  
  if (!code) {
    throw new Error('No code provided for logic debugging');
  }
  
  const prompts = await ensurePrompts(config);

  // Add debugging statements
  const result = await prompts.addDebugging.execute({ code });
  
  if (!result.success) {
    throw new Error(`Failed to add debugging: ${result.errors?.join(', ') || 'Unknown error'}`);
  }
  
  // Write debug version
  const debugPath = await writeDebugCode(config, task, result.data.debugCode);
  
  task.storeArtifact('debug_code.js', result.data.debugCode, 'Code with logic debugging', 'file');
  
  return {
    success: true,
    message: 'Added logic debugging',
    debugPoints: result.data.debugPoints,
    debugFile: debugPath,
    artifacts: Object.values(task.getAllArtifacts())
  };
}

/**
 * Add general debugging
 */
async function addDebugging(config, task) {
  const code = await getCodeFromTask(config, task);
  
  if (!code) {
    throw new Error('No code provided for debugging');
  }
  
  const prompts = await ensurePrompts(config);
  const result = await prompts.addDebugging.execute({ code });
  
  if (!result.success) {
    throw new Error(`Failed to add debugging: ${result.errors?.join(', ') || 'Unknown error'}`);
  }
  
  const debugPath = await writeDebugCode(config, task, result.data.debugCode);
  
  task.storeArtifact('debug_code.js', result.data.debugCode, 'Code with debugging', 'file');
  
  return {
    success: true,
    message: 'Added debugging statements',
    debugPoints: result.data.debugPoints,
    debugFile: debugPath,
    artifacts: Object.values(task.getAllArtifacts())
  };
}

/**
 * Extract error information from task
 */
async function extractErrorInfo(config, task) {
  const artifacts = task.getAllArtifacts();
  
  // Look for error artifact
  for (const artifact of Object.values(artifacts)) {
    if (artifact.type === 'error' || artifact.name.includes('error')) {
      // Get code from error artifact if available, otherwise from task artifacts
      const codeFromError = artifact.value.code || '';
      const codeFromTask = codeFromError || await getCodeFromTask(config, task) || '';
      
      return {
        message: artifact.value.message || artifact.value,
        stack: artifact.value.stack || '',
        code: codeFromTask
      };
    }
  }
  
  // Try to extract from description
  const description = task.description;
  return {
    message: description,
    stack: '',
    code: await getCodeFromTask(config, task) || ''
  };
}

/**
 * Get code from task artifacts or file
 */
async function getCodeFromTask(config, task) {
  const artifacts = task.getAllArtifacts();
  
  for (const artifact of Object.values(artifacts)) {
    if (artifact.type === 'file' && artifact.name.endsWith('.js')) {
      return artifact.value;
    }
  }
  
  return null;
}

/**
 * Write fixed code to file
 */
async function writeFixedCode(config, task, code) {
  const timestamp = Date.now();
  const filename = `fixed-${timestamp}.js`;
  const filepath = path.join(config.projectRoot, filename);
  
  await config.tools.fileWrite.execute({ filepath, content: code });
  return filepath;
}

/**
 * Write debug code to file
 */
async function writeDebugCode(config, task, code) {
  const timestamp = Date.now();
  const filename = `debug-${timestamp}.js`;
  const filepath = path.join(config.projectRoot, filename);
  
  await config.tools.fileWrite.execute({ filepath, content: code });
  return filepath;
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
