/**
 * TaskHierarchy - Manages the tree structure of decomposed tasks
 */

import { TaskNode } from './TaskNode.js';

export class TaskHierarchy {
  constructor(root) {
    if (!root) {
      throw new Error('Root node is required');
    }
    
    if (!(root instanceof TaskNode)) {
      throw new Error('Root must be a TaskNode instance');
    }
    
    this.root = root;
  }

  /**
   * Get all nodes in the hierarchy (depth-first traversal)
   */
  getAllNodes() {
    const nodes = [];
    this._traverse(this.root, node => nodes.push(node));
    return nodes;
  }

  /**
   * Get all SIMPLE tasks (leaf nodes)
   */
  getSimpleTasks() {
    const simpleTasks = [];
    this._traverse(this.root, node => {
      if (node.complexity === 'SIMPLE') {
        simpleTasks.push(node);
      }
    });
    return simpleTasks;
  }

  /**
   * Get all COMPLEX tasks
   */
  getComplexTasks() {
    const complexTasks = [];
    this._traverse(this.root, node => {
      if (node.complexity === 'COMPLEX') {
        complexTasks.push(node);
      }
    });
    return complexTasks;
  }

  /**
   * Get total number of nodes
   */
  getNodeCount() {
    let count = 0;
    this._traverse(this.root, () => count++);
    return count;
  }

  /**
   * Get maximum depth of the hierarchy
   */
  getMaxDepth() {
    return this._calculateDepth(this.root, 0);
  }

  /**
   * Find a node by ID
   */
  findNodeById(id) {
    let found = null;
    this._traverse(this.root, node => {
      if (node.id === id) {
        found = node;
      }
    });
    return found;
  }

  /**
   * Get hierarchy statistics
   */
  getStatistics() {
    const simpleTasks = this.getSimpleTasks();
    const complexTasks = this.getComplexTasks();
    const feasibleTasks = simpleTasks.filter(t => t.feasible === true);
    const infeasibleTasks = simpleTasks.filter(t => t.feasible === false);

    return {
      totalTasks: simpleTasks.length + complexTasks.length,
      simpleTasks: simpleTasks.length,
      complexTasks: complexTasks.length,
      maxDepth: this.getMaxDepth(),
      feasibleTasks: feasibleTasks.length,
      infeasibleTasks: infeasibleTasks.length
    };
  }

  /**
   * Check if all simple tasks are feasible
   */
  allSimpleTasksFeasible() {
    const simpleTasks = this.getSimpleTasks();
    return simpleTasks.every(task => task.feasible === true);
  }

  /**
   * Get list of infeasible tasks
   */
  getInfeasibleTasks() {
    const simpleTasks = this.getSimpleTasks();
    return simpleTasks.filter(task => task.feasible === false);
  }

  /**
   * Convert hierarchy to plain object
   */
  toObject() {
    return this._nodeToObject(this.root);
  }

  /**
   * Private: Traverse the tree and apply callback to each node
   */
  _traverse(node, callback) {
    if (!node) return;
    
    callback(node);
    
    if (node.subtasks && Array.isArray(node.subtasks)) {
      node.subtasks.forEach(subtask => {
        this._traverse(subtask, callback);
      });
    }
  }

  /**
   * Private: Calculate depth recursively
   */
  _calculateDepth(node, currentDepth) {
    if (!node || node.complexity === 'SIMPLE') {
      return currentDepth;
    }
    
    if (!node.subtasks || node.subtasks.length === 0) {
      return currentDepth;
    }
    
    const childDepths = node.subtasks.map(child => 
      this._calculateDepth(child, currentDepth + 1)
    );
    
    return Math.max(...childDepths);
  }

  /**
   * Private: Convert node to object recursively
   */
  _nodeToObject(node) {
    const obj = {
      id: node.id,
      description: node.description,
      complexity: node.complexity,
      reasoning: node.reasoning,
      suggestedInputs: node.suggestedInputs,
      suggestedOutputs: node.suggestedOutputs
    };

    if (node.complexity === 'SIMPLE') {
      obj.tools = node.tools;
      obj.feasible = node.feasible;
    } else if (node.subtasks && node.subtasks.length > 0) {
      obj.subtasks = node.subtasks.map(subtask => this._nodeToObject(subtask));
    }

    return obj;
  }
}