# Graph Editor Component Design Document

## 1. Overview

The Graph Editor is a sophisticated, high-performance component for visualizing and editing node-link diagrams. It follows the Umbilical Component Protocol and implements a clean MVVM architecture with a custom scene graph, dual rendering modes (SVG/Canvas), and a powerful interaction system based on the provided InteractionStateMachine.

### 1.1 Goals

- **Zero Dependencies** (except Dagre for layout algorithms)
- **High Performance**: Support for graphs with 10,000+ nodes
- **Clean Architecture**: MVVM pattern with clear separation of concerns
- **Flexible Rendering**: SVG for development/small graphs, Canvas for performance
- **Professional Interactions**: Powered by the provided InteractionStateMachine
- **Extensible**: Easy to add new node types, layouts, and renderers

### 1.2 Non-Goals

- Not a general-purpose drawing library
- Not a diagramming tool (no complex shapes, connectors)
- Not a graph database visualization (focus on editing, not exploration)

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Umbilical Interface                        │
│                     GraphEditor.create(umbilical)                 │
└─────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        │                                                       │
        ▼                                                       ▼
┌──────────────┐                                       ┌──────────────┐
│    Model     │                                       │     View     │
│              │                                       │              │
│ - SceneGraph │                                       │ - Renderer   │
│ - Nodes      │◄──────────────────────────────────────│ - Viewport   │
│ - Edges      │         ViewModel coordinates         │ - HitTesting │
│ - Layout     │                                       │              │
└──────────────┘                                       └──────────────┘
        ▲                                                       ▲
        │                   ┌──────────────┐                   │
        └───────────────────│  ViewModel   │───────────────────┘
                           │              │
                           │ - Selection  │
                           │ - Commands   │
                           │ - StateMachine│
                           └──────────────┘
```

## 3. Component Structure

### 3.1 Model Layer

The Model layer manages the graph data structure and notifies observers of changes.

```javascript
GraphModel
├── SceneGraph          // Hierarchical node tree
│   ├── Root Node       // Container for all elements
│   ├── Node Map        // O(1) node lookup by ID
│   └── Spatial Index   // QuadTree for efficient hit testing
├── Node                // Graph nodes
│   ├── ID              // Unique identifier
│   ├── Transform       // Position, scale, rotation
│   ├── Geometry        // Bounding box, shape
│   ├── Style           // Visual properties
│   └── Data            // User-defined payload
├── Edge                // Connections between nodes
│   ├── Source/Target   // Node references
│   ├── Points          // Path control points
│   └── Style           // Line style properties
└── Layout Manager      // Pluggable layout system
    └── Dagre Layout    // Default hierarchical layout
```

### 3.2 View Layer

The View layer handles rendering and user input.

```javascript
GraphView
├── Renderer            // Abstract renderer interface
│   ├── SVG Renderer    // DOM-based, good for debugging
│   └── Canvas Renderer // Pixel-based, high performance
├── Viewport Controller // Pan/zoom without D3
│   ├── Transform       // View transformation matrix
│   ├── Bounds          // Min/max zoom limits
│   └── Animation       // Smooth transitions
├── Hit Testing         // Efficient picking
│   ├── Screen to World // Coordinate conversion
│   ├── Point Test      // Single point hit test
│   └── Rectangle Test  // Area selection
└── Event Integration   // Container-level listeners only
    └── All events → InteractionStateMachine
```

### 3.3 ViewModel Layer

The ViewModel coordinates between Model and View, managing application state.

```javascript
GraphViewModel
├── InteractionStateMachine  // Your provided state machine
│   ├── Mouse Events         // All mouse interactions
│   ├── Touch Events         // Mobile support
│   ├── Drag Detection       // Threshold-based
│   └── Double-Click         // Automatic detection
├── Selection Manager        // Selected nodes/edges
│   ├── Single Select        // Click
│   ├── Multi Select         // Ctrl+Click
│   ├── Rectangle Select     // Drag selection
│   └── Select All           // Ctrl+A
├── Command Manager          // Undo/Redo system
│   ├── Command Stack        // Executed commands
│   ├── Undo Stack           // Reversed commands
│   └── Command Interface    // execute/undo/redo
└── Layout Coordinator       // Manages layout updates
    ├── Auto Layout          // On structure change
    ├── Manual Layout        // User-triggered
    └── Incremental Layout   // Partial updates
```

## 4. Scene Graph Design

### 4.1 Hierarchical Structure

```
SceneGraph (Root)
├── Background Layer
├── Edge Layer
│   └── Edge Groups (by type)
│       └── Individual Edges
├── Node Layer
│   └── Node Groups (by type)
│       └── Individual Nodes
└── Overlay Layer
    ├── Selection Indicators
    └── Drag Previews
```

### 4.2 Transform System

Each scene node has a transform that supports:
- **Translation**: Position in parent space
- **Scale**: Zoom level (usually only on root)
- **Rotation**: Optional, for special node types

```javascript
class Transform {
  constructor() {
    // 2D affine transform matrix [a, b, c, d, tx, ty]
    // | a  c  tx |
    // | b  d  ty |
    // | 0  0  1  |
    this.local = [1, 0, 0, 1, 0, 0];
    this.world = [1, 0, 0, 1, 0, 0];
  }
  
  // Transform point from local to world space
  transformPoint(x, y) {
    const [a, b, c, d, tx, ty] = this.world;
    return {
      x: a * x + c * y + tx,
      y: b * x + d * y + ty
    };
  }
  
  // Transform point from world to local space
  inverseTransformPoint(x, y) {
    const [a, b, c, d, tx, ty] = this.world;
    const det = a * d - b * c;
    return {
      x: (d * (x - tx) - c * (y - ty)) / det,
      y: (a * (y - ty) - b * (x - tx)) / det
    };
  }
}
```

### 4.3 Change Notification

The scene graph uses the observer pattern for efficient updates:

```javascript
class SceneGraph {
  notifyChange(changeType, data) {
    // Batch changes for efficiency
    if (!this.pendingChanges) {
      this.pendingChanges = [];
      requestAnimationFrame(() => this.flushChanges());
    }
    this.pendingChanges.push({ type: changeType, data });
  }
  
  flushChanges() {
    const changes = this.pendingChanges;
    this.pendingChanges = null;
    
    // Notify all observers
    this.observers.forEach(observer => observer(changes));
  }
}
```

## 5. Rendering System

### 5.1 Renderer Interface

Both SVG and Canvas renderers implement this interface:

```javascript
interface Renderer {
  // Lifecycle
  initialize(container: HTMLElement): void;
  destroy(): void;
  
  // Rendering
  render(sceneGraph: SceneGraph, viewport: Viewport): void;
  clear(): void;
  
  // Coordinate conversion
  screenToWorld(x: number, y: number): Point;
  worldToScreen(x: number, y: number): Point;
  
  // Hit testing support
  getElementAt(x: number, y: number): SceneNode | null;
}
```

### 5.2 SVG Renderer

Best for:
- Development and debugging
- Small to medium graphs (<1000 nodes)
- When you need CSS styling
- Interactive features (hover effects)

```javascript
class SvgRenderer {
  render(sceneGraph, viewport) {
    // Apply viewport transform to root group
    this.rootGroup.setAttribute('transform', 
      viewport.transform.toSvgMatrix());
    
    // Render edges first (behind nodes)
    sceneGraph.edges.forEach(edge => {
      const path = this.renderEdge(edge);
      this.edgeLayer.appendChild(path);
    });
    
    // Render nodes on top
    sceneGraph.nodes.forEach(node => {
      const element = this.renderNode(node);
      this.nodeLayer.appendChild(element);
    });
  }
  
  renderNode(node) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', node.transform.toSvgMatrix());
    g.setAttribute('data-node-id', node.id);
    
    // Render node shape
    const shape = this.createShape(node.geometry);
    shape.setAttribute('fill', node.style.fill);
    shape.setAttribute('stroke', node.style.stroke);
    g.appendChild(shape);
    
    // Render label if present
    if (node.label) {
      const text = this.createText(node.label);
      g.appendChild(text);
    }
    
    return g;
  }
}
```

### 5.3 Canvas Renderer

Best for:
- Large graphs (>1000 nodes)
- Performance-critical applications
- Smooth animations
- Memory-constrained environments

```javascript
class CanvasRenderer {
  render(sceneGraph, viewport) {
    const ctx = this.ctx;
    
    // Clear canvas
    ctx.clearRect(0, 0, this.width, this.height);
    
    // Apply viewport transform
    ctx.save();
    const [a, b, c, d, tx, ty] = viewport.transform.world;
    ctx.setTransform(a, b, c, d, tx, ty);
    
    // Render visible elements only
    const visibleBounds = viewport.getVisibleBounds();
    
    // Render edges
    sceneGraph.edges.forEach(edge => {
      if (this.isVisible(edge, visibleBounds)) {
        this.renderEdge(ctx, edge);
      }
    });
    
    // Render nodes
    sceneGraph.nodes.forEach(node => {
      if (this.isVisible(node, visibleBounds)) {
        this.renderNode(ctx, node);
      }
    });
    
    ctx.restore();
  }
  
  renderNode(ctx, node) {
    ctx.save();
    
    // Apply node transform
    const [a, b, c, d, tx, ty] = node.transform.world;
    ctx.transform(a, b, c, d, tx, ty);
    
    // Draw shape
    ctx.fillStyle = node.style.fill;
    ctx.strokeStyle = node.style.stroke;
    this.drawShape(ctx, node.geometry);
    
    // Draw label
    if (node.label) {
      ctx.fillStyle = node.style.textColor;
      ctx.font = node.style.font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, 0, 0);
    }
    
    ctx.restore();
  }
}
```

## 6. Event Handling System

### 6.1 Integration with InteractionStateMachine

All events flow through your state machine:

```javascript
class GraphView {
  setupEventListeners() {
    // Single event source - the container
    const container = this.container;
    
    // Mouse events
    container.addEventListener('mousedown', (e) => {
      const data = this.prepareEventData(e);
      this.stateMachine.handleMouseDown(
        data.position, 
        e.button, 
        data.node, 
        data.modifiers
      );
      this.processStateChange();
    });
    
    container.addEventListener('mousemove', (e) => {
      const data = this.prepareEventData(e);
      this.stateMachine.handleMouseMove(data.position);
      this.processStateChange();
    });
    
    container.addEventListener('mouseup', (e) => {
      const data = this.prepareEventData(e);
      this.stateMachine.handleMouseUp(data.position);
      this.processStateChange();
    });
    
    // Touch events
    container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const data = this.prepareEventData(touch);
      this.stateMachine.handleTouchStart(data.position, data.node);
      this.processStateChange();
    });
    
    // ... similar for touchmove, touchend
    
    // Wheel events (can bypass state machine for performance)
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.handleWheel(e);
    });
  }
  
  prepareEventData(event) {
    const rect = this.container.getBoundingClientRect();
    const position = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    
    // Hit test to find node under cursor
    const worldPos = this.viewport.screenToWorld(position.x, position.y);
    const node = this.hitTester.hitTest(worldPos);
    
    const modifiers = {
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
      meta: event.metaKey
    };
    
    return { position, node, modifiers };
  }
  
  processStateChange() {
    const action = this.stateMachine.getLastAction();
    
    switch (action) {
      case 'click':
        this.viewModel.handleClick(this.stateMachine.getClickData());
        break;
        
      case 'rightClick':
        this.viewModel.handleRightClick(this.stateMachine.getClickData());
        break;
        
      case 'dragStart':
        this.viewModel.handleDragStart(this.stateMachine.getDragData());
        break;
        
      case 'drag':
        this.viewModel.handleDrag(this.stateMachine.getDragData());
        break;
        
      case 'dragEnd':
        this.viewModel.handleDragEnd(this.stateMachine.getDragData());
        break;
        
      // Double-click is automatically detected!
      // No complex timing logic needed
    }
  }
}
```

### 6.2 Action Handlers in ViewModel

```javascript
class GraphViewModel {
  handleClick(clickData) {
    if (clickData.isDoubleClick) {
      this.handleDoubleClick(clickData.node, clickData.position);
      return;
    }
    
    if (clickData.node) {
      if (clickData.modifiers.ctrl) {
        this.toggleNodeSelection(clickData.node);
      } else {
        this.selectNode(clickData.node);
      }
    } else {
      this.clearSelection();
    }
  }
  
  handleDragStart(dragData) {
    if (dragData.node) {
      // Start node drag
      this.startNodeDrag(dragData.node, dragData.startPosition);
    } else if (dragData.modifiers.shift) {
      // Start rectangle selection
      this.startRectangleSelection(dragData.startPosition);
    } else {
      // Start viewport pan
      this.startPan(dragData.startPosition);
    }
  }
  
  handleDrag(dragData) {
    if (this.isDraggingNode) {
      this.updateNodePositions(dragData.delta);
    } else if (this.isSelectingRectangle) {
      this.updateSelectionRectangle(dragData.currentPosition);
    } else if (this.isPanning) {
      this.updateViewport(dragData.delta);
    }
  }
}
```

## 7. Hit Testing and Picking

### 7.1 Spatial Indexing

For efficient hit testing with large graphs:

```javascript
class QuadTree {
  constructor(bounds, maxObjects = 10, maxLevels = 5) {
    this.bounds = bounds;
    this.maxObjects = maxObjects;
    this.maxLevels = maxLevels;
    this.level = 0;
    this.objects = [];
    this.nodes = [];
  }
  
  insert(object) {
    if (this.nodes.length > 0) {
      const index = this.getIndex(object.bounds);
      if (index !== -1) {
        this.nodes[index].insert(object);
        return;
      }
    }
    
    this.objects.push(object);
    
    if (this.objects.length > this.maxObjects && 
        this.level < this.maxLevels) {
      this.split();
    }
  }
  
  retrieve(point) {
    const candidates = [];
    
    if (this.nodes.length > 0) {
      const index = this.getPointIndex(point);
      if (index !== -1) {
        candidates.push(...this.nodes[index].retrieve(point));
      }
    }
    
    candidates.push(...this.objects);
    return candidates;
  }
}
```

### 7.2 Hit Testing Algorithm

```javascript
class HitTester {
  constructor() {
    this.spatialIndex = new QuadTree({ x: 0, y: 0, w: 10000, h: 10000 });
  }
  
  hitTest(worldPoint) {
    // Get candidates from spatial index
    const candidates = this.spatialIndex.retrieve(worldPoint);
    
    // Sort by z-order (render order)
    candidates.sort((a, b) => b.zIndex - a.zIndex);
    
    // Test each candidate
    for (const node of candidates) {
      if (this.testNode(node, worldPoint)) {
        return node;
      }
    }
    
    return null;
  }
  
  testNode(node, worldPoint) {
    // Transform to node's local space
    const localPoint = node.transform.inverseTransformPoint(
      worldPoint.x, 
      worldPoint.y
    );
    
    // Test against node's geometry
    switch (node.geometry.type) {
      case 'rectangle':
        return this.testRectangle(localPoint, node.geometry);
      case 'circle':
        return this.testCircle(localPoint, node.geometry);
      case 'polygon':
        return this.testPolygon(localPoint, node.geometry);
    }
  }
  
  testRectangle(point, geometry) {
    const halfWidth = geometry.width / 2;
    const halfHeight = geometry.height / 2;
    return Math.abs(point.x) <= halfWidth && 
           Math.abs(point.y) <= halfHeight;
  }
}
```

## 8. Layout System

### 8.1 Layout Manager

Pluggable layout system with Dagre as the default:

```javascript
class LayoutManager {
  constructor() {
    this.layouts = new Map();
    this.registerLayout('dagre', new DagreLayout());
    this.currentLayout = 'dagre';
  }
  
  layout(sceneGraph, options = {}) {
    const layout = this.layouts.get(this.currentLayout);
    if (!layout) {
      throw new Error(`Unknown layout: ${this.currentLayout}`);
    }
    
    // Prepare layout input
    const layoutGraph = this.prepareLayoutGraph(sceneGraph);
    
    // Run layout algorithm
    const positions = layout.compute(layoutGraph, options);
    
    // Apply positions with animation
    this.applyPositions(sceneGraph, positions, options.animate);
  }
  
  prepareLayoutGraph(sceneGraph) {
    return {
      nodes: sceneGraph.nodes.map(node => ({
        id: node.id,
        width: node.geometry.width,
        height: node.geometry.height
      })),
      edges: sceneGraph.edges.map(edge => ({
        source: edge.source.id,
        target: edge.target.id
      }))
    };
  }
}
```

### 8.2 Dagre Integration

```javascript
class DagreLayout {
  compute(graph, options = {}) {
    const g = new dagre.graphlib.Graph();
    
    // Configure layout
    g.setGraph({
      rankdir: options.direction || 'TB',
      nodesep: options.nodeSpacing || 50,
      ranksep: options.rankSpacing || 100,
      marginx: options.marginX || 20,
      marginy: options.marginY || 20
    });
    
    g.setDefaultEdgeLabel(() => ({}));
    
    // Add nodes
    graph.nodes.forEach(node => {
      g.setNode(node.id, {
        width: node.width,
        height: node.height
      });
    });
    
    // Add edges
    graph.edges.forEach(edge => {
      g.setEdge(edge.source, edge.target);
    });
    
    // Compute layout
    dagre.layout(g);
    
    // Extract positions
    const positions = new Map();
    g.nodes().forEach(nodeId => {
      const node = g.node(nodeId);
      positions.set(nodeId, {
        x: node.x,
        y: node.y
      });
    });
    
    return positions;
  }
}
```

## 9. Pan and Zoom

### 9.1 Viewport Controller

Custom pan/zoom without D3:

```javascript
class ViewportController {
  constructor(container) {
    this.container = container;
    this.transform = new Transform();
    this.bounds = {
      minZoom: 0.1,
      maxZoom: 10,
      padding: 50
    };
  }
  
  // Zoom at specific point
  zoomAt(screenX, screenY, scaleDelta) {
    // Get world point under cursor
    const worldPoint = this.screenToWorld(screenX, screenY);
    
    // Apply scale
    const currentScale = this.transform.getScale();
    const newScale = Math.max(
      this.bounds.minZoom,
      Math.min(this.bounds.maxZoom, currentScale * scaleDelta)
    );
    
    this.transform.setScale(newScale);
    
    // Adjust translation to keep world point under cursor
    const newScreenPoint = this.worldToScreen(worldPoint.x, worldPoint.y);
    this.transform.translate(
      screenX - newScreenPoint.x,
      screenY - newScreenPoint.y
    );
    
    this.notifyChange();
  }
  
  // Pan by delta
  pan(dx, dy) {
    this.transform.translate(dx, dy);
    this.notifyChange();
  }
  
  // Fit content to view
  fitToView(contentBounds, padding = 50) {
    const viewBounds = this.getViewBounds();
    
    // Calculate scale to fit content
    const scaleX = (viewBounds.width - padding * 2) / contentBounds.width;
    const scaleY = (viewBounds.height - padding * 2) / contentBounds.height;
    const scale = Math.min(scaleX, scaleY);
    
    // Center content
    const centerX = viewBounds.width / 2;
    const centerY = viewBounds.height / 2;
    const contentCenterX = contentBounds.x + contentBounds.width / 2;
    const contentCenterY = contentBounds.y + contentBounds.height / 2;
    
    this.transform.identity();
    this.transform.translate(centerX, centerY);
    this.transform.scale(scale, scale);
    this.transform.translate(-contentCenterX, -contentCenterY);
    
    this.notifyChange();
  }
}
```

### 9.2 Smooth Animations

```javascript
class ViewportAnimator {
  animateTo(targetTransform, duration = 300) {
    const startTransform = [...this.viewport.transform.local];
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      // Interpolate transform
      for (let i = 0; i < 6; i++) {
        this.viewport.transform.local[i] = 
          startTransform[i] + 
          (targetTransform[i] - startTransform[i]) * eased;
      }
      
      this.viewport.transform.updateWorld();
      this.viewport.notifyChange();
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }
}
```

## 10. Selection System

### 10.1 Selection Manager

```javascript
class SelectionManager {
  constructor() {
    this.selectedNodes = new Set();
    this.selectedEdges = new Set();
    this.selectionMode = 'replace'; // replace, add, toggle
  }
  
  selectNode(node, mode = this.selectionMode) {
    switch (mode) {
      case 'replace':
        this.clear();
        this.selectedNodes.add(node);
        break;
        
      case 'add':
        this.selectedNodes.add(node);
        break;
        
      case 'toggle':
        if (this.selectedNodes.has(node)) {
          this.selectedNodes.delete(node);
        } else {
          this.selectedNodes.add(node);
        }
        break;
    }
    
    this.notifyChange();
  }
  
  selectNodesInRectangle(worldRect) {
    const nodes = this.sceneGraph.getNodesInBounds(worldRect);
    
    nodes.forEach(node => {
      this.selectedNodes.add(node);
    });
    
    this.notifyChange();
  }
  
  selectAll() {
    this.sceneGraph.nodes.forEach(node => {
      this.selectedNodes.add(node);
    });
    
    this.notifyChange();
  }
  
  clear() {
    this.selectedNodes.clear();
    this.selectedEdges.clear();
    this.notifyChange();
  }
}
```

### 10.2 Visual Feedback

```javascript
class SelectionRenderer {
  renderSelection(renderer, selection) {
    selection.selectedNodes.forEach(node => {
      this.renderNodeSelection(renderer, node);
    });
    
    selection.selectedEdges.forEach(edge => {
      this.renderEdgeSelection(renderer, edge);
    });
  }
  
  renderNodeSelection(renderer, node) {
    if (renderer instanceof SvgRenderer) {
      const rect = renderer.createElement('rect', {
        x: node.bounds.x - 4,
        y: node.bounds.y - 4,
        width: node.bounds.width + 8,
        height: node.bounds.height + 8,
        fill: 'none',
        stroke: '#0066ff',
        'stroke-width': 2,
        'stroke-dasharray': '5,5',
        class: 'selection-indicator'
      });
      renderer.selectionLayer.appendChild(rect);
      
    } else if (renderer instanceof CanvasRenderer) {
      const ctx = renderer.ctx;
      ctx.save();
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        node.bounds.x - 4,
        node.bounds.y - 4,
        node.bounds.width + 8,
        node.bounds.height + 8
      );
      ctx.restore();
    }
  }
}
```

## 11. Command Pattern (Undo/Redo)

### 11.1 Command Interface

```javascript
class Command {
  execute() {
    throw new Error('Command.execute() must be implemented');
  }
  
  undo() {
    throw new Error('Command.undo() must be implemented');
  }
  
  // Optional: for command merging
  canMergeWith(other) {
    return false;
  }
  
  mergeWith(other) {
    throw new Error('Command.mergeWith() must be implemented');
  }
}
```

### 11.2 Example Commands

```javascript
class MoveNodesCommand extends Command {
  constructor(nodes, delta) {
    super();
    this.nodes = nodes;
    this.delta = delta;
  }
  
  execute() {
    this.nodes.forEach(node => {
      const pos = node.transform.getPosition();
      node.transform.setPosition(pos.x + this.delta.x, pos.y + this.delta.y);
    });
  }
  
  undo() {
    this.nodes.forEach(node => {
      const pos = node.transform.getPosition();
      node.transform.setPosition(pos.x - this.delta.x, pos.y - this.delta.y);
    });
  }
  
  canMergeWith(other) {
    return other instanceof MoveNodesCommand &&
           this.nodes.length === other.nodes.length &&
           this.nodes.every(node => other.nodes.includes(node));
  }
  
  mergeWith(other) {
    this.delta.x += other.delta.x;
    this.delta.y += other.delta.y;
  }
}

class AddNodeCommand extends Command {
  constructor(sceneGraph, nodeData) {
    super();
    this.sceneGraph = sceneGraph;
    this.nodeData = nodeData;
    this.node = null;
  }
  
  execute() {
    this.node = this.sceneGraph.createNode(this.nodeData);
    this.sceneGraph.addNode(this.node);
  }
  
  undo() {
    this.sceneGraph.removeNode(this.node);
  }
}
```

### 11.3 Command Manager

```javascript
class CommandManager {
  constructor(maxHistorySize = 100) {
    this.history = [];
    this.currentIndex = -1;
    this.maxHistorySize = maxHistorySize;
  }
  
  execute(command) {
    // Remove any commands after current index
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Try to merge with previous command
    if (this.currentIndex >= 0) {
      const lastCommand = this.history[this.currentIndex];
      if (lastCommand.canMergeWith(command)) {
        lastCommand.mergeWith(command);
        command.execute();
        return;
      }
    }
    
    // Execute and add to history
    command.execute();
    this.history.push(command);
    this.currentIndex++;
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
      this.currentIndex = this.history.length - 1;
    }
  }
  
  undo() {
    if (this.canUndo()) {
      const command = this.history[this.currentIndex];
      command.undo();
      this.currentIndex--;
      return true;
    }
    return false;
  }
  
  redo() {
    if (this.canRedo()) {
      this.currentIndex++;
      const command = this.history[this.currentIndex];
      command.execute();
      return true;
    }
    return false;
  }
  
  canUndo() {
    return this.currentIndex >= 0;
  }
  
  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }
}
```

## 12. Performance Optimizations

### 12.1 Rendering Optimizations

1. **Viewport Culling**: Only render visible elements
2. **Level of Detail**: Simplify rendering for zoomed-out views
3. **Dirty Rectangle**: Only update changed regions
4. **Frame Rate Limiting**: Cap updates to 60 FPS

```javascript
class PerformanceOptimizer {
  constructor() {
    this.frameTime = 1000 / 60; // Target 60 FPS
    this.lastFrameTime = 0;
    this.dirtyRegions = [];
  }
  
  shouldRender() {
    const now = performance.now();
    if (now - this.lastFrameTime < this.frameTime) {
      return false;
    }
    this.lastFrameTime = now;
    return true;
  }
  
  markDirty(bounds) {
    this.dirtyRegions.push(bounds);
  }
  
  getVisibleElements(sceneGraph, viewport) {
    const visibleBounds = viewport.getVisibleBounds();
    
    return {
      nodes: sceneGraph.nodes.filter(node => 
        this.intersects(node.worldBounds, visibleBounds)
      ),
      edges: sceneGraph.edges.filter(edge =>
        this.intersects(edge.worldBounds, visibleBounds)
      )
    };
  }
  
  getLevelOfDetail(viewport) {
    const scale = viewport.getScale();
    
    if (scale < 0.3) return 'low';
    if (scale < 0.7) return 'medium';
    return 'high';
  }
}
```

### 12.2 Memory Optimizations

1. **Object Pooling**: Reuse objects to reduce GC pressure
2. **Lazy Loading**: Load node details on demand
3. **Image Caching**: Cache rendered nodes as images
4. **Spatial Index Cleanup**: Periodically rebuild spatial index

```javascript
class ObjectPool {
  constructor(factory, resetFn, maxSize = 1000) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
    this.available = [];
    this.inUse = new Set();
  }
  
  acquire() {
    let obj;
    
    if (this.available.length > 0) {
      obj = this.available.pop();
    } else {
      obj = this.factory();
    }
    
    this.inUse.add(obj);
    return obj;
  }
  
  release(obj) {
    if (!this.inUse.has(obj)) return;
    
    this.inUse.delete(obj);
    this.resetFn(obj);
    
    if (this.available.length < this.maxSize) {
      this.available.push(obj);
    }
  }
}
```

## 13. API Design

### 13.1 Umbilical Interface

```javascript
GraphEditor.create({
  // Required
  dom: HTMLElement,           // Container element
  
  // Optional - Data
  nodes: Node[],              // Initial nodes
  edges: Edge[],              // Initial edges
  
  // Optional - Callbacks
  onSelectionChange: (selection: Selection) => void,
  onNodeClick: (node: Node, event: ClickEvent) => void,
  onNodeDoubleClick: (node: Node, event: ClickEvent) => void,
  onNodeDrag: (nodes: Node[], delta: Point) => void,
  onGraphChange: (change: GraphChange) => void,
  onLayoutComplete: (layout: string) => void,
  
  // Optional - Configuration
  renderMode: 'svg' | 'canvas' | 'auto',  // Default: 'auto'
  layout: 'dagre' | 'none',               // Default: 'dagre'
  layoutOptions: LayoutOptions,           // Layout-specific options
  
  // Optional - Interaction
  dragThreshold: number,                  // Pixels before drag starts
  doubleClickThreshold: number,           // Milliseconds for double-click
  enablePanZoom: boolean,                 // Default: true
  enableNodeDragging: boolean,            // Default: true
  enableSelection: boolean,               // Default: true
  
  // Optional - Performance
  maxNodes: number,                       // Switch to canvas if exceeded
  enableSpatialIndex: boolean,            // Default: true
  enableLevelOfDetail: boolean            // Default: true
});
```

### 13.2 Public Methods

```javascript
const graphEditor = GraphEditor.create(umbilical);

// Graph manipulation
graphEditor.addNode(nodeData);
graphEditor.addEdge(sourceId, targetId, edgeData);
graphEditor.removeNode(nodeId);
graphEditor.removeEdge(edgeId);
graphEditor.updateNode(nodeId, updates);
graphEditor.clear();

// Layout
graphEditor.layout(layoutName?, options?);
graphEditor.setLayoutOptions(options);

// Selection
graphEditor.selectNode(nodeId);
graphEditor.selectNodes(nodeIds);
graphEditor.getSelection();
graphEditor.clearSelection();

// View control
graphEditor.fitToView(padding?);
graphEditor.zoomTo(scale, center?);
graphEditor.panTo(x, y);
graphEditor.centerNode(nodeId);

// Undo/Redo
graphEditor.undo();
graphEditor.redo();
graphEditor.canUndo();
graphEditor.canRedo();

// Export
graphEditor.toJSON();
graphEditor.exportSVG();
graphEditor.exportPNG();

// Lifecycle
graphEditor.destroy();
```

## 14. Example Usage

### 14.1 Basic Graph

```javascript
const editor = GraphEditor.create({
  dom: document.getElementById('graph-container'),
  
  nodes: [
    { id: 'A', label: 'Node A', x: 100, y: 100 },
    { id: 'B', label: 'Node B', x: 300, y: 100 },
    { id: 'C', label: 'Node C', x: 200, y: 250 }
  ],
  
  edges: [
    { source: 'A', target: 'B' },
    { source: 'B', target: 'C' },
    { source: 'C', target: 'A' }
  ],
  
  onNodeClick: (node) => {
    console.log('Clicked:', node.id);
  },
  
  onNodeDoubleClick: (node) => {
    node.label = prompt('New label:', node.label);
    editor.updateNode(node.id, { label: node.label });
  }
});

// Auto-layout
editor.layout('dagre', { direction: 'LR' });
```

### 14.2 Interactive Features

```javascript
const editor = GraphEditor.create({
  dom: container,
  renderMode: 'auto',
  
  onSelectionChange: (selection) => {
    updatePropertiesPanel(selection.nodes);
  },
  
  onNodeDrag: (nodes, delta) => {
    // Snap to grid
    const gridSize = 10;
    delta.x = Math.round(delta.x / gridSize) * gridSize;
    delta.y = Math.round(delta.y / gridSize) * gridSize;
  },
  
  onGraphChange: (change) => {
    // Auto-save
    saveToServer(editor.toJSON());
  }
});

// Add context menu
container.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  
  const { position, node } = editor.getInteractionData(e);
  
  if (node) {
    showNodeContextMenu(node, position);
  } else {
    showCanvasContextMenu(position);
  }
});
```

### 14.3 Performance Mode

```javascript
const editor = GraphEditor.create({
  dom: container,
  renderMode: 'canvas', // Force canvas for performance
  maxNodes: 10000,
  enableLevelOfDetail: true,
  
  onGraphChange: (change) => {
    // Debounce layout for performance
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(() => {
      editor.layout('dagre', { animate: false });
    }, 500);
  }
});

// Load large graph
fetch('/api/large-graph')
  .then(res => res.json())
  .then(data => {
    editor.addNodes(data.nodes);
    editor.addEdges(data.edges);
    editor.fitToView();
  });
```

## 15. Testing Strategy

### 15.1 Unit Tests

- Transform math (matrix operations, coordinate conversions)
- Hit testing algorithms
- Scene graph operations
- Command pattern implementation
- State machine integration

### 15.2 Integration Tests

- MVVM data flow
- Event handling through InteractionStateMachine
- Renderer switching
- Layout integration
- Selection system

### 15.3 Performance Tests

- Rendering performance with N nodes
- Hit testing performance
- Layout computation time
- Memory usage over time

## 16. Future Enhancements

### 16.1 Additional Features

- Edge routing algorithms (orthogonal, curved)
- Node grouping/clustering
- Minimap navigation
- Search and filter
- Animation system
- Theming support

### 16.2 Additional Layouts

- Force-directed layout
- Circular layout
- Tree layout
- Custom layout API

### 16.3 Advanced Interactions

- Edge creation by dragging
- Node resizing
- Inline editing
- Gesture support
- Keyboard navigation

## 17. Conclusion

This Graph Editor component provides a professional, performant solution for graph visualization and editing. By leveraging your clean InteractionStateMachine and avoiding bloated dependencies, we achieve a maintainable codebase that can scale from simple diagrams to complex networks with thousands of nodes.

The MVVM architecture ensures clean separation of concerns, while the umbilical pattern maintains consistency with the rest of the component library. The dual rendering system provides the best of both worlds: SVG for development and small graphs, Canvas for production and large datasets.