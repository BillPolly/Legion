/**
 * AddNodeCommand - Command for adding a node to the graph
 */

import { Command } from './Command.js';
import { Node } from '../model/Node.js';

export class AddNodeCommand extends Command {
  /**
   * Create an AddNodeCommand
   * @param {Object} nodeData - Data for the node to add
   * @param {string} [parentId='root'] - ID of parent node
   */
  constructor(nodeData, parentId = 'root') {
    super('addNode', {
      nodeData: nodeData ? { ...nodeData } : nodeData,
      parentId: parentId
    });
  }

  /**
   * Execute the add node command
   * @param {GraphEditorModel} model - The graph model
   * @returns {Object} Undo data containing the added node
   * @protected
   */
  _doExecute(model) {
    const { nodeData, parentId } = this.data;
    
    // Create node instance if not already one
    const node = nodeData instanceof Node ? nodeData : new Node(nodeData);
    
    // Add to scene graph
    const sceneGraph = model.getSceneGraph();
    sceneGraph.addNode(node, parentId);
    
    // Notify model of change
    model._notifyChange('nodeAdded', { node });
    
    return {
      addedNode: node,
      parentId: parentId
    };
  }

  /**
   * Undo the add node command
   * @param {GraphEditorModel} model - The graph model
   * @param {Object} undoData - Data needed to undo
   * @protected
   */
  _doUndo(model, undoData) {
    const { addedNode } = undoData;
    const nodeId = addedNode.getId();
    
    // Remove from scene graph
    const sceneGraph = model.getSceneGraph();
    const removedNode = sceneGraph.removeNode(nodeId);
    
    if (removedNode) {
      // Notify model of change
      const position = removedNode.getPosition();
      const size = removedNode.getSize();
      model._notifyChange('nodeRemoved', { 
        nodeId, 
        position, 
        size 
      });
    }
  }

  /**
   * Validate the add node command
   * @param {GraphEditorModel} model - The graph model
   * @returns {boolean} True if valid
   */
  validate(model) {
    const { nodeData, parentId } = this.data;
    
    // Check if node data is valid
    if (!nodeData || nodeData === null) {
      return false;
    }
    
    // Check if node ID is unique (if specified)
    if (nodeData.id) {
      const sceneGraph = model.getSceneGraph();
      const existingNode = sceneGraph.getNodeById(nodeData.id);
      if (existingNode) {
        return false; // Node ID already exists
      }
    }
    
    // Check if parent exists
    if (parentId && parentId !== 'root') {
      const sceneGraph = model.getSceneGraph();
      const parentNode = sceneGraph.getNodeById(parentId);
      if (!parentNode) {
        return false; // Parent node doesn't exist
      }
    }
    
    return true;
  }

  /**
   * Get description for UI
   * @returns {string} Description
   */
  getDescription() {
    const nodeId = this.data.nodeData.id || 'new node';
    return `Add node ${nodeId}`;
  }

  /**
   * Check if this command can be merged with another
   * AddNodeCommands generally don't merge
   * @param {Command} otherCommand - Other command
   * @returns {boolean} False - no merging
   */
  canMergeWith(otherCommand) {
    return false;
  }

  /**
   * Create AddNodeCommand from JSON
   * @param {Object} json - JSON representation
   * @returns {AddNodeCommand} Reconstructed command
   */
  static fromJSON(json) {
    const command = new AddNodeCommand(json.data.nodeData, json.data.parentId);
    command.timestamp = json.timestamp;
    command.executed = json.executed;
    return command;
  }
}