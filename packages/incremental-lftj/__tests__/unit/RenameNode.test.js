import { RenameNode } from '../../src/RenameNode.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { Schema } from '../../src/Schema.js';
import { Integer, StringAtom, BooleanAtom } from '../../src/Atom.js';
import { Node } from '../../src/Node.js';

// Mock node for capturing emissions in tests
class MockOutputNode extends Node {
  constructor(id) {
    super(id);
    this.receivedDeltas = [];
  }

  onDeltaReceived(source, delta) {
    this.receivedDeltas.push({ source, delta });
  }

  processDelta(delta) {
    return delta; // Pass through
  }
}

describe('RenameNode', () => {
  describe('Construction', () => {
    it('should create rename node with mapping', () => {
      const mapping = new Map([['x', 'a'], ['y', 'b']]);
      const rename = new RenameNode('rename1', mapping);
      
      expect(rename.id).toBe('rename1');
      expect(rename.variableMapping).toEqual(mapping);
    });

    it('should create rename node from object', () => {
      const rename = new RenameNode('rename1', { x: 'a', y: 'b' });
      
      expect(rename.variableMapping.get('x')).toBe('a');
      expect(rename.variableMapping.get('y')).toBe('b');
    });

    it('should validate mapping is provided', () => {
      expect(() => new RenameNode('rename1')).toThrow('Variable mapping must be provided');
      expect(() => new RenameNode('rename1', null)).toThrow('Variable mapping must be provided');
    });

    it('should handle empty mapping', () => {
      const rename = new RenameNode('rename1', {});
      expect(rename.variableMapping.size).toBe(0);
    });
  });

  describe('Schema Renaming', () => {
    it('should rename schema variables', () => {
      const originalSchema = new Schema([
        { name: 'user_id', type: 'ID' },
        { name: 'user_name', type: 'String' },
        { name: 'user_active', type: 'Boolean' }
      ]);

      const mapping = {
        'user_id': 'id',
        'user_name': 'name', 
        'user_active': 'active'
      };

      const rename = new RenameNode('rename1', mapping);
      const renamedSchema = rename.renameSchema(originalSchema);

      expect(renamedSchema.variables).toEqual(['id', 'name', 'active']);
      expect(renamedSchema.types).toEqual(['ID', 'String', 'Boolean']);
    });

    it('should keep unmapped variables unchanged', () => {
      const originalSchema = new Schema([
        { name: 'x', type: 'Integer' },
        { name: 'y', type: 'String' },
        { name: 'z', type: 'Boolean' }
      ]);

      const mapping = { 'x': 'a' }; // Only rename x→a
      const rename = new RenameNode('rename1', mapping);
      const renamedSchema = rename.renameSchema(originalSchema);

      expect(renamedSchema.variables).toEqual(['a', 'y', 'z']);
    });

    it('should handle schema with no renameable variables', () => {
      const originalSchema = new Schema([
        { name: 'x', type: 'Integer' },
        { name: 'y', type: 'String' }
      ]);

      const mapping = { 'a': 'b' }; // No variables match
      const rename = new RenameNode('rename1', mapping);
      const renamedSchema = rename.renameSchema(originalSchema);

      expect(renamedSchema.variables).toEqual(['x', 'y']);
    });
  });

  describe('Delta Processing', () => {
    it('should pass through deltas unchanged', () => {
      const rename = new RenameNode('rename1', { x: 'a' });

      const tuple1 = new Tuple([new Integer(1), new StringAtom('test')]);
      const tuple2 = new Tuple([new Integer(2), new StringAtom('other')]);
      
      const inputDelta = new Delta(
        new Set([tuple1]), 
        new Set([tuple2])
      );

      const outputDelta = rename.processDelta(inputDelta);

      // Should pass through unchanged (stateless operation)
      expect(outputDelta).toBe(inputDelta);
      expect(outputDelta.adds.has(tuple1)).toBe(true);
      expect(outputDelta.removes.has(tuple2)).toBe(true);
    });

    it('should handle empty deltas', () => {
      const rename = new RenameNode('rename1', { x: 'a' });
      const emptyDelta = new Delta();
      
      const outputDelta = rename.processDelta(emptyDelta);
      expect(outputDelta).toBe(emptyDelta);
      expect(outputDelta.isEmpty()).toBe(true);
    });
  });

  describe('State Management', () => {
    it('should be stateless', () => {
      const rename = new RenameNode('rename1', { x: 'a', y: 'b' });

      const state = rename.getState();
      expect(state.type).toBe('Rename');
      expect(state.stateless).toBe(true);
      expect(state.variableMapping).toEqual({ x: 'a', y: 'b' });
    });

    it('should not maintain any internal state', () => {
      const rename = new RenameNode('rename1', { x: 'a' });

      const tuple = new Tuple([new Integer(1)]);
      const delta = new Delta(new Set([tuple]));
      
      // Process multiple deltas
      rename.processDelta(delta);
      rename.processDelta(delta);
      rename.processDelta(delta);

      // State should remain empty
      const state = rename.getState();
      expect(Object.keys(state).filter(k => k.startsWith('_')).length).toBe(0);
    });

    it('should reset without error', () => {
      const rename = new RenameNode('rename1', { x: 'a' });
      
      // Should not throw (stateless operation)
      expect(() => rename.reset()).not.toThrow();
    });
  });

  describe('Integration', () => {
    it('should work in operator chain', () => {
      const rename = new RenameNode('rename1', { old_name: 'new_name' });

      const mockOutput = new MockOutputNode('output1');
      rename.addOutput(mockOutput);

      const tuple = new Tuple([new Integer(1), new StringAtom('test')]);
      const delta = new Delta(new Set([tuple]));
      
      rename.pushDelta(delta);

      expect(mockOutput.receivedDeltas.length).toBe(1);
      expect(mockOutput.receivedDeltas[0].source.id).toBe('rename1');
      expect(mockOutput.receivedDeltas[0].delta.adds.has(tuple)).toBe(true);
    });

    it('should handle complex variable mappings', () => {
      const complexMapping = {
        'user_id': 'id',
        'user_first_name': 'firstName',
        'user_last_name': 'lastName',
        'user_email_address': 'email',
        'user_registration_date': 'registeredAt'
      };

      const rename = new RenameNode('rename1', complexMapping);
      
      expect(rename.variableMapping.size).toBe(5);
      expect(rename.variableMapping.get('user_email_address')).toBe('email');
    });
  });

  describe('Edge Cases', () => {
    it('should handle cyclic mappings in definition', () => {
      // Note: The mapping itself doesn't prevent cycles, but the schema rename will handle it
      const mapping = { 'a': 'b', 'b': 'a' };
      const rename = new RenameNode('rename1', mapping);
      
      expect(rename.variableMapping.get('a')).toBe('b');
      expect(rename.variableMapping.get('b')).toBe('a');
    });

    it('should handle self-mapping', () => {
      const mapping = { 'x': 'x' }; // x maps to itself
      const rename = new RenameNode('rename1', mapping);
      
      const schema = new Schema([{ name: 'x', type: 'Integer' }]);
      const renamedSchema = rename.renameSchema(schema);
      
      expect(renamedSchema.variables).toEqual(['x']);
    });
  });
});