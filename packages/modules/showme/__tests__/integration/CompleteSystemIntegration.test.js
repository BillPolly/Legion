/**
 * Complete System Integration Tests
 * 
 * Tests complete end-to-end workflow: Tool → Server → Client → UI
 * NO MOCKS - Verifies all components work together with real dependencies
 */

import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import { AssetDisplayManager } from '../../src/client/AssetDisplayManager.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

describe('Complete System Integration - All Components Working Together', () => {
  let tool;
  let server;
  let clientActor;
  let displayManager;
  let assetDetector;
  let resourceManager;
  let dom;
  let document;
  let window;
  const testPort = 3791;

  beforeAll(async () => {
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
    
    // Initialize asset detector
    assetDetector = new AssetTypeDetector();
    
    // Initialize tool with real server
    tool = new ShowAssetTool({
      assetDetector,
      serverPort: testPort
    });
    
    // Initialize display manager
    displayManager = new AssetDisplayManager({
      serverUrl: `http://localhost:${testPort}`,
      wsUrl: `ws://localhost:${testPort}/showme`,
      container: document.getElementById('app')
    });
    await displayManager.initialize();
    
    // Initialize client actor
    clientActor = new ShowMeClientActor({
      serverUrl: `ws://localhost:${testPort}/showme`,
      displayManager: displayManager
    });
    await clientActor.initialize();
    await clientActor.connect();
    
    // Wait for all connections to be established
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 45000);

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

  describe('complete JSON asset workflow', () => {
    test('should execute complete workflow: Tool → Server → Client → UI Display', async () => {
      const testData = {
        users: [
          { id: 1, name: 'Alice', role: 'admin' },
          { id: 2, name: 'Bob', role: 'user' }
        ],
        metadata: {
          version: '1.0.0',
          timestamp: new Date().toISOString()
        }
      };

      // Step 1: Execute tool (Tool → Server)
      console.log('Step 1: Executing tool...');
      const toolResult = await tool.execute({
        asset: testData,
        title: 'Complete Integration Test'
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.assetId).toBeTruthy();
      expect(toolResult.detected_type).toBe('json');
      console.log('✅ Tool execution successful');

      // Step 2: Verify asset stored on server
      console.log('Step 2: Verifying server storage...');
      const serverResponse = await fetch(`${toolResult.url}`);
      const serverData = await serverResponse.json();
      expect(serverData).toEqual(testData);
      console.log('✅ Server storage verified');

      // Step 3: Client actor requests display (Client → Server)
      console.log('Step 3: Client requesting display...');
      await clientActor.displayAsset(toolResult.assetId, {
        width: 600,
        height: 400,
        x: 100,
        y: 100
      });
      console.log('✅ Display request sent');

      // Wait for UI update
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Verify UI elements created (Client → UI)
      console.log('Step 4: Verifying UI creation...');
      const windowElements = document.querySelectorAll('.showme-window');
      expect(windowElements.length).toBeGreaterThan(0);
      
      const targetWindow = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(targetWindow).toBeTruthy();
      
      if (targetWindow) {
        // Verify window properties
        expect(targetWindow.style.width).toContain('600');
        expect(targetWindow.style.height).toContain('400');
        expect(targetWindow.classList.contains('showme-window-json')).toBe(true);
        
        // Verify window header
        const header = targetWindow.querySelector('.showme-window-header');
        expect(header).toBeTruthy();
        const title = header?.querySelector('.showme-window-title');
        expect(title?.textContent).toContain('Complete Integration Test');
        
        // Verify content area
        const content = targetWindow.querySelector('.showme-window-content');
        expect(content).toBeTruthy();
        const jsonViewer = content?.querySelector('.json-viewer');
        expect(jsonViewer).toBeTruthy();
      }
      console.log('✅ UI verification complete');
      
      console.log('🎉 Complete workflow successfully validated!');
    });
  });

  describe('complete image asset workflow', () => {
    test('should handle complete image workflow from tool to UI', async () => {
      // Create test image (1x1 blue pixel PNG)
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
        0x54, 0x08, 0x99, 0x63, 0xFC, 0x0F, 0x00, 0x00,
        0x00, 0x01, 0x00, 0x01, 0x5C, 0xCD, 0x90, 0x0A,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
        0xAE, 0x42, 0x60, 0x82
      ]);
      
      const base64Image = `data:image/png;base64,${pngData.toString('base64')}`;

      // Execute complete workflow
      const toolResult = await tool.execute({
        asset: base64Image,
        title: 'Test PNG Image',
        options: { 
          width: 300, 
          height: 200,
          maintainAspectRatio: true 
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('image');

      // Request display
      await clientActor.displayAsset(toolResult.assetId, {
        width: 300,
        height: 200
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify UI
      const imageWindow = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(imageWindow).toBeTruthy();
      expect(imageWindow.classList.contains('showme-window-image')).toBe(true);

      const imageElement = imageWindow?.querySelector('img');
      expect(imageElement).toBeTruthy();
      if (imageElement) {
        expect(imageElement.src).toBe(base64Image);
      }
    });
  });

  describe('complete code asset workflow', () => {
    test('should handle complete code workflow with syntax highlighting', async () => {
      const codeContent = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Calculate 10th Fibonacci number
const result = fibonacci(10);
console.log(\`Fibonacci(10) = \${result}\`);`;

      // Execute workflow
      const toolResult = await tool.execute({
        asset: codeContent,
        hint: 'code',
        title: 'Fibonacci Function',
        options: { 
          language: 'javascript',
          lineNumbers: true 
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('code');

      // Display code
      await clientActor.displayAsset(toolResult.assetId, {
        language: 'javascript',
        lineNumbers: true,
        width: 800,
        height: 400
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify UI
      const codeWindow = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(codeWindow).toBeTruthy();
      expect(codeWindow.classList.contains('showme-window-code')).toBe(true);

      const codeViewer = codeWindow?.querySelector('.code-viewer, pre');
      expect(codeViewer).toBeTruthy();
    });
  });

  describe('complete data table workflow', () => {
    test('should handle complete tabular data workflow', async () => {
      const tableData = [
        { id: 1, product: 'Laptop', price: 999.99, inStock: true },
        { id: 2, product: 'Mouse', price: 29.99, inStock: true },
        { id: 3, product: 'Monitor', price: 299.99, inStock: false },
        { id: 4, product: 'Keyboard', price: 79.99, inStock: true }
      ];

      // Execute workflow
      const toolResult = await tool.execute({
        asset: tableData,
        hint: 'data',
        title: 'Product Inventory',
        options: {
          sortable: true,
          filterable: true
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('data');

      // Display table
      await clientActor.displayAsset(toolResult.assetId, {
        sortable: true,
        width: 700,
        height: 300
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify UI
      const tableWindow = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(tableWindow).toBeTruthy();
      expect(tableWindow.classList.contains('showme-window-data')).toBe(true);

      const table = tableWindow?.querySelector('table');
      expect(table).toBeTruthy();
      
      if (table) {
        const rows = table.querySelectorAll('tbody tr');
        expect(rows.length).toBe(4);
        
        const headers = table.querySelectorAll('thead th');
        expect(headers.length).toBe(4); // id, product, price, inStock
      }
    });
  });

  describe('complete web content workflow', () => {
    test('should handle complete web content workflow', async () => {
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .highlight { background-color: yellow; }
  </style>
</head>
<body>
  <h1>Integration Test Page</h1>
  <p class="highlight">This content is rendered in the web viewer.</p>
  <button onclick="alert('Button clicked!')">Test Button</button>
</body>
</html>`;

      // Execute workflow
      const toolResult = await tool.execute({
        asset: htmlContent,
        hint: 'web',
        title: 'HTML Test Page',
        options: {
          sandbox: true,
          allowScripts: false
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('web');

      // Display web content
      await clientActor.displayAsset(toolResult.assetId, {
        sandbox: true,
        width: 600,
        height: 500
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify UI
      const webWindow = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(webWindow).toBeTruthy();
      expect(webWindow.classList.contains('showme-window-web')).toBe(true);

      const iframe = webWindow?.querySelector('iframe');
      expect(iframe).toBeTruthy();
    });
  });

  describe('concurrent asset display', () => {
    test('should handle multiple assets displayed simultaneously', async () => {
      const assets = [
        { data: { concurrent: 1 }, type: 'json', title: 'Asset 1' },
        { data: 'console.log("concurrent test");', type: 'code', title: 'Asset 2' },
        { data: [{ id: 1 }, { id: 2 }], type: 'data', title: 'Asset 3' }
      ];

      const toolResults = [];
      
      // Execute all tools
      for (const asset of assets) {
        const result = await tool.execute({
          asset: asset.data,
          hint: asset.type,
          title: asset.title
        });
        expect(result.success).toBe(true);
        toolResults.push(result);
      }

      // Display all assets
      for (const result of toolResults) {
        await clientActor.displayAsset(result.assetId, {
          width: 400,
          height: 300,
          x: Math.random() * 200,
          y: Math.random() * 200
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify all windows created
      const windows = document.querySelectorAll('.showme-window');
      expect(windows.length).toBeGreaterThanOrEqual(3);

      // Verify each asset ID has a window
      for (const result of toolResults) {
        const window = document.querySelector(`[data-asset-id="${result.assetId}"]`);
        expect(window).toBeTruthy();
      }
    });
  });

  describe('error scenarios', () => {
    test('should handle server disconnection gracefully', async () => {
      // Stop server temporarily
      await server.stop();
      
      // Try to execute tool
      const result = await tool.execute({
        asset: { error: 'test' },
        title: 'Error Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to connect');

      // Restart server
      await server.start();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Reconnect client actor
      await clientActor.connect();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should work again
      const result2 = await tool.execute({
        asset: { recovery: 'test' },
        title: 'Recovery Test'
      });

      expect(result2.success).toBe(true);
    });

    test('should handle invalid asset data gracefully', async () => {
      // Try with circular reference (should fail gracefully)
      const circularObj = { name: 'circular' };
      circularObj.self = circularObj;

      const result = await tool.execute({
        asset: circularObj,
        title: 'Circular Test'
      });

      // Should either succeed with stringified version or fail gracefully
      if (!result.success) {
        expect(result.error).toBeTruthy();
      } else {
        expect(result.assetId).toBeTruthy();
      }
    });
  });

  describe('real-time updates', () => {
    test('should handle asset updates across the system', async () => {
      // Create initial asset
      const result = await tool.execute({
        asset: { version: 1, data: 'initial' },
        title: 'Update Test'
      });

      expect(result.success).toBe(true);

      // Display asset
      await clientActor.displayAsset(result.assetId);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify initial display
      const window = document.querySelector(`[data-asset-id="${result.assetId}"]`);
      expect(window).toBeTruthy();

      // Update asset on server
      const updateResponse = await fetch(`http://localhost:${testPort}/api/update-asset/${result.assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: { version: 2, data: 'updated' }
        })
      });

      expect(updateResponse.ok).toBe(true);

      // Wait for update propagation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify the window still exists (content might be updated)
      const updatedWindow = document.querySelector(`[data-asset-id="${result.assetId}"]`);
      expect(updatedWindow).toBeTruthy();
    });
  });

  describe('performance and stability', () => {
    test('should maintain stability under load', async () => {
      const startTime = Date.now();
      const promises = [];

      // Create multiple concurrent workflows
      for (let i = 0; i < 10; i++) {
        promises.push(
          tool.execute({
            asset: { loadTest: i, timestamp: Date.now() },
            title: `Load Test ${i}`
          }).then(async (result) => {
            if (result.success) {
              await clientActor.displayAsset(result.assetId, {
                width: 200,
                height: 150,
                x: (i % 5) * 210,
                y: Math.floor(i / 5) * 160
              });
            }
            return result;
          })
        );
      }

      // Wait for all to complete
      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Verify all succeeded
      const successful = results.filter(r => r.success).length;
      expect(successful).toBeGreaterThanOrEqual(8); // Allow some failures under load

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds

      // Wait for UI updates
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify windows created
      const windows = document.querySelectorAll('.showme-window');
      expect(windows.length).toBeGreaterThanOrEqual(8);
    });
  });
});