/**
 * RetryNode - Retries child execution until success or max attempts reached
 * 
 * Control flow:
 * - Execute child up to maxAttempts times
 * - Return SUCCESS as soon as child succeeds
 * - Return FAILURE after exhausting all attempts
 * - Supports exponential backoff and custom retry policies
 */

import { BehaviorTreeNode, NodeStatus } from '../core/BehaviorTreeNode.js';

export class RetryNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'retry';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    // Validate configuration
    this.maxAttempts = config.maxAttempts || 3;
    this.retryDelay = config.retryDelay || 0; // milliseconds between retries
    this.exponentialBackoff = config.exponentialBackoff || false;
    this.backoffMultiplier = config.backoffMultiplier || 2;
    
    if (this.maxAttempts < 1) {
      throw new Error('RetryNode maxAttempts must be at least 1');
    }

    // Ensure we have exactly one child
    if (config.child) {
      // Single child configuration
      this.children = [this.createChild(config.child)];
    } else if (config.children && config.children.length === 1) {
      // Children array with single child
      this.children = config.children.map(childConfig => this.createChild(childConfig));
    } else if (!config.children || config.children.length === 0) {
      throw new Error('RetryNode must have exactly one child');
    } else if (config.children.length > 1) {
      throw new Error('RetryNode can only have one child. Use a sequence or selector as the child for multiple operations.');
    }
  }

  async executeNode(context) {
    const retryData = {
      maxAttempts: this.maxAttempts,
      attempts: [],
      finalResult: null,
      succeeded: false
    };

    let currentDelay = this.retryDelay;
    
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      if (this.config.debugMode) {
        console.log(`[RetryNode:${this.id}] Attempt ${attempt}/${this.maxAttempts}`);
      }

      // Execute child
      const startTime = Date.now();
      const result = await this.executeChild(0, context);
      const executionTime = Date.now() - startTime;

      // Record attempt
      retryData.attempts.push({
        attemptNumber: attempt,
        status: result.status,
        executionTime,
        data: result.data,
        error: result.error || result.data?.error
      });

      if (result.status === NodeStatus.SUCCESS) {
        // Success! Return immediately
        retryData.succeeded = true;
        retryData.finalResult = result;
        
        if (this.config.debugMode) {
          console.log(`[RetryNode:${this.id}] Succeeded on attempt ${attempt}`);
        }

        // Update context with success data if child has an ID
        const child = this.children[0];
        if (child && child.id && result.data) {
          context[child.id] = result;
        }

        return {
          status: NodeStatus.SUCCESS,
          data: {
            ...retryData,
            totalAttempts: attempt,
            ...result.data
          }
        };
      }

      // Failed - check if we should retry
      if (attempt < this.maxAttempts) {
        // Wait before retrying if delay is configured
        if (currentDelay > 0) {
          if (this.config.debugMode) {
            console.log(`[RetryNode:${this.id}] Waiting ${currentDelay}ms before retry`);
          }
          await this.sleep(currentDelay);
          
          // Apply exponential backoff if configured
          if (this.exponentialBackoff) {
            currentDelay *= this.backoffMultiplier;
          }
        }

        // Optionally modify context for retry
        if (this.config.modifyContextOnRetry) {
          context.retryAttempt = attempt;
          context.previousError = result.error || result.data?.error;
        }
      }
    }

    // All attempts exhausted
    retryData.finalResult = retryData.attempts[retryData.attempts.length - 1];
    
    if (this.config.debugMode) {
      console.log(`[RetryNode:${this.id}] Failed after ${this.maxAttempts} attempts`);
    }

    return {
      status: NodeStatus.FAILURE,
      data: {
        ...retryData,
        totalAttempts: this.maxAttempts,
        exhaustedRetries: true,
        lastError: retryData.finalResult?.error || retryData.finalResult?.data?.error
      }
    };
  }

  /**
   * Helper method to sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get metadata about this node type
   * @returns {Object} Node type metadata
   */
  static getMetadata() {
    return {
      typeName: 'retry',
      description: 'Retries child execution until success or max attempts',
      configSchema: {
        maxAttempts: { 
          type: 'number', 
          default: 3, 
          description: 'Maximum number of retry attempts' 
        },
        retryDelay: { 
          type: 'number', 
          default: 0, 
          description: 'Delay in milliseconds between retries' 
        },
        exponentialBackoff: { 
          type: 'boolean', 
          default: false, 
          description: 'Whether to use exponential backoff' 
        },
        backoffMultiplier: { 
          type: 'number', 
          default: 2, 
          description: 'Multiplier for exponential backoff' 
        },
        modifyContextOnRetry: { 
          type: 'boolean', 
          default: false, 
          description: 'Whether to add retry info to context' 
        },
        child: { 
          type: 'object', 
          required: true, 
          description: 'Single child node to retry' 
        }
      }
    };
  }
}