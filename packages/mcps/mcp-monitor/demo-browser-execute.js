/**
 * Demo: Browser Execute Tool - Complete Browser Automation via MCP
 * 
 * This demo showcases the new browser_execute tool that provides
 * direct Puppeteer control through the MCP protocol.
 */

import { MCPClient } from './mcp-client.js';

const client = new MCPClient();

async function demoBrowserExecute() {
  try {
    console.log('🚀 Browser Execute Tool Demo');
    console.log('=' .repeat(50));
    console.log('');
    
    // Connect to MCP server
    console.log('1️⃣  Connecting to MCP server...');
    await client.connect('node', ['mcp-server.js']);
    await client.initialize({ name: 'browser-demo', version: '1.0.0' });
    client.sendNotification('notifications/initialized');
    console.log('✅ Connected\n');
    
    // Start a test server
    console.log('2️⃣  Starting test server with HTML...');
    const serverResult = await client.callTool('start_server', {
      script: './__tests__/apps/html-server.js',
      wait_for_port: 3020,
      session_id: 'demo-session',
      log_level: 'info'
    });
    console.log('✅ Server started on port 3020\n');
    
    // Open browser page
    console.log('3️⃣  Opening browser page (visible)...');
    await client.callTool('open_page', {
      url: 'http://localhost:3020',
      session_id: 'demo-session',
      headless: false  // Show browser window
    });
    console.log('✅ Browser opened\n');
    
    // Wait a moment for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('4️⃣  Demonstrating browser_execute commands:\n');
    
    // Get page title
    console.log('📌 Getting page title...');
    const titleResult = await client.callTool('browser_execute', {
      command: 'title',
      session_id: 'demo-session'
    });
    console.log(titleResult.content[0].text);
    console.log('');
    
    // Click a button
    console.log('📌 Clicking "Check Health" button...');
    const clickResult = await client.callTool('browser_execute', {
      command: 'click',
      args: ['#test-btn'],
      session_id: 'demo-session'
    });
    console.log(clickResult.content[0].text);
    console.log('');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Type into input field
    console.log('📌 Typing into name input field...');
    const typeResult = await client.callTool('browser_execute', {
      command: 'type',
      args: ['#name-input', 'AI Agent Testing'],
      session_id: 'demo-session'
    });
    console.log(typeResult.content[0].text);
    console.log('');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Evaluate JavaScript on the page
    console.log('📌 Evaluating JavaScript to get input value...');
    const evalResult = await client.callTool('browser_execute', {
      command: 'evaluate',
      args: ['() => document.querySelector("#name-input").value'],
      session_id: 'demo-session'
    });
    console.log(evalResult.content[0].text);
    console.log('');
    
    // Navigate to test endpoint
    console.log('📌 Navigating to /test endpoint...');
    const gotoResult = await client.callTool('browser_execute', {
      command: 'goto',
      args: ['http://localhost:3020/test', { waitUntil: 'networkidle2' }],
      session_id: 'demo-session'
    });
    console.log(gotoResult.content[0].text);
    console.log('');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get page content
    console.log('📌 Getting page text content...');
    const contentResult = await client.callTool('browser_execute', {
      command: 'evaluate',
      args: ['() => document.body.textContent.trim()'],
      session_id: 'demo-session'
    });
    console.log(contentResult.content[0].text);
    console.log('');
    
    // Go back to main page
    console.log('📌 Going back to main page...');
    const backResult = await client.callTool('browser_execute', {
      command: 'goBack',
      session_id: 'demo-session'
    });
    console.log(backResult.content[0].text);
    console.log('');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Take a screenshot
    console.log('📌 Taking a screenshot...');
    const screenshotResult = await client.callTool('browser_execute', {
      command: 'screenshot',
      args: [{ path: 'demo-screenshot.png', fullPage: true }],
      session_id: 'demo-session'
    });
    console.log(screenshotResult.content[0].text);
    console.log('');
    
    // Query logs to see all activity
    console.log('5️⃣  Querying logs to see all activity...');
    const logsResult = await client.callTool('query_logs', {
      session_id: 'demo-session',
      last: '1m',
      limit: 10
    });
    console.log('Recent logs:');
    console.log(logsResult.content[0].text);
    console.log('');
    
    // Keep browser open for 5 seconds
    console.log('⏰ Keeping browser open for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Clean up
    console.log('6️⃣  Cleaning up...');
    await client.callTool('stop_app', {
      session_id: 'demo-session'
    });
    console.log('✅ Session cleaned up\n');
    
    console.log('=' .repeat(50));
    console.log('🎉 Demo complete!');
    console.log('');
    console.log('The browser_execute tool provides complete Puppeteer control:');
    console.log('- Navigation: goto, reload, goBack, goForward');
    console.log('- Interaction: click, type, select, focus, hover');
    console.log('- Evaluation: evaluate, title, url, content');
    console.log('- Waiting: waitForSelector, waitForNavigation');
    console.log('- Screenshots: screenshot, pdf');
    console.log('');
    console.log('This enables AI agents to fully automate web testing!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  } finally {
    await client.disconnect();
    console.log('\n🔌 Disconnected from MCP server');
  }
}

// Run the demo
console.log('');
demoBrowserExecute().catch(console.error);