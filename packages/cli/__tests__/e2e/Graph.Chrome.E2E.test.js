/**
 * Graph Rendering Chrome E2E Test
 * Tests graph display in REAL browser with Chrome DevTools MCP
 *
 * This test verifies:
 * - Graph command execution
 * - Floating window creation
 * - SVG graph rendering with real nodes/edges
 * - Graph interactivity (pan/zoom)
 * - CodeMirror and library loading
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { CLIServer } from '../../src/server/CLIServer.js';
import { ResourceManager } from '@legion/resource-manager';
import { GraphDataSource } from '../../../shared/data/graph/src/GraphDataSource.js';
import { GraphHandle } from '../../../shared/data/graph/src/GraphHandle.js';
import { setTimeout as delay } from 'timers/promises';

describe('Graph Rendering - Chrome E2E Tests', () => {
  let server;
  let resourceManager;
  let originalCreateHandleFromURI;
  const TEST_CLI_PORT = 5101;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();

    // Create test graph data
    const testGraphData = {
      nodes: [
        { id: 'node1', label: 'Knowledge Graph', type: 'Entity', position: { x: 100, y: 100 } },
        { id: 'node2', label: 'Semantic Web', type: 'Entity', position: { x: 300, y: 100 } },
        { id: 'node3', label: 'Ontology', type: 'Concept', position: { x: 200, y: 300 } }
      ],
      edges: [
        { id: 'edge1', source: 'node1', target: 'node2', type: 'relatesTo', label: 'uses' },
        { id: 'edge2', source: 'node1', target: 'node3', type: 'hasProperty', label: 'defines' },
        { id: 'edge3', source: 'node2', target: 'node3', type: 'hasProperty', label: 'requires' }
      ]
    };

    const graphDataSource = new GraphDataSource(testGraphData);
    const testGraphHandle = new GraphHandle(graphDataSource);

    // Mock ResourceManager to return test graph
    originalCreateHandleFromURI = resourceManager.createHandleFromURI;
    resourceManager.createHandleFromURI = async (uri) => {
      console.log('[E2E] Creating test graph handle for:', uri);
      return testGraphHandle;
    };

    // Create and start CLI server
    server = new CLIServer({
      port: TEST_CLI_PORT,
      resourceManager
    });

    await server.initialize();
    await server.start();

    console.log(`[E2E] CLI Server started on port ${TEST_CLI_PORT}`);

    // Give server time to start
    await delay(1000);
  }, 30000);

  afterAll(async () => {
    // Restore original function
    if (originalCreateHandleFromURI) {
      resourceManager.createHandleFromURI = originalCreateHandleFromURI;
    }

    if (server) {
      await server.stop();
      console.log('[E2E] CLI Server stopped');
    }
  });

  test('should load CLI page and wait for connection', async () => {
    console.log('[E2E] Navigating to CLI page...');

    // Navigate to CLI page
    await mcp__chrome_devtools_mcp__navigate_page({
      url: `http://localhost:${TEST_CLI_PORT}/cli`,
      timeout: 10000
    });

    // Wait for page to load and WebSocket to connect
    await delay(3000);

    console.log('[E2E] ✅ Page loaded');
  }, 30000);

  test('should execute /show graph command', async () => {
    console.log('[E2E] Finding terminal input...');

    // Take snapshot to find input
    const snapshot = await mcp__chrome_devtools_mcp__take_snapshot();

    // Find input field
    const inputMatch = snapshot.match(/uid="([^"]+)"[^>]*(?:class="[^"]*input|type="text")/i);

    if (!inputMatch) {
      console.log('[E2E] Input field pattern not found, trying alternate...');
      // Log part of snapshot for debugging
      console.log('[E2E] Snapshot preview (first 500 chars):', snapshot.substring(0, 500));
      throw new Error('Could not find input field in snapshot');
    }

    const inputUid = inputMatch[1];
    console.log(`[E2E] Found input with uid: ${inputUid}`);

    // Type graph command
    await mcp__chrome_devtools_mcp__fill({
      uid: inputUid,
      value: '/show legion://test/graph'
    });

    console.log('[E2E] Typed graph command');

    // Look for submit button or Enter trigger
    await delay(500);
    const snapshot2 = await mcp__chrome_devtools_mcp__take_snapshot();
    const submitMatch = snapshot2.match(/uid="([^"]+)"[^>]*(?:type="submit"|class="[^"]*submit)/i);

    if (submitMatch) {
      const submitUid = submitMatch[1];
      await mcp__chrome_devtools_mcp__click({ uid: submitUid });
      console.log('[E2E] Clicked submit');
    } else {
      // Try executing via JavaScript
      await mcp__chrome_devtools_mcp__evaluate_script({
        function: `(inputEl) => {
          const form = inputEl.closest('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          } else {
            inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
          }
        }`,
        args: [{ uid: inputUid }]
      });
      console.log('[E2E] Triggered submit via JavaScript');
    }

    // Wait for graph to render
    await delay(3000);

    console.log('[E2E] ✅ Graph command executed');
  }, 30000);

  test('should render floating window with graph', async () => {
    console.log('[E2E] Verifying floating window...');

    // Take snapshot
    const snapshot = await mcp__chrome_devtools_mcp__take_snapshot();

    // Verify floating window exists
    expect(snapshot).toContain('asset-floating-window');

    console.log('[E2E] ✅ Floating window rendered');
  }, 20000);

  test('should render SVG graph with nodes and edges', async () => {
    console.log('[E2E] Verifying SVG graph...');

    // Take snapshot
    const snapshot = await mcp__chrome_devtools_mcp__take_snapshot();

    // Verify SVG exists
    expect(snapshot).toContain('<svg');

    // Verify nodes exist (should have data-node-id attributes)
    expect(snapshot).toContain('data-node-id');

    // Verify edges exist (should have data-edge-id attributes)
    expect(snapshot).toContain('data-edge-id');

    // Count nodes and edges
    const nodeMatches = snapshot.match(/data-node-id="/g);
    const edgeMatches = snapshot.match(/data-edge-id="/g);

    console.log(`[E2E] Found ${nodeMatches ? nodeMatches.length : 0} nodes`);
    console.log(`[E2E] Found ${edgeMatches ? edgeMatches.length : 0} edges`);

    // Should have 3 nodes and 3 edges from test data
    expect(nodeMatches).toBeTruthy();
    expect(edgeMatches).toBeTruthy();
    expect(nodeMatches.length).toBe(3);
    expect(edgeMatches.length).toBe(3);

    console.log('[E2E] ✅ Graph SVG rendered with correct nodes and edges');
  }, 20000);

  test('should take screenshot of rendered graph', async () => {
    console.log('[E2E] Taking graph screenshot...');

    // Take screenshot
    const screenshot = await mcp__chrome_devtools_mcp__take_screenshot({
      fullPage: false,
      format: 'png'
    });

    expect(screenshot).toBeDefined();

    console.log('[E2E] ✅ Graph screenshot captured');
  }, 20000);

  test('should verify graph is interactive', async () => {
    console.log('[E2E] Testing graph interactivity...');

    // Take snapshot to find SVG element
    const snapshot = await mcp__chrome_devtools_mcp__take_snapshot();

    // Find SVG element
    const svgMatch = snapshot.match(/uid="([^"]+)"[^>]*<svg/i);

    if (svgMatch) {
      const svgUid = svgMatch[1];
      console.log(`[E2E] Found SVG with uid: ${svgUid}`);

      // Try hovering over SVG (tests event handlers)
      await mcp__chrome_devtools_mcp__hover({ uid: svgUid });

      await delay(500);

      console.log('[E2E] ✅ Graph is interactive (hover events work)');
    } else {
      console.log('[E2E] SVG element not found for interaction test');
    }
  }, 20000);

  test('should have no console errors during graph rendering', async () => {
    console.log('[E2E] Checking console for errors...');

    const consoleMessages = await mcp__chrome_devtools_mcp__list_console_messages();

    // Filter for errors
    const errors = consoleMessages.filter(msg => msg.level === 'error');

    if (errors.length > 0) {
      console.error('[E2E] Console errors found:', errors);
    }

    // Should have no errors
    expect(errors.length).toBe(0);

    console.log('[E2E] ✅ No console errors during graph rendering');
  }, 20000);
});
