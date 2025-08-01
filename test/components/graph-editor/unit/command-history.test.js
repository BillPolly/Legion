/**
 * Tests for CommandHistory class
 */

import { GraphEditorModel } from '../../../../src/components/graph-editor/model/GraphEditorModel.js';
import { 
  CommandHistory,
  AddNodeCommand,
  RemoveNodeCommand,
  MoveNodeCommand,
  ConnectNodesCommand
} from '../../../../src/components/graph-editor/commands/index.js';

describe('CommandHistory', () => {
  let history;
  let model;

  beforeEach(() => {
    history = new CommandHistory();
    model = new GraphEditorModel();
  });

  describe('Basic Operations', () => {
    test('should start with empty history', () => {
      expect(history.getSize()).toBe(0);
      expect(history.getCurrentIndex()).toBe(-1);
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
    });

    test('should execute commands and update history', () => {
      const command = new AddNodeCommand({ id: 'test-node', position: { x: 100, y: 100 } });
      
      const result = history.execute(command, model);
      
      expect(result).toBe(true);
      expect(history.getSize()).toBe(1);
      expect(history.getCurrentIndex()).toBe(0);
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
    });

    test('should undo last command', () => {
      const command = new AddNodeCommand({ id: 'test-node', position: { x: 100, y: 100 } });
      
      history.execute(command, model);
      expect(model.getSceneGraph().getNodeById('test-node')).toBeTruthy();
      
      const undoResult = history.undo(model);
      
      expect(undoResult).toBe(true);
      expect(model.getSceneGraph().getNodeById('test-node')).toBeUndefined();
      expect(history.getCurrentIndex()).toBe(-1);
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(true);
    });

    test('should redo undone command', () => {
      const command = new AddNodeCommand({ id: 'test-node', position: { x: 100, y: 100 } });
      
      history.execute(command, model);
      history.undo(model);
      
      const redoResult = history.redo(model);
      
      expect(redoResult).toBe(true);
      expect(model.getSceneGraph().getNodeById('test-node')).toBeTruthy();
      expect(history.getCurrentIndex()).toBe(0);
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
    });

    test('should clear future history when executing after undo', () => {
      const command1 = new AddNodeCommand({ id: 'node1', position: { x: 0, y: 0 } });
      const command2 = new AddNodeCommand({ id: 'node2', position: { x: 100, y: 0 } });
      const command3 = new AddNodeCommand({ id: 'node3', position: { x: 200, y: 0 } });
      
      history.execute(command1, model);
      history.execute(command2, model);
      history.undo(model);
      
      expect(history.getSize()).toBe(2);
      expect(history.canRedo()).toBe(true);
      
      // Execute new command - should clear redo stack
      history.execute(command3, model);
      
      expect(history.getSize()).toBe(2); // command1 and command3
      expect(history.canRedo()).toBe(false);
      expect(model.getSceneGraph().getNodeById('node2')).toBeUndefined();
      expect(model.getSceneGraph().getNodeById('node3')).toBeTruthy();
    });
  });

  describe('Command Validation', () => {
    test('should not execute invalid commands', () => {
      const command = new RemoveNodeCommand('nonexistent-node');
      
      const result = history.execute(command, model);
      
      expect(result).toBe(false);
      expect(history.getSize()).toBe(0);
    });

    test('should handle execution errors gracefully', () => {
      // Create a command that will fail during execution
      const command = new AddNodeCommand({ id: 'test' });
      model.addNode({ id: 'test' }); // Add duplicate to cause failure
      
      const result = history.execute(command, model);
      
      expect(result).toBe(false);
      expect(history.getSize()).toBe(0);
    });
  });

  describe('Command Merging', () => {
    test('should merge compatible move commands', () => {
      model.addNode({ id: 'test-node', position: { x: 0, y: 0 } });
      
      const command1 = new MoveNodeCommand('test-node', { x: 100, y: 100 });
      const command2 = new MoveNodeCommand('test-node', { x: 200, y: 200 });
      
      history.execute(command1, model);
      expect(history.getSize()).toBe(1);
      
      // Execute second command within merge window
      history.execute(command2, model);
      
      // Should still have only 1 command (merged)
      expect(history.getSize()).toBe(1);
      
      // Node should be at final position
      const node = model.getSceneGraph().getNodeById('test-node');
      expect(node.getPosition()).toEqual({ x: 200, y: 200 });
      
      // Undo should go back to original position
      history.undo(model);
      expect(node.getPosition()).toEqual({ x: 0, y: 0 });
    });

    test('should not merge incompatible commands', () => {
      model.addNode({ id: 'node1', position: { x: 0, y: 0 } });
      model.addNode({ id: 'node2', position: { x: 100, y: 0 } });
      
      const command1 = new MoveNodeCommand('node1', { x: 50, y: 50 });
      const command2 = new MoveNodeCommand('node2', { x: 150, y: 50 });
      
      history.execute(command1, model);
      history.execute(command2, model);
      
      // Should have 2 separate commands
      expect(history.getSize()).toBe(2);
    });

    test('should respect merge enabled setting', () => {
      const noMergeHistory = new CommandHistory({ mergeEnabled: false });
      model.addNode({ id: 'test-node', position: { x: 0, y: 0 } });
      
      const command1 = new MoveNodeCommand('test-node', { x: 100, y: 100 });
      const command2 = new MoveNodeCommand('test-node', { x: 200, y: 200 });
      
      noMergeHistory.execute(command1, model);
      noMergeHistory.execute(command2, model);
      
      // Should have 2 commands (no merging)
      expect(noMergeHistory.getSize()).toBe(2);
    });
  });

  describe('History Limits', () => {
    test('should enforce maximum size limit', () => {
      const limitedHistory = new CommandHistory({ maxSize: 3 });
      
      // Add 5 commands
      for (let i = 0; i < 5; i++) {
        const command = new AddNodeCommand({ 
          id: `node${i}`, 
          position: { x: i * 100, y: 0 } 
        });
        limitedHistory.execute(command, model);
      }
      
      // Should only keep last 3 commands in history
      expect(limitedHistory.getSize()).toBe(3);
      expect(limitedHistory.getCurrentIndex()).toBe(2);
      
      // All nodes should still exist (removing from history doesn't undo them)
      expect(model.getSceneGraph().getNodeById('node0')).toBeTruthy();
      expect(model.getSceneGraph().getNodeById('node1')).toBeTruthy();
      expect(model.getSceneGraph().getNodeById('node2')).toBeTruthy();
      expect(model.getSceneGraph().getNodeById('node3')).toBeTruthy();
      expect(model.getSceneGraph().getNodeById('node4')).toBeTruthy();
      
      // But we can only undo the last 3 commands
      const commands = limitedHistory.getCommands();
      expect(commands[0].getData().nodeData.id).toBe('node2');
      expect(commands[1].getData().nodeData.id).toBe('node3');
      expect(commands[2].getData().nodeData.id).toBe('node4');
    });
  });

  describe('Event Listeners', () => {
    test('should notify on execute', () => {
      let executedCommand = null;
      history.on('execute', (command) => {
        executedCommand = command;
      });
      
      const command = new AddNodeCommand({ id: 'test' });
      history.execute(command, model);
      
      expect(executedCommand).toBe(command);
    });

    test('should notify on undo', () => {
      let undoneCommand = null;
      history.on('undo', (command) => {
        undoneCommand = command;
      });
      
      const command = new AddNodeCommand({ id: 'test' });
      history.execute(command, model);
      history.undo(model);
      
      expect(undoneCommand).toBe(command);
    });

    test('should notify on redo', () => {
      let redoneCommand = null;
      history.on('redo', (command) => {
        redoneCommand = command;
      });
      
      const command = new AddNodeCommand({ id: 'test' });
      history.execute(command, model);
      history.undo(model);
      history.redo(model);
      
      expect(redoneCommand).toBe(command);
    });

    test('should notify on change', () => {
      let changeCount = 0;
      history.on('change', () => {
        changeCount++;
      });
      
      const command = new AddNodeCommand({ id: 'test' });
      history.execute(command, model); // +1
      history.undo(model); // +1
      history.redo(model); // +1
      history.clear(); // +1
      
      expect(changeCount).toBe(4);
    });

    test('should remove listeners', () => {
      let callCount = 0;
      const listener = () => { callCount++; };
      
      history.on('change', listener);
      history.execute(new AddNodeCommand({ id: 'test' }), model);
      expect(callCount).toBe(1);
      
      history.off('change', listener);
      history.execute(new AddNodeCommand({ id: 'test2' }), model);
      expect(callCount).toBe(1); // Should not increase
    });
  });

  describe('State and Stack Access', () => {
    test('should get current state', () => {
      const command1 = new AddNodeCommand({ id: 'node1' });
      const command2 = new AddNodeCommand({ id: 'node2' });
      
      history.execute(command1, model);
      history.execute(command2, model);
      history.undo(model);
      
      const state = history.getState();
      
      expect(state.size).toBe(2);
      expect(state.currentIndex).toBe(0);
      expect(state.canUndo).toBe(true);
      expect(state.canRedo).toBe(true);
      expect(state.undoCommand).toBe('Add node node1');
      expect(state.redoCommand).toBe('Add node node2');
    });

    test('should get undo and redo stacks', () => {
      const commands = [];
      for (let i = 0; i < 5; i++) {
        const cmd = new AddNodeCommand({ id: `node${i}` });
        commands.push(cmd);
        history.execute(cmd, model);
      }
      
      // Undo 2 commands
      history.undo(model);
      history.undo(model);
      
      const undoStack = history.getUndoStack();
      const redoStack = history.getRedoStack();
      
      expect(undoStack).toHaveLength(3); // Commands 0, 1, 2
      expect(redoStack).toHaveLength(2); // Commands 3, 4
    });

    test('should get specific commands', () => {
      const command = new AddNodeCommand({ id: 'test' });
      history.execute(command, model);
      
      expect(history.getUndoCommand()).toBe(command);
      expect(history.getRedoCommand()).toBeNull();
      
      history.undo(model);
      
      expect(history.getUndoCommand()).toBeNull();
      expect(history.getRedoCommand()).toBe(command);
    });
  });

  describe('Clear Operations', () => {
    test('should clear all history', () => {
      // Add some commands
      history.execute(new AddNodeCommand({ id: 'node1' }), model);
      history.execute(new AddNodeCommand({ id: 'node2' }), model);
      
      expect(history.getSize()).toBe(2);
      
      history.clear();
      
      expect(history.getSize()).toBe(0);
      expect(history.getCurrentIndex()).toBe(-1);
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
    });
  });

  describe('Serialization', () => {
    test('should serialize and deserialize history', () => {
      // Create some history
      history.execute(new AddNodeCommand({ id: 'node1' }), model);
      history.execute(new MoveNodeCommand('node1', { x: 100, y: 100 }), model);
      history.undo(model);
      
      // Serialize
      const json = history.toJSON();
      
      expect(json.commands).toHaveLength(2);
      expect(json.currentIndex).toBe(0);
      expect(json.maxSize).toBe(100);
      expect(json.mergeEnabled).toBe(true);
      
      // Deserialize with command factory
      const commandFactory = (cmdJson) => {
        switch (cmdJson.type) {
          case 'addNode':
            return AddNodeCommand.fromJSON(cmdJson);
          case 'moveNode':
            return MoveNodeCommand.fromJSON(cmdJson);
          default:
            throw new Error(`Unknown command type: ${cmdJson.type}`);
        }
      };
      
      const restored = CommandHistory.fromJSON(json, commandFactory);
      
      expect(restored.getSize()).toBe(2);
      expect(restored.getCurrentIndex()).toBe(0);
      expect(restored.canUndo()).toBe(true);
      expect(restored.canRedo()).toBe(true);
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle multiple undo/redo cycles', () => {
      const commands = [];
      
      // Create 3 nodes
      for (let i = 0; i < 3; i++) {
        const cmd = new AddNodeCommand({ id: `node${i}`, position: { x: i * 100, y: 0 } });
        commands.push(cmd);
        history.execute(cmd, model);
      }
      
      // All nodes should exist
      expect(model.getSceneGraph().getNodeById('node0')).toBeTruthy();
      expect(model.getSceneGraph().getNodeById('node1')).toBeTruthy();
      expect(model.getSceneGraph().getNodeById('node2')).toBeTruthy();
      
      // Undo all
      history.undo(model);
      history.undo(model);
      history.undo(model);
      
      // No nodes should exist
      expect(model.getSceneGraph().getNodeById('node0')).toBeUndefined();
      expect(model.getSceneGraph().getNodeById('node1')).toBeUndefined();
      expect(model.getSceneGraph().getNodeById('node2')).toBeUndefined();
      
      // Redo all
      history.redo(model);
      history.redo(model);
      history.redo(model);
      
      // All nodes should exist again
      expect(model.getSceneGraph().getNodeById('node0')).toBeTruthy();
      expect(model.getSceneGraph().getNodeById('node1')).toBeTruthy();
      expect(model.getSceneGraph().getNodeById('node2')).toBeTruthy();
    });

    test('should handle command sequences with dependencies', () => {
      // Add two nodes
      history.execute(new AddNodeCommand({ id: 'node1', position: { x: 0, y: 0 } }), model);
      history.execute(new AddNodeCommand({ id: 'node2', position: { x: 100, y: 0 } }), model);
      
      // Connect them
      history.execute(new ConnectNodesCommand('node1', 'node2', { id: 'edge1' }), model);
      
      // Remove node1 (should also remove edge)
      history.execute(new RemoveNodeCommand('node1'), model);
      
      expect(model.getSceneGraph().getNodeById('node1')).toBeUndefined();
      expect(model.getEdgeById('edge1')).toBeUndefined();
      
      // Undo removal - should restore both node and edge
      history.undo(model);
      
      expect(model.getSceneGraph().getNodeById('node1')).toBeTruthy();
      expect(model.getEdgeById('edge1')).toBeTruthy();
    });
  });
});