/**
 * Unit tests for render cycle and dirty tracking
 */

import { GraphEditorView } from '../../../../../src/components/graph-editor/view/GraphEditorView.js';
import { GraphEditorViewModel } from '../../../../../src/components/graph-editor/viewmodel/GraphEditorViewModel.js';
import { GraphEditorModel } from '../../../../../src/components/graph-editor/model/GraphEditorModel.js';
import { SVGRenderer } from '../../../../../src/components/graph-editor/view/SVGRenderer.js';
import { CanvasRenderer } from '../../../../../src/components/graph-editor/view/CanvasRenderer.js';

describe('Render Cycle', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Render Scheduling', () => {
    it('should batch render requests', (done) => {
      const view = new GraphEditorView(container);
      let renderCount = 0;
      
      view.onRender(() => {
        renderCount++;
      });
      
      // Request multiple renders
      view.requestRender();
      view.requestRender();
      view.requestRender();
      
      // Should only render once
      requestAnimationFrame(() => {
        expect(renderCount).toBe(1);
        view.destroy();
        done();
      });
    });

    it('should not render after destroy', (done) => {
      const view = new GraphEditorView(container);
      let renderCount = 0;
      
      view.onRender(() => {
        renderCount++;
      });
      
      view.requestRender();
      view.destroy();
      
      requestAnimationFrame(() => {
        expect(renderCount).toBe(0);
        done();
      });
    });

    it('should handle render listeners', async () => {
      const view = new GraphEditorView(container);
      
      // Wait for renderer to be created
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const listener1 = () => { listener1.called = true; };
      listener1.called = false;
      const listener2 = () => { listener2.called = true; };
      listener2.called = false;
      
      view.onRender(listener1);
      view.onRender(listener2);
      view._render();
      
      expect(listener1.called).toBe(true);
      expect(listener2.called).toBe(true);
      
      // Remove listener
      view.offRender(listener1);
      listener1.called = false;
      listener2.called = false;
      
      view._render();
      expect(listener1.called).toBe(false);
      expect(listener2.called).toBe(true);
      
      view.destroy();
    });
  });

  describe('Dirty Tracking', () => {
    it('should track dirty regions', () => {
      const model = new GraphEditorModel();
      const viewModel = new GraphEditorViewModel(model);
      const view = new GraphEditorView(container);
      
      // Connect view model to view
      viewModel.setView(view);
      
      // Add a node - should mark region dirty
      const nodeData = {
        id: 'node1',
        position: { x: 100, y: 100 },
        size: { width: 80, height: 40 }
      };
      const node = model.addNode(nodeData);
      
      // Get dirty regions
      const dirtyRegions = viewModel.getDirtyRegions();
      expect(dirtyRegions.length).toBeGreaterThan(0);
      
      // Clear dirty regions
      viewModel.clearDirtyRegions();
      expect(viewModel.getDirtyRegions().length).toBe(0);
      
      view.destroy();
    });

    it('should accumulate dirty regions', () => {
      const model = new GraphEditorModel();
      const viewModel = new GraphEditorViewModel(model);
      
      // Add multiple nodes in different regions
      model.addNode({
        id: 'node1',
        position: { x: 100, y: 100 },
        size: { width: 80, height: 40 }
      });
      
      model.addNode({
        id: 'node2',
        position: { x: 300, y: 300 },
        size: { width: 80, height: 40 }
      });
      
      const dirtyRegions = viewModel.getDirtyRegions();
      expect(dirtyRegions.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle node updates', () => {
      const model = new GraphEditorModel();
      const viewModel = new GraphEditorViewModel(model);
      
      const node = model.addNode({
        id: 'node1',
        position: { x: 100, y: 100 }
      });
      
      viewModel.clearDirtyRegions();
      
      // Move node - should mark both old and new positions dirty
      node.setPosition(200, 200);
      
      const dirtyRegions = viewModel.getDirtyRegions();
      expect(dirtyRegions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Renderer Integration', () => {
    it('should create correct renderer type', (done) => {
      const view = new GraphEditorView(container, { rendererType: 'svg' });
      
      // Wait for async renderer creation
      setTimeout(() => {
        // Should create SVG renderer
        const renderer = view.getRenderer();
        expect(renderer).toBeInstanceOf(SVGRenderer);
        
        view.destroy();
        done();
      }, 10);
    });

    it('should switch renderer types', async () => {
      const view = new GraphEditorView(container, { rendererType: 'svg' });
      
      // Wait for initial renderer
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(view.getRendererType()).toBe('svg');
      expect(view.getRenderer()).toBeInstanceOf(SVGRenderer);
      
      // Switch to canvas
      await view.setRendererType('canvas');
      
      expect(view.getRendererType()).toBe('canvas');
      expect(view.getRenderer()).toBeInstanceOf(CanvasRenderer);
      
      // Should trigger render
      let rendered = false;
      view.onRender(() => {
        rendered = true;
      });
      
      await new Promise(resolve => requestAnimationFrame(resolve));
      expect(rendered).toBe(true);
      view.destroy();
    });

    it('should preserve state when switching renderers', async () => {
      const model = new GraphEditorModel();
      const viewModel = new GraphEditorViewModel(model);
      const view = new GraphEditorView(container, { rendererType: 'svg' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      viewModel.setView(view);
      
      // Add some nodes
      model.addNode({ id: 'node1', position: { x: 100, y: 100 } });
      model.addNode({ id: 'node2', position: { x: 200, y: 200 } });
      
      // Switch renderer
      await view.setRendererType('canvas');
      
      // State should be preserved
      expect(model.getSceneGraph().getAllNodes().length).toBe(3); // includes root
      expect(view.getRendererType()).toBe('canvas');
      
      view.destroy();
    });
  });

  describe('Render Pipeline', () => {
    it('should execute render pipeline in correct order', async () => {
      const model = new GraphEditorModel();
      const viewModel = new GraphEditorViewModel(model);
      const view = new GraphEditorView(container);
      
      // Wait for renderer
      await new Promise(resolve => setTimeout(resolve, 10));
      
      viewModel.setView(view);
      
      const calls = [];
      
      // Mock renderer methods
      const renderer = view.getRenderer();
      if (renderer) {
        renderer.beginFrame = () => calls.push('beginFrame');
        renderer.clear = () => calls.push('clear');
        renderer.renderNode = () => calls.push('renderNode');
        renderer.renderEdge = () => calls.push('renderEdge');
        renderer.endFrame = () => calls.push('endFrame');
      }
      
      // Add node and edge
      const node1 = model.addNode({ id: 'n1', position: { x: 0, y: 0 } });
      const node2 = model.addNode({ id: 'n2', position: { x: 100, y: 0 } });
      model.addEdge({ id: 'e1', source: 'n1', target: 'n2' });
      
      // Render directly
      viewModel.render();
      
      // Check order
      expect(calls[0]).toBe('beginFrame');
      expect(calls[1]).toBe('clear');
      expect(calls).toContain('renderNode');
      expect(calls).toContain('renderEdge');
      expect(calls[calls.length - 1]).toBe('endFrame');
      
      view.destroy();
    });

    it('should apply viewport transform', async () => {
      const view = new GraphEditorView(container);
      
      // Wait for renderer
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const renderer = view.getRenderer();
      if (renderer) {
        let transformApplied = false;
        renderer.setTransform = (transform) => {
          transformApplied = true;
          expect(transform).toBeDefined();
        };
        
        // Set viewport transform
        view.getViewport().pan(100, 50);
        view.getViewport().zoom(2);
        
        // Render should apply transform
        view._render();
        expect(transformApplied).toBe(true);
      }
      
      view.destroy();
    });
  });

  describe('Performance Optimization', () => {
    it('should skip rendering when nothing changed', async () => {
      const model = new GraphEditorModel();
      const viewModel = new GraphEditorViewModel(model);
      const view = new GraphEditorView(container);
      
      // Wait for renderer
      await new Promise(resolve => setTimeout(resolve, 10));
      
      viewModel.setView(view);
      
      let renderCount = 0;
      const renderer = view.getRenderer();
      if (renderer) {
        renderer.beginFrame = () => renderCount++;
      }
      
      // Add a node to trigger dirty state
      model.addNode({ id: 'test-node', position: { x: 0, y: 0 } });
      
      // First render
      viewModel.render();
      expect(renderCount).toBe(1);
      
      // Clear dirty regions
      viewModel.clearDirtyRegions();
      
      // Second render - should skip since nothing changed
      viewModel.render();
      expect(renderCount).toBe(1);
      
      view.destroy();
    });

    it('should batch model updates', async () => {
      const model = new GraphEditorModel();
      const viewModel = new GraphEditorViewModel(model);
      const view = new GraphEditorView(container);
      
      // Wait for renderer
      await new Promise(resolve => setTimeout(resolve, 10));
      
      viewModel.setView(view);
      
      let renderCount = 0;
      view.onRender(() => renderCount++);
      
      // Batch updates
      model.beginBatch();
      model.addNode({ id: 'n1' });
      model.addNode({ id: 'n2' });
      model.addNode({ id: 'n3' });
      model.endBatch();
      
      // Wait for render
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Should render once
      expect(renderCount).toBe(1);
      view.destroy();
    });
  });

  describe('Coordinate Conversion', () => {
    it('should convert screen to world coordinates', () => {
      const view = new GraphEditorView(container);
      const viewport = view.getViewport();
      
      // Identity transform
      let world = view.screenToWorld({ x: 100, y: 100 });
      expect(world.x).toBe(100);
      expect(world.y).toBe(100);
      
      // With transform
      viewport.pan(50, 50);
      viewport.zoom(2);
      
      world = view.screenToWorld({ x: 100, y: 100 });
      expect(world.x).not.toBe(100);
      expect(world.y).not.toBe(100);
      
      view.destroy();
    });

    it('should convert world to screen coordinates', () => {
      const view = new GraphEditorView(container);
      const viewport = view.getViewport();
      
      // Mock container position
      container.getBoundingClientRect = () => ({
        left: 10,
        top: 20,
        width: 800,
        height: 600
      });
      
      // Identity transform
      let screen = view.worldToScreen({ x: 100, y: 100 });
      expect(screen.x).toBe(110); // 100 + 10
      expect(screen.y).toBe(120); // 100 + 20
      
      view.destroy();
    });
  });
});