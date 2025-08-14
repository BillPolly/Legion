/**
 * Tool Registry UI Server
 * WebSocket server with actor-based communication for tool registry management
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { ActorSpace } from '@legion/actors';
import { ToolRegistry } from '@legion/tools';
import { SemanticSearchProvider } from '@legion/semantic-search';

// Server actors
import { ServerToolRegistryActor } from './actors/ServerToolRegistryActor.js';
import { ServerDatabaseActor } from './actors/ServerDatabaseActor.js';
import { ServerSemanticSearchActor } from './actors/ServerSemanticSearchActor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create Express app
const app = express();
const PORT = process.env.PORT || 8090;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/src', express.static(path.join(__dirname, '../src')));

// Serve shared packages
app.use('/lib/shared/actors', express.static(path.join(__dirname, '../../shared/actors/src')));

// Serve demo HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'tool-registry-ui',
    timestamp: new Date().toISOString()
  });
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`Tool Registry UI Server running on http://localhost:${PORT}`);
});

// Create WebSocket server
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

// Initialize services
let toolRegistry = null;
let semanticProvider = null;

async function initializeServices() {
  try {
    console.log('Initializing services...');
    
    // Initialize ToolRegistry - it will create its own ResourceManager and MongoDB provider
    toolRegistry = new ToolRegistry();
    await toolRegistry.initialize();
    
    // Initialize SemanticSearchProvider if needed separately
    // The ToolRegistry already has semantic search capabilities
    
    console.log('✅ All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Initialize services on startup
await initializeServices();

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('New client connected');
  
  // Create ActorSpace for this connection
  const actorSpace = new ActorSpace('server-' + Date.now());
  
  // Create server actors - they only need the toolRegistry
  const toolActor = new ServerToolRegistryActor(toolRegistry);
  const dbActor = new ServerDatabaseActor(toolRegistry);
  const searchActor = new ServerSemanticSearchActor(toolRegistry);
  
  // Register actors with unique GUIDs
  const actorGuids = {
    tools: `${actorSpace.spaceId}-tools`,
    database: `${actorSpace.spaceId}-database`,
    search: `${actorSpace.spaceId}-search`
  };
  
  actorSpace.register(toolActor, actorGuids.tools);
  actorSpace.register(dbActor, actorGuids.database);
  actorSpace.register(searchActor, actorGuids.search);
  
  // Handle handshake
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'actor_handshake') {
        // Client is ready, send server actor GUIDs
        ws.send(JSON.stringify({
          type: 'actor_handshake_ack',
          serverActors: actorGuids
        }));
        
        // Create channel for this WebSocket
        const channel = actorSpace.addChannel(ws);
        
        // Create remote actors for client actors
        const remoteToolActor = channel.makeRemote(message.clientActors.tools);
        const remoteDbActor = channel.makeRemote(message.clientActors.database);
        const remoteSearchActor = channel.makeRemote(message.clientActors.search);
        
        // Give remote actors to server actors
        toolActor.setRemoteActor(remoteToolActor);
        dbActor.setRemoteActor(remoteDbActor);
        searchActor.setRemoteActor(remoteSearchActor);
        
        console.log('Actor handshake completed');
      }
      // After handshake, ActorSpace handles all messages
    } catch (error) {
      console.error('Message handling error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    // ActorSpace cleanup happens automatically
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  
  // Close WebSocket server
  wss.close();
  
  // Disconnect from databases
  if (mongoProvider) {
    await mongoProvider.disconnect();
  }
  if (storageProvider) {
    await storageProvider.disconnect();
  }
  
  // Close HTTP server
  server.close(() => {
    console.log('Server shut down');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  
  if (mongoProvider) {
    await mongoProvider.disconnect();
  }
  if (storageProvider) {
    await storageProvider.disconnect();
  }
  
  process.exit(0);
});