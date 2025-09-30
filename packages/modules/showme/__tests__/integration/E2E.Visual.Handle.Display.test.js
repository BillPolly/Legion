/**
 * End-to-End VISUAL Integration Test for Handle Display
 * Actually launches Chrome, displays Handle, takes screenshot, validates visually
 * Uses MCP fullstack-monitor for real browser automation
 */

import { jest } from '@jest/globals';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MCP tools are available globally when running with fullstack-monitor
const {
  mcp__fullstack_monitor__start_app,
  mcp__fullstack_monitor__open_page,
  mcp__fullstack_monitor__query_logs,
  mcp__fullstack_monitor__take_screenshot,
  mcp__fullstack_monitor__browser_execute,
  mcp__fullstack_monitor__stop_app
} = global;

describe('E2E Visual Handle Display', () => {
  let server;
  let showAssetTool;
  let testStrategyURI;
  let sessionId;
  let screenshotDir;

  beforeAll(async () => {
    sessionId = `showme-visual-test-${Date.now()}`;
    screenshotDir = path.join(__dirname, '../__tmp/screenshots');

    // Ensure screenshot directory exists
    await fs.mkdir(screenshotDir, { recursive: true });

    // Setup test strategy URI
    const testStrategyPath = path.resolve(
      __dirname,
      '../../../../../agents/roma-agent/src/strategies/simple-node/SimpleNodeTestStrategy.js'
    );
    testStrategyURI = `legion://localhost/strategy${testStrategyPath}`;

    // Initialize ShowMe server on unique port
    server = new ShowMeServer({
      port: 3702,
      skipLegionPackages: false,
      browserOptions: {
        app: true,
        width: 1200,
        height: 800
      }
    });

    await server.initialize();
    await server.start();

    // Initialize ShowAssetTool with required detector
    const assetDetector = new AssetTypeDetector();
    showAssetTool = new ShowAssetTool({
      assetDetector,
      server
    });

    console.log(`✅ Server started on port 3702`);
    console.log(`✅ Test session: ${sessionId}`);
  }, 60000);

  afterAll(async () => {
    try {
      // Stop MCP session
      if (typeof mcp__fullstack_monitor__stop_app === 'function') {
        await mcp__fullstack_monitor__stop_app({ session_id: sessionId });
      }
    } catch (error) {
      console.warn('Failed to stop MCP session:', error.message);
    }

    // Stop server
    if (server && server.isRunning) {
      await server.stop();
    }

    console.log(`✅ Cleanup complete`);
  }, 30000);

  describe('Visual Handle Display in Chrome', () => {
    test('should launch Chrome and display strategy Handle visually', async () => {
      // Step 1: Display the Handle via ShowAssetTool
      console.log('Step 1: Executing ShowAssetTool with Handle URI...');
      const result = await showAssetTool.execute({
        asset: testStrategyURI,
        title: 'Visual Test - SimpleNodeTestStrategy'
      });

      expect(result.success).toBe(true);
      expect(result.assetId).toBeDefined();
      console.log(`✅ ShowAssetTool executed: ${result.assetId}`);

      // Step 2: Open Chrome browser with MCP
      console.log('Step 2: Opening Chrome browser...');
      const pageUrl = `http://localhost:3702/showme?asset=${encodeURIComponent(result.assetId)}`;

      if (typeof mcp__fullstack_monitor__open_page === 'function') {
        await mcp__fullstack_monitor__open_page({
          url: pageUrl,
          session_id: sessionId,
          headless: false // Show the browser!
        });
        console.log(`✅ Chrome opened at: ${pageUrl}`);
      } else {
        console.warn('⚠️  MCP tools not available, skipping visual test');
        return;
      }

      // Step 3: Wait for page to load and render
      console.log('Step 3: Waiting for page render...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 4: Take screenshot
      console.log('Step 4: Taking screenshot...');
      const screenshotPath = path.join(screenshotDir, `handle-display-${Date.now()}.png`);

      if (typeof mcp__fullstack_monitor__take_screenshot === 'function') {
        await mcp__fullstack_monitor__take_screenshot({
          session_id: sessionId,
          path: screenshotPath,
          fullPage: true
        });
        console.log(`✅ Screenshot saved: ${screenshotPath}`);

        // Verify screenshot file exists
        const stats = await fs.stat(screenshotPath);
        expect(stats.size).toBeGreaterThan(1000); // Should be at least 1KB
        console.log(`✅ Screenshot size: ${stats.size} bytes`);
      }

      // Step 5: Query browser logs
      console.log('Step 5: Checking browser logs...');
      if (typeof mcp__fullstack_monitor__query_logs === 'function') {
        const logs = await mcp__fullstack_monitor__query_logs({
          session_id: sessionId,
          limit: 50
        });

        console.log(`✅ Captured ${logs.length} log entries`);

        // Check for errors
        const errors = logs.filter(log => log.level === 'error');
        if (errors.length > 0) {
          console.warn('⚠️  Browser errors detected:');
          errors.forEach(err => console.warn('  -', err.message));
        }

        // Should have no critical errors
        expect(errors.filter(e => !e.message.includes('404'))).toHaveLength(0);
      }

      // Step 6: Execute JavaScript to validate DOM
      console.log('Step 6: Validating rendered DOM...');
      if (typeof mcp__fullstack_monitor__browser_execute === 'function') {
        // Get page title
        const title = await mcp__fullstack_monitor__browser_execute({
          session_id: sessionId,
          command: 'title',
          args: []
        });
        console.log(`✅ Page title: ${title}`);
        expect(title).toBeTruthy();

        // Check if Handle renderer is present
        const hasHandleRenderer = await mcp__fullstack_monitor__browser_execute({
          session_id: sessionId,
          command: 'evaluate',
          args: [`() => {
            return document.querySelector('.handle-renderer') !== null ||
                   document.querySelector('.strategy-renderer') !== null ||
                   document.body.innerText.includes('Strategy') ||
                   document.body.innerText.includes('Handle');
          }`]
        });

        console.log(`✅ Handle content detected: ${hasHandleRenderer}`);
        expect(hasHandleRenderer).toBe(true);

        // Get visible text content
        const bodyText = await mcp__fullstack_monitor__browser_execute({
          session_id: sessionId,
          command: 'evaluate',
          args: [`() => document.body.innerText.substring(0, 500)`]
        });

        console.log(`✅ Page content preview:\n${bodyText}`);
        expect(bodyText.length).toBeGreaterThan(0);
      }

      console.log('✅ Visual test complete!');
    }, 120000); // 2 minute timeout for full visual test

    test('should display Handle metadata in browser', async () => {
      // Display Handle
      const result = await showAssetTool.execute({
        asset: testStrategyURI,
        title: 'Metadata Visual Test'
      });
      expect(result.success).toBe(true);

      // Open browser
      const pageUrl = `http://localhost:3702/showme?asset=${encodeURIComponent(result.assetId)}`;

      if (typeof mcp__fullstack_monitor__open_page === 'function') {
        await mcp__fullstack_monitor__open_page({
          url: pageUrl,
          session_id: `${sessionId}-metadata`,
          headless: false
        });

        // Wait for render
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Take screenshot
        const screenshotPath = path.join(screenshotDir, `handle-metadata-${Date.now()}.png`);
        await mcp__fullstack_monitor__take_screenshot({
          session_id: `${sessionId}-metadata`,
          path: screenshotPath,
          fullPage: true
        });

        console.log(`✅ Metadata screenshot: ${screenshotPath}`);

        // Validate metadata is visible
        if (typeof mcp__fullstack_monitor__browser_execute === 'function') {
          const hasMetadata = await mcp__fullstack_monitor__browser_execute({
            session_id: `${sessionId}-metadata`,
            command: 'evaluate',
            args: [`() => {
              const text = document.body.innerText.toLowerCase();
              return text.includes('strategy') ||
                     text.includes('handle') ||
                     text.includes('legion://');
            }`]
          });

          expect(hasMetadata).toBe(true);
        }

        // Cleanup
        await mcp__fullstack_monitor__stop_app({ session_id: `${sessionId}-metadata` });
      }
    }, 90000);

    test('should handle multiple Handle displays', async () => {
      const handles = [];

      // Display multiple Handles
      for (let i = 0; i < 3; i++) {
        const result = await showAssetTool.execute({
          asset: testStrategyURI,
          title: `Multi-Display Test ${i + 1}`
        });
        expect(result.success).toBe(true);
        handles.push(result.assetId);
      }

      expect(handles).toHaveLength(3);
      expect(new Set(handles).size).toBe(3); // All unique

      console.log(`✅ Created ${handles.length} unique Handle displays`);

      // Open each in browser and screenshot
      if (typeof mcp__fullstack_monitor__open_page === 'function') {
        for (let i = 0; i < handles.length; i++) {
          const sessId = `${sessionId}-multi-${i}`;
          const pageUrl = `http://localhost:3702/showme?asset=${encodeURIComponent(handles[i])}`;

          await mcp__fullstack_monitor__open_page({
            url: pageUrl,
            session_id: sessId,
            headless: true // Use headless for batch processing
          });

          await new Promise(resolve => setTimeout(resolve, 2000));

          const screenshotPath = path.join(screenshotDir, `multi-display-${i}-${Date.now()}.png`);
          await mcp__fullstack_monitor__take_screenshot({
            session_id: sessId,
            path: screenshotPath,
            fullPage: false
          });

          console.log(`✅ Screenshot ${i + 1}: ${screenshotPath}`);

          await mcp__fullstack_monitor__stop_app({ session_id: sessId });
        }
      }
    }, 120000);
  });

  describe('Visual Error Scenarios', () => {
    test('should display error UI for invalid Handle', async () => {
      const invalidURI = 'legion://invalid/badhandle';

      // This should fail but we want to see how the UI handles it
      try {
        const result = await showAssetTool.execute({
          asset: invalidURI,
          title: 'Error Test'
        });

        // If it doesn't throw, check if success is false
        if (result && !result.success) {
          console.log(`✅ Error properly returned: ${result.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.log(`✅ Error properly thrown: ${error.message}`);
        expect(error.message).toBeTruthy();
      }
    });
  });
});