/**
 * Tool Registry UI Server
 * WebSocket server with actor-based communication for tool registry management
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { ActorSpace } from '@legion/actors';
import { ToolRegistry } from '@legion/tools-registry';
import { DecentPlanner } from '@legion/decent-planner';
import { BehaviorTreeExecutor as BTExecutor } from '@legion/actor-bt';
import { LLMClient } from '@legion/llm';
import { ResourceManager } from '@legion/resource-manager';
import { MongoDBProvider } from '@legion/storage';
import { isContainerRunning, startDocker, startQdrantContainer, waitForQdrant, QDRANT_CONTAINER_NAME } from '../../../../scripts/docker/start-qdrant.js';
import { initializeSchemas } from './schemas/MongoDBSchemas.js';

// Server actors
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

// Legacy shared packages support
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

// Initialize services - Simplified to use ToolRegistry singleton
let toolRegistry = null;
let resourceManager = null;
let mongoProvider = null;
let decentPlanner = null;
let btExecutor = null;
let llmClient = null;
let schemas = null;

async function initializeServices() {
  try {
    console.log('Initializing services...');
    
    // Initialize ResourceManager
    resourceManager = await ResourceManager.getResourceManager();
    
    // Initialize ToolRegistry singleton - this handles all tool-related operations
    toolRegistry = await ToolRegistry.getInstance();
    console.log('✅ ToolRegistry singleton initialized');
    
    // Initialize minimal MongoDB provider for UI-specific operations only
    const mongoConfig = {
      connectionString: resourceManager.get('env.MONGODB_URL'),
      database: resourceManager.get('env.MONGODB_DATABASE') || resourceManager.get('env.TOOLS_DATABASE_NAME')
    };
    mongoProvider = new MongoDBProvider(mongoConfig);
    await mongoProvider.connect();
    
    // Initialize MongoDB schemas for UI-specific collections
    const db = mongoProvider.getDatabase();
    schemas = await initializeSchemas(db);
    console.log('✅ MongoDB schemas initialized');
    
    // Initialize LLM Client for planning
    llmClient = await resourceManager.createLLMClient();
    
    // Initialize DecentPlanner
    decentPlanner = new DecentPlanner(llmClient, toolRegistry, {
      maxDepth: 5,
      enableFormalPlanning: true,
      confidenceThreshold: 0.7
    });
    console.log('✅ DecentPlanner initialized');
    
    // Initialize BT Executor
    btExecutor = new BTExecutor(toolRegistry);
    console.log('✅ BT Executor initialized');
    
    console.log('✅ All services initialized successfully with ToolRegistry singleton');
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
  
  // Create server actors - simplified with ToolRegistry singleton
  const toolActor = new ServerToolRegistryActor(toolRegistry);
  const dbActor = new ServerDatabaseActor(toolRegistry, mongoProvider);
  const searchActor = new ServerSemanticSearchActor(toolRegistry);
  // Create planning actors - now using ToolRegistry singleton
  const planningActor = new ServerPlanningActor(decentPlanner, toolRegistry, mongoProvider);
  const executionActor = new ServerPlanExecutionActor(btExecutor, toolRegistry, mongoProvider);
  
  // Register actors with unique GUIDs
  const actorGuids = {
    tools: `${actorSpace.spaceId}-tools`,
    database: `${actorSpace.spaceId}-database`,
    search: `${actorSpace.spaceId}-search`,
    planning: `${actorSpace.spaceId}-planning`,
    execution: `${actorSpace.spaceId}-execution`
  };
  
  actorSpace.register(toolActor, actorGuids.tools);
  actorSpace.register(dbActor, actorGuids.database);
  actorSpace.register(searchActor, actorGuids.search);
  actorSpace.register(planningActor, actorGuids.planning);
  actorSpace.register(executionActor, actorGuids.execution);
  
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
        const remotePlanningActor = channel.makeRemote(message.clientActors.planning);
        const remoteExecutionActor = channel.makeRemote(message.clientActors.execution);
        
        // Give remote actors to server actors
        toolActor.setRemoteActor(remoteToolActor);
        dbActor.setRemoteActor(remoteDbActor);
        searchActor.setRemoteActor(remoteSearchActor);
        planningActor.setRemoteActor(remotePlanningActor);
        executionActor.setRemoteActor(remoteExecutionActor);
        
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
  // ToolRegistry handles its own cleanup
  
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
  // ToolRegistry handles its own cleanup
  
  process.exit(0);
});