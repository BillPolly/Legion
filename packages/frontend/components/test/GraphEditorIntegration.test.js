/**
 * GraphEditor Integration Test - Full MVVM with graph data loading
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { GraphEditorModel } from '../src/components/graph-editor/model/GraphEditorModel.js';
import { GraphEditorView } from '../src/components/graph-editor/view/GraphEditorView.js';
import { GraphEditorViewModel } from '../src/components/graph-editor/viewmodel/GraphEditorViewModel.js';

describe('GraphEditor Integration - Model->ViewModel->View', () => {
  let dom, container;

  beforeEach(() => {
    // Create JSDOM environment
    dom = new JSDOM(`<!DOCTYPE html><body></body>`);
    global.document = dom.window.document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.SVGElement = dom.window.SVGElement;

    // Mock requestAnimationFrame
    global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
    global.cancelAnimationFrame = (id) => clearTimeout(id);

    // Create container
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  test('should render nodes when graph data is loaded AFTER ViewModel setup', async () => {
    console.log('\n[TEST] === Testing Model->ViewModel->View Pipeline ===');

    // 1. Create Model
    const model = new GraphEditorModel({
      onChange: (type, data) => {
        console.log('[TEST] Model onChange:', type);
      }
    });

    // 2. Create View
    const view = new GraphEditorView(container, {
      theme: 'light',
      onError: (error) => console.error('[TEST] View error:', error)
    });

    // 3. Create ViewModel (this should wire up Model->ViewModel->View)
    const viewModel = new GraphEditorViewModel(model, view, {});

    console.log('[TEST] MVVM setup complete');

    // Track render calls
    let renderCount = 0;
    const originalRender = viewModel.render.bind(viewModel);
    viewModel.render = () => {
      renderCount++;
      console.log('[TEST] ViewModel.render() called, count:', renderCount);
      originalRender();
    };

    // 4. Load graph data AFTER ViewModel is set up
    console.log('[TEST] Loading graph data...');
    const graphData = {
      nodes: [
        { id: 'node1', label: 'Node 1', position: { x: 100, y: 100 } },
        { id: 'node2', label: 'Node 2', position: { x: 200, y: 200 } },
        { id: 'node3', label: 'Node 3', position: { x: 300, y: 300 } }
      ],
      edges: [
        { id: 'edge1', source: 'node1', target: 'node2' },
        { id: 'edge2', source: 'node2', target: 'node3' }
      ]
    };

    model.fromJSON(graphData);

    console.log('[TEST] Graph data loaded, waiting for renders...');

    // Wait for async renders
    await new Promise(resolve => setTimeout(resolve, 200));

    console.log('[TEST] Final render count:', renderCount);
    console.log('[TEST] Model has', model.getSceneGraph().getAllNodes().length, 'nodes');
    console.log('[TEST] View has renderer:', !!view.getRenderer());

    // ViewModel.render() should have been called when nodes were added
    expect(renderCount).toBeGreaterThan(0);

    // Verify model has the data
    const nodes = model.getSceneGraph().getAllNodes().filter(n => n.getId() !== 'root');
    expect(nodes.length).toBe(3);

    const edges = model.getEdges();
    expect(edges.length).toBe(2);

    // Check if SVG exists and has content
    const svg = container.querySelector('svg');
    console.log('[TEST] SVG exists:', !!svg);

    if (svg) {
      const svgContent = svg.innerHTML;
      console.log('[TEST] SVG innerHTML length:', svgContent.length);
      console.log('[TEST] SVG content (first 500 chars):', svgContent.substring(0, 500));

      // Check for node elements
      const nodeElements = svg.querySelectorAll('[data-node-id]');
      const edgeElements = svg.querySelectorAll('[data-edge-id]');

      console.log('[TEST] Node elements in SVG:', nodeElements.length);
      console.log('[TEST] Edge elements in SVG:', edgeElements.length);

      expect(nodeElements.length).toBe(3);
      expect(edgeElements.length).toBe(2);
    }

    console.log('[TEST] ✅ Integration test passed');
  });
});
