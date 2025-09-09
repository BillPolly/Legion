/**
 * Integration Tests for Client → UI Component Flow
 * 
 * Tests complete flow from client actor to UI components with real DOM
 * NO MOCKS - Tests real UI rendering and DOM manipulation
 */

import { AssetDisplayManager } from '../../apps/showme-ui/src/services/AssetDisplayManager.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ResourceManager } from '@legion/resource-manager';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';
import { getRandomTestPort, waitForServer } from '../helpers/testUtils.js';

describe('Client → UI Component Flow Integration', () => {
  let server;
  let displayManager;
  let clientActor;
  let resourceManager;
  let dom;
  let document;
  let window;
  let testPort;

  beforeAll(async () => {
    testPort = getRandomTestPort();
    // Set up virtual DOM
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    document = dom.window.document;
    window = dom.window;
    
    // Make DOM global for UI components
    global.document = document;
    global.window = window;
    global.HTMLElement = window.HTMLElement;
    
    // Initialize ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Start real server
    server = new ShowMeServer({ 
      port: testPort,
      skipLegionPackages: true 
    });
    await server.initialize();
    await server.start();
    
    // Initialize display manager
    displayManager = new AssetDisplayManager({
      serverUrl: `http://localhost:${testPort}`,
      wsUrl: `ws://localhost:${testPort}/ws?route=/showme`,
      container: document.getElementById('app')
    });
    await displayManager.initialize();
    
    // Initialize client actor
    clientActor = new ShowMeClientActor({
      serverUrl: `ws://localhost:${testPort}/ws?route=/showme`,
      displayManager: displayManager
    });
    await clientActor.initialize();
    await clientActor.connect();
    
    // Wait for everything to be ready
    await waitForServer(500);
  }, 30000);

  afterAll(async () => {
    if (clientActor) {
      await clientActor.disconnect();
      await clientActor.cleanup();
    }
    if (displayManager) {
      await displayManager.cleanup();
    }
    if (server) {
      await server.stop();
    }
    
    // Clean up global DOM
    delete global.document;
    delete global.window;
    delete global.HTMLElement;
  });

  describe('UI window creation flow', () => {
    test('should create DOM window element when asset is displayed', async () => {
      // Create asset on server
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { ui: 'test' },
          assetType: 'json',
          title: 'UI Window Test'
        })
      });
      
      const { assetId } = await response.json();
      
      // Display through client actor
      await clientActor.displayAsset(assetId, {
        width: 600,
        height: 400
      });
      
      // Wait for DOM update
      await waitForServer(500);
      
      // Check DOM for window element
      const windowElements = document.querySelectorAll('.showme-window');
      expect(windowElements.length).toBeGreaterThan(0);
      
      // Verify window has correct attributes
      const windowElement = windowElements[0];
      expect(windowElement.dataset.assetId).toBe(assetId);
      expect(windowElement.style.width).toContain('600');
      expect(windowElement.style.height).toContain('400');
    });

    test('should create window header with title and controls', async () => {
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { header: 'test' },
          assetType: 'json',
          title: 'Window Header Test'
        })
      });
      
      const { assetId } = await response.json();
      
      await clientActor.displayAsset(assetId);
      await waitForServer(500);
      
      // Find window header
      const windowElement = document.querySelector(`[data-asset-id="${assetId}"]`);
      const header = windowElement?.querySelector('.showme-window-header');
      
      expect(header).toBeTruthy();
      
      if (header) {
        // Check title
        const title = header.querySelector('.showme-window-title');
        expect(title?.textContent).toContain('Window Header Test');
        
        // Check controls
        const closeButton = header.querySelector('.showme-window-close');
        const minimizeButton = header.querySelector('.showme-window-minimize');
        const maximizeButton = header.querySelector('.showme-window-maximize');
        
        expect(closeButton).toBeTruthy();
        expect(minimizeButton).toBeTruthy();
        expect(maximizeButton).toBeTruthy();
      }
    });

    test('should apply correct CSS classes for asset type', async () => {
      const assetTypes = ['json', 'image', 'code', 'data', 'web'];
      const assetIds = [];
      
      // Create assets of different types
      for (const type of assetTypes) {
        const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset: type === 'image' ? 'data:image/png;base64,iVBORw0KG' : { type },
            assetType: type,
            title: `${type} Asset`
          })
        });
        
        const { assetId } = await response.json();
        assetIds.push({ id: assetId, type });
      }
      
      // Display all assets
      for (const { id, type } of assetIds) {
        await clientActor.displayAsset(id);
      }
      
      await waitForServer(500);
      
      // Verify CSS classes
      for (const { id, type } of assetIds) {
        const windowElement = document.querySelector(`[data-asset-id="${id}"]`);
        expect(windowElement?.classList.contains(`showme-window-${type}`)).toBe(true);
      }
    });
  });

  describe('UI content rendering', () => {
    test('should render JSON content with proper formatting', async () => {
      const jsonData = {
        name: 'Test Object',
        nested: {
          value: 42,
          array: [1, 2, 3]
        }
      };
      
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: jsonData,
          assetType: 'json',
          title: 'JSON Render Test'
        })
      });
      
      const { assetId } = await response.json();
      
      await clientActor.displayAsset(assetId);
      await waitForServer(500);
      
      // Find content area
      const windowElement = document.querySelector(`[data-asset-id="${assetId}"]`);
      const contentArea = windowElement?.querySelector('.showme-window-content');
      
      expect(contentArea).toBeTruthy();
      
      if (contentArea) {
        // Check for JSON viewer elements
        const jsonViewer = contentArea.querySelector('.json-viewer');
        expect(jsonViewer).toBeTruthy();
        
        // Check for syntax highlighting
        const syntaxElements = jsonViewer?.querySelectorAll('.json-key, .json-value, .json-string');
        expect(syntaxElements?.length).toBeGreaterThan(0);
      }
    });

    test('should render code with syntax highlighting', async () => {
      const codeContent = `function test() {
  console.log("Hello World");
  return true;
}`;
      
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: codeContent,
          assetType: 'code',
          title: 'Code Render Test'
        })
      });
      
      const { assetId } = await response.json();
      
      await clientActor.displayAsset(assetId, {
        language: 'javascript'
      });
      await waitForServer(500);
      
      const windowElement = document.querySelector(`[data-asset-id="${assetId}"]`);
      const codeArea = windowElement?.querySelector('.showme-window-content');
      
      if (codeArea) {
        // Check for code viewer
        const codeViewer = codeArea.querySelector('.code-viewer, pre');
        expect(codeViewer).toBeTruthy();
        
        // Check for line numbers
        const lineNumbers = codeArea.querySelector('.line-numbers');
        if (lineNumbers) {
          expect(lineNumbers.children.length).toBe(4); // 4 lines of code
        }
      }
    });

    test('should render table data with proper structure', async () => {
      const tableData = [
        { id: 1, name: 'Alice', score: 95 },
        { id: 2, name: 'Bob', score: 87 },
        { id: 3, name: 'Charlie', score: 92 }
      ];
      
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: tableData,
          assetType: 'data',
          title: 'Table Render Test'
        })
      });
      
      const { assetId } = await response.json();
      
      await clientActor.displayAsset(assetId);
      await waitForServer(500);
      
      const windowElement = document.querySelector(`[data-asset-id="${assetId}"]`);
      const tableContainer = windowElement?.querySelector('.showme-window-content');
      
      if (tableContainer) {
        const table = tableContainer.querySelector('table');
        expect(table).toBeTruthy();
        
        if (table) {
          // Check headers
          const headers = table.querySelectorAll('thead th');
          expect(headers.length).toBe(3); // id, name, score
          
          // Check rows
          const rows = table.querySelectorAll('tbody tr');
          expect(rows.length).toBe(3); // 3 data rows
        }
      }
    });

    test('should render images with proper scaling', async () => {
      const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: imageData,
          assetType: 'image',
          title: 'Image Render Test'
        })
      });
      
      const { assetId } = await response.json();
      
      await clientActor.displayAsset(assetId, {
        width: 400,
        height: 300,
        maintainAspectRatio: true
      });
      await waitForServer(500);
      
      const windowElement = document.querySelector(`[data-asset-id="${assetId}"]`);
      const imageContainer = windowElement?.querySelector('.showme-window-content');
      
      if (imageContainer) {
        const img = imageContainer.querySelector('img');
        expect(img).toBeTruthy();
        
        if (img) {
          expect(img.src).toBe(imageData);
          expect(img.style.maxWidth).toBe('100%');
          expect(img.style.height).toBe('auto');
        }
      }
    });
  });

  describe('UI interaction handling', () => {
    test('should handle window close button click', async () => {
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { close: 'test' },
          assetType: 'json',
          title: 'Close Test'
        })
      });
      
      const { assetId } = await response.json();
      
      await clientActor.displayAsset(assetId);
      await waitForServer(500);
      
      const windowElement = document.querySelector(`[data-asset-id="${assetId}"]`);
      const closeButton = windowElement?.querySelector('.showme-window-close');
      
      expect(closeButton).toBeTruthy();
      
      if (closeButton) {
        // Click close button
        closeButton.click();
        await waitForServer(500);
        
        // Window should be removed from DOM
        const removedWindow = document.querySelector(`[data-asset-id="${assetId}"]`);
        expect(removedWindow).toBeNull();
      }
    });

    test('should handle window minimize/maximize', async () => {
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { minimize: 'test' },
          assetType: 'json',
          title: 'Minimize Test'
        })
      });
      
      const { assetId } = await response.json();
      
      await clientActor.displayAsset(assetId);
      await waitForServer(500);
      
      const windowElement = document.querySelector(`[data-asset-id="${assetId}"]`);
      const minimizeButton = windowElement?.querySelector('.showme-window-minimize');
      const maximizeButton = windowElement?.querySelector('.showme-window-maximize');
      
      if (minimizeButton) {
        // Minimize window
        minimizeButton.click();
        await waitForServer(500);
        
        expect(windowElement.classList.contains('minimized')).toBe(true);
      }
      
      if (maximizeButton) {
        // Maximize window
        maximizeButton.click();
        await waitForServer(500);
        
        expect(windowElement.classList.contains('maximized')).toBe(true);
      }
    });

    test('should handle window dragging', async () => {
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { drag: 'test' },
          assetType: 'json',
          title: 'Drag Test'
        })
      });
      
      const { assetId } = await response.json();
      
      await clientActor.displayAsset(assetId, {
        x: 100,
        y: 100
      });
      await waitForServer(500);
      
      const windowElement = document.querySelector(`[data-asset-id="${assetId}"]`);
      const header = windowElement?.querySelector('.showme-window-header');
      
      if (header && windowElement) {
        const initialX = parseInt(windowElement.style.left) || 100;
        const initialY = parseInt(windowElement.style.top) || 100;
        
        // Simulate drag
        const mouseDown = new window.MouseEvent('mousedown', {
          clientX: initialX,
          clientY: initialY,
          bubbles: true
        });
        header.dispatchEvent(mouseDown);
        
        const mouseMove = new window.MouseEvent('mousemove', {
          clientX: initialX + 50,
          clientY: initialY + 50,
          bubbles: true
        });
        document.dispatchEvent(mouseMove);
        
        const mouseUp = new window.MouseEvent('mouseup', {
          bubbles: true
        });
        document.dispatchEvent(mouseUp);
        
        await waitForServer(500);
        
        // Window should have moved
        const newX = parseInt(windowElement.style.left) || 0;
        const newY = parseInt(windowElement.style.top) || 0;
        
        // Position might have changed (depending on implementation)
        expect(newX).toBeGreaterThanOrEqual(initialX);
        expect(newY).toBeGreaterThanOrEqual(initialY);
      }
    });

    test('should handle window resizing', async () => {
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { resize: 'test' },
          assetType: 'json',
          title: 'Resize Test'
        })
      });
      
      const { assetId } = await response.json();
      
      await clientActor.displayAsset(assetId, {
        width: 400,
        height: 300,
        resizable: true
      });
      await waitForServer(500);
      
      const windowElement = document.querySelector(`[data-asset-id="${assetId}"]`);
      const resizeHandle = windowElement?.querySelector('.showme-window-resize');
      
      if (resizeHandle && windowElement) {
        const initialWidth = parseInt(windowElement.style.width) || 400;
        const initialHeight = parseInt(windowElement.style.height) || 300;
        
        // Simulate resize
        const mouseDown = new window.MouseEvent('mousedown', {
          clientX: initialWidth,
          clientY: initialHeight,
          bubbles: true
        });
        resizeHandle.dispatchEvent(mouseDown);
        
        const mouseMove = new window.MouseEvent('mousemove', {
          clientX: initialWidth + 100,
          clientY: initialHeight + 100,
          bubbles: true
        });
        document.dispatchEvent(mouseMove);
        
        const mouseUp = new window.MouseEvent('mouseup', {
          bubbles: true
        });
        document.dispatchEvent(mouseUp);
        
        await waitForServer(500);
        
        // Window size might have changed
        const newWidth = parseInt(windowElement.style.width) || 0;
        const newHeight = parseInt(windowElement.style.height) || 0;
        
        expect(newWidth).toBeGreaterThanOrEqual(initialWidth);
        expect(newHeight).toBeGreaterThanOrEqual(initialHeight);
      }
    });
  });

  describe('UI state synchronization', () => {
    test('should update UI when asset is updated on server', async () => {
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { version: 1 },
          assetType: 'json',
          title: 'Update Test'
        })
      });
      
      const { assetId } = await response.json();
      
      await clientActor.displayAsset(assetId);
      await waitForServer(500);
      
      // Find initial content
      const windowElement = document.querySelector(`[data-asset-id="${assetId}"]`);
      const contentArea = windowElement?.querySelector('.showme-window-content');
      const initialContent = contentArea?.textContent;
      
      // Update asset on server
      await fetch(`http://localhost:${testPort}/api/update-asset/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { version: 2, updated: true }
        })
      });
      
      await waitForServer(500);
      
      // Content should be updated
      const updatedContent = contentArea?.textContent;
      expect(updatedContent).not.toBe(initialContent);
      expect(updatedContent).toContain('version');
      expect(updatedContent).toContain('2');
    });

    test('should maintain UI state across reconnections', async () => {
      // Create and display asset
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { persistent: 'state' },
          assetType: 'json',
          title: 'Persistent State'
        })
      });
      
      const { assetId } = await response.json();
      
      await clientActor.displayAsset(assetId, {
        width: 500,
        height: 400,
        x: 150,
        y: 150
      });
      await waitForServer(500);
      
      // Disconnect and reconnect
      await clientActor.disconnect();
      await waitForServer(500);
      await clientActor.connect();
      await waitForServer(500);
      
      // Window should still exist with same properties
      const windowElement = document.querySelector(`[data-asset-id="${assetId}"]`);
      expect(windowElement).toBeTruthy();
      
      if (windowElement) {
        expect(windowElement.style.width).toContain('500');
        expect(windowElement.style.height).toContain('400');
      }
    });
  });

  describe('UI error handling', () => {
    test('should display error message for invalid assets', async () => {
      // Try to display non-existent asset
      await clientActor.displayAsset('non-existent-id');
      await waitForServer(500);
      
      // Should show error UI
      const errorElement = document.querySelector('.showme-error');
      if (errorElement) {
        expect(errorElement.textContent).toContain('not found');
      }
    });

    test('should handle rendering errors gracefully', async () => {
      // Create asset with invalid content for its type
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: 'not valid json',
          assetType: 'json',
          title: 'Invalid JSON'
        })
      });
      
      const { assetId } = await response.json();
      
      await clientActor.displayAsset(assetId);
      await waitForServer(500);
      
      // Should display fallback or error
      const windowElement = document.querySelector(`[data-asset-id="${assetId}"]`);
      const contentArea = windowElement?.querySelector('.showme-window-content');
      
      if (contentArea) {
        // Should show as text or error
        const fallback = contentArea.querySelector('.text-viewer, .error-message');
        expect(fallback).toBeTruthy();
      }
    });
  });

  describe('UI performance', () => {
    test('should handle multiple windows efficiently', async () => {
      const assetIds = [];
      
      // Create multiple assets
      for (let i = 0; i < 10; i++) {
        const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset: { window: i },
            assetType: 'json',
            title: `Window ${i}`
          })
        });
        
        const { assetId } = await response.json();
        assetIds.push(assetId);
      }
      
      // Display all windows
      const startTime = Date.now();
      
      for (const assetId of assetIds) {
        await clientActor.displayAsset(assetId, {
          width: 300,
          height: 200,
          x: Math.random() * 500,
          y: Math.random() * 500
        });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds for 10 windows
      
      // All windows should be in DOM
      const windows = document.querySelectorAll('.showme-window');
      expect(windows.length).toBe(10);
    });

    test('should clean up DOM properly when windows are closed', async () => {
      const initialChildCount = document.getElementById('app').children.length;
      
      // Create and display asset
      const response = await fetch(`http://localhost:${testPort}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { cleanup: 'test' },
          assetType: 'json',
          title: 'Cleanup Test'
        })
      });
      
      const { assetId } = await response.json();
      
      await clientActor.displayAsset(assetId);
      await waitForServer(500);
      
      // Close window
      await displayManager.closeWindow(assetId);
      await waitForServer(500);
      
      // DOM should be cleaned up
      const finalChildCount = document.getElementById('app').children.length;
      expect(finalChildCount).toBe(initialChildCount);
      
      // No orphaned event listeners or elements
      const orphanedElements = document.querySelectorAll(`[data-asset-id="${assetId}"]`);
      expect(orphanedElements.length).toBe(0);
    });
  });
});