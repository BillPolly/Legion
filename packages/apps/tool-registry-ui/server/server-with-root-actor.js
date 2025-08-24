/**
 * Tool Registry UI Server with Root Actor Pattern
 * Uses a single root actor to manage all sub-actors
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { ActorSpace } from '@legion/actors';
import { ToolRegistry } from '@legion/tools-registry';
import { DecentPlanner } from '@legion/decent-planner';
import { BTExecutor } from '@legion/bt-executor';
import { LLMClient } from '@legion/llm';
import { ResourceManager } from '@legion/resource-manager';
import { MongoDBProvider } from '@legion/mongodb-provider';
import { initializeSchemas } from './schemas/MongoDBSchemas.js';

// Root actor
import { RootServerActor } from './actors/RootServerActor.js';

// Sub-actors
import { ServerToolRegistryActor } from './actors/ServerToolRegistryActor.js';
import { ServerDatabaseActor } from './actors/ServerDatabaseActor.js';
import { ServerSemanticSearchActor } from './actors/ServerSemanticSearchActor.js';
import { ServerPlanningActor } from './actors/ServerPlanningActor.js';
import { ServerPlanExecutionActor } from './actors/ServerPlanExecutionActor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create Express app
const app = express();
const PORT = process.env.PORT || 8090;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/src', express.static(path.join(__dirname, '../src')));

// Serve Legion packages for frontend imports
app.use('/legion/shared', express.static(path.join(__dirname, '../../../shared')));
app.use('/legion/tools', express.static(path.join(__dirname, '../../../tools')));
app.use('/legion/frontend-components', express.static(path.join(__dirname, '../../../frontend/components')));
app.use('/legion/actors', express.static(path.join(__dirname, '../../../shared/actors')));

// Serve demo HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'tool-registry-ui',
    timestamp: new Date().toISOString(),
    rootActor: true
  });
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`🚀 Tool Registry UI Server (Root Actor Pattern) running on http://localhost:${PORT}`);
});

// Create WebSocket server
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

// Initialize services
let services = {};

async function initializeServices() {
  try {
    console.log('🔧 Initializing services...');
    
    // Initialize ResourceManager
    const resourceManager = await ResourceManager.getResourceManager();
    
    // Initialize MongoDB provider
    const mongoProvider = new MongoDBProvider(resourceManager);
    await mongoProvider.connect();
    
    // Initialize MongoDB schemas
    const db = mongoProvider.getDatabase();
    const schemas = await initializeSchemas(db);
    console.log('✅ MongoDB schemas initialized');
    
    // Initialize ToolRegistry
    const toolRegistry = new ToolRegistry();
    await toolRegistry.initialize();
    console.log('✅ ToolRegistry initialized');
    
    // Initialize LLM Client for planning
    const llmClient = new LLMClient(resourceManager);
    
    // Initialize DecentPlanner
    const decentPlanner = new DecentPlanner(llmClient, toolRegistry, {
      maxDepth: 5,
      enableFormalPlanning: true,
      confidenceThreshold: 0.7
    });
    console.log('✅ DecentPlanner initialized');
    
    // Initialize BT Executor
    const btExecutor = new BTExecutor(toolRegistry);
    console.log('✅ BT Executor initialized');
    
    // Store services for use in actors
    services = {
      resourceManager,
      mongoProvider,
      toolRegistry,
      decentPlanner,
      btExecutor,
      llmClient,
      schemas
    };
    
    console.log('✅ All services initialized successfully');
    return services;
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// Initialize services on startup
const servicesReady = initializeServices();

// Handle WebSocket connections
wss.on('connection', async (ws) => {
  console.log('🔌 New client connected');
  
  // Ensure services are ready
  await servicesReady;
  
  // Create ActorSpace for this connection (generic, no customization)
  const actorSpace = new ActorSpace('server-' + Date.now());
  
  // Create root server actor
  const rootActor = new RootServerActor();
  
  // Create and register sub-actors with the root actor
  const toolRegistryActor = new ServerToolRegistryActor(services.toolRegistry, services.mongoProvider);
  const databaseActor = new ServerDatabaseActor(services.toolRegistry, services.mongoProvider);
  const semanticSearchActor = new ServerSemanticSearchActor(
    services.toolRegistry.semanticDiscovery, 
    services.mongoProvider
  );
  const planningActor = new ServerPlanningActor(services.decentPlanner, services.mongoProvider);
  const executionActor = new ServerPlanExecutionActor(
    services.btExecutor, 
    services.toolRegistry, 
    services.mongoProvider
  );
  
  // Register sub-actors with generic names
  rootActor.registerSubActor('tools', toolRegistryActor);
  rootActor.registerSubActor('database', databaseActor);
  rootActor.registerSubActor('search', semanticSearchActor);
  rootActor.registerSubActor('planning', planningActor);
  rootActor.registerSubActor('execution', executionActor);
  
  // Register root actor with ActorSpace
  const rootActorId = `${actorSpace.spaceId}-root`;
  actorSpace.register(rootActor, rootActorId);
  
  // Create channel for WebSocket
  const channel = actorSpace.addChannel(ws);
  
  // Handle initial handshake
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'root:init') {
        // Client is requesting root actor connection
        console.log('🤝 Root actor initialization requested');
        
        // Send root actor ID to client
        ws.send(JSON.stringify({
          type: 'root:init_ack',
          rootActorId: rootActorId,
          timestamp: new Date()
        }));
        
        // Set up remote actor connection
        if (message.clientRootActorId) {
          const remoteRootActor = channel.makeRemote(message.clientRootActorId);
          rootActor.setRemoteActor(remoteRootActor);
          console.log('✅ Root actors connected');
        }
      }
      // After initialization, ActorSpace handles all messages through the root actor
    } catch (error) {
      console.error('❌ Message handling error:', error);
    }
  });
  
  ws.on('close', async () => {
    console.log('🔌 Client disconnected');
    await rootActor.cleanup();
    // ActorSpace cleanup happens automatically
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 SIGTERM received, shutting down...');
  
  // Close WebSocket server
  wss.close();
  
  // Disconnect from services
  if (services.mongoProvider) {
    await services.mongoProvider.disconnect();
  }
  
  // Close HTTP server
  server.close(() => {
    console.log('✅ Server shut down');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('📴 SIGINT received, shutting down...');
  
  if (services.mongoProvider) {
    await services.mongoProvider.disconnect();
  }
  
  process.exit(0);
});