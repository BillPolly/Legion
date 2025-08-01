/**
 * NodeTypesDemo - A complete node types customization demo as an umbilical component
 */

import { GraphEditor } from '../../../src/components/graph-editor/index.js';
import { SelectTool } from '../../../src/components/graph-editor/tools/SelectTool.js';
import { ConnectTool } from '../../../src/components/graph-editor/tools/ConnectTool.js';
import { UmbilicalUtils } from '../../../src/umbilical/index.js';

export const NodeTypesDemo = {
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
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'NodeTypesDemo');
    
    return new NodeTypesDemoInstance(umbilical);
  }
};

class NodeTypesDemoInstance {
  constructor(umbilical) {
    console.log('🏗️ Creating NodeTypesDemo instance...');
    console.log('- Umbilical DOM:', umbilical.dom);
    
    this.umbilical = umbilical;
    this._destroyed = false;
    this.editor = null;
    this.nodeIdCounter = 1;
    this.selectedNodeId = null;
    this.dragGhost = null;
    this.isDropping = false; // Prevent multiple drops
    this.initialGraphCreated = false; // Prevent multiple initial graph creations
    
    // Node type definitions
    this.nodeTypes = {
      process: {
        shape: 'rectangle',
        color: '#3b82f6',
        icon: '□',
        defaultSize: { width: 120, height: 60 }
      },
      decision: {
        shape: 'diamond',
        color: '#f59e0b',
        icon: '◇',
        defaultSize: { width: 100, height: 100 }
      },
      data: {
        shape: 'parallelogram',
        color: '#10b981',
        icon: '▱',
        defaultSize: { width: 120, height: 60 }
      },
      terminal: {
        shape: 'ellipse',
        color: '#6366f1',
        icon: '●',
        defaultSize: { width: 100, height: 50 }
      },
      document: {
        shape: 'rectangle',
        color: '#8b5cf6',
        icon: '📄',
        defaultSize: { width: 100, height: 80 }
      },
      database: {
        shape: 'cylinder',
        color: '#ef4444',
        icon: '🗄️',
        defaultSize: { width: 80, height: 100 }
      }
    };
    
    // Create the demo UI
    console.log('🎨 Creating demo UI...');
    this._createDemoUI();
    console.log('🎯 Initializing editor...');
    this._initializeEditor();
    
    if (umbilical.onMount) {
      console.log('📞 Calling umbilical onMount callback...');
      umbilical.onMount(this);
    }
    
    console.log('✅ NodeTypesDemo instance created successfully');
  }
  
  _createDemoUI() {
    // Create the main container with full HTML structure
    this.container = document.createElement('div');
    this.container.className = 'node-types-demo';
    this.container.innerHTML = `
      <div class="container">
        <div class="header">
          <h1>Node Types Customization Demo</h1>
          <p>Drag different node types from the palette to create a customized graph</p>
        </div>
        
        <div class="main-layout">
          <div class="sidebar">
            <div class="node-palette">
              <h3>Node Types</h3>
              
              <div class="node-type process" draggable="true" data-node-type="process">
                <div class="node-icon">□</div>
                <div class="node-info">
                  <h4>Process</h4>
                  <p>Standard process step</p>
                </div>
              </div>
              
              <div class="node-type decision" draggable="true" data-node-type="decision">
                <div class="node-icon">◇</div>
                <div class="node-info">
                  <h4>Decision</h4>
                  <p>Conditional branch</p>
                </div>
              </div>
              
              <div class="node-type data" draggable="true" data-node-type="data">
                <div class="node-icon">▱</div>
                <div class="node-info">
                  <h4>Data</h4>
                  <p>Input/Output data</p>
                </div>
              </div>
              
              <div class="node-type terminal" draggable="true" data-node-type="terminal">
                <div class="node-icon">●</div>
                <div class="node-info">
                  <h4>Terminal</h4>
                  <p>Start/End point</p>
                </div>
              </div>
              
              <div class="node-type document" draggable="true" data-node-type="document">
                <div class="node-icon">📄</div>
                <div class="node-info">
                  <h4>Document</h4>
                  <p>Document or report</p>
                </div>
              </div>
              
              <div class="node-type database" draggable="true" data-node-type="database">
                <div class="node-icon">🗄️</div>
                <div class="node-info">
                  <h4>Database</h4>
                  <p>Data storage</p>
                </div>
              </div>
            </div>
            
            <div class="properties-panel">
              <h3>Properties</h3>
              <div id="propertiesContent" class="no-selection">
                Select a node to edit properties
              </div>
            </div>
          </div>
          
          <div class="content">
            <div class="toolbar">
              <button id="selectBtn" class="primary">Select</button>
              <button id="connectBtn">Connect</button>
              <span style="width: 1px; height: 20px; background: #e5e7eb; margin: 0 5px;"></span>
              <button id="deleteBtn" disabled>Delete</button>
              <button id="undoBtn" disabled>Undo</button>
              <button id="redoBtn" disabled>Redo</button>
              <span style="width: 1px; height: 20px; background: #e5e7eb; margin: 0 5px;"></span>
              <button id="autoLayoutBtn">Auto Layout</button>
              <button id="exportBtn">Export JSON</button>
              <span style="flex: 1;"></span>
              <select id="rendererSelect">
                <option value="svg">SVG Renderer</option>
                <option value="canvas">Canvas Renderer</option>
              </select>
            </div>
            
            <div class="editor-container" id="editorContainer"></div>
            
            <div class="status-bar">
              <span>Nodes: <strong id="nodeCount">0</strong> | Edges: <strong id="edgeCount">0</strong></span>
              <span>Tool: <strong id="currentTool">select</strong></span>
            </div>
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
      .node-types-demo {
        width: 100%;
        height: 100%;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .node-types-demo .container {
        max-width: 1400px;
        margin: 0 auto;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      
      .node-types-demo .header {
        padding: 20px;
        background: #1e40af;
        color: white;
      }
      
      .node-types-demo .header h1 {
        margin: 0 0 10px 0;
        font-size: 24px;
      }
      
      .node-types-demo .header p {
        margin: 0;
        opacity: 0.9;
        font-size: 14px;
      }
      
      .node-types-demo .main-layout {
        display: flex;
        flex: 1;
        min-height: 0;
      }
      
      .node-types-demo .sidebar {
        width: 280px;
        background: #f8f9fa;
        border-right: 1px solid #e5e7eb;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }
      
      .node-types-demo .content {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      
      .node-types-demo .toolbar {
        display: flex;
        gap: 10px;
        padding: 15px;
        background: #f8f9fa;
        border-bottom: 1px solid #e5e7eb;
        align-items: center;
      }
      
      .node-types-demo .editor-container {
        flex: 1;
        position: relative;
        background: #fafafa;
        min-height: 0;
      }
      
      /* Node Type Styles */
      .node-types-demo .node-palette {
        padding: 15px;
      }
      
      .node-types-demo .node-palette h3 {
        margin: 0 0 15px 0;
        font-size: 14px;
        text-transform: uppercase;
        color: #6b7280;
        font-weight: 500;
      }
      
      .node-types-demo .node-type {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
        margin-bottom: 8px;
        background: white;
        border: 2px solid #e5e7eb;
        border-radius: 6px;
        cursor: move;
        transition: all 0.2s;
      }
      
      .node-types-demo .node-type:hover {
        border-color: #3b82f6;
        transform: translateX(2px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      
      .node-types-demo .node-type.dragging {
        opacity: 0.5;
      }
      
      .node-types-demo .node-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        font-size: 20px;
      }
      
      /* Node type specific colors */
      .node-types-demo .node-type.process .node-icon { background: #3b82f6; color: white; }
      .node-types-demo .node-type.decision .node-icon { background: #f59e0b; color: white; }
      .node-types-demo .node-type.data .node-icon { background: #10b981; color: white; }
      .node-types-demo .node-type.terminal .node-icon { background: #6366f1; color: white; }
      .node-types-demo .node-type.document .node-icon { background: #8b5cf6; color: white; }
      .node-types-demo .node-type.database .node-icon { background: #ef4444; color: white; }
      
      .node-types-demo .node-info {
        flex: 1;
      }
      
      .node-types-demo .node-info h4 {
        margin: 0 0 2px 0;
        font-size: 14px;
        font-weight: 600;
      }
      
      .node-types-demo .node-info p {
        margin: 0;
        font-size: 12px;
        color: #6b7280;
      }
      
      /* Controls */
      .node-types-demo button {
        padding: 6px 12px;
        border: 1px solid #d1d5db;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
      }
      
      .node-types-demo button:hover:not(:disabled) {
        background: #f3f4f6;
        border-color: #9ca3af;
      }
      
      .node-types-demo button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .node-types-demo button.primary {
        background: #3b82f6;
        color: white;
        border-color: #2563eb;
      }
      
      .node-types-demo button.primary:hover:not(:disabled) {
        background: #2563eb;
      }
      
      .node-types-demo select {
        padding: 6px 10px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 13px;
        background: white;
      }
      
      .node-types-demo .status-bar {
        display: flex;
        justify-content: space-between;
        padding: 8px 15px;
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
        font-size: 12px;
        color: #6b7280;
      }
      
      .node-types-demo .graph-editor {
        width: 100%;
        height: 100%;
      }
      
      /* Custom node rendering in graph */
      .node-types-demo .graph-editor svg {
        background: white;
      }
      
      /* Drag ghost */
      .node-types-demo .drag-ghost {
        position: fixed;
        pointer-events: none;
        opacity: 0.8;
        z-index: 1000;
        transform: translate(-50%, -50%);
      }
      
      /* Properties panel */
      .node-types-demo .properties-panel {
        padding: 15px;
        border-top: 1px solid #e5e7eb;
        flex: 1;
        min-height: 0;
      }
      
      .node-types-demo .properties-panel h3 {
        margin: 0 0 10px 0;
        font-size: 14px;
        text-transform: uppercase;
        color: #6b7280;
        font-weight: 500;
      }
      
      .node-types-demo .property {
        margin-bottom: 10px;
      }
      
      .node-types-demo .property label {
        display: block;
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 4px;
      }
      
      .node-types-demo .property input,
      .node-types-demo .property select {
        width: 100%;
        padding: 6px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 13px;
        box-sizing: border-box;
      }
      
      .node-types-demo .no-selection {
        text-align: center;
        color: #9ca3af;
        font-size: 13px;
        padding: 20px;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  _initializeEditor() {
    try {
      console.log('🎯 Initializing Graph Editor...');
      const container = this.container.querySelector('#editorContainer');
      console.log('📦 Editor container found:', !!container);
      
      this.editor = GraphEditor.create({
        dom: container,
        onModelChange: (type, data) => {
          this._updateStatus();
          
          // Handle selection changes for properties panel
          if (type === 'selectionChanged') {
            this._updatePropertiesPanel();
          }
        },
        onSelectionChange: (selection) => {
          this.selectedNodeId = selection.length === 1 ? selection[0] : null;
          this._updatePropertiesPanel();
          this._updateToolbarState();
        },
        onHistoryChange: () => {
          this._updateToolbarState();
        },
        onMount: (instance) => {
          console.log('🎉 Graph Editor mounted!');
          console.log('- Editor instance:', instance);
          this._setupTools(instance);
          this._setupCustomRendering(instance);
          this._createInitialGraph(instance);
          this._updateStatus();
          console.log('🎯 Setting up event handlers and drag & drop...');
          this._setupEventHandlers();
          this._setupDragAndDrop();
        },
        onError: (error) => {
          console.error('❌ Graph editor error:', error);
        }
      });
      
      console.log('✅ Graph Editor created, waiting for mount...');
      
    } catch (error) {
      console.error('❌ Editor initialization error:', error);
      console.error('Stack trace:', error.stack);
    }
  }
  
  _setupTools(editorInstance) {
    try {
      const coordinator = (editorInstance || this.editor).getViewModel().getEventCoordinator();
      
      coordinator.registerTool('select', new SelectTool());
      coordinator.registerTool('connect', new ConnectTool());
      coordinator.setActiveTool('select');
      
    } catch (error) {
      console.error('Tool setup error:', error);
    }
  }
  
  _setupCustomRendering(editorInstance) {
    try {
      console.log('🎨 Setting up custom rendering...');
      const view = (editorInstance || this.editor).getView();
      console.log('- View available:', !!view);
      
      if (!view) {
        console.log('❌ No view available, skipping custom rendering');
        return;
      }
      
      // Instead of overriding render, let's use a post-render callback approach
      const model = (editorInstance || this.editor).getModel();
      
      // Set up a mutation observer to customize nodes when they're added to DOM
      const customizeNodes = () => {
        console.log('🎨 Customizing nodes...');
        const svg = view.getContainer().querySelector('svg');
        if (!svg) return;
        
        const nodes = model.getSceneGraph().getAllNodes();
        console.log('- Found nodes to customize:', nodes.length);
        
        nodes.forEach(node => {
          if (node.getId() === 'root') return;
          
          const nodeData = node.getData() || {};
          const nodeType = nodeData.type || 'process';
          const typeConfig = this.nodeTypes[nodeType];
          
          console.log(`- Customizing node ${node.getId()} (type: ${nodeType})`);
          
          if (typeConfig) {
            const nodeEl = svg.querySelector(`[data-node-id="${node.getId()}"]`);
            if (nodeEl) {
              console.log(`  - Found SVG element for ${node.getId()}`);
              
              // Update shape color and style
              const rect = nodeEl.querySelector('rect');
              if (rect) {
                
                // Create SVG definitions for gradients and filters if not exists
                let defs = nodeEl.closest('svg').querySelector('defs');
                if (!defs) {
                  defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                  nodeEl.closest('svg').insertBefore(defs, nodeEl.closest('svg').firstChild);
                }
                
                const nodeId = node.getId();
                
                // Enhanced styling based on node type
                if (nodeType === 'process') {
                  // PROCESS: Blue gradient with shadow
                  console.log(`  - Creating enhanced PROCESS node for ${node.getId()}`);
                  
                  const gradientId = `processGradient_${nodeId}`;
                  let gradient = defs.querySelector(`#${gradientId}`);
                  if (!gradient) {
                    gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
                    gradient.setAttribute('id', gradientId);
                    gradient.setAttribute('x1', '0%');
                    gradient.setAttribute('y1', '0%');
                    gradient.setAttribute('x2', '0%');
                    gradient.setAttribute('y2', '100%');
                    
                    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    stop1.setAttribute('offset', '0%');
                    stop1.setAttribute('stop-color', '#60a5fa');
                    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    stop2.setAttribute('offset', '100%');
                    stop2.setAttribute('stop-color', '#1d4ed8');
                    
                    gradient.appendChild(stop1);
                    gradient.appendChild(stop2);
                    defs.appendChild(gradient);
                  }
                  
                  this._createDropShadow(defs, `processShadow_${nodeId}`, '3', '2', '4');
                  
                  rect.setAttribute('fill', `url(#${gradientId})`);
                  rect.setAttribute('stroke', '#1e40af');
                  rect.setAttribute('stroke-width', '2');
                  rect.setAttribute('rx', '12');
                  rect.setAttribute('ry', '12');
                  rect.setAttribute('filter', `url(#processShadow_${nodeId})`);
                  
                } else if (nodeType === 'decision') {
                  // DECISION: Gold radial gradient with glow effect
                  console.log(`  - Creating enhanced DECISION node for ${node.getId()}`);
                  
                  const gradientId = `decisionGradient_${nodeId}`;
                  let gradient = defs.querySelector(`#${gradientId}`);
                  if (!gradient) {
                    gradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
                    gradient.setAttribute('id', gradientId);
                    gradient.setAttribute('cx', '50%');
                    gradient.setAttribute('cy', '30%');
                    gradient.setAttribute('r', '70%');
                    
                    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    stop1.setAttribute('offset', '0%');
                    stop1.setAttribute('stop-color', '#fbbf24');
                    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    stop2.setAttribute('offset', '100%');
                    stop2.setAttribute('stop-color', '#d97706');
                    
                    gradient.appendChild(stop1);
                    gradient.appendChild(stop2);
                    defs.appendChild(gradient);
                  }
                  
                  this._createDropShadow(defs, `decisionShadow_${nodeId}`, '4', '3', '5');
                  this._createGlowFilter(defs, `decisionGlow_${nodeId}`, '#f59e0b', '2');
                  
                  // Transform to diamond
                  const width = parseFloat(rect.getAttribute('width')) || 100;
                  const height = parseFloat(rect.getAttribute('height')) || 100;
                  const cx = (parseFloat(rect.getAttribute('x')) || 0) + width / 2;
                  const cy = (parseFloat(rect.getAttribute('y')) || 0) + height / 2;
                  
                  rect.setAttribute('fill', `url(#${gradientId})`);
                  rect.setAttribute('stroke', '#d97706');
                  rect.setAttribute('stroke-width', '3');
                  rect.setAttribute('transform', `rotate(45 ${cx} ${cy})`);
                  rect.setAttribute('filter', `url(#decisionGlow_${nodeId})`);
                  
                } else if (nodeType === 'data') {
                  // DATA: Green parallelogram with pattern
                  console.log(`  - Creating enhanced DATA node for ${node.getId()}`);
                  
                  const gradientId = `dataGradient_${nodeId}`;
                  let gradient = defs.querySelector(`#${gradientId}`);
                  if (!gradient) {
                    gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
                    gradient.setAttribute('id', gradientId);
                    gradient.setAttribute('x1', '0%');
                    gradient.setAttribute('y1', '0%');
                    gradient.setAttribute('x2', '100%');
                    gradient.setAttribute('y2', '100%');
                    
                    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    stop1.setAttribute('offset', '0%');
                    stop1.setAttribute('stop-color', '#34d399');
                    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    stop2.setAttribute('offset', '100%');
                    stop2.setAttribute('stop-color', '#059669');
                    
                    gradient.appendChild(stop1);
                    gradient.appendChild(stop2);
                    defs.appendChild(gradient);
                  }
                  
                  this._createDropShadow(defs, `dataShadow_${nodeId}`, '2', '1', '3');
                  
                  // Create parallelogram shape
                  const width = parseFloat(rect.getAttribute('width')) || 120;
                  const height = parseFloat(rect.getAttribute('height')) || 60;
                  const x = parseFloat(rect.getAttribute('x')) || 0;
                  const y = parseFloat(rect.getAttribute('y')) || 0;
                  const skew = 20;
                  
                  rect.setAttribute('fill', `url(#${gradientId})`);
                  rect.setAttribute('stroke', '#047857');
                  rect.setAttribute('stroke-width', '2');
                  rect.setAttribute('transform', `skewX(-15)`);
                  rect.setAttribute('filter', `url(#dataShadow_${nodeId})`);
                  rect.setAttribute('rx', '8');
                  rect.setAttribute('ry', '8');
                  
                } else if (nodeType === 'terminal') {
                  // TERMINAL: Purple oval with metallic shine
                  console.log(`  - Creating enhanced TERMINAL node for ${node.getId()}`);
                  
                  const gradientId = `terminalGradient_${nodeId}`;
                  let gradient = defs.querySelector(`#${gradientId}`);
                  if (!gradient) {
                    gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
                    gradient.setAttribute('id', gradientId);
                    gradient.setAttribute('x1', '0%');
                    gradient.setAttribute('y1', '0%');
                    gradient.setAttribute('x2', '0%');
                    gradient.setAttribute('y2', '100%');
                    
                    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    stop1.setAttribute('offset', '0%');
                    stop1.setAttribute('stop-color', '#a78bfa');
                    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    stop2.setAttribute('offset', '50%');
                    stop2.setAttribute('stop-color', '#7c3aed');
                    const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    stop3.setAttribute('offset', '100%');
                    stop3.setAttribute('stop-color', '#5b21b6');
                    
                    gradient.appendChild(stop1);
                    gradient.appendChild(stop2);
                    gradient.appendChild(stop3);
                    defs.appendChild(gradient);
                  }
                  
                  this._createDropShadow(defs, `terminalShadow_${nodeId}`, '3', '2', '4');
                  
                  rect.setAttribute('fill', `url(#${gradientId})`);
                  rect.setAttribute('stroke', '#5b21b6');
                  rect.setAttribute('stroke-width', '3');
                  rect.setAttribute('rx', '50');
                  rect.setAttribute('ry', '50');
                  rect.setAttribute('filter', `url(#terminalShadow_${nodeId})`);
                  
                } else if (nodeType === 'document') {
                  // DOCUMENT: Paper-like with folded corner effect
                  console.log(`  - Creating enhanced DOCUMENT node for ${node.getId()}`);
                  
                  const gradientId = `documentGradient_${nodeId}`;
                  let gradient = defs.querySelector(`#${gradientId}`);
                  if (!gradient) {
                    gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
                    gradient.setAttribute('id', gradientId);
                    gradient.setAttribute('x1', '0%');
                    gradient.setAttribute('y1', '0%');
                    gradient.setAttribute('x2', '100%');
                    gradient.setAttribute('y2', '100%');
                    
                    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    stop1.setAttribute('offset', '0%');
                    stop1.setAttribute('stop-color', '#f8fafc');
                    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    stop2.setAttribute('offset', '100%');
                    stop2.setAttribute('stop-color', '#e2e8f0');
                    
                    gradient.appendChild(stop1);
                    gradient.appendChild(stop2);
                    defs.appendChild(gradient);
                  }
                  
                  this._createDropShadow(defs, `documentShadow_${nodeId}`, '2', '1', '2');
                  
                  rect.setAttribute('fill', `url(#${gradientId})`);
                  rect.setAttribute('stroke', '#8b5cf6');
                  rect.setAttribute('stroke-width', '2');
                  rect.setAttribute('rx', '4');
                  rect.setAttribute('ry', '4');
                  rect.setAttribute('filter', `url(#documentShadow_${nodeId})`);
                  
                  // Add folded corner effect
                  const width = parseFloat(rect.getAttribute('width')) || 100;
                  const height = parseFloat(rect.getAttribute('height')) || 80;
                  const x = parseFloat(rect.getAttribute('x')) || 0;
                  const y = parseFloat(rect.getAttribute('y')) || 0;
                  
                  const cornerSize = 15;
                  const corner = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                  corner.setAttribute('points', `${x + width - cornerSize},${y} ${x + width},${y} ${x + width},${y + cornerSize}`);
                  corner.setAttribute('fill', '#c4b5fd');
                  corner.setAttribute('stroke', '#8b5cf6');
                  corner.setAttribute('stroke-width', '1');
                  nodeEl.appendChild(corner);
                  
                } else if (nodeType === 'database') {
                  // DATABASE: Metallic cylinder with sheen
                  console.log(`  - Creating enhanced DATABASE node for ${node.getId()}`);
                  
                  const gradientId = `databaseGradient_${nodeId}`;
                  let gradient = defs.querySelector(`#${gradientId}`);
                  if (!gradient) {
                    gradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
                    gradient.setAttribute('id', gradientId);
                    gradient.setAttribute('cx', '30%');
                    gradient.setAttribute('cy', '30%');
                    gradient.setAttribute('r', '80%');
                    
                    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    stop1.setAttribute('offset', '0%');
                    stop1.setAttribute('stop-color', '#fca5a5');
                    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    stop2.setAttribute('offset', '70%');
                    stop2.setAttribute('stop-color', '#dc2626');
                    const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                    stop3.setAttribute('offset', '100%');
                    stop3.setAttribute('stop-color', '#991b1b');
                    
                    gradient.appendChild(stop1);
                    gradient.appendChild(stop2);
                    gradient.appendChild(stop3);
                    defs.appendChild(gradient);
                  }
                  
                  this._createDropShadow(defs, `databaseShadow_${nodeId}`, '4', '3', '6');
                  
                  rect.setAttribute('fill', `url(#${gradientId})`);
                  rect.setAttribute('stroke', '#991b1b');
                  rect.setAttribute('stroke-width', '3');
                  rect.setAttribute('rx', '15');
                  rect.setAttribute('ry', '15');
                  rect.setAttribute('filter', `url(#databaseShadow_${nodeId})`);
                  
                  // Add horizontal lines for cylinder effect
                  const width = parseFloat(rect.getAttribute('width')) || 80;
                  const height = parseFloat(rect.getAttribute('height')) || 100;
                  const x = parseFloat(rect.getAttribute('x')) || 0;
                  const y = parseFloat(rect.getAttribute('y')) || 0;
                  
                  for (let i = 1; i <= 2; i++) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', x + 10);
                    line.setAttribute('y1', y + (height / 3) * i);
                    line.setAttribute('x2', x + width - 10);
                    line.setAttribute('y2', y + (height / 3) * i);
                    line.setAttribute('stroke', '#991b1b');
                    line.setAttribute('stroke-width', '2');
                    line.setAttribute('opacity', '0.7');
                    nodeEl.appendChild(line);
                  }
                  
                }
                
                console.log(`  - Applied enhanced ${nodeType} styling to ${node.getId()}`);
              }
              
              // Update text color for contrast
              const texts = nodeEl.querySelectorAll('text');
              texts.forEach(text => {
                text.setAttribute('fill', 'white');
                text.setAttribute('font-weight', 'bold');
              });
              
              // Add type icon
              let icon = nodeEl.querySelector('.node-type-icon');
              if (!icon && typeConfig.icon && rect) {
                const iconText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                iconText.setAttribute('class', 'node-type-icon');
                
                // Safe parsing of rect attributes with fallbacks
                const rectX = parseFloat(rect.getAttribute('x')) || 0;
                const rectY = parseFloat(rect.getAttribute('y')) || 0;
                const rectWidth = parseFloat(rect.getAttribute('width')) || 100;
                const rectHeight = parseFloat(rect.getAttribute('height')) || 60;
                
                const iconX = rectX + rectWidth / 2;
                const iconY = rectY + rectHeight / 2 + 5; // Center vertically with slight offset
                
                iconText.setAttribute('x', iconX);
                iconText.setAttribute('y', iconY);
                iconText.setAttribute('text-anchor', 'middle');
                iconText.setAttribute('dominant-baseline', 'central');
                iconText.setAttribute('font-size', '16');
                iconText.setAttribute('fill', 'white');
                iconText.setAttribute('pointer-events', 'none');
                iconText.textContent = typeConfig.icon;
                nodeEl.appendChild(iconText);
                console.log(`  - Added icon ${typeConfig.icon} to ${node.getId()} at (${iconX}, ${iconY})`);
              }
            } else {
              console.log(`  - No SVG element found for ${node.getId()}`);
            }
          }
        });
      };
      
      // Call customization after a delay to ensure nodes are rendered
      this.customizeNodes = customizeNodes;
      
      // Set up observer for new nodes
      const container = view.getContainer();
      if (container) {
        const observer = new MutationObserver(() => {
          setTimeout(customizeNodes, 50);
        });
        observer.observe(container, { childList: true, subtree: true });
        this.renderObserver = observer;
      }
      
      console.log('✅ Custom rendering setup complete');
      
    } catch (error) {
      console.error('❌ Custom rendering setup error:', error);
      console.error('Stack trace:', error.stack);
    }
  }
  
  _createInitialGraph(editorInstance) {
    if (this.initialGraphCreated) {
      console.log('⚠️ Initial graph already created, skipping...');
      return;
    }
    
    try {
      console.log('🎨 Starting with EMPTY graph - no precanned data');
      this.initialGraphCreated = true;
      const model = (editorInstance || this.editor).getModel();
      
      // Start with completely empty graph - no nodes, no edges
      console.log('Empty graph ready - Model nodes:', model.getSceneGraph().getAllNodes().length, 'Edges:', model.getEdges().length);
      
      // Set node counter to start from 1
      this.nodeIdCounter = 1;
      console.log('🔢 Set nodeIdCounter to:', this.nodeIdCounter);
      
      // Update status for empty graph
      setTimeout(() => {
        this._updateStatus();
        console.log('✅ Empty graph ready for drag & drop');
      }, 50);
      
    } catch (error) {
      console.error('Initial graph setup error:', error);
    }
  }
  
  _setupDragAndDrop() {
    try {
      console.log('🔧 Setting up drag & drop...');
      const nodeTypeElements = this.container.querySelectorAll('.node-type');
      console.log('📋 Found node type elements:', nodeTypeElements.length);
      
      nodeTypeElements.forEach((nodeTypeEl, index) => {
        const nodeType = nodeTypeEl.dataset.nodeType;
        console.log(`📦 Setting up drag for node type ${index + 1}:`, nodeType);
        
        nodeTypeEl.addEventListener('dragstart', (e) => {
          console.log('🚀 DRAG START:', nodeType);
          console.log('- Event:', e);
          console.log('- DataTransfer available:', !!e.dataTransfer);
          
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('nodeType', nodeType);
          nodeTypeEl.classList.add('dragging');
          
          console.log('- Set data "nodeType":', nodeType);
          console.log('- Added dragging class');
          
          // Create custom drag image
          this.dragGhost = nodeTypeEl.cloneNode(true);
          this.dragGhost.classList.add('drag-ghost');
          document.body.appendChild(this.dragGhost);
          e.dataTransfer.setDragImage(this.dragGhost, 50, 25);
          console.log('- Created drag ghost');
        });
        
        nodeTypeEl.addEventListener('dragend', (e) => {
          console.log('🔚 DRAG END:', nodeType);
          nodeTypeEl.classList.remove('dragging');
          if (this.dragGhost) {
            this.dragGhost.remove();
            this.dragGhost = null;
            console.log('- Removed drag ghost');
          }
        });
      });
      
      const editorContainer = this.container.querySelector('#editorContainer');
      console.log('🎯 Editor container found:', !!editorContainer);
      
      editorContainer.addEventListener('dragover', (e) => {
        // Reduced logging - only log occasionally to avoid spam
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      });
      
      editorContainer.addEventListener('drop', (e) => {
        console.log('💥 DROP EVENT on editor container!');
        
        // Prevent multiple drops
        if (this.isDropping) {
          console.log('🚫 Drop already in progress, ignoring...');
          e.preventDefault();
          return;
        }
        
        this.isDropping = true;
        console.log('- Event:', e);
        console.log('- DataTransfer:', e.dataTransfer);
        
        e.preventDefault();
        
        const nodeType = e.dataTransfer.getData('nodeType');
        console.log('- Retrieved nodeType from dataTransfer:', nodeType);
        
        if (!nodeType) {
          console.error('❌ No nodeType data found in drop event!');
          console.log('- Available data types:', e.dataTransfer.types);
          this.isDropping = false;
          return;
        }
        
        const typeConfig = this.nodeTypes[nodeType];
        console.log('- Type config found:', !!typeConfig, typeConfig);
        
        const rect = editorContainer.getBoundingClientRect();
        console.log('- Editor container rect:', rect);
        
        // Calculate position in graph coordinates
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        console.log('- Drop position:', { x, y });
        console.log('- Client position:', { clientX: e.clientX, clientY: e.clientY });
        
        // Create new node
        const nodeData = {
          id: `node${this.nodeIdCounter++}`,
          position: { x, y },
          label: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} ${this.nodeIdCounter}`,
          size: typeConfig.defaultSize,
          data: { type: nodeType }
        };
        
        console.log('🎨 Creating SINGLE node with data:', nodeData);
        console.log('- Node ID:', nodeData.id);
        console.log('- Node position:', nodeData.position);
        console.log('- Node type:', nodeData.data.type);
        console.log('- Editor available:', !!this.editor);
        console.log('- ViewModel available:', !!this.editor?.getViewModel);
        
        // Get the model for this operation
        const model = this.editor.getModel();
        
        // Double-check we're only adding ONE node
        console.log('🔍 BEFORE ADD:');
        const beforeNodes = model.getSceneGraph().getAllNodes();
        console.log('- Total nodes before:', beforeNodes.length);
        console.log('- Node IDs before:', beforeNodes.map(n => n.getId()));
        
        console.log('🎯 ADDING SINGLE NODE...');
        
        try {
          console.log('📝 About to call model.addNode() with:', nodeData);
          const result = model.addNode(nodeData);
          console.log('✅ model.addNode() returned:', result);
          
          // Immediately check what happened
          console.log('🔍 IMMEDIATELY AFTER ADD:');
          const afterNodes = model.getSceneGraph().getAllNodes();
          console.log('- Total nodes after:', afterNodes.length);
          console.log('- Node IDs after:', afterNodes.map(n => n.getId()));
          console.log('- Expected increase: 1, Actual increase:', afterNodes.length - beforeNodes.length);
          
          // Check if we got the exact node we wanted
          const ourNode = model.getSceneGraph().getNodeById(nodeData.id);
          console.log('- Our specific node found:', !!ourNode);
          if (ourNode) {
            console.log('- Our node position:', ourNode.getPosition());
            console.log('- Our node label:', ourNode.getLabel());
            console.log('- Our node type:', ourNode.getData()?.type);
          }
          
          // Force update and render
          setTimeout(() => {
            console.log('🔄 Forcing render and status update...');
            this.editor.getViewModel().render();
            this._updateStatus();
            
            // Trigger custom node styling
            if (this.customizeNodes) {
              setTimeout(this.customizeNodes, 100);
            }
            
            // Check if node was actually added
            const allNodes = model.getSceneGraph().getAllNodes();
            console.log('📊 Total nodes in model after add:', allNodes.length);
            
            const svg = editorContainer.querySelector('svg');
            const svgNodes = svg.querySelectorAll('g.node');
            console.log('🎨 Total SVG nodes after render:', svgNodes.length);
            
            // Verify it's the right node
            const addedNode = model.getSceneGraph().getNodeById(nodeData.id);
            console.log('🎯 Added node found:', !!addedNode, addedNode?.getLabel());
            
            // Reset drop flag
            this.isDropping = false;
            console.log('✅ Drop completed, ready for next drop');
            
          }, 100);
          
        } catch (cmdError) {
          console.error('❌ Node addition failed:', cmdError);
          console.error('Stack trace:', cmdError.stack);
        }
      });
      
      console.log('✅ Drag & drop setup complete');
      
    } catch (error) {
      console.error('❌ Drag and drop setup error:', error);
      console.error('Stack trace:', error.stack);
    }
  }
  
  _setupEventHandlers() {
    // Tool buttons
    this.container.querySelector('#selectBtn').addEventListener('click', () => {
      if (!this.editor) return;
      this.editor.getViewModel().getEventCoordinator().setActiveTool('select');
      this.container.querySelector('#selectBtn').classList.add('primary');
      this.container.querySelector('#connectBtn').classList.remove('primary');
      this._updateStatus();
    });
    
    this.container.querySelector('#connectBtn').addEventListener('click', () => {
      if (!this.editor) return;
      this.editor.getViewModel().getEventCoordinator().setActiveTool('connect');
      this.container.querySelector('#connectBtn').classList.add('primary');
      this.container.querySelector('#selectBtn').classList.remove('primary');
      this._updateStatus();
    });
    
    this.container.querySelector('#deleteBtn').addEventListener('click', () => {
      if (!this.editor) return;
      const selection = this.editor.getViewModel().getSelection();
      selection.forEach(nodeId => {
        this.editor.getViewModel().executeCommandType('removeNode', { nodeId });
      });
    });
    
    this.container.querySelector('#undoBtn').addEventListener('click', () => {
      if (!this.editor) return;
      this.editor.getViewModel().undo();
    });
    
    this.container.querySelector('#redoBtn').addEventListener('click', () => {
      if (!this.editor) return;
      this.editor.getViewModel().redo();
    });
    
    this.container.querySelector('#autoLayoutBtn').addEventListener('click', () => {
      if (!this.editor) return;
      this.editor.getViewModel().applyLayout('dagre');
    });
    
    this.container.querySelector('#exportBtn').addEventListener('click', () => {
      if (!this.editor) return;
      const data = this.editor.getModel().toJSON();
      const json = JSON.stringify(data, null, 2);
      
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'graph-export.json';
      a.click();
      URL.revokeObjectURL(url);
    });
    
    this.container.querySelector('#rendererSelect').addEventListener('change', async (e) => {
      if (!this.editor) return;
      await this.editor.getView().setRendererType(e.target.value);
      this._setupCustomRendering(); // Re-apply custom rendering
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!this.editor) return;
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.editor.getViewModel().undo();
      }
      
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        this.editor.getViewModel().redo();
      }
      
      if (e.key === 'Delete') {
        const selection = this.editor.getViewModel().getSelection();
        selection.forEach(nodeId => {
          this.editor.getViewModel().executeCommandType('removeNode', { nodeId });
        });
      }
    });
  }
  
  _updateStatus() {
    if (!this.editor) return;
    
    try {
      const model = this.editor.getModel();
      const nodes = model.getSceneGraph().getAllNodes().filter(n => n.getId() !== 'root');
      const edges = model.getEdges();
      
      this.container.querySelector('#nodeCount').textContent = nodes.length;
      this.container.querySelector('#edgeCount').textContent = edges.length;
      this.container.querySelector('#currentTool').textContent = 
        this.editor.getViewModel().getEventCoordinator().getActiveTool().name;
        
    } catch (error) {
      console.error('Status update error:', error);
    }
  }
  
  _updateToolbarState() {
    if (!this.editor) return;
    
    try {
      const viewModel = this.editor.getViewModel();
      const hasSelection = viewModel.getSelection().length > 0;
      
      this.container.querySelector('#deleteBtn').disabled = !hasSelection;
      this.container.querySelector('#undoBtn').disabled = !viewModel.canUndo();
      this.container.querySelector('#redoBtn').disabled = !viewModel.canRedo();
      
    } catch (error) {
      console.error('Toolbar state update error:', error);
    }
  }
  
  _updatePropertiesPanel() {
    const propertiesContent = this.container.querySelector('#propertiesContent');
    
    if (!this.selectedNodeId || !this.editor) {
      propertiesContent.innerHTML = '<div class="no-selection">Select a node to edit properties</div>';
      return;
    }
    
    try {
      const node = this.editor.getModel().getSceneGraph().getNodeById(this.selectedNodeId);
      if (!node) return;
      
      const nodeData = node.getData() || {};
      const nodeType = nodeData.type || 'process';
      
      propertiesContent.innerHTML = `
        <div class="property">
          <label>ID</label>
          <input type="text" value="${node.getId()}" disabled>
        </div>
        <div class="property">
          <label>Label</label>
          <input type="text" id="nodeLabel" value="${node.getLabel() || ''}">
        </div>
        <div class="property">
          <label>Type</label>
          <select id="nodeType">
            ${Object.keys(this.nodeTypes).map(type => 
              `<option value="${type}" ${type === nodeType ? 'selected' : ''}>${type.charAt(0).toUpperCase() + type.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="property">
          <label>X Position</label>
          <input type="number" id="nodeX" value="${Math.round(node.getPosition().x)}">
        </div>
        <div class="property">
          <label>Y Position</label>
          <input type="number" id="nodeY" value="${Math.round(node.getPosition().y)}">
        </div>
      `;
      
      // Add event listeners for live editing
      this.container.querySelector('#nodeLabel').addEventListener('input', (e) => {
        node.setLabel(e.target.value);
        this.editor.getViewModel().render();
      });
      
      this.container.querySelector('#nodeType').addEventListener('change', (e) => {
        const newType = e.target.value;
        const newData = { ...nodeData, type: newType };
        node.setData(newData);
        
        // Update size based on type
        const typeConfig = this.nodeTypes[newType];
        if (typeConfig && typeConfig.defaultSize) {
          node.setSize(typeConfig.defaultSize.width, typeConfig.defaultSize.height);
        }
        
        this.editor.getViewModel().render();
      });
      
      this.container.querySelector('#nodeX').addEventListener('input', (e) => {
        const x = parseFloat(e.target.value);
        if (!isNaN(x)) {
          node.setPosition(x, node.getPosition().y);
          this.editor.getViewModel().render();
        }
      });
      
      this.container.querySelector('#nodeY').addEventListener('input', (e) => {
        const y = parseFloat(e.target.value);
        if (!isNaN(y)) {
          node.setPosition(node.getPosition().x, y);
          this.editor.getViewModel().render();
        }
      });
      
    } catch (error) {
      console.error('Properties panel update error:', error);
    }
  }
  
  // Helper methods for SVG effects
  _createDropShadow(defs, id, blur, dx, dy) {
    let shadow = defs.querySelector(`#${id}`);
    if (!shadow) {
      shadow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      shadow.setAttribute('id', id);
      shadow.setAttribute('x', '-50%');
      shadow.setAttribute('y', '-50%');
      shadow.setAttribute('width', '200%');
      shadow.setAttribute('height', '200%');
      
      const blurEl = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
      blurEl.setAttribute('in', 'SourceAlpha');
      blurEl.setAttribute('stdDeviation', blur);
      blurEl.setAttribute('result', 'blur');
      
      const offset = document.createElementNS('http://www.w3.org/2000/svg', 'feOffset');
      offset.setAttribute('in', 'blur');
      offset.setAttribute('dx', dx);
      offset.setAttribute('dy', dy);
      offset.setAttribute('result', 'offsetBlur');
      
      const merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
      const mergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
      mergeNode1.setAttribute('in', 'offsetBlur');
      const mergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
      mergeNode2.setAttribute('in', 'SourceGraphic');
      
      merge.appendChild(mergeNode1);
      merge.appendChild(mergeNode2);
      
      shadow.appendChild(blurEl);
      shadow.appendChild(offset);
      shadow.appendChild(merge);
      defs.appendChild(shadow);
    }
  }
  
  _createGlowFilter(defs, id, color, intensity) {
    let glow = defs.querySelector(`#${id}`);
    if (!glow) {
      glow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      glow.setAttribute('id', id);
      glow.setAttribute('x', '-50%');
      glow.setAttribute('y', '-50%');
      glow.setAttribute('width', '200%');
      glow.setAttribute('height', '200%');
      
      // Create glow effect
      const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
      blur.setAttribute('in', 'SourceGraphic');
      blur.setAttribute('stdDeviation', intensity);
      blur.setAttribute('result', 'coloredBlur');
      
      const flood = document.createElementNS('http://www.w3.org/2000/svg', 'feFlood');
      flood.setAttribute('flood-color', color);
      flood.setAttribute('flood-opacity', '0.6');
      flood.setAttribute('result', 'flood');
      
      const composite = document.createElementNS('http://www.w3.org/2000/svg', 'feComposite');
      composite.setAttribute('in', 'flood');
      composite.setAttribute('in2', 'coloredBlur');
      composite.setAttribute('operator', 'in');
      composite.setAttribute('result', 'glowEffect');
      
      const merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
      const mergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
      mergeNode1.setAttribute('in', 'glowEffect');
      const mergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
      mergeNode2.setAttribute('in', 'SourceGraphic');
      
      merge.appendChild(mergeNode1);
      merge.appendChild(mergeNode2);
      
      glow.appendChild(blur);
      glow.appendChild(flood);
      glow.appendChild(composite);
      glow.appendChild(merge);
      defs.appendChild(glow);
    }
  }

  // Public API
  getEditor() {
    return this.editor;
  }
  
  getNodeTypes() {
    return this.nodeTypes;
  }
  
  destroy() {
    if (this._destroyed) return;
    
    if (this.editor && this.editor.destroy) {
      this.editor.destroy();
    }
    
    if (this.dragGhost) {
      this.dragGhost.remove();
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