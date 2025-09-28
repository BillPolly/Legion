/**
 * RetryNode - Compatibility wrapper for actor-BT migration
 * 
 * Wraps RetryStrategy in a class interface compatible with actor-BT
 */

import { BehaviorTreeNode } from '../BehaviorTreeNode.js';
import { NodeStatus } from '../NodeStatus.js';

export class RetryNode extends BehaviorTreeNode {
  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    this.maxAttempts = config.maxAttempts || 3;
    this.delay = config.delay || 0;
  }

  async executeNode(context) {
    if (!this.children || this.children.length === 0) {
      return { 
        status: NodeStatus.SUCCESS, 
        data: { attempts: 0 }
      };
    }
    
    let attempts = 0;
    const attemptResults = [];
    
    while (attempts < this.maxAttempts) {
      attempts++;
      
      // Execute all children (typically just one)
      const results = [];
      let allSucceeded = true;
      
      for (const child of this.children) {
        const result = await child.execute(context);
        results.push(result);
        
        if (result.status === NodeStatus.FAILURE) {
          allSucceeded = false;
        }
        
        // If any child is still running, we're still running
        if (result.status === NodeStatus.RUNNING) {
          return {
            status: NodeStatus.RUNNING,
            data: { attempts, results }
          };
        }
      }
      
      attemptResults.push(results);
      
      if (allSucceeded) {
        // Success - stop retrying
        return {
          status: NodeStatus.SUCCESS,
          data: { 
            attempts,
            attemptResults,
            succeeded: true
          }
        };
      }
      
      // Failed - wait before retry if not last attempt
      if (attempts < this.maxAttempts && this.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delay));
      }
    }
    
    // Max attempts reached - failure
    return {
      status: NodeStatus.FAILURE,
      data: { 
        attempts,
        attemptResults,
        succeeded: false
      },
      error: `Failed after ${attempts} attempts`
    };
  }

  getMetadata() {
    return {
      name: this.config.name || 'Retry',
      description: `Retry up to ${this.maxAttempts} times`,
      type: 'retry'
    };
  }
}