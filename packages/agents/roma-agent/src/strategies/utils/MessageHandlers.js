/**
 * MessageHandlers - Utilities for standard strategy message handling patterns
 * 
 * This module eliminates the repeated error handling, child management, and message routing
 * code found in every strategy's onMessage implementation.
 */

/**
 * Create a standard onMessage handler with built-in error boundaries
 * This replaces the identical try/catch error handling found in every strategy
 * 
 * @param {Object} messageRoutes - Map of message types to handlers
 * @param {Object} options - Configuration options
 * @returns {Function} Complete onMessage handler with error boundaries
 */
export function createOnMessageHandler(messageRoutes, options = {}) {
  const {
    strategyName = 'Strategy',
    enableChildHandling = true,
    enableAsyncErrorBoundary = true
  } = options;
  
  return function onMessage(senderTask, message) {
    // 'this' is the task instance that received the message
    
    try {
      // Standard child task handling
      if (enableChildHandling && senderTask.parent === this) {
        return handleChildMessage.call(this, senderTask, message, strategyName);
      }
      
      // Route message to appropriate handler
      const handler = messageRoutes[message.type] || messageRoutes['default'];
      if (!handler) {
        console.log(`ℹ️ ${strategyName} received unhandled message: ${message.type}`);
        return;
      }
      
      // Execute handler with async error boundary if enabled
      if (enableAsyncErrorBoundary && handler.async !== false) {
        handler.call(this).catch(error => 
          handleAsyncError.call(this, error, strategyName)
        );
      } else {
        handler.call(this);
      }
      
    } catch (error) {
      handleSyncError.call(this, error, strategyName);
    }
  };
}

/**
 * Standard child message handling
 * This replaces the identical child task handling found in every strategy
 */
function handleChildMessage(senderTask, message, strategyName) {
  switch (message.type) {
    case 'completed':
      console.log(`✅ ${strategyName} child task completed: ${senderTask.description}`);
      // Handle child task completion with error boundary
      handleChildComplete.call(this, senderTask, message.result).catch(error => {
        console.error(`❌ ${strategyName} child completion handling failed: ${error.message}`);
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
      console.log(`❌ ${strategyName} child task failed: ${senderTask.description}`);
      if (this.parent) {
        this.send(this.parent, { type: 'child-failed', child: senderTask, error: message.error });
      }
      break;
      
    default:
      console.log(`ℹ️ ${strategyName} received unhandled message from child: ${message.type}`);
  }
}

/**
 * Standard async error handling
 * This replaces the identical async error handling found in every strategy
 */
function handleAsyncError(error, strategyName) {
  console.error(`❌ ${strategyName} async operation failed: ${error.message}`);
  try {
    this.fail(error);
    if (this.parent) {
      this.send(this.parent, { type: 'failed', error });
    }
  } catch (innerError) {
    console.error(`❌ Failed to handle async error: ${innerError.message}`);
  }
}

/**
 * Standard synchronous error handling  
 * This replaces the identical sync error handling found in every strategy
 */
function handleSyncError(error, strategyName) {
  console.error(`❌ ${strategyName} message handler error: ${error.message}`);
  // Don't let errors escape the message handler - handle them gracefully
  try {
    if (this.addConversationEntry) {
      this.addConversationEntry('system', `Message handling error: ${error.message}`);
    }
  } catch (innerError) {
    console.error(`❌ Failed to log message handling error: ${innerError.message}`);
  }
}

/**
 * Standard child completion handling
 * This replaces the identical handleChildComplete function in every strategy
 */
export async function handleChildComplete(senderTask, result) {
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
 * Create message route helpers for common patterns
 */
export function createMessageRoutes(handlers) {
  const routes = {};
  
  // Standard work/start handler
  if (handlers.work) {
    routes.start = handlers.work;
    routes.work = handlers.work;
  }
  
  // Add all custom handlers
  Object.assign(routes, handlers);
  
  return routes;
}

/**
 * Create an async error boundary wrapper for strategy handlers
 * This can be used to wrap individual handler functions
 */
export function withErrorBoundary(handler, strategyName) {
  return async function boundHandler(...args) {
    try {
      return await handler.call(this, ...args);
    } catch (error) {
      handleAsyncError.call(this, error, strategyName);
      throw error; // Re-throw so caller knows it failed
    }
  };
}

/**
 * Standard notification helper for parent communication
 * This replaces the repeated parent notification code
 */
export function notifyParent(task, messageType, data = {}) {
  if (task.parent) {
    task.send(task.parent, { type: messageType, ...data });
  }
}

/**
 * Standard completion helper
 * This combines task completion with parent notification
 */
export function completeWithNotification(task, result) {
  task.complete(result);
  notifyParent(task, 'completed', { result });
}

/**
 * Standard failure helper  
 * This combines task failure with parent notification
 */
export function failWithNotification(task, error) {
  task.fail(error);
  notifyParent(task, 'failed', { error });
}