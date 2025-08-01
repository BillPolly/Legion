/**
 * HierarchyNode Tests
 */
import { createTestNode, createTestHierarchy } from '../../test-helpers.js';

describe('HierarchyNode', () => {
  
  describe('Node Creation', () => {
    test('should create node with default properties', () => {
      const node = createTestNode();
      
      expect(node.id).toBeDefined();
      expect(typeof node.id).toBe('string');
      expect(node.type).toBe('value');
      expect(node.name).toBe('test');
      expect(node.value).toBe('testValue');
      expect(Array.isArray(node.children)).toBe(true);
      expect(node.children.length).toBe(0);
      expect(typeof node.metadata).toBe('object');
      expect(node.parent).toBeNull();
    });

    test('should create node with custom properties', () => {
      const node = createTestNode('object', 'customName', null);
      
      expect(node.type).toBe('object');
      expect(node.name).toBe('customName');
      expect(node.value).toBeNull();
    });

    test('should generate unique IDs', () => {
      const node1 = createTestNode();
      const node2 = createTestNode();
      
      expect(node1.id).not.toBe(node2.id);
    });
  });

  describe('Node ID Generation', () => {
    test('should generate IDs with correct format', () => {
      const node = createTestNode();
      
      expect(node.id).toMatch(/^node-[a-z0-9]{9}$/);
    });

    test('should generate different IDs for different nodes', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        const node = createTestNode();
        ids.add(node.id);
      }
      
      expect(ids.size).toBe(100); // All IDs should be unique
    });
  });

  describe('Parent-Child Relationships', () => {
    test('should establish parent-child relationships', () => {
      const hierarchy = createTestHierarchy();
      
      expect(hierarchy.children.length).toBe(2);
      expect(hierarchy.children[0].parent).toBe(hierarchy);
      expect(hierarchy.children[1].parent).toBe(hierarchy);
    });

    test('should maintain bidirectional relationships', () => {
      const parent = createTestNode('object', 'parent', null);
      const child1 = createTestNode('value', 'child1', 'value1');
      const child2 = createTestNode('value', 'child2', 'value2');
      
      child1.parent = parent;
      child2.parent = parent;
      parent.children = [child1, child2];
      
      expect(parent.children.length).toBe(2);
      expect(parent.children[0]).toBe(child1);
      expect(parent.children[1]).toBe(child2);
      expect(child1.parent).toBe(parent);
      expect(child2.parent).toBe(parent);
    });

    test('should handle nested hierarchies', () => {
      const root = createTestNode('object', 'root', null);
      const level1 = createTestNode('object', 'level1', null);
      const level2 = createTestNode('value', 'level2', 'deepValue');
      
      level2.parent = level1;
      level1.children = [level2];
      level1.parent = root;
      root.children = [level1];
      
      expect(root.children[0]).toBe(level1);
      expect(level1.children[0]).toBe(level2);
      expect(level2.parent).toBe(level1);
      expect(level1.parent).toBe(root);
    });
  });

  describe('Node Types', () => {
    test('should support value type nodes', () => {
      const node = createTestNode('value', 'stringValue', 'hello');
      
      expect(node.type).toBe('value');
      expect(node.value).toBe('hello');
    });

    test('should support object type nodes', () => {
      const node = createTestNode('object', 'objNode', null);
      
      expect(node.type).toBe('object');
      expect(node.value).toBeNull();
      expect(Array.isArray(node.children)).toBe(true);
    });

    test('should support array type nodes', () => {
      const node = createTestNode('array', 'arrayNode', null);
      
      expect(node.type).toBe('array');
      expect(node.value).toBeNull();
      expect(Array.isArray(node.children)).toBe(true);
    });
  });

  describe('Node Metadata', () => {
    test('should support metadata storage', () => {
      const node = createTestNode();
      node.metadata.customProperty = 'customValue';
      node.metadata.formatSpecific = { type: 'json', indentation: 2 };
      
      expect(node.metadata.customProperty).toBe('customValue');
      expect(node.metadata.formatSpecific.type).toBe('json');
      expect(node.metadata.formatSpecific.indentation).toBe(2);
    });

    test('should preserve metadata through operations', () => {
      const node = createTestNode();
      node.metadata.important = true;
      
      const serialized = JSON.stringify(node);
      const deserialized = JSON.parse(serialized);
      
      expect(deserialized.metadata.important).toBe(true);
    });
  });

  describe('Hierarchy Traversal', () => {
    test('should support depth traversal', () => {
      const hierarchy = createTestHierarchy();
      const nodes = [];
      
      function traverse(node, depth = 0) {
        nodes.push({ node, depth });
        if (node.children) {
          node.children.forEach(child => traverse(child, depth + 1));
        }
      }
      
      traverse(hierarchy);
      
      expect(nodes.length).toBe(3); // root + 2 children
      expect(nodes[0].depth).toBe(0); // root
      expect(nodes[1].depth).toBe(1); // first child
      expect(nodes[2].depth).toBe(1); // second child
    });

    test('should find nodes by ID', () => {
      const hierarchy = createTestHierarchy();
      const childId = hierarchy.children[0].id;
      
      function findNode(node, targetId) {
        if (node.id === targetId) return node;
        if (node.children) {
          for (const child of node.children) {
            const found = findNode(child, targetId);
            if (found) return found;
          }
        }
        return null;
      }
      
      const found = findNode(hierarchy, childId);
      expect(found).toBe(hierarchy.children[0]);
    });
  });

  describe('Node Validation', () => {
    test('should validate required properties', () => {
      const node = createTestNode();
      
      expect(node.id).toBeTruthy();
      expect(node.type).toBeTruthy();
      expect(node.name).toBeDefined();
      expect(node.children).toBeDefined();
      expect(node.metadata).toBeDefined();
    });

    test('should handle edge cases', () => {
      const node = createTestNode('value', '', 0);
      
      expect(node.name).toBe('');
      expect(node.value).toBe(0);
      
      const nullNode = createTestNode('value', 'nullValue', null);
      expect(nullNode.value).toBeNull();
      
      // Create node with explicitly undefined value
      const undefinedNode = {
        id: 'node-test-undefined',
        type: 'value',
        name: 'undefinedValue',
        value: undefined,
        children: [],
        metadata: {},
        parent: null
      };
      expect(undefinedNode.value).toBeUndefined();
    });
  });
});