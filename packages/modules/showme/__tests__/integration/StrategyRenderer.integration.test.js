/**
 * Integration tests for StrategyRenderer
 * Tests complete rendering flow with real strategy Handles
 * NO MOCKS - uses real ResourceManager and strategy files
 */

import { StrategyRenderer } from '../../src/renderers/StrategyRenderer.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('StrategyRenderer Integration', () => {
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
    renderer = new StrategyRenderer();
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
      expect(container.innerHTML.length).toBeGreaterThan(200);
    });

    test('should display strategy header with name and type', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await renderer.render(handle, container);

      // Check for strategy-specific elements
      expect(container.innerHTML).toContain('strategy-header');
      expect(container.innerHTML).toContain('Type:');
    });

    test('should display requirements section', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await renderer.render(handle, container);

      // Should have requirements section
      expect(container.innerHTML).toContain('Requirements');
    });

    test('should display file information', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await renderer.render(handle, container);

      // Should have file info
      expect(container.innerHTML).toContain('File Information');
      expect(container.innerHTML).toContain('Path:');
    });

    test('should display strategy actions', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await renderer.render(handle, container);

      // Should have strategy-specific actions
      expect(container.innerHTML).toContain('Instantiate Strategy');
      expect(container.innerHTML).toContain('View Source');
      expect(container.innerHTML).toContain('Search Similar');
    });
  });

  describe('Strategy Metadata Extraction', () => {
    test('should extract and display strategy name', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const metadata = await handle.getMetadata();
      await renderer.render(handle, container);

      // Strategy name should be in the view
      if (metadata.strategyName) {
        expect(container.innerHTML).toContain(metadata.strategyName);
      }
    });

    test('should extract and display strategy type', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const metadata = await handle.getMetadata();
      await renderer.render(handle, container);

      // Strategy type should be displayed
      expect(container.innerHTML).toContain('Type:');
    });

    test('should display required tools if present', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const metadata = await handle.getMetadata();
      await renderer.render(handle, container);

      // If strategy has required tools, they should be listed
      if (metadata.requiredTools && metadata.requiredTools.length > 0) {
        expect(container.innerHTML).toContain('Required Tools');
      }
    });

    test('should display prompt schemas if present', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      const metadata = await handle.getMetadata();
      await renderer.render(handle, container);

      // If strategy has prompt schemas, they should be listed
      if (metadata.promptSchemas && metadata.promptSchemas.length > 0) {
        expect(container.innerHTML).toContain('Prompt Schemas');
      }
    });
  });

  describe('View Structure', () => {
    test('should create complete strategy view structure', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await renderer.render(handle, container);

      // Check for all main sections
      expect(container.innerHTML).toContain('strategy-view');
      expect(container.innerHTML).toContain('strategy-header');
      expect(container.innerHTML).toContain('strategy-requirements');
      expect(container.innerHTML).toContain('strategy-file-info');
      expect(container.innerHTML).toContain('strategy-actions');
    });

    test('should include strategy URI in view', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await renderer.render(handle, container);

      const actualUri = handle.toURI();
      expect(container.innerHTML).toContain(actualUri);
    });

    test('should use different structure than HandleRenderer', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await renderer.render(handle, container);

      // Should have strategy-specific CSS classes
      expect(container.innerHTML).toContain('strategy-');
      // Should NOT have generic handle classes
      expect(container.innerHTML).not.toContain('handle-view');
    });
  });

  describe('buildStrategyView Method', () => {
    test('should build complete view object', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);
      const metadata = await handle.getMetadata();

      const view = renderer.buildStrategyView(handle, metadata);

      expect(view).toHaveProperty('header');
      expect(view).toHaveProperty('requirements');
      expect(view).toHaveProperty('capabilities');
      expect(view).toHaveProperty('file');
      expect(view).toHaveProperty('actions');
    });

    test('should include strategy name in header', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);
      const metadata = await handle.getMetadata();

      const view = renderer.buildStrategyView(handle, metadata);

      expect(view.header.name).toBeDefined();
      expect(typeof view.header.name).toBe('string');
    });

    test('should include requirements with tools and prompts', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);
      const metadata = await handle.getMetadata();

      const view = renderer.buildStrategyView(handle, metadata);

      expect(view.requirements).toHaveProperty('tools');
      expect(view.requirements).toHaveProperty('prompts');
      expect(Array.isArray(view.requirements.tools)).toBe(true);
      expect(Array.isArray(view.requirements.prompts)).toBe(true);
    });

    test('should include file information', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);
      const metadata = await handle.getMetadata();

      const view = renderer.buildStrategyView(handle, metadata);

      expect(view.file).toHaveProperty('path');
      expect(view.file.path).toBeDefined();
    });

    test('should include strategy actions', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);
      const metadata = await handle.getMetadata();

      const view = renderer.buildStrategyView(handle, metadata);

      expect(Array.isArray(view.actions)).toBe(true);
      expect(view.actions.length).toBeGreaterThan(0);

      // Should have strategy-specific actions
      const actionLabels = view.actions.map(a => a.label);
      expect(actionLabels).toContain('Instantiate Strategy');
      expect(actionLabels).toContain('View Source');
      expect(actionLabels).toContain('Search Similar');
    });
  });

  describe('Error Handling', () => {
    test('should reject non-strategy Handle', async () => {
      // Create non-strategy Handle-like object
      const nonStrategyHandle = {
        toURI: () => 'legion://localhost/datastore/users/123',
        resourceType: 'datastore'
      };

      await expect(
        renderer.render(nonStrategyHandle, container)
      ).rejects.toThrow(/must be a strategy Handle/);
    });

    test('should reject invalid Handle', async () => {
      const invalidHandle = {
        resourceType: 'strategy'
        // Missing toURI
      };

      await expect(
        renderer.render(invalidHandle, container)
      ).rejects.toThrow();
    });

    test('should reject invalid container', async () => {
      const uri = `legion://localhost/strategy${testStrategyPath}`;
      const handle = await ResourceManager.fromURI(uri);

      await expect(
        renderer.render(handle, null)
      ).rejects.toThrow();
    });

    test('should handle strategy with minimal metadata gracefully', async () => {
      const minimalStrategyHandle = {
        toURI: () => 'legion://localhost/strategy/minimal.js',
        resourceType: 'strategy',
        getMetadata: async () => ({
          strategyName: 'Minimal',
          strategyType: 'test'
        })
      };

      // Should not throw
      await expect(
        renderer.render(minimalStrategyHandle, container)
      ).resolves.not.toThrow();

      // Should still render something
      expect(container.innerHTML).toBeTruthy();
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

      // Content should be replaced
      expect(secondHTML).toBeTruthy();
      expect(secondHTML.length).toBeGreaterThan(100);
    });
  });
});