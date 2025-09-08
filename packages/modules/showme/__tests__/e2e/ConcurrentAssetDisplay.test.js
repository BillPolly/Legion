/**
 * End-to-End Tests for Concurrent Asset Display
 * 
 * Tests system behavior when multiple assets of different types are displayed simultaneously
 * Verifies no interference, memory leaks, or conflicts between concurrent displays
 * NO MOCKS - Tests real concurrent workflows with all asset types
 */

import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import { AssetDisplayManager } from '../../src/client/AssetDisplayManager.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

describe('Concurrent Asset Display End-to-End', () => {
  let tool;
  let server;
  let clientActor;
  let displayManager;
  let assetDetector;
  let resourceManager;
  let dom;
  let document;
  let window;
  const testPort = 3801;

  beforeAll(async () => {
    // Set up virtual DOM
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    document = dom.window.document;
    window = dom.window;
    
    global.document = document;
    global.window = window;
    global.HTMLElement = window.HTMLElement;
    
    // Initialize ResourceManager
    resourceManager = await ResourceManager.getInstance();
    
    // Start server
    server = new ShowMeServer({ 
      port: testPort,
      skipLegionPackages: true 
    });
    await server.initialize();
    await server.start();
    
    // Initialize components
    assetDetector = new AssetTypeDetector();
    tool = new ShowAssetTool({ assetDetector, serverPort: testPort });
    
    displayManager = new AssetDisplayManager({
      serverUrl: `http://localhost:${testPort}`,
      wsUrl: `ws://localhost:${testPort}/showme`,
      container: document.getElementById('app')
    });
    await displayManager.initialize();
    
    clientActor = new ShowMeClientActor({
      serverUrl: `ws://localhost:${testPort}/showme`,
      displayManager: displayManager
    });
    await clientActor.initialize();
    await clientActor.connect();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 45000);

  afterAll(async () => {
    if (clientActor) {
      try {
        await clientActor.disconnect();
        await clientActor.cleanup();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    if (displayManager) {
      try {
        await displayManager.cleanup();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    if (server) {
      await server.stop();
    }
    
    delete global.document;
    delete global.window;
    delete global.HTMLElement;
  });

  describe('mixed asset type concurrent display', () => {
    test('should display all 5 asset types simultaneously without interference', async () => {
      console.log('🎭 Testing concurrent display of all asset types...');
      
      // Prepare assets of different types
      const testAssets = [
        {
          name: 'JSON Configuration',
          asset: {
            server: { host: 'localhost', port: 3000 },
            database: { url: 'mongodb://localhost:27017', name: 'testdb' },
            features: { auth: true, logging: true, metrics: false },
            version: '2.1.0'
          },
          expectedType: 'json',
          options: { expandLevel: 2 }
        },
        {
          name: 'JavaScript Code',
          asset: `// Fibonacci sequence generator
function* fibonacci() {
  let a = 0, b = 1;
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

// Generate first 10 Fibonacci numbers
const fib = fibonacci();
const sequence = Array.from({ length: 10 }, () => fib.next().value);
console.log('Fibonacci:', sequence);

export { fibonacci };`,
          expectedType: 'code',
          options: { language: 'javascript', lineNumbers: true, theme: 'dark' }
        },
        {
          name: 'Sales Data Table',
          asset: [
            { month: 'Jan', sales: 45000, target: 50000, region: 'North' },
            { month: 'Feb', sales: 52000, target: 55000, region: 'North' },
            { month: 'Mar', sales: 48000, target: 50000, region: 'South' },
            { month: 'Apr', sales: 61000, target: 58000, region: 'East' },
            { month: 'May', sales: 58000, target: 60000, region: 'West' }
          ],
          expectedType: 'data',
          options: { sortable: true, filterable: true, showSummary: true }
        },
        {
          name: 'Test Image',
          asset: (() => {
            // Create a 2x2 red pixel PNG
            const pngData = Buffer.from([
              0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
              0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
              0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02,
              0x08, 0x02, 0x00, 0x00, 0x00, 0xFD, 0xD5, 0x9A,
              0x7A, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
              0x54, 0x08, 0x99, 0x63, 0xF8, 0x0F, 0x00, 0x00,
              0x00, 0x01, 0x00, 0x01, 0x5C, 0xCD, 0x90, 0x0A,
              0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
              0xAE, 0x42, 0x60, 0x82
            ]);
            return `data:image/png;base64,${pngData.toString('base64')}`;
          })(),
          expectedType: 'image',
          options: { width: 200, height: 200, maintainAspectRatio: true }
        },
        {
          name: 'HTML Demo Page',
          asset: `<!DOCTYPE html>
<html>
<head>
  <title>Concurrent Display Test</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      background: linear-gradient(45deg, #f0f8ff, #e6f3ff); 
      padding: 20px; 
    }
    .card { 
      background: white; 
      padding: 15px; 
      margin: 10px 0; 
      border-radius: 8px; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
    }
    .highlight { color: #007acc; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <h2 class="highlight">Concurrent Display Test</h2>
    <p>This HTML content is displayed alongside other asset types:</p>
    <ul>
      <li>JSON configuration data</li>
      <li>JavaScript source code</li>
      <li>Tabular sales data</li>
      <li>PNG image file</li>
    </ul>
    <p><strong>All displayed simultaneously!</strong></p>
  </div>
</body>
</html>`,
          expectedType: 'web',
          options: { sandbox: true, allowScripts: false }
        }
      ];

      console.log(`📊 Preparing ${testAssets.length} assets for concurrent display...`);
      
      // Step 1: Execute all tool operations concurrently
      const startTime = Date.now();
      const toolPromises = testAssets.map(async (testAsset, index) => {
        console.log(`  🔧 Processing asset ${index + 1}: ${testAsset.name}`);
        return await tool.execute({
          asset: testAsset.asset,
          title: testAsset.name,
          options: testAsset.options
        });
      });

      const toolResults = await Promise.all(toolPromises);
      const toolExecutionTime = Date.now() - startTime;
      
      console.log(`✅ All ${toolResults.length} tools executed in ${toolExecutionTime}ms`);

      // Validate all tool executions succeeded
      for (let i = 0; i < toolResults.length; i++) {
        const result = toolResults[i];
        const testAsset = testAssets[i];
        
        expect(result.success).toBe(true);
        expect(result.detected_type).toBe(testAsset.expectedType);
        expect(result.assetId).toBeTruthy();
        expect(result.url).toContain(`http://localhost:${testPort}`);
        
        console.log(`  ✅ ${testAsset.name}: ${result.detected_type} (${result.assetId})`);
      }

      // Step 2: Display all assets simultaneously with different positions
      const displayStartTime = Date.now();
      const displayPromises = toolResults.map(async (result, index) => {
        const position = {
          x: (index % 3) * 420, // 3 columns
          y: Math.floor(index / 3) * 320, // Rows as needed
          width: 400,
          height: 300
        };
        
        console.log(`  🖥️  Displaying ${testAssets[index].name} at (${position.x}, ${position.y})`);
        
        return await clientActor.displayAsset(result.assetId, {
          ...position,
          ...testAssets[index].options
        });
      });

      const displayResults = await Promise.all(displayPromises);
      const displayTime = Date.now() - displayStartTime;
      
      console.log(`✅ All ${displayResults.length} assets displayed in ${displayTime}ms`);

      // Wait for UI rendering
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Step 3: Verify all windows are created and positioned correctly
      const allWindows = document.querySelectorAll('.showme-window');
      expect(allWindows.length).toBe(5);
      console.log(`✅ All 5 windows created in DOM`);

      // Verify each specific asset window
      for (let i = 0; i < toolResults.length; i++) {
        const result = toolResults[i];
        const testAsset = testAssets[i];
        
        const window = document.querySelector(`[data-asset-id="${result.assetId}"]`);
        expect(window).toBeTruthy();
        expect(window.classList.contains('showme-window')).toBe(true);
        expect(window.classList.contains(`showme-window-${testAsset.expectedType}`)).toBe(true);
        
        // Verify window positioning
        expect(window.style.width).toContain('400');
        expect(window.style.height).toContain('300');
        
        // Verify window title
        const titleElement = window.querySelector('.showme-window-title');
        expect(titleElement.textContent).toContain(testAsset.name);
        
        console.log(`  ✅ ${testAsset.name}: Window validated`);
      }

      // Step 4: Verify content-specific rendering for each type
      console.log('🔍 Verifying content-specific rendering...');
      
      // JSON window
      const jsonWindow = document.querySelector(`[data-asset-id="${toolResults[0].assetId}"]`);
      const jsonViewer = jsonWindow.querySelector('.json-viewer, pre, .json-content');
      expect(jsonViewer).toBeTruthy();
      
      // Code window
      const codeWindow = document.querySelector(`[data-asset-id="${toolResults[1].assetId}"]`);
      const codeViewer = codeWindow.querySelector('.code-viewer, pre, .code-content');
      expect(codeViewer).toBeTruthy();
      
      // Data table window
      const dataWindow = document.querySelector(`[data-asset-id="${toolResults[2].assetId}"]`);
      const table = dataWindow.querySelector('table');
      expect(table).toBeTruthy();
      if (table) {
        const rows = table.querySelectorAll('tbody tr');
        expect(rows.length).toBe(5); // 5 months of data
      }
      
      // Image window
      const imageWindow = document.querySelector(`[data-asset-id="${toolResults[3].assetId}"]`);
      const img = imageWindow.querySelector('img');
      expect(img).toBeTruthy();
      if (img) {
        expect(img.src).toContain('data:image/png;base64');
      }
      
      // Web content window
      const webWindow = document.querySelector(`[data-asset-id="${toolResults[4].assetId}"]`);
      const iframe = webWindow.querySelector('iframe');
      expect(iframe).toBeTruthy();

      console.log('✅ All content-specific rendering verified');

      // Step 5: Test window interactions don't interfere
      console.log('🔄 Testing window interactions...');
      
      // Test window focus/blur
      for (const result of toolResults) {
        const window = document.querySelector(`[data-asset-id="${result.assetId}"]`);
        if (window) {
          window.click(); // Focus window
          expect(document.querySelector('.showme-window:focus, .showme-window.active')).toBeTruthy();
        }
      }

      // Test window controls
      const firstWindow = document.querySelector(`[data-asset-id="${toolResults[0].assetId}"]`);
      const closeButton = firstWindow.querySelector('.showme-window-close');
      if (closeButton) {
        closeButton.click();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const remainingWindows = document.querySelectorAll('.showme-window');
        expect(remainingWindows.length).toBe(4); // One less window
      }

      console.log('✅ Window interactions work correctly');

      const totalTime = Date.now() - startTime;
      console.log(`🎉 Concurrent asset display completed successfully in ${totalTime}ms`);
      
      // Performance validation
      expect(totalTime).toBeLessThan(8000); // Should complete within 8 seconds
      expect(toolExecutionTime).toBeLessThan(3000); // Tool execution under 3 seconds
      expect(displayTime).toBeLessThan(2000); // Display under 2 seconds
    });
  });

  describe('high volume concurrent display', () => {
    test('should handle 10 assets displayed simultaneously', async () => {
      console.log('📈 Testing high volume concurrent display (10 assets)...');
      
      // Generate 10 different assets
      const assets = [];
      for (let i = 0; i < 10; i++) {
        const assetType = ['json', 'data', 'code', 'text'][i % 4];
        let asset;
        
        switch (assetType) {
          case 'json':
            asset = { 
              id: i, 
              name: `Asset ${i}`, 
              type: 'json',
              data: { value: i * 10, active: i % 2 === 0 },
              timestamp: new Date().toISOString()
            };
            break;
          case 'data':
            asset = [
              { id: i * 100, name: `Item ${i}-1`, value: Math.random() * 1000 },
              { id: i * 100 + 1, name: `Item ${i}-2`, value: Math.random() * 1000 }
            ];
            break;
          case 'code':
            asset = `// Generated code ${i}
function process${i}(input) {
  const multiplier = ${i + 1};
  return input * multiplier;
}

const result${i} = process${i}(42);
console.log('Result ${i}:', result${i});`;
            break;
          case 'text':
            asset = `This is text asset number ${i}.
            
It contains multiple lines of text content to test text rendering capabilities.
Line ${i + 1}: Sample content with different data.
Line ${i + 2}: More content for testing purposes.
Final line: Asset ${i} complete.`;
            break;
        }
        
        assets.push({
          asset,
          title: `Concurrent Asset ${i} (${assetType})`,
          expectedType: assetType === 'text' ? 'text' : assetType
        });
      }

      const startTime = Date.now();

      // Execute all tools concurrently
      console.log('🔧 Executing 10 tools concurrently...');
      const toolResults = await Promise.all(
        assets.map(assetConfig => 
          tool.execute(assetConfig)
        )
      );

      // Verify all succeeded
      const successful = toolResults.filter(r => r.success).length;
      expect(successful).toBe(10);
      console.log(`✅ All 10 tools executed successfully`);

      // Display all simultaneously with grid positioning
      console.log('🖥️  Displaying 10 assets in grid layout...');
      await Promise.all(
        toolResults.map(async (result, index) => {
          const row = Math.floor(index / 5);
          const col = index % 5;
          
          return clientActor.displayAsset(result.assetId, {
            x: col * 250,
            y: row * 200,
            width: 240,
            height: 180
          });
        })
      );

      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify all windows created
      const windows = document.querySelectorAll('.showme-window');
      expect(windows.length).toBe(10);
      
      // Verify window positioning doesn't overlap significantly
      const positions = Array.from(windows).map(w => ({
        x: parseInt(w.style.left) || 0,
        y: parseInt(w.style.top) || 0
      }));
      
      const uniquePositions = new Set(positions.map(p => `${p.x},${p.y}`));
      expect(uniquePositions.size).toBeGreaterThanOrEqual(8); // Most should be unique

      const totalTime = Date.now() - startTime;
      console.log(`🎉 High volume concurrent display completed in ${totalTime}ms`);
      
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('concurrent display performance', () => {
    test('should maintain performance with mixed large and small assets', async () => {
      console.log('⚡ Testing performance with mixed asset sizes...');
      
      const mixedAssets = [
        {
          name: 'Small JSON',
          asset: { small: true },
          expectedType: 'json'
        },
        {
          name: 'Large Data Table',
          asset: Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            name: `Record ${i}`,
            data: `Content ${i}`.repeat(10),
            timestamp: new Date(Date.now() - i * 1000).toISOString()
          })),
          expectedType: 'data'
        },
        {
          name: 'Medium Code File',
          asset: `// Large code file
${'// Comment line\n'.repeat(100)}
function largeFunction() {
${'  console.log("Line");\n'.repeat(200)}
}`,
          expectedType: 'code'
        },
        {
          name: 'Tiny Text',
          asset: 'Small text content.',
          expectedType: 'text'
        }
      ];

      const startTime = Date.now();
      
      // Execute and display all concurrently
      const toolResults = await Promise.all(
        mixedAssets.map(assetConfig => tool.execute(assetConfig))
      );
      
      const midTime = Date.now();
      
      await Promise.all(
        toolResults.map((result, index) =>
          clientActor.displayAsset(result.assetId, {
            x: index * 300,
            y: 100,
            width: 280,
            height: 250
          })
        )
      );
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const endTime = Date.now();
      
      // Verify all displayed
      const windows = document.querySelectorAll('.showme-window');
      expect(windows.length).toBe(4);
      
      // Check that large data table rendered correctly
      const dataWindow = document.querySelector(`[data-asset-id="${toolResults[1].assetId}"]`);
      const table = dataWindow.querySelector('table');
      expect(table).toBeTruthy();
      
      const executionTime = midTime - startTime;
      const displayTime = endTime - midTime;
      const totalTime = endTime - startTime;
      
      console.log(`📊 Performance metrics:`);
      console.log(`  Tool execution: ${executionTime}ms`);
      console.log(`  Display rendering: ${displayTime}ms`);
      console.log(`  Total time: ${totalTime}ms`);
      
      // Performance expectations
      expect(totalTime).toBeLessThan(6000); // 6 seconds total
      expect(executionTime).toBeLessThan(3000); // 3 seconds for tools
      expect(displayTime).toBeLessThan(3000); // 3 seconds for display
    });
  });

  describe('concurrent display memory management', () => {
    test('should properly manage memory with multiple asset lifecycle', async () => {
      console.log('🧠 Testing memory management with asset lifecycle...');
      
      const initialWindowCount = document.querySelectorAll('.showme-window').length;
      
      // Create and destroy assets in cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        console.log(`  Cycle ${cycle + 1}: Creating assets...`);
        
        // Create 3 assets
        const cycleAssets = [
          { asset: { cycle, id: 1 }, title: `Cycle ${cycle} Asset 1` },
          { asset: [`Cycle ${cycle} Data`], title: `Cycle ${cycle} Asset 2` },
          { asset: `console.log("Cycle ${cycle}");`, title: `Cycle ${cycle} Asset 3` }
        ];
        
        const results = await Promise.all(
          cycleAssets.map(config => tool.execute(config))
        );
        
        // Display all
        await Promise.all(
          results.map((result, index) =>
            clientActor.displayAsset(result.assetId, {
              x: index * 200,
              y: cycle * 150,
              width: 180,
              height: 130
            })
          )
        );
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verify windows created
        let currentWindows = document.querySelectorAll('.showme-window');
        expect(currentWindows.length).toBe(initialWindowCount + 3);
        
        console.log(`  Cycle ${cycle + 1}: Cleaning up...`);
        
        // Close all windows from this cycle
        for (const result of results) {
          const window = document.querySelector(`[data-asset-id="${result.assetId}"]`);
          if (window) {
            const closeButton = window.querySelector('.showme-window-close');
            if (closeButton) {
              closeButton.click();
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify windows closed
        currentWindows = document.querySelectorAll('.showme-window');
        expect(currentWindows.length).toBe(initialWindowCount);
      }
      
      console.log('✅ Memory management test completed - no leaks detected');
    });
  });

  describe('concurrent display error scenarios', () => {
    test('should handle partial failures in concurrent display gracefully', async () => {
      console.log('🚨 Testing graceful handling of partial failures...');
      
      const mixedQualityAssets = [
        { asset: { valid: true }, title: 'Valid JSON', shouldSucceed: true },
        { asset: null, title: 'Invalid Null Asset', shouldSucceed: false },
        { asset: [{ good: 'data' }], title: 'Valid Data', shouldSucceed: true },
        { asset: function() { return 'invalid'; }, title: 'Invalid Function', shouldSucceed: false },
        { asset: 'Valid text content', title: 'Valid Text', shouldSucceed: true }
      ];
      
      // Execute all (some will fail)
      const results = await Promise.all(
        mixedQualityAssets.map(config => 
          tool.execute(config).catch(error => ({ success: false, error: error.message }))
        )
      );
      
      // Separate successful from failed
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      console.log(`📊 Results: ${successful.length} successful, ${failed.length} failed`);
      
      expect(successful.length).toBe(3); // JSON, Data, Text should succeed
      expect(failed.length).toBe(2); // Null and Function should fail
      
      // Display only successful assets
      await Promise.all(
        successful.map((result, index) =>
          clientActor.displayAsset(result.assetId, {
            x: index * 250,
            y: 50,
            width: 230,
            height: 180
          })
        )
      );
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify only successful assets are displayed
      const windows = document.querySelectorAll('.showme-window');
      const newWindows = Array.from(windows).filter(w => 
        successful.some(result => w.getAttribute('data-asset-id') === result.assetId)
      );
      
      expect(newWindows.length).toBe(3);
      console.log('✅ Partial failure handling works correctly');
    });
  });
});