#!/usr/bin/env node

/**
 * Server Restart Script - Restart Aiur server
 */

import { ServerManager } from '../src/client/ServerManager.js';

async function restartServer() {
  console.log('🔄 Restarting Aiur Server\n');
  
  try {
    const serverManager = new ServerManager({
      host: process.env.AIUR_SERVER_HOST || 'localhost',
      port: parseInt(process.env.AIUR_SERVER_PORT) || 8080,
      verbose: true,
      autoLaunch: true,
      independent: true
    });

    // Check initial status
    console.log('📊 Checking current server status...');
    const initialStatus = await serverManager.getServerStatus();
    
    if (initialStatus.summary.running) {
      console.log(`✅ Server currently running (PID: ${initialStatus.summary.pid})`);
    } else {
      console.log('ℹ️ Server not currently running');
    }

    // Perform restart
    const result = await serverManager.restartServer();
    
    console.log('\n🎉 Server restart completed!');
    console.log(`📍 Server: ${result.serverInfo.server} v${result.serverInfo.version}`);
    console.log(`🌐 Address: http://${result.serverInfo.host}:${result.serverInfo.port}`);
    console.log(`🔗 WebSocket: ws://${result.serverInfo.host}:${result.serverInfo.port}/ws`);
    
    if (result.launchInfo) {
      console.log(`🚀 Process: PID ${result.launchInfo.pid} (${result.launchInfo.independent ? 'independent' : 'managed'})`);
    }

    // Verify final status
    console.log('\n🔍 Verifying server health...');
    const finalStatus = await serverManager.getServerStatus();
    
    if (finalStatus.summary.healthy) {
      console.log('✅ Server is healthy and ready');
      process.exit(0);
    } else {
      console.log('⚠️ Server restarted but health check failed');
      console.log('💡 Try: npm run server:status for details');
      process.exit(1);
    }

  } catch (error) {
    console.error(`❌ Server restart failed: ${error.message}`);
    console.log('💡 Try: npm run server:status to check current state');
    process.exit(1);
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Aiur Server Restart');
  console.log('');
  console.log('Usage: npm run server:restart');
  console.log('');
  console.log('Stops the current server (if running) and starts a new one.');
  console.log('');
  console.log('Environment Variables:');
  console.log('  AIUR_SERVER_HOST     Server host (default: localhost)');
  console.log('  AIUR_SERVER_PORT     Server port (default: 8080)');
  console.log('');
  console.log('Exit Codes:');
  console.log('  0    Server restarted successfully');
  console.log('  1    Error occurred during restart');
  process.exit(0);
}

restartServer();