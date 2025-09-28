/**
 * SelectorNode - Compatibility wrapper for actor-BT migration
 * 
 * Wraps SelectorStrategy in a class interface compatible with actor-BT
 */

import { BehaviorTreeNode } from '../BehaviorTreeNode.js';
import { NodeStatus } from '../NodeStatus.js';

export class SelectorNode extends BehaviorTreeNode {
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
      
      // Success fast - if any child succeeds, selector succeeds
      if (result.status === NodeStatus.SUCCESS) {
        return {
          status: NodeStatus.SUCCESS,
          data: { selectedIndex: results.length - 1, results }
        };
      }
      
      // If child is still running, selector is running
      if (result.status === NodeStatus.RUNNING) {
        return {
          status: NodeStatus.RUNNING,
          data: { results }
        };
      }
      
      // Child failed, try next one
    }
    
    // All children failed
    return {
      status: NodeStatus.FAILURE,
      data: { results },
      error: 'All alternatives failed'
    };
  }

  getMetadata() {
    return {
      name: this.config.name || 'Selector',
      description: 'Try children in sequence until one succeeds',
      type: 'selector'
    };
  }
}