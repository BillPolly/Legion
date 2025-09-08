/**
 * End-to-End Tests for Image Asset Display Workflow
 * 
 * Tests complete image workflow from tool execution to final UI display
 * NO MOCKS - Complete workflow validation with real Legion components
 */

import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import { AssetDisplayManager } from '../../src/client/AssetDisplayManager.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Image Asset Display Workflow End-to-End', () => {
  let tool;
  let server;
  let clientActor;
  let displayManager;
  let assetDetector;
  let resourceManager;
  let dom;
  let document;
  let window;
  const testPort = 3792;

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
      await clientActor.disconnect();
      await clientActor.cleanup();
    }
    if (displayManager) {
      await displayManager.cleanup();
    }
    if (server) {
      await server.stop();
    }
    
    delete global.document;
    delete global.window;
    delete global.HTMLElement;
  });

  describe('PNG image workflow', () => {
    test('should handle complete PNG image display workflow', async () => {
      // Create test PNG image (small red square)
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x08, // 8x8 pixels
        0x08, 0x02, 0x00, 0x00, 0x00, 0x4B, 0x6D, 0x29,
        0xDC, 0x00, 0x00, 0x00, 0x17, 0x49, 0x44, 0x41, // IDAT
        0x54, 0x78, 0x9C, 0x63, 0xF8, 0xCF, 0xF0, 0x9F,
        0x81, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x03,
        0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D,
        0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
        0x44, 0xAE, 0x42, 0x60, 0x82 // IEND
      ]);
      
      const base64Image = `data:image/png;base64,${pngData.toString('base64')}`;

      console.log('🖼️ Starting PNG workflow...');

      // Step 1: Tool execution with asset detection
      const startTime = Date.now();
      const toolResult = await tool.execute({
        asset: base64Image,
        title: 'Test PNG Image',
        options: {
          width: 400,
          height: 300,
          maintainAspectRatio: true,
          allowZoom: true,
          showImageInfo: true
        }
      });

      // Validate tool execution
      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('image');
      expect(toolResult.assetId).toBeTruthy();
      expect(toolResult.url).toContain(`http://localhost:${testPort}`);
      console.log('✅ Tool execution successful - Type detected:', toolResult.detected_type);

      // Step 2: Verify asset storage on server
      const serverResponse = await fetch(toolResult.url);
      expect(serverResponse.status).toBe(200);
      expect(serverResponse.headers.get('content-type')).toContain('image');
      
      const serverImageData = await serverResponse.text();
      expect(serverImageData).toBe(base64Image);
      console.log('✅ Server storage verified - Image accessible');

      // Step 3: Client actor display request
      const displayResult = await clientActor.displayAsset(toolResult.assetId, {
        width: 400,
        height: 300,
        x: 100,
        y: 100,
        maintainAspectRatio: true,
        allowZoom: true,
        showImageInfo: true
      });

      expect(displayResult).toBeTruthy();
      console.log('✅ Client display request sent');

      // Wait for UI rendering
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Verify UI window creation
      const imageWindow = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(imageWindow).toBeTruthy();
      expect(imageWindow.classList.contains('showme-window')).toBe(true);
      expect(imageWindow.classList.contains('showme-window-image')).toBe(true);

      // Verify window properties
      expect(imageWindow.style.width).toContain('400');
      expect(imageWindow.style.height).toContain('300');
      expect(imageWindow.style.left).toContain('100');
      expect(imageWindow.style.top).toContain('100');

      // Step 5: Verify window header
      const header = imageWindow.querySelector('.showme-window-header');
      expect(header).toBeTruthy();
      
      const title = header.querySelector('.showme-window-title');
      expect(title.textContent).toContain('Test PNG Image');

      const controls = header.querySelectorAll('.showme-window-close, .showme-window-minimize, .showme-window-maximize');
      expect(controls.length).toBe(3);
      console.log('✅ Window header verified');

      // Step 6: Verify image content rendering
      const content = imageWindow.querySelector('.showme-window-content');
      expect(content).toBeTruthy();

      const imageElement = content.querySelector('img');
      expect(imageElement).toBeTruthy();
      expect(imageElement.src).toBe(base64Image);
      expect(imageElement.style.maxWidth).toBe('100%');
      expect(imageElement.style.height).toBe('auto'); // Maintain aspect ratio

      // Check for image info if enabled
      const imageInfo = content.querySelector('.image-info');
      if (imageInfo) {
        expect(imageInfo.textContent).toContain('8x8'); // Image dimensions
        expect(imageInfo.textContent).toContain('PNG');
      }
      console.log('✅ Image content rendering verified');

      // Step 7: Test image interactions
      // Test zoom functionality
      if (imageElement) {
        // Simulate double-click for zoom
        const dblClickEvent = new window.MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true
        });
        imageElement.dispatchEvent(dblClickEvent);
        
        await new Promise(resolve => setTimeout(resolve, 200));
        // Image might have zoom applied (implementation dependent)
      }

      // Step 8: Test window interactions
      const closeButton = header.querySelector('.showme-window-close');
      expect(closeButton).toBeTruthy();

      // Test minimize
      const minimizeButton = header.querySelector('.showme-window-minimize');
      if (minimizeButton) {
        minimizeButton.click();
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(imageWindow.classList.contains('minimized')).toBe(true);
        
        // Restore
        minimizeButton.click();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      console.log('✅ Window interactions verified');

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      console.log(`🎉 PNG workflow completed in ${totalTime}ms`);

      // Verify workflow timing
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('JPEG image workflow', () => {
    test('should handle complete JPEG image display workflow', async () => {
      // Create minimal JPEG (not complete but recognizable format)
      const jpegData = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, // SOI + APP0
        0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, // JFIF
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
        0xFF, 0xDB, 0x00, 0x43, 0x00, // Quantization table
        ...Array(64).fill(0x10), // Dummy quantization values
        0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x10, // SOF
        0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xFF, 0xD9 // EOI
      ]);
      
      const base64Image = `data:image/jpeg;base64,${jpegData.toString('base64')}`;

      const toolResult = await tool.execute({
        asset: base64Image,
        title: 'Test JPEG Image',
        options: {
          width: 500,
          height: 400,
          quality: 'high'
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('image');

      await clientActor.displayAsset(toolResult.assetId, {
        width: 500,
        height: 400
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();
      expect(window.classList.contains('showme-window-image')).toBe(true);

      const img = window.querySelector('img');
      expect(img.src).toBe(base64Image);
    });
  });

  describe('SVG image workflow', () => {
    test('should handle complete SVG image display workflow', async () => {
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="80" fill="url(#grad1)" stroke="black" stroke-width="2"/>
        <text x="100" y="105" text-anchor="middle" font-family="Arial" font-size="16" fill="white">SVG Test</text>
      </svg>`;

      const toolResult = await tool.execute({
        asset: svgContent,
        hint: 'image', // Force image detection for SVG
        title: 'Test SVG Image',
        options: {
          scalable: true,
          preserveAspectRatio: true
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('image');

      await clientActor.displayAsset(toolResult.assetId, {
        width: 300,
        height: 300,
        scalable: true
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      // SVG might be rendered as img or embedded directly
      const svgElement = window.querySelector('svg') || window.querySelector('img');
      expect(svgElement).toBeTruthy();
    });
  });

  describe('image workflow with options', () => {
    test('should handle image with custom display options', async () => {
      const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

      const toolResult = await tool.execute({
        asset: imageData,
        title: 'Image with Options',
        options: {
          width: 640,
          height: 480,
          maintainAspectRatio: false,
          allowZoom: true,
          showImageInfo: true,
          backgroundColor: '#f0f0f0',
          border: '2px solid #ccc',
          borderRadius: '8px'
        }
      });

      expect(toolResult.success).toBe(true);

      await clientActor.displayAsset(toolResult.assetId, {
        width: 640,
        height: 480,
        maintainAspectRatio: false,
        allowZoom: true,
        showImageInfo: true,
        theme: 'light'
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();
      expect(window.style.width).toContain('640');
      expect(window.style.height).toContain('480');

      const img = window.querySelector('img');
      expect(img).toBeTruthy();

      // Verify options applied to display manager
      const windowInfo = displayManager.windows.get(displayManager.getWindowIdForAsset(toolResult.assetId));
      if (windowInfo) {
        expect(windowInfo.options.width).toBe(640);
        expect(windowInfo.options.height).toBe(480);
        expect(windowInfo.options.allowZoom).toBe(true);
      }
    });
  });

  describe('image workflow error scenarios', () => {
    test('should handle corrupted image data gracefully', async () => {
      const corruptedImage = 'data:image/png;base64,INVALID_DATA_HERE';

      const toolResult = await tool.execute({
        asset: corruptedImage,
        title: 'Corrupted Image Test'
      });

      expect(toolResult.success).toBe(true); // Tool should still succeed
      expect(toolResult.detected_type).toBe('image');

      await clientActor.displayAsset(toolResult.assetId);
      await new Promise(resolve => setTimeout(resolve, 500));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      // Should show error message or fallback
      const content = window.querySelector('.showme-window-content');
      const errorMsg = content.querySelector('.error-message, .fallback-message');
      const brokenImg = content.querySelector('img');
      
      // Either shows error message or broken image element
      expect(errorMsg || brokenImg).toBeTruthy();
    });

    test('should handle very large image URLs', async () => {
      // Test with a valid but potentially large image URL
      const largeImageUrl = 'https://httpbin.org/image/png'; // 1024x1024 PNG

      const toolResult = await tool.execute({
        asset: largeImageUrl,
        hint: 'image',
        title: 'Large Image URL Test',
        options: {
          maxWidth: 800,
          maxHeight: 600,
          lazyLoad: true
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('image');

      await clientActor.displayAsset(toolResult.assetId, {
        maxWidth: 800,
        maxHeight: 600
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      const img = window.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.src).toContain('httpbin.org');
    });
  });

  describe('image workflow performance', () => {
    test('should handle multiple image displays efficiently', async () => {
      const images = [
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // Red pixel
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGj4DwABhQGA3vj2IQAAAABJRU5ErkJggg==', // Blue pixel
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUB4yzqRNUlEQVR42mP8//8/AzYwOgAGhwJ/PchI7wAAAABJRU5ErkJggg==' // Green pixel
      ];

      const startTime = Date.now();
      const toolResults = [];

      // Execute tools for all images
      for (let i = 0; i < images.length; i++) {
        const result = await tool.execute({
          asset: images[i],
          title: `Performance Test Image ${i + 1}`
        });
        expect(result.success).toBe(true);
        toolResults.push(result);
      }

      // Display all images
      for (let i = 0; i < toolResults.length; i++) {
        await clientActor.displayAsset(toolResults[i].assetId, {
          width: 200,
          height: 150,
          x: i * 220,
          y: 50
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all windows created
      const windows = document.querySelectorAll('.showme-window-image');
      expect(windows.length).toBe(3);

      // Performance should be reasonable
      expect(totalTime).toBeLessThan(3000); // Should complete within 3 seconds

      // Verify each image rendered
      for (const result of toolResults) {
        const window = document.querySelector(`[data-asset-id="${result.assetId}"]`);
        expect(window).toBeTruthy();
        const img = window.querySelector('img');
        expect(img).toBeTruthy();
      }
    });
  });
});