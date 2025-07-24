#!/usr/bin/env node

/**
 * Server Launch Script - Launch Aiur server manually
 */

import { ServerManager } from '../src/client/ServerManager.js';

async function launchServer() {
  console.log('🚀 Launching Aiur Server\n');
  
  try {
    const independent = process.argv.includes('--child') ? false : true;
    const force = process.argv.includes('--force');
    
    if (!independent) {
      console.log('📋 Mode: Child process (will exit when script ends)');
    } else {
      console.log('📋 Mode: Independent process (survives script exit)');
    }
    
    const serverManager = new ServerManager({
      host: process.env.AIUR_SERVER_HOST || 'localhost',
      port: parseInt(process.env.AIUR_SERVER_PORT) || 8080,
      verbose: true,
      autoLaunch: true,
      independent
    });

    // Check if server is already running
    if (!force) {
      console.log('🔍 Checking if server is already running...');
      const existingServer = await serverManager.detector.isServerRunning();
      
      if (existingServer) {
        console.log('✅ Server is already running!');
        console.log(`📍 Server: ${existingServer.server} v${existingServer.version}`);
        console.log(`🌐 Address: http://${existingServer.host}:${existingServer.port}`);
        console.log('💡 Use --force to launch anyway or npm run server:restart to restart');
        process.exit(0);
      }
    }

    // Launch the server
    const result = await serverManager.launcher.launchIndependent();
    
    console.log('\n🎉 Server launched successfully!');
    console.log(`🚀 Process: PID ${result.pid} (${result.independent ? 'independent' : 'child'})`);
    console.log(`📁 PID File: ${result.pidFile}`);
    console.log(`⏰ Started: ${result.startedAt}`);

    // Wait for server to be ready
    console.log('\n⏳ Waiting for server to be ready...');
    const serverInfo = await serverManager.waitForServerReady();
    
    console.log('✅ Server is ready and healthy!');
    console.log(`📍 Server: ${serverInfo.server} v${serverInfo.version}`);
    console.log(`🌐 HTTP: http://${serverInfo.host}:${serverInfo.port}`);
    console.log(`🔗 WebSocket: ws://${serverInfo.host}:${serverInfo.port}/ws`);
    console.log(`💊 Health: http://${serverInfo.host}:${serverInfo.port}/health`);

    if (independent) {
      console.log('\n📝 Server Management:');
      console.log('   Status:  npm run server:status');
      console.log('   Stop:    npm run server:stop');
      console.log('   Restart: npm run server:restart');
    } else {
      console.log('\n⚠️ Server running as child process');
      console.log('   Server will exit when this script ends');
      console.log('   Press Ctrl+C to stop the server');
      
      // Keep script alive for child process
      process.on('SIGINT', () => {
        console.log('\n🛑 Stopping server...');
        process.exit(0);
      });
      
      process.on('SIGTERM', () => {
        console.log('\n🛑 Stopping server...');
        process.exit(0);
      });
      
      // Keep the process alive
      setInterval(() => {}, 1000);
    }

  } catch (error) {
    console.error(`❌ Server launch failed: ${error.message}`);
    
    // Show diagnostic info
    try {
      const serverManager = new ServerManager({ verbose: false });
      const validation = await serverManager.validateEnvironment();
      
      if (!validation.valid) {
        console.log('\n🔍 Environment Issues:');
        validation.issues.forEach(issue => {
          console.log(`   ❌ ${issue}`);
        });
      }
      
      if (validation.warnings.length > 0) {
        console.log('\n⚠️ Warnings:');
        validation.warnings.forEach(warning => {
          console.log(`   ⚠️ ${warning}`);
        });
      }
    } catch (diagError) {
      // Ignore diagnostic errors
    }
    
    process.exit(1);
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Aiur Server Launch');
  console.log('');
  console.log('Usage: npm run server:launch [options]');
  console.log('');
  console.log('Options:');
  console.log('  --child     Launch as child process (exits with script)');
  console.log('  --force     Launch even if server is already running');
  console.log('  --help, -h  Show this help message');
  console.log('');
  console.log('Environment Variables:');
  console.log('  AIUR_SERVER_HOST     Server host (default: localhost)');
  console.log('  AIUR_SERVER_PORT     Server port (default: 8080)');
  console.log('');
  console.log('Exit Codes:');
  console.log('  0    Server launched successfully');
  console.log('  1    Error occurred during launch');
  process.exit(0);
}

launchServer();