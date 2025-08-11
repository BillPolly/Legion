/**
 * Comprehensive tests for EnhancedServerStarter
 * Tests both Node.js and TypeScript servers with Sidewinder monitoring
 */

import { MCPClient } from '../../mcp-client.js';
import path from 'path';

const TEST_TIMEOUT = 30000; // 30 seconds for comprehensive tests

describe('Enhanced Server Starter - Comprehensive Tests', () => {
  let client;
  
  beforeEach(async () => {
    client = new MCPClient();
    await client.connect('node', ['mcp-server.js']);
    await client.initialize({ 
      name: 'enhanced-starter-test', 
      version: '1.0.0' 
    });
    client.sendNotification('notifications/initialized');
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  /**
   * Helper function to verify Sidewinder logs are captured
   */
  async function verifySidewinderLogs(sessionId, testName) {
    console.log(`\n🔍 [${testName}] Verifying Sidewinder logs...`);
    
    const logs = await client.callTool('query_logs', {
      session_id: sessionId,
      limit: 20,
      include_system: true
    });
    
    const logText = logs.content[0].text;
    const logLines = logText.split('\n').filter(line => line.trim());
    
    console.log(`📊 [${testName}] Found ${logLines.length} log entries`);
    
    // Verify we have logs
    expect(logLines.length).toBeGreaterThan(0);
    
    // Check for correlation IDs (indicates Sidewinder is working)
    const correlationLogs = logLines.filter(line => line.includes('correlation-'));
    console.log(`🔗 [${testName}] Found ${correlationLogs.length} correlation logs`);
    
    // Log sample for debugging
    if (logLines.length > 0) {
      console.log(`📋 [${testName}] Sample logs:`);
      logLines.slice(0, 3).forEach(line => console.log(`   ${line}`));
    }
    
    return {
      totalLogs: logLines.length,
      correlationLogs: correlationLogs.length,
      logs: logLines
    };
  }

  /**
   * Helper function to make HTTP requests and verify responses
   */
  async function testServerEndpoints(port, testName, expectedTypeScript = false) {
    console.log(`\n🌐 [${testName}] Testing server endpoints on port ${port}...`);
    
    // Test health endpoint
    const healthResponse = await fetch(`http://localhost:${port}/health`);
    expect(healthResponse.ok).toBe(true);
    const healthData = await healthResponse.json();
    expect(healthData.status).toBe('healthy');
    expect(healthData.correlationId).toMatch(/^correlation-/);
    
    console.log(`✅ [${testName}] Health check OK, correlation: ${healthData.correlationId}`);
    
    // Test root endpoint
    const rootResponse = await fetch(`http://localhost:${port}/`);
    expect(rootResponse.ok).toBe(true);
    const rootData = await rootResponse.json();
    expect(rootData.typescript).toBe(expectedTypeScript);
    expect(rootData.correlationId).toMatch(/^correlation-/);
    
    console.log(`✅ [${testName}] Root endpoint OK, TypeScript: ${rootData.typescript}`);
    
    // Test POST endpoint
    const postResponse = await fetch(`http://localhost:${port}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        data: { message: `Test from ${testName}`, timestamp: new Date().toISOString() }
      })
    });
    expect(postResponse.ok).toBe(true);
    const postData = await postResponse.json();
    expect(postData.processed).toBe(true);
    expect(postData.correlationId).toMatch(/^correlation-/);
    
    console.log(`✅ [${testName}] POST endpoint OK, correlation: ${postData.correlationId}`);
    
    return {
      healthCorrelation: healthData.correlationId,
      rootCorrelation: rootData.correlationId,
      postCorrelation: postData.correlationId
    };
  }

  describe('Node.js Server Tests', () => {
    test('should start Node.js server with direct script', async () => {
      const sessionId = 'nodejs-direct-test';
      const scriptPath = path.resolve('__tests__/apps/simple-node-server.js');
      
      console.log(`\n🧪 Testing Node.js direct script: ${scriptPath}`);
      
      // Start server
      const result = await client.callTool('start_server', {
        script: scriptPath,
        wait_for_port: 3008,
        session_id: sessionId,
        log_level: 'info'
      });
      
      expect(result.content[0].text).toMatch(/✅ Started server/);
      expect(result.content[0].text).toMatch(/Port: 3008/);
      console.log(`🚀 Server started successfully`);
      
      // Wait for server to fully initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test endpoints
      const correlations = await testServerEndpoints(3008, 'Node.js Direct', false);
      
      // Wait for logs to be captured
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify Sidewinder logs
      const logStats = await verifySidewinderLogs(sessionId, 'Node.js Direct');
      expect(logStats.totalLogs).toBeGreaterThan(0);
      expect(logStats.correlationLogs).toBeGreaterThan(0);
      
      // Stop server
      await client.callTool('stop_app', { session_id: sessionId });
      console.log(`✅ Server stopped and cleaned up`);
      
    }, TEST_TIMEOUT);

    test('should start Node.js server with package.json start script', async () => {
      const sessionId = 'nodejs-package-test';
      const packagePath = path.resolve('__tests__/apps');
      
      console.log(`\n🧪 Testing Node.js package.json start script in: ${packagePath}`);
      
      // Start server using package.json start script
      const result = await client.callTool('start_server', {
        package_path: packagePath,
        start_script: 'start',
        wait_for_port: 3008,
        session_id: sessionId,
        log_level: 'info'
      });
      
      expect(result.content[0].text).toMatch(/✅ Started server/);
      expect(result.content[0].text).toMatch(/npm run start/);
      console.log(`🚀 Server started via package.json script`);
      
      // Wait for server to fully initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test endpoints
      const correlations = await testServerEndpoints(3008, 'Node.js Package', false);
      
      // Wait for logs to be captured
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify Sidewinder logs
      const logStats = await verifySidewinderLogs(sessionId, 'Node.js Package');
      expect(logStats.totalLogs).toBeGreaterThan(0);
      expect(logStats.correlationLogs).toBeGreaterThan(0);
      
      // Stop server
      await client.callTool('stop_app', { session_id: sessionId });
      console.log(`✅ Server stopped and cleaned up`);
      
    }, TEST_TIMEOUT);
  });

  describe('TypeScript Server Tests', () => {
    test('should start TypeScript server with direct script', async () => {
      const sessionId = 'typescript-direct-test';
      const scriptPath = path.resolve('__tests__/apps/typescript-server.ts');
      
      console.log(`\n🧪 Testing TypeScript direct script: ${scriptPath}`);
      
      // Start server
      const result = await client.callTool('start_server', {
        script: scriptPath,
        wait_for_port: 3009,
        session_id: sessionId,
        log_level: 'info'
      });
      
      expect(result.content[0].text).toMatch(/✅ Started server/);
      expect(result.content[0].text).toMatch(/Port: 3009/);
      console.log(`🚀 TypeScript server started successfully`);
      
      // Wait for server to fully initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test endpoints
      const correlations = await testServerEndpoints(3009, 'TypeScript Direct', true);
      
      // Wait for logs to be captured
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify Sidewinder logs
      const logStats = await verifySidewinderLogs(sessionId, 'TypeScript Direct');
      expect(logStats.totalLogs).toBeGreaterThan(0);
      expect(logStats.correlationLogs).toBeGreaterThan(0);
      
      // Stop server
      await client.callTool('stop_app', { session_id: sessionId });
      console.log(`✅ TypeScript server stopped and cleaned up`);
      
    }, TEST_TIMEOUT);

    test('should start TypeScript server with package.json dev script', async () => {
      const sessionId = 'typescript-package-test';
      const packagePath = path.resolve('__tests__/apps');
      
      console.log(`\n🧪 Testing TypeScript package.json dev script in: ${packagePath}`);
      
      // Start server using package.json dev script
      const result = await client.callTool('start_server', {
        package_path: packagePath,
        start_script: 'ts-dev',
        wait_for_port: 3009,
        session_id: sessionId,
        log_level: 'info'
      });
      
      expect(result.content[0].text).toMatch(/✅ Started server/);
      expect(result.content[0].text).toMatch(/npm run ts-dev/);
      console.log(`🚀 TypeScript server started via package.json script`);
      
      // Wait for server to fully initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test endpoints
      const correlations = await testServerEndpoints(3009, 'TypeScript Package', true);
      
      // Wait for logs to be captured
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify Sidewinder logs
      const logStats = await verifySidewinderLogs(sessionId, 'TypeScript Package');
      expect(logStats.totalLogs).toBeGreaterThan(0);
      expect(logStats.correlationLogs).toBeGreaterThan(0);
      
      // Stop server
      await client.callTool('stop_app', { session_id: sessionId });
      console.log(`✅ TypeScript server stopped and cleaned up`);
      
    }, TEST_TIMEOUT);
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing script file gracefully', async () => {
      const sessionId = 'missing-script-test';
      
      console.log(`\n🧪 Testing missing script file handling`);
      
      const result = await client.callTool('start_server', {
        script: '/path/to/nonexistent-script.js',
        session_id: sessionId,
        log_level: 'info'
      });
      
      expect(result.content[0].text).toMatch(/❌ Failed to start server/);
      expect(result.content[0].text).toMatch(/Script file not found/);
      console.log(`✅ Missing script handled correctly`);
      
    }, TEST_TIMEOUT);

    test('should handle missing package.json gracefully', async () => {
      const sessionId = 'missing-package-test';
      
      console.log(`\n🧪 Testing missing package.json handling`);
      
      const result = await client.callTool('start_server', {
        package_path: '/path/to/nonexistent/package',
        start_script: 'start',
        session_id: sessionId,
        log_level: 'info'
      });
      
      expect(result.content[0].text).toMatch(/❌ Failed to start server/);
      console.log(`✅ Missing package.json handled correctly`);
      
    }, TEST_TIMEOUT);

    test('should handle process already running for session', async () => {
      const sessionId = 'duplicate-session-test';
      const scriptPath = path.resolve('__tests__/apps/simple-node-server.js');
      
      console.log(`\n🧪 Testing duplicate session handling`);
      
      // Start first server
      const result1 = await client.callTool('start_server', {
        script: scriptPath,
        wait_for_port: 3008,
        session_id: sessionId,
        log_level: 'info'
      });
      
      expect(result1.content[0].text).toMatch(/✅ Started server/);
      console.log(`🚀 First server started`);
      
      // Try to start second server with same session ID
      const result2 = await client.callTool('start_server', {
        script: scriptPath,
        wait_for_port: 3008,
        session_id: sessionId,
        log_level: 'info'
      });
      
      expect(result2.content[0].text).toMatch(/⚠️ Server already running/);
      console.log(`✅ Duplicate session handled correctly`);
      
      // Clean up
      await client.callTool('stop_app', { session_id: sessionId });
      console.log(`✅ Server stopped and cleaned up`);
      
    }, TEST_TIMEOUT);
  });

  describe('Mixed Scenarios', () => {
    test('should handle multiple servers simultaneously', async () => {
      const nodeSessionId = 'multi-node-test';
      const tsSessionId = 'multi-ts-test';
      
      console.log(`\n🧪 Testing multiple servers simultaneously`);
      
      // Start Node.js server
      const nodeResult = await client.callTool('start_server', {
        script: path.resolve('__tests__/apps/simple-node-server.js'),
        wait_for_port: 3008,
        session_id: nodeSessionId,
        log_level: 'info'
      });
      
      expect(nodeResult.content[0].text).toMatch(/✅ Started server/);
      console.log(`🚀 Node.js server started`);
      
      // Start TypeScript server
      const tsResult = await client.callTool('start_server', {
        script: path.resolve('__tests__/apps/typescript-server.ts'),
        wait_for_port: 3009,
        session_id: tsSessionId,
        log_level: 'info'
      });
      
      expect(tsResult.content[0].text).toMatch(/✅ Started server/);
      console.log(`🚀 TypeScript server started`);
      
      // Wait for both servers to initialize
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Test both servers
      await testServerEndpoints(3008, 'Multi Node.js', false);
      await testServerEndpoints(3009, 'Multi TypeScript', true);
      
      // Wait for logs
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify logs for both
      const nodeLogStats = await verifySidewinderLogs(nodeSessionId, 'Multi Node.js');
      const tsLogStats = await verifySidewinderLogs(tsSessionId, 'Multi TypeScript');
      
      expect(nodeLogStats.totalLogs).toBeGreaterThan(0);
      expect(tsLogStats.totalLogs).toBeGreaterThan(0);
      
      // Clean up both
      await client.callTool('stop_app', { session_id: nodeSessionId });
      await client.callTool('stop_app', { session_id: tsSessionId });
      console.log(`✅ Both servers stopped and cleaned up`);
      
    }, TEST_TIMEOUT);
  });
});