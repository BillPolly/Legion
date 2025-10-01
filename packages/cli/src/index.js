#!/usr/bin/env node

/**
 * Legion CLI - Entry Point
 *
 * Supports 4 modes of operation:
 * 1. Interactive (default) - stdin/readline REPL
 * 2. Server - background server with WebSocket/HTTP API
 * 3. Remote Client - connect to remote CLI server
 * 4. Web UI - browser terminal (future)
 *
 * Usage:
 *   legion                         # Interactive mode (default)
 *   legion --server                # Server mode
 *   legion --connect <url>         # Remote client mode
 *   legion --help                  # Show help
 */

import { CLI } from './CLI.js';
import { CLIServer } from './server/CLIServer.js';
import { RemoteCLIClient } from './client/RemoteCLIClient.js';
import { ResourceManager } from '@legion/resource-manager';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: 'interactive',
    port: 3700,
    serverUrl: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--server') {
      options.mode = 'server';
    } else if (arg === '--connect') {
      options.mode = 'client';
      options.serverUrl = args[++i];
    } else if (arg === '--port' || arg === '-p') {
      options.port = parseInt(args[++i], 10);
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }

  return options;
}

// Show help
function showHelp() {
  console.log(`
Legion CLI - Multi-mode Command Line Interface

Usage:
  legion [options]

Modes:
  (default)                Interactive mode - stdin/readline REPL
  --server                 Server mode - background WebSocket/HTTP API server
  --connect <url>          Remote client mode - connect to CLI server

Options:
  --port <port>, -p        Port to use (default: 3700 for interactive/server, 4000 for server mode)
  --help, -h              Show this help

Examples:
  legion                              # Start interactive CLI
  legion --server --port 4000         # Start CLI server on port 4000
  legion --connect ws://localhost:4000 # Connect to remote CLI server

For more information, see: https://github.com/legion/cli
  `);
}

// Main entry point
async function main() {
  const options = parseArgs();
  let instance;

  try {
    // Get ResourceManager singleton
    const resourceManager = await ResourceManager.getInstance();

    // Mode 1: Interactive
    if (options.mode === 'interactive') {
      instance = new CLI(resourceManager, {
        port: options.port,
        prompt: 'legion> ',
        historySize: 1000,
        useColors: true,
        showStackTrace: true
      });

      await instance.initialize();
      await instance.start();
    }

    // Mode 2: Server
    else if (options.mode === 'server') {
      const serverPort = options.port === 3700 ? 4000 : options.port;
      instance = new CLIServer({
        port: serverPort,
        showmePort: 3700
      });

      await instance.initialize();
      await instance.start();

      console.log(`\nCLI Server running on port ${serverPort}`);
      console.log(`Connect with: legion --connect ws://localhost:${serverPort}\n`);
    }

    // Mode 3: Remote Client
    else if (options.mode === 'client') {
      if (!options.serverUrl) {
        console.error('Error: --connect requires a server URL');
        process.exit(1);
      }

      // Ensure WebSocket URL format
      let serverUrl = options.serverUrl;
      if (!serverUrl.startsWith('ws://') && !serverUrl.startsWith('wss://')) {
        serverUrl = `ws://${serverUrl}`;
      }
      if (!serverUrl.includes('/ws?route=')) {
        serverUrl = `${serverUrl}/ws?route=/cli`;
      }

      instance = new RemoteCLIClient({
        serverUrl,
        prompt: 'legion (remote)> ',
        historySize: 1000,
        useColors: true
      });

      await instance.connect();
      await instance.start();
    }

    // Handle Ctrl+C gracefully
    process.on('SIGINT', async () => {
      console.log('\n\nShutting down...');

      if (instance) {
        await instance.shutdown();
      }

      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start Legion CLI:', error.message);
    console.error(error.stack);

    if (instance) {
      await instance.shutdown?.();
    }

    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
