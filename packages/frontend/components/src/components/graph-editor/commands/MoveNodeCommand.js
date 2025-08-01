/**
 * MoveNodeCommand - Command for moving a node to a new position
 * 
 * This command supports merging with other MoveNodeCommands for the same node
 * to avoid cluttering the undo history with every drag step.
 */

import { Command } from './Command.js';

export class MoveNodeCommand extends Command {
  /**
   * Create a MoveNodeCommand
   * @param {string} nodeId - ID of the node to move
   * @param {Object} newPosition - New position {x, y}
   * @param {Object} [oldPosition] - Old position for undo (will be retrieved if not provided)
   */
  constructor(nodeId, newPosition, oldPosition = null) {
    super('moveNode', {
      nodeId: nodeId,
      newPosition: { ...newPosition },
      oldPosition: oldPosition ? { ...oldPosition } : null
    });
    
    // Merge window in milliseconds - commands within this window can be merged
    this.mergeWindow = 500;
  }

  /**
   * Execute the move node command
   * @param {GraphEditorModel} model - The graph model
   * @returns {Object} Undo data containing the old position
   * @protected
   */
  _doExecute(model) {
    const { nodeId, newPosition } = this.data;
    const sceneGraph = model.getSceneGraph();
    
    // Get the node
    const node = sceneGraph.getNodeById(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} does not exist`);
    }
    
    // Store old position if not already stored
    let oldPosition = this.data.oldPosition;
    if (!oldPosition) {
      oldPosition = node.getPosition();
      this.data.oldPosition = { ...oldPosition };
    }
    
    // Move the node
    node.setPosition(newPosition.x, newPosition.y);
    
    // Notify model of change
    model._notifyChange('nodeUpdated', { 
      node, 
      oldPosition 
    });
    
    return {
      oldPosition: oldPosition,
      newPosition: newPosition
    };
  }

  /**
   * Undo the move node command
   * @param {GraphEditorModel} model - The graph model
   * @param {Object} undoData - Data needed to undo
   * @protected
   */
  _doUndo(model, undoData) {
    const { nodeId } = this.data;
    const { oldPosition } = undoData;
    const sceneGraph = model.getSceneGraph();
    
    // Get the node
    const node = sceneGraph.getNodeById(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} does not exist for undo`);
    }
    
    // Restore old position
    const currentPosition = node.getPosition();
    node.setPosition(oldPosition.x, oldPosition.y);
    
    // Notify model of change
    model._notifyChange('nodeUpdated', { 
      node, 
      oldPosition: currentPosition 
    });
  }

  /**
   * Validate the move node command
   * @param {GraphEditorModel} model - The graph model
   * @returns {boolean} True if valid
   */
  validate(model) {
    const { nodeId, newPosition } = this.data;
    
    // Check if node exists
    const sceneGraph = model.getSceneGraph();
    const node = sceneGraph.getNodeById(nodeId);
    if (!node) {
      return false; // Node doesn't exist
    }
    
    // Check if position is valid
    if (!newPosition || 
        typeof newPosition.x !== 'number' || 
        typeof newPosition.y !== 'number') {
      return false;
    }
    
    // Check if position is different from current
    const currentPos = node.getPosition();
    if (currentPos.x === newPosition.x && currentPos.y === newPosition.y) {
      return false; // No movement needed
    }
    
    return true;
  }

  /**
   * Get description for UI
   * @returns {string} Description
   */
  getDescription() {
    const { x, y } = this.data.newPosition;
    return `Move node ${this.data.nodeId} to (${Math.round(x)}, ${Math.round(y)})`;
  }

  /**
   * Check if this command can be merged with another
   * @param {Command} otherCommand - Other command
   * @returns {boolean} True if can merge
   */
  canMergeWith(otherCommand) {
    // Can only merge with other MoveNodeCommands
    if (!(otherCommand instanceof MoveNodeCommand)) {
      return false;
    }
    
    // Must be for the same node
    if (this.data.nodeId !== otherCommand.data.nodeId) {
      return false;
    }
    
    // Must be within merge window
    const timeDiff = Math.abs(this.timestamp - otherCommand.timestamp);
    if (timeDiff > this.mergeWindow) {
      return false;
    }
    
    return true;
  }

  /**
   * Merge this command with another MoveNodeCommand
   * @param {MoveNodeCommand} otherCommand - Command to merge with
   * @returns {MoveNodeCommand} The merged command
   */
  mergeWith(otherCommand) {
    if (!this.canMergeWith(otherCommand)) {
      throw new Error('Cannot merge commands');
    }
    
    // Create merged command with earliest old position and latest new position
    const earlierCommand = this.timestamp <= otherCommand.timestamp ? this : otherCommand;
    const laterCommand = this.timestamp <= otherCommand.timestamp ? otherCommand : this;
    
    // Use the old position from the earlier command and new position from the later command
    const oldPosition = earlierCommand.data.oldPosition || earlierCommand.data.newPosition;
    const newPosition = laterCommand.data.newPosition;
    
    const mergedCommand = new MoveNodeCommand(
      this.data.nodeId,
      newPosition,
      oldPosition
    );
    
    // Use timestamp of the later command
    mergedCommand.timestamp = laterCommand.timestamp;
    
    return mergedCommand;
  }

  /**
   * Get the total distance moved
   * @returns {number} Distance in pixels
   */
  getDistance() {
    const { oldPosition, newPosition } = this.data;
    if (!oldPosition) return 0;
    
    const dx = newPosition.x - oldPosition.x;
    const dy = newPosition.y - oldPosition.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Create MoveNodeCommand from JSON
   * @param {Object} json - JSON representation
   * @returns {MoveNodeCommand} Reconstructed command
   */
  static fromJSON(json) {
    const command = new MoveNodeCommand(
      json.data.nodeId,
      json.data.newPosition,
      json.data.oldPosition
    );
    command.timestamp = json.timestamp;
    command.executed = json.executed;
    return command;
  }
}