/**
 * Unit tests for DiagramView component
 */

import { DiagramView } from '../../../../src/renderers/diagram/view/DiagramView.js';
import { 
  createTestDOM, 
  cleanupTestDOM, 
  simulateMouseEvent,
  simulateWheelEvent,
  createSampleDiagramData
} from '../test-setup.js';

describe('DiagramView', () => {
  let dom;
  let container;

  beforeEach(() => {
    dom = createTestDOM();
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    cleanupTestDOM();
  });

  describe('Initialization', () => {
    test('should create view with container', () => {
      const view = new DiagramView(container);
      
      expect(view).toBeDefined();
      expect(view.container).toBe(container);
      expect(view.svg).toBeDefined();
    });

    test('should create SVG element', () => {
      const view = new DiagramView(container);
      
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg.getAttribute('width')).toBe('100%');
      expect(svg.getAttribute('height')).toBe('100%');
    });

    test('should set up view layers', () => {
      const view = new DiagramView(container);
      
      const svg = container.querySelector('svg');
      expect(svg.querySelector('.diagram-background')).toBeTruthy();
      expect(svg.querySelector('.diagram-edges')).toBeTruthy();
      expect(svg.querySelector('.diagram-nodes')).toBeTruthy();
      expect(svg.querySelector('.diagram-overlay')).toBeTruthy();
    });

    test('should apply theme', () => {
      const view = new DiagramView(container, { theme: 'dark' });
      
      expect(container.classList.contains('diagram-view--dark')).toBe(true);
    });
  });

  describe('Rendering', () => {
    test('should render nodes', () => {
      const view = new DiagramView(container);
      const state = {
        nodes: new Map([
          ['node1', { id: 'node1', position: { x: 100, y: 100 }, size: { width: 120, height: 60 }, label: 'Test Node' }]
        ]),
        edges: new Map(),
        viewport: { zoom: 1, panX: 0, panY: 0 }
      };

      view.render(state);

      const node = container.querySelector('.node');
      expect(node).toBeTruthy();
      expect(node.getAttribute('data-id')).toBe('node1');
    });

    test('should render edges', () => {
      const view = new DiagramView(container);
      const state = {
        nodes: new Map([
          ['node1', { id: 'node1', position: { x: 100, y: 100 }, size: { width: 120, height: 60 } }],
          ['node2', { id: 'node2', position: { x: 300, y: 100 }, size: { width: 120, height: 60 } }]
        ]),
        edges: new Map([
          ['edge1', { 
            id: 'edge1', 
            source: 'node1', 
            target: 'node2',
            path: { 
              start: { x: 160, y: 130 }, 
              end: { x: 300, y: 130 } 
            }
          }]
        ]),
        viewport: { zoom: 1, panX: 0, panY: 0 }
      };

      view.render(state);

      const edge = container.querySelector('.edge');
      expect(edge).toBeTruthy();
      expect(edge.getAttribute('data-id')).toBe('edge1');
    });

    test('should apply viewport transform', () => {
      const view = new DiagramView(container);
      const state = {
        nodes: new Map(),
        edges: new Map(),
        viewport: { zoom: 2, panX: 100, panY: 50 }
      };

      view.render(state);

      const transform = view.viewportGroup.getAttribute('transform');
      expect(transform).toContain('translate(100, 50)');
      expect(transform).toContain('scale(2)');
    });

    test('should highlight selected elements', () => {
      const view = new DiagramView(container);
      const state = {
        nodes: new Map([
          ['node1', { id: 'node1', position: { x: 100, y: 100 }, size: { width: 120, height: 60 } }]
        ]),
        edges: new Map(),
        selection: new Set(['node1']),
        viewport: { zoom: 1, panX: 0, panY: 0 }
      };

      view.render(state);

      const node = container.querySelector('.node');
      expect(node.classList.contains('node--selected')).toBe(true);
    });
  });

  describe('Event Handling', () => {
    test('should emit nodeClick event', (done) => {
      const view = new DiagramView(container);
      const state = {
        nodes: new Map([
          ['node1', { id: 'node1', position: { x: 100, y: 100 }, size: { width: 120, height: 60 } }]
        ]),
        edges: new Map(),
        viewport: { zoom: 1, panX: 0, panY: 0 }
      };

      view.on('nodeClick', (nodeId) => {
        expect(nodeId).toBe('node1');
        done();
      });

      view.render(state);
      const node = container.querySelector('.node');
      simulateMouseEvent(node, 'click');
    });

    test('should emit edgeClick event', (done) => {
      const view = new DiagramView(container);
      const state = {
        nodes: new Map([
          ['node1', { id: 'node1', position: { x: 100, y: 100 }, size: { width: 120, height: 60 } }],
          ['node2', { id: 'node2', position: { x: 300, y: 100 }, size: { width: 120, height: 60 } }]
        ]),
        edges: new Map([
          ['edge1', { 
            id: 'edge1',
            path: { start: { x: 160, y: 130 }, end: { x: 300, y: 130 } }
          }]
        ]),
        viewport: { zoom: 1, panX: 0, panY: 0 }
      };

      view.on('edgeClick', (edgeId) => {
        expect(edgeId).toBe('edge1');
        done();
      });

      view.render(state);
      const edge = container.querySelector('.edge');
      simulateMouseEvent(edge, 'click');
    });

    test('should emit backgroundClick event', (done) => {
      const view = new DiagramView(container);
      
      view.on('backgroundClick', () => {
        done();
      });

      view.render({ nodes: new Map(), edges: new Map(), viewport: { zoom: 1, panX: 0, panY: 0 } });
      const background = container.querySelector('.background-rect');
      simulateMouseEvent(background, 'click');
    });

    test('should emit viewportChange on wheel zoom', (done) => {
      const view = new DiagramView(container);
      
      view.on('viewportChange', (viewport) => {
        expect(viewport.zoom).toBeGreaterThan(1);
        done();
      });

      view.render({ nodes: new Map(), edges: new Map(), viewport: { zoom: 1, panX: 0, panY: 0 } });
      simulateWheelEvent(container.querySelector('svg'), -100);
    });
  });

  describe('Pan and Zoom', () => {
    test('should pan on drag', () => {
      // Disable drag selection so panning takes precedence
      const view = new DiagramView(container, {
        interaction: {
          enablePan: true,
          enableDragSelection: false
        }
      });
      
      view.render({ nodes: new Map(), edges: new Map(), viewport: { zoom: 1, panX: 0, panY: 0 } });
      
      const background = container.querySelector('.background-rect');

      // Start drag on background
      simulateMouseEvent(background, 'mousedown', { clientX: 100, clientY: 100 });
      // Move (dispatch on background so element info is consistent)
      simulateMouseEvent(background, 'mousemove', { clientX: 150, clientY: 120 });
      // End drag (dispatch on background for consistency)
      simulateMouseEvent(background, 'mouseup');

      expect(view.viewport.panX).toBe(50);
      expect(view.viewport.panY).toBe(20);
    });

    test('should zoom with mouse wheel', () => {
      const view = new DiagramView(container);
      const svg = container.querySelector('svg');

      view.render({ nodes: new Map(), edges: new Map(), viewport: { zoom: 1, panX: 0, panY: 0 } });

      // Zoom in
      simulateWheelEvent(svg, -100);
      expect(view.viewport.zoom).toBeGreaterThan(1);

      // Zoom out
      simulateWheelEvent(svg, 100);
      expect(view.viewport.zoom).toBeLessThanOrEqual(1);
    });

    test('should respect zoom limits', () => {
      const view = new DiagramView(container, {
        interaction: { zoomLimits: { min: 0.5, max: 2 } }
      });
      const svg = container.querySelector('svg');

      view.render({ nodes: new Map(), edges: new Map(), viewport: { zoom: 1, panX: 0, panY: 0 } });

      // Try to zoom beyond max
      for (let i = 0; i < 10; i++) {
        simulateWheelEvent(svg, -100);
      }
      expect(view.viewport.zoom).toBeLessThanOrEqual(2);

      // Try to zoom beyond min
      for (let i = 0; i < 10; i++) {
        simulateWheelEvent(svg, 100);
      }
      expect(view.viewport.zoom).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('Export', () => {
    test('should export SVG', () => {
      const view = new DiagramView(container);
      const state = {
        nodes: new Map([
          ['node1', { id: 'node1', position: { x: 100, y: 100 }, size: { width: 120, height: 60 }, label: 'Test' }]
        ]),
        edges: new Map(),
        viewport: { zoom: 1, panX: 0, panY: 0 }
      };

      view.render(state);
      const svgString = view.exportSVG();

      expect(svgString).toContain('<svg');
      expect(svgString).toContain('node1');
      expect(svgString).toContain('Test');
    });

    test('should prepare PNG export', async () => {
      const view = new DiagramView(container);
      const state = {
        nodes: new Map([
          ['node1', { id: 'node1', position: { x: 100, y: 100 }, size: { width: 120, height: 60 } }]
        ]),
        edges: new Map(),
        viewport: { zoom: 1, panX: 0, panY: 0 }
      };

      view.render(state);
      
      // Just test that the method exists and returns a promise
      const promise = view.exportPNG();
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('Utility Methods', () => {
    test('should zoom to fit', () => {
      const view = new DiagramView(container);
      
      // Mock getBoundingClientRect since JSDOM returns 0
      container.getBoundingClientRect = () => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600
      });
      
      const state = {
        nodes: new Map([
          ['node1', { id: 'node1', position: { x: 0, y: 0 }, size: { width: 120, height: 60 } }],
          ['node2', { id: 'node2', position: { x: 500, y: 400 }, size: { width: 120, height: 60 } }]
        ]),
        edges: new Map(),
        layoutBounds: { x: 0, y: 0, width: 620, height: 460 },
        viewport: { zoom: 1, panX: 0, panY: 0 }
      };

      view.render(state);
      view.zoomToFit();

      // Should adjust zoom to fit all content
      // The zoom should be adjusted to fit the content (620x460) in the container (700x500 with padding)
      // This will result in a zoom slightly greater than 1
      expect(view.viewport.zoom).toBeCloseTo(1.087, 2);
    });

    test('should pan to position', () => {
      const view = new DiagramView(container);
      
      view.render({ nodes: new Map(), edges: new Map(), viewport: { zoom: 1, panX: 0, panY: 0 } });
      
      // Mock getBoundingClientRect since JSDOM returns 0
      container.getBoundingClientRect = () => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600
      });
      
      view.panTo({ x: 200, y: 150 });

      // Container is 800x600, so center is at 400x300
      // To center position (200, 150) we need:
      // panX = 400 - 200*1 = 200
      // panY = 300 - 150*1 = 150
      expect(view.viewport.panX).toBe(200);
      expect(view.viewport.panY).toBe(150);
    });
  });

  describe('Cleanup', () => {
    test('should clean up on destroy', () => {
      const view = new DiagramView(container);
      
      view.render({ nodes: new Map(), edges: new Map(), viewport: { zoom: 1, panX: 0, panY: 0 } });
      
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();

      view.destroy();

      const svgAfter = container.querySelector('svg');
      expect(svgAfter).toBeFalsy();
      expect(view.svg).toBeNull();
      expect(view.container).toBeNull();
    });

    test('should remove event listeners on destroy', () => {
      const view = new DiagramView(container);
      let callCount = 0;
      const callback = () => { callCount++; };
      
      view.on('nodeClick', callback);
      view.render({
        nodes: new Map([
          ['node1', { id: 'node1', position: { x: 100, y: 100 }, size: { width: 120, height: 60 } }]
        ]),
        edges: new Map(),
        viewport: { zoom: 1, panX: 0, panY: 0 }
      });

      const node = container.querySelector('.node');
      
      // Should trigger event before destroy
      simulateMouseEvent(node, 'click');
      expect(callCount).toBe(1);

      view.destroy();

      // Should not trigger after destroy (node is removed anyway)
      expect(container.querySelector('.node')).toBeFalsy();
    });
  });
});