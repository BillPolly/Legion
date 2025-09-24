/**
 * EnhancedTaskStrategy - Advanced base prototype with common patterns abstracted
 * 
 * This enhanced strategy provides built-in handling for:
 * - Standard message routing (parent/child)
 * - Error boundaries for sync and async operations
 * - Common message types (start, work, completed, failed, abort)
 * - Async operation wrapping with consistent error handling
 * - Service extraction from config or task context
 * 
 * Strategies that extend this only need to implement business logic methods.
 */

import { TaskStrategy } from './TaskStrategy.js';

/**
 * Enhanced Task Strategy with built-in patterns
 */
export const EnhancedTaskStrategy = Object.create(TaskStrategy);

/**
 * Enhanced message handler with built-in routing and error boundaries
 * Strategies can override specific handlers or the entire method
 */
EnhancedTaskStrategy.onMessage = function onMessage(senderTask, message) {
  try {
    // Determine if message is from child or parent/initiator
    if (senderTask.parent === this) {
      // Message from child task - route to child message handler
      this.handleChildMessage(senderTask, message);
    } else {
      // Message from parent or initiator - route to parent message handler
      this.handleParentMessage(senderTask, message);
    }
  } catch (error) {
    // Catch any synchronous errors in message handling
    this.handleMessageError(error);
  }
};

/**
 * Handle messages from child tasks
 * Override in strategies that need custom child message handling
 */
EnhancedTaskStrategy.handleChildMessage = function handleChildMessage(senderTask, message) {
  switch (message.type) {
    case 'completed':
      this.onChildCompleted(senderTask, message);
      break;
      
    case 'failed':
      this.onChildFailed(senderTask, message);
      break;
      
    default:
      this.onChildMessage(senderTask, message);
  }
};

/**
 * Handle messages from parent or initiator
 * Override in strategies that need custom parent message handling
 */
EnhancedTaskStrategy.handleParentMessage = function handleParentMessage(senderTask, message) {
  switch (message.type) {
    case 'start':
    case 'work':
      this.handleWork(senderTask, message);
      break;
      
    case 'abort':
      this.handleAbort(senderTask, message);
      break;
      
    default:
      this.onParentMessage(senderTask, message);
  }
};

/**
 * Default handlers for common message types
 * Override these in specific strategies as needed
 */

EnhancedTaskStrategy.onChildCompleted = function onChildCompleted(senderTask, message) {
  console.log(`✅ Child task completed: ${senderTask.description}`);
  if (this.parent) {
    this.send(this.parent, { type: 'child-completed', child: senderTask });
  }
};

EnhancedTaskStrategy.onChildFailed = function onChildFailed(senderTask, message) {
  console.log(`❌ Child task failed: ${senderTask.description}`);
  if (this.parent) {
    this.send(this.parent, { type: 'child-failed', child: senderTask, error: message.error });
  }
};

EnhancedTaskStrategy.onChildMessage = function onChildMessage(senderTask, message) {
  console.log(`ℹ️ ${this.constructor.name || 'Strategy'} received unhandled message from child: ${message.type}`);
};

EnhancedTaskStrategy.onParentMessage = function onParentMessage(senderTask, message) {
  console.log(`ℹ️ ${this.constructor.name || 'Strategy'} received unhandled message: ${message.type}`);
};

/**
 * Main work handler - strategies should override this
 * This wraps the actual work in proper async error handling
 */
EnhancedTaskStrategy.handleWork = function handleWork(senderTask, message) {
  // Execute async work with error boundary
  this.executeAsync(() => this.doWork(senderTask, message));
};

/**
 * Abort handler - strategies can override this
 */
EnhancedTaskStrategy.handleAbort = function handleAbort(senderTask, message) {
  console.log(`🛑 Task aborted: ${this.description}`);
  this.addConversationEntry('system', 'Task aborted');
  
  if (this.onAbort) {
    this.executeAsync(() => this.onAbort(senderTask, message));
  }
};

/**
 * The actual work method - strategies MUST override this
 * This is where the business logic goes
 */
EnhancedTaskStrategy.doWork = async function doWork(senderTask, message) {
  throw new Error('Strategy must implement doWork method');
};

/**
 * Handle synchronous message errors
 */
EnhancedTaskStrategy.handleMessageError = function handleMessageError(error) {
  console.error(`❌ ${this.constructor.name || 'Strategy'} message handler error: ${error.message}`);
  
  // Try to log the error in conversation
  try {
    if (this.addConversationEntry) {
      this.addConversationEntry('system', `Message handling error: ${error.message}`);
    }
  } catch (innerError) {
    console.error(`❌ Failed to log message handling error: ${innerError.message}`);
  }
};

/**
 * Execute async operation with consistent error handling
 * This is the standard fire-and-forget pattern with error boundary
 */
EnhancedTaskStrategy.executeAsync = function executeAsync(asyncOperation) {
  // Create the async operation and handle errors
  Promise.resolve()
    .then(asyncOperation)
    .catch(error => {
      this.handleAsyncError(error);
    });
};

/**
 * Handle async operation errors consistently
 */
EnhancedTaskStrategy.handleAsyncError = function handleAsyncError(error) {
  console.error(`❌ ${this.constructor.name || 'Strategy'} async operation failed: ${error.message}`);
  
  // Try to fail the task and notify parent
  try {
    this.fail(error);
    if (this.parent) {
      this.send(this.parent, { type: 'failed', error });
    }
  } catch (innerError) {
    console.error(`❌ Failed to handle async error: ${innerError.message}`);
  }
};

/**
 * Extract services from config or task context
 * Returns { llmClient, toolRegistry }
 */
EnhancedTaskStrategy.getServices = function getServices(config = {}) {
  const llmClient = config.llmClient || 
    (this.lookup ? this.lookup('llmClient') : null) ||
    this.context?.llmClient;
    
  const toolRegistry = config.toolRegistry ||
    (this.lookup ? this.lookup('toolRegistry') : null) ||
    this.context?.toolRegistry;
    
  return { llmClient, toolRegistry };
};

/**
 * Extract artifact from task or parent
 * Returns the artifact value or null
 */
EnhancedTaskStrategy.extractArtifact = function extractArtifact(artifactName) {
  // Check task artifacts
  const artifact = this.getArtifact(artifactName);
  if (artifact?.value) {
    return artifact.value;
  }
  
  // Check metadata
  if (this.metadata?.[artifactName]) {
    return this.metadata[artifactName];
  }
  
  // Check parent artifacts
  if (this.parent) {
    const parentArtifact = this.parent.getArtifact(artifactName);
    if (parentArtifact?.value) {
      return parentArtifact.value;
    }
  }
  
  return null;
};

/**
 * Complete the task with artifacts and notify parent
 */
EnhancedTaskStrategy.completeWithArtifacts = function completeWithArtifacts(artifacts = {}, result = null) {
  // Store all artifacts
  const artifactNames = [];
  for (const [name, content] of Object.entries(artifacts)) {
    if (content !== null && content !== undefined) {
      this.storeArtifact(
        name,
        content.value || content,
        content.description || `Artifact: ${name}`,
        content.type || 'data'
      );
      artifactNames.push(name);
    }
  }
  
  // Add conversation entry
  this.addConversationEntry('system', 
    `Task completed with ${artifactNames.length} artifacts: ${artifactNames.join(', ')}`);
  
  // Create result
  const taskResult = {
    success: true,
    result: result || { artifactsCreated: artifactNames.length },
    artifacts: artifactNames
  };
  
  // Complete the task
  this.complete(taskResult);
  
  // Notify parent if exists
  if (this.parent) {
    this.send(this.parent, { type: 'completed', result: taskResult });
  }
  
  console.log(`✅ ${this.constructor.name || 'Strategy'} completed successfully`);
};

/**
 * Fail the task with error and notify parent
 */
EnhancedTaskStrategy.failWithError = function failWithError(error, message = null) {
  const errorMessage = message || error.message;
  
  // Add conversation entry
  this.addConversationEntry('system', `Task failed: ${errorMessage}`);
  
  // Fail the task
  this.fail(error);
  
  // Notify parent if exists
  if (this.parent) {
    this.send(this.parent, { type: 'failed', error });
  }
  
  console.error(`❌ ${this.constructor.name || 'Strategy'} failed: ${errorMessage}`);
};

/**
 * Helper to check if required services are available
 */
EnhancedTaskStrategy.requireServices = function requireServices(services = ['llmClient', 'toolRegistry']) {
  const available = this.getServices(this.config || {});
  const missing = [];
  
  for (const service of services) {
    if (!available[service]) {
      missing.push(service);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Required services not available: ${missing.join(', ')}`);
  }
  
  return available;
};

export default EnhancedTaskStrategy;