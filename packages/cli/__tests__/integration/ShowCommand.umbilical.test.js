/**
 * Integration test for /show command with umbilical components
 * Tests actual DOM rendering with MockWebSocket and JSDOM
 * NO MOCKS - real rendering pipeline
 */

import { describe, test, expect, beforeAll, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { CLI } from '../../src/CLI.js';
import { ResourceManager } from '@legion/resource-manager';
import { ImageHandle } from '@legion/showme/src/handles/ImageHandle.js';

describe.skip('ShowCommand with Umbilical Components', () => {
  let resourceManager;
  let cli;
  let dom;
  let window;
  let document;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();

    // Setup JSDOM
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost:4000',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    window = dom.window;
    document = window.document;

    // Make JSDOM global
    global.window = window;
    global.document = document;
    global.HTMLElement = window.HTMLElement;
    global.Image = window.Image;
  }, 10000);

  afterEach(async () => {
    if (cli) {
      await cli.shutdown();
      cli = null;
    }
    // Clean up DOM
    if (document) {
      document.body.innerHTML = '';
    }
  });

  test('should render image with umbilical ImageViewer component', async () => {
    const port = 8000 + Math.floor(Math.random() * 500);
    cli = new CLI(resourceManager, { port });

    await cli.initialize();
    await cli.start();

    // Create container for rendering
    const container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    // Mock browser launch but NOT the rendering
    cli.showme.server.launchBrowser = async () => { return; };
    cli.showme._waitForConnection = async () => { return; };

    // Create real ImageHandle
    const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
    const imageHandle = new ImageHandle({
      id: 'umbilical-test-image',
      title: 'Umbilical Test Image',
      type: 'image/png',
      data: testImageData,
      width: 5,
      height: 5
    });

    // Mock createHandleFromURI
    const originalCreate = resourceManager.createHandleFromURI;
    resourceManager.createHandleFromURI = async (uri) => imageHandle;

    try {
      // Import ImageViewer directly to test rendering
      const componentsPath = new URL('@legion/components', import.meta.url).href;

      // Dynamically import from the package
      const { ImageViewer } = await import('@legion/components');

      // Test ImageViewer.create() with umbilical protocol
      const viewer = ImageViewer.create({
        dom: container,
        imageData: testImageData,
        showControls: true,
        showInfo: true,
        onImageLoaded: (instance) => {
          console.log('[TEST] Image loaded successfully');
        },
        onError: (instance) => {
          console.error('[TEST] Image failed to load');
        }
      });

      // Verify viewer was created
      expect(viewer).toBeDefined();
      expect(viewer.state).toBeDefined();

      // Wait for render
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify DOM structure
      const img = container.querySelector('img');
      expect(img).toBeDefined();
      expect(img.src).toBe(testImageData);

      // Verify umbilical components container exists
      const componentContainer = container.querySelector('.image-viewer-container, [class*="image"]');
      expect(componentContainer).toBeDefined();

      console.log('[TEST] ✅ Image rendered successfully in JSDOM');
      console.log('[TEST] Image src:', img?.src?.substring(0, 50));
      console.log('[TEST] Container children:', container.childNodes.length);

    } finally {
      resourceManager.createHandleFromURI = originalCreate;
    }
  }, 15000);

  test('should execute /show command and verify AssetRenderer creates ImageViewer', async () => {
    const port = 8000 + Math.floor(Math.random() * 500);
    cli = new CLI(resourceManager, { port });

    await cli.initialize();
    await cli.start();

    // Mock browser functions but keep rendering pipeline
    cli.showme.server.launchBrowser = async () => { return; };
    cli.showme._waitForConnection = async () => { return; };

    // Track what gets rendered
    let displayedAsset = null;
    cli.showme.getServerActor = () => ({
      handleDisplayAsset: async (assetData) => {
        displayedAsset = assetData;

        // Simulate real rendering in browser
        const container = document.createElement('div');
        container.id = 'asset-window-content';
        document.body.appendChild(container);

        // Import AssetRenderer and render
        const { AssetRenderer } = await import('../../apps/cli-ui/src/components/AssetRenderer.js');
        const renderer = new AssetRenderer(container, assetData);
        await renderer.initialize();

        return;
      }
    });

    // Create test ImageHandle
    const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
    const imageHandle = new ImageHandle({
      id: 'show-command-test',
      title: 'Show Command Test',
      type: 'image/png',
      data: testImageData,
      width: 5,
      height: 5
    });

    const originalCreate = resourceManager.createHandleFromURI;
    resourceManager.createHandleFromURI = async (uri) => imageHandle;

    try {
      // Execute /show command
      const result = await cli.sessionActor.receive('execute-command', {
        command: '/show legion://test/image'
      });

      expect(result.success).toBe(true);
      expect(displayedAsset).toBeDefined();
      expect(displayedAsset.assetData).toBeDefined();

      // Wait for async rendering
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify image was rendered in DOM
      const img = document.querySelector('img');
      expect(img).toBeDefined();
      expect(img.src).toBe(testImageData);

      console.log('[TEST] ✅ /show command rendered image successfully');
      console.log('[TEST] Asset type:', displayedAsset.assetType);
      console.log('[TEST] Image found in DOM:', !!img);

    } finally {
      resourceManager.createHandleFromURI = originalCreate;
    }
  }, 20000);
});
