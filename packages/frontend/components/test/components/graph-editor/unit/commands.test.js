/**
 * Tests for graph editor command system
 */

import { GraphEditorModel } from '../../../../src/components/graph-editor/model/GraphEditorModel.js';
import { 
  Command, 
  AddNodeCommand, 
  RemoveNodeCommand, 
  MoveNodeCommand, 
  ConnectNodesCommand 
} from '../../../../src/components/graph-editor/commands/index.js';

describe('Graph Editor Command System', () => {
  let model;

  beforeEach(() => {
    model = new GraphEditorModel();
  });

  describe('Base Command Class', () => {
    class TestCommand extends Command {
      constructor(data) {
        super('test', data);
      }

      _doExecute(model) {
        return { executed: true };
      }

      _doUndo(model, undoData) {
        // Test undo
      }
    }

    test('should create command with type and data', () => {
      const data = { value: 42 };
      const command = new TestCommand(data);

      expect(command.getType()).toBe('test');
      expect(command.getData()).toEqual(data);
      expect(command.isExecuted()).toBe(false);
      expect(command.getTimestamp()).toBeGreaterThan(0);
    });

    test('should execute command successfully', () => {
      const command = new TestCommand({ value: 42 });

      expect(command.isExecuted()).toBe(false);
      command.execute(model);
      expect(command.isExecuted()).toBe(true);
    });

    test('should undo command successfully', () => {
      const command = new TestCommand({ value: 42 });

      command.execute(model);
      expect(command.isExecuted()).toBe(true);
      
      command.undo(model);
      expect(command.isExecuted()).toBe(false);
    });

    test('should throw error when executing already executed command', () => {
      const command = new TestCommand({ value: 42 });

      command.execute(model);
      expect(() => command.execute(model)).toThrow('already been executed');
    });

    test('should throw error when undoing non-executed command', () => {
      const command = new TestCommand({ value: 42 });

      expect(() => command.undo(model)).toThrow('has not been executed yet');
    });

    test('should serialize to JSON', () => {
      const command = new TestCommand({ value: 42 });
      const json = command.toJSON();

      expect(json.type).toBe('test');
      expect(json.data.value).toBe(42);
      expect(json.executed).toBe(false);
      expect(json.timestamp).toBe(command.getTimestamp());
    });
  });

  describe('AddNodeCommand', () => {
    test('should add node to model', () => {
      const nodeData = {
        id: 'test-node',
        position: { x: 100, y: 200 },
        label: 'Test Node'
      };
      const command = new AddNodeCommand(nodeData);

      expect(command.validate(model)).toBe(true);
      
      // Execute command
      command.execute(model);
      
      // Check node was added
      const addedNode = model.getSceneGraph().getNodeById('test-node');
      expect(addedNode).toBeTruthy();
      expect(addedNode.getLabel()).toBe('Test Node');
      expect(addedNode.getPosition()).toEqual({ x: 100, y: 200 });
    });

    test('should undo node addition', () => {
      const nodeData = {
        id: 'test-node',
        position: { x: 100, y: 200 },
        label: 'Test Node'
      };
      const command = new AddNodeCommand(nodeData);

      // Execute and then undo
      command.execute(model);
      expect(model.getSceneGraph().getNodeById('test-node')).toBeTruthy();
      
      command.undo(model);
      expect(model.getSceneGraph().getNodeById('test-node')).toBeUndefined();
    });

    test('should validate node data', () => {
      // Valid command
      const validCommand = new AddNodeCommand({ id: 'test' });
      expect(validCommand.validate(model)).toBe(true);

      // Invalid - no data
      const invalidCommand = new AddNodeCommand(null);
      expect(invalidCommand.validate(model)).toBe(false);

      // Invalid - duplicate ID
      model.addNode({ id: 'existing' });
      const duplicateCommand = new AddNodeCommand({ id: 'existing' });
      expect(duplicateCommand.validate(model)).toBe(false);
    });

    test('should have descriptive text', () => {
      const command = new AddNodeCommand({ id: 'my-node' });
      expect(command.getDescription()).toBe('Add node my-node');
    });

    test('should serialize/deserialize correctly', () => {
      const nodeData = { id: 'test', label: 'Test' };
      const command = new AddNodeCommand(nodeData, 'parent');
      const json = command.toJSON();
      const restored = AddNodeCommand.fromJSON(json);

      expect(restored.getData().nodeData).toEqual(nodeData);
      expect(restored.getData().parentId).toBe('parent');
    });
  });

  describe('RemoveNodeCommand', () => {
    test('should remove node from model', () => {
      // Add a node first
      const node = model.addNode({
        id: 'test-node',
        position: { x: 100, y: 200 },
        label: 'Test Node'
      });

      const command = new RemoveNodeCommand('test-node');
      expect(command.validate(model)).toBe(true);

      // Execute command
      command.execute(model);

      // Check node was removed
      expect(model.getSceneGraph().getNodeById('test-node')).toBeUndefined();
    });

    test('should undo node removal', () => {
      // Add a node first
      const originalNode = model.addNode({
        id: 'test-node',
        position: { x: 100, y: 200 },
        label: 'Test Node'
      });

      const command = new RemoveNodeCommand('test-node');

      // Execute and then undo
      command.execute(model);
      expect(model.getSceneGraph().getNodeById('test-node')).toBeUndefined();

      command.undo(model);
      const restoredNode = model.getSceneGraph().getNodeById('test-node');
      expect(restoredNode).toBeTruthy();
      expect(restoredNode.getLabel()).toBe('Test Node');
      expect(restoredNode.getPosition()).toEqual({ x: 100, y: 200 });
    });

    test('should remove connected edges', () => {
      // Add nodes and edge
      model.addNode({ id: 'node1', position: { x: 0, y: 0 } });
      model.addNode({ id: 'node2', position: { x: 100, y: 0 } });
      model.addEdge({ id: 'edge1', source: 'node1', target: 'node2' });

      expect(model.getEdges()).toHaveLength(1);

      const command = new RemoveNodeCommand('node1');
      command.execute(model);

      // Edge should be removed too
      expect(model.getEdges()).toHaveLength(0);
    });

    test('should restore connected edges on undo', () => {
      // Add nodes and edge
      model.addNode({ id: 'node1', position: { x: 0, y: 0 } });
      model.addNode({ id: 'node2', position: { x: 100, y: 0 } });
      model.addEdge({ id: 'edge1', source: 'node1', target: 'node2' });

      const command = new RemoveNodeCommand('node1');
      command.execute(model);
      command.undo(model);

      // Edge should be restored
      expect(model.getEdges()).toHaveLength(1);
      expect(model.getEdgeById('edge1')).toBeTruthy();
    });

    test('should validate node exists', () => {
      // Valid - node exists
      model.addNode({ id: 'test-node' });
      const validCommand = new RemoveNodeCommand('test-node');
      expect(validCommand.validate(model)).toBe(true);

      // Invalid - node doesn't exist
      const invalidCommand = new RemoveNodeCommand('nonexistent');
      expect(invalidCommand.validate(model)).toBe(false);

      // Invalid - cannot remove root
      const rootCommand = new RemoveNodeCommand('root');
      expect(rootCommand.validate(model)).toBe(false);
    });
  });

  describe('MoveNodeCommand', () => {
    test('should move node to new position', () => {
      // Add a node
      const node = model.addNode({
        id: 'test-node',
        position: { x: 100, y: 200 }
      });

      const command = new MoveNodeCommand('test-node', { x: 300, y: 400 });
      expect(command.validate(model)).toBe(true);

      // Execute command
      command.execute(model);

      // Check node was moved
      const movedNode = model.getSceneGraph().getNodeById('test-node');
      expect(movedNode.getPosition()).toEqual({ x: 300, y: 400 });
    });

    test('should undo node movement', () => {
      // Add a node
      const node = model.addNode({
        id: 'test-node',
        position: { x: 100, y: 200 }
      });

      const command = new MoveNodeCommand('test-node', { x: 300, y: 400 });

      // Execute and then undo
      command.execute(model);
      expect(model.getSceneGraph().getNodeById('test-node').getPosition()).toEqual({ x: 300, y: 400 });

      command.undo(model);
      expect(model.getSceneGraph().getNodeById('test-node').getPosition()).toEqual({ x: 100, y: 200 });
    });

    test('should merge with other move commands', () => {
      const command1 = new MoveNodeCommand('test-node', { x: 100, y: 100 }, { x: 0, y: 0 });
      const command2 = new MoveNodeCommand('test-node', { x: 200, y: 200 });
      
      // Set different timestamps
      command1.timestamp = Date.now() - 100;
      command2.timestamp = Date.now();

      // Commands for same node within merge window should merge
      expect(command1.canMergeWith(command2)).toBe(true);

      const merged = command1.mergeWith(command2);
      expect(merged.getData().newPosition).toEqual({ x: 200, y: 200 });
      expect(merged.getData().oldPosition).toEqual({ x: 0, y: 0 });
    });

    test('should not merge with different nodes', () => {
      const command1 = new MoveNodeCommand('node1', { x: 100, y: 100 });
      const command2 = new MoveNodeCommand('node2', { x: 200, y: 200 });

      expect(command1.canMergeWith(command2)).toBe(false);
    });

    test('should not merge commands outside merge window', () => {
      const command1 = new MoveNodeCommand('test-node', { x: 100, y: 100 });
      const command2 = new MoveNodeCommand('test-node', { x: 200, y: 200 });

      // Manually set timestamps far apart
      command1.timestamp = Date.now() - 1000; // 1 second ago
      command2.timestamp = Date.now();

      expect(command1.canMergeWith(command2)).toBe(false);
    });

    test('should calculate movement distance', () => {
      const command = new MoveNodeCommand('test-node', { x: 300, y: 400 }, { x: 100, y: 200 });
      const distance = command.getDistance();
      
      // Distance should be sqrt((300-100)^2 + (400-200)^2) = sqrt(40000 + 40000) = sqrt(80000) ≈ 282.84
      expect(distance).toBeCloseTo(282.84, 1);
    });

    test('should validate move parameters', () => {
      // Add node
      model.addNode({ id: 'test-node', position: { x: 100, y: 200 } });

      // Valid move
      const validCommand = new MoveNodeCommand('test-node', { x: 300, y: 400 });
      expect(validCommand.validate(model)).toBe(true);

      // Invalid - node doesn't exist
      const invalidNodeCommand = new MoveNodeCommand('nonexistent', { x: 300, y: 400 });
      expect(invalidNodeCommand.validate(model)).toBe(false);

      // Invalid - invalid position
      const invalidPosCommand = new MoveNodeCommand('test-node', { x: 'invalid', y: 400 });
      expect(invalidPosCommand.validate(model)).toBe(false);

      // Invalid - no movement
      const noMoveCommand = new MoveNodeCommand('test-node', { x: 100, y: 200 });
      expect(noMoveCommand.validate(model)).toBe(false);
    });
  });

  describe('ConnectNodesCommand', () => {
    test('should create edge between nodes', () => {
      // Add two nodes
      model.addNode({ id: 'node1', position: { x: 0, y: 0 } });
      model.addNode({ id: 'node2', position: { x: 100, y: 0 } });

      const command = new ConnectNodesCommand('node1', 'node2', { id: 'test-edge' });
      expect(command.validate(model)).toBe(true);

      // Execute command
      command.execute(model);

      // Check edge was created
      const edge = model.getEdgeById('test-edge');
      expect(edge).toBeTruthy();
      expect(edge.getSource()).toBe('node1');
      expect(edge.getTarget()).toBe('node2');
    });

    test('should undo edge creation', () => {
      // Add two nodes
      model.addNode({ id: 'node1', position: { x: 0, y: 0 } });
      model.addNode({ id: 'node2', position: { x: 100, y: 0 } });

      const command = new ConnectNodesCommand('node1', 'node2', { id: 'test-edge' });

      // Execute and then undo
      command.execute(model);
      expect(model.getEdgeById('test-edge')).toBeTruthy();

      command.undo(model);
      expect(model.getEdgeById('test-edge')).toBeUndefined();
    });

    test('should validate connection parameters', () => {
      // Add nodes
      model.addNode({ id: 'node1', position: { x: 0, y: 0 } });
      model.addNode({ id: 'node2', position: { x: 100, y: 0 } });

      // Valid connection
      const validCommand = new ConnectNodesCommand('node1', 'node2');
      expect(validCommand.validate(model)).toBe(true);

      // Invalid - source doesn't exist
      const invalidSourceCommand = new ConnectNodesCommand('nonexistent', 'node2');
      expect(invalidSourceCommand.validate(model)).toBe(false);

      // Invalid - target doesn't exist
      const invalidTargetCommand = new ConnectNodesCommand('node1', 'nonexistent');
      expect(invalidTargetCommand.validate(model)).toBe(false);

      // Invalid - self connection
      const selfCommand = new ConnectNodesCommand('node1', 'node1');
      expect(selfCommand.validate(model)).toBe(false);

      // Invalid - duplicate connection
      model.addEdge({ source: 'node1', target: 'node2' });
      const duplicateCommand = new ConnectNodesCommand('node1', 'node2');
      expect(duplicateCommand.validate(model)).toBe(false);
    });

    test('should get source and target node IDs', () => {
      const command = new ConnectNodesCommand('source', 'target');
      expect(command.getSourceNodeId()).toBe('source');
      expect(command.getTargetNodeId()).toBe('target');
    });
  });

  describe('Command Merging', () => {
    test('should merge multiple move commands for same node', () => {
      const baseTime = Date.now();
      const commands = [
        new MoveNodeCommand('node1', { x: 100, y: 100 }, { x: 0, y: 0 }),
        new MoveNodeCommand('node1', { x: 150, y: 150 }),
        new MoveNodeCommand('node1', { x: 200, y: 200 })
      ];

      // Set timestamps to be within merge window
      commands[0].timestamp = baseTime;
      commands[1].timestamp = baseTime + 100;
      commands[2].timestamp = baseTime + 200;

      // Start with first command
      let merged = commands[0];

      // Merge subsequent commands
      for (let i = 1; i < commands.length; i++) {
        if (merged.canMergeWith(commands[i])) {
          merged = merged.mergeWith(commands[i]);
        }
      }

      // Final merged command should go from original start to final end
      expect(merged.getData().oldPosition).toEqual({ x: 0, y: 0 });
      expect(merged.getData().newPosition).toEqual({ x: 200, y: 200 });
    });
  });

  describe('Command Error Handling', () => {
    test('should handle execution errors gracefully', () => {
      const command = new RemoveNodeCommand('nonexistent-node');

      expect(() => command.execute(model)).toThrow('does not exist');
      expect(command.isExecuted()).toBe(false);
    });

    test('should handle undo errors gracefully', () => {
      // Create command that will fail on undo
      model.addNode({ id: 'test-node', position: { x: 0, y: 0 } });
      const command = new RemoveNodeCommand('test-node');
      
      command.execute(model);
      
      // Manually remove the undo data to cause undo failure
      // This simulates a corrupted state scenario
      command._undoData = null;
      
      expect(() => command.undo(model)).toThrow('Failed to undo command');
    });
  });
});