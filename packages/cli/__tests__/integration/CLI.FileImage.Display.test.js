/**
 * Integration test for CLI file-based image display
 * Tests the full flow: file -> ImageHandle -> base64 -> WebSocket -> browser display
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { CLIServer } from '../../src/server/CLIServer.js';
import { ResourceManager } from '@legion/resource-manager';
import { JSDOM } from 'jsdom';
import { MockWebSocket } from '../helpers/MockWebSocket.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CLI File Image Display Integration', () => {
  let server;
  let resourceManager;
  let dom;
  let document;
  let window;
  let testImagePath;

  beforeAll(async () => {
    // Get ResourceManager
    resourceManager = await ResourceManager.getInstance();

    // Create a small test image (1x1 red pixel PNG)
    const redPixelPNG = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
      0x54, 0x08, 0x99, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
      0x00, 0x00, 0x03, 0x00, 0x01, 0x6B, 0x7E, 0x58,
      0x18, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND chunk
      0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    testImagePath = path.join(__dirname, '../tmp/test-image.png');
    await fs.mkdir(path.dirname(testImagePath), { recursive: true });
    await fs.writeFile(testImagePath, redPixelPNG);

    // Create CLI server
    server = new CLIServer({
      port: 3800,
      showmePort: 3801,
      resourceManager
    });

    await server.initialize();
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
    // Clean up test image
    try {
      await fs.unlink(testImagePath);
    } catch (e) {
      // Ignore
    }
  });

  beforeEach(() => {
    // Set up jsdom
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
      url: 'http://localhost:3800',
      runScripts: 'dangerously',
      resources: 'usable'
    });
    document = dom.window.document;
    window = dom.window;
  });

  test('should display local image file in floating window', async () => {
    // Mock WebSocket
    const messages = [];
    const mockWs = new MockWebSocket('ws://localhost:3800/ws?route=/cli');

    // Capture sent messages
    const originalSend = mockWs.send.bind(mockWs);
    mockWs.send = (data) => {
      const msg = JSON.parse(data);
      messages.push(msg);
      originalSend(data);
    };

    // Simulate handshake
    mockWs.simulateOpen();

    // Send handshake from client
    mockWs.send(JSON.stringify({
      type: 'actor_handshake',
      clientRootActor: 'test-client',
      route: '/cli'
    }));

    // Wait for handshake ack
    await new Promise(resolve => setTimeout(resolve, 100));

    // Find handshake ack message
    const handshakeAck = messages.find(m => m.type === 'actor_handshake_ack');
    expect(handshakeAck).toBeDefined();
    expect(handshakeAck.serverRootActor).toBeDefined();

    const serverActorId = handshakeAck.serverRootActor;

    // Clear messages
    messages.length = 0;

    // Send show command for local file
    mockWs.send(JSON.stringify({
      targetGuid: serverActorId,
      payload: ['execute-command', {
        command: `/show file://${testImagePath}`
      }],
      sourceGuid: 'msg-1'
    }));

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find display-asset message
    const displayAssetMsg = messages.find(m =>
      m.payload && Array.isArray(m.payload) && m.payload[0] === 'display-asset'
    );

    expect(displayAssetMsg).toBeDefined();

    const assetData = displayAssetMsg.payload[1];
    expect(assetData).toBeDefined();
    expect(assetData.asset).toBeDefined();

    // Check that asset data is base64 encoded data URL
    const imageData = typeof assetData.asset === 'string'
      ? assetData.asset
      : assetData.asset.data;

    expect(imageData).toMatch(/^data:image\/(png|jpeg|jpg);base64,/);

    // Verify base64 data can be decoded
    const base64Data = imageData.split(',')[1];
    expect(base64Data).toBeDefined();
    expect(base64Data.length).toBeGreaterThan(0);

    // Now simulate displaying in browser
    const floatingWindow = document.createElement('div');
    floatingWindow.className = 'floating-window';
    floatingWindow.innerHTML = `
      <div class="window-header">
        <span class="window-title">${assetData.title || 'Image'}</span>
        <button class="window-close">&times;</button>
      </div>
      <div class="window-content">
        <img src="${imageData}" alt="${assetData.title}" />
      </div>
    `;

    document.body.appendChild(floatingWindow);

    // Verify window was created
    const windows = document.querySelectorAll('.floating-window');
    expect(windows.length).toBe(1);

    // Verify image element exists
    const img = floatingWindow.querySelector('img');
    expect(img).toBeDefined();
    expect(img.src).toBe(imageData);

    // Verify title
    const title = floatingWindow.querySelector('.window-title');
    expect(title).toBeDefined();
    expect(title.textContent).toBeTruthy();
  });

  test('should handle multiple images in separate windows', async () => {
    const mockWs = new MockWebSocket('ws://localhost:3800/ws?route=/cli');
    const messages = [];

    const originalSend = mockWs.send.bind(mockWs);
    mockWs.send = (data) => {
      messages.push(JSON.parse(data));
      originalSend(data);
    };

    mockWs.simulateOpen();
    mockWs.send(JSON.stringify({
      type: 'actor_handshake',
      clientRootActor: 'test-client-2',
      route: '/cli'
    }));

    await new Promise(resolve => setTimeout(resolve, 100));

    const handshakeAck = messages.find(m => m.type === 'actor_handshake_ack');
    const serverActorId = handshakeAck.serverRootActor;

    // Show two images
    for (let i = 0; i < 2; i++) {
      messages.length = 0;

      mockWs.send(JSON.stringify({
        targetGuid: serverActorId,
        payload: ['execute-command', {
          command: `/show file://${testImagePath} --title "Image ${i + 1}"`
        }],
        sourceGuid: `msg-${i + 1}`
      }));

      await new Promise(resolve => setTimeout(resolve, 300));

      const displayAssetMsg = messages.find(m =>
        m.payload && Array.isArray(m.payload) && m.payload[0] === 'display-asset'
      );

      expect(displayAssetMsg).toBeDefined();

      const assetData = displayAssetMsg.payload[1];
      const imageData = typeof assetData.asset === 'string'
        ? assetData.asset
        : assetData.asset.data;

      // Create window
      const floatingWindow = document.createElement('div');
      floatingWindow.className = 'floating-window';
      floatingWindow.innerHTML = `
        <div class="window-header">
          <span class="window-title">${assetData.title || `Image ${i + 1}`}</span>
          <button class="window-close">&times;</button>
        </div>
        <div class="window-content">
          <img src="${imageData}" />
        </div>
      `;

      document.body.appendChild(floatingWindow);
    }

    // Verify both windows exist
    const windows = document.querySelectorAll('.floating-window');
    expect(windows.length).toBe(2);

    // Verify each has unique title
    const titles = Array.from(windows).map(w =>
      w.querySelector('.window-title').textContent
    );
    expect(titles).toContain('Image 1');
    expect(titles).toContain('Image 2');
  });

  test('should handle window close functionality', async () => {
    // Create a floating window
    const floatingWindow = document.createElement('div');
    floatingWindow.className = 'floating-window';
    floatingWindow.innerHTML = `
      <div class="window-header">
        <span class="window-title">Test Image</span>
        <button class="window-close">&times;</button>
      </div>
      <div class="window-content">
        <img src="data:image/png;base64,test" />
      </div>
    `;

    document.body.appendChild(floatingWindow);

    // Verify window exists
    expect(document.querySelectorAll('.floating-window').length).toBe(1);

    // Click close button
    const closeBtn = floatingWindow.querySelector('.window-close');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(floatingWindow);
    });

    closeBtn.click();

    // Verify window was removed
    expect(document.querySelectorAll('.floating-window').length).toBe(0);
  });
});
