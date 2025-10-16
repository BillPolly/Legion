#!/usr/bin/env node
/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */

/**
 * Panel Server - Standalone server for Legion process UI panels
 *
 * Usage:
 *   node src/index.js [--port PORT] [--host HOST]
 *
 * Environment:
 *   PANEL_SERVER_PORT - Server port (default: 5500)
 *   PANEL_SERVER_HOST - Server host (default: localhost)
 */

import { PanelServer } from './panel-server.js';

function parseArgs() {
  const args = {
    port: parseInt(process.env.PANEL_SERVER_PORT || '5500', 10),
    host: process.env.PANEL_SERVER_HOST || 'localhost',
  };

  // Parse command line arguments
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    const nextArg = process.argv[i + 1];

    if (arg === '--port' && nextArg) {
      args.port = parseInt(nextArg, 10);
      i++;
    } else if (arg === '--host' && nextArg) {
      args.host = nextArg;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Legion Panel Server

Usage:
  panel-server [options]

Options:
  --port PORT    Server port (default: 5500)
  --host HOST    Server host (default: localhost)
  --help, -h     Show this help message

Environment Variables:
  PANEL_SERVER_PORT  Server port
  PANEL_SERVER_HOST  Server host

Example:
  panel-server --port 6000 --host 0.0.0.0
      `);
      process.exit(0);
    }
  }

  return args;
}

async function main() {
  const args = parseArgs();

  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   Legion Panel Server                 ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');

  // Create and start server
  const server = new PanelServer(args.port, args.host, (msg) => {
    console.log(msg);
  });

  try {
    await server.start();
    console.log('');
    console.log('Ready to accept connections!');
    console.log('');
    console.log(`Connection info: ${server.getConnectionInfo().processes} processes, ${server.getConnectionInfo().panels} panels`);
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('');
    console.log('Shutting down...');
    await server.stop();
    console.log('Goodbye!');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Run server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
