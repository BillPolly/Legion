/**
 * Complete Fullstack MCP Test - Backend + Browser logs via MCP interface
 * Tests the entire workflow: start_app → open_page → query_logs → browser_execute
 */

import { FullStackMonitor } from '@legion/fullstack-monitor';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Complete Fullstack MCP Integration', () => {
  let resourceManager;
  let monitor;
  
  beforeEach(async () => {
    resourceManager = await ResourceManager.getInstance();
    monitor = await FullStackMonitor.create(resourceManager);
  });
  
  afterEach(async () => {
    if (monitor) {
      await monitor.cleanup();
    }
  });
  
  test('should capture both backend and browser logs in unified stream', async () => {
    const testScript = path.join(__dirname, 'fullstack-test-app.js');
    
    console.log('🚀 Starting fullstack monitoring test...');
    
    // 1. Start backend monitoring
    console.log('📱 Step 1: Starting backend app monitoring...');
    const backendConfig = {
      backend: {
        script: testScript,
        name: 'fullstack-test',
        port: 3099
      }
    };
    
    await monitor.monitorFullStackApp(backendConfig);
    console.log('✅ Backend monitoring started');
    
    // Wait for backend to generate initial logs
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. Open browser page with monitoring
    console.log('🌐 Step 2: Opening browser page with monitoring...');
    if (!monitor.browser) {
      await monitor.launch({ headless: false }); // Use visible browser for testing
    }
    
    const pageInfo = await monitor.monitorPage('http://localhost:3099', 'fullstack-test');
    console.log('✅ Browser page opened and monitoring injected');
    
    // Wait for page to load and generate browser logs
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // 3. Execute browser commands to generate more logs
    console.log('🖱️ Step 3: Executing browser commands...');
    await monitor.executeBrowserCommand('fullstack-test', 'click', ['#logBtn']);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await monitor.executeBrowserCommand('fullstack-test', 'click', ['#errorBtn']);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. Query unified log stream
    console.log('📋 Step 4: Querying unified log stream...');
    const sidewinderLogs = await monitor.logStore.getRecentAgentLogs('sidewinder', 50);
    const browserLogs = await monitor.logStore.getRecentAgentLogs('browser', 50);
    const allLogs = [...sidewinderLogs, ...browserLogs];
    allLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    console.log('📊 Log capture results:');
    console.log(`  - Backend (Sidewinder) logs: ${sidewinderLogs.length}`);
    console.log(`  - Frontend (Browser) logs: ${browserLogs.length}`);
    console.log(`  - Total unified logs: ${allLogs.length}`);
    
    // Print all logs for verification
    if (allLogs.length > 0) {
      console.log('📋 Complete unified log stream:');
      allLogs.forEach((log, i) => {
        console.log(`  ${i+1}. [${log.timestamp}] [${log.agentType}] ${log.level}: ${log.message}`);
      });
    }
    
    // Verify we have both backend and browser logs
    expect(sidewinderLogs.length).toBeGreaterThan(0);
    expect(browserLogs.length).toBeGreaterThan(0);
    expect(allLogs.length).toBeGreaterThan(sidewinderLogs.length); // Total should include both
    
    // Verify backend log content
    const backendLogText = sidewinderLogs.map(log => log.message).join(' ');
    expect(backendLogText).toContain('FULLSTACK TEST');
    
    // Verify browser log content  
    const browserLogText = browserLogs.map(log => log.message).join(' ');
    expect(browserLogText).toContain('BROWSER TEST');
    
    // Verify different log levels are captured
    const levels = allLogs.map(log => log.level);
    expect(levels).toContain('log');
    expect(levels).toContain('warn');
    expect(levels).toContain('error');
    
    console.log('🎉 SUCCESS: Complete fullstack monitoring working!');
    
  }, 60000);
});