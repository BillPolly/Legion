/**
 * Integration tests for HandleRenderer
 * Tests complete rendering flow with real strategy Handles
 * NO MOCKS - uses real ResourceManager and strategy files
 */

import { HandleRenderer } from '../../src/renderers/HandleRenderer.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { jest } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('HandleRenderer Integration', () => {
  let renderer;
  let resourceManager;
  let testStrategyPath;
  let dom;
  let container;

  beforeAll(async () => {
    // Get real ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();

    // Use an existing strategy file for testing
    testStrategyPath = path.resolve(__dirname, '../../../../../packages/agents/roma-agent/src/strategies/simple-node/SimpleNodeTestStrategy.js');

    // Setup JSDOM for DOM testing
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = dom.window.document;
    global.Element = dom.window.Element;
  });

  beforeEach(() => {
    renderer = new HandleRenderer();
    container = document.createElement('div');
  });

  describe('Render Real Strategy Handle', () => {
    test('should render strategy Handle in container', async () => {
      // Create real strategy Handle
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      // Render it
      await renderer.render(handle, container);

      // Verify container has content
      expect(container.innerHTML).toBeTruthy();
      expect(container.innerHTML.length).toBeGreaterThan(100);
    });

    test('should display Handle header with URI and type', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await renderer.render(handle, container);

      // Check for header elements
      expect(container.innerHTML).toContain('strategy');
      expect(container.innerHTML).toContain('legion://');
    });

    test('should display Handle methods', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await renderer.render(handle, container);

      // Strategy handles have methods like toURI, getMetadata, etc.
      expect(container.innerHTML).toContain('Methods');
    });

    test('should display Handle actions', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await renderer.render(handle, container);

      // Should have action buttons
      expect(container.innerHTML).toContain('Actions');
      expect(container.innerHTML).toContain('Copy URI');
      expect(container.innerHTML).toContain('View JSON');
    });
  });

  describe('Handle Metadata Extraction', () => {
    test('should extract and display metadata from strategy Handle', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      // Extract metadata before rendering
      const metadata = await handle.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata.strategyName).toBeDefined();

      // Render with metadata
      await renderer.render(handle, container);

      // Metadata should influence the display
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });

    test('should handle Handles without metadata gracefully', async () => {
      // Create a minimal Handle without getMetadata
      const minimalHandle = {
        toURI: () => 'legion://localhost/test/resource',
        resourceType: 'test',
        server: 'localhost'
      };

      // Should not throw
      await expect(
        renderer.render(minimalHandle, container)
      ).resolves.not.toThrow();

      // Should still render something
      expect(container.innerHTML).toBeTruthy();
    });
  });

  describe('View Structure', () => {
    test('should create complete view structure', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await renderer.render(handle, container);

      // Check for view sections
      const html = container.innerHTML;
      expect(html).toContain('handle-view');
      expect(html).toContain('handle-header');
    });

    test('should include Handle URI in view', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await renderer.render(handle, container);

      const actualUri = handle.toURI();
      expect(container.innerHTML).toContain(actualUri);
    });

    test('should include Handle type in view', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await renderer.render(handle, container);

      expect(container.innerHTML).toContain(handle.resourceType);
    });
  });

  describe('Multiple Renders', () => {
    test('should replace previous content on re-render', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      // First render
      await renderer.render(handle, container);
      const firstHTML = container.innerHTML;

      // Second render
      await renderer.render(handle, container);
      const secondHTML = container.innerHTML;

      // Content should be replaced (similar length/structure)
      expect(secondHTML).toBeTruthy();
      expect(secondHTML.length).toBeGreaterThan(100);
    });

    test('should render different Handles in same container', async () => {
      const uri1 = `legion://localhost/strategy${testStrategyPath}`;
      const handle1 = await ResourceManager.fromURI(uri1);

      // First Handle
      await renderer.render(handle1, container);
      expect(container.innerHTML).toContain('strategy');

      // Different Handle type
      const minimalHandle = {
        toURI: () => 'legion://localhost/test/other',
        resourceType: 'test',
        server: 'localhost'
      };

      await renderer.render(minimalHandle, container);
      expect(container.innerHTML).toContain('test');
      expect(container.innerHTML).not.toContain('strategy');
    });
  });

  describe('Error Handling', () => {
    test('should reject invalid Handle', async () => {
      const invalidHandle = {
        resourceType: 'test'
        // Missing toURI
      };

      await expect(
        renderer.render(invalidHandle, container)
      ).rejects.toThrow();
    });

    test('should reject invalid container', async () => {
      const handle = {
        toURI: () => 'legion://localhost/test/resource',
        resourceType: 'test'
      };

      await expect(
        renderer.render(handle, null)
      ).rejects.toThrow();
    });

    test('should handle Handle with failing getMetadata gracefully', async () => {
      const faultyHandle = {
        toURI: () => 'legion://localhost/test/resource',
        resourceType: 'test',
        getMetadata: async () => {
          throw new Error('Metadata failed');
        }
      };

      // Should not throw - should continue without metadata
      await expect(
        renderer.render(faultyHandle, container)
      ).resolves.not.toThrow();

      // Should still render something
      expect(container.innerHTML).toBeTruthy();
    });
  });

  describe('Introspection Methods Integration', () => {
    test('should call all introspection methods during render', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const renderHeaderSpy = jest.spyOn(renderer, 'renderHeader');
      const renderPropertiesSpy = jest.spyOn(renderer, 'renderProperties');
      const renderMethodsSpy = jest.spyOn(renderer, 'renderMethods');
      const renderCapabilitiesSpy = jest.spyOn(renderer, 'renderCapabilities');
      const renderActionsSpy = jest.spyOn(renderer, 'renderActions');

      await renderer.render(handle, container);

      expect(renderHeaderSpy).toHaveBeenCalledWith(handle);
      expect(renderPropertiesSpy).toHaveBeenCalled();
      expect(renderMethodsSpy).toHaveBeenCalledWith(handle);
      expect(renderCapabilitiesSpy).toHaveBeenCalled();
      expect(renderActionsSpy).toHaveBeenCalledWith(handle);
    });

    test('should build complete view object', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const displaySpy = jest.spyOn(renderer, 'displayInWindow');

      await renderer.render(handle, container);

      expect(displaySpy).toHaveBeenCalled();
      const viewArg = displaySpy.mock.calls[0][0];

      expect(viewArg).toHaveProperty('header');
      expect(viewArg).toHaveProperty('properties');
      expect(viewArg).toHaveProperty('methods');
      expect(viewArg).toHaveProperty('capabilities');
      expect(viewArg).toHaveProperty('actions');
    });
  });
});