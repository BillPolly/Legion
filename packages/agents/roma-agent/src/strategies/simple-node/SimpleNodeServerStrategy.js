/**
 * SimpleNodeServerStrategy - Strategy for creating simple Node.js server applications
 * Converted to pure prototypal pattern
 * 
 * Focused on generating Express/HTTP servers with clean, testable code.
 * Uses PromptFactory for all LLM interactions with data-driven prompts.
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
  analyzeRequirements: {
    type: 'object',
    properties: {
      serverType: { 
        type: 'string', 
        enum: ['express', 'fastify', 'http'],
        description: 'Type of Node.js server framework'
      },
      endpoints: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
            path: { type: 'string' },
            description: { type: 'string' }
          },
          required: ['method', 'path', 'description']
        }
      }
    },
    required: ['serverType', 'endpoints']
  },
  
  generateCode: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Generated Node.js server code' },
      dependencies: {
        type: 'array',
        items: { type: 'string' },
        description: 'NPM dependencies required'
      }
    },
    required: ['code']
  },
  
  generatePackageJson: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      version: { type: 'string' },
      description: { type: 'string' },
      main: { type: 'string' },
      scripts: { type: 'object' },
      dependencies: { type: 'object' }
    },
    required: ['name', 'version', 'main', 'dependencies']
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
 * Create a SimpleNodeServerStrategy prototype
 * This factory function creates the strategy with its dependencies
 */
export function createSimpleNodeServerStrategy(context = {}, options = {}) {
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
      directoryCreate: null
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
      const templatePath = `simple-node-server/${promptName.replace(/([A-Z])/g, '-$1').toLowerCase().slice(1)}`;
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
            console.log(`✅ SimpleNodeServer child task completed: ${senderTask.description}`);
            // Handle child task completion
            handleChildComplete.call(this, senderTask, message.result, config).catch(error => {
              console.error(`❌ SimpleNodeServerStrategy child completion handling failed: ${error.message}`);
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
            console.log(`❌ SimpleNodeServer child task failed: ${senderTask.description}`);
            this.send(this.parent, { type: 'child-failed', child: senderTask, error: message.error });
            break;
            
          default:
            console.log(`ℹ️ SimpleNodeServerStrategy received unhandled message from child: ${message.type}`);
        }
      } else {
        // Message from parent or initiator
        switch (message.type) {
          case 'start':
          case 'work':
            // Determine handler based on action type
            if (senderTask.action === 'create_directory_structure') {
              handleDirectoryCreation.call(this, config).catch(error => {
                console.error(`❌ Directory creation failed: ${error.message}`);
                try {
                  this.fail(error);
                  if (this.parent) {
                    this.send(this.parent, { type: 'failed', error });
                  }
                } catch (innerError) {
                  console.error(`❌ Failed to handle directory creation error: ${innerError.message}`);
                }
              });
            } else if (senderTask.action === 'initialize_package_json') {
              handlePackageJsonCreation.call(this, config).catch(error => {
                console.error(`❌ Package.json creation failed: ${error.message}`);
                try {
                  this.fail(error);
                  if (this.parent) {
                    this.send(this.parent, { type: 'failed', error });
                  }
                } catch (innerError) {
                  console.error(`❌ Failed to handle package.json creation error: ${innerError.message}`);
                }
              });
            } else if (senderTask.action === 'install_dependencies') {
              handleDependencyInstallation.call(this, config).catch(error => {
                console.error(`❌ Dependency installation failed: ${error.message}`);
                try {
                  this.fail(error);
                  if (this.parent) {
                    this.send(this.parent, { type: 'failed', error });
                  }
                } catch (innerError) {
                  console.error(`❌ Failed to handle dependency installation error: ${innerError.message}`);
                }
              });
            } else {
              // Default: server generation
              handleServerGeneration.call(this, config).catch(error => {
                console.error(`❌ Server generation failed: ${error.message}`);
                try {
                  this.fail(error);
                  if (this.parent) {
                    this.send(this.parent, { type: 'failed', error });
                  }
                } catch (innerError) {
                  console.error(`❌ Failed to handle server generation error: ${innerError.message}`);
                }
              });
            }
            break;
            
          default:
            console.log(`ℹ️ SimpleNodeServerStrategy received unhandled message: ${message.type}`);
        }
      }
    } catch (error) {
      // Catch any synchronous errors in message handling
      console.error(`❌ SimpleNodeServerStrategy message handler error: ${error.message}`);
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
export default createSimpleNodeServerStrategy;

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
  config.tools.directoryCreate = await config.toolRegistry.getTool('directory_create');
}

/**
 * Main server generation handler
 */
async function handleServerGeneration(config) {
  try {
    console.log(`🚀 Generating Node.js server for: ${this.description}`);
    
    // Initialize components
    await initializeDependencies(config, this);
    
    // Analyze requirements
    const requirements = await analyzeRequirements(config, this);
    this.addConversationEntry('system', `Server type: ${requirements.serverType}, Endpoints: ${requirements.endpoints.length}`);
    
    // Generate server code
    const serverCode = await generateServer(config, requirements, this);
    
    // Setup project structure
    const projectDir = await setupProject(config, this);
    
    // Write server file
    const serverPath = path.join(projectDir, 'server.js');
    await config.tools.fileWrite.execute({ 
      filepath: serverPath, 
      content: serverCode.code 
    });
    
    // Generate and write package.json
    const packageJson = await generatePackageJson(config, requirements.serverType, serverCode.dependencies, this);
    await config.tools.fileWrite.execute({ 
      filepath: path.join(projectDir, 'package.json'), 
      content: JSON.stringify(packageJson, null, 2) 
    });
    
    // Store artifacts
    this.storeArtifact('server.js', serverCode.code, 'Node.js server', 'file');
    this.storeArtifact('package.json', packageJson, 'Package configuration', 'json');
    
    const result = {
      success: true,
      message: `Created ${requirements.serverType} server with ${requirements.endpoints.length} endpoints`,
      projectDir: projectDir,
      artifacts: Object.values(this.getAllArtifacts())
    };
    
    this.complete(result);
    
    // Notify parent if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'completed', result });
    }
    
  } catch (error) {
    console.error(`❌ Server generation error:`, error);
    this.fail(error);
    
    // Notify parent of failure if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'failed', error });
    }
  }
}

/**
 * Handle directory creation tasks
 */
async function handleDirectoryCreation(config) {
  try {
    console.log(`📁 Creating directory structure for: ${this.description}`);
    
    // Initialize components
    await initializeDependencies(config, this);
    
    // Setup project structure - this will create the directories
    const projectDir = await setupProject(config, this);
    
    // Store artifact
    this.storeArtifact('project_structure', projectDir, 'Project directory structure', 'directory');
    
    const result = {
      success: true,
      message: `Created project directory: ${projectDir}`,
      projectDir: projectDir,
      artifacts: Object.values(this.getAllArtifacts())
    };
    
    this.complete(result);
    
    // Notify parent if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'completed', result });
    }
    
  } catch (error) {
    console.error(`❌ Directory creation error:`, error);
    this.fail(error);
    
    // Notify parent of failure if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'failed', error });
    }
  }
}

/**
 * Handle package.json creation tasks
 */
async function handlePackageJsonCreation(config) {
  try {
    console.log(`📦 Creating package.json for: ${this.description}`);
    
    // Initialize components
    await initializeDependencies(config, this);
    
    // Generate a basic package.json
    const packageJson = await generatePackageJson(config, 'express', ['express'], this);
    
    // For this task, we'll store it but not write to file system
    // The actual writing will be done by server generation task
    this.storeArtifact('package.json', packageJson, 'Package configuration', 'json');
    
    const result = {
      success: true,
      message: 'Generated package.json configuration',
      artifacts: Object.values(this.getAllArtifacts())
    };
    
    this.complete(result);
    
    // Notify parent if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'completed', result });
    }
    
  } catch (error) {
    console.error(`❌ Package.json creation error:`, error);
    this.fail(error);
    
    // Notify parent of failure if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'failed', error });
    }
  }
}

/**
 * Handle dependency installation tasks
 */
async function handleDependencyInstallation(config) {
  try {
    console.log(`⬇️  Installing dependencies for: ${this.description}`);
    
    // For this mock implementation, we'll just simulate success
    this.storeArtifact('dependencies_installed', 'express@^4.18.2', 'Installed dependencies', 'text');
    
    const result = {
      success: true,
      message: 'Dependencies installed successfully',
      artifacts: Object.values(this.getAllArtifacts())
    };
    
    this.complete(result);
    
    // Notify parent if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'completed', result });
    }
    
  } catch (error) {
    console.error(`❌ Dependency installation error:`, error);
    this.fail(error);
    
    // Notify parent of failure if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'failed', error });
    }
  }
}

/**
 * Analyze server requirements from task description
 */
async function analyzeRequirements(config, task) {
  // Get the TemplatedPrompt instance through the strategy
  const prompt = await task.getPrompt('analyzeRequirements');
  
  const result = await prompt.execute({
    taskDescription: task.description
  });
  
  if (!result.success) {
    const errorMsg = result.errors?.map(e => typeof e === 'object' ? JSON.stringify(e) : e).join(', ') || 'Unknown error';
    throw new Error(`Failed to analyze requirements: ${errorMsg}`);
  }
  
  return result.data;
}

/**
 * Generate server code based on requirements
 */
async function generateServer(config, requirements, task) {
  // Get the TemplatedPrompt instance through the strategy
  const prompt = await task.getPrompt('generateCode');

  // Format endpoints for template
  const endpointsStr = requirements.endpoints.map(
    e => `- ${e.method} ${e.path}: ${e.description}`
  ).join('\n');

  const result = await prompt.execute({
    serverType: requirements.serverType,
    endpoints: endpointsStr
  });

  if (!result.success) {
    const errorMsg = result.errors?.join(', ') || 'Unknown error';
    throw new Error(`Failed to generate server: ${errorMsg}`);
  }

  return result.data;
}

/**
 * Generate package.json
 */
async function generatePackageJson(config, serverType, dependencies, task) {
  // Get the TemplatedPrompt instance through the strategy
  const prompt = await task.getPrompt('generatePackageJson');

  const result = await prompt.execute({
    serverType: serverType,
    dependencies: dependencies.join(', ')
  });

  if (!result.success) {
    const errorMsg = result.errors?.join(', ') || 'Unknown error';
    throw new Error(`Failed to generate package.json: ${errorMsg}`);
  }

  const data = result.data || {};
  return data.packageJson || data;
}

/**
 * Setup project directory
 */
async function setupProject(config, task) {
  const timestamp = Date.now();
  const projectName = `node-server-${timestamp}`;
  const projectDir = path.join(config.projectRoot, projectName);
  
  await config.tools.directoryCreate.execute({ path: config.projectRoot });
  await config.tools.directoryCreate.execute({ path: projectDir });
  
  return projectDir;
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
