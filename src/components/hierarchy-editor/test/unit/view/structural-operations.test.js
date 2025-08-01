/**
 * Structural Operations Tests
 */
import { createTestContainer, cleanupTestContainer, createTestNode, createTestHierarchy } from '../../test-helpers.js';

describe('Structural Operations', () => {
  let HierarchyTreeView;
  let container;
  let treeView;
  let testHierarchy;

  beforeEach(async () => {
    const module = await import('../../../view/HierarchyTreeView.js');
    HierarchyTreeView = module.HierarchyTreeView;
    
    container = createTestContainer();
    treeView = new HierarchyTreeView(container);
    testHierarchy = createTestHierarchy();
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  describe('Node Addition', () => {
    test('should add child node to object', () => {
      const objectNode = createTestNode('object', 'parent', null);
      const element = treeView.renderNode(objectNode);
      container.appendChild(element);

      let addedNodeData = null;
      treeView.on('nodeAdded', (data) => {
        addedNodeData = data;
      });

      const newNodeData = {
        type: 'value',
        name: 'newKey',
        value: 'newValue'
      };

      const success = treeView.addChildNode(objectNode.id, newNodeData, element);
      
      expect(success).toBe(true);
      expect(addedNodeData).toBeDefined();
      expect(addedNodeData.parentId).toBe(objectNode.id);
      expect(addedNodeData.nodeData.name).toBe('newKey');
      expect(addedNodeData.nodeData.value).toBe('newValue');
    });

    test('should add child node to array', () => {
      const arrayNode = createTestNode('array', 'items', null);
      const element = treeView.renderNode(arrayNode);
      container.appendChild(element);

      let addedNodeData = null;
      treeView.on('nodeAdded', (data) => {
        addedNodeData = data;
      });

      const newNodeData = {
        type: 'value',
        name: '0', // Array index
        value: 'arrayItem'
      };

      const success = treeView.addChildNode(arrayNode.id, newNodeData, element);
      
      expect(success).toBe(true);
      expect(addedNodeData).toBeDefined();
      expect(addedNodeData.parentId).toBe(arrayNode.id);
      expect(addedNodeData.nodeData.name).toBe('0');
    });

    test('should prevent adding child to value nodes', () => {
      const valueNode = createTestNode('value', 'leaf', 'leafValue');
      const element = treeView.renderNode(valueNode);
      container.appendChild(element);

      let addedNodeData = null;
      treeView.on('nodeAdded', (data) => {
        addedNodeData = data;
      });

      const newNodeData = {
        type: 'value',
        name: 'invalid',
        value: 'invalid'
      };

      const success = treeView.addChildNode(valueNode.id, newNodeData, element);
      
      expect(success).toBe(false);
      expect(addedNodeData).toBeNull();
    });

    test('should assign node ID during addition', () => {
      const objectNode = createTestNode('object', 'parent', null);
      const element = treeView.renderNode(objectNode);
      container.appendChild(element);

      let addedNodeData = null;
      treeView.on('nodeAdded', (data) => {
        addedNodeData = data;
      });

      const newNodeData = {
        type: 'value',
        name: 'autoId',
        value: 'autoValue'
        // No ID provided
      };

      treeView.addChildNode(objectNode.id, newNodeData, element);
      
      expect(addedNodeData.nodeData.id).toBeDefined();
      expect(typeof addedNodeData.nodeData.id).toBe('string');
      expect(addedNodeData.nodeData.id).toMatch(/^node-/);
    });

    test('should establish parent-child links', () => {
      const objectNode = createTestNode('object', 'parent', null);
      const element = treeView.renderNode(objectNode);
      container.appendChild(element);

      let addedNodeData = null;
      treeView.on('nodeAdded', (data) => {
        addedNodeData = data;
      });

      const newNodeData = {
        type: 'value',
        name: 'child',
        value: 'childValue'
      };

      treeView.addChildNode(objectNode.id, newNodeData, element);
      
      expect(addedNodeData.parentNode).toBe(objectNode);
      expect(addedNodeData.nodeData.parent).toBe(objectNode);
    });

    test('should handle sibling node addition', () => {
      const parent = createTestNode('object', 'parent', null);
      const child1 = createTestNode('value', 'child1', 'value1');
      child1.parent = parent;
      parent.children = [child1];

      const parentElement = treeView.renderNode(parent);
      container.appendChild(parentElement);

      let addedNodeData = null;
      treeView.on('nodeAdded', (data) => {
        addedNodeData = data;
      });

      const newSiblingData = {
        type: 'value',
        name: 'child2',
        value: 'value2'
      };

      const success = treeView.addSiblingNode(child1.id, newSiblingData, 'after');
      
      expect(success).toBe(true);
      expect(addedNodeData).toBeDefined();
      expect(addedNodeData.parentId).toBe(parent.id);
      expect(addedNodeData.position).toBe(1); // After child1
    });

    test('should handle different sibling positions', () => {
      const parent = createTestNode('object', 'parent', null);
      const child1 = createTestNode('value', 'child1', 'value1');
      const child2 = createTestNode('value', 'child2', 'value2');
      
      child1.parent = parent;
      child2.parent = parent;
      parent.children = [child1, child2];

      const parentElement = treeView.renderNode(parent);
      container.appendChild(parentElement);

      let addedNodeData = null;
      treeView.on('nodeAdded', (data) => {
        addedNodeData = data;
      });

      const newSiblingData = {
        type: 'value',
        name: 'child0',
        value: 'value0'
      };

      // Add before child1
      const success = treeView.addSiblingNode(child1.id, newSiblingData, 'before');
      
      expect(success).toBe(true);
      expect(addedNodeData.position).toBe(0); // Before child1
    });
  });

  describe('Node Removal', () => {
    test('should remove leaf node', () => {
      const parent = createTestNode('object', 'parent', null);
      const child = createTestNode('value', 'child', 'childValue');
      
      child.parent = parent;
      parent.children = [child];

      const parentElement = treeView.renderNode(parent);
      container.appendChild(parentElement);

      let removedNodeData = null;
      treeView.on('nodeRemoved', (data) => {
        removedNodeData = data;
      });

      const success = treeView.removeNode(child.id);
      
      expect(success).toBe(true);
      expect(removedNodeData).toBeDefined();
      expect(removedNodeData.nodeId).toBe(child.id);
      expect(removedNodeData.parentId).toBe(parent.id);
      expect(removedNodeData.removedNode).toBe(child);
    });

    test('should remove parent node with cascade', () => {
      const parent = createTestNode('object', 'parent', null);
      const child1 = createTestNode('value', 'child1', 'value1');
      const child2 = createTestNode('value', 'child2', 'value2');
      
      child1.parent = parent;
      child2.parent = parent;
      parent.children = [child1, child2];

      const parentElement = treeView.renderNode(parent);
      container.appendChild(parentElement);

      let removedNodeData = null;
      treeView.on('nodeRemoved', (data) => {
        removedNodeData = data;
      });

      const success = treeView.removeNode(parent.id, { cascade: true });
      
      expect(success).toBe(true);
      expect(removedNodeData).toBeDefined();
      expect(removedNodeData.nodeId).toBe(parent.id);
      expect(removedNodeData.cascaded).toBe(true);
      expect(removedNodeData.childrenRemoved).toBe(2);
    });

    test('should prevent orphan creation', () => {
      const parent = createTestNode('object', 'parent', null);
      const child = createTestNode('object', 'child', null);
      const grandchild = createTestNode('value', 'grandchild', 'value');
      
      grandchild.parent = child;
      child.children = [grandchild];
      child.parent = parent;
      parent.children = [child];

      const parentElement = treeView.renderNode(parent);
      container.appendChild(parentElement);

      let removedNodeData = null;
      treeView.on('nodeRemoved', (data) => {
        removedNodeData = data;
      });

      // Try to remove parent without cascade
      const success = treeView.removeNode(child.id, { cascade: false });
      
      expect(success).toBe(false);
      expect(removedNodeData).toBeNull();
    });

    test('should handle index adjustment after removal', () => {
      const arrayNode = createTestNode('array', 'items', null);
      const item0 = createTestNode('value', '0', 'first');
      const item1 = createTestNode('value', '1', 'second');
      const item2 = createTestNode('value', '2', 'third');
      
      item0.parent = arrayNode;
      item1.parent = arrayNode;
      item2.parent = arrayNode;
      arrayNode.children = [item0, item1, item2];

      const arrayElement = treeView.renderNode(arrayNode);
      container.appendChild(arrayElement);

      let indexAdjustmentData = null;
      treeView.on('indicesAdjusted', (data) => {
        indexAdjustmentData = data;
      });

      const success = treeView.removeNode(item1.id); // Remove middle item
      
      expect(success).toBe(true);
      expect(indexAdjustmentData).toBeDefined();
      expect(indexAdjustmentData.adjustedCount).toBe(1); // item2 index changed from 2 to 1
    });

    test('should remove from DOM', () => {
      const parent = createTestNode('object', 'parent', null);
      const child = createTestNode('value', 'child', 'childValue');
      
      child.parent = parent;
      parent.children = [child];

      const parentElement = treeView.renderNode(parent);
      container.appendChild(parentElement);

      // Verify child element exists in DOM
      const childElement = parentElement.querySelector(`[data-node-id="${child.id}"]`);
      expect(childElement).toBeDefined();

      treeView.removeNode(child.id);

      // Verify child element removed from DOM
      const removedElement = parentElement.querySelector(`[data-node-id="${child.id}"]`);
      expect(removedElement).toBeNull();
    });
  });

  describe('Node Movement', () => {
    test('should move node to new parent', () => {
      const parent1 = createTestNode('object', 'parent1', null);
      const parent2 = createTestNode('object', 'parent2', null);
      const child = createTestNode('value', 'child', 'childValue');
      
      child.parent = parent1;
      parent1.children = [child];
      parent2.children = [];

      const container1 = treeView.renderNode(parent1);
      const container2 = treeView.renderNode(parent2);
      container.appendChild(container1);
      container.appendChild(container2);

      let movedNodeData = null;
      treeView.on('nodeMoved', (data) => {
        movedNodeData = data;
      });

      const success = treeView.moveNode(child.id, parent2.id);
      
      expect(success).toBe(true);
      expect(movedNodeData).toBeDefined();
      expect(movedNodeData.nodeId).toBe(child.id);
      expect(movedNodeData.oldParentId).toBe(parent1.id);
      expect(movedNodeData.newParentId).toBe(parent2.id);
    });

    test('should move node within same parent', () => {
      const parent = createTestNode('object', 'parent', null);
      const child1 = createTestNode('value', 'child1', 'value1');
      const child2 = createTestNode('value', 'child2', 'value2');
      const child3 = createTestNode('value', 'child3', 'value3');
      
      child1.parent = parent;
      child2.parent = parent;
      child3.parent = parent;
      parent.children = [child1, child2, child3];

      const parentElement = treeView.renderNode(parent);
      container.appendChild(parentElement);

      let movedNodeData = null;
      treeView.on('nodeMoved', (data) => {
        movedNodeData = data;
      });

      // Move child3 to position 0 (before child1)
      const success = treeView.moveNode(child3.id, parent.id, 0);
      
      expect(success).toBe(true);
      expect(movedNodeData).toBeDefined();
      expect(movedNodeData.oldPosition).toBe(2);
      expect(movedNodeData.newPosition).toBe(0);
    });

    test('should prevent circular reference moves', () => {
      const parent = createTestNode('object', 'parent', null);
      const child = createTestNode('object', 'child', null);
      const grandchild = createTestNode('value', 'grandchild', 'value');
      
      grandchild.parent = child;
      child.children = [grandchild];
      child.parent = parent;
      parent.children = [child];

      const parentElement = treeView.renderNode(parent);
      container.appendChild(parentElement);

      let movedNodeData = null;
      treeView.on('nodeMoved', (data) => {
        movedNodeData = data;
      });

      // Try to move parent under its own child
      const success = treeView.moveNode(parent.id, child.id);
      
      expect(success).toBe(false);
      expect(movedNodeData).toBeNull();
    });

    test('should update DOM structure after move', () => {
      const parent1 = createTestNode('object', 'parent1', null);
      const parent2 = createTestNode('object', 'parent2', null);
      const child = createTestNode('value', 'child', 'childValue');
      
      child.parent = parent1;
      parent1.children = [child];
      parent2.children = [];

      const container1 = treeView.renderNode(parent1);
      const container2 = treeView.renderNode(parent2);
      container.appendChild(container1);
      container.appendChild(container2);

      // Verify child is in parent1's DOM
      const childInParent1 = container1.querySelector(`[data-node-id="${child.id}"]`);
      expect(childInParent1).toBeDefined();

      treeView.moveNode(child.id, parent2.id);

      // Verify child moved to parent2's DOM
      const childInParent1After = container1.querySelector(`[data-node-id="${child.id}"]`);
      const childInParent2After = container2.querySelector(`[data-node-id="${child.id}"]`);
      
      expect(childInParent1After).toBeNull();
      expect(childInParent2After).toBeDefined();
    });

    test('should handle drag and drop movement', () => {
      const parent1 = createTestNode('object', 'parent1', null);
      const parent2 = createTestNode('object', 'parent2', null);
      const child = createTestNode('value', 'child', 'childValue');
      
      child.parent = parent1;
      parent1.children = [child];
      parent2.children = [];

      const container1 = treeView.renderNode(parent1);
      const container2 = treeView.renderNode(parent2);
      container.appendChild(container1);
      container.appendChild(container2);

      let dragDropData = null;
      treeView.on('dragDrop', (data) => {
        dragDropData = data;
      });

      const dragData = {
        sourceNodeId: child.id,
        targetNodeId: parent2.id,
        position: 'child',
        dropEffect: 'move'
      };

      const success = treeView.handleDragDrop(dragData);
      
      expect(success).toBe(true);
      expect(dragDropData).toBeDefined();
      expect(dragDropData.sourceNodeId).toBe(child.id);
      expect(dragDropData.targetNodeId).toBe(parent2.id);
    });
  });

  describe('Structural Validation', () => {
    test('should validate node addition constraints', () => {
      const valueNode = createTestNode('value', 'leaf', 'leafValue');
      
      // Render the node so it gets registered
      const element = treeView.renderNode(valueNode);
      container.appendChild(element);
      
      const validation = treeView.validateAddition(valueNode.id, {
        type: 'value',
        name: 'invalid',
        value: 'invalid'
      });
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Cannot add children to value nodes');
    });

    test('should validate node type compatibility', () => {
      const arrayNode = createTestNode('array', 'items', null);
      
      // Render the node so it gets registered
      const element = treeView.renderNode(arrayNode);
      container.appendChild(element);
      
      const validation = treeView.validateAddition(arrayNode.id, {
        type: 'value',
        name: 'invalidKey', // Arrays should have numeric indices
        value: 'value'
      });
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Array children must have numeric indices');
    });

    test('should validate circular references', () => {
      const parent = createTestNode('object', 'parent', null);
      const child = createTestNode('object', 'child', null);
      
      child.parent = parent;
      parent.children = [child];
      
      // Render the nodes so they get registered
      const parentElement = treeView.renderNode(parent);
      container.appendChild(parentElement);
      
      const validation = treeView.validateMove(parent.id, child.id);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Cannot create circular reference');
    });

    test('should validate duplicate keys in objects', () => {
      const objectNode = createTestNode('object', 'obj', null);
      const existingChild = createTestNode('value', 'existingKey', 'value1');
      
      existingChild.parent = objectNode;
      objectNode.children = [existingChild];
      
      // Render the node so it gets registered
      const element = treeView.renderNode(objectNode);
      container.appendChild(element);
      
      const validation = treeView.validateAddition(objectNode.id, {
        type: 'value',
        name: 'existingKey', // Duplicate key
        value: 'value2'
      });
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Duplicate key in object');
    });

    test('should allow valid structural operations', () => {
      const objectNode = createTestNode('object', 'obj', null);
      
      // Render the node so it gets registered
      const element = treeView.renderNode(objectNode);
      container.appendChild(element);
      
      const validation = treeView.validateAddition(objectNode.id, {
        type: 'value',
        name: 'validKey',
        value: 'validValue'
      });
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });
});