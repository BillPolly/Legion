#!/usr/bin/env node

/**
 * Server Status Script - Check Aiur server status
 */

import { ServerManager } from '../src/client/ServerManager.js';

async function checkServerStatus() {
  console.log('🔍 Aiur Server Status Check\n');
  
  try {
    const serverManager = new ServerManager({
      host: process.env.AIUR_SERVER_HOST || 'localhost',
      port: parseInt(process.env.AIUR_SERVER_PORT) || 8080,
      verbose: false // Don't show launch messages
    });

    const status = await serverManager.getServerStatus();

    // Display summary
    console.log('📊 Status Summary:');
    console.log(`   Running: ${status.summary.running ? '✅ Yes' : '❌ No'}`);
    console.log(`   Healthy: ${status.summary.healthy ? '✅ Yes' : '❌ No'}`);
    console.log(`   Managed: ${status.summary.managed ? '✅ Yes' : '❌ No'}`);
    if (status.summary.pid) {
      console.log(`   PID: ${status.summary.pid}`);
    }

    // Display connection info
    console.log('\n🔗 Connection Info:');
    console.log(`   WebSocket: ${status.summary.connectionUrl}`);
    console.log(`   Health Check: ${status.summary.healthUrl}`);

    // Display detector details
    if (status.detector.running) {
      console.log('\n📡 Server Details:');
      const info = status.detector.serverInfo;
      console.log(`   Server: ${info.server} v${info.version}`);
      console.log(`   Mode: ${info.mode || 'Standard'}`);
      console.log(`   Uptime: ${info.uptime ? Math.round(info.uptime) + 's' : 'Unknown'}`);
      console.log(`   Sessions: ${info.sessions || 0}`);
      console.log(`   Connections: ${info.connections || 0}`);
    } else {
      console.log('\n❌ Server Not Running');
      if (status.detector.portInUse) {
        console.log('   ⚠️ Port is in use by another process');
      }
      if (status.detector.error) {
        console.log(`   Error: ${status.detector.error}`);
      }
    }

    // Display launcher details  
    if (status.launcher.running) {
      console.log('\n🚀 Process Management:');
      console.log(`   Status: ${status.launcher.message}`);
      console.log(`   PID File: ${status.launcher.pidFile}`);
    } else if (status.launcher.pid) {
      console.log('\n⚠️ Process Management:');
      console.log(`   Status: ${status.launcher.message}`);
    }

    // Exit code based on health
    process.exit(status.summary.running ? 0 : 1);

  } catch (error) {
    console.error(`❌ Status check failed: ${error.message}`);
    process.exit(1);
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Aiur Server Status Check');
  console.log('');
  console.log('Usage: npm run server:status');
  console.log('');
  console.log('Environment Variables:');
  console.log('  AIUR_SERVER_HOST     Server host (default: localhost)');
  console.log('  AIUR_SERVER_PORT     Server port (default: 8080)');
  console.log('');
  console.log('Exit Codes:');
  console.log('  0    Server is running and healthy');
  console.log('  1    Server is not running or error occurred');
  process.exit(0);
}

checkServerStatus();