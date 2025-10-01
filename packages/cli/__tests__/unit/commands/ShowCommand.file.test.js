/**
 * Unit test for ShowCommand file:// URL handling
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ShowCommand } from '../../../src/commands/ShowCommand.js';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ShowCommand file:// URL handling', () => {
  let showCommand;
  let resourceManager;
  let displayEngine;
  let testImagePath;
  let redPixelPNG;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();

    // Create test image buffer (reused across tests)
    redPixelPNG = Buffer.from([
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

    testImagePath = path.join(__dirname, '../../tmp/test-image-unit.png');

    // Create a mock display engine that mimics DisplayEngine.renderBrowser()
    displayEngine = {
      render: async (handle, options) => {
        // Extract Handle data - mimics real DisplayEngine.renderBrowser()
        let assetData;
        if (typeof handle.getData === 'function') {
          try {
            // getData() returns string directly for ImageHandle
            assetData = await handle.getData();
          } catch (error) {
            console.error('Error calling getData():', error);
            assetData = handle.imageData?.data || handle.data;
          }
        } else {
          assetData = handle.imageData?.data || handle.data;
        }

        return {
          success: true,
          format: 'browser',
          rendered: 'browser',
          handle: handle,
          assetData: assetData,
          title: options.title || handle.imageData?.title || handle.title || 'Handle',
          assetType: handle.resourceType || handle.type || 'unknown'
        };
      }
    };

    showCommand = new ShowCommand(displayEngine, resourceManager);
  });

  beforeEach(async () => {
    // Recreate test image before each test
    await fs.mkdir(path.dirname(testImagePath), { recursive: true });
    await fs.writeFile(testImagePath, redPixelPNG);
  });

  afterAll(async () => {
    // Clean up test image
    try {
      await fs.unlink(testImagePath);
    } catch (e) {
      // Ignore
    }
  });

  test('should convert file:// URL to base64 data URL', async () => {
    const result = await showCommand.execute([`file://${testImagePath}`]);

    expect(result.success).toBe(true);
    expect(result.rendered).toBe('browser');
    expect(result.assetData).toBeDefined();

    // assetData IS the data URL string directly (not an object)
    const imageData = result.assetData;
    expect(imageData).toMatch(/^data:image\/png;base64,/);

    // Verify base64 data can be decoded
    const base64Data = imageData.split(',')[1];
    expect(base64Data).toBeDefined();
    expect(base64Data.length).toBeGreaterThan(0);

    // Verify decoded data matches original
    const decodedBuffer = Buffer.from(base64Data, 'base64');
    const originalBuffer = await fs.readFile(testImagePath);
    expect(decodedBuffer.equals(originalBuffer)).toBe(true);
  });

  test('should handle different image types', async () => {
    const testCases = [
      { ext: '.jpg', mime: 'image/jpeg' },
      { ext: '.jpeg', mime: 'image/jpeg' },
      { ext: '.gif', mime: 'image/gif' },
      { ext: '.webp', mime: 'image/webp' }
    ];

    for (const { ext, mime } of testCases) {
      const testPath = testImagePath.replace('.png', ext);
      await fs.copyFile(testImagePath, testPath);

      const result = await showCommand.execute([`file://${testPath}`]);

      expect(result.success).toBe(true);
      expect(result.assetData).toMatch(new RegExp(`^data:${mime};base64,`));

      await fs.unlink(testPath);
    }

    // Test PNG separately (already tested in first test, but verify MIME type detection)
    const result = await showCommand.execute([`file://${testImagePath}`]);
    expect(result.assetData).toMatch(/^data:image\/png;base64,/);
  });

  test('should use filename as title when not provided', async () => {
    const result = await showCommand.execute([`file://${testImagePath}`]);

    expect(result.title).toBe('test-image-unit.png');
  });

  test('should use custom title when provided', async () => {
    const result = await showCommand.execute([
      `file://${testImagePath}`,
      '--title',
      'My Test Image'
    ]);

    expect(result.title).toBe('My Test Image');
  });

  test('should handle non-existent files gracefully', async () => {
    await expect(
      showCommand.execute(['file:///non/existent/file.png'])
    ).rejects.toThrow();
  });
});
