/**
 * SequenceNode - Compatibility wrapper for actor-BT migration
 * 
 * Wraps SequenceStrategy in a class interface compatible with actor-BT
 */

import { BehaviorTreeNode } from '../BehaviorTreeNode.js';
import { NodeStatus } from '../NodeStatus.js';

export class SequenceNode extends BehaviorTreeNode {
  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
  }

  async executeNode(context) {
    if (!this.children || this.children.length === 0) {
      return { status: NodeStatus.SUCCESS, data: {} };
    }
    
    const results = [];
    
    for (const child of this.children) {
      const result = await child.execute(context);
      results.push(result);
      
      // Fail fast - if any child fails, sequence fails
      if (result.status === NodeStatus.FAILURE) {
        return {
          status: NodeStatus.FAILURE,
          data: { results },
          error: result.error || 'Child node failed'
        };
      }
      
      // If child is still running, sequence is running
      if (result.status === NodeStatus.RUNNING) {
        return {
          status: NodeStatus.RUNNING,
          data: { results }
        };
      }
    }
    
    // All children succeeded
    return {
      status: NodeStatus.SUCCESS,
      data: { results }
    };
  }

  getMetadata() {
    return {
      name: this.config.name || 'Sequence',
      description: 'Execute children in sequence until one fails',
      type: 'sequence'
    };
  }
}