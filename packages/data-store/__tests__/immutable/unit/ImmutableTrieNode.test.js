/**
 * Unit Tests for ImmutableTrieNode
 * Per implementation plan Phase 1 Step 1.2
 * TDD approach - tests written first before implementation
 */

import { ImmutableTrieNode } from '../../../src/immutable/ImmutableTrieNode.js';

describe('ImmutableTrieNode', () => {
  let rootNode;
  let nodeWithValue;

  beforeEach(() => {
    rootNode = new ImmutableTrieNode();
    nodeWithValue = new ImmutableTrieNode('testValue', 1);
  });

  describe('Constructor and Immutability', () => {
    test('should create empty immutable trie node', () => {
      expect(rootNode).toBeDefined();
      expect(rootNode.value).toBe(null);
      expect(rootNode.depth).toBe(0);
      expect(rootNode.isLeaf).toBe(false);
      expect(rootNode.getChildCount()).toBe(0);
      expect(rootNode.getWitnessCount()).toBe(0);
      
      // Should be frozen (immutable)
      expect(Object.isFrozen(rootNode)).toBe(true);
    });

    test('should create node with value and depth', () => {
      expect(nodeWithValue.value).toBe('testValue');
      expect(nodeWithValue.depth).toBe(1);
      expect(nodeWithValue.isLeaf).toBe(false);
      expect(nodeWithValue.getChildCount()).toBe(0);
      expect(nodeWithValue.getWitnessCount()).toBe(0);
      expect(Object.isFrozen(nodeWithValue)).toBe(true);
    });

    test('should create node with all parameters', () => {
      const children = new Map([['child1', new ImmutableTrieNode('child1', 2)]]);
      const witnesses = new Set(['witness1', 'witness2']);
      
      const node = new ImmutableTrieNode('value', 1, children, witnesses, true);
      
      expect(node.value).toBe('value');
      expect(node.depth).toBe(1);
      expect(node.isLeaf).toBe(true);
      expect(node.getChildCount()).toBe(1);
      expect(node.getWitnessCount()).toBe(2);
      expect(Object.isFrozen(node)).toBe(true);
    });

    test('should have immutable children and witnesses', () => {
      const children = rootNode.getAllChildren();
      const witnesses = rootNode.getWitnesses();
      
      expect(Object.isFrozen(children)).toBe(true);
      expect(() => children.set('test', 'value')).toThrow();
      
      expect(Array.isArray(witnesses)).toBe(true);
      // Witnesses returned as array, so test internal immutability through operations
    });
  });

  describe('withAddedChild() - Pure Function', () => {
    test('should return new node with added child', () => {
      const newNode = rootNode.withAddedChild('childValue');
      
      // Should return new instance
      expect(newNode).not.toBe(rootNode);
      expect(newNode).toBeInstanceOf(ImmutableTrieNode);
      
      // Original node unchanged
      expect(rootNode.getChildCount()).toBe(0);
      expect(rootNode.hasChild('childValue')).toBe(false);
      
      // New node has child
      expect(newNode.getChildCount()).toBe(1);
      expect(newNode.hasChild('childValue')).toBe(true);
      
      const child = newNode.getChild('childValue');
      expect(child).toBeInstanceOf(ImmutableTrieNode);
      expect(child.value).toBe('childValue');
      expect(child.depth).toBe(1);
      
      // Both should be frozen
      expect(Object.isFrozen(rootNode)).toBe(true);
      expect(Object.isFrozen(newNode)).toBe(true);
    });

    test('should return same instance when adding duplicate child', () => {
      const nodeWithChild = rootNode.withAddedChild('childValue');
      const nodeWithDuplicate = nodeWithChild.withAddedChild('childValue');
      
      // Should return same instance (optimization)
      expect(nodeWithDuplicate).toBe(nodeWithChild);
      expect(nodeWithDuplicate.getChildCount()).toBe(1);
    });

    test('should handle multiple children correctly', () => {
      const node1 = rootNode.withAddedChild('child1');
      const node2 = node1.withAddedChild('child2');
      const node3 = node2.withAddedChild('child3');
      
      expect(node3.getChildCount()).toBe(3);
      expect(node3.hasChild('child1')).toBe(true);
      expect(node3.hasChild('child2')).toBe(true);
      expect(node3.hasChild('child3')).toBe(true);
      
      // Children should be properly sorted
      const childValues = node3.getChildValues();
      expect(childValues).toEqual(['child1', 'child2', 'child3']);
    });

    test('should preserve existing witnesses when adding child', () => {
      const nodeWithWitness = rootNode.withAddedWitness('witness1');
      const nodeWithChild = nodeWithWitness.withAddedChild('child1');
      
      expect(nodeWithChild.getWitnessCount()).toBe(1);
      expect(nodeWithChild.hasWitness('witness1')).toBe(true);
      expect(nodeWithChild.getChildCount()).toBe(1);
    });

    test('should fail fast on invalid child value', () => {
      // Note: null/undefined are valid values in trie nodes, so test other invalid cases
      expect(() => rootNode.withAddedChild()).toThrow('Child value is required');
    });
  });

  describe('withUpdatedChild() - Pure Function', () => {
    let nodeWithChild;
    let originalChild;

    beforeEach(() => {
      nodeWithChild = rootNode.withAddedChild('childValue');
      originalChild = nodeWithChild.getChild('childValue');
    });

    test('should return new node with updated child', () => {
      const updatedChild = originalChild.withAddedWitness('testWitness');
      const newNode = nodeWithChild.withUpdatedChild('childValue', updatedChild);
      
      // Should return new instance
      expect(newNode).not.toBe(nodeWithChild);
      expect(newNode).toBeInstanceOf(ImmutableTrieNode);
      
      // Original node unchanged
      expect(nodeWithChild.getChild('childValue')).toBe(originalChild);
      expect(nodeWithChild.getChild('childValue').getWitnessCount()).toBe(0);
      
      // New node has updated child
      expect(newNode.getChild('childValue')).toBe(updatedChild);
      expect(newNode.getChild('childValue').getWitnessCount()).toBe(1);
      
      // Both should be frozen
      expect(Object.isFrozen(nodeWithChild)).toBe(true);
      expect(Object.isFrozen(newNode)).toBe(true);
    });

    test('should fail when updating non-existent child', () => {
      const newChild = new ImmutableTrieNode('nonExistent', 1);
      expect(() => nodeWithChild.withUpdatedChild('nonExistent', newChild))
        .toThrow('Child nonExistent does not exist');
    });

    test('should fail when child value mismatch', () => {
      const wrongChild = new ImmutableTrieNode('wrongValue', 1);
      expect(() => nodeWithChild.withUpdatedChild('childValue', wrongChild))
        .toThrow('Child value mismatch');
    });

    test('should fail when child depth mismatch', () => {
      const wrongDepthChild = new ImmutableTrieNode('childValue', 999);
      expect(() => nodeWithChild.withUpdatedChild('childValue', wrongDepthChild))
        .toThrow('Child depth mismatch');
    });

    test('should preserve other children when updating one', () => {
      const nodeWith2Children = nodeWithChild.withAddedChild('child2');
      const updatedChild = originalChild.withAddedWitness('witness');
      const newNode = nodeWith2Children.withUpdatedChild('childValue', updatedChild);
      
      expect(newNode.getChildCount()).toBe(2);
      expect(newNode.hasChild('child2')).toBe(true);
      expect(newNode.getChild('child2')).toBe(nodeWith2Children.getChild('child2'));
    });
  });

  describe('withAddedWitness() - Pure Function', () => {
    test('should return new node with added witness', () => {
      const newNode = rootNode.withAddedWitness('witness1');
      
      // Should return new instance
      expect(newNode).not.toBe(rootNode);
      expect(newNode).toBeInstanceOf(ImmutableTrieNode);
      
      // Original node unchanged
      expect(rootNode.getWitnessCount()).toBe(0);
      expect(rootNode.hasWitness('witness1')).toBe(false);
      
      // New node has witness
      expect(newNode.getWitnessCount()).toBe(1);
      expect(newNode.hasWitness('witness1')).toBe(true);
      
      // Both should be frozen
      expect(Object.isFrozen(rootNode)).toBe(true);
      expect(Object.isFrozen(newNode)).toBe(true);
    });

    test('should return same instance when adding duplicate witness', () => {
      const nodeWithWitness = rootNode.withAddedWitness('witness1');
      const nodeWithDuplicate = nodeWithWitness.withAddedWitness('witness1');
      
      // Should return same instance (optimization)
      expect(nodeWithDuplicate).toBe(nodeWithWitness);
      expect(nodeWithDuplicate.getWitnessCount()).toBe(1);
    });

    test('should handle multiple witnesses correctly', () => {
      const node1 = rootNode.withAddedWitness('witness1');
      const node2 = node1.withAddedWitness('witness2');
      const node3 = node2.withAddedWitness('witness3');
      
      expect(node3.getWitnessCount()).toBe(3);
      expect(node3.hasWitness('witness1')).toBe(true);
      expect(node3.hasWitness('witness2')).toBe(true);
      expect(node3.hasWitness('witness3')).toBe(true);
    });

    test('should preserve existing children when adding witness', () => {
      const nodeWithChild = rootNode.withAddedChild('child1');
      const nodeWithWitness = nodeWithChild.withAddedWitness('witness1');
      
      expect(nodeWithWitness.getChildCount()).toBe(1);
      expect(nodeWithWitness.hasChild('child1')).toBe(true);
      expect(nodeWithWitness.getWitnessCount()).toBe(1);
    });

    test('should fail fast on invalid witness', () => {
      expect(() => rootNode.withAddedWitness(null)).toThrow('Witness is required');
      expect(() => rootNode.withAddedWitness(undefined)).toThrow('Witness is required');
    });
  });

  describe('withRemovedWitness() - Pure Function', () => {
    let nodeWithWitness;

    beforeEach(() => {
      nodeWithWitness = rootNode.withAddedWitness('witness1');
    });

    test('should return new node with removed witness', () => {
      const newNode = nodeWithWitness.withRemovedWitness('witness1');
      
      // Should return new instance
      expect(newNode).not.toBe(nodeWithWitness);
      expect(newNode).toBeInstanceOf(ImmutableTrieNode);
      
      // Original node unchanged
      expect(nodeWithWitness.getWitnessCount()).toBe(1);
      expect(nodeWithWitness.hasWitness('witness1')).toBe(true);
      
      // New node has witness removed
      expect(newNode.getWitnessCount()).toBe(0);
      expect(newNode.hasWitness('witness1')).toBe(false);
      
      // Both should be frozen
      expect(Object.isFrozen(nodeWithWitness)).toBe(true);
      expect(Object.isFrozen(newNode)).toBe(true);
    });

    test('should return same instance when removing non-existent witness', () => {
      const result = nodeWithWitness.withRemovedWitness('nonExistent');
      
      // Should return same instance (optimization)
      expect(result).toBe(nodeWithWitness);
    });

    test('should handle partial removal correctly', () => {
      const nodeWith2Witnesses = nodeWithWitness.withAddedWitness('witness2');
      const nodeAfterRemoval = nodeWith2Witnesses.withRemovedWitness('witness1');
      
      expect(nodeAfterRemoval.getWitnessCount()).toBe(1);
      expect(nodeAfterRemoval.hasWitness('witness2')).toBe(true);
      expect(nodeAfterRemoval.hasWitness('witness1')).toBe(false);
    });

    test('should preserve children when removing witness', () => {
      const nodeWithBoth = nodeWithWitness.withAddedChild('child1');
      const nodeAfterRemoval = nodeWithBoth.withRemovedWitness('witness1');
      
      expect(nodeAfterRemoval.getChildCount()).toBe(1);
      expect(nodeAfterRemoval.hasChild('child1')).toBe(true);
      expect(nodeAfterRemoval.getWitnessCount()).toBe(0);
    });

    test('should fail fast on invalid witness', () => {
      expect(() => nodeWithWitness.withRemovedWitness(null)).toThrow('Witness is required');
      expect(() => nodeWithWitness.withRemovedWitness(undefined)).toThrow('Witness is required');
    });
  });

  describe('withLeafMarking() - Pure Function', () => {
    test('should return new node marked as leaf', () => {
      const newNode = rootNode.withLeafMarking(true);
      
      // Should return new instance
      expect(newNode).not.toBe(rootNode);
      expect(newNode).toBeInstanceOf(ImmutableTrieNode);
      
      // Original node unchanged
      expect(rootNode.isLeaf).toBe(false);
      
      // New node is marked as leaf
      expect(newNode.isLeaf).toBe(true);
      
      // Both should be frozen
      expect(Object.isFrozen(rootNode)).toBe(true);
      expect(Object.isFrozen(newNode)).toBe(true);
    });

    test('should return same instance when marking is unchanged', () => {
      const result1 = rootNode.withLeafMarking(false);
      expect(result1).toBe(rootNode);
      
      const leafNode = rootNode.withLeafMarking(true);
      const result2 = leafNode.withLeafMarking(true);
      expect(result2).toBe(leafNode);
    });

    test('should preserve children and witnesses when marking as leaf', () => {
      const complexNode = rootNode
        .withAddedChild('child1')
        .withAddedWitness('witness1');
      
      const leafNode = complexNode.withLeafMarking(true);
      
      expect(leafNode.isLeaf).toBe(true);
      expect(leafNode.getChildCount()).toBe(1);
      expect(leafNode.getWitnessCount()).toBe(1);
    });
  });

  describe('Read-only Accessors', () => {
    let complexNode;

    beforeEach(() => {
      complexNode = rootNode
        .withAddedChild('child1')
        .withAddedChild('child2')
        .withAddedWitness('witness1')
        .withAddedWitness('witness2')
        .withLeafMarking(true);
    });

    test('should provide basic property access', () => {
      expect(complexNode.value).toBe(null);
      expect(complexNode.depth).toBe(0);
      expect(complexNode.isLeaf).toBe(true);
    });

    test('should provide child access methods', () => {
      expect(complexNode.getChildCount()).toBe(2);
      expect(complexNode.hasChildren()).toBe(true);
      expect(complexNode.hasChild('child1')).toBe(true);
      expect(complexNode.hasChild('nonExistent')).toBe(false);
      
      const child = complexNode.getChild('child1');
      expect(child).toBeInstanceOf(ImmutableTrieNode);
      expect(child.value).toBe('child1');
    });

    test('should provide sorted child values', () => {
      const childValues = complexNode.getChildValues();
      expect(childValues).toEqual(['child1', 'child2']);
      expect(Array.isArray(childValues)).toBe(true);
    });

    test('should provide immutable children map', () => {
      const children = complexNode.getAllChildren();
      expect(children).toBeInstanceOf(Map);
      expect(children.size).toBe(2);
      expect(Object.isFrozen(children)).toBe(true);
      expect(() => children.set('test', 'value')).toThrow();
    });

    test('should provide witness access methods', () => {
      expect(complexNode.getWitnessCount()).toBe(2);
      expect(complexNode.hasWitnesses()).toBe(true);
      expect(complexNode.hasWitness('witness1')).toBe(true);
      expect(complexNode.hasWitness('nonExistent')).toBe(false);
      
      const witnesses = complexNode.getWitnesses();
      expect(Array.isArray(witnesses)).toBe(true);
      expect(witnesses.length).toBe(2);
      expect(witnesses).toContain('witness1');
      expect(witnesses).toContain('witness2');
    });

    test('should provide leapfrog navigation methods', () => {
      // Test seeking
      const child1 = complexNode.seekChild('child1');
      expect(child1).toBe(complexNode.getChild('child1'));
      
      const child2OrNext = complexNode.seekChild('child1.5');
      expect(child2OrNext).toBe(complexNode.getChild('child2'));
      
      // Test min/max
      expect(complexNode.getMinChildValue()).toBe('child1');
      expect(complexNode.getMaxChildValue()).toBe('child2');
      
      // Test next
      expect(complexNode.getNextChildValue('child1')).toBe('child2');
      expect(complexNode.getNextChildValue('child2')).toBe(null);
    });

    test('should support removal check', () => {
      // Complex node should not be removable (has children and witnesses)
      expect(complexNode.canBeRemoved()).toBe(false);
      
      // Empty non-leaf node should be removable
      expect(rootNode.canBeRemoved()).toBe(true);
      
      // Leaf node should not be removable
      const leafOnly = rootNode.withLeafMarking(true);
      expect(leafOnly.canBeRemoved()).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty node correctly', () => {
      expect(rootNode.getChildValues()).toEqual([]);
      expect(rootNode.getWitnesses()).toEqual([]);
      expect(rootNode.getAllChildren().size).toBe(0);
      expect(rootNode.seekChild('anything')).toBe(null);
      expect(rootNode.getMinChildValue()).toBe(null);
      expect(rootNode.getMaxChildValue()).toBe(null);
      expect(rootNode.getNextChildValue('anything')).toBe(null);
    });

    test('should handle complex values in children', () => {
      const complexValue = { id: 123, name: 'test' };
      const arrayValue = [1, 2, 3];
      
      const node = rootNode
        .withAddedChild(complexValue)
        .withAddedChild(arrayValue);
      
      expect(node.getChildCount()).toBe(2);
      expect(node.hasChild(complexValue)).toBe(true);
      expect(node.hasChild(arrayValue)).toBe(true);
    });

    test('should fail fast on invalid constructor parameters', () => {
      expect(() => new ImmutableTrieNode('value', 'invalid')).toThrow();
      expect(() => new ImmutableTrieNode('value', 1, 'invalid')).toThrow();
      expect(() => new ImmutableTrieNode('value', 1, new Map(), 'invalid')).toThrow();
      expect(() => new ImmutableTrieNode('value', 1, new Map(), new Set(), 'invalid')).toThrow();
    });

    test('should provide meaningful string representation', () => {
      const testNode = rootNode
        .withAddedChild('child1')
        .withAddedChild('child2')
        .withAddedWitness('witness1')
        .withAddedWitness('witness2')
        .withLeafMarking(true);
      
      const str = testNode.toString();
      expect(str).toContain('ImmutableTrieNode');
      expect(str).toContain('children=2');
      expect(str).toContain('witnesses=2');
      expect(str).toContain('[LEAF]');
    });
  });

  describe('Value Comparison and Sorting', () => {
    test('should sort numeric values correctly', () => {
      const node = rootNode
        .withAddedChild(3)
        .withAddedChild(1)
        .withAddedChild(2);
      
      expect(node.getChildValues()).toEqual([1, 2, 3]);
    });

    test('should sort string values correctly', () => {
      const node = rootNode
        .withAddedChild('zebra')
        .withAddedChild('apple')
        .withAddedChild('banana');
      
      expect(node.getChildValues()).toEqual(['apple', 'banana', 'zebra']);
    });

    test('should sort mixed types consistently', () => {
      const node = rootNode
        .withAddedChild('string')
        .withAddedChild(42)
        .withAddedChild(null)
        .withAddedChild(true);
      
      const sorted = node.getChildValues();
      
      // Numbers should come before strings
      expect(sorted.indexOf(42)).toBeLessThan(sorted.indexOf('string'));
      // null should come first
      expect(sorted[0]).toBe(null);
    });
  });
});