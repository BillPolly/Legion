/**
 * SimpleNodeServerStrategy - Strategy for creating simple Node.js server applications
 * Converted to pure prototypal pattern
 * 
 * Focused on generating Express/HTTP servers with clean, testable code.
 * Uses PromptFactory for all LLM interactions with data-driven prompts.
 */

import { TaskStrategy } from '@legion/tasks';
import { EnhancedPromptRegistry } from '@legion/prompting-manager';
import PromptFactory from '../../utils/PromptFactory.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create a SimpleNodeServerStrategy prototype
 * This factory function creates the strategy with its dependencies
 */
export function createSimpleNodeServerStrategy(llmClient = null, toolRegistry = null, options = {}) {
  // Create the strategy as an object that inherits from TaskStrategy
  const strategy = Object.create(TaskStrategy);
  
  // Store configuration
  const config = {
    llmClient: llmClient,
    toolRegistry: toolRegistry,
    projectRoot: options.projectRoot || '/tmp/roma-projects',
    
    // Pre-instantiated tools
    tools: {
      fileWrite: null,
      directoryCreate: null
    },
    
    // Initialize prompt registry
    promptRegistry: null
  };
  
  // Initialize prompt registry
  const promptsPath = path.resolve(__dirname, '../../../prompts');
  config.promptRegistry = new EnhancedPromptRegistry(promptsPath);
  
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
  config.llmClient = config.llmClient || context.llmClient;
  config.toolRegistry = config.toolRegistry || context.toolRegistry;
  
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
    const serverCode = await generateServer(config, requirements);
    
    // Setup project structure
    const projectDir = await setupProject(config, this);
    
    // Write server file
    const serverPath = path.join(projectDir, 'server.js');
    await config.tools.fileWrite.execute({ 
      filepath: serverPath, 
      content: serverCode.code 
    });
    
    // Generate and write package.json
    const packageJson = await generatePackageJson(config, requirements.serverType, serverCode.dependencies);
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
    const packageJson = await generatePackageJson(config, 'express', ['express']);
    
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
  const result = await executePrompt(config,
    'strategies/simple-node/server/analyze-requirements',
    { taskDescription: task.description }
  );
  
  if (!result.success) {
    const errorMsg = result.errors?.map(e => typeof e === 'object' ? JSON.stringify(e) : e).join(', ') || 'Unknown error';
    throw new Error(`Failed to analyze requirements: ${errorMsg}`);
  }
  
  return result.data;
}

/**
 * Generate server code based on requirements
 */
async function generateServer(config, requirements) {
  // Format endpoints for template
  const endpointsStr = requirements.endpoints.map(
    e => `- ${e.method} ${e.path}: ${e.description}`
  ).join('\n');
  
  const result = await executePrompt(config,
    'strategies/simple-node/server/generate-code',
    {
      serverType: requirements.serverType,
      endpoints: endpointsStr
    }
  );
  
  if (!result.success) {
    throw new Error(`Failed to generate server: ${result.errors?.join(', ') || 'Unknown error'}`);
  }
  
  return result.data;
}

/**
 * Generate package.json
 */
async function generatePackageJson(config, serverType, dependencies) {
  const result = await executePrompt(config,
    'strategies/simple-node/server/generate-package-json',
    {
      serverType: serverType,
      dependencies: dependencies.join(', ')
    }
  );
  
  if (!result.success) {
    throw new Error(`Failed to generate package.json: ${result.errors?.join(', ') || 'Unknown error'}`);
  }
  
  // The LLM returns the package.json directly as result.data
  // If it's wrapped in packageJson property, use that, otherwise use data directly
  return result.data.packageJson || result.data;
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
 * Execute prompt with LLM
 */
async function executePrompt(config, promptPath, variables) {
  const prompt = await config.promptRegistry.fill(promptPath, variables);
  const response = await config.llmClient.complete(prompt);
  
  // Parse response based on expected format
  const metadata = await config.promptRegistry.getMetadata(promptPath);
  
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
    // For delimited responses, extract sections
    const sections = response.split(/---+/);
    if (sections.length >= 3) {
      return {
        success: true,
        data: {
          code: sections[0].trim(),
          dependencies: sections[1] ? sections[1].trim().split(',').map(d => d.trim()).filter(d => d) : [],
          explanation: sections[2] ? sections[2].trim() : ''
        }
      };
    }
    // Fall back to structured parsing
    const codeMatch = response.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
    const depsMatch = response.match(/dependencies?:\s*\[([^\]]+)\]/i) || response.match(/dependencies?:\s*([^\n]+)/i);
    
    return {
      success: true,
      data: {
        code: codeMatch ? codeMatch[1].trim() : response,
        dependencies: depsMatch ? depsMatch[1].split(',').map(d => d.trim().replace(/["']/g, '')) : []
      }
    };
  }
  
  return { success: true, data: response };
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