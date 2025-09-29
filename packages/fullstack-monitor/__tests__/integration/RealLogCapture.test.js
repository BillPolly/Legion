/**
 * REAL FullStackMonitor log capture test - NO MOCKS
 * Tests if logs are actually captured end-to-end
 */

import { FullStackMonitor } from '@legion/fullstack-monitor';
import { ResourceManager } from '@legion/resource-manager';
import { promises as fs } from 'fs';
import path from 'path';

describe('Real FullStackMonitor Log Capture', () => {
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
  
  test('should capture logs from real Node.js process', async () => {
    // Create test script that outputs logs
    const testScript = path.join(process.cwd(), 'test-real-logs.cjs');
    await fs.writeFile(testScript, `
const http = require('http');

console.log('REAL TEST: Server starting...');
console.warn('REAL TEST: Warning message'); 
console.error('REAL TEST: Error message');

const server = http.createServer((req, res) => {
  console.log('REAL TEST: Request received');
  res.end('OK');
});

server.listen(3097, () => {
  console.log('REAL TEST: Server listening on port 3097');
  
  // Generate more logs
  setTimeout(() => {
    console.log('REAL TEST: Delayed log 1');
    console.warn('REAL TEST: Delayed warning');
    console.error('REAL TEST: Delayed error');
  }, 1000);
  
  setTimeout(() => {
    console.log('REAL TEST: Delayed log 2');
  }, 2000);
});
`);
    
    try {
      console.log('🚀 Starting FullStackMonitor with real backend...');
      
      // Start monitoring with FullStackMonitor
      const config = {
        backend: {
          script: testScript,
          name: 'real-test-backend',
          port: 3097
        }
      };
      
      const app = await monitor.monitorFullStackApp(config);
      expect(app).toBeDefined();
      
      console.log('✅ FullStackMonitor started, waiting for logs...');
      
      // Wait for logs to be generated and captured
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Make request to generate more logs
      try {
        const response = await fetch('http://localhost:3097/test');
        console.log('📡 Made request to test app');
      } catch (e) {
        console.log('📡 Request attempted (connection may be expected)');
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if logs were captured by LogStore
      console.log('🔍 Checking LogStore for captured logs...');
      
      const sidewinderLogs = await monitor.logStore.getRecentAgentLogs('sidewinder', 50);
      const browserLogs = await monitor.logStore.getRecentAgentLogs('browser', 50);
      const allLogs = [...sidewinderLogs, ...browserLogs];
      
      console.log('📊 Log capture results:');
      console.log(`  - Sidewinder logs: ${sidewinderLogs.length}`);
      console.log(`  - Browser logs: ${browserLogs.length}`);
      console.log(`  - Total logs: ${allLogs.length}`);
      
      // Print captured logs for debugging
      if (allLogs.length > 0) {
        console.log('📋 Captured logs:');
        allLogs.forEach((log, i) => {
          console.log(`  ${i+1}. [${log.timestamp}] [${log.agentType || 'unknown'}] ${log.level}: ${log.message}`);
        });
      } else {
        console.log('❌ NO LOGS CAPTURED AT ALL!');
        
        // Debug info
        console.log('🔍 Debug info:');
        console.log('  - LogStore exists:', !!monitor.logStore);
        console.log('  - Session:', monitor.logStore?.getCurrentSession());
        console.log('  - Active backends:', monitor.activeBackends?.size || 0);
        console.log('  - Sidewinder clients:', monitor.sidewinderClients?.size || 0);
      }
      
      // The test should capture logs
      expect(allLogs.length).toBeGreaterThan(0);
      
      // Verify log content
      const logText = allLogs.map(log => log.message || '').join(' ');
      expect(logText).toContain('REAL TEST');
      
    } finally {
      // Clean up
      try {
        await fs.unlink(testScript);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }, 45000);
});