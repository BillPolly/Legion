/**
 * StrategyHelpers - Common utility functions for strategy implementations
 * 
 * This module provides reusable helper functions that eliminate boilerplate
 * across strategy implementations. These helpers handle common patterns like:
 * - Async operation wrapping with error handling
 * - Service extraction from context
 * - Artifact management
 * - JSON response parsing
 * - Parent notification patterns
 */

/**
 * Wrap an async function with standard error handling
 * This creates a fire-and-forget async operation with error boundary
 * 
 * @param {Function} asyncFn - The async function to wrap
 * @param {Object} task - The task instance (this context)
 * @param {Object} config - Optional configuration
 * @returns {Function} Wrapped function that handles errors consistently
 */
export function asyncHandler(asyncFn) {
  return function wrappedAsyncHandler(...args) {
    // 'this' is the task instance when called
    const task = this;
    
    Promise.resolve()
      .then(() => asyncFn.call(task, ...args))
      .catch(error => {
        console.error(`❌ Async operation failed: ${error.message}`);
        
        // Try to fail the task and notify parent
        try {
          task.fail(error);
          if (task.parent) {
            task.send(task.parent, { type: 'failed', error });
          }
        } catch (innerError) {
          console.error(`❌ Failed to handle async error: ${innerError.message}`);
        }
      });
  };
}

/**
 * Extract services (LLM client, tool registry) from config or task context
 * 
 * @param {Object} task - The task instance
 * @param {Object} config - Strategy configuration
 * @returns {Object} Object with { llmClient, toolRegistry }
 */
export function getServices(task, config = {}) {
  const llmClient = config.llmClient || 
    (task.lookup ? task.lookup('llmClient') : null) ||
    task.context?.llmClient;
    
  const toolRegistry = config.toolRegistry ||
    (task.lookup ? task.lookup('toolRegistry') : null) ||
    task.context?.toolRegistry;
    
  return { llmClient, toolRegistry };
}

/**
 * Require services to be available, throw if missing
 * 
 * @param {Object} task - The task instance
 * @param {Object} config - Strategy configuration
 * @param {Array<string>} required - Required service names
 * @returns {Object} Object with available services
 */
export function requireServices(task, config, required = ['llmClient', 'toolRegistry']) {
  const services = getServices(task, config);
  const missing = [];
  
  for (const service of required) {
    if (!services[service]) {
      missing.push(service);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Required services not available: ${missing.join(', ')}`);
  }
  
  return services;
}

/**
 * Extract an artifact from task, parent, or metadata
 * 
 * @param {Object} task - The task instance
 * @param {string} artifactName - Name of the artifact to extract
 * @returns {*} The artifact value or null
 */
export function extractArtifact(task, artifactName) {
  // Check task artifacts
  const artifact = task.getArtifact ? task.getArtifact(artifactName) : null;
  if (artifact?.value) {
    return artifact.value;
  }
  
  // Check all artifacts
  if (task.getAllArtifacts) {
    const artifacts = task.getAllArtifacts();
    if (artifacts[artifactName]) {
      return artifacts[artifactName].content || artifacts[artifactName].value;
    }
  }
  
  // Check metadata
  if (task.metadata?.[artifactName]) {
    return task.metadata[artifactName];
  }
  
  // Check parent artifacts
  if (task.parent) {
    const parentArtifact = task.parent.getArtifact ? 
      task.parent.getArtifact(artifactName) : null;
    if (parentArtifact?.value) {
      return parentArtifact.value;
    }
  }
  
  return null;
}

/**
 * Store multiple artifacts at once
 * 
 * @param {Object} task - The task instance
 * @param {Object} artifacts - Object mapping names to content
 * @returns {Array<string>} Array of stored artifact names
 */
export function storeArtifacts(task, artifacts) {
  const artifactNames = [];
  
  for (const [name, content] of Object.entries(artifacts)) {
    if (content !== null && content !== undefined) {
      task.storeArtifact(
        name,
        content.value || content,
        content.description || `Artifact: ${name}`,
        content.type || 'data'
      );
      artifactNames.push(name);
    }
  }
  
  return artifactNames;
}

/**
 * Complete task with artifacts and notify parent
 * 
 * @param {Object} task - The task instance
 * @param {Object} artifacts - Artifacts to store
 * @param {*} result - Additional result data
 */
export function completeWithArtifacts(task, artifacts = {}, result = null) {
  // Store artifacts
  const artifactNames = storeArtifacts(task, artifacts);
  
  // Add conversation entry
  task.addConversationEntry('system', 
    `Task completed with ${artifactNames.length} artifacts: ${artifactNames.join(', ')}`);
  
  // Create result
  const taskResult = {
    success: true,
    result: result || { artifactsCreated: artifactNames.length },
    artifacts: artifactNames
  };
  
  // Complete the task
  task.complete(taskResult);
  
  // Notify parent if exists
  notifyParent(task, 'completed', { result: taskResult });
  
  console.log(`✅ Task completed successfully`);
}

/**
 * Fail task with error and notify parent
 * 
 * @param {Object} task - The task instance
 * @param {Error} error - The error that caused failure
 * @param {string} message - Optional custom error message
 */
export function failWithError(task, error, message = null) {
  const errorMessage = message || error.message;
  
  // Add conversation entry
  task.addConversationEntry('system', `Task failed: ${errorMessage}`);
  
  // Fail the task
  task.fail(error);
  
  // Notify parent if exists
  notifyParent(task, 'failed', { error });
  
  console.error(`❌ Task failed: ${errorMessage}`);
}

/**
 * Notify parent task with a message
 * 
 * @param {Object} task - The task instance
 * @param {string} type - Message type
 * @param {Object} data - Additional message data
 */
export function notifyParent(task, type, data = {}) {
  if (task.parent) {
    task.send(task.parent, { type, ...data });
  }
}

/**
 * Parse JSON response from LLM output
 * Handles various formats including markdown code blocks
 * 
 * @param {string} response - The LLM response text
 * @returns {Object|null} Parsed JSON object or null
 */
export function parseJsonResponse(response) {
  if (!response) return null;
  
  try {
    // If already an object, return it
    if (typeof response === 'object') {
      return response;
    }
    
    // Try to extract JSON from markdown code block
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || 
                      response.match(/```\s*([\s\S]*?)```/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    // Try to find raw JSON in the response
    const rawJsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (rawJsonMatch) {
      return JSON.parse(rawJsonMatch[0]);
    }
    
    // Try direct parse as last resort
    return JSON.parse(response);
    
  } catch (error) {
    console.error('Failed to parse JSON response:', error);
    return null;
  }
}

/**
 * Extract task context information
 * 
 * @param {Object} task - The task instance
 * @returns {Object} Context object with common properties
 */
export function getTaskContext(task) {
  const context = {
    taskId: task.id,
    description: task.description,
    workspaceDir: task.workspaceDir || task.context?.workspaceDir,
    projectId: task.projectId || task.context?.projectId,
    depth: task.metadata?.depth || 0
  };
  
  // Add existing artifacts as context
  if (task.getAllArtifacts) {
    const artifacts = task.getAllArtifacts();
    context.existingArtifacts = Object.keys(artifacts);
  }
  
  // Add parent information if exists
  if (task.parent) {
    context.parentId = task.parent.id;
    context.parentDescription = task.parent.description;
  }
  
  return context;
}

/**
 * Copy artifacts from one task to another
 * Useful for child→parent artifact propagation
 * 
 * @param {Object} fromTask - Source task
 * @param {Object} toTask - Destination task
 * @returns {number} Number of artifacts copied
 */
export function copyArtifacts(fromTask, toTask) {
  if (!fromTask.getAllArtifacts) return 0;
  
  const artifacts = fromTask.getAllArtifacts();
  let count = 0;
  
  for (const [name, artifact] of Object.entries(artifacts)) {
    toTask.storeArtifact(
      name, 
      artifact.content || artifact.value,
      artifact.description,
      artifact.type
    );
    count++;
  }
  
  return count;
}

/**
 * Create a retry wrapper for operations that may fail
 * 
 * @param {Function} operation - The operation to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {string} backoffStrategy - 'exponential' or 'linear'
 * @returns {Function} Wrapped operation with retry logic
 */
export function withRetry(operation, maxRetries = 3, backoffStrategy = 'exponential') {
  return async function retriedOperation(...args) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation.call(this, ...args);
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        
        if (attempt < maxRetries) {
          // Calculate delay
          const delay = backoffStrategy === 'exponential' 
            ? Math.pow(2, attempt - 1) * 1000 
            : attempt * 1000;
            
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  };
}

/**
 * Check if initialization is complete, wait if needed
 * 
 * @param {Object} config - Strategy configuration
 * @param {string} initField - Name of the initialization promise field
 * @returns {Promise<boolean>} True if initialized successfully
 */
export async function ensureInitialized(config, initField = 'initPromise') {
  if (config.initError) {
    throw config.initError;
  }
  
  if (config[initField]) {
    try {
      await config[initField];
      return true;
    } catch (error) {
      config.initError = error;
      throw error;
    }
  }
  
  return true;
}

/**
 * Helper to extract context from task (100% duplicated across all strategies)
 * This replaces the getContextFromTask function found in every strategy file
 */
export function getContextFromTask(task) {
  return {
    llmClient: (task.lookup && task.lookup('llmClient')) || task.context?.llmClient,
    toolRegistry: (task.lookup && task.lookup('toolRegistry')) || task.context?.toolRegistry,
    workspaceDir: (task.lookup && task.lookup('workspaceDir')) || task.context?.workspaceDir
  };
}

/**
 * Initialize strategy dependencies (nearly identical across all strategies)
 * This replaces the initializeDependencies function found in every strategy
 * 
 * @param {Object} config - Strategy configuration
 * @param {Object} task - Task instance
 * @param {Array<string>} requiredTools - List of required tool names
 * @returns {Promise<void>} Resolves when initialization is complete
 */
export async function initializeDependencies(config, task, requiredTools = []) {
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
  for (const toolName of requiredTools) {
    if (!config.tools[toolName]) {
      try {
        config.tools[toolName] = await config.toolRegistry.getTool(toolName);
        if (!config.tools[toolName]) {
          console.warn(`Tool '${toolName}' not found in registry`);
        }
      } catch (error) {
        console.error(`Failed to load tool '${toolName}': ${error.message}`);
      }
    }
  }
}

/**
 * Standard child task completion handler (100% duplicated)
 * This replaces the handleChildComplete function found in every strategy
 * 
 * @param {Object} childTask - The child task that completed
 * @param {*} result - Result from child task
 * @param {Object} config - Strategy configuration
 * @returns {Promise<Object>} Completion acknowledgment
 */
export async function handleChildComplete(childTask, result, config) {
  console.log(`✅ Child task completed: ${childTask.description}`);
  
  // Copy artifacts from child to parent (this context)
  const childArtifacts = childTask.getAllArtifacts();
  for (const [name, artifact] of Object.entries(childArtifacts)) {
    this.storeArtifact(name, artifact.content, artifact.description, artifact.type);
  }
  
  console.log(`📦 Copied ${Object.keys(childArtifacts).length} artifacts from child`);
  
  return { acknowledged: true, childComplete: true };
}

/**
 * Create a project directory with timestamp (used by multiple strategies)
 * 
 * @param {Object} config - Strategy configuration
 * @param {string} prefix - Project name prefix
 * @returns {Promise<string>} Path to created project directory
 */
export async function createProjectDirectory(config, prefix = 'project') {
  const timestamp = Date.now();
  const projectName = `${prefix}-${timestamp}`;
  const projectDir = path.join(config.projectRoot, projectName);
  
  // Ensure tools are available
  if (!config.tools.directoryCreate) {
    throw new Error('directoryCreate tool not available');
  }
  
  await config.tools.directoryCreate.execute({ path: config.projectRoot });
  await config.tools.directoryCreate.execute({ path: projectDir });
  
  return projectDir;
}

/**
 * Write content to file using strategy's file tools
 * 
 * @param {Object} config - Strategy configuration  
 * @param {string} filepath - Path to write to
 * @param {string} content - Content to write
 * @returns {Promise<void>} Resolves when file is written
 */
export async function writeFile(config, filepath, content) {
  if (!config.tools.fileWrite) {
    throw new Error('fileWrite tool not available');
  }
  
  await config.tools.fileWrite.execute({ filepath, content });
}

/**
 * Read content from file using strategy's file tools
 * 
 * @param {Object} config - Strategy configuration
 * @param {string} filepath - Path to read from
 * @returns {Promise<string>} File content
 */
export async function readFile(config, filepath) {
  if (!config.tools.fileRead) {
    throw new Error('fileRead tool not available');
  }
  
  const result = await config.tools.fileRead.execute({ filepath });
  return result.content || result;
}

export default {
  asyncHandler,
  getServices,
  requireServices,
  extractArtifact,
  storeArtifacts,
  completeWithArtifacts,
  failWithError,
  notifyParent,
  parseJsonResponse,
  getTaskContext,
  copyArtifacts,
  withRetry,
  ensureInitialized,
  getContextFromTask,
  initializeDependencies,
  handleChildComplete,
  createProjectDirectory,
  writeFile,
  readFile
};