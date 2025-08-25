/**
 * Tool Registry Server
 * WebSocket server with actor-based communication for tool registry management
 * Uses singleton ToolRegistry instance
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import singleton ToolRegistry
import toolRegistry from '@legion/tools-registry';

// Import services
import { ToolRegistryService } from './services/ToolRegistryService.js';
import { WebSocketService } from './services/WebSocketService.js';
import { ActorSpaceManager } from './services/ActorSpaceManager.js';

// Import middleware
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { loggingMiddleware } from './middleware/logging.js';

// Import routes
import { healthRoutes } from './routes/health.js';
import { apiRoutes } from './routes/api.js';
import { staticRoutes } from './routes/static.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const PORT = process.env.PORT || 8090;
const HOST = process.env.HOST || 'localhost';

// Create Express app
const app = express();

// Apply middleware
app.use(loggingMiddleware);
app.use(corsMiddleware);
app.use(express.json());

// Apply routes
app.use('/health', healthRoutes);
app.use('/api', apiRoutes);
app.use('/', staticRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize services
let registryService = null;
let wsService = null;
let actorManager = null;

async function initializeServices() {
  try {
    console.log('🚀 Initializing Tool Registry Server...');
    
    // Create service wrappers (this initializes ToolRegistry singleton)
    console.log('  🔧 Creating service wrappers...');
    registryService = await ToolRegistryService.getInstance();
    actorManager = new ActorSpaceManager(registryService);
    console.log('  ✅ Services created');
    
    // Verify registry is available
    const registry = registryService.getRegistry();
    console.log('  📊 Registry status: initialized');
    
    console.log('✅ All services initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    console.error('   Stack:', error.stack);
    return false;
  }
}

// Create server (for testing)
export async function createServer() {
  // Initialize services first
  const initialized = await initializeServices();
  if (!initialized) {
    throw new Error('Cannot start server - initialization failed');
  }
  
  const server = app.listen(PORT, HOST);
  
  // Create WebSocket server
  const wss = new WebSocketServer({ 
    server,
    path: '/ws'
  });
  
  // Initialize WebSocket service
  wsService = new WebSocketService(wss, actorManager);
  
  // Handle WebSocket connections
  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`📡 New WebSocket connection from ${clientIp}`);
    wsService.handleConnection(ws, req);
  });
  
  // Store server reference for graceful shutdown
  app.locals.server = server;
  app.locals.wss = wss;
  
  return { app, server, wss };
}

// Start HTTP server
async function startServer() {
  try {
    const { server } = await createServer();
    
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('   🚀 Tool Registry Server                        ');
    console.log('═══════════════════════════════════════════════════');
    console.log(`   HTTP:      http://${HOST}:${PORT}`);
    console.log(`   WebSocket: ws://${HOST}:${PORT}/ws`);
    console.log(`   Health:    http://${HOST}:${PORT}/health`);
    console.log(`   API:       http://${HOST}:${PORT}/api/stats`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    
    return server;
  } catch (error) {
    console.error('❌ Cannot start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handler
async function shutdown(signal) {
  console.log(`\n📛 ${signal} received, starting graceful shutdown...`);
  
  try {
    // Close WebSocket server
    if (app.locals.wss) {
      console.log('  🔌 Closing WebSocket server...');
      app.locals.wss.close(() => {
        console.log('  ✅ WebSocket server closed');
      });
    }
    
    // Cleanup actor spaces
    if (actorManager) {
      console.log('  🎭 Cleaning up actor spaces...');
      await actorManager.cleanup();
      console.log('  ✅ Actor spaces cleaned up');
    }
    
    // Cleanup registry
    if (registryService) {
      console.log('  📦 Cleaning up ToolRegistry...');
      await registryService.cleanup();
      console.log('  ✅ ToolRegistry cleaned up');
    }
    
    // Cleanup singleton (done via ToolRegistryService)
    console.log('  🧹 Cleaning up singleton...');
    // toolRegistry is already the initialized singleton instance
    await toolRegistry.cleanup();
    console.log('  ✅ Singleton cleaned up');
    
    // Close HTTP server
    if (app.locals.server) {
      console.log('  🚪 Closing HTTP server...');
      app.locals.server.close(() => {
        console.log('  ✅ HTTP server closed');
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
      });
      
      // Force exit after 10 seconds
      setTimeout(() => {
        console.error('⚠️  Forcefully shutting down after timeout');
        process.exit(1);
      }, 10000);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('UNHANDLED_REJECTION');
});

// Export for testing
export { startServer, shutdown };

// Start server if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}