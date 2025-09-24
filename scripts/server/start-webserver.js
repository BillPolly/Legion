#!/usr/bin/env node

/**
* Script to start the Legion web server with automatic port cleanup
 * Usage: node scripts/start-webserver.js [port] [--force-kill] [--browser] [--no-browser]
 * Example: node scripts/start-webserver.js
 * Example: node scripts/start-webserver.js 8080
 * Example: node scripts/start-webserver.js 3000 --force-kill --browser
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

async function killProcessesOnPort(port, force = false) {
  console.log(`🧹 Cleaning up port ${port}...`);
  
  try {
    const killScript = path.join(__dirname, 'kill-port.js');
    const args = [killScript, port.toString()];
    if (force) args.push('--force');
    
    const { stdout, stderr } = await execAsync(`node ${args.join(' ')}`);
    
    if (stdout) {
      // Filter out the summary lines to reduce noise
      const lines = stdout.split('\n').filter(line => 
        !line.includes('📊 Summary:') && 
        !line.includes('Processes found:') && 
        !line.includes('Kill signals sent:') &&
        line.trim() !== ''
      );
      if (lines.length > 0) {
        console.log(lines.join('\n'));
      }
    }
    
    return true;
  } catch (error) {
    console.error(`⚠️  Error cleaning port ${port}:`, error.message);
    return false;
  }
}

async function openBrowser(url) {
  try {
    const platform = process.platform;
    let command;
    
    if (platform === 'darwin') {
      command = `open "${url}"`;
    } else if (platform === 'win32') {
      command = `start "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }
    
    await execAsync(command);
    console.log(`🌐 Opened browser to ${url}`);
  } catch (error) {
    console.log(`💡 Open your browser to: ${url}`);
  }
}

function startServer(port, packagePath) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Starting web server on port ${port}...`);
    console.log(`📁 Package: ${packagePath}`);
    console.log('');
    
    // Spawn the server process
    const serverProcess = spawn('node', ['src/server.js'], {
      cwd: packagePath,
      stdio: 'inherit',
      env: { ...process.env, PORT: port.toString() }
    });
    
    // Handle server startup
    let serverStarted = false;
    const startupTimeout = setTimeout(() => {
      if (!serverStarted) {
        console.log('✅ Server should be running now');
        serverStarted = true;
        resolve(serverProcess);
      }
    }, 2000);
    
    serverProcess.on('error', (error) => {
      clearTimeout(startupTimeout);
      reject(new Error(`Failed to start server: ${error.message}`));
    });
    
    serverProcess.on('exit', (code, signal) => {
      clearTimeout(startupTimeout);
      if (code === 0) {
        console.log('\n✅ Server stopped gracefully');
      } else if (signal) {
        console.log(`\n🛑 Server stopped by signal: ${signal}`);
      } else {
        console.log(`\n❌ Server exited with code: ${code}`);
      }
    });
    
    // Handle process termination signals
    const cleanup = () => {
      console.log('\n🛑 Shutting down server...');
      serverProcess.kill('SIGTERM');
      
      // Force kill after 5 seconds if it doesn't exit gracefully
      setTimeout(() => {
        if (!serverProcess.killed) {
          console.log('⚡ Force killing server...');
          serverProcess.kill('SIGKILL');
        }
      }, 5000);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let port = 3000;
  let forceKill = false;
  let openBrowserFlag = false;
  
  for (const arg of args) {
    if (arg === '--force-kill') {
      forceKill = true;
    } else if (arg === '--browser') {
      openBrowserFlag = true;
    } else if (arg === '--no-browser') {
      openBrowserFlag = false;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/start-webserver.js [port] [--force-kill] [--browser] [--no-browser]');
      console.log('');
      console.log('Options:');
      console.log('  port         Port number to run server on (default: 3000)');
      console.log('  --force-kill Force kill any existing processes on the port');
      console.log('  --browser    Open browser automatically (default: false)');
      console.log('  --no-browser Skip automatically opening browser');
      console.log('');
      console.log('Examples:');
      console.log('  node scripts/start-webserver.js');
      console.log('  node scripts/start-webserver.js 8080');
      console.log('  node scripts/start-webserver.js 3000 --force-kill --browser');
      process.exit(0);
    } else {
      const portNum = parseInt(arg, 10);
      if (!isNaN(portNum) && portNum >= 1 && portNum <= 65535) {
        port = portNum;
      } else {
        console.error(`❌ Invalid port number: ${arg}`);
        process.exit(1);
      }
    }
  }
  
console.log('🌐 Legion Web Server Starter');
  console.log('============================');
  console.log(`📡 Port: ${port}`);
  console.log(`🧹 Force kill: ${forceKill ? 'yes' : 'no'}`);
  console.log(`🌐 Open browser: ${openBrowserFlag ? 'yes' : 'no'}`);
  console.log('');
  
  // Find the web-backend package
  const backendPath = path.join(rootDir, 'packages', 'apps', 'web-backend');
  
  try {
    // Check if backend package exists
    const { stdout } = await execAsync(`ls "${backendPath}"`);
    if (!stdout.includes('src')) {
      throw new Error('Backend package structure invalid (missing src directory)');
    }
  } catch (error) {
    console.error('❌ Web backend package not found or invalid');
    console.error(`   Expected location: ${backendPath}`);
    console.error(`   Error: ${error.message}`);
    console.error('');
    console.error('💡 Make sure you have run the setup to create the web applications');
    process.exit(1);
  }
  
  // Kill any existing processes on the port
  await killProcessesOnPort(port, forceKill);
  
  // Wait a moment for cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    // Start the server
    const serverProcess = await startServer(port, backendPath);
    
    // Wait a moment for server to fully start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Open browser if requested
    if (openBrowserFlag) {
      await openBrowser(`http://localhost:${port}`);
    } else {
      console.log('');
      console.log('🌐 Server is running!');
      console.log(`   Chat Interface: http://localhost:${port}`);
      console.log(`   Health Check: http://localhost:${port}/health`);
      console.log(`   API Stats: http://localhost:${port}/api/stats`);
      console.log('');
      console.log('Press Ctrl+C to stop the server');
    }
    
    // Keep the process alive
    await new Promise(() => {}); // Wait forever
    
  } catch (error) {
    console.error('❌ Failed to start web server:', error.message);
    process.exit(1);
  }
}

// Handle script errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});