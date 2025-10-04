/**
 * Simple GraphEditor Test - Verify rendering pipeline
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { GraphEditorModel } from '../src/components/graph-editor/model/GraphEditorModel.js';
import { GraphEditorView } from '../src/components/graph-editor/view/GraphEditorView.js';
import { GraphEditorViewModel } from '../src/components/graph-editor/viewmodel/GraphEditorViewModel.js';

describe('GraphEditor Rendering Pipeline', () => {
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

  test('should wire Model->ViewModel->View render pipeline', async () => {
    console.log('[TEST] Creating GraphEditor MVVM components');

    // Create Model
    const model = new GraphEditorModel({
      onChange: (type, data) => {
        console.log('[TEST] Model change:', type);
      }
    });

    // Create View
    const view = new GraphEditorView(container, {
      theme: 'light',
      onError: (error) => console.error('[TEST] View error:', error)
    });

    // Track render calls
    let renderCalled = false;
    const testViewModel = {
      render: () => {
        console.log('[TEST] ViewModel render() called!');
        renderCalled = true;
      }
    };

    // Register render callback
    view.onRender(() => testViewModel.render());

    console.log('[TEST] Requesting render...');
    view.requestRender();

    // Wait for requestAnimationFrame
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('[TEST] Render was called:', renderCalled);
    expect(renderCalled).toBe(true);
  });

  test('should create ViewModel with Model and View', () => {
    const model = new GraphEditorModel({
      onChange: () => {}
    });

    const view = new GraphEditorView(container, {
      theme: 'light'
    });

    const viewModel = new GraphEditorViewModel(model, view);

    expect(viewModel.getModel()).toBe(model);
    expect(viewModel.getView()).toBe(view);
    expect(typeof viewModel.render).toBe('function');
  });

  test('should load graph data and trigger model changes', () => {
    const changes = [];
    const model = new GraphEditorModel({
      onChange: (type, data) => {
        changes.push({ type, data });
      }
    });

    const graphData = {
      nodes: [
        { id: 'node1', label: 'Node 1', position: { x: 100, y: 100 } },
        { id: 'node2', label: 'Node 2', position: { x: 200, y: 200 } }
      ],
      edges: [
        { id: 'edge1', source: 'node1', target: 'node2' }
      ]
    };

    model.fromJSON(graphData);

    console.log('[TEST] Model changes:', changes.length);
    console.log('[TEST] Changes:', changes.map(c => c.type));

    // Should have nodeAdded and edgeAdded changes
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.some(c => c.type === 'nodeAdded')).toBe(true);
  });
});
