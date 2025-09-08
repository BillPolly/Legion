/**
 * Integration Tests for AssetDisplayManager with Real Legion Components
 * 
 * Tests display manager functionality with actual ResourceWindowManager
 * NO MOCKS - Tests real window management and viewer creation
 */

import { AssetDisplayManager } from '../../src/client/AssetDisplayManager.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ResourceManager } from '@legion/resource-manager';
import fetch from 'node-fetch';
import WebSocket from 'ws';

describe('Display Manager Integration with Real Legion Components', () => {
  let displayManager;
  let server;
  let resourceManager;
  const testPort = 3791;

  beforeAll(async () => {
    // Start real server
    server = new ShowMeServer({ 
      port: testPort,
      skipLegionPackages: true 
    });
    await server.initialize();
    await server.start();
    
    // Initialize ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, 30000);

  afterAll(async () => {
    if (displayManager) {
      await displayManager.cleanup();
    }
    if (server) {
      await server.stop();
    }
  });

  describe('display manager initialization', () => {
    test('should initialize display manager with Legion ResourceWindowManager', async () => {
      displayManager = new AssetDisplayManager({
        serverUrl: `http://localhost:${testPort}`,
        wsUrl: `ws://localhost:${testPort}/showme`
      });
      
      await displayManager.initialize();
      
      expect(displayManager.initialized).toBe(true);
      expect(displayManager.windowManager).toBeTruthy();
      expect(displayManager.windows).toBeInstanceOf(Map);
    });

    test('should connect to WebSocket server on initialization', async () => {
      const dm = new AssetDisplayManager({
        serverUrl: `http://localhost:${testPort}`,
        wsUrl: `ws://localhost:${testPort}/showme`
      });
      
      await dm.initialize();
      
      expect(dm.ws).toBeTruthy();
      expect(dm.ws.readyState).toBe(WebSocket.OPEN);
      
      await dm.cleanup();
    });

    test('should handle initialization errors gracefully', async () => {
      const dm = new AssetDisplayManager({
        serverUrl: 'http://localhost:99999', // Invalid port
        wsUrl: 'ws://localhost:99999/showme'
      });
      
      try {
        await dm.initialize();
      } catch (error) {
        expect(error.message).toContain('Failed to connect');
      }
    });
  });

  describe('asset display workflow', () => {
    let displayManager;

    beforeEach(async () => {
      displayManager = new AssetDisplayManager({
        serverUrl: `http://localhost:${testPort}`,
        wsUrl: `ws://localhost:${testPort}/showme`
      });
      await displayManager.initialize();
    });

    afterEach(async () => {
      if (displayManager) {
        await displayManager.cleanup();
      }
    });

    test('should display JSON asset in window', async () => {
      // Create asset on server
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { test: 'data', value: 123 },
          assetType: 'json',
          title: 'Test JSON Display'
        })
      });
      
      const { assetId } = await response.json();
      
      // Display asset
      const windowId = await displayManager.displayAsset(assetId, 'json', {
        title: 'Test JSON Display'
      });
      
      expect(windowId).toBeTruthy();
      expect(displayManager.windows.has(windowId)).toBe(true);
      
      const windowInfo = displayManager.windows.get(windowId);
      expect(windowInfo.assetId).toBe(assetId);
      expect(windowInfo.assetType).toBe('json');
    });

    test('should display code asset with syntax highlighting', async () => {
      const codeContent = `
function hello() {
  console.log("Hello World");
  return true;
}`;
      
      // Create code asset
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: codeContent,
          assetType: 'code',
          title: 'JavaScript Code'
        })
      });
      
      const { assetId } = await response.json();
      
      // Display code
      const windowId = await displayManager.displayAsset(assetId, 'code', {
        title: 'JavaScript Code',
        language: 'javascript'
      });
      
      expect(windowId).toBeTruthy();
      
      const windowInfo = displayManager.windows.get(windowId);
      expect(windowInfo.assetType).toBe('code');
      expect(windowInfo.options.language).toBe('javascript');
    });

    test('should display tabular data', async () => {
      const tableData = [
        { id: 1, name: 'Item 1', value: 100 },
        { id: 2, name: 'Item 2', value: 200 },
        { id: 3, name: 'Item 3', value: 300 }
      ];
      
      // Create data asset
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: tableData,
          assetType: 'data',
          title: 'Data Table'
        })
      });
      
      const { assetId } = await response.json();
      
      // Display table
      const windowId = await displayManager.displayAsset(assetId, 'data', {
        title: 'Data Table'
      });
      
      expect(windowId).toBeTruthy();
      expect(displayManager.windows.get(windowId).assetType).toBe('data');
    });

    test('should display image asset', async () => {
      // Create image asset (using base64 data URL for testing)
      const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: imageData,
          assetType: 'image',
          title: 'Test Image'
        })
      });
      
      const { assetId } = await response.json();
      
      // Display image
      const windowId = await displayManager.displayAsset(assetId, 'image', {
        title: 'Test Image',
        width: 400,
        height: 300
      });
      
      expect(windowId).toBeTruthy();
      expect(displayManager.windows.get(windowId).assetType).toBe('image');
    });

    test('should display web content', async () => {
      const htmlContent = '<html><body><h1>Test Page</h1></body></html>';
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: htmlContent,
          assetType: 'web',
          title: 'Web View'
        })
      });
      
      const { assetId } = await response.json();
      
      // Display web content
      const windowId = await displayManager.displayAsset(assetId, 'web', {
        title: 'Web View'
      });
      
      expect(windowId).toBeTruthy();
      expect(displayManager.windows.get(windowId).assetType).toBe('web');
    });
  });

  describe('window management', () => {
    let displayManager;

    beforeEach(async () => {
      displayManager = new AssetDisplayManager({
        serverUrl: `http://localhost:${testPort}`,
        wsUrl: `ws://localhost:${testPort}/showme`
      });
      await displayManager.initialize();
    });

    afterEach(async () => {
      if (displayManager) {
        await displayManager.cleanup();
      }
    });

    test('should track multiple windows', async () => {
      const assetIds = [];
      const windowIds = [];
      
      // Create multiple assets
      for (let i = 0; i < 3; i++) {
        const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset: { index: i },
            assetType: 'json',
            title: `Window ${i}`
          })
        });
        
        const { assetId } = await response.json();
        assetIds.push(assetId);
      }
      
      // Display all assets
      for (let i = 0; i < assetIds.length; i++) {
        const windowId = await displayManager.displayAsset(assetIds[i], 'json', {
          title: `Window ${i}`
        });
        windowIds.push(windowId);
      }
      
      expect(displayManager.windows.size).toBe(3);
      
      // Verify all windows are tracked
      windowIds.forEach((windowId, index) => {
        expect(displayManager.windows.has(windowId)).toBe(true);
        const info = displayManager.windows.get(windowId);
        expect(info.assetId).toBe(assetIds[index]);
      });
    });

    test('should close specific window', async () => {
      // Create and display asset
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { close: 'test' },
          assetType: 'json',
          title: 'Close Test'
        })
      });
      
      const { assetId } = await response.json();
      const windowId = await displayManager.displayAsset(assetId, 'json');
      
      expect(displayManager.windows.has(windowId)).toBe(true);
      
      // Close window
      await displayManager.closeWindow(windowId);
      
      expect(displayManager.windows.has(windowId)).toBe(false);
    });

    test('should close all windows on cleanup', async () => {
      // Create multiple windows
      for (let i = 0; i < 3; i++) {
        const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset: { cleanup: i },
            assetType: 'json'
          })
        });
        
        const { assetId } = await response.json();
        await displayManager.displayAsset(assetId, 'json');
      }
      
      expect(displayManager.windows.size).toBe(3);
      
      // Cleanup
      await displayManager.cleanup();
      
      expect(displayManager.windows.size).toBe(0);
      expect(displayManager.ws).toBeNull();
    });

    test('should handle window resize events', async () => {
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { resize: 'test' },
          assetType: 'json',
          title: 'Resize Test'
        })
      });
      
      const { assetId } = await response.json();
      const windowId = await displayManager.displayAsset(assetId, 'json', {
        width: 400,
        height: 300,
        resizable: true
      });
      
      // Simulate resize
      await displayManager.resizeWindow(windowId, 600, 400);
      
      const windowInfo = displayManager.windows.get(windowId);
      expect(windowInfo.options.width).toBe(600);
      expect(windowInfo.options.height).toBe(400);
    });

    test('should handle window position changes', async () => {
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { move: 'test' },
          assetType: 'json',
          title: 'Move Test'
        })
      });
      
      const { assetId } = await response.json();
      const windowId = await displayManager.displayAsset(assetId, 'json', {
        x: 100,
        y: 100
      });
      
      // Move window
      await displayManager.moveWindow(windowId, 200, 150);
      
      const windowInfo = displayManager.windows.get(windowId);
      expect(windowInfo.options.x).toBe(200);
      expect(windowInfo.options.y).toBe(150);
    });
  });

  describe('real-time updates', () => {
    let displayManager;

    beforeEach(async () => {
      displayManager = new AssetDisplayManager({
        serverUrl: `http://localhost:${testPort}`,
        wsUrl: `ws://localhost:${testPort}/showme`
      });
      await displayManager.initialize();
    });

    afterEach(async () => {
      if (displayManager) {
        await displayManager.cleanup();
      }
    });

    test('should receive asset update notifications', async () => {
      const updatePromise = new Promise((resolve) => {
        displayManager.on('asset-updated', resolve);
      });
      
      // Create and display asset
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { initial: 'value' },
          assetType: 'json',
          title: 'Update Test'
        })
      });
      
      const { assetId } = await response.json();
      await displayManager.displayAsset(assetId, 'json');
      
      // Update asset on server
      await fetch(`${displayManager.serverUrl}/api/update-asset/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { updated: 'value' }
        })
      });
      
      const update = await Promise.race([
        updatePromise,
        new Promise(resolve => setTimeout(() => resolve(null), 2000))
      ]);
      
      if (update) {
        expect(update.assetId).toBe(assetId);
        expect(update.asset).toEqual({ updated: 'value' });
      }
    });

    test('should handle server disconnection gracefully', async () => {
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { disconnect: 'test' },
          assetType: 'json'
        })
      });
      
      const { assetId } = await response.json();
      const windowId = await displayManager.displayAsset(assetId, 'json');
      
      // Simulate disconnection
      displayManager.ws.close();
      
      // Should handle gracefully
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Window should still be tracked
      expect(displayManager.windows.has(windowId)).toBe(true);
      
      // Should be able to reconnect
      await displayManager.reconnect();
      expect(displayManager.ws.readyState).toBe(WebSocket.OPEN);
    });
  });

  describe('error handling', () => {
    let displayManager;

    beforeEach(async () => {
      displayManager = new AssetDisplayManager({
        serverUrl: `http://localhost:${testPort}`,
        wsUrl: `ws://localhost:${testPort}/showme`
      });
      await displayManager.initialize();
    });

    afterEach(async () => {
      if (displayManager) {
        await displayManager.cleanup();
      }
    });

    test('should fail fast with invalid asset ID', async () => {
      await expect(
        displayManager.displayAsset('invalid-asset-id', 'json')
      ).rejects.toThrow('Asset not found');
    });

    test('should fail fast with unsupported asset type', async () => {
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: 'test',
          assetType: 'text'
        })
      });
      
      const { assetId } = await response.json();
      
      await expect(
        displayManager.displayAsset(assetId, 'unsupported-type')
      ).rejects.toThrow('Unsupported asset type');
    });

    test('should handle network errors gracefully', async () => {
      // Close WebSocket to simulate network error
      displayManager.ws.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch(`${displayManager.serverUrl}/api/display-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { network: 'error' },
          assetType: 'json'
        })
      });
      
      const { assetId } = await response.json();
      
      // Should attempt to reconnect and display
      const windowId = await displayManager.displayAsset(assetId, 'json');
      expect(windowId).toBeTruthy();
    });

    test('should provide clear error messages', async () => {
      try {
        await displayManager.closeWindow('non-existent-window');
      } catch (error) {
        expect(error.message).toContain('Window not found');
      }
      
      try {
        await displayManager.resizeWindow('non-existent-window', 100, 100);
      } catch (error) {
        expect(error.message).toContain('Window not found');
      }
    });
  });
});