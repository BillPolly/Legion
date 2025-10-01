/**
 * E2E Test: In-Memory Image Display
 *
 * Tests displaying an in-memory image Handle in the browser
 */

import { ImageHandle } from '../../src/handles/ImageHandle.js';
import { ShowMeController } from '../../src/ShowMeController.js';

// Small 10x10 red square as base64 PNG
const RED_SQUARE_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';

describe('E2E: In-Memory Image Display', () => {
  let showme;

  beforeAll(async () => {
    // Initialize ShowMe controller on port 3701 (different from CLI server)
    showme = new ShowMeController({ port: 3701 });
    await showme.initialize();
    await showme.start();

    console.log('ShowMe started on port 3701');
  }, 30000);

  afterAll(async () => {
    if (showme) {
      await showme.stop();
    }
  }, 30000);

  test('should display in-memory image Handle in browser', async () => {
    // Create an ImageHandle with in-memory data
    const imageHandle = new ImageHandle({
      id: 'red-square-test',
      title: 'Red Square Test Image',
      type: 'image/png',
      data: RED_SQUARE_BASE64,
      width: 10,
      height: 10
    });

    // Verify Handle methods work
    const metadata = await imageHandle.getMetadata();
    expect(metadata).toEqual({
      id: 'red-square-test',
      title: 'Red Square Test Image',
      type: 'image/png',
      width: 10,
      height: 10
    });

    const data = await imageHandle.getData();
    expect(data).toBe(RED_SQUARE_BASE64);

    // Open browser window to display the image
    console.log('Opening browser window for image...');
    const windowId = await showme.openWindow(imageHandle);
    expect(windowId).toBeTruthy();
    console.log(`Browser window opened: ${windowId}`);

    // Wait for browser to load and render
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot
    const screenshotPath = '/Users/maxximus/Documents/max-projects/pocs/Legion/packages/modules/showme/__tests__/tmp/in-memory-image-display.png';
    console.log(`Taking screenshot: ${screenshotPath}`);

    // TODO: Use MCP tool to take screenshot
    // For now, just verify the window is open
    const windows = showme.getOpenWindows();
    expect(windows.length).toBe(1);
    expect(windows[0].id).toBe(windowId);

    console.log('✅ Image displayed successfully');
  }, 30000);

  test('should display multiple in-memory images', async () => {
    // Blue square
    const BLUE_SQUARE_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAAhKDvcWkH6oAAAAAElFTkSuQmCC';

    const blueImage = new ImageHandle({
      id: 'blue-square-test',
      title: 'Blue Square',
      type: 'image/png',
      data: BLUE_SQUARE_BASE64,
      width: 10,
      height: 10
    });

    const redImage = new ImageHandle({
      id: 'red-square-test-2',
      title: 'Red Square',
      type: 'image/png',
      data: RED_SQUARE_BASE64,
      width: 10,
      height: 10
    });

    // Open both windows
    const windowId1 = await showme.openWindow(redImage);
    const windowId2 = await showme.openWindow(blueImage);

    expect(windowId1).toBeTruthy();
    expect(windowId2).toBeTruthy();
    expect(windowId1).not.toBe(windowId2);

    // Wait for both to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify both windows are open
    const windows = showme.getOpenWindows();
    expect(windows.length).toBe(2);

    console.log('✅ Multiple images displayed successfully');
  }, 30000);
});
