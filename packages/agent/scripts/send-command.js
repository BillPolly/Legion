#!/usr/bin/env node

import WebSocket from 'ws';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * WebSocket client for sending commands to the Agent server
 */
class AgentClient {
  constructor(options = {}) {
    this.host = options.host || 'localhost';
    this.port = options.port || 3001;
    this.timeout = options.timeout || 30000; // 30 seconds
    this.autoStart = options.autoStart !== false; // Default true
  }

  /**
   * Check if agent server is running
   */
  async isServerRunning() {
    try {
      const pidFile = path.join(__dirname, '..', '.agent.pid');
      const data = await readFile(pidFile, 'utf8');
      const pidData = JSON.parse(data);
      
      // Check if process is still running
      try {
        process.kill(pidData.pid, 0); // Signal 0 just checks if process exists
        return pidData;
      } catch (error) {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Start the agent server if it's not running
   */
  async startServerIfNeeded() {
    const serverInfo = await this.isServerRunning();
    if (serverInfo) {
      return serverInfo;
    }

    if (!this.autoStart) {
      throw new Error('Agent server is not running and auto-start is disabled');
    }

    console.log('Agent server not running, starting...');
    
    return new Promise((resolve, reject) => {
      const serverProcess = spawn('node', [
        path.join(__dirname, '..', 'src', 'cli.js'),
        '--server',
        '--port', this.port.toString(),
        '--host', this.host
      ], {
        detached: true,
        stdio: 'pipe'
      });

      // Wait for server to start
      let startupOutput = '';
      const startupTimeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 10000);

      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        startupOutput += output;
        
        if (output.includes('WebSocket server started')) {
          clearTimeout(startupTimeout);
          serverProcess.unref(); // Allow parent process to exit
          resolve({ pid: serverProcess.pid, port: this.port, host: this.host });
        }
      });

      serverProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        if (errorOutput.includes('Error')) {
          clearTimeout(startupTimeout);
          reject(new Error(`Server startup failed: ${errorOutput}`));
        }
      });

      serverProcess.on('error', (error) => {
        clearTimeout(startupTimeout);
        reject(error);
      });
    });
  }

  /**
   * Send a message to the agent and wait for response
   */
  async sendMessage(message, image = null) {
    // Ensure server is running
    await this.startServerIfNeeded();
    
    // console.log(`Connecting to WebSocket server at ws://${this.host}:${this.port}...`);
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${this.host}:${this.port}`);
      const messageId = Date.now().toString();
      let responseReceived = false;

      // Set timeout
      const timeout = setTimeout(() => {
        if (!responseReceived) {
          console.log('Request timed out, closing connection...');
          ws.close();
          reject(new Error(`Timeout after ${this.timeout}ms`));
        }
      }, this.timeout);

      ws.on('open', () => {
        console.log('WebSocket connection established');
        const messageData = {
          id: messageId,
          type: 'message',
          content: message,
          image: image,
          conversationId: 'client-session'
        };

        console.log(`Sending message: "${message}"`);
        ws.send(JSON.stringify(messageData));
      });

      ws.on('message', (data) => {
        console.log('Received response from server');
        try {
          const response = JSON.parse(data.toString());
          console.log(`Response: ${JSON.stringify(response, null, 2)}`);
          
          if (response.id === messageId) {
            responseReceived = true;
            clearTimeout(timeout);
            ws.close();
            
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.error || 'Unknown error'));
            }
          }
        } catch (error) {
          console.error('Error parsing response:', error);
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${error.message}`));
      });

      ws.on('close', (code, reason) => {
        // Don't log or error on close if we already got a response
        if (!responseReceived) {
          clearTimeout(timeout);
          reject(new Error(`WebSocket closed (${code}): ${reason || 'No response received'}`));
        }
      });
    });
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    host: 'localhost',
    port: 3001,
    timeout: 30000,
    autoStart: true,
    format: 'text', // or 'json'
    help: false
  };
  
  let message = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      switch (arg) {
        case '--host':
          options.host = args[++i];
          break;
        case '--port':
          options.port = parseInt(args[++i]) || 3001;
          break;
        case '--timeout':
          options.timeout = parseInt(args[++i]) || 30000;
          break;
        case '--no-autostart':
          options.autoStart = false;
          break;
        case '--json':
          options.format = 'json';
          break;
        case '--help':
          options.help = true;
          break;
        default:
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
      }
    } else {
      // Treat as message content
      message += (message ? ' ' : '') + arg;
    }
  }

  return { options, message };
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Agent Client - Send commands to jsEnvoy Agent WebSocket server

Usage:
  node send-command.js [options] <message>

Options:
  --host <host>      WebSocket server host (default: localhost)
  --port <port>      WebSocket server port (default: 3001)
  --timeout <ms>     Request timeout in milliseconds (default: 30000)
  --no-autostart     Don't auto-start server if not running
  --json             Output response as JSON
  --help             Show this help message

Examples:
  node send-command.js "What is 2 + 2?"
  node send-command.js --port 8080 "Hello world"
  node send-command.js --json "Calculate the square root of 16"
  node send-command.js --no-autostart "Test message"
  `);
}

/**
 * Main function
 */
async function main() {
  const { options, message } = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!message.trim()) {
    console.error('Error: No message provided');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  try {
    const client = new AgentClient(options);
    const response = await client.sendMessage(message);

    if (options.format === 'json') {
      console.log(JSON.stringify(response, null, 2));
    } else {
      console.log(response.response);
    }
    
    // Small delay to ensure output is flushed, then exit
    setTimeout(() => process.exit(0), 50);

  } catch (error) {
    if (options.format === 'json') {
      console.log(JSON.stringify({ 
        success: false, 
        error: error.message 
      }, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}

export { AgentClient };