# Software Engineering Diagram Viewer - Design Document

## Executive Summary

The Software Engineering Diagram Viewer is a ShowMe module extension that provides sophisticated visualization capabilities for software architecture diagrams, data models, and dataflow diagrams. Built on the existing ShowMe MVVM architecture and leveraging the GraphEditor component infrastructure, this viewer offers professional-grade diagram rendering with pan/zoom, element inspection, and automatic layout capabilities.

## System Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────┐
│                  ShowMe Module                      │
├─────────────────────────────────────────────────────┤
│  DiagramRenderer (MVVM Component)                   │
│  ├── DiagramViewModel (State Management)            │
│  ├── DiagramView (Rendering & Interaction)          │
│  └── DiagramLayoutEngine (Client-side Layout)       │
├─────────────────────────────────────────────────────┤
│  GraphEditor Infrastructure (Reused)                │
│  ├── Transform (Pan/Zoom Mathematics)               │
│  ├── SVGRenderer (Vector Graphics)                  │
│  └── InteractionStateMachine (User Input)          │
└─────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
Backend (Data Only)           Frontend (All Interaction)
       │                              │
       ▼                              ▼
┌──────────────┐            ┌──────────────────┐
│ Diagram Data │───────────▶│ DiagramViewModel │
│   (JSON)     │            │  - Layout State  │
└──────────────┘            │  - View State    │
                            │  - Selection     │
                            └────────┬─────────┘
                                     │
                            ┌────────▼─────────┐
                            │   DiagramView    │
                            │  - Rendering     │
                            │  - Interaction   │
                            └──────────────────┘
```

## Core Components

### DiagramRenderer Component

The main umbilical component that integrates with ShowMe's rendering system.

**Responsibilities:**
- Umbilical protocol implementation
- MVVM component coordination
- ShowMe integration point
- Event propagation

**Key Methods:**
- `create(umbilical)` - Factory method following umbilical protocol
- `renderDiagram(data)` - Render diagram from data
- `exportDiagram(format)` - Export to various formats
- `destroy()` - Cleanup resources

### DiagramViewModel

Manages all diagram state on the frontend, including layout computation and view properties.

**State Properties:**
```javascript
{
  // Diagram Data
  nodes: Map<id, NodeData>,
  edges: Map<id, EdgeData>,
  
  // View State (Frontend Only)
  viewport: {
    zoom: number,
    panX: number,
    panY: number
  },
  
  // Layout State (Frontend Only)
  layout: {
    type: 'hierarchical' | 'force' | 'dagre',
    spacing: { x: number, y: number },
    direction: 'TB' | 'LR' | 'BT' | 'RL'
  },
  
  // Interaction State
  selection: Set<elementId>,
  hoveredElement: elementId | null,
  
  // Display Options
  theme: 'light' | 'dark',
  showGrid: boolean,
  showMinimap: boolean
}
```

**Key Methods:**
- `setDiagramData(data)` - Load diagram data
- `computeLayout()` - Calculate node positions
- `updateViewport(transform)` - Handle pan/zoom
- `selectElement(id)` - Manage selection
- `getVisibleElements()` - Viewport culling

### DiagramView

Handles all rendering and user interaction using SVG/Canvas.

**Rendering Pipeline:**
1. Viewport transformation
2. Element culling (only render visible)
3. Layer-based rendering (edges → nodes → labels)
4. Interaction overlay

**Key Methods:**
- `render()` - Main render loop
- `renderNode(node, context)` - Node rendering
- `renderEdge(edge, context)` - Edge rendering
- `handleInteraction(event)` - User input processing

### DiagramLayoutEngine

Client-side layout computation using Dagre.js for automatic positioning.

**Layout Algorithms:**
- **Hierarchical**: Top-down or left-right tree layouts
- **Force-directed**: Physics-based organic layouts
- **Dagre**: Directed acyclic graph layouts
- **Grid**: Manual grid-based positioning

**Key Methods:**
- `computeHierarchicalLayout(nodes, edges)`
- `computeForceLayout(nodes, edges)`
- `computeDagreLayout(nodes, edges)`
- `optimizeEdgeRouting(edges, nodes)`

## Data Models

### Diagram Data Structure (Backend → Frontend)

```javascript
{
  type: "dataflow" | "datamodel" | "architecture",
  metadata: {
    title: string,
    description: string,
    version: string,
    created: timestamp,
    modified: timestamp
  },
  nodes: [
    {
      id: string,
      type: "entity" | "process" | "datastore" | "external",
      label: string,
      metadata: {
        description?: string,
        properties?: object,
        tags?: string[]
      },
      style?: {
        shape: "rectangle" | "circle" | "diamond" | "cylinder",
        color?: string,
        icon?: string
      }
    }
  ],
  edges: [
    {
      id: string,
      source: nodeId,
      target: nodeId,
      type: "dataflow" | "association" | "dependency",
      label?: string,
      metadata?: {
        cardinality?: string,
        properties?: object
      },
      style?: {
        lineType: "solid" | "dashed" | "dotted",
        arrowHead?: "arrow" | "diamond" | "circle"
      }
    }
  ],
  groups?: [
    {
      id: string,
      label: string,
      nodeIds: string[],
      style?: object
    }
  ]
}
```

## User Interface

### Main View Components

```
┌─────────────────────────────────────────────────────────┐
│ ┌─────────┐  [Zoom In] [Zoom Out] [Fit] [Layout ▼]     │
│ │ Minimap │  ┌─────────────────────────────────────┐   │
│ └─────────┘  │                                     │   │
│              │         Main Canvas Area            │   │
│ ┌─────────┐  │                                     │   │
│ │         │  │    (Pannable/Zoomable Viewport)     │   │
│ │ Toolbox │  │                                     │   │
│ │         │  │                                     │   │
│ └─────────┘  └─────────────────────────────────────┘   │
│                                                         │
│ Properties Panel (When Element Selected)               │
└─────────────────────────────────────────────────────────┘
```

### Interaction Patterns

**Pan & Zoom:**
- Mouse drag: Pan viewport
- Mouse wheel: Zoom in/out
- Double-click: Zoom to fit
- Pinch gesture: Touch zoom

**Selection:**
- Click: Select single element
- Ctrl+Click: Multi-select
- Drag rectangle: Area select
- Escape: Clear selection

**Inspection:**
- Hover: Show tooltip
- Select: Show properties panel
- Double-click: Expand/collapse groups

## Integration Points

### ShowMe Integration

```javascript
// Register renderer with ShowMe
ShowMeRegistry.registerRenderer('diagram', {
  component: DiagramRenderer,
  contentTypes: ['application/vnd.legion.diagram+json'],
  priority: 100
});
```

### Handle System Integration

The diagram viewer integrates with the BaseHandle system for:
- Remote data loading
- State synchronization (if needed)
- Event propagation
- Resource management

### Component Reuse

**From GraphEditor:**
- Transform class for viewport math
- SVGRenderer for vector graphics
- InteractionStateMachine for input
- Tool system architecture

**From ShowMe:**
- BaseComponent patterns
- ViewModel state management
- Event handling patterns
- Theme system

## Rendering Strategy

### SVG-Based Rendering

Primary rendering using SVG for:
- Crisp vector graphics
- CSS styling support
- DOM event handling
- Text rendering quality

### Performance Optimizations

**Viewport Culling:**
- Only render visible elements
- Quadtree spatial indexing
- Level-of-detail (LOD) rendering

**Render Batching:**
- Group similar operations
- Minimize DOM mutations
- Use CSS transforms for pan/zoom

**Caching:**
- Cache computed layouts
- Memoize expensive calculations
- Reuse SVG elements

## Example Usage

### Basic Diagram Rendering

```javascript
// Backend provides diagram data
const diagramData = {
  type: "dataflow",
  metadata: {
    title: "User Authentication Flow"
  },
  nodes: [
    {
      id: "user",
      type: "external",
      label: "User",
      style: { shape: "circle" }
    },
    {
      id: "auth-service",
      type: "process",
      label: "Auth Service",
      style: { shape: "rectangle" }
    },
    {
      id: "user-db",
      type: "datastore",
      label: "User Database",
      style: { shape: "cylinder" }
    }
  ],
  edges: [
    {
      id: "e1",
      source: "user",
      target: "auth-service",
      type: "dataflow",
      label: "Login Request"
    },
    {
      id: "e2",
      source: "auth-service",
      target: "user-db",
      type: "dataflow",
      label: "Verify Credentials"
    }
  ]
};

// Frontend renders with ShowMe
showMe.render(diagramData, {
  renderer: 'diagram',
  options: {
    layout: 'hierarchical',
    direction: 'LR',
    theme: 'light'
  }
});
```

### Programmatic Interaction

```javascript
// Get diagram instance
const diagram = showMe.getRenderer('diagram');

// Programmatic navigation
diagram.zoomToFit();
diagram.panTo({ x: 100, y: 200 });
diagram.selectNode('auth-service');

// Export diagram
const svg = diagram.exportSVG();
const png = await diagram.exportPNG();
```

## Technical Implementation Details

### Layout Computation

**Dagre.js Integration:**
```javascript
import dagre from 'dagre';

function computeDagreLayout(nodes, edges, options) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: options.direction,
    ranksep: options.spacing.rank,
    nodesep: options.spacing.node
  });
  
  nodes.forEach(node => {
    g.setNode(node.id, {
      width: node.width,
      height: node.height
    });
  });
  
  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });
  
  dagre.layout(g);
  
  // Extract computed positions
  return extractPositions(g);
}
```

### Transform Mathematics

**Pan & Zoom Implementation:**
```javascript
class ViewportTransform {
  constructor() {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
  }
  
  zoom(factor, center) {
    const newScale = this.scale * factor;
    
    // Zoom around center point
    this.translateX = center.x - (center.x - this.translateX) * factor;
    this.translateY = center.y - (center.y - this.translateY) * factor;
    this.scale = newScale;
  }
  
  pan(deltaX, deltaY) {
    this.translateX += deltaX;
    this.translateY += deltaY;
  }
  
  toMatrix() {
    return `matrix(${this.scale},0,0,${this.scale},${this.translateX},${this.translateY})`;
  }
}
```

### Element Rendering

**Node Rendering Pipeline:**
```javascript
function renderNode(node, renderer) {
  const group = renderer.createGroup(node.id);
  
  // Render shape
  const shape = renderShape(node.style.shape, node);
  group.appendChild(shape);
  
  // Render label
  const label = renderLabel(node.label, node);
  group.appendChild(label);
  
  // Apply styling
  applyNodeStyle(group, node.style);
  
  // Add interaction handlers
  attachNodeHandlers(group, node);
  
  return group;
}
```

## Configuration Options

### Viewer Configuration

```javascript
{
  // Layout Options
  layout: {
    algorithm: 'dagre' | 'force' | 'hierarchical',
    direction: 'TB' | 'LR' | 'BT' | 'RL',
    spacing: {
      node: 50,
      rank: 100,
      edge: 20
    }
  },
  
  // Display Options
  display: {
    theme: 'light' | 'dark',
    showGrid: boolean,
    gridSize: number,
    showMinimap: boolean,
    minimapPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  },
  
  // Interaction Options
  interaction: {
    enablePan: boolean,
    enableZoom: boolean,
    enableSelection: boolean,
    enableTooltips: boolean,
    zoomLimits: { min: 0.1, max: 10 }
  },
  
  // Performance Options
  performance: {
    enableCulling: boolean,
    enableLOD: boolean,
    maxRenderElements: 1000
  }
}
```

## Testing Strategy

### Unit Tests
- ViewModel state management
- Layout algorithm correctness
- Transform calculations
- Data model validation

### Integration Tests
- ShowMe integration
- GraphEditor component reuse
- Event propagation
- Handle system interaction

### Visual Tests
- Rendering correctness
- Layout quality
- Interaction responsiveness
- Theme application

## Summary

The Software Engineering Diagram Viewer provides a professional-grade visualization solution for the ShowMe module, leveraging existing infrastructure while adding specialized capabilities for software diagrams. The frontend-only approach for layout and interaction ensures optimal performance and user experience, while the clean separation of concerns through MVVM architecture maintains code quality and testability.

The design maximizes reuse of existing Legion components, particularly the GraphEditor infrastructure, while seamlessly integrating with ShowMe's rendering pipeline. This approach minimizes development effort while delivering a feature-rich diagram visualization experience.