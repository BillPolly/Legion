/**
 * Simple HTTP server to serve the chat room web UI with Legion packages
 * Uses BaseServer from @legion/server-framework for proper Legion package serving
 */

import { BaseServer } from '@legion/server-framework';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3001;

async function main() {
  // Create and initialize BaseServer
  const server = new BaseServer();
  await server.initialize();

  // Start static server with Legion package support
  await server.startStaticServer(PORT, {
    staticDirectory: __dirname,
    title: 'Legion Chat Room'
  });

  console.log(`\n🌐 Web UI server running at http://localhost:${PORT}`);
  console.log(`📱 Open your browser to http://localhost:${PORT}`);
  console.log(`🚀 Legion packages available at /legion/*\n`);
}

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
