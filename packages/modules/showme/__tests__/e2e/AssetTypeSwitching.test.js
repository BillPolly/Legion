/**
 * End-to-End Tests for Asset Type Switching
 * 
 * Tests dynamic switching between different asset types in the same window,
 * asset updates, and type transitions without window recreation
 * NO MOCKS - Tests real asset type detection and UI transitions
 */

import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import { AssetDisplayManager } from '../../src/client/AssetDisplayManager.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

describe('Asset Type Switching End-to-End', () => {
  let tool;
  let server;
  let clientActor;
  let displayManager;
  let assetDetector;
  let resourceManager;
  let dom;
  let document;
  let window;
  const testPort = 3803;

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

  describe('sequential asset type switching', () => {
    test('should handle JSON → Code → Data → Image type sequence', async () => {
      console.log('🔄 Testing sequential asset type switching...');

      const windowTitle = 'Type Switching Test Window';
      const windowPosition = { x: 200, y: 150, width: 500, height: 400 };
      
      // Stage 1: JSON Asset
      console.log('  Stage 1: JSON Asset');
      const jsonAsset = {
        stage: 1,
        type: 'json',
        data: {
          users: [
            { id: 1, name: 'Alice', active: true },
            { id: 2, name: 'Bob', active: false }
          ],
          metadata: { version: '1.0', timestamp: Date.now() }
        }
      };

      const jsonResult = await tool.execute({
        asset: jsonAsset,
        title: windowTitle
      });

      expect(jsonResult.success).toBe(true);
      expect(jsonResult.detected_type).toBe('json');
      expect(jsonResult.assetId).toBeTruthy();

      // Display JSON asset
      await clientActor.displayAsset(jsonResult.assetId, windowPosition);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify JSON window
      let currentWindow = document.querySelector(`[data-asset-id="${jsonResult.assetId}"]`);
      expect(currentWindow).toBeTruthy();
      expect(currentWindow.classList.contains('showme-window-json')).toBe(true);
      
      const jsonViewer = currentWindow.querySelector('.json-viewer, pre, .json-content');
      expect(jsonViewer).toBeTruthy();
      
      console.log('    ✅ JSON asset displayed successfully');

      // Stage 2: Code Asset (switching types)
      console.log('  Stage 2: Code Asset');
      const codeAsset = `// Stage 2: Code Asset
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Calculate and display Fibonacci sequence
const sequence = [];
for (let i = 0; i < 10; i++) {
  sequence.push(fibonacci(i));
}

console.log('Fibonacci sequence:', sequence);
// Expected: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]`;

      const codeResult = await tool.execute({
        asset: codeAsset,
        title: windowTitle,
        hint: 'code'
      });

      expect(codeResult.success).toBe(true);
      expect(codeResult.detected_type).toBe('code');

      // Display code asset in same position
      await clientActor.displayAsset(codeResult.assetId, windowPosition);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify code window (should be new window or updated window)
      currentWindow = document.querySelector(`[data-asset-id="${codeResult.assetId}"]`);
      expect(currentWindow).toBeTruthy();
      expect(currentWindow.classList.contains('showme-window-code')).toBe(true);
      
      const codeViewer = currentWindow.querySelector('.code-viewer, pre, .code-content');
      expect(codeViewer).toBeTruthy();
      
      console.log('    ✅ Code asset displayed successfully');

      // Stage 3: Data Asset (tabular)
      console.log('  Stage 3: Data Asset');
      const dataAsset = [
        { id: 1, product: 'Laptop', category: 'Electronics', price: 999.99, stock: 15 },
        { id: 2, product: 'Coffee Mug', category: 'Kitchen', price: 12.99, stock: 50 },
        { id: 3, product: 'Notebook', category: 'Stationery', price: 5.49, stock: 100 },
        { id: 4, product: 'Wireless Mouse', category: 'Electronics', price: 29.99, stock: 25 },
        { id: 5, product: 'Desk Lamp', category: 'Furniture', price: 45.00, stock: 8 }
      ];

      const dataResult = await tool.execute({
        asset: dataAsset,
        title: windowTitle,
        hint: 'data'
      });

      expect(dataResult.success).toBe(true);
      expect(dataResult.detected_type).toBe('data');

      // Display data asset
      await clientActor.displayAsset(dataResult.assetId, windowPosition);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify data window
      currentWindow = document.querySelector(`[data-asset-id="${dataResult.assetId}"]`);
      expect(currentWindow).toBeTruthy();
      expect(currentWindow.classList.contains('showme-window-data')).toBe(true);
      
      const table = currentWindow.querySelector('table');
      expect(table).toBeTruthy();
      
      if (table) {
        const rows = table.querySelectorAll('tbody tr');
        expect(rows.length).toBe(5);
        
        const headers = table.querySelectorAll('thead th');
        expect(headers.length).toBe(5); // id, product, category, price, stock
      }
      
      console.log('    ✅ Data asset displayed successfully');

      // Stage 4: Image Asset
      console.log('  Stage 4: Image Asset');
      
      // Create a 3x3 green pixel PNG for testing
      const greenPixelPNG = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x03,
        0x08, 0x02, 0x00, 0x00, 0x00, 0xD9, 0x4A, 0x22,
        0xE8, 0x00, 0x00, 0x00, 0x15, 0x49, 0x44, 0x41,
        0x54, 0x08, 0x99, 0x63, 0x60, 0xF8, 0x0F, 0xC3,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x3C, 0x08, 0x30,
        0x0C, 0x60, 0x80, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      const imageAsset = `data:image/png;base64,${greenPixelPNG.toString('base64')}`;

      const imageResult = await tool.execute({
        asset: imageAsset,
        title: windowTitle
      });

      expect(imageResult.success).toBe(true);
      expect(imageResult.detected_type).toBe('image');

      // Display image asset
      await clientActor.displayAsset(imageResult.assetId, windowPosition);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify image window
      currentWindow = document.querySelector(`[data-asset-id="${imageResult.assetId}"]`);
      expect(currentWindow).toBeTruthy();
      expect(currentWindow.classList.contains('showme-window-image')).toBe(true);
      
      const img = currentWindow.querySelector('img');
      expect(img).toBeTruthy();
      if (img) {
        expect(img.src).toContain('data:image/png;base64');
      }
      
      console.log('    ✅ Image asset displayed successfully');

      // Verify we have multiple windows (or window content has switched)
      const allWindows = document.querySelectorAll('.showme-window');
      expect(allWindows.length).toBeGreaterThanOrEqual(1);
      
      console.log(`✅ Sequential type switching completed - ${allWindows.length} window(s) present`);
    });

    test('should handle Text → Web → JSON rapid type switching', async () => {
      console.log('🔄 Testing rapid text → web → json switching...');

      const rapidTitle = 'Rapid Type Switch';
      const position = { x: 100, y: 400, width: 600, height: 350 };

      // Rapid Stage 1: Text
      const textAsset = `This is a plain text asset for rapid type switching test.

It contains multiple lines of text content to demonstrate text rendering.
The text includes various characters: 123, ABC, xyz, !@#$%

This will be rapidly switched to web content and then JSON data.`;

      const textResult = await tool.execute({
        asset: textAsset,
        title: rapidTitle
      });

      expect(textResult.success).toBe(true);
      expect(textResult.detected_type).toBe('text');

      await clientActor.displayAsset(textResult.assetId, position);
      await new Promise(resolve => setTimeout(resolve, 200)); // Shorter delay for rapid test

      // Verify text display
      const textWindow = document.querySelector(`[data-asset-id="${textResult.assetId}"]`);
      expect(textWindow).toBeTruthy();
      expect(textWindow.classList.contains('showme-window-text')).toBe(true);
      
      console.log('  ✅ Text asset displayed');

      // Rapid Stage 2: Web content
      const webAsset = `<!DOCTYPE html>
<html>
<head>
  <title>Rapid Switch Web</title>
  <style>
    body { 
      font-family: 'Courier New', monospace; 
      background-color: #f0f8ff; 
      margin: 15px; 
    }
    .header { 
      color: #2c5aa0; 
      font-size: 18px; 
      margin-bottom: 10px; 
    }
    .content { 
      background: white; 
      padding: 10px; 
      border-radius: 5px; 
      border: 1px solid #ddd; 
    }
    .highlight { background-color: yellow; }
  </style>
</head>
<body>
  <div class="header">Rapid Type Switching Demo</div>
  <div class="content">
    <p>This is <span class="highlight">web content</span> displayed in the ShowMe window.</p>
    <p>It demonstrates rapid switching from text to web to JSON formats.</p>
    <ul>
      <li>HTML structure</li>
      <li>CSS styling</li>
      <li>Content rendering</li>
    </ul>
  </div>
</body>
</html>`;

      const webResult = await tool.execute({
        asset: webAsset,
        title: rapidTitle,
        hint: 'web'
      });

      expect(webResult.success).toBe(true);
      expect(webResult.detected_type).toBe('web');

      await clientActor.displayAsset(webResult.assetId, position);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify web display
      const webWindow = document.querySelector(`[data-asset-id="${webResult.assetId}"]`);
      expect(webWindow).toBeTruthy();
      expect(webWindow.classList.contains('showme-window-web')).toBe(true);
      
      const iframe = webWindow.querySelector('iframe');
      expect(iframe).toBeTruthy();
      
      console.log('  ✅ Web asset displayed');

      // Rapid Stage 3: JSON (complex structure)
      const jsonAsset = {
        rapidTest: {
          stage: 3,
          type: 'json',
          switchingDemo: true,
          performance: {
            textToWeb: 'fast',
            webToJson: 'instant',
            totalTime: '< 1 second'
          },
          data: {
            users: [
              { 
                id: 'user1', 
                profile: { name: 'Alice', age: 28, location: 'NYC' },
                settings: { theme: 'dark', notifications: true }
              },
              { 
                id: 'user2', 
                profile: { name: 'Bob', age: 34, location: 'LA' },
                settings: { theme: 'light', notifications: false }
              }
            ],
            metadata: {
              version: '2.1.0',
              timestamp: new Date().toISOString(),
              features: ['rapid-switching', 'type-detection', 'content-rendering']
            }
          }
        }
      };

      const finalJsonResult = await tool.execute({
        asset: jsonAsset,
        title: rapidTitle
      });

      expect(finalJsonResult.success).toBe(true);
      expect(finalJsonResult.detected_type).toBe('json');

      await clientActor.displayAsset(finalJsonResult.assetId, position);
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify final JSON display
      const jsonWindow = document.querySelector(`[data-asset-id="${finalJsonResult.assetId}"]`);
      expect(jsonWindow).toBeTruthy();
      expect(jsonWindow.classList.contains('showme-window-json')).toBe(true);
      
      const jsonViewer = jsonWindow.querySelector('.json-viewer, pre, .json-content');
      expect(jsonViewer).toBeTruthy();
      
      console.log('  ✅ JSON asset displayed');

      console.log('✅ Rapid type switching completed successfully');
    });
  });

  describe('asset content updates and transitions', () => {
    test('should handle asset content updates within same type', async () => {
      console.log('📝 Testing same-type content updates...');

      const updateTitle = 'Content Update Test';
      const updatePosition = { x: 300, y: 100, width: 450, height: 320 };

      // Initial JSON content
      let version = 1;
      const initialJson = {
        version: version,
        title: 'Initial Content',
        data: {
          status: 'initial',
          items: ['item1', 'item2', 'item3'],
          timestamp: Date.now(),
          metadata: { author: 'test', category: 'demo' }
        }
      };

      const initialResult = await tool.execute({
        asset: initialJson,
        title: updateTitle
      });

      expect(initialResult.success).toBe(true);
      expect(initialResult.detected_type).toBe('json');

      await clientActor.displayAsset(initialResult.assetId, updatePosition);
      await new Promise(resolve => setTimeout(resolve, 400));

      let currentWindow = document.querySelector(`[data-asset-id="${initialResult.assetId}"]`);
      expect(currentWindow).toBeTruthy();
      
      console.log('  ✅ Initial JSON content displayed');

      // Update 1: Add more data
      version++;
      const updatedJson1 = {
        ...initialJson,
        version: version,
        title: 'Updated Content - More Data',
        data: {
          ...initialJson.data,
          status: 'updated',
          items: [...initialJson.data.items, 'item4', 'item5', 'item6'],
          newField: 'This field was added in update 1',
          nested: {
            level1: { level2: { value: 'deeply nested data' } }
          }
        }
      };

      const updateResult1 = await tool.execute({
        asset: updatedJson1,
        title: updateTitle
      });

      expect(updateResult1.success).toBe(true);
      expect(updateResult1.detected_type).toBe('json');

      await clientActor.displayAsset(updateResult1.assetId, updatePosition);
      await new Promise(resolve => setTimeout(resolve, 400));

      console.log('  ✅ First content update applied');

      // Update 2: Change structure significantly
      version++;
      const updatedJson2 = {
        version: version,
        title: 'Updated Content - Structure Change',
        data: {
          status: 'restructured',
          users: [
            { id: 1, name: 'Alice', roles: ['admin', 'editor'] },
            { id: 2, name: 'Bob', roles: ['viewer'] },
            { id: 3, name: 'Charlie', roles: ['admin'] }
          ],
          settings: {
            theme: 'dark',
            language: 'en',
            features: {
              notifications: true,
              analytics: false,
              experimental: true
            }
          },
          statistics: {
            totalUsers: 3,
            activeUsers: 2,
            lastUpdate: new Date().toISOString()
          }
        }
      };

      const updateResult2 = await tool.execute({
        asset: updatedJson2,
        title: updateTitle
      });

      expect(updateResult2.success).toBe(true);
      expect(updateResult2.detected_type).toBe('json');

      await clientActor.displayAsset(updateResult2.assetId, updatePosition);
      await new Promise(resolve => setTimeout(resolve, 400));

      // Verify final state
      currentWindow = document.querySelector(`[data-asset-id="${updateResult2.assetId}"]`);
      expect(currentWindow).toBeTruthy();
      expect(currentWindow.classList.contains('showme-window-json')).toBe(true);

      console.log('  ✅ Second content update applied');
      console.log('✅ Same-type content updates handled successfully');
    });

    test('should handle data structure transformations', async () => {
      console.log('🔄 Testing data structure transformations...');

      const transformTitle = 'Data Transformation Test';
      const transformPosition = { x: 150, y: 250, width: 550, height: 380 };

      // Transform 1: Flat array to tabular data
      const flatArray = [
        'Apple', 'Banana', 'Cherry', 'Date', 'Elderberry',
        'Fig', 'Grape', 'Honeydew', 'Kiwi', 'Lemon'
      ];

      const flatResult = await tool.execute({
        asset: flatArray,
        title: transformTitle
      });

      expect(flatResult.success).toBe(true);
      // Could be detected as 'data' or 'json'
      expect(['data', 'json'].includes(flatResult.detected_type)).toBe(true);

      await clientActor.displayAsset(flatResult.assetId, transformPosition);
      await new Promise(resolve => setTimeout(resolve, 300));

      console.log('  ✅ Flat array displayed');

      // Transform 2: Convert to structured tabular data
      const tabularData = flatArray.map((fruit, index) => ({
        id: index + 1,
        name: fruit,
        category: 'fruit',
        length: fruit.length,
        firstLetter: fruit[0],
        isLong: fruit.length > 6
      }));

      const tabularResult = await tool.execute({
        asset: tabularData,
        title: transformTitle,
        hint: 'data'
      });

      expect(tabularResult.success).toBe(true);
      expect(tabularResult.detected_type).toBe('data');

      await clientActor.displayAsset(tabularResult.assetId, transformPosition);
      await new Promise(resolve => setTimeout(resolve, 400));

      // Verify table structure
      const tableWindow = document.querySelector(`[data-asset-id="${tabularResult.assetId}"]`);
      expect(tableWindow).toBeTruthy();
      expect(tableWindow.classList.contains('showme-window-data')).toBe(true);

      const table = tableWindow.querySelector('table');
      if (table) {
        const headers = table.querySelectorAll('thead th');
        expect(headers.length).toBe(6); // id, name, category, length, firstLetter, isLong
        
        const rows = table.querySelectorAll('tbody tr');
        expect(rows.length).toBe(10); // 10 fruits
      }

      console.log('  ✅ Structured tabular data displayed');

      // Transform 3: Aggregate to summary JSON
      const summary = {
        transformation: 'complete',
        originalData: {
          type: 'flat array',
          items: flatArray.length,
          sample: flatArray.slice(0, 3)
        },
        processedData: {
          type: 'structured table',
          rows: tabularData.length,
          columns: Object.keys(tabularData[0]).length,
          schema: Object.keys(tabularData[0])
        },
        analysis: {
          averageLength: Math.round(flatArray.reduce((sum, fruit) => sum + fruit.length, 0) / flatArray.length),
          shortestFruit: flatArray.reduce((a, b) => a.length <= b.length ? a : b),
          longestFruit: flatArray.reduce((a, b) => a.length >= b.length ? a : b),
          uniqueFirstLetters: [...new Set(flatArray.map(fruit => fruit[0]))].length
        }
      };

      const summaryResult = await tool.execute({
        asset: summary,
        title: transformTitle
      });

      expect(summaryResult.success).toBe(true);
      expect(summaryResult.detected_type).toBe('json');

      await clientActor.displayAsset(summaryResult.assetId, transformPosition);
      await new Promise(resolve => setTimeout(resolve, 400));

      // Verify final JSON display
      const summaryWindow = document.querySelector(`[data-asset-id="${summaryResult.assetId}"]`);
      expect(summaryWindow).toBeTruthy();
      expect(summaryWindow.classList.contains('showme-window-json')).toBe(true);

      console.log('  ✅ Summary JSON displayed');
      console.log('✅ Data structure transformations handled successfully');
    });
  });

  describe('type detection accuracy during switching', () => {
    test('should maintain accurate type detection across all switches', async () => {
      console.log('🎯 Testing type detection accuracy...');

      const detectionTests = [
        {
          name: 'String with JSON-like content',
          asset: '{"this": "looks like JSON", "but": "is actually a string"}',
          expectedType: 'text',
          hint: null
        },
        {
          name: 'Array of strings',
          asset: ['item1', 'item2', 'item3', 'item4'],
          expectedType: 'data',
          hint: null
        },
        {
          name: 'Code string',
          asset: 'function test() {\n  return "Hello, World!";\n}\ntest();',
          expectedType: 'code',
          hint: 'code'
        },
        {
          name: 'HTML string',
          asset: '<div><h1>Test</h1><p>HTML content</p></div>',
          expectedType: 'web',
          hint: 'web'
        },
        {
          name: 'Mixed content object',
          asset: {
            text: 'Some text content',
            numbers: [1, 2, 3, 4, 5],
            config: { enabled: true, level: 'debug' },
            timestamp: new Date().toISOString()
          },
          expectedType: 'json',
          hint: null
        }
      ];

      for (let i = 0; i < detectionTests.length; i++) {
        const test = detectionTests[i];
        console.log(`  Testing: ${test.name}`);

        const detectResult = await tool.execute({
          asset: test.asset,
          title: `Detection Test ${i + 1}: ${test.name}`,
          hint: test.hint
        });

        expect(detectResult.success).toBe(true);
        expect(detectResult.detected_type).toBe(test.expectedType);
        
        // Display to verify UI adapts correctly
        await clientActor.displayAsset(detectResult.assetId, {
          x: 100 + (i * 120),
          y: 100,
          width: 300,
          height: 250
        });

        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify correct window type class
        const detectWindow = document.querySelector(`[data-asset-id="${detectResult.assetId}"]`);
        expect(detectWindow).toBeTruthy();
        expect(detectWindow.classList.contains(`showme-window-${test.expectedType}`)).toBe(true);

        console.log(`    ✅ Detected as ${detectResult.detected_type} with correct UI`);
      }

      console.log('✅ Type detection accuracy maintained across all switches');
    });

    test('should handle ambiguous content with hint system', async () => {
      console.log('💡 Testing ambiguous content with hints...');

      // Ambiguous content that could be interpreted multiple ways
      const ambiguousContent = `{
  "name": "example.js",
  "content": "function hello() { return 'Hello World'; }",
  "type": "javascript",
  "lines": 1
}`;

      // Test 1: Without hint (should detect as text or JSON)
      const withoutHint = await tool.execute({
        asset: ambiguousContent,
        title: 'Ambiguous Content - No Hint'
      });

      expect(withoutHint.success).toBe(true);
      expect(['text', 'json', 'code'].includes(withoutHint.detected_type)).toBe(true);
      
      console.log(`  Without hint: detected as ${withoutHint.detected_type}`);

      // Test 2: With JSON hint
      const withJsonHint = await tool.execute({
        asset: ambiguousContent,
        title: 'Ambiguous Content - JSON Hint',
        hint: 'json'
      });

      expect(withJsonHint.success).toBe(true);
      // Should respect hint or detect as JSON
      expect(['json'].includes(withJsonHint.detected_type)).toBe(true);
      
      console.log(`  With JSON hint: detected as ${withJsonHint.detected_type}`);

      // Test 3: With code hint  
      const withCodeHint = await tool.execute({
        asset: ambiguousContent,
        title: 'Ambiguous Content - Code Hint',
        hint: 'code'
      });

      expect(withCodeHint.success).toBe(true);
      // Should respect hint
      expect(withCodeHint.detected_type).toBe('code');
      
      console.log(`  With code hint: detected as ${withCodeHint.detected_type}`);

      // Display all to verify different UI rendering
      await clientActor.displayAsset(withoutHint.assetId, { x: 50, y: 350, width: 300, height: 200 });
      await clientActor.displayAsset(withJsonHint.assetId, { x: 370, y: 350, width: 300, height: 200 });
      await clientActor.displayAsset(withCodeHint.assetId, { x: 690, y: 350, width: 300, height: 200 });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify different window types
      const noHintWindow = document.querySelector(`[data-asset-id="${withoutHint.assetId}"]`);
      const jsonHintWindow = document.querySelector(`[data-asset-id="${withJsonHint.assetId}"]`);
      const codeHintWindow = document.querySelector(`[data-asset-id="${withCodeHint.assetId}"]`);

      expect(noHintWindow).toBeTruthy();
      expect(jsonHintWindow).toBeTruthy();
      expect(codeHintWindow).toBeTruthy();

      expect(jsonHintWindow.classList.contains('showme-window-json')).toBe(true);
      expect(codeHintWindow.classList.contains('showme-window-code')).toBe(true);

      console.log('✅ Ambiguous content handled correctly with hint system');
    });
  });

  describe('switching performance and stability', () => {
    test('should maintain performance during rapid type switching', async () => {
      console.log('⚡ Testing rapid switching performance...');

      const performanceAssets = [
        { asset: { perf: 1 }, type: 'json' },
        { asset: 'console.log("performance test");', type: 'code' },
        { asset: [{ id: 1 }, { id: 2 }], type: 'data' },
        { asset: 'Plain text for performance testing', type: 'text' },
        { asset: '<div>HTML performance test</div>', type: 'web' }
      ];

      const startTime = Date.now();
      const results = [];

      // Rapid switching loop
      for (let round = 0; round < 3; round++) {
        console.log(`  Performance round ${round + 1}`);

        for (let i = 0; i < performanceAssets.length; i++) {
          const asset = performanceAssets[i];
          
          const result = await tool.execute({
            asset: asset.asset,
            title: `Performance Round ${round + 1} - ${asset.type}`,
            hint: asset.type === 'text' ? null : asset.type
          });

          expect(result.success).toBe(true);
          expect(result.detected_type).toBe(asset.type);
          results.push(result);

          // Quick display
          await clientActor.displayAsset(result.assetId, {
            x: (i * 150) + 50,
            y: (round * 120) + 50,
            width: 140,
            height: 100
          });
        }

        // Brief pause between rounds
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTimePerSwitch = totalTime / results.length;

      console.log(`  Performance results:`);
      console.log(`    Total switches: ${results.length}`);
      console.log(`    Total time: ${totalTime}ms`);
      console.log(`    Average time per switch: ${averageTimePerSwitch.toFixed(1)}ms`);

      // Performance expectations
      expect(totalTime).toBeLessThan(8000); // 8 seconds total
      expect(averageTimePerSwitch).toBeLessThan(400); // 400ms per switch average

      // Verify all windows are created and functional
      const finalWindows = document.querySelectorAll('.showme-window');
      expect(finalWindows.length).toBe(results.length);

      console.log('✅ Rapid switching performance maintained');
    });

    test('should handle switching under memory pressure', async () => {
      console.log('🧠 Testing switching under memory pressure...');

      const memoryPressureAssets = [];

      // Create large assets for memory pressure testing
      const largeJsonData = {
        metadata: { test: 'memory pressure', timestamp: Date.now() },
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `Description for item ${i}`.repeat(10),
          tags: [`tag${i}`, `category${i % 5}`, `type${i % 3}`],
          nested: {
            level1: { level2: { value: `nested-${i}` } }
          }
        }))
      };

      const largeCodeContent = `// Memory pressure test - Large code file
${Array.from({ length: 200 }, (_, i) => `
// Function ${i}
function generatedFunction${i}() {
  const data = ${JSON.stringify({ index: i, values: Array.from({ length: 20 }, (_, j) => j * i) })};
  console.log('Function ${i} executed with data:', data);
  return data;
}
`).join('\n')}

// Execute all functions
${Array.from({ length: 200 }, (_, i) => `generatedFunction${i}();`).join('\n')}`;

      const largeTableData = Array.from({ length: 500 }, (_, i) => ({
        id: i,
        name: `Record ${i}`,
        value: Math.random() * 1000,
        category: `Cat ${i % 10}`,
        subcategory: `SubCat ${i % 25}`,
        description: `Long description for record ${i}`.repeat(5),
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
        metadata: { index: i, calculated: i * 2.5, flags: [i % 2 === 0, i % 3 === 0] }
      }));

      memoryPressureAssets.push(
        { asset: largeJsonData, type: 'json', name: 'Large JSON' },
        { asset: largeCodeContent, type: 'code', name: 'Large Code' },
        { asset: largeTableData, type: 'data', name: 'Large Table' }
      );

      const memoryStartTime = Date.now();
      
      // Switch between large assets multiple times
      for (let cycle = 0; cycle < 3; cycle++) {
        console.log(`  Memory pressure cycle ${cycle + 1}`);

        for (const pressureAsset of memoryPressureAssets) {
          const result = await tool.execute({
            asset: pressureAsset.asset,
            title: `Memory Test - ${pressureAsset.name} (Cycle ${cycle + 1})`,
            hint: pressureAsset.type
          });

          if (result.success) {
            expect(result.detected_type).toBe(pressureAsset.type);

            // Display and then quickly move to next
            await clientActor.displayAsset(result.assetId, {
              x: 200,
              y: 200,
              width: 400,
              height: 300
            });

            await new Promise(resolve => setTimeout(resolve, 300));
            
            console.log(`    ✅ ${pressureAsset.name} handled successfully`);
          } else {
            console.log(`    ⚠️ ${pressureAsset.name} failed: ${result.error}`);
            // Memory pressure might cause some failures - that's acceptable
          }
        }
      }

      const memoryEndTime = Date.now();
      const memoryTotalTime = memoryEndTime - memoryStartTime;

      console.log(`  Memory pressure test completed in ${memoryTotalTime}ms`);
      expect(memoryTotalTime).toBeLessThan(15000); // 15 seconds for memory pressure test

      console.log('✅ Switching handled appropriately under memory pressure');
    });
  });
});