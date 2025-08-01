/**
 * GraphEditorModel - Model layer for the Graph Editor
 * 
 * Manages the graph data structure, scene graph, and notifies observers of changes.
 */

import { SceneGraph } from './SceneGraph.js';
import { Node } from './Node.js';
import { Edge } from './Edge.js';

export class GraphEditorModel {
  constructor(config = {}) {
    this.config = config;
    this._destroyed = false;
    
    // Create scene graph
    this.sceneGraph = new SceneGraph();
    
    // Edge collection
    this.edges = [];
    this.edgeMap = new Map();
    
    // Batch update tracking
    this.batchDepth = 0;
    this.pendingChanges = [];
    
    // Change callback
    this.onChange = config.onChange || (() => {});
    
    // Listen to scene graph changes
    this.sceneGraph.onChange((event) => {
      this._handleSceneGraphChange(event);
    });
  }

  /**
   * Get the scene graph
   */
  getSceneGraph() {
    return this.sceneGraph;
  }

  /**
   * Get all edges
   */
  getEdges() {
    return [...this.edges];
  }

  /**
   * Get edge by ID
   */
  getEdgeById(id) {
    return this.edgeMap.get(id);
  }

  /**
   * Add node to the graph
   */
  addNode(nodeData, parentId = 'root') {
    if (!nodeData) {
      throw new Error('Node data is required');
    }
    
    // Handle parentId from nodeData if provided
    if (nodeData.parentId && parentId === 'root') {
      parentId = nodeData.parentId;
    }
    
    // Create Node instance if not already one
    const node = nodeData instanceof Node ? nodeData : new Node(nodeData);
    
    this.sceneGraph.addNode(node, parentId);
    this._notifyChange('nodeAdded', { node });
    
    return node;
  }

  /**
   * Remove node from the graph
   */
  removeNode(nodeId) {
    // First remove all connected edges
    const connectedEdges = this.getConnectedEdges(nodeId);
    connectedEdges.forEach(edge => this.removeEdge(edge.getId()));
    
    // Then remove the node
    this.sceneGraph.removeNode(nodeId);
    this._notifyChange('nodeRemoved', { nodeId });
  }

  /**
   * Add edge to the graph
   */
  addEdge(edgeData) {
    if (!edgeData) {
      throw new Error('Edge data is required');
    }
    
    // Create Edge instance if not already one
    const edge = edgeData instanceof Edge ? edgeData : new Edge(edgeData);
    
    // Validate nodes exist
    const sourceNode = this.sceneGraph.getNodeById(edge.getSource());
    const targetNode = this.sceneGraph.getNodeById(edge.getTarget());
    
    if (!sourceNode || !targetNode) {
      throw new Error('Source and target nodes must exist');
    }
    
    // Add to collections
    this.edges.push(edge);
    this.edgeMap.set(edge.getId(), edge);
    
    // Listen to edge changes
    edge.onChange(() => {
      this._notifyChange('edgeChanged', { edge });
    });
    
    this._notifyChange('edgeAdded', { edge });
    
    return edge;
  }

  /**
   * Remove edge from the graph
   */
  removeEdge(edgeId) {
    const edge = this.edgeMap.get(edgeId);
    if (!edge) return;
    
    // Remove from collections
    const index = this.edges.indexOf(edge);
    if (index !== -1) {
      this.edges.splice(index, 1);
    }
    this.edgeMap.delete(edgeId);
    
    this._notifyChange('edgeRemoved', { edgeId, edge });
  }

  /**
   * Get edges connected to a node
   */
  getConnectedEdges(nodeId) {
    return this.edges.filter(edge => edge.isConnectedTo(nodeId));
  }

  /**
   * Clear the model
   */
  clear() {
    // Clear edges first
    this.edges = [];
    this.edgeMap.clear();
    
    // Clear scene graph
    this.sceneGraph.clear();
    
    this._notifyChange('cleared', {});
  }

  /**
   * Begin batch update
   */
  beginBatch() {
    this.batchDepth++;
    this.sceneGraph.beginBatch();
  }

  /**
   * End batch update
   */
  endBatch() {
    this.sceneGraph.endBatch();
    this.batchDepth = Math.max(0, this.batchDepth - 1);
    
    if (this.batchDepth === 0 && this.pendingChanges.length > 0) {
      // Notify all pending changes as batch
      const changes = this.pendingChanges;
      this.pendingChanges = [];
      
      if (this.onChange) {
        this.onChange('batchUpdate', { changes });
      }
    }
  }

  /**
   * Cancel batch update
   */
  cancelBatch() {
    this.sceneGraph.cancelBatch();
    this.batchDepth = 0;
    this.pendingChanges = [];
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    const nodes = this.sceneGraph.getAllNodes().map(node => node.toJSON());
    const edges = this.edges.map(edge => edge.toJSON());
    
    return { 
      nodes, 
      edges,
      metadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Load from JSON
   */
  fromJSON(json) {
    // Validate input
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON: must be an object');
    }
    
    if (!Array.isArray(json.nodes)) {
      throw new Error('Invalid JSON: nodes must be an array');
    }
    
    if (!Array.isArray(json.edges)) {
      throw new Error('Invalid JSON: edges must be an array');
    }
    
    this.clear();
    
    // Load nodes first (without hierarchy)
    const nodeMap = new Map();
    const nodeDataList = [];
    
    json.nodes.forEach(nodeData => {
      if (nodeData.id === 'root') return; // Skip root, it already exists
      
      // Validate node data
      if (!nodeData.id || !nodeData.position) {
        console.warn('Skipping invalid node:', nodeData);
        return;
      }
      
      // Store node data for hierarchy setup
      nodeDataList.push(nodeData);
      
      // Create node without parent first
      const nodeConfig = { ...nodeData };
      delete nodeConfig.parentId; // Remove parentId temporarily
      
      const node = this.addNode(nodeConfig);
      nodeMap.set(node.getId(), node);
    });
    
    // Set up hierarchy
    nodeDataList.forEach(nodeData => {
      if (nodeData.parentId) {
        const node = this.sceneGraph.getNodeById(nodeData.id);
        const parent = nodeData.parentId === 'root' 
          ? this.sceneGraph.getRoot()
          : this.sceneGraph.getNodeById(nodeData.parentId);
          
        if (node && parent) {
          this.sceneGraph.setParent(node, parent);
        }
      }
    });
    
    // Load edges
    json.edges.forEach(edgeData => {
      try {
        // Validate edge has required properties
        if (!edgeData.source || !edgeData.target) {
          console.warn('Skipping invalid edge:', edgeData);
          return;
        }
        
        // Check if nodes exist
        const sourceExists = edgeData.source === 'root' || nodeMap.has(edgeData.source);
        const targetExists = edgeData.target === 'root' || nodeMap.has(edgeData.target);
        
        if (!sourceExists || !targetExists) {
          console.warn('Skipping edge with missing nodes:', edgeData);
          return;
        }
        
        this.addEdge(edgeData);
      } catch (error) {
        console.warn('Failed to add edge:', error.message, edgeData);
      }
    });
  }

  /**
   * Handle scene graph changes
   * @private
   */
  _handleSceneGraphChange(event) {
    // Forward relevant scene graph changes
    if (event.type === 'nodeAdded' || event.type === 'nodeRemoved') {
      // Already handled by our own methods
      return;
    }
    
    // Forward other changes
    this._notifyChange('sceneGraphChanged', event);
  }

  /**
   * Notify change
   * @private
   */
  _notifyChange(type, data) {
    if (this.batchDepth > 0) {
      // Queue change for batch notification
      this.pendingChanges.push({ type, data });
    } else if (this.onChange) {
      // Notify immediately
      this.onChange(type, data);
    }
  }

  /**
   * Destroy the model and clean up resources
   */
  destroy() {
    this._destroyed = true;
    this.clear();
    this.onChange = null;
  }
}