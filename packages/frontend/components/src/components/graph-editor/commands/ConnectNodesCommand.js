/**
 * ConnectNodesCommand - Command for creating an edge between two nodes
 */

import { Command } from './Command.js';
import { Edge } from '../model/Edge.js';

export class ConnectNodesCommand extends Command {
  /**
   * Create a ConnectNodesCommand
   * @param {string} sourceNodeId - ID of the source node
   * @param {string} targetNodeId - ID of the target node
   * @param {Object} [edgeData] - Additional edge data (id, label, style, etc.)
   */
  constructor(sourceNodeId, targetNodeId, edgeData = {}) {
    super('connectNodes', {
      sourceNodeId: sourceNodeId,
      targetNodeId: targetNodeId,
      edgeData: { ...edgeData }
    });
  }

  /**
   * Execute the connect nodes command
   * @param {GraphEditorModel} model - The graph model
   * @returns {Object} Undo data containing the created edge
   * @protected
   */
  _doExecute(model) {
    const { sourceNodeId, targetNodeId, edgeData } = this.data;
    
    // Create edge data with source and target
    const fullEdgeData = {
      ...edgeData,
      source: sourceNodeId,
      target: targetNodeId
    };
    
    // Create edge instance if not already one
    const edge = fullEdgeData instanceof Edge ? fullEdgeData : new Edge(fullEdgeData);
    
    // Add to model
    const addedEdge = model.addEdge(edge);
    
    return {
      addedEdge: addedEdge
    };
  }

  /**
   * Undo the connect nodes command
   * @param {GraphEditorModel} model - The graph model
   * @param {Object} undoData - Data needed to undo
   * @protected
   */
  _doUndo(model, undoData) {
    const { addedEdge } = undoData;
    const edgeId = addedEdge.getId();
    
    // Remove the edge
    model.removeEdge(edgeId);
  }

  /**
   * Validate the connect nodes command
   * @param {GraphEditorModel} model - The graph model
   * @returns {boolean} True if valid
   */
  validate(model) {
    const { sourceNodeId, targetNodeId, edgeData } = this.data;
    const sceneGraph = model.getSceneGraph();
    
    // Check if source node exists
    const sourceNode = sceneGraph.getNodeById(sourceNodeId);
    if (!sourceNode) {
      return false; // Source node doesn't exist
    }
    
    // Check if target node exists
    const targetNode = sceneGraph.getNodeById(targetNodeId);
    if (!targetNode) {
      return false; // Target node doesn't exist
    }
    
    // Cannot connect node to itself
    if (sourceNodeId === targetNodeId) {
      return false;
    }
    
    // Check if edge ID is unique (if specified)
    if (edgeData.id) {
      const existingEdge = model.getEdgeById(edgeData.id);
      if (existingEdge) {
        return false; // Edge ID already exists
      }
    }
    
    // Check if connection already exists (optional - depends on requirements)
    const existingEdge = model.getEdges().find(edge => 
      edge.getSource() === sourceNodeId && edge.getTarget() === targetNodeId
    );
    if (existingEdge) {
      return false; // Connection already exists
    }
    
    return true;
  }

  /**
   * Get description for UI
   * @returns {string} Description
   */
  getDescription() {
    const { sourceNodeId, targetNodeId } = this.data;
    return `Connect ${sourceNodeId} to ${targetNodeId}`;
  }

  /**
   * Check if this command can be merged with another
   * ConnectNodesCommands generally don't merge
   * @param {Command} otherCommand - Other command
   * @returns {boolean} False - no merging
   */
  canMergeWith(otherCommand) {
    return false;
  }

  /**
   * Get the source node ID
   * @returns {string} Source node ID
   */
  getSourceNodeId() {
    return this.data.sourceNodeId;
  }

  /**
   * Get the target node ID
   * @returns {string} Target node ID
   */
  getTargetNodeId() {
    return this.data.targetNodeId;
  }

  /**
   * Create ConnectNodesCommand from JSON
   * @param {Object} json - JSON representation
   * @returns {ConnectNodesCommand} Reconstructed command
   */
  static fromJSON(json) {
    const command = new ConnectNodesCommand(
      json.data.sourceNodeId,
      json.data.targetNodeId,
      json.data.edgeData
    );
    command.timestamp = json.timestamp;
    command.executed = json.executed;
    return command;
  }
}