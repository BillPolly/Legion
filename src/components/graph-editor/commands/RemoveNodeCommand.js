/**
 * RemoveNodeCommand - Command for removing a node from the graph
 */

import { Command } from './Command.js';

export class RemoveNodeCommand extends Command {
  /**
   * Create a RemoveNodeCommand
   * @param {string} nodeId - ID of the node to remove
   */
  constructor(nodeId) {
    super('removeNode', {
      nodeId: nodeId
    });
  }

  /**
   * Execute the remove node command
   * @param {GraphEditorModel} model - The graph model
   * @returns {Object} Undo data containing the removed node and edges
   * @protected
   */
  _doExecute(model) {
    const { nodeId } = this.data;
    const sceneGraph = model.getSceneGraph();
    
    // Get the node before removing it
    const nodeToRemove = sceneGraph.getNodeById(nodeId);
    if (!nodeToRemove) {
      throw new Error(`Node ${nodeId} does not exist`);
    }
    
    // Store node data for undo
    const nodeData = {
      id: nodeToRemove.getId(),
      type: nodeToRemove.getType(),
      label: nodeToRemove.getLabel(),
      position: nodeToRemove.getPosition(),
      size: nodeToRemove.getSize(),
      style: nodeToRemove.getStyle(),
      data: nodeToRemove.getData(),
      visible: nodeToRemove.isVisible(),
      locked: nodeToRemove.isLocked()
    };
    
    // Get parent information
    const parentNode = nodeToRemove.getParent();
    const parentId = parentNode ? parentNode.getId() : 'root';
    
    // Find and store connected edges
    const connectedEdges = model.getConnectedEdges(nodeId);
    const edgeData = connectedEdges.map(edge => ({
      id: edge.getId(),
      source: edge.getSource(),
      target: edge.getTarget(),
      label: edge.getLabel(),
      style: edge.getStyle(),
      data: edge.getData(),
      directed: edge.isDirected()
    }));
    
    // Remove connected edges first
    connectedEdges.forEach(edge => {
      model.removeEdge(edge.getId());
    });
    
    // Remove the node
    const removedNode = sceneGraph.removeNode(nodeId);
    if (removedNode) {
      const position = removedNode.getPosition();
      const size = removedNode.getSize();
      model._notifyChange('nodeRemoved', { 
        nodeId, 
        position, 
        size 
      });
    }
    
    return {
      nodeData: nodeData,
      parentId: parentId,
      connectedEdges: edgeData
    };
  }

  /**
   * Undo the remove node command
   * @param {GraphEditorModel} model - The graph model
   * @param {Object} undoData - Data needed to undo
   * @protected
   */
  _doUndo(model, undoData) {
    const { nodeData, parentId, connectedEdges } = undoData;
    
    // Re-create and add the node
    const restoredNode = model.addNode(nodeData, parentId);
    
    // Re-create connected edges
    connectedEdges.forEach(edgeData => {
      // Only restore edge if both source and target nodes exist
      const sceneGraph = model.getSceneGraph();
      const sourceExists = sceneGraph.getNodeById(edgeData.source);
      const targetExists = sceneGraph.getNodeById(edgeData.target);
      
      if (sourceExists && targetExists) {
        model.addEdge(edgeData);
      }
    });
  }

  /**
   * Validate the remove node command
   * @param {GraphEditorModel} model - The graph model
   * @returns {boolean} True if valid
   */
  validate(model) {
    const { nodeId } = this.data;
    
    // Check if node exists
    const sceneGraph = model.getSceneGraph();
    const node = sceneGraph.getNodeById(nodeId);
    if (!node) {
      return false; // Node doesn't exist
    }
    
    // Cannot remove root node
    if (nodeId === 'root') {
      return false;
    }
    
    return true;
  }

  /**
   * Get description for UI
   * @returns {string} Description
   */
  getDescription() {
    return `Remove node ${this.data.nodeId}`;
  }

  /**
   * Check if this command can be merged with another
   * RemoveNodeCommands generally don't merge
   * @param {Command} otherCommand - Other command
   * @returns {boolean} False - no merging
   */
  canMergeWith(otherCommand) {
    return false;
  }

  /**
   * Create RemoveNodeCommand from JSON
   * @param {Object} json - JSON representation
   * @returns {RemoveNodeCommand} Reconstructed command
   */
  static fromJSON(json) {
    const command = new RemoveNodeCommand(json.data.nodeId);
    command.timestamp = json.timestamp;
    command.executed = json.executed;
    return command;
  }
}