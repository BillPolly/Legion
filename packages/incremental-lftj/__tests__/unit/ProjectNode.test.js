import { ProjectNode } from '../../src/ProjectNode.js';
import { Delta } from '../../src/Delta.js';
import { Tuple } from '../../src/Tuple.js';
import { Schema } from '../../src/Schema.js';
import { Integer, StringAtom, BooleanAtom } from '../../src/Atom.js';

describe('ProjectNode', () => {
  describe('Construction', () => {
    it('should create project node with attribute indices', () => {
      const project = new ProjectNode('proj1', [0, 2]);
      expect(project.id).toBe('proj1');
      expect(project.projectionIndices).toEqual([0, 2]);
    });

    it('should create project node with variable names and schema', () => {
      const schema = new Schema([
        { name: 'id', type: 'Integer' },
        { name: 'name', type: 'String' },
        { name: 'active', type: 'Boolean' }
      ]);
      
      const project = new ProjectNode('proj1', ['id', 'active'], schema);
      expect(project.projectionIndices).toEqual([0, 2]);
    });

    it('should validate projection attributes', () => {
      expect(() => new ProjectNode('proj1', [])).toThrow('Projection must specify at least one attribute');
      expect(() => new ProjectNode('proj1', [-1])).toThrow('Invalid projection index: -1');
    });

    it('should validate variable names exist in schema', () => {
      const schema = new Schema([
        { name: 'x', type: 'Integer' },
        { name: 'y', type: 'String' }
      ]);
      
      expect(() => new ProjectNode('proj1', ['x', 'missing'], schema)).toThrow('Variable missing not found in schema');
    });
  });

  describe('Delta Processing per §7.3', () => {
    it('should project tuples and maintain reference counts', () => {
      const project = new ProjectNode('proj1', [0, 2]); // Project positions 0,2

      const tuple1 = new Tuple([new Integer(1), new StringAtom('a'), new BooleanAtom(true)]);
      const tuple2 = new Tuple([new Integer(1), new StringAtom('b'), new BooleanAtom(true)]); // Same projection
      const tuple3 = new Tuple([new Integer(2), new StringAtom('c'), new BooleanAtom(false)]);

      const inputDelta = new Delta(new Set([tuple1, tuple2, tuple3]));
      const outputDelta = project.processDelta(inputDelta);

      // tuple1 and tuple2 project to same result: (1, true)
      // Should see 2 adds but only 1 unique projected tuple in output
      expect(outputDelta.adds.size).toBe(2); // (1,true) and (2,false)
      
      // Check projected tuples by converting to arrays and comparing
      const projectedTuples = Array.from(outputDelta.adds);
      const expectedProj1 = new Tuple([new Integer(1), new BooleanAtom(true)]);
      const expectedProj2 = new Tuple([new Integer(2), new BooleanAtom(false)]);
      
      expect(projectedTuples.some(t => t.equals(expectedProj1))).toBe(true);
      expect(projectedTuples.some(t => t.equals(expectedProj2))).toBe(true);
    });

    it('should handle removes with reference counting', () => {
      const project = new ProjectNode('proj1', [0]);

      // First, add some tuples
      const tuple1 = new Tuple([new Integer(1), new StringAtom('a')]);
      const tuple2 = new Tuple([new Integer(1), new StringAtom('b')]); // Same projection
      const tuple3 = new Tuple([new Integer(2), new StringAtom('c')]);

      const addDelta = new Delta(new Set([tuple1, tuple2, tuple3]));
      const addOutput = project.processDelta(addDelta);

      // Should have projected tuples (1) and (2)
      expect(addOutput.adds.size).toBe(2);

      // Now remove one tuple that projects to (1)
      const removeDelta = new Delta(new Set(), new Set([tuple1]));
      const removeOutput = project.processDelta(removeDelta);

      // (1) should still exist because tuple2 still contributes to it
      // No removes should be emitted because count goes from 2→1, not 1→0
      expect(removeOutput.removes.size).toBe(0);
      expect(removeOutput.adds.size).toBe(0);

      // Remove the other tuple that projects to (1)
      const removeDelta2 = new Delta(new Set(), new Set([tuple2]));
      const removeOutput2 = project.processDelta(removeDelta2);

      // Now (1) should be removed because count goes 1→0
      expect(removeOutput2.removes.size).toBe(1);
      const expectedProj = new Tuple([new Integer(1)]);
      const removedTuples = Array.from(removeOutput2.removes);
      expect(removedTuples.some(t => t.equals(expectedProj))).toBe(true);
    });

    it('should handle 0→1 and 1→0 transitions correctly', () => {
      const project = new ProjectNode('proj1', [0]);

      const tuple1 = new Tuple([new Integer(1), new StringAtom('a')]);
      const projTuple = new Tuple([new Integer(1)]);

      // Add first occurrence: 0→1, should emit add
      const delta1 = new Delta(new Set([tuple1]));
      const output1 = project.processDelta(delta1);
      
      // Check that we have the right projection
      expect(output1.adds.size).toBe(1);
      const actualProj = Array.from(output1.adds)[0];
      expect(actualProj.equals(projTuple)).toBe(true);
      expect(output1.removes.size).toBe(0);

      // Add same projection again: 1→2, should not emit
      const tuple2 = new Tuple([new Integer(1), new StringAtom('b')]);
      const delta2 = new Delta(new Set([tuple2]));
      const output2 = project.processDelta(delta2);
      expect(output2.adds.size).toBe(0);
      expect(output2.removes.size).toBe(0);

      // Remove one occurrence: 2→1, should not emit
      const delta3 = new Delta(new Set(), new Set([tuple1]));
      const output3 = project.processDelta(delta3);
      expect(output3.adds.size).toBe(0);
      expect(output3.removes.size).toBe(0);

      // Remove last occurrence: 1→0, should emit remove
      const delta4 = new Delta(new Set(), new Set([tuple2]));
      const output4 = project.processDelta(delta4);
      expect(output4.adds.size).toBe(0);
      const removedTuples = Array.from(output4.removes);
      expect(removedTuples.some(t => t.equals(projTuple))).toBe(true);
    });

    it('should handle empty projections', () => {
      expect(() => {
        new ProjectNode('proj1', []);
      }).toThrow('Projection must specify at least one attribute');
    });
  });

  describe('State Management', () => {
    it('should track projection counts', () => {
      const project = new ProjectNode('proj1', [0]);

      const tuple1 = new Tuple([new Integer(1), new StringAtom('a')]);
      const tuple2 = new Tuple([new Integer(1), new StringAtom('b')]);
      const tuple3 = new Tuple([new Integer(2), new StringAtom('c')]);

      const delta = new Delta(new Set([tuple1, tuple2, tuple3]));
      project.processDelta(delta);

      const state = project.getState();
      expect(state.type).toBe('Project');
      expect(state.projectionIndices).toEqual([0]);
      expect(state.projectionCounts).toBeDefined();
      
      // Should have counts for projected tuples
      const proj1 = new Tuple([new Integer(1)]);
      const proj2 = new Tuple([new Integer(2)]);
      expect(state.projectionCounts.get(proj1.toBytes().toString())).toBe(2);
      expect(state.projectionCounts.get(proj2.toBytes().toString())).toBe(1);
    });

    it('should reset projection counts', () => {
      const project = new ProjectNode('proj1', [0]);

      const tuple = new Tuple([new Integer(1), new StringAtom('test')]);
      const delta = new Delta(new Set([tuple]));
      project.processDelta(delta);

      expect(project.getState().projectionCounts.size).toBe(1);

      project.reset();
      expect(project.getState().projectionCounts.size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle identity projection', () => {
      const project = new ProjectNode('proj1', [0, 1, 2]);

      const tuple = new Tuple([new Integer(1), new StringAtom('a'), new BooleanAtom(true)]);
      const delta = new Delta(new Set([tuple]));
      const output = project.processDelta(delta);

      // Identity projection should output same tuple
      const outputTuples = Array.from(output.adds);
      expect(outputTuples.some(t => t.equals(tuple))).toBe(true);
    });

    it('should handle single attribute projection', () => {
      const project = new ProjectNode('proj1', [1]);

      const tuple1 = new Tuple([new Integer(1), new StringAtom('same'), new BooleanAtom(true)]);
      const tuple2 = new Tuple([new Integer(2), new StringAtom('same'), new BooleanAtom(false)]);

      const delta = new Delta(new Set([tuple1, tuple2]));
      const output = project.processDelta(delta);

      // Both project to same single attribute
      expect(output.adds.size).toBe(1);
      const expectedProj = new Tuple([new StringAtom('same')]);
      const outputTuples = Array.from(output.adds);
      expect(outputTuples.some(t => t.equals(expectedProj))).toBe(true);
    });
  });
});