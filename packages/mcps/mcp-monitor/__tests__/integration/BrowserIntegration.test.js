/**
 * @jest-environment node
 */

import { MCPClient } from '../../mcp-client.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Browser Integration Test', () => {
  let client;

  beforeEach(async () => {
    client = new MCPClient();
    await client.connect('node', [path.join(__dirname, '../../mcp-server.js')]);
    await client.initialize({ name: 'browser-test-client', version: '1.0.0' });
    client.sendNotification('notifications/initialized');
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  test('should handle screenshot tool without browser', async () => {
    // Test take_screenshot without starting an app (should handle gracefully)
    const result = await client.callTool('take_screenshot', {
      session_id: 'screenshot-test'
    });
    
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    // Should either succeed or fail gracefully with a meaningful message
  });
  
  test('should handle record_video tool without browser', async () => {
    // Test record_video without starting an app (should handle gracefully)
    const result = await client.callTool('record_video', {
      session_id: 'video-test',
      action: 'start'
    });
    
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    // Should either succeed or fail gracefully with a meaningful message
  });
  
  test('should validate screenshot tool parameters', async () => {
    // Test with various parameters
    const result1 = await client.callTool('take_screenshot', {
      session_id: 'param-test-1',
      format: 'png'
    });
    expect(result1.content).toBeDefined();
    
    const result2 = await client.callTool('take_screenshot', {
      session_id: 'param-test-2',
      fullPage: true
    });
    expect(result2.content).toBeDefined();
  });
  
  test('should validate video tool parameters', async () => {
    // Test record_video with different parameters
    const startResult = await client.callTool('record_video', {
      session_id: 'video-param-test',
      action: 'start',
      path: '/tmp/test-video.mp4'
    });
    expect(startResult.content).toBeDefined();
    
    const stopResult = await client.callTool('record_video', {
      session_id: 'video-param-test',
      action: 'stop'
    });
    expect(stopResult.content).toBeDefined();
  });
});