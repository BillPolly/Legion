#!/usr/bin/env node

/**
 * Server Stop Script - Stop managed Aiur server
 */

import { ServerManager } from '../src/client/ServerManager.js';

async function stopServer() {
  console.log('🛑 Stopping Aiur Server\n');
  
  try {
    const serverManager = new ServerManager({
      host: process.env.AIUR_SERVER_HOST || 'localhost',
      port: parseInt(process.env.AIUR_SERVER_PORT) || 8080,
      verbose: true
    });

    // Check status first
    const status = await serverManager.getServerStatus();
    
    if (!status.summary.running) {
      console.log('ℹ️ Server is not currently running');
      
      if (status.launcher.pid) {
        console.log(`⚠️ Found stale PID ${status.launcher.pid}, attempting cleanup...`);
      } else {
        console.log('✅ Nothing to stop');
        process.exit(0);
      }
    }

    // Attempt to stop the server
    const stopped = await serverManager.stopServer();
    
    if (stopped) {
      console.log('✅ Server stopped successfully');
      process.exit(0);
    } else {
      console.log('⚠️ Server stop command completed but status unclear');
      
      // Check final status
      const finalStatus = await serverManager.getServerStatus();
      if (!finalStatus.summary.running) {
        console.log('✅ Server is now stopped');
        process.exit(0);
      } else {
        console.log('❌ Server appears to still be running');
        console.log('💡 Try: npm run server:status for more details');
        process.exit(1);
      }
    }

  } catch (error) {
    console.error(`❌ Failed to stop server: ${error.message}`);
    console.log('💡 Try checking server status: npm run server:status');
    process.exit(1);
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Aiur Server Stop');
  console.log('');
  console.log('Usage: npm run server:stop');
  console.log('');
  console.log('Stops the managed Aiur server process if running.');
  console.log('');
  console.log('Environment Variables:');
  console.log('  AIUR_SERVER_HOST     Server host (default: localhost)');
  console.log('  AIUR_SERVER_PORT     Server port (default: 8080)');
  console.log('');
  console.log('Exit Codes:');
  console.log('  0    Server stopped successfully');
  console.log('  1    Error occurred or server could not be stopped');
  process.exit(0);
}

stopServer();