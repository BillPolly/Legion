/**
 * GraphEditorDemo - A complete demo application as an umbilical component
 */

import { GraphEditor } from '../../../src/components/graph-editor/index.js';
import { SelectTool } from '../../../src/components/graph-editor/tools/SelectTool.js';
import { PanTool } from '../../../src/components/graph-editor/tools/PanTool.js';
import { UmbilicalUtils } from '../../../src/umbilical/index.js';

export const GraphEditorDemo = {
  create(umbilical) {
    // 1. Introspection mode
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Parent DOM element');
      umbilical.describe(requirements);
      return;
    }

    // 2. Validation mode
    if (umbilical.validate) {
      const checks = {
        hasDomElement: !!(umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE)
      };
      return umbilical.validate(checks);
    }

    // 3. Instance creation mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'GraphEditorDemo');
    
    return new GraphEditorDemoInstance(umbilical);
  }
};

class GraphEditorDemoInstance {
  constructor(umbilical) {
    this.umbilical = umbilical;
    this._destroyed = false;
    this.editor = null;
    this.nodeIdCounter = 10;
    
    // Create the demo UI
    this._createDemoUI();
    this._initializeEditor();
    
    if (umbilical.onMount) {
      umbilical.onMount(this);
    }
  }
  
  _createDemoUI() {
    // Create the main container
    this.container = document.createElement('div');
    this.container.className = 'graph-editor-demo';
    this.container.innerHTML = `
      <div class="demo-header">
        <h1>Graph Editor Demo</h1>
        <p>Interactive node-link diagram editor with MVVM architecture</p>
      </div>
      
      <div class="demo-toolbar">
        <div class="toolbar-group">
          <button id="selectToolBtn" class="btn primary">Select</button>
          <button id="panToolBtn" class="btn">Pan</button>
        </div>
        
        <div class="toolbar-group">
          <button id="addNodeBtn" class="btn">Add Node</button>
          <button id="deleteBtn" class="btn" disabled>Delete</button>
          <button id="connectBtn" class="btn" disabled>Connect</button>
        </div>
        
        <div class="toolbar-group">
          <button id="undoBtn" class="btn" disabled>Undo</button>
          <button id="redoBtn" class="btn" disabled>Redo</button>
          <button id="clearBtn" class="btn">Clear</button>
        </div>
        
        <div class="toolbar-group">
          <button id="layoutBtn" class="btn">Auto Layout</button>
          <button id="zoomFitBtn" class="btn">Fit</button>
          <button id="resetBtn" class="btn">Reset</button>
        </div>
        
        <div class="toolbar-group">
          <button id="saveBtn" class="btn">Save</button>
          <button id="loadBtn" class="btn">Load</button>
        </div>
      </div>
      
      <div class="demo-content">
        <div class="editor-section">
          <div id="editorContainer" class="editor-container"></div>
        </div>
        
        <div class="info-section">
          <div class="status-panel">
            <h4>Status</h4>
            <div class="status-item">Nodes: <span id="nodeCount">0</span></div>
            <div class="status-item">Edges: <span id="edgeCount">0</span></div>
            <div class="status-item">Selected: <span id="selectionCount">0</span></div>
            <div class="status-item">Tool: <span id="activeTool">select</span></div>
            <div class="status-item">Zoom: <span id="zoomLevel">100%</span></div>
          </div>
          
          <div class="log-panel">
            <h4>Event Log</h4>
            <div id="eventLog" class="event-log"></div>
          </div>
        </div>
      </div>
    `;
    
    // Add styles
    this._addStyles();
    
    // Append to umbilical DOM
    this.umbilical.dom.appendChild(this.container);
  }
  
  _addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .graph-editor-demo {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #f5f5f5;
      }
      
      .demo-header {
        padding: 20px;
        background: #2c3e50;
        color: white;
      }
      
      .demo-header h1 {
        margin: 0 0 10px 0;
        font-size: 24px;
      }
      
      .demo-header p {
        margin: 0;
        opacity: 0.8;
        font-size: 14px;
      }
      
      .demo-toolbar {
        display: flex;
        gap: 10px;
        padding: 15px 20px;
        background: #ecf0f1;
        border-bottom: 1px solid #bdc3c7;
        flex-wrap: wrap;
      }
      
      .toolbar-group {
        display: flex;
        gap: 5px;
      }
      
      .btn {
        padding: 8px 16px;
        border: 1px solid #bdc3c7;
        background: white;
        color: #2c3e50;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }
      
      .btn:hover {
        background: #e8f4f8;
        border-color: #3498db;
      }
      
      .btn.primary {
        background: #3498db;
        color: white;
        border-color: #2980b9;
      }
      
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .demo-content {
        flex: 1;
        display: flex;
        min-height: 0;
      }
      
      .editor-section {
        flex: 1;
        padding: 20px;
      }
      
      .editor-container {
        width: 100%;
        height: 500px;
        border: 1px solid #bdc3c7;
        border-radius: 4px;
        background: white;
      }
      
      .info-section {
        width: 250px;
        padding: 20px;
        background: white;
        border-left: 1px solid #bdc3c7;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      
      .status-panel, .log-panel {
        border: 1px solid #bdc3c7;
        border-radius: 4px;
        padding: 15px;
      }
      
      .status-panel h4, .log-panel h4 {
        margin: 0 0 10px 0;
        font-size: 14px;
        color: #2c3e50;
      }
      
      .status-item {
        margin: 5px 0;
        font-size: 13px;
        color: #7f8c8d;
      }
      
      .event-log {
        height: 200px;
        overflow-y: auto;
        font-size: 12px;
        font-family: monospace;
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 3px;
        padding: 8px;
      }
      
      .log-entry {
        margin: 2px 0;
        padding: 2px 4px;
        border-radius: 2px;
      }
      
      .log-entry.error {
        background: #ffebee;
        color: #c62828;
      }
      
      .log-entry.info {
        color: #37474f;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  _initializeEditor() {
    try {
      const container = this.container.querySelector('#editorContainer');
      
      this.editor = GraphEditor.create({
        dom: container,
        theme: 'light',
        onModelChange: (type, data) => {
          this._log(`Model change: ${type}`);
          this._updateStatus();
        },
        onSelectionChange: (selection) => {
          this._log(`Selection changed: ${selection.join(', ') || 'none'}`);
          this._updateStatus();
        },
        onHistoryChange: (state) => {
          this._updateStatus();
        },
        onMount: (instance) => {
          this._log('Graph editor mounted');
          this._setupTools(instance);
          this._createSampleGraph(instance);
          // Update status after a brief delay to ensure sample graph is rendered
          setTimeout(() => this._updateStatus(), 10);
        },
        onError: (error) => {
          this._log(`Error: ${error.message}`, 'error');
        }
      });
      
      // Setup event handlers
      this._setupEventHandlers();
      
    } catch (error) {
      this._log(`Initialization error: ${error.message}`, 'error');
    }
  }
  
  _setupTools(editorInstance) {
    try {
      const coordinator = editorInstance.getViewModel().getEventCoordinator();
      
      // Register tools
      coordinator.registerTool('select', new SelectTool());
      coordinator.registerTool('pan', new PanTool());
      
      // Set default tool
      coordinator.setActiveTool('select');
      this._updateToolButtons('select');
      
    } catch (error) {
      this._log(`Tool setup error: ${error.message}`, 'error');
    }
  }
  
  _createSampleGraph(editorInstance) {
    try {
      const model = editorInstance.getModel();
      
      // Create nodes with better positioning
      model.addNode({
        id: 'start',
        position: { x: 150, y: 100 },
        label: 'Start',
        size: { width: 100, height: 60 },
        style: { fill: '#e3f2fd', stroke: '#1976d2', strokeWidth: 2 }
      });
      
      model.addNode({
        id: 'process1',
        position: { x: 350, y: 100 },
        label: 'Process A',
        size: { width: 120, height: 60 },
        style: { fill: '#f3e5f5', stroke: '#7b1fa2', strokeWidth: 2 }
      });
      
      model.addNode({
        id: 'process2',
        position: { x: 350, y: 220 },
        label: 'Process B',
        size: { width: 120, height: 60 },
        style: { fill: '#e8f5e8', stroke: '#388e3c', strokeWidth: 2 }
      });
      
      model.addNode({
        id: 'decision',
        position: { x: 550, y: 160 },
        label: 'Decision',
        size: { width: 100, height: 60 },
        style: { fill: '#fff3e0', stroke: '#f57c00', strokeWidth: 2 }
      });
      
      model.addNode({
        id: 'end',
        position: { x: 700, y: 160 },
        label: 'End',
        size: { width: 100, height: 60 },
        style: { fill: '#ffebee', stroke: '#d32f2f', strokeWidth: 2 }
      });
      
      // Create edges with labels
      model.addEdge({
        id: 'edge1',
        source: 'start',
        target: 'process1',
        label: 'begin',
        directed: true
      });
      
      model.addEdge({
        id: 'edge2', 
        source: 'start',
        target: 'process2',
        label: 'alternate',
        directed: true
      });
      
      model.addEdge({
        id: 'edge3',
        source: 'process1',
        target: 'decision',
        directed: true
      });
      
      model.addEdge({
        id: 'edge4',
        source: 'process2', 
        target: 'decision',
        directed: true
      });
      
      model.addEdge({
        id: 'edge5',
        source: 'decision',
        target: 'end',
        label: 'complete',
        directed: true
      });
      
      // Update counter to avoid ID conflicts
      this.nodeIdCounter = 10;
      
      this._log('Created sample graph with 5 nodes and 5 edges');
      
      // Trigger initial render
      editorInstance.getViewModel().render();
      
    } catch (error) {
      this._log(`Sample graph error: ${error.message}`, 'error');
    }
  }
  
  _setupEventHandlers() {
    // Tool buttons
    this.container.querySelector('#selectToolBtn').addEventListener('click', () => {
      if (!this.editor) return;
      const coordinator = this.editor.getViewModel().getEventCoordinator();
      coordinator.setActiveTool('select');
      this._updateToolButtons('select');
      this._updateStatus();
      this._log('Switched to select tool');
    });
    
    this.container.querySelector('#panToolBtn').addEventListener('click', () => {
      if (!this.editor) return;
      const coordinator = this.editor.getViewModel().getEventCoordinator();
      coordinator.setActiveTool('pan');
      this._updateToolButtons('pan');
      this._updateStatus();
      this._log('Switched to pan tool');
    });
    
    // Action buttons
    this.container.querySelector('#addNodeBtn').addEventListener('click', () => {
      try {
        if (!this.editor) {
          this._log('No editor available', 'error');
          return;
        }
        
        const model = this.editor.getModel();
        const viewModel = this.editor.getViewModel();
        const view = this.editor.getView();
        
        this._log(`Before add - Model nodes: ${model.getSceneGraph().getAllNodes().length}`);
        
        const center = {
          x: 400 + Math.random() * 100 - 50,
          y: 300 + Math.random() * 100 - 50
        };
        
        const nodeId = `node${this.nodeIdCounter++}`;
        this._log(`Attempting to add node ${nodeId} at position ${center.x}, ${center.y}`);
        
        const result = viewModel.executeCommandType('addNode', {
          nodeData: {
            id: nodeId,
            position: center,
            label: `Node ${this.nodeIdCounter}`,
            size: { width: 100, height: 60 }
          }
        });
        
        this._log(`Command result: ${result}`);
        this._log(`After add - Model nodes: ${model.getSceneGraph().getAllNodes().length}`);
        
        // Force render and check if it worked
        this._log('Forcing render...');
        viewModel.render();
        
        // SVG Inspector utility
        this._inspectSVG();
        
        if (result) {
          this._log(`✅ Successfully added node: ${nodeId}`);
        } else {
          this._log(`❌ Failed to add node: ${nodeId}`, 'error');
        }
        
      } catch (error) {
        this._log(`Add node error: ${error.message}`, 'error');
        console.error(error);
      }
    });
    
    this.container.querySelector('#deleteBtn').addEventListener('click', () => {
      if (!this.editor) return;
      const viewModel = this.editor.getViewModel();
      const selection = viewModel.getSelection();
      
      selection.forEach(nodeId => {
        viewModel.executeCommandType('removeNode', { nodeId });
      });
    });
    
    this.container.querySelector('#undoBtn').addEventListener('click', () => {
      if (!this.editor) return;
      this.editor.getViewModel().undo();
      this._log('Undo');
    });
    
    this.container.querySelector('#redoBtn').addEventListener('click', () => {
      if (!this.editor) return;
      this.editor.getViewModel().redo();
      this._log('Redo');
    });
    
    this.container.querySelector('#clearBtn').addEventListener('click', () => {
      if (!this.editor) return;
      if (confirm('Clear all nodes and edges?')) {
        this.editor.getModel().clear();
        this.nodeIdCounter = 1;
        this._updateStatus();
        this._log('Graph cleared');
      }
    });
    
    this.container.querySelector('#layoutBtn').addEventListener('click', () => {
      if (!this.editor) return;
      this.editor.getViewModel().applyLayout('dagre');
      this._log('Applied auto layout');
    });
    
    this.container.querySelector('#zoomFitBtn').addEventListener('click', () => {
      if (!this.editor) return;
      // TODO: Implement zoom to fit
      this._log('Zoom to fit');
    });
    
    this.container.querySelector('#resetBtn').addEventListener('click', () => {
      if (!this.editor) return;
      this.editor.getView().getViewport().reset();
      this._log('Reset viewport');
    });
    
    this.container.querySelector('#saveBtn').addEventListener('click', () => {
      if (!this.editor) return;
      const data = this.editor.getModel().toJSON();
      const json = JSON.stringify(data, null, 2);
      
      // Download as file
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'graph.json';
      a.click();
      URL.revokeObjectURL(url);
      
      this._log('Graph saved');
    });
    
    this.container.querySelector('#loadBtn').addEventListener('click', () => {
      if (!this.editor) return;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const data = JSON.parse(e.target.result);
              this.editor.getModel().fromJSON(data);
              this._log('Graph loaded successfully');
            } catch (error) {
              this._log(`Error loading graph: ${error.message}`, 'error');
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    });
  }
  
  _updateToolButtons(activeTool) {
    this.container.querySelector('#selectToolBtn').classList.toggle('primary', activeTool === 'select');
    this.container.querySelector('#panToolBtn').classList.toggle('primary', activeTool === 'pan');
  }
  
  _updateStatus() {
    if (!this.editor) return;
    
    try {
      const model = this.editor.getModel();
      const viewModel = this.editor.getViewModel();
      const view = this.editor.getView();
      
      this.container.querySelector('#nodeCount').textContent = 
        model.getSceneGraph().getAllNodes().length - 1; // Exclude root
      this.container.querySelector('#edgeCount').textContent = 
        model.getEdges().length;
      this.container.querySelector('#selectionCount').textContent = 
        viewModel.getSelection().length;
      this.container.querySelector('#activeTool').textContent = 
        viewModel.getEventCoordinator().getActiveTool().name;
      this.container.querySelector('#zoomLevel').textContent = 
        Math.round(view.getViewport().getZoom() * 100) + '%';
        
      // Update button states
      this.container.querySelector('#undoBtn').disabled = !viewModel.canUndo();
      this.container.querySelector('#redoBtn').disabled = !viewModel.canRedo();
      
      const hasSelection = viewModel.getSelection().length > 0;
      this.container.querySelector('#deleteBtn').disabled = !hasSelection;
      
    } catch (error) {
      this._log(`Status update error: ${error.message}`, 'error');
    }
  }
  
  _log(message, type = 'info') {
    const logEl = this.container.querySelector('#eventLog');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
  }
  
  _inspectSVG() {
    const svg = this.container.querySelector('#editorContainer svg');
    if (!svg) {
      this._log('❌ No SVG element found', 'error');
      return;
    }
    
    const report = {
      svg: {
        width: svg.getAttribute('width'),
        height: svg.getAttribute('height'),
        childrenCount: svg.children.length,
        innerHTML: svg.innerHTML.length
      },
      mainGroup: null,
      nodes: [],
      edges: []
    };
    
    // Find main group
    const mainGroup = svg.querySelector('g[transform^="matrix"]');
    if (mainGroup) {
      report.mainGroup = {
        transform: mainGroup.getAttribute('transform'),
        childrenCount: mainGroup.children.length
      };
      
      // Count nodes and edges in main group
      report.nodes = Array.from(mainGroup.querySelectorAll('g.node')).map(node => ({
        id: node.getAttribute('data-node-id'),
        transform: node.getAttribute('transform'),
        hasRect: !!node.querySelector('rect'),
        hasText: !!node.querySelector('text')
      }));
      
      report.edges = Array.from(mainGroup.querySelectorAll('g[data-edge-id]')).map(edge => ({
        id: edge.getAttribute('data-edge-id'),
        hasPath: !!edge.querySelector('path')
      }));
    }
    
    // Log summary
    this._log(`🔍 SVG Report: ${report.nodes.length} nodes, ${report.edges.length} edges, main group children: ${report.mainGroup?.childrenCount || 0}`);
    
    if (report.nodes.length === 0) {
      this._log('❌ No nodes found in SVG!', 'error');
      this._log(`SVG innerHTML preview: ${svg.innerHTML.substring(0, 200)}...`);
    } else {
      this._log(`✅ Nodes: ${report.nodes.map(n => n.id).join(', ')}`);
    }
    
    // Make report available globally for debugging
    window.svgReport = report;
    return report;
  }
  
  // Public API
  getEditor() {
    return this.editor;
  }
  
  destroy() {
    if (this._destroyed) return;
    
    if (this.editor && this.editor.destroy) {
      this.editor.destroy();
    }
    
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    this._destroyed = true;
    
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy(this);
    }
  }
}