/**
 * DagreLayout - Hierarchical layout using Dagre library
 * 
 * Provides directed graph layout with automatic edge routing
 */

import { Layout } from './Layout.js';

// Note: In a real implementation, this would import from 'dagre'
// For now, we'll create a minimal mock implementation
const createMockDagre = () => {
  return {
    graphlib: {
      Graph: class {
        constructor(options = {}) {
          this._nodes = new Map();
          this._edges = new Map();
          this.graphOptions = options;
        }
        
        setGraph(options) {
          this.layoutOptions = options;
        }
        
        setDefaultNodeLabel(fn) {
          this.defaultNodeLabel = fn;
        }
        
        setDefaultEdgeLabel(fn) {
          this.defaultEdgeLabel = fn;
        }
        
        setNode(id, data) {
          this._nodes.set(id, data);
        }
        
        setEdge(source, target, data = {}) {
          const edgeId = `${source}-${target}`;
          this._edges.set(edgeId, { source, target, ...data });
        }
        
        node(id) {
          return this._nodes.get(id);
        }
        
        edge(source, target) {
          const edgeId = `${source}-${target}`;
          return this._edges.get(edgeId);
        }
        
        nodes() {
          return Array.from(this._nodes.keys());
        }
        
        edges() {
          return Array.from(this._edges.values()).map(edge => ({
            v: edge.source,
            w: edge.target
          }));
        }
      }
    },
    
    layout: function(graph) {
      // Simple grid layout for mock
      const nodeIds = graph.nodes();
      const cols = Math.ceil(Math.sqrt(nodeIds.length));
      const nodeSpacing = (graph.layoutOptions && graph.layoutOptions.nodesep) || 100;
      const rankSpacing = (graph.layoutOptions && graph.layoutOptions.ranksep) || 150;
      
      nodeIds.forEach((nodeId, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const node = graph.node(nodeId);
        
        node.x = col * nodeSpacing + nodeSpacing / 2;
        node.y = row * rankSpacing + rankSpacing / 2;
      });
      
      // Simple edge routing
      graph.edges().forEach(edge => {
        const sourceNode = graph.node(edge.v);
        const targetNode = graph.node(edge.w);
        const edgeData = graph.edge(edge.v, edge.w);
        
        if (sourceNode && targetNode && edgeData) {
          edgeData.points = [
            { x: sourceNode.x, y: sourceNode.y },
            { x: targetNode.x, y: targetNode.y }
          ];
        }
      });
      
      // Set graph dimensions
      const maxCol = Math.min(cols - 1, nodeIds.length - 1);
      const maxRow = Math.floor((nodeIds.length - 1) / cols);
      graph.graph = {
        width: (maxCol + 1) * nodeSpacing,
        height: (maxRow + 1) * rankSpacing
      };
    }
  };
};

const dagre = createMockDagre();

export class DagreLayout extends Layout {
  constructor(config = {}) {
    super('dagre', {
      // Dagre-specific defaults
      rankdir: 'TB', // Top to Bottom, can be TB, BT, LR, RL
      ranksep: 150,  // Separation between ranks
      nodesep: 100,  // Separation between nodes in same rank
      edgesep: 50,   // Separation between edges
      marginx: 20,   // Graph margin X
      marginy: 20,   // Graph margin Y
      acyclicer: 'greedy', // How to break cycles
      ranker: 'network-simplex', // Ranking algorithm
      ...config
    });
  }

  /**
   * Calculate Dagre layout for graph data
   */
  async calculateLayout(graphData, constraints = {}) {
    this._validateGraphData(graphData);
    
    // Create Dagre graph
    const g = new dagre.graphlib.Graph({ directed: true, compound: false, multigraph: false });
    
    // Set graph options
    g.setGraph({
      rankdir: this.config.rankdir,
      ranksep: this.config.ranksep,
      nodesep: this.config.nodesep,
      edgesep: this.config.edgesep,
      marginx: this.config.marginx,
      marginy: this.config.marginy
    });
    
    // Set default node and edge labels
    g.setDefaultNodeLabel(() => ({}));
    g.setDefaultEdgeLabel(() => ({}));
    
    // Add nodes
    graphData.nodes.forEach(node => {
      const nodeData = {
        label: node.label || node.id,
        width: node.width || (node.size ? node.size.width : 100),
        height: node.height || (node.size ? node.size.height : 50)
      };
      
      // Handle fixed positions (constraints)
      if (constraints.fixedNodes && constraints.fixedNodes[node.id]) {
        const fixedPos = constraints.fixedNodes[node.id];
        nodeData.x = fixedPos.x;
        nodeData.y = fixedPos.y;
        nodeData.fixed = true;
      }
      
      g.setNode(node.id, nodeData);
    });
    
    // Add edges
    graphData.edges.forEach(edge => {
      const edgeData = {
        label: edge.label || '',
        weight: edge.weight || 1,
        labelpos: 'c', // center
        labeloffset: 10
      };
      
      g.setEdge(edge.source, edge.target, edgeData);
    });
    
    // Run Dagre layout
    dagre.layout(g);
    
    // Extract results
    const result = {
      nodes: [],
      edges: [],
      graph: g.graph || {}
    };
    
    // Extract node positions
    g.nodes().forEach(nodeId => {
      const node = g.node(nodeId);
      result.nodes.push({
        id: nodeId,
        position: {
          x: node.x,
          y: node.y
        },
        size: {
          width: node.width,
          height: node.height
        }
      });
    });
    
    // Extract edge routes
    g.edges().forEach(edge => {
      const edgeData = g.edge(edge.v, edge.w);
      if (edgeData && edgeData.points) {
        result.edges.push({
          id: `${edge.v}-${edge.w}`,
          source: edge.v,
          target: edge.w,
          points: edgeData.points
        });
      }
    });
    
    return result;
  }

  /**
   * Update rankdir (direction) and recalculate if needed
   */
  setRankDirection(rankdir) {
    if (!['TB', 'BT', 'LR', 'RL'].includes(rankdir)) {
      throw new Error('Invalid rankdir. Must be one of: TB, BT, LR, RL');
    }
    
    this.updateConfig({ rankdir });
  }

  /**
   * Set node separation
   */
  setNodeSeparation(nodesep) {
    if (typeof nodesep !== 'number' || nodesep < 0) {
      throw new Error('Node separation must be a positive number');
    }
    
    this.updateConfig({ nodesep });
  }

  /**
   * Set rank separation
   */
  setRankSeparation(ranksep) {
    if (typeof ranksep !== 'number' || ranksep < 0) {
      throw new Error('Rank separation must be a positive number');
    }
    
    this.updateConfig({ ranksep });
  }

  /**
   * Create graph data from scene graph for layout
   */
  static createGraphDataFromModel(model) {
    const sceneGraph = model.getSceneGraph();
    const nodes = sceneGraph.getAllNodes()
      .filter(node => node.getId() !== 'root')
      .map(node => ({
        id: node.getId(),
        label: node.getLabel ? node.getLabel() : node.getId(),
        size: node.getSize(),
        position: node.getPosition(), // Current position
        data: node.getData ? node.getData() : {}
      }));
    
    const edges = model.getEdges().map(edge => ({
      id: edge.getId(),
      source: edge.getSource(),
      target: edge.getTarget(),
      label: edge.getLabel ? edge.getLabel() : '',
      weight: edge.getWeight ? edge.getWeight() : 1,
      data: edge.getData ? edge.getData() : {}
    }));
    
    return { nodes, edges };
  }

  /**
   * Get suggested layout based on graph characteristics
   */
  static suggestLayoutConfig(graphData) {
    const nodeCount = graphData.nodes.length;
    const edgeCount = graphData.edges.length;
    const density = edgeCount / (nodeCount * (nodeCount - 1));
    
    // Suggest configuration based on graph size and density
    if (nodeCount < 10) {
      return {
        nodesep: 120,
        ranksep: 100,
        rankdir: 'TB'
      };
    } else if (nodeCount < 50) {
      return {
        nodesep: 100,
        ranksep: 150,
        rankdir: density > 0.3 ? 'LR' : 'TB'
      };
    } else {
      return {
        nodesep: 80,
        ranksep: 120,
        rankdir: 'LR'
      };
    }
  }
}