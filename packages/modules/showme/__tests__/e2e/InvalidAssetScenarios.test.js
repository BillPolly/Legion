/**
 * End-to-End Error Scenario Tests - Invalid Asset Scenarios
 * 
 * Tests system behavior when assets are invalid, corrupted, or unsupported
 * NO MOCKS - Tests real error handling and fail-fast behavior
 */

import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import { AssetDisplayManager } from '../../src/client/AssetDisplayManager.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import { JSDOM } from 'jsdom';

describe('Invalid Asset Scenarios End-to-End', () => {
  let tool;
  let server;
  let clientActor;
  let displayManager;
  let assetDetector;
  let resourceManager;
  let dom;
  let document;
  let window;
  const testPort = 3798;

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
  }, 30000);

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

  describe('null and undefined assets', () => {
    test('should fail fast with null asset', async () => {
      console.log('🚫 Testing null asset...');
      
      const result = await tool.execute({
        asset: null,
        title: 'Null Asset Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/null|invalid|asset.*required/i);
      expect(result.assetId).toBeUndefined();
      expect(result.url).toBeUndefined();
      
      console.log(`✅ Null asset failed fast: ${result.error}`);
    });

    test('should fail fast with undefined asset', async () => {
      console.log('🚫 Testing undefined asset...');
      
      const result = await tool.execute({
        asset: undefined,
        title: 'Undefined Asset Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/undefined|invalid|asset.*required/i);
      
      console.log(`✅ Undefined asset failed fast: ${result.error}`);
    });

    test('should fail fast with missing asset parameter', async () => {
      console.log('🚫 Testing missing asset parameter...');
      
      const result = await tool.execute({
        title: 'Missing Asset Test'
        // No asset parameter
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/asset.*required|missing.*asset/i);
      
      console.log(`✅ Missing asset parameter failed fast: ${result.error}`);
    });
  });

  describe('corrupted data assets', () => {
    test('should handle corrupted JSON gracefully', async () => {
      console.log('🚫 Testing corrupted JSON...');
      
      const corruptedJson = '{"name": "test", "data":';
      
      const result = await tool.execute({
        asset: corruptedJson,
        hint: 'json',
        title: 'Corrupted JSON Test'
      });

      // Should either succeed as text or fail with clear error
      if (result.success) {
        expect(result.detected_type).toBe('text');
        console.log('✅ Corrupted JSON handled as text');
      } else {
        expect(result.error).toBeTruthy();
        expect(result.error).toMatch(/json|parse|invalid|malformed/i);
        console.log(`✅ Corrupted JSON failed with clear error: ${result.error}`);
      }
    });

    test('should handle malformed data arrays', async () => {
      console.log('🚫 Testing malformed data arrays...');
      
      const malformedData = [
        { id: 1, name: 'Valid' },
        'not an object',
        { id: 'wrong type', name: null },
        undefined,
        null,
        { id: 3 } // Missing name field
      ];
      
      const result = await tool.execute({
        asset: malformedData,
        hint: 'data',
        title: 'Malformed Data Array Test'
      });

      // Should either succeed with best-effort display or fail gracefully
      if (result.success) {
        expect(result.detected_type).toBe('data');
        
        // Try to display it
        const displayResult = await clientActor.displayAsset(result.assetId);
        expect(displayResult).toBeTruthy();
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const window = document.querySelector(`[data-asset-id="${result.assetId}"]`);
        expect(window).toBeTruthy();
        
        console.log('✅ Malformed data array displayed with best effort');
      } else {
        expect(result.error).toBeTruthy();
        console.log(`✅ Malformed data array failed gracefully: ${result.error}`);
      }
    });

    test('should handle inconsistent data structures', async () => {
      console.log('🚫 Testing inconsistent data structures...');
      
      const inconsistentData = [
        { a: 1, b: 2 },
        { x: 'different', y: 'schema', z: 'entirely' },
        { nested: { deep: { value: true } } },
        { array: [1, 2, 3], boolean: false, number: 42.5 }
      ];
      
      const result = await tool.execute({
        asset: inconsistentData,
        hint: 'data',
        title: 'Inconsistent Data Structure Test'
      });

      // Should handle inconsistent structures gracefully
      if (result.success) {
        expect(result.detected_type).toBe('data');
        
        await clientActor.displayAsset(result.assetId);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const window = document.querySelector(`[data-asset-id="${result.assetId}"]`);
        expect(window).toBeTruthy();
        
        console.log('✅ Inconsistent data structure handled gracefully');
      } else {
        expect(result.error).toBeTruthy();
        console.log(`✅ Inconsistent data structure failed with reason: ${result.error}`);
      }
    });
  });

  describe('corrupted image assets', () => {
    test('should fail fast with invalid base64 image data', async () => {
      console.log('🚫 Testing invalid base64 image...');
      
      const invalidBase64 = 'data:image/png;base64,invalid_base64_data_here!!!';
      
      const result = await tool.execute({
        asset: invalidBase64,
        hint: 'image',
        title: 'Invalid Base64 Image Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/invalid.*image|base64|decode|format/i);
      
      console.log(`✅ Invalid base64 image failed fast: ${result.error}`);
    });

    test('should fail fast with corrupted image headers', async () => {
      console.log('🚫 Testing corrupted image headers...');
      
      const corruptedImageData = Buffer.from([
        0xFF, 0xFF, 0xFF, 0xFF, // Wrong PNG signature
        0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 
        0x49, 0x48, 0x44, 0x52
      ]);
      
      const corruptedBase64 = `data:image/png;base64,${corruptedImageData.toString('base64')}`;
      
      const result = await tool.execute({
        asset: corruptedBase64,
        hint: 'image',
        title: 'Corrupted Image Headers Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/invalid.*image|corrupted|format|signature/i);
      
      console.log(`✅ Corrupted image headers failed fast: ${result.error}`);
    });

    test('should fail fast with unsupported image format', async () => {
      console.log('🚫 Testing unsupported image format...');
      
      const unsupportedFormat = 'data:image/tiff;base64,TU0AKgAAAAgAAAAA';
      
      const result = await tool.execute({
        asset: unsupportedFormat,
        hint: 'image',
        title: 'Unsupported Image Format Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/unsupported.*format|invalid.*image|tiff.*not.*supported/i);
      
      console.log(`✅ Unsupported image format failed fast: ${result.error}`);
    });
  });

  describe('invalid code assets', () => {
    test('should handle code with invalid encoding', async () => {
      console.log('🚫 Testing code with invalid encoding...');
      
      // Create string with invalid UTF-8 sequences
      const invalidCode = String.fromCharCode(0xD800, 0xDC00) + 'console.log("test");' + String.fromCharCode(0xDFFF);
      
      const result = await tool.execute({
        asset: invalidCode,
        hint: 'code',
        title: 'Invalid Encoding Code Test'
      });

      // Should either succeed with best effort or fail gracefully
      if (result.success) {
        console.log('✅ Invalid encoding handled with best effort');
      } else {
        expect(result.error).toBeTruthy();
        expect(result.error).toMatch(/encoding|invalid.*characters|utf/i);
        console.log(`✅ Invalid encoding failed gracefully: ${result.error}`);
      }
    });

    test('should handle extremely large code files', async () => {
      console.log('🚫 Testing extremely large code file...');
      
      // Generate very large code content (10MB+)
      const largeCode = 'console.log("Large file test");\n'.repeat(500000); // ~13MB
      
      const startTime = Date.now();
      const result = await tool.execute({
        asset: largeCode,
        hint: 'code',
        title: 'Extremely Large Code File Test'
      });
      const endTime = Date.now();

      // Should either succeed or fail with size limit error
      if (result.success) {
        expect(result.detected_type).toBe('code');
        console.log(`✅ Large code file handled in ${endTime - startTime}ms`);
        
        // Should fail or handle gracefully in display
        try {
          await clientActor.displayAsset(result.assetId, { width: 800, height: 600 });
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log('✅ Large code file displayed successfully');
        } catch (error) {
          expect(error.message).toMatch(/size|memory|limit|large/i);
          console.log(`✅ Large code file display limited: ${error.message}`);
        }
      } else {
        expect(result.error).toBeTruthy();
        expect(result.error).toMatch(/size.*limit|too.*large|memory/i);
        console.log(`✅ Large code file rejected: ${result.error}`);
      }
    });
  });

  describe('malformed web content', () => {
    test('should handle severely broken HTML', async () => {
      console.log('🚫 Testing severely broken HTML...');
      
      const brokenHtml = `
        <html><head><title>Broken
        <body>
          <div class="unclosed">
            <p>Missing closing tags
            <script>alert('unclosed script
            <style>body { color: red
          <img src="missing quote>
        </html
      `;
      
      const result = await tool.execute({
        asset: brokenHtml,
        hint: 'web',
        title: 'Severely Broken HTML Test'
      });

      // Should either succeed with best-effort parsing or fail gracefully
      if (result.success) {
        expect(result.detected_type).toBe('web');
        
        // Try to display it
        await clientActor.displayAsset(result.assetId, { 
          sandbox: true, 
          allowScripts: false 
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const window = document.querySelector(`[data-asset-id="${result.assetId}"]`);
        expect(window).toBeTruthy();
        
        console.log('✅ Broken HTML displayed with browser tolerance');
      } else {
        expect(result.error).toBeTruthy();
        console.log(`✅ Broken HTML failed gracefully: ${result.error}`);
      }
    });

    test('should handle potentially malicious HTML', async () => {
      console.log('🚫 Testing potentially malicious HTML...');
      
      const maliciousHtml = `
        <html>
          <body>
            <script>
              // Attempt to access parent window
              try {
                parent.window.location = 'http://malicious.com';
              } catch(e) {}
            </script>
            <iframe src="javascript:alert('XSS')"></iframe>
            <object data="data:text/html,<script>alert('Object XSS')</script>"></object>
            <embed src="javascript:alert('Embed XSS')">
            <form action="javascript:alert('Form XSS')">
              <input type="submit" value="Test">
            </form>
          </body>
        </html>
      `;
      
      const result = await tool.execute({
        asset: maliciousHtml,
        hint: 'web',
        title: 'Potentially Malicious HTML Test',
        options: {
          sandbox: true,
          allowScripts: false
        }
      });

      if (result.success) {
        expect(result.detected_type).toBe('web');
        
        // Display should sandbox the content
        await clientActor.displayAsset(result.assetId, { 
          sandbox: true, 
          allowScripts: false 
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const window = document.querySelector(`[data-asset-id="${result.assetId}"]`);
        expect(window).toBeTruthy();
        
        // Verify sandboxing
        const iframe = window.querySelector('iframe');
        if (iframe) {
          expect(iframe.hasAttribute('sandbox')).toBe(true);
        }
        
        console.log('✅ Malicious HTML sandboxed successfully');
      } else {
        expect(result.error).toBeTruthy();
        expect(result.error).toMatch(/security|malicious|unsafe|blocked/i);
        console.log(`✅ Malicious HTML blocked: ${result.error}`);
      }
    });
  });

  describe('circular reference and recursive structures', () => {
    test('should handle deeply circular references', async () => {
      console.log('🚫 Testing deeply circular references...');
      
      const circular = { level: 1 };
      let current = circular;
      
      // Create deep nesting with circular reference
      for (let i = 2; i <= 100; i++) {
        current.next = { level: i };
        current = current.next;
      }
      current.back = circular; // Create circular reference
      
      const result = await tool.execute({
        asset: circular,
        title: 'Deep Circular Reference Test'
      });

      // Should fail with circular reference error
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/circular.*reference|cyclic.*structure|infinite.*recursion/i);
      
      console.log(`✅ Deep circular reference failed fast: ${result.error}`);
    });

    test('should handle self-referencing arrays', async () => {
      console.log('🚫 Testing self-referencing arrays...');
      
      const selfRefArray = [1, 2, 3];
      selfRefArray.push(selfRefArray); // Self-reference
      
      const result = await tool.execute({
        asset: selfRefArray,
        title: 'Self-Referencing Array Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/circular.*reference|self.*reference|infinite/i);
      
      console.log(`✅ Self-referencing array failed fast: ${result.error}`);
    });
  });

  describe('type mismatch scenarios', () => {
    test('should handle function objects', async () => {
      console.log('🚫 Testing function objects...');
      
      const functionAsset = function testFunction() {
        return 'This is a function';
      };
      
      const result = await tool.execute({
        asset: functionAsset,
        title: 'Function Object Test'
      });

      // Should fail with unsupported type error
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/function.*not.*supported|unsupported.*type|cannot.*display/i);
      
      console.log(`✅ Function object failed fast: ${result.error}`);
    });

    test('should handle Symbol types', async () => {
      console.log('🚫 Testing Symbol types...');
      
      const symbolAsset = Symbol('test symbol');
      
      const result = await tool.execute({
        asset: symbolAsset,
        title: 'Symbol Type Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toMatch(/symbol.*not.*supported|unsupported.*type|cannot.*serialize/i);
      
      console.log(`✅ Symbol type failed fast: ${result.error}`);
    });

    test('should handle BigInt types', async () => {
      console.log('🚫 Testing BigInt types...');
      
      const bigintAsset = BigInt('12345678901234567890');
      
      const result = await tool.execute({
        asset: bigintAsset,
        title: 'BigInt Type Test'
      });

      // Should either fail or convert to string representation
      if (result.success) {
        expect(result.detected_type).toBe('text');
        console.log('✅ BigInt converted to text representation');
      } else {
        expect(result.error).toBeTruthy();
        expect(result.error).toMatch(/bigint.*not.*supported|unsupported.*type|cannot.*serialize/i);
        console.log(`✅ BigInt type failed fast: ${result.error}`);
      }
    });
  });

  describe('asset size and complexity limits', () => {
    test('should handle excessively deep nested structures', async () => {
      console.log('🚫 Testing excessively deep nested structures...');
      
      // Create deeply nested object (1000 levels)
      let deepNested = { level: 0 };
      let current = deepNested;
      
      for (let i = 1; i < 1000; i++) {
        current.child = { level: i };
        current = current.child;
      }
      
      const result = await tool.execute({
        asset: deepNested,
        title: 'Excessively Deep Nested Structure Test'
      });

      // Should either succeed with depth limiting or fail with complexity error
      if (result.success) {
        expect(result.detected_type).toBe('json');
        
        // Try to display - should handle depth limiting
        await clientActor.displayAsset(result.assetId, { maxDepth: 10 });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const window = document.querySelector(`[data-asset-id="${result.assetId}"]`);
        expect(window).toBeTruthy();
        
        console.log('✅ Deep nested structure handled with depth limiting');
      } else {
        expect(result.error).toBeTruthy();
        expect(result.error).toMatch(/too.*deep|complexity.*limit|nesting.*limit|depth.*exceeded/i);
        console.log(`✅ Deep nested structure rejected: ${result.error}`);
      }
    });

    test('should handle extremely wide objects', async () => {
      console.log('🚫 Testing extremely wide objects...');
      
      const wideObject = {};
      
      // Create object with 10,000 properties
      for (let i = 0; i < 10000; i++) {
        wideObject[`property_${i}`] = `value_${i}`;
      }
      
      const startTime = Date.now();
      const result = await tool.execute({
        asset: wideObject,
        title: 'Extremely Wide Object Test'
      });
      const endTime = Date.now();

      // Should either succeed or fail with size/complexity limits
      if (result.success) {
        expect(result.detected_type).toBe('json');
        console.log(`✅ Wide object handled in ${endTime - startTime}ms`);
        
        // Display might be limited
        try {
          await clientActor.displayAsset(result.assetId);
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log('✅ Wide object displayed successfully');
        } catch (error) {
          expect(error.message).toMatch(/size|complexity|limit|memory/i);
          console.log(`✅ Wide object display limited: ${error.message}`);
        }
      } else {
        expect(result.error).toBeTruthy();
        expect(result.error).toMatch(/size.*limit|too.*large|complexity.*limit/i);
        console.log(`✅ Wide object rejected: ${result.error}`);
      }
    });
  });

  describe('asset content validation', () => {
    test('should validate asset content integrity', async () => {
      console.log('🚫 Testing asset content integrity...');
      
      const validAsset = { test: 'data', timestamp: Date.now() };
      
      const result = await tool.execute({
        asset: validAsset,
        title: 'Content Integrity Test'
      });

      expect(result.success).toBe(true);
      
      // Simulate content corruption by trying to display non-existent asset
      try {
        await clientActor.displayAsset('corrupted-asset-id-12345', {
          width: 400,
          height: 300
        });
        
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/asset.*not.*found|invalid.*asset|not.*exist/i);
        console.log(`✅ Asset integrity validated: ${error.message}`);
      }
    });

    test('should handle corrupted asset metadata', async () => {
      console.log('🚫 Testing corrupted asset metadata...');
      
      const assetWithBadMetadata = {
        data: 'valid content',
        metadata: {
          timestamp: 'invalid-date',
          size: -100,
          type: '',
          checksum: null
        }
      };
      
      const result = await tool.execute({
        asset: assetWithBadMetadata,
        title: 'Corrupted Metadata Test'
      });

      // Should succeed but possibly with warnings about metadata
      if (result.success) {
        expect(result.detected_type).toBeTruthy();
        console.log('✅ Bad metadata handled gracefully');
      } else {
        expect(result.error).toBeTruthy();
        expect(result.error).toMatch(/metadata|invalid.*format|validation/i);
        console.log(`✅ Bad metadata caused failure: ${result.error}`);
      }
    });
  });

  describe('error message quality for invalid assets', () => {
    test('should provide specific error messages for each invalid asset type', async () => {
      console.log('🚫 Testing error message specificity...');
      
      const invalidAssets = [
        { asset: null, expectedPattern: /null.*asset|asset.*required/i, name: 'null' },
        { asset: () => 'function', expectedPattern: /function.*not.*supported/i, name: 'function' },
        { asset: Symbol('test'), expectedPattern: /symbol.*not.*supported/i, name: 'symbol' },
        { asset: 'data:image/invalid;base64,bad', expectedPattern: /invalid.*image|format.*error/i, name: 'invalid image' }
      ];

      for (const testCase of invalidAssets) {
        console.log(`  Testing error message for: ${testCase.name}`);
        
        const result = await tool.execute({
          asset: testCase.asset,
          title: `Error Message Test: ${testCase.name}`
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
        expect(result.error).toMatch(testCase.expectedPattern);
        
        // Error message should be informative and specific
        expect(result.error.length).toBeGreaterThan(10);
        expect(result.error).not.toMatch(/undefined|null|object Object/i);
        
        console.log(`    ✅ Error: ${result.error.substring(0, 60)}...`);
      }
    });

    test('should include relevant context in error messages', async () => {
      console.log('🚫 Testing error context inclusion...');
      
      const contextualErrors = [
        {
          asset: 'data:image/png;base64,invalidbase64!!!',
          title: 'Context Test Image',
          expectedContext: ['base64', 'image', 'png']
        },
        {
          asset: '{"malformed": json}',
          hint: 'json',
          title: 'Context Test JSON',
          expectedContext: ['json', 'parse', 'malformed']
        }
      ];

      for (const testCase of contextualErrors) {
        const result = await tool.execute(testCase);

        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
        
        // Error should include contextual information
        const errorLower = result.error.toLowerCase();
        const contextFound = testCase.expectedContext.some(context => 
          errorLower.includes(context.toLowerCase())
        );
        expect(contextFound).toBe(true);
        
        console.log(`✅ Contextual error: ${result.error}`);
      }
    });
  });
});