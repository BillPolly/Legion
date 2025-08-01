/**
 * TreeScribeModel Tests
 * 
 * Testing TreeScribeModel class with comprehensive YAML processing
 */

import { TreeScribeModel } from '../../../../../../src/components/tree-scribe/core/model/TreeScribeModel.js';

describe('TreeScribeModel', () => {
  let model;

  beforeEach(() => {
    model = new TreeScribeModel();
  });

  describe('YAML Processing', () => {
    test('should parse simple YAML document', () => {
      const yaml = `
title: Root Node
description: Root content
sections:
  - title: Child 1
    description: Child content 1
  - title: Child 2
    description: Child content 2
`;
      
      model.loadYaml(yaml);
      
      expect(model.rootNode).toBeDefined();
      expect(model.rootNode.title).toBe('Root Node');
      expect(model.rootNode.content).toBe('Root content');
      expect(model.rootNode.children).toHaveLength(2);
      expect(model.rootNode.children[0].title).toBe('Child 1');
      expect(model.rootNode.children[1].title).toBe('Child 2');
    });

    test('should handle nested structures', () => {
      const yaml = `
title: Level 1
sections:
  - title: Level 2
    subsections:
      - title: Level 3
        description: Deep content
        items:
          - title: Level 4
            description: Very deep content
`;
      
      model.loadYaml(yaml);
      
      const level2Node = model.rootNode.children[0];
      const level3Node = level2Node.children[0];
      const level4Node = level3Node.children[0];
      
      expect(level2Node.title).toBe('Level 2');
      expect(level3Node.title).toBe('Level 3');
      expect(level3Node.content).toBe('Deep content');
      expect(level3Node.getDepth()).toBe(2);
      expect(level4Node.title).toBe('Level 4');
      expect(level4Node.getDepth()).toBe(3);
    });

    test('should detect content types correctly', () => {
      const yaml = `
title: Mixed Content
sections:
  - title: Markdown Content
    description: |
      \`\`\`markdown
      # Header
      **Bold text**
      \`\`\`
  - title: Plain Content
    description: Simple text content
  - title: Structured Content
    description:
      type: yaml
      content:
        key: value
        items:
          - item1
          - item2
`;
      
      model.loadYaml(yaml);
      
      const nodes = model.rootNode.children;
      expect(nodes[0].contentType).toBe('markdown');
      expect(nodes[1].contentType).toBe('plaintext');
      expect(nodes[2].contentType).toBe('yaml');
    });

    test('should handle YAML parsing errors gracefully', () => {
      const invalidYaml = `
title: Invalid YAML
sections:
  - title: Valid
    description: Content
  - title: Invalid
    description: |
      \`\`\`
      Unclosed backticks
`;
      
      expect(() => {
        model.loadYaml(invalidYaml);
      }).not.toThrow();
      
      // Should still create some structure
      expect(model.rootNode).toBeDefined();
    });

    test('should handle empty YAML', () => {
      expect(() => {
        model.loadYaml('');
      }).not.toThrow();
      
      expect(model.rootNode).toBeDefined();
      expect(model.rootNode.title).toBe('Untitled');
    });

    test('should handle YAML with only title', () => {
      const yaml = 'title: Simple Document';
      
      model.loadYaml(yaml);
      
      expect(model.rootNode.title).toBe('Simple Document');
      expect(model.rootNode.children).toHaveLength(0);
    });
  });

  describe('Tree Operations', () => {
    beforeEach(() => {
      const yaml = `
title: Root
sections:
  - title: Section A
    id: node-a
    description: Content A
  - title: Section B
    id: node-b
    description: Content B
    subsections:
      - title: Subsection B1
        id: node-b1
        description: Content B1
      - title: Subsection B2
        id: node-b2
        description: Content B2
`;
      model.loadYaml(yaml);
    });

    test('should provide fast node lookup by ID', () => {
      const nodeA = model.getNode('node-a');
      expect(nodeA).toBeDefined();
      expect(nodeA.title).toBe('Section A');
      expect(nodeA.content).toBe('Content A');
    });

    test('should return null for non-existent node', () => {
      const nonExistent = model.getNode('non-existent');
      expect(nonExistent).toBeNull();
    });

    test('should get all nodes', () => {
      const allNodes = model.getAllNodes();
      expect(allNodes.length).toBe(5); // root + 4 content nodes
      
      const titles = allNodes.map(node => node.title);
      expect(titles).toContain('Root');
      expect(titles).toContain('Section A');
      expect(titles).toContain('Section B');
      expect(titles).toContain('Subsection B1');
      expect(titles).toContain('Subsection B2');
    });

    test('should get children of a node', () => {
      const nodeB = model.getNode('node-b');
      const children = model.getChildren('node-b');
      
      expect(children).toHaveLength(2);
      expect(children[0].title).toBe('Subsection B1');
      expect(children[1].title).toBe('Subsection B2');
      expect(children).toEqual(nodeB.children);
    });

    test('should get descendants of a node', () => {
      const descendants = model.getDescendants('node-b');
      
      expect(descendants).toHaveLength(2);
      expect(descendants[0].title).toBe('Subsection B1');
      expect(descendants[1].title).toBe('Subsection B2');
    });

    test('should get path from root to node', () => {
      const path = model.getPathToNode('node-b1');
      
      expect(path).toHaveLength(3);
      expect(path[0].title).toBe('Root');
      expect(path[1].title).toBe('Section B');
      expect(path[2].title).toBe('Subsection B1');
    });

    test('should return empty path for non-existent node', () => {
      const path = model.getPathToNode('non-existent');
      expect(path).toEqual([]);
    });

    test('should return path with just root for root node', () => {
      const path = model.getPathToNode(model.rootNode.id);
      expect(path).toHaveLength(1);
      expect(path[0]).toBe(model.rootNode);
    });
  });

  describe('Event System', () => {
    test('should emit modelChanged event on load', () => {
      let eventFired = false;
      let eventData = null;
      
      model.on('modelChanged', (data) => {
        eventFired = true;
        eventData = data;
      });
      
      const yaml = 'title: Test Document';
      model.loadYaml(yaml);
      
      expect(eventFired).toBe(true);
      expect(eventData).toBeDefined();
      expect(eventData.type).toBe('loaded');
      expect(eventData.rootNode).toBe(model.rootNode);
    });

    test('should support multiple event listeners', () => {
      let listener1Called = false;
      let listener2Called = false;
      
      model.on('modelChanged', () => { listener1Called = true; });
      model.on('modelChanged', () => { listener2Called = true; });
      
      model.loadYaml('title: Test');
      
      expect(listener1Called).toBe(true);
      expect(listener2Called).toBe(true);
    });

    test('should support event listener removal', () => {
      let listenerCalled = false;
      
      const removeListener = model.on('modelChanged', () => { 
        listenerCalled = true; 
      });
      
      removeListener(); // Remove listener
      model.loadYaml('title: Test');
      
      expect(listenerCalled).toBe(false);
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      const yaml = `
title: Export Test
sections:
  - title: Section 1
    description: Content 1
  - title: Section 2
    description: Content 2
`;
      model.loadYaml(yaml);
    });

    test('should export to JSON', () => {
      const json = model.exportJson();
      
      expect(json).toBeDefined();
      expect(json.title).toBe('Export Test');
      expect(json.children).toHaveLength(2);
      expect(json.children[0].title).toBe('Section 1');
      expect(json.children[1].title).toBe('Section 2');
    });

    test('should include metadata in JSON export', () => {
      // Add some metadata
      model.rootNode.metadata = { author: 'Test Author', version: '1.0' };
      
      const json = model.exportJson();
      
      expect(json.metadata).toBeDefined();
      expect(json.metadata.author).toBe('Test Author');
      expect(json.metadata.version).toBe('1.0');
    });
  });

  describe('Cleanup', () => {
    test('should clean up properly on destroy', () => {
      const yaml = 'title: Test Document';
      model.loadYaml(yaml);
      
      expect(model.rootNode).toBeDefined();
      expect(model.nodeIndex.size).toBeGreaterThan(0);
      
      model.destroy();
      
      expect(model.rootNode).toBeNull();
      expect(model.nodeIndex.size).toBe(0);
    });
  });
});