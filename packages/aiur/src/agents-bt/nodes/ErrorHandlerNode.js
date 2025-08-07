/**
 * ErrorHandlerNode - Centralized error handling with retry and fallback patterns
 * 
 * Provides comprehensive error handling capabilities including
 * retry logic, fallback strategies, and error reporting.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class ErrorHandlerNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'error_handler';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.strategy = config.strategy || 'report'; // report, retry, fallback, ignore
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.retryBackoff = config.retryBackoff || 1.5; // Exponential backoff multiplier
    this.fallbackAction = config.fallbackAction || null;
    this.reportErrors = config.reportErrors !== false;
  }

  async executeNode(context) {
    try {
      const error = context.error || context.lastError;
      if (!error) {
        return {
          status: NodeStatus.SUCCESS,
          data: { message: 'No error to handle' }
        };
      }
      
      // Handle error based on strategy
      switch (this.strategy) {
        case 'retry':
          return await this.handleWithRetry(error, context);
        case 'fallback':
          return await this.handleWithFallback(error, context);
        case 'ignore':
          return await this.handleByIgnoring(error, context);
        case 'report':
        default:
          return await this.handleByReporting(error, context);
      }
      
    } catch (handlingError) {
      // Error occurred while handling error
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: `Error handling failed: ${handlingError.message}`,
          originalError: context.error,
          stackTrace: handlingError.stack
        }
      };
    }
  }
  
  /**
   * Handle error with retry strategy
   */
  async handleWithRetry(error, context) {
    if (!context.retryableAction) {
      return await this.handleByReporting(error, context);
    }
    
    const retryCount = context.retryCount || 0;
    
    if (retryCount >= this.maxRetries) {
      // Max retries reached, report final failure
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: `Max retries (${this.maxRetries}) exceeded: ${error.message}`,
          retryCount: retryCount,
          finalFailure: true
        }
      };
    }
    
    // Wait before retry (with exponential backoff)
    const delay = this.retryDelay * Math.pow(this.retryBackoff, retryCount);
    await this.delay(delay);
    
    try {
      // Increment retry count
      context.retryCount = retryCount + 1;
      
      // Execute retry action
      const result = await this.executeRetryAction(context);
      
      // Reset retry count on success
      if (result.status === NodeStatus.SUCCESS) {
        context.retryCount = 0;
        return {
          status: NodeStatus.SUCCESS,
          data: {
            message: `Retry successful after ${retryCount + 1} attempts`,
            retryCount: retryCount + 1,
            result: result.data
          }
        };
      } else {
        // Retry failed, will be handled by next iteration or max retries
        context.lastError = result.data?.error || error;
        return await this.handleWithRetry(result.data?.error || error, context);
      }
      
    } catch (retryError) {
      context.lastError = retryError;
      return await this.handleWithRetry(retryError, context);
    }
  }
  
  /**
   * Handle error with fallback strategy
   */
  async handleWithFallback(error, context) {
    if (!this.fallbackAction) {
      return await this.handleByReporting(error, context);
    }
    
    try {
      // Execute fallback action
      const fallbackNode = this.executor.createNode(this.fallbackAction);
      const result = await fallbackNode.execute({
        ...context,
        originalError: error,
        fallbackExecution: true
      });
      
      if (result.status === NodeStatus.SUCCESS) {
        return {
          status: NodeStatus.SUCCESS,
          data: {
            message: 'Fallback action succeeded',
            originalError: error.message,
            fallbackResult: result.data
          }
        };
      } else {
        return {
          status: NodeStatus.FAILURE,
          data: {
            error: 'Fallback action also failed',
            originalError: error.message,
            fallbackError: result.data?.error
          }
        };
      }
      
    } catch (fallbackError) {
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: 'Fallback execution failed',
          originalError: error.message,
          fallbackError: fallbackError.message
        }
      };
    }
  }
  
  /**
   * Handle error by ignoring it
   */
  async handleByIgnoring(error, context) {
    if (this.config.debugMode) {
      console.log(`ErrorHandlerNode: Ignoring error: ${error.message}`);
    }
    
    return {
      status: NodeStatus.SUCCESS,
      data: {
        message: 'Error ignored as per configuration',
        ignoredError: error.message
      }
    };
  }
  
  /**
   * Handle error by reporting it
   */
  async handleByReporting(error, context) {
    // Report error to remote actor
    if (this.reportErrors && context.remoteActor) {
      const errorReport = {
        type: 'error',
        error: error.message,
        agentId: context.agentId,
        sessionId: context.sessionId,
        requestId: context.message?.requestId,
        timestamp: new Date().toISOString()
      };
      
      // Add context information
      if (context.toolName) {
        errorReport.tool = context.toolName;
      }
      
      if (context.messageType) {
        errorReport.messageType = context.messageType;
      }
      
      context.remoteActor.receive(errorReport);
    }
    
    // Log error for debugging
    console.error('ErrorHandlerNode: Handled error:', error);
    
    return {
      status: NodeStatus.FAILURE,
      data: {
        error: error.message,
        reported: this.reportErrors,
        handled: true
      }
    };
  }
  
  /**
   * Execute retry action
   */
  async executeRetryAction(context) {
    if (typeof context.retryableAction === 'function') {
      // Execute function
      return await context.retryableAction(context);
    } else if (typeof context.retryableAction === 'object') {
      // Execute BT node
      const actionNode = this.executor.createNode(context.retryableAction);
      return await actionNode.execute(context);
    } else {
      throw new Error('Invalid retryable action configuration');
    }
  }
  
  /**
   * Classify error type for handling strategy
   */
  classifyError(error) {
    const errorMessage = error.message?.toLowerCase() || '';
    
    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return 'transient';
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      return 'rate_limited';
    } else if (errorMessage.includes('auth') || errorMessage.includes('permission')) {
      return 'authorization';
    } else if (errorMessage.includes('not found') || errorMessage.includes('missing')) {
      return 'not_found';
    } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return 'validation';
    } else {
      return 'unknown';
    }
  }
  
  /**
   * Determine if error should be retried based on classification
   */
  shouldRetry(error, retryCount) {
    if (retryCount >= this.maxRetries) {
      return false;
    }
    
    const errorType = this.classifyError(error);
    
    // Retry transient and rate-limited errors
    return errorType === 'transient' || errorType === 'rate_limited';
  }
  
  /**
   * Get retry delay based on error type
   */
  getRetryDelay(error, retryCount) {
    const errorType = this.classifyError(error);
    const baseDelay = this.retryDelay;
    
    if (errorType === 'rate_limited') {
      // Longer delay for rate limiting
      return baseDelay * 2 * Math.pow(this.retryBackoff, retryCount);
    } else {
      // Standard exponential backoff
      return baseDelay * Math.pow(this.retryBackoff, retryCount);
    }
  }
  
  /**
   * Delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Handle messages from parent/children about errors
   */
  handleChildMessage(child, message) {
    super.handleChildMessage(child, message);
    
    if (message.type === 'ERROR_OCCURRED') {
      // Child node reported an error
      this.sendToParent({
        type: 'ERROR_HANDLED',
        originalError: message.error,
        childId: child.id,
        strategy: this.strategy
      });
    }
  }
  
  /**
   * Get error handling statistics
   */
  getErrorStats(context) {
    return {
      strategy: this.strategy,
      maxRetries: this.maxRetries,
      currentRetries: context.retryCount || 0,
      hasFallback: !!this.fallbackAction,
      reportErrors: this.reportErrors
    };
  }
  
  /**
   * Get metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      coordinationPattern: 'error_handling',
      strategy: this.strategy,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay,
      hasFallback: !!this.fallbackAction,
      reportErrors: this.reportErrors,
      supportsStrategies: ['retry', 'fallback', 'report', 'ignore']
    };
  }
}