/**
 * TreeNode Tests
 * 
 * Testing TreeNode class with comprehensive coverage
 */

import { TreeNode } from '../../../../../../src/components/tree-scribe/core/model/TreeNode.js';

describe('TreeNode', () => {
  describe('Constructor', () => {
    test('should create node with required fields', () => {
      const data = {
        title: 'Test Node',
        description: 'Test content'
      };
      
      const node = new TreeNode(data);
      
      expect(node.title).toBe('Test Node');
      expect(node.content).toBe('Test content');
      expect(node.id).toBeDefined();
      expect(node.children).toEqual([]);
      expect(node.parent).toBeNull();
      expect(node.state).toBeDefined();
    });
    
    test('should use provided ID', () => {
      const data = {
        id: 'custom-id',
        title: 'Test Node'
      };
      
      const node = new TreeNode(data);
      
      expect(node.id).toBe('custom-id');
    });
    
    test('should generate ID if not provided', () => {
      const data = {
        title: 'Test Node'
      };
      
      const node = new TreeNode(data);
      
      expect(node.id).toBeDefined();
      expect(typeof node.id).toBe('string');
      expect(node.id.length).toBeGreaterThan(0);
    });
    
    test('should handle content field as alias for description', () => {
      const data = {
        title: 'Test Node',
        content: 'Test content via content field'
      };
      
      const node = new TreeNode(data);
      
      expect(node.content).toBe('Test content via content field');
    });
    
    test('should initialize state correctly', () => {
      const data = {
        title: 'Test Node'
      };
      
      const node = new TreeNode(data);
      
      expect(node.state).toEqual({
        expanded: false,
        visible: true,
        searchHighlight: false
      });
    });
    
    test('should store metadata', () => {
      const metadata = { author: 'Test Author', date: '2023-01-01' };
      const data = {
        title: 'Test Node',
        metadata
      };
      
      const node = new TreeNode(data);
      
      expect(node.metadata).toEqual(metadata);
    });
  });
  
  describe('Content Type Detection', () => {
    test('should detect plaintext content by default', () => {
      const node = new TreeNode({
        title: 'Test',
        description: 'Plain text content'
      });
      
      expect(node.contentType).toBe('plaintext');
    });
    
    test('should detect markdown directive', () => {
      const node = new TreeNode({
        title: 'Test',
        description: '```markdown\n# Header\n**Bold**\n```'
      });
      
      expect(node.contentType).toBe('markdown');
    });
    
    test('should detect javascript directive', () => {
      const node = new TreeNode({
        title: 'Test',
        description: '```javascript\nconsole.log("hello");\n```'
      });
      
      expect(node.contentType).toBe('javascript');
    });
    
    test('should detect yaml directive', () => {
      const node = new TreeNode({
        title: 'Test',
        description: '```yaml\nkey: value\n```'
      });
      
      expect(node.contentType).toBe('yaml');
    });
    
    test('should detect object-based type', () => {
      const node = new TreeNode({
        title: 'Test',
        description: {
          type: 'chart',
          content: { data: [] }
        }
      });
      
      expect(node.contentType).toBe('chart');
    });
    
    test('should default to yaml for structured objects without type', () => {
      const node = new TreeNode({
        title: 'Test',
        description: {
          data: { key: 'value' }
        }
      });
      
      expect(node.contentType).toBe('yaml');
    });
  });
  
  describe('Tree Navigation', () => {
    let rootNode, childNode, grandChildNode;
    
    beforeEach(() => {
      rootNode = new TreeNode({ title: 'Root' });
      childNode = new TreeNode({ title: 'Child' });
      grandChildNode = new TreeNode({ title: 'Grandchild' });
      
      // Build tree structure
      childNode.parent = rootNode;
      rootNode.children.push(childNode);
      
      grandChildNode.parent = childNode;
      childNode.children.push(grandChildNode);
    });
    
    test('should calculate depth correctly', () => {
      expect(rootNode.getDepth()).toBe(0);
      expect(childNode.getDepth()).toBe(1);
      expect(grandChildNode.getDepth()).toBe(2);
    });
    
    test('should identify root node', () => {
      expect(rootNode.isRoot()).toBe(true);
      expect(childNode.isRoot()).toBe(false);
      expect(grandChildNode.isRoot()).toBe(false);
    });
    
    test('should identify leaf node', () => {
      expect(rootNode.isLeaf()).toBe(false);
      expect(childNode.isLeaf()).toBe(false);
      expect(grandChildNode.isLeaf()).toBe(true);
    });
    
    test('should get siblings correctly', () => {
      const sibling1 = new TreeNode({ title: 'Sibling1' });
      const sibling2 = new TreeNode({ title: 'Sibling2' });
      
      sibling1.parent = rootNode;
      sibling2.parent = rootNode;
      rootNode.children.push(sibling1, sibling2);
      
      const siblings = childNode.getSiblings();
      expect(siblings).toHaveLength(2);
      expect(siblings).toContain(sibling1);
      expect(siblings).toContain(sibling2);
      expect(siblings).not.toContain(childNode);
    });
    
    test('should return empty array for root siblings', () => {
      const siblings = rootNode.getSiblings();
      expect(siblings).toEqual([]);
    });
  });
  
  describe('State Management', () => {
    let node;
    
    beforeEach(() => {
      node = new TreeNode({ title: 'Test Node' });
    });
    
    test('should update state', () => {
      const newState = {
        expanded: true,
        visible: false,
        searchHighlight: true
      };
      
      node.setState(newState);
      
      expect(node.state.expanded).toBe(true);
      expect(node.state.visible).toBe(false);
      expect(node.state.searchHighlight).toBe(true);
    });
    
    test('should merge state updates', () => {
      node.setState({ expanded: true });
      
      expect(node.state.expanded).toBe(true);
      expect(node.state.visible).toBe(true); // Should remain unchanged
      expect(node.state.searchHighlight).toBe(false); // Should remain unchanged
    });
    
    test('should get current state', () => {
      node.setState({ expanded: true });
      
      const state = node.getState();
      
      expect(state).toEqual({
        expanded: true,
        visible: true,
        searchHighlight: false
      });
      
      // Should return a copy, not reference
      state.expanded = false;
      expect(node.state.expanded).toBe(true);
    });
  });
});