/**
 * Local Integration Tests for Graph Package
 *
 * Tests GraphHandle, NodeHandle, and EdgeHandle working together
 * with GraphDataSource in local (non-remote) scenarios.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { GraphDataSource, GraphHandle, NodeHandle, EdgeHandle } from '../../src/index.js';

describe('Graph Package - Local Integration', () => {
  let graphDataSource;
  let graphHandle;

  beforeEach(() => {
    const sampleGraph = {
      nodes: [
        {
          id: 'entity1',
          label: 'Knowledge Graph',
          type: 'Entity',
          data: { description: 'A graph database' },
          position: { x: 100, y: 100 }
        },
        {
          id: 'entity2',
          label: 'Semantic Web',
          type: 'Entity',
          data: { description: 'Web of linked data' },
          position: { x: 300, y: 100 }
        },
        {
          id: 'concept1',
          label: 'Ontology',
          type: 'Concept',
          data: { description: 'Formal representation' },
          position: { x: 200, y: 300 }
        }
      ],
      edges: [
        {
          id: 'rel1',
          source: 'entity1',
          target: 'entity2',
          type: 'relatesTo',
          label: 'uses'
        },
        {
          id: 'rel2',
          source: 'entity1',
          target: 'concept1',
          type: 'hasProperty',
          label: 'defines'
        },
        {
          id: 'rel3',
          source: 'entity2',
          target: 'concept1',
          type: 'hasProperty',
          label: 'requires'
        }
      ]
    };

    graphDataSource = new GraphDataSource(sampleGraph);
    graphHandle = new GraphHandle(graphDataSource);
  });

  describe('GraphHandle Operations', () => {
    it('should get all nodes', async () => {
      const nodes = await graphHandle.getNodes();
      expect(nodes).toHaveLength(3);
      expect(nodes.map(n => n.id)).toEqual(['entity1', 'entity2', 'concept1']);
    });

    it('should get all edges', async () => {
      const edges = await graphHandle.getEdges();
      expect(edges).toHaveLength(3);
      expect(edges.map(e => e.id)).toEqual(['rel1', 'rel2', 'rel3']);
    });

    it('should get specific node', async () => {
      const node = await graphHandle.getNode('entity1');
      expect(node).toBeDefined();
      expect(node.label).toBe('Knowledge Graph');
    });

    it('should get specific edge', async () => {
      const edge = await graphHandle.getEdge('rel1');
      expect(edge).toBeDefined();
      expect(edge.source).toBe('entity1');
      expect(edge.target).toBe('entity2');
    });

    it('should add new node', async () => {
      const newNode = {
        id: 'entity3',
        label: 'RDF',
        type: 'Entity',
        position: { x: 400, y: 200 }
      };

      const result = await graphHandle.addNode(newNode);
      expect(result.success).toBe(true);

      const nodes = await graphHandle.getNodes();
      expect(nodes).toHaveLength(4);

      const addedNode = await graphHandle.getNode('entity3');
      expect(addedNode.label).toBe('RDF');
    });

    it('should update node', async () => {
      await graphHandle.updateNode('entity1', {
        label: 'Updated Label',
        data: { description: 'Updated description' }
      });

      const node = await graphHandle.getNode('entity1');
      expect(node.label).toBe('Updated Label');
      expect(node.data.description).toBe('Updated description');
    });

    it('should remove node and connected edges', async () => {
      await graphHandle.removeNode('entity1');

      const nodes = await graphHandle.getNodes();
      expect(nodes).toHaveLength(2);

      // Edges connected to entity1 should also be removed
      const edges = await graphHandle.getEdges();
      expect(edges).toHaveLength(1);
      expect(edges[0].id).toBe('rel3');
    });

    it('should get connected nodes', async () => {
      const connectedNodes = await graphHandle.getConnectedNodes('entity1');
      expect(connectedNodes).toHaveLength(2);

      const connectedIds = connectedNodes.map(n => n.id).sort();
      expect(connectedIds).toEqual(['concept1', 'entity2']);
    });

    it('should get connected edges', async () => {
      const connectedEdges = await graphHandle.getConnectedEdges('entity1');
      expect(connectedEdges).toHaveLength(2);

      const edgeIds = connectedEdges.map(e => e.id).sort();
      expect(edgeIds).toEqual(['rel1', 'rel2']);
    });

    it('should get graph metadata', async () => {
      const metadata = await graphHandle.getMetadata();

      expect(metadata.nodeCount).toBe(3);
      expect(metadata.edgeCount).toBe(3);
      expect(metadata.nodeTypes).toContain('Entity');
      expect(metadata.nodeTypes).toContain('Concept');
      expect(metadata.edgeTypes).toContain('relatesTo');
    });

    it('should get graph data', async () => {
      const data = await graphHandle.getData();

      expect(data.nodes).toHaveLength(3);
      expect(data.edges).toHaveLength(3);
    });
  });

  describe('NodeHandle Drill-down', () => {
    it('should create NodeHandle for specific node', () => {
      const nodeHandle = graphHandle.nodeHandle('entity1');
      expect(nodeHandle).toBeInstanceOf(NodeHandle);
      expect(nodeHandle.nodeId).toBe('entity1');
    });

    it('should get node data via NodeHandle', async () => {
      const nodeHandle = graphHandle.nodeHandle('entity1');
      const nodeData = await nodeHandle.getData();

      expect(nodeData).toBeDefined();
      expect(nodeData.id).toBe('entity1');
      expect(nodeData.label).toBe('Knowledge Graph');
    });

    it('should update node via NodeHandle', async () => {
      const nodeHandle = graphHandle.nodeHandle('entity1');
      await nodeHandle.update({ label: 'New Label' });

      const nodeData = await nodeHandle.getData();
      expect(nodeData.label).toBe('New Label');
    });

    it('should get specific property via NodeHandle', async () => {
      const nodeHandle = graphHandle.nodeHandle('entity1');
      const label = await nodeHandle.getProperty('label');

      expect(label).toBe('Knowledge Graph');
    });

    it('should get connected edges via NodeHandle', async () => {
      const nodeHandle = graphHandle.nodeHandle('entity1');
      const connectedEdges = await nodeHandle.getConnectedEdges();

      expect(connectedEdges).toHaveLength(2);
      expect(connectedEdges.map(e => e.id).sort()).toEqual(['rel1', 'rel2']);
    });

    it('should get connected nodes via NodeHandle', async () => {
      const nodeHandle = graphHandle.nodeHandle('entity1');
      const connectedNodes = await nodeHandle.getConnectedNodes();

      expect(connectedNodes).toHaveLength(2);
      expect(connectedNodes.map(n => n.id).sort()).toEqual(['concept1', 'entity2']);
    });

    it('should delete node via NodeHandle', async () => {
      const nodeHandle = graphHandle.nodeHandle('entity1');
      const result = await nodeHandle.delete();

      expect(result.success).toBe(true);

      const nodes = await graphHandle.getNodes();
      expect(nodes).toHaveLength(2);
    });

    it('should handle non-existent node gracefully', async () => {
      const nodeHandle = graphHandle.nodeHandle('nonexistent');
      const nodeData = await nodeHandle.getData();

      expect(nodeData).toBeNull();
    });
  });

  describe('EdgeHandle Drill-down', () => {
    it('should create EdgeHandle for specific edge', () => {
      const edgeHandle = graphHandle.edgeHandle('rel1');
      expect(edgeHandle).toBeInstanceOf(EdgeHandle);
      expect(edgeHandle.edgeId).toBe('rel1');
    });

    it('should get edge data via EdgeHandle', async () => {
      const edgeHandle = graphHandle.edgeHandle('rel1');
      const edgeData = await edgeHandle.getData();

      expect(edgeData).toBeDefined();
      expect(edgeData.id).toBe('rel1');
      expect(edgeData.source).toBe('entity1');
      expect(edgeData.target).toBe('entity2');
    });

    it('should update edge via EdgeHandle', async () => {
      const edgeHandle = graphHandle.edgeHandle('rel1');
      await edgeHandle.update({ label: 'New Label' });

      const edgeData = await edgeHandle.getData();
      expect(edgeData.label).toBe('New Label');
    });

    it('should get specific property via EdgeHandle', async () => {
      const edgeHandle = graphHandle.edgeHandle('rel1');
      const type = await edgeHandle.getProperty('type');

      expect(type).toBe('relatesTo');
    });

    it('should get source node via EdgeHandle', async () => {
      const edgeHandle = graphHandle.edgeHandle('rel1');
      const sourceNode = await edgeHandle.getSourceNode();

      expect(sourceNode).toBeDefined();
      expect(sourceNode.id).toBe('entity1');
      expect(sourceNode.label).toBe('Knowledge Graph');
    });

    it('should get target node via EdgeHandle', async () => {
      const edgeHandle = graphHandle.edgeHandle('rel1');
      const targetNode = await edgeHandle.getTargetNode();

      expect(targetNode).toBeDefined();
      expect(targetNode.id).toBe('entity2');
      expect(targetNode.label).toBe('Semantic Web');
    });

    it('should delete edge via EdgeHandle', async () => {
      const edgeHandle = graphHandle.edgeHandle('rel1');
      const result = await edgeHandle.delete();

      expect(result.success).toBe(true);

      const edges = await graphHandle.getEdges();
      expect(edges).toHaveLength(2);
    });

    it('should handle non-existent edge gracefully', async () => {
      const edgeHandle = graphHandle.edgeHandle('nonexistent');
      const edgeData = await edgeHandle.getData();

      expect(edgeData).toBeNull();
    });
  });

  describe('Complex Workflow', () => {
    it('should support full CRUD workflow', async () => {
      // Create
      await graphHandle.addNode({
        id: 'new1',
        label: 'New Node',
        type: 'Entity'
      });

      await graphHandle.addEdge({
        id: 'newEdge1',
        source: 'entity1',
        target: 'new1',
        type: 'connects'
      });

      // Read
      const newNode = await graphHandle.getNode('new1');
      expect(newNode).toBeDefined();

      const connectedNodes = await graphHandle.getConnectedNodes('entity1');
      expect(connectedNodes.map(n => n.id)).toContain('new1');

      // Update via handle
      const nodeHandle = graphHandle.nodeHandle('new1');
      await nodeHandle.update({ label: 'Updated Node' });

      const updatedNode = await nodeHandle.getData();
      expect(updatedNode.label).toBe('Updated Node');

      // Delete
      const edgeHandle = graphHandle.edgeHandle('newEdge1');
      await edgeHandle.delete();

      await nodeHandle.delete();

      const finalNodes = await graphHandle.getNodes();
      expect(finalNodes).toHaveLength(3); // Back to original 3
    });

    it('should navigate graph via drill-down handles', async () => {
      // Start at entity1
      const entity1Handle = graphHandle.nodeHandle('entity1');
      const entity1Data = await entity1Handle.getData();
      expect(entity1Data.label).toBe('Knowledge Graph');

      // Get connected edges
      const connectedEdges = await entity1Handle.getConnectedEdges();
      expect(connectedEdges).toHaveLength(2);

      // Drill down to first edge
      const edgeHandle = graphHandle.edgeHandle(connectedEdges[0].id);
      const targetNode = await edgeHandle.getTargetNode();

      // Navigate to target
      expect(targetNode).toBeDefined();
      expect(['entity2', 'concept1']).toContain(targetNode.id);
    });
  });

  describe('Serialization for RemoteHandle', () => {
    it('should serialize GraphHandle with capabilities', () => {
      const serialized = graphHandle.serialize();

      expect(serialized.__type).toBe('RemoteHandle');
      expect(serialized.handleType).toBe('GraphHandle');
      expect(serialized.capabilities).toContain('getNodes');
      expect(serialized.capabilities).toContain('addNode');
      expect(serialized.capabilities).toContain('nodeHandle');
      expect(serialized.capabilities).toContain('edgeHandle');
      expect(serialized.schema).toBeDefined();
    });

    it('should serialize NodeHandle with capabilities', () => {
      const nodeHandle = graphHandle.nodeHandle('entity1');
      const serialized = nodeHandle.serialize();

      expect(serialized.__type).toBe('RemoteHandle');
      expect(serialized.handleType).toBe('NodeHandle');
      expect(serialized.nodeId).toBe('entity1');
      expect(serialized.capabilities).toContain('getData');
      expect(serialized.capabilities).toContain('getConnectedNodes');
    });

    it('should serialize EdgeHandle with capabilities', () => {
      const edgeHandle = graphHandle.edgeHandle('rel1');
      const serialized = edgeHandle.serialize();

      expect(serialized.__type).toBe('RemoteHandle');
      expect(serialized.handleType).toBe('EdgeHandle');
      expect(serialized.edgeId).toBe('rel1');
      expect(serialized.capabilities).toContain('getData');
      expect(serialized.capabilities).toContain('getSourceNode');
    });
  });
});
