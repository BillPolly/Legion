/**
 * REAL MCP Server test - NO MOCKS
 */

import { MCPClient } from '../../mcp-client.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('MCP Server Real Test', () => {
  let client;
  
  beforeEach(async () => {
    client = new MCPClient();
    const serverPath = path.resolve(__dirname, '../../mcp-server.js');
    await client.connect('node', [serverPath]);
    await client.initialize({ name: 'test-client', version: '1.0.0' });
    client.sendNotification('notifications/initialized');
  }, 30000);
  
  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  }, 10000);
  
  test('should start app and capture logs', async () => {
    const testScript = path.join(__dirname, 'fullstack-test-app.js');
    
    // Start monitoring
    const startResult = await client.callTool('start_app', {
      script: testScript,
      wait_for_port: 3098,
      session_id: 'test-session'
    });
    
    expect(startResult.content[0].text).toContain('✅ App started');
    
    // Wait for logs
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Query logs
    const logResult = await client.callTool('query_logs', {
      session_id: 'test-session',
      limit: 20
    });
    
    console.log('Log result:', logResult.content[0].text);
    expect(logResult.content[0].text).toContain('Found');
    
    // Clean up
    await client.callTool('stop_app', { session_id: 'test-session' });
  }, 60000);
});