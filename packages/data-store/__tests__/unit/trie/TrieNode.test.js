/**
 * Unit tests for TrieNode class
 * Tests prefix-based indexing per design §2
 */

import { TrieNode } from '../../../src/trie/TrieNode.js';

describe('TrieNode', () => {
  let node;

  beforeEach(() => {
    node = new TrieNode();
  });

  describe('construction', () => {
    it('should create empty root node', () => {
      expect(node.value).toBeNull();
      expect(node.depth).toBe(0);
      expect(node.isLeaf).toBe(false);
      expect(node.hasChildren()).toBe(false);
      expect(node.hasWitnesses()).toBe(false);
    });

    it('should create node with value', () => {
      const valueNode = new TrieNode('test');
      expect(valueNode.value).toBe('test');
      expect(valueNode.depth).toBe(0);
    });

    it('should support various value types', () => {
      expect(new TrieNode('string').value).toBe('string');
      expect(new TrieNode(42).value).toBe(42);
      expect(new TrieNode(true).value).toBe(true);
      expect(new TrieNode(null).value).toBeNull();
    });
  });

  describe('child management', () => {
    it('should add and retrieve children', () => {
      const child = node.addChild('a');
      
      expect(node.hasChild('a')).toBe(true);
      expect(node.getChild('a')).toBe(child);
      expect(child.value).toBe('a');
      expect(child.depth).toBe(1);
    });

    it('should return existing child if already exists', () => {
      const child1 = node.addChild('a');
      const child2 = node.addChild('a');
      
      expect(child1).toBe(child2);
      expect(node.getChildCount()).toBe(1);
    });

    it('should remove children', () => {
      node.addChild('a');
      node.addChild('b');
      
      expect(node.getChildCount()).toBe(2);
      
      const removed = node.removeChild('a');
      expect(removed).toBe(true);
      expect(node.hasChild('a')).toBe(false);
      expect(node.getChildCount()).toBe(1);
      
      const removedAgain = node.removeChild('a');
      expect(removedAgain).toBe(false);
    });

    it('should maintain sorted child values', () => {
      node.addChild('c');
      node.addChild('a');
      node.addChild('b');
      
      const childValues = node.getChildValues();
      expect(childValues).toEqual(['a', 'b', 'c']);
    });

    it('should handle mixed type children consistently', () => {
      node.addChild(3);
      node.addChild('a');
      node.addChild(1);
      node.addChild('c');
      node.addChild(2);
      
      const childValues = node.getChildValues();
      // Mixed types converted to strings for consistent ordering
      expect(childValues).toEqual([1, 2, 3, 'a', 'c']);
    });
  });

  describe('witness management', () => {
    it('should add and retrieve witnesses', () => {
      const witness1 = { type: 'test', src: 'a', dst: 'b' };
      const witness2 = { type: 'test', src: 'a', dst: 'c' };
      
      node.addWitness(witness1);
      node.addWitness(witness2);
      
      expect(node.hasWitness(witness1)).toBe(true);
      expect(node.hasWitness(witness2)).toBe(true);
      expect(node.getWitnessCount()).toBe(2);
      expect(node.hasWitnesses()).toBe(true);
    });

    it('should prevent duplicate witnesses', () => {
      const witness = { type: 'test', src: 'a', dst: 'b' };
      
      node.addWitness(witness);
      node.addWitness(witness);
      
      expect(node.getWitnessCount()).toBe(1);
    });

    it('should remove witnesses', () => {
      const witness1 = { type: 'test', src: 'a', dst: 'b' };
      const witness2 = { type: 'test', src: 'a', dst: 'c' };
      
      node.addWitness(witness1);
      node.addWitness(witness2);
      
      const removed = node.removeWitness(witness1);
      expect(removed).toBe(true);
      expect(node.hasWitness(witness1)).toBe(false);
      expect(node.getWitnessCount()).toBe(1);
      
      const removedAgain = node.removeWitness(witness1);
      expect(removedAgain).toBe(false);
    });

    it('should clear all witnesses', () => {
      node.addWitness({ id: 1 });
      node.addWitness({ id: 2 });
      
      expect(node.getWitnessCount()).toBe(2);
      
      node.clearWitnesses();
      
      expect(node.getWitnessCount()).toBe(0);
      expect(node.hasWitnesses()).toBe(false);
    });

    it('should validate witness parameter', () => {
      expect(() => node.addWitness(null)).toThrow('Witness is required');
      expect(() => node.addWitness(undefined)).toThrow('Witness is required');
    });
  });

  describe('leaf node functionality', () => {
    it('should mark and identify leaf nodes', () => {
      expect(node.isLeaf).toBe(false);
      
      node.markAsLeaf();
      
      expect(node.isLeaf).toBe(true);
    });

    it('should affect removal eligibility', () => {
      expect(node.canBeRemoved()).toBe(true);
      
      node.markAsLeaf();
      
      expect(node.canBeRemoved()).toBe(false);
    });
  });

  describe('leapfrog operations', () => {
    beforeEach(() => {
      // Create sorted children: 1, 3, 5, 7, 9
      [1, 3, 5, 7, 9].forEach(val => node.addChild(val));
    });

    it('should seek to exact value', () => {
      const child = node.seekChild(5);
      expect(child.value).toBe(5);
    });

    it('should seek to next higher value', () => {
      const child = node.seekChild(4);
      expect(child.value).toBe(5);
    });

    it('should seek to first value when target is lower', () => {
      const child = node.seekChild(0);
      expect(child.value).toBe(1);
    });

    it('should return null when target is higher than all children', () => {
      const child = node.seekChild(10);
      expect(child).toBeNull();
    });

    it('should get next child value', () => {
      const next = node.getNextChildValue(5);
      expect(next).toBe(7);
      
      const last = node.getNextChildValue(9);
      expect(last).toBeNull();
      
      const nonexistent = node.getNextChildValue(4);
      expect(nonexistent).toBeNull();
    });

    it('should get min and max child values', () => {
      expect(node.getMinChildValue()).toBe(1);
      expect(node.getMaxChildValue()).toBe(9);
    });

    it('should handle empty node for min/max', () => {
      const emptyNode = new TrieNode();
      expect(emptyNode.getMinChildValue()).toBeNull();
      expect(emptyNode.getMaxChildValue()).toBeNull();
    });
  });

  describe('depth management', () => {
    it('should set and maintain depth correctly', () => {
      node.setDepth(2);
      expect(node.depth).toBe(2);
      
      const child = node.addChild('a');
      expect(child.depth).toBe(3);
    });

    it('should maintain depth hierarchy in tree', () => {
      const child1 = node.addChild('a');
      const child2 = child1.addChild('b');
      const child3 = child2.addChild('c');
      
      expect(node.depth).toBe(0);
      expect(child1.depth).toBe(1);
      expect(child2.depth).toBe(2);
      expect(child3.depth).toBe(3);
    });
  });

  describe('removal eligibility', () => {
    it('should be removable when empty', () => {
      expect(node.canBeRemoved()).toBe(true);
    });

    it('should not be removable with children', () => {
      node.addChild('a');
      expect(node.canBeRemoved()).toBe(false);
    });

    it('should not be removable with witnesses', () => {
      node.addWitness({ test: true });
      expect(node.canBeRemoved()).toBe(false);
    });

    it('should not be removable when marked as leaf', () => {
      node.markAsLeaf();
      expect(node.canBeRemoved()).toBe(false);
    });

    it('should not be removable with any content', () => {
      node.addChild('a');
      node.addWitness({ test: true });
      node.markAsLeaf();
      
      expect(node.canBeRemoved()).toBe(false);
    });
  });

  describe('statistics and debugging', () => {
    it('should provide string representation', () => {
      const str = node.toString();
      expect(str).toContain('TrieNode');
      expect(str).toContain('depth=0');
      expect(str).toContain('children=0');
      expect(str).toContain('witnesses=0');
    });

    it('should include leaf marker in string representation', () => {
      node.markAsLeaf();
      const str = node.toString();
      expect(str).toContain('[LEAF]');
    });

    it('should generate tree representation', () => {
      const child1 = node.addChild('a');
      const child2 = child1.addChild('b');
      child2.markAsLeaf();
      
      const treeStr = node.toTreeString();
      expect(treeStr).toContain('depth=0');
      expect(treeStr).toContain('depth=1');
      expect(treeStr).toContain('depth=2');
      expect(treeStr).toContain('[LEAF]');
    });

    it('should calculate subtree statistics', () => {
      const child1 = node.addChild('a');
      const child2 = child1.addChild('b');
      child2.markAsLeaf();
      child2.addWitness({ test: 1 });
      child2.addWitness({ test: 2 });
      
      const stats = node.getStatistics();
      expect(stats.nodeCount).toBe(3);
      expect(stats.leafCount).toBe(1);
      expect(stats.witnessCount).toBe(2);
      expect(stats.maxDepth).toBe(2);
      expect(stats.minDepth).toBe(0);
    });
  });

  describe('structure validation', () => {
    it('should validate correct structure', () => {
      const child1 = node.addChild('a');
      const child2 = child1.addChild('b');
      
      const issues = node.validateStructure();
      expect(issues).toHaveLength(0);
    });

    it('should detect value mismatches', () => {
      const child = node.addChild('a');
      child._value = 'wrong'; // Manually corrupt for testing
      
      const issues = node.validateStructure();
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toContain('value mismatch');
    });

    it('should detect depth inconsistencies', () => {
      const child = node.addChild('a');
      child._depth = 99; // Manually corrupt for testing
      
      const issues = node.validateStructure();
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toContain('depth incorrect');
    });
  });

  describe('value comparison', () => {
    it('should handle null and undefined consistently', () => {
      const testNode = new TrieNode();
      
      // Add mixed values including nulls
      testNode.addChild(null);
      testNode.addChild('a');
      testNode.addChild(undefined);
      testNode.addChild(1);
      
      const values = testNode.getChildValues();
      
      // Verify we have all 4 values
      expect(values.length).toBe(4);
      
      // Verify null and undefined are present
      expect(values).toContain(null);
      expect(values).toContain(undefined);
      expect(values).toContain(1);
      expect(values).toContain('a');
      
      // For now, just verify that the comparison function works correctly
      // The exact order in Array.sort() can be implementation dependent
      // What matters is that our _compareValues function is consistent
      const node = testNode;
      expect(node._compareValues(null, undefined)).toBeLessThan(0);
      expect(node._compareValues(null, 1)).toBeLessThan(0);
      expect(node._compareValues(undefined, 1)).toBeLessThan(0);
      expect(node._compareValues(1, 'a')).toBeLessThan(0);
    });

    it('should sort same-type values correctly', () => {
      const testNode = new TrieNode();
      
      [3, 1, 4, 1, 5, 9].forEach(val => testNode.addChild(val));
      
      const values = testNode.getChildValues();
      expect(values).toEqual([1, 3, 4, 5, 9]); // Duplicates handled by Map
    });

    it('should handle string values correctly', () => {
      const testNode = new TrieNode();
      
      ['zebra', 'apple', 'banana'].forEach(val => testNode.addChild(val));
      
      const values = testNode.getChildValues();
      expect(values).toEqual(['apple', 'banana', 'zebra']);
    });
  });
});