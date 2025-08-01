/**
 * Unit tests for Renderer interface and implementations
 */

import { Renderer } from '../../../../../src/components/graph-editor/view/Renderer.js';
import { SVGRenderer } from '../../../../../src/components/graph-editor/view/SVGRenderer.js';
import { CanvasRenderer } from '../../../../../src/components/graph-editor/view/CanvasRenderer.js';
import { Node } from '../../../../../src/components/graph-editor/model/Node.js';
import { Edge } from '../../../../../src/components/graph-editor/model/Edge.js';
import { Transform } from '../../../../../src/components/graph-editor/model/Transform.js';

describe('Renderer', () => {
  describe('Base Renderer', () => {
    it('should define abstract interface', () => {
      const container = document.createElement('div');
      const renderer = new Renderer(container);
      
      expect(() => renderer.beginFrame()).toThrow('beginFrame must be implemented');
      expect(() => renderer.endFrame()).toThrow('endFrame must be implemented');
      expect(() => renderer.clear()).toThrow('clear must be implemented');
      expect(() => renderer.renderNode()).toThrow('renderNode must be implemented');
      expect(() => renderer.renderEdge()).toThrow('renderEdge must be implemented');
      expect(() => renderer.setTransform()).toThrow('setTransform must be implemented');
    });

    it('should store container and config', () => {
      const container = document.createElement('div');
      const config = { antiAlias: true };
      const renderer = new Renderer(container, config);
      
      expect(renderer.container).toBe(container);
      expect(renderer.config).toEqual(config);
    });
  });

  describe('SVGRenderer', () => {
    let container;
    let renderer;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      renderer = new SVGRenderer(container);
    });

    afterEach(() => {
      renderer.destroy();
      document.body.removeChild(container);
    });

    it('should create SVG element', () => {
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg.getAttribute('width')).toBe('100%');
      expect(svg.getAttribute('height')).toBe('100%');
    });

    it('should implement frame lifecycle', () => {
      expect(() => renderer.beginFrame()).not.toThrow();
      expect(() => renderer.endFrame()).not.toThrow();
    });

    it('should clear content', () => {
      // Add some content to main group
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      renderer.mainGroup.appendChild(g);
      
      renderer.clear();
      
      // Main group should be empty
      expect(renderer.mainGroup.children.length).toBe(0);
    });

    it('should render nodes', () => {
      const node = new Node({
        id: 'test-node',
        position: { x: 100, y: 100 },
        size: { width: 80, height: 40 },
        label: 'Test Node'
      });
      
      renderer.beginFrame();
      renderer.renderNode(node);
      renderer.endFrame();
      
      const nodeElement = container.querySelector('[data-node-id="test-node"]');
      expect(nodeElement).toBeTruthy();
      expect(nodeElement.tagName).toBe('g');
      
      // Should have rect and text
      const rect = nodeElement.querySelector('rect');
      expect(rect).toBeTruthy();
      expect(rect.getAttribute('width')).toBe('80');
      expect(rect.getAttribute('height')).toBe('40');
      
      const text = nodeElement.querySelector('text');
      expect(text).toBeTruthy();
      expect(text.textContent).toBe('Test Node');
    });

    it('should apply node styles', () => {
      const node = new Node({
        id: 'styled-node',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 50 },
        style: {
          fill: '#ff0000',
          stroke: '#0000ff',
          strokeWidth: 3,
          opacity: 0.8
        }
      });
      
      renderer.renderNode(node);
      
      const rect = container.querySelector('[data-node-id="styled-node"] rect');
      expect(rect.getAttribute('fill')).toBe('#ff0000');
      expect(rect.getAttribute('stroke')).toBe('#0000ff');
      expect(rect.getAttribute('stroke-width')).toBe('3');
      expect(rect.getAttribute('opacity')).toBe('0.8');
    });

    it('should render edges', () => {
      const edge = new Edge({
        id: 'test-edge',
        source: 'node1',
        target: 'node2'
      });
      
      // Mock node positions for edge endpoints
      const sourceNode = new Node({ 
        id: 'node1', 
        position: { x: 0, y: 50 },
        size: { width: 100, height: 50 }
      });
      const targetNode = new Node({ 
        id: 'node2', 
        position: { x: 200, y: 50 },
        size: { width: 100, height: 50 }
      });
      
      renderer.beginFrame();
      renderer.renderEdge(edge, sourceNode, targetNode);
      renderer.endFrame();
      
      const edgeElement = container.querySelector('[data-edge-id="test-edge"]');
      expect(edgeElement).toBeTruthy();
      expect(edgeElement.tagName).toBe('g');
      
      const path = edgeElement.querySelector('path');
      expect(path).toBeTruthy();
      expect(path.getAttribute('d')).toMatch(/^M/); // Starts with move command
    });

    it('should render edge with control points', () => {
      const edge = new Edge({
        id: 'curved-edge',
        source: 'node1',
        target: 'node2',
        controlPoints: [{ x: 100, y: 0 }]
      });
      
      const sourceNode = new Node({ 
        id: 'node1',
        position: { x: 0, y: 0 },
        size: { width: 50, height: 50 }
      });
      const targetNode = new Node({ 
        id: 'node2',
        position: { x: 150, y: 0 },
        size: { width: 50, height: 50 }
      });
      
      renderer.renderEdge(edge, sourceNode, targetNode);
      
      const path = container.querySelector('[data-edge-id="curved-edge"] path');
      expect(path.getAttribute('d')).toMatch(/Q/); // Contains quadratic curve command
    });

    it('should apply edge styles', () => {
      const edge = new Edge({
        id: 'styled-edge',
        source: 'node1',
        target: 'node2',
        style: {
          stroke: '#ff0000',
          strokeWidth: 3,
          strokeDasharray: '5,5'
        }
      });
      
      const sourceNode = new Node({ id: 'node1' });
      const targetNode = new Node({ id: 'node2' });
      
      renderer.renderEdge(edge, sourceNode, targetNode);
      
      const path = container.querySelector('[data-edge-id="styled-edge"] path');
      expect(path.getAttribute('stroke')).toBe('#ff0000');
      expect(path.getAttribute('stroke-width')).toBe('3');
      expect(path.getAttribute('stroke-dasharray')).toBe('5,5');
    });

    it('should set viewport transform', () => {
      const transform = new Transform({
        position: { x: 100, y: 50 },
        scale: { x: 2, y: 2 }
      });
      
      renderer.setTransform(transform);
      
      const mainGroup = renderer.mainGroup;
      const transformAttr = mainGroup.getAttribute('transform');
      expect(transformAttr).toMatch(/matrix/);
    });

    it('should render selection highlight', () => {
      const node = new Node({
        id: 'selected-node',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 50 }
      });
      
      renderer.renderNode(node, { selected: true });
      
      const selection = container.querySelector('[data-node-id="selected-node"] .selection-highlight');
      expect(selection).toBeTruthy();
    });

    it('should update existing elements', () => {
      const node = new Node({
        id: 'update-node',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 50 },
        label: 'Original'
      });
      
      // First render
      renderer.renderNode(node);
      const text1 = container.querySelector('[data-node-id="update-node"] text');
      expect(text1.textContent).toBe('Original');
      
      // Update and re-render
      node.setLabel('Updated');
      renderer.renderNode(node);
      
      const text2 = container.querySelector('[data-node-id="update-node"] text');
      expect(text2.textContent).toBe('Updated');
      
      // Should still be same element
      expect(text1).toBe(text2);
    });

    it('should support hit testing', () => {
      const node = new Node({
        id: 'hit-test-node',
        position: { x: 100, y: 100 },
        size: { width: 80, height: 40 }
      });
      
      renderer.renderNode(node);
      
      // Mock container getBoundingClientRect
      container.getBoundingClientRect = () => ({ left: 0, top: 0 });
      
      // Mock elementFromPoint to return the node group
      const nodeGroup = container.querySelector('[data-node-id="hit-test-node"]');
      const originalElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = (x, y) => {
        // Check if point is inside node bounds
        if (x >= 100 && x <= 180 && y >= 100 && y <= 140) {
          return nodeGroup;
        }
        return null;
      };
      
      // Hit inside node
      const hit = renderer.getElementAt(140, 120);
      expect(hit).toBeTruthy();
      expect(hit.type).toBe('node');
      expect(hit.element).toBe(node);
      
      // Miss outside node
      const miss = renderer.getElementAt(50, 50);
      expect(miss).toBeNull();
      
      // Restore
      document.elementFromPoint = originalElementFromPoint;
    });

    it('should convert client to graph coordinates', () => {
      // Mock SVG methods
      renderer.svg.getBoundingClientRect = () => ({ left: 0, top: 0 });
      renderer.svg.createSVGPoint = () => ({ 
        x: 0, 
        y: 0,
        matrixTransform: function(matrix) {
          // Simple matrix multiplication
          return {
            x: matrix.a * this.x + matrix.c * this.y + matrix.e,
            y: matrix.b * this.x + matrix.d * this.y + matrix.f
          };
        }
      });
      
      // Mock getCTM for transform
      renderer.mainGroup.getCTM = () => ({
        a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
        inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
      });
      
      // Without transform - should return input coordinates
      const pt1 = renderer.clientToGraph(100, 100);
      expect(pt1.x).toBe(100);
      expect(pt1.y).toBe(100);
      
      // With transform
      const transform = new Transform({
        position: { x: 50, y: 50 },
        scale: { x: 2, y: 2 }
      });
      renderer.setTransform(transform);
      
      // Update mock to return transformed matrix
      renderer.mainGroup.getCTM = () => ({
        a: 2, b: 0, c: 0, d: 2, e: 50, f: 50,
        inverse: () => ({ 
          a: 0.5, b: 0, c: 0, d: 0.5, e: -25, f: -25
        })
      });
      
      const pt2 = renderer.clientToGraph(150, 150);
      // Should reverse the transform: (150 * 0.5) + (-25) = 50
      expect(pt2.x).toBe(50);
      expect(pt2.y).toBe(50);
    });
  });

  describe('CanvasRenderer', () => {
    let container;
    let renderer;

    beforeEach(() => {
      container = document.createElement('div');
      container.style.width = '800px';
      container.style.height = '600px';
      document.body.appendChild(container);
      renderer = new CanvasRenderer(container);
    });

    afterEach(() => {
      renderer.destroy();
      document.body.removeChild(container);
    });

    it('should create canvas element', () => {
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeTruthy();
      // Canvas dimensions depend on devicePixelRatio
      expect(canvas.width).toBe(800 * renderer.pixelRatio);
      expect(canvas.height).toBe(600 * renderer.pixelRatio);
    });

    it('should get 2D context', () => {
      expect(renderer.ctx).toBeTruthy();
      // Should have canvas context methods
      expect(typeof renderer.ctx.fillRect).toBe('function');
      expect(typeof renderer.ctx.strokeRect).toBe('function');
      expect(typeof renderer.ctx.clearRect).toBe('function');
    });

    it('should handle high DPI displays', () => {
      // Mock devicePixelRatio
      const originalRatio = window.devicePixelRatio;
      Object.defineProperty(window, 'devicePixelRatio', {
        value: 2,
        configurable: true
      });
      
      const hdpiRenderer = new CanvasRenderer(container);
      expect(hdpiRenderer.canvas.width).toBe(1600); // 800 * 2
      expect(hdpiRenderer.canvas.height).toBe(1200); // 600 * 2
      
      hdpiRenderer.destroy();
      
      // Restore
      Object.defineProperty(window, 'devicePixelRatio', {
        value: originalRatio,
        configurable: true
      });
    });

    it('should implement frame lifecycle', () => {
      expect(() => renderer.beginFrame()).not.toThrow();
      expect(() => renderer.endFrame()).not.toThrow();
    });

    it('should clear canvas', () => {
      const ctx = renderer.ctx;
      
      // Mock clear was called
      const originalClearRect = ctx.clearRect;
      let clearRectCalled = false;
      ctx.clearRect = (...args) => {
        clearRectCalled = true;
        originalClearRect.call(ctx, ...args);
      };
      
      // Clear
      renderer.clear();
      
      // Verify clearRect was called
      expect(clearRectCalled).toBe(true);
      
      // Restore
      ctx.clearRect = originalClearRect;
    });

    it('should render nodes', () => {
      const node = new Node({
        id: 'canvas-node',
        position: { x: 100, y: 100 },
        size: { width: 80, height: 40 },
        label: 'Canvas Node',
        style: { fill: '#ff0000' }
      });
      
      let fillCalled = false;
      let fillTextArgs = null;
      const originalFill = renderer.ctx.fill;
      const originalFillText = renderer.ctx.fillText;
      
      renderer.ctx.fill = (...args) => {
        fillCalled = true;
        originalFill.call(renderer.ctx, ...args);
      };
      renderer.ctx.fillText = (...args) => {
        fillTextArgs = args;
        originalFillText.call(renderer.ctx, ...args);
      };
      
      renderer.beginFrame();
      renderer.clear();
      renderer.renderNode(node);
      renderer.endFrame();
      
      // Should have drawn shape and text
      expect(fillCalled).toBe(true);
      expect(fillTextArgs).toEqual(['Canvas Node', 40, 20]);
      
      // Restore
      renderer.ctx.fill = originalFill;
      renderer.ctx.fillText = originalFillText;
    });

    it('should render edges', () => {
      const edge = new Edge({
        id: 'canvas-edge',
        source: 'node1',
        target: 'node2',
        style: { stroke: '#000000', strokeWidth: 2 }
      });
      
      const sourceNode = new Node({ 
        id: 'node1',
        position: { x: 50, y: 50 },
        size: { width: 50, height: 50 }
      });
      const targetNode = new Node({ 
        id: 'node2',
        position: { x: 150, y: 50 },
        size: { width: 50, height: 50 }
      });
      
      let pathCalls = {
        beginPath: false,
        moveTo: false,
        lineTo: false,
        stroke: false
      };
      
      const originals = {
        beginPath: renderer.ctx.beginPath,
        moveTo: renderer.ctx.moveTo,
        lineTo: renderer.ctx.lineTo,
        stroke: renderer.ctx.stroke
      };
      
      renderer.ctx.beginPath = () => { pathCalls.beginPath = true; };
      renderer.ctx.moveTo = () => { pathCalls.moveTo = true; };
      renderer.ctx.lineTo = () => { pathCalls.lineTo = true; };
      renderer.ctx.stroke = () => { pathCalls.stroke = true; };
      
      renderer.beginFrame();
      renderer.clear();
      renderer.renderEdge(edge, sourceNode, targetNode);
      renderer.endFrame();
      
      // Should have drawn a path
      expect(pathCalls.beginPath).toBe(true);
      expect(pathCalls.moveTo).toBe(true);
      expect(pathCalls.lineTo).toBe(true);
      expect(pathCalls.stroke).toBe(true);
      
      // Restore
      Object.keys(originals).forEach(key => {
        renderer.ctx[key] = originals[key];
      });
    });

    it('should apply viewport transform', () => {
      const transform = new Transform({
        position: { x: 100, y: 50 },
        scale: { x: 2, y: 2 }
      });
      
      let setTransformArgs = null;
      const originalSetTransform = renderer.ctx.setTransform;
      renderer.ctx.setTransform = (...args) => {
        setTransformArgs = args;
        originalSetTransform.call(renderer.ctx, ...args);
      };
      
      renderer.setTransform(transform);
      
      // Should have called setTransform with the matrix values scaled by pixelRatio
      const matrix = transform.getMatrix();
      expect(setTransformArgs).toEqual([
        matrix[0] * renderer.pixelRatio,
        matrix[1] * renderer.pixelRatio,
        matrix[2] * renderer.pixelRatio,
        matrix[3] * renderer.pixelRatio,
        matrix[4] * renderer.pixelRatio,
        matrix[5] * renderer.pixelRatio
      ]);
      
      // Restore
      renderer.ctx.setTransform = originalSetTransform;
    });

    it('should handle resize', () => {
      container.style.width = '1000px';
      container.style.height = '800px';
      
      renderer.resize();
      
      expect(renderer.canvas.width).toBe(1000);
      expect(renderer.canvas.height).toBe(800);
    });

    it('should save and restore context state', () => {
      const ctx = renderer.ctx;
      
      let saveCalled = false;
      let restoreCalled = false;
      const originalSave = ctx.save;
      const originalRestore = ctx.restore;
      
      ctx.save = () => {
        saveCalled = true;
        originalSave.call(ctx);
      };
      ctx.restore = () => {
        restoreCalled = true;
        originalRestore.call(ctx);
      };
      
      renderer.beginFrame();
      expect(saveCalled).toBe(true);
      
      renderer.endFrame();
      expect(restoreCalled).toBe(true);
      
      // Restore
      ctx.save = originalSave;
      ctx.restore = originalRestore;
    });

    it('should support hit testing', () => {
      const node = new Node({
        id: 'canvas-hit-node',
        position: { x: 100, y: 100 },
        size: { width: 80, height: 40 }
      });
      
      renderer.beginFrame();
      renderer.renderNode(node);
      renderer.endFrame();
      
      // Hit inside node
      const hit = renderer.getElementAt(140, 120);
      expect(hit).toBeTruthy();
      expect(hit.type).toBe('node');
      expect(hit.element).toBe(node);
      
      // Miss outside node
      const miss = renderer.getElementAt(50, 50);
      expect(miss).toBeNull();
    });

    it('should convert client to graph coordinates', () => {
      // Mock getBoundingClientRect
      renderer.canvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600
      });
      
      // Without transform
      const pt1 = renderer.clientToGraph(100, 100);
      expect(pt1.x).toBe(100 * renderer.pixelRatio);
      expect(pt1.y).toBe(100 * renderer.pixelRatio);
      
      // With transform
      const transform = new Transform({
        position: { x: 50, y: 50 },
        scale: { x: 2, y: 2 }
      });
      renderer.setTransform(transform);
      
      const pt2 = renderer.clientToGraph(150, 150);
      // Should reverse the transform
      const expectedX = (150 * renderer.pixelRatio - 50) / 2;
      const expectedY = (150 * renderer.pixelRatio - 50) / 2;
      expect(pt2.x).toBeCloseTo(expectedX, 5);
      expect(pt2.y).toBeCloseTo(expectedY, 5);
    });
  });

  describe('Renderer Factory', () => {
    it('should create appropriate renderer based on type', async () => {
      const container = document.createElement('div');
      
      const svgRenderer = await Renderer.create('svg', container);
      expect(svgRenderer).toBeInstanceOf(SVGRenderer);
      svgRenderer.destroy();
      
      const canvasRenderer = await Renderer.create('canvas', container);
      expect(canvasRenderer).toBeInstanceOf(CanvasRenderer);
      canvasRenderer.destroy();
    });

    it('should throw for unknown renderer type', async () => {
      const container = document.createElement('div');
      await expect(Renderer.create('webgl', container)).rejects.toThrow('Unknown renderer type: webgl');
    });
  });
});