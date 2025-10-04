/**
 * GraphEditor Rendering Test
 * Tests that GraphEditor properly renders nodes and edges to the DOM
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { GraphEditor } from '../src/components/graph-editor/index.js';

describe('GraphEditor Rendering', () => {
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

  test('should render nodes and edges to SVG DOM', async () => {
    const graphData = {
      nodes: [
        { id: 'node1', label: 'Node 1', position: { x: 100, y: 100 } },
        { id: 'node2', label: 'Node 2', position: { x: 300, y: 100 } },
        { id: 'node3', label: 'Node 3', position: { x: 200, y: 300 } }
      ],
      edges: [
        { id: 'edge1', source: 'node1', target: 'node2' },
        { id: 'edge2', source: 'node2', target: 'node3' }
      ]
    };

    const modelChanges = [];

    const editor = GraphEditor.create({
      dom: container,
      graphData: graphData,
      onModelChange: (type, data) => {
        modelChanges.push({ type, data });
      }
    });

    // Wait for async rendering
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify GraphEditor container exists
    const graphContainer = container.querySelector('.graph-editor');
    expect(graphContainer).toBeTruthy();

    // Verify SVG exists
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();

    // Verify SVG has content
    const svgContent = svg.innerHTML;
    console.log('SVG Content:', svgContent.substring(0, 500));

    // Check for node and edge groups
    const mainGroup = svg.querySelector('g');
    expect(mainGroup).toBeTruthy();

    console.log('Main group innerHTML:', mainGroup.innerHTML.substring(0, 500));

    // Verify nodes are rendered (should have data-node-id attributes)
    const nodeElements = svg.querySelectorAll('[data-node-id]');
    console.log('Node elements found:', nodeElements.length);

    // Verify edges are rendered (should have data-edge-id attributes)
    const edgeElements = svg.querySelectorAll('[data-edge-id]');
    console.log('Edge elements found:', edgeElements.length);

    expect(nodeElements.length).toBe(3);
    expect(edgeElements.length).toBe(2);

    // Cleanup
    editor.destroy();
  });

  test('should render empty graph without errors', async () => {
    const graphData = {
      nodes: [],
      edges: []
    };

    const editor = GraphEditor.create({
      dom: container,
      graphData: graphData,
      onModelChange: () => {}
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();

    editor.destroy();
  });
});
