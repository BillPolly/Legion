/**
 * Video Recording Integration Test for FullStackMonitor
 * Tests real video recording functionality
 */

import { jest } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('FullStackMonitor Video Recording', () => {
  let monitor;
  let resourceManager;
  let videoDir;

  beforeEach(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Create monitor with specific port to avoid conflicts
    monitor = await FullStackMonitor.create(resourceManager, {
      wsAgentPort: 9909
    });
    
    // Create temp video directory
    videoDir = path.join(__dirname, 'tmp', 'videos', `test-${Date.now()}`);
    await fs.mkdir(videoDir, { recursive: true });
  }, 30000);

  afterEach(async () => {
    if (monitor) {
      await monitor.cleanup();
    }
    
    // Clean up test videos
    try {
      await fs.rm(videoDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }, 15000);

  test('should start and stop video recording for a browser session', async () => {
    // Start with a data URL page
    const testHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Video Test Page</title></head>
        <body>
          <h1>Video Recording Test</h1>
          <div id="counter">0</div>
          <script>
            let count = 0;
            setInterval(() => {
              count++;
              document.getElementById('counter').textContent = count;
            }, 100);
          </script>
        </body>
      </html>
    `;
    
    const dataUrl = `data:text/html;base64,${Buffer.from(testHtml).toString('base64')}`;
    const sessionId = 'video-test-1';
    
    // Open page
    const openResult = await monitor.openPage(dataUrl, sessionId);
    expect(openResult.content[0].text).toContain('✅ Page opened');
    
    // Start video recording
    const videoPath = path.join(videoDir, 'test-recording.webm');
    const startResult = await monitor.startVideo(sessionId, {
      output_path: videoPath,
      fps: 10,
      quality: 60
    });
    
    expect(startResult.content[0].text).toContain('✅ Video recording started');
    expect(startResult.content[0].text).toContain(videoPath);
    
    // Record for 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Stop video recording
    const stopResult = await monitor.stopVideo(sessionId);
    
    expect(stopResult.content[0].text).toContain('✅ Video recording stopped');
    expect(stopResult.content[0].text).toContain('Duration:');
    expect(stopResult.content[0].text).toContain('Frames:');
    
    // Check if sample frame was saved (video might not be created without ffmpeg)
    const samplePath = videoPath.replace('.webm', '-sample.png');
    const sampleExists = await fs.access(samplePath).then(() => true).catch(() => false);
    expect(sampleExists).toBe(true);
    
    // If sample exists, verify it's a valid PNG
    if (sampleExists) {
      const sampleBuffer = await fs.readFile(samplePath);
      const isPNG = sampleBuffer[0] === 0x89 && sampleBuffer[1] === 0x50; // PNG magic bytes
      expect(isPNG).toBe(true);
    }
  }, 60000);

  test('should prevent duplicate video recordings', async () => {
    const testHtml = `
      <!DOCTYPE html>
      <html><body><h1>Test</h1></body></html>
    `;
    
    const dataUrl = `data:text/html;base64,${Buffer.from(testHtml).toString('base64')}`;
    const sessionId = 'video-test-2';
    
    // Open page
    await monitor.openPage(dataUrl, sessionId);
    
    // Start first recording
    const videoPath1 = path.join(videoDir, 'recording1.webm');
    const startResult1 = await monitor.startVideo(sessionId, {
      output_path: videoPath1
    });
    expect(startResult1.content[0].text).toContain('✅ Video recording started');
    
    // Try to start second recording (should fail)
    const videoPath2 = path.join(videoDir, 'recording2.webm');
    const startResult2 = await monitor.startVideo(sessionId, {
      output_path: videoPath2
    });
    expect(startResult2.content[0].text).toContain('❌ Failed to start video');
    expect(startResult2.content[0].text).toContain('already in progress');
    
    // Stop the recording
    await monitor.stopVideo(sessionId);
  }, 30000);

  test('should handle stop without active recording', async () => {
    const testHtml = `
      <!DOCTYPE html>
      <html><body><h1>Test</h1></body></html>
    `;
    
    const dataUrl = `data:text/html;base64,${Buffer.from(testHtml).toString('base64')}`;
    const sessionId = 'video-test-3';
    
    // Open page but don't start recording
    await monitor.openPage(dataUrl, sessionId);
    
    // Try to stop recording (should fail gracefully)
    const stopResult = await monitor.stopVideo(sessionId);
    expect(stopResult.content[0].text).toContain('❌ Failed to stop video');
    expect(stopResult.content[0].text).toContain('No video recording in progress');
  }, 30000);

  test('should handle video recording without explicit path', async () => {
    const testHtml = `
      <!DOCTYPE html>
      <html><body><h1>Auto Path Test</h1></body></html>
    `;
    
    const dataUrl = `data:text/html;base64,${Buffer.from(testHtml).toString('base64')}`;
    const sessionId = 'video-test-4';
    
    // Open page
    await monitor.openPage(dataUrl, sessionId);
    
    // Start recording without specifying path
    const startResult = await monitor.startVideo(sessionId);
    expect(startResult.content[0].text).toContain('✅ Video recording started');
    expect(startResult.content[0].text).toContain('recording-');
    expect(startResult.content[0].text).toContain('.webm');
    
    // Record briefly
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Stop recording
    const stopResult = await monitor.stopVideo(sessionId);
    expect(stopResult.content[0].text).toContain('✅ Video recording stopped');
  }, 30000);

  test('should clean up video recording on monitor cleanup', async () => {
    const testHtml = `
      <!DOCTYPE html>
      <html><body><h1>Cleanup Test</h1></body></html>
    `;
    
    const dataUrl = `data:text/html;base64,${Buffer.from(testHtml).toString('base64')}`;
    const sessionId = 'video-test-5';
    
    // Open page and start recording
    await monitor.openPage(dataUrl, sessionId);
    const videoPath = path.join(videoDir, 'cleanup-test.webm');
    await monitor.startVideo(sessionId, { output_path: videoPath });
    
    // Clean up monitor (should stop recording gracefully)
    await monitor.cleanup();
    
    // Check if sample was saved (indicates recording was stopped)
    const samplePath = videoPath.replace('.webm', '-sample.png');
    const sampleExists = await fs.access(samplePath).then(() => true).catch(() => false);
    expect(sampleExists).toBe(true);
    
    // Monitor should be cleaned up
    monitor = null;
  }, 30000);
});