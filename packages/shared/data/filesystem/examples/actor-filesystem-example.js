/**
 * Actor-based Filesystem Example
 * 
 * Demonstrates how to use the Actor-based filesystem architecture with
 * FileSystemActor on the server and ActorRemoteFileSystemDataSource
 * on the client, connected via WebSocketBridgeActor and FileSystemProtocol.
 */

import { FileSystemActor, FileSystemProtocol } from '@legion/filesystem';
import { WebSocketBridgeActor, createWebSocketBridge, ProtocolTypes } from '@legion/websocket-actor-protocol';
import { DirectoryHandle, ActorRemoteFileSystemDataSource } from '@legion/filesystem';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

/**
 * Server setup with FileSystemActor
 */
class FileSystemActorServer {
  constructor(options = {}) {
    this.options = {
      port: options.port || 3000,
      rootPath: options.rootPath || process.cwd(),
      ...options
    };
    
    this.app = express();
    this.server = null;
    this.wss = null;
    this.actorSpace = new Map(); // Simple actor space implementation
    this.filesystemActor = null;
  }
  
  async start() {
    // Create HTTP server
    this.server = createServer(this.app);
    
    // Create WebSocket server
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/filesystem'
    });
    
    // Create filesystem actor
    this.filesystemActor = new FileSystemActor({
      rootPath: this.options.rootPath,
      actorSpace: this.actorSpace,
      key: 'filesystem-actor',
      verbose: true
    });
    
    // Register filesystem actor
    this.actorSpace.set('filesystem-actor', this.filesystemActor);
    
    // Handle WebSocket connections
    this.wss.on('connection', (ws) => {
      console.log('Client connected');
      
      // Create bridge actor for this connection
      const bridgeActor = new WebSocketBridgeActor({
        protocol: new FileSystemProtocol(),
        websocket: ws,
        actorSpace: this.actorSpace,
        name: `FilesystemBridge_${Date.now()}`
      });
      
      // Register bridge actor
      const bridgeKey = `bridge_${Date.now()}_${Math.random()}`;
      this.actorSpace.set(bridgeKey, bridgeActor);
      bridgeActor._key = bridgeKey;
      
      ws.on('close', () => {
        console.log('Client disconnected');
        this.actorSpace.delete(bridgeKey);
        bridgeActor.destroy();
      });
    });
    
    // Start server
    return new Promise((resolve, reject) => {
      this.server.listen(this.options.port, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`Filesystem server running on port ${this.options.port}`);
          resolve({
            url: `http://localhost:${this.options.port}`,
            wsUrl: `ws://localhost:${this.options.port}/filesystem`
          });
        }
      });
    });
  }
  
  async stop() {
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('Filesystem server stopped');
          resolve();
        });
      });
    }
  }
}

/**
 * Client setup with ActorRemoteFileSystemDataSource
 */
class FileSystemClient {
  constructor(wsUrl, options = {}) {
    this.wsUrl = wsUrl;
    this.options = options;
    this.actorSpace = new Map(); // Simple actor space implementation
    this.dataSource = null;
    this.rootDirectory = null;
  }
  
  async connect() {
    // Create actor-based data source
    this.dataSource = new ActorRemoteFileSystemDataSource({
      wsUrl: this.wsUrl,
      actorSpace: this.actorSpace,
      verbose: true,
      ...this.options
    });
    
    // Wait for connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
      
      this.dataSource.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      this.dataSource.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    // Create root directory handle
    this.rootDirectory = new DirectoryHandle(this.dataSource, '/');
    
    console.log('Client connected to filesystem server');
    return this.rootDirectory;
  }
  
  disconnect() {
    if (this.dataSource) {
      this.dataSource.destroy();
    }
  }
}

/**
 * Example usage
 */
async function demonstrateActorFilesystem() {
  console.log('=== Actor-based Filesystem Demo ===\n');
  
  // 1. Start the server
  console.log('1. Starting FileSystem server with Actor...');
  const server = new FileSystemActorServer({
    port: 3100,
    rootPath: '/tmp/actor-fs-demo'
  });
  
  try {
    const serverInfo = await server.start();
    console.log(`   Server started: ${serverInfo.wsUrl}\n`);
    
    // Give server time to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 2. Connect client
    console.log('2. Connecting client with ActorRemoteFileSystemDataSource...');
    const client = new FileSystemClient(serverInfo.wsUrl);
    const rootDir = await client.connect();
    console.log('   Client connected\n');
    
    // 3. Demonstrate filesystem operations via Actor system
    console.log('3. Testing filesystem operations through Actor protocol...');
    
    // Create a test directory
    console.log('   Creating test directory...');
    const testDir = rootDir.directory('test-actor-fs');
    
    // Create a test file
    console.log('   Creating test file...');
    const testFile = testDir.file('hello.txt');
    testFile.write('Hello from Actor-based filesystem!');
    
    // Read the file back
    console.log('   Reading file content...');
    const content = testFile.read();
    console.log(`   File content: "${content}"`);
    
    // List directory contents
    console.log('   Listing directory contents...');
    const files = testDir.list();
    console.log(`   Found ${files.length} items:`, files.map(f => f.name));
    
    // 4. Test file watching via Actor subscriptions
    console.log('\n4. Testing file watching via Actor subscriptions...');
    const watcher = testFile.watch((changes) => {
      console.log('   File change detected:', changes);
    });
    
    // Modify the file to trigger watch
    setTimeout(() => {
      console.log('   Modifying file to trigger watch...');
      testFile.write('Modified content via Actor system!');
    }, 1000);
    
    // Wait a bit for watch notification
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Clean up watcher
    watcher.unsubscribe();
    
    console.log('\n5. Cleaning up...');
    client.disconnect();
    console.log('   Client disconnected');
    
  } catch (error) {
    console.error('Demo failed:', error);
  } finally {
    // Stop server
    await server.stop();
    console.log('   Server stopped');
    console.log('\n=== Demo Complete ===');
  }
}

/**
 * Comparison with non-Actor approach
 */
function explainActorAdvantages() {
  console.log(`
=== Actor-based Filesystem Advantages ===

The Actor-based approach provides several benefits over custom WebSocket handling:

1. **Protocol Separation**: FileSystemProtocol encapsulates message format and transformation
2. **Reusable Components**: WebSocketBridgeActor works with any protocol implementation
3. **Actor System Integration**: Fits naturally into existing Actor-based applications
4. **Message Routing**: Automatic request/response correlation and error handling
5. **Extensibility**: Easy to add new filesystem operations or protocols
6. **Testing**: Easier to mock and test individual actors

Architecture Flow:
Browser Handle → ActorRemoteFileSystemDataSource → WebSocketBridgeActor → 
FileSystemProtocol → WebSocket → FileSystemProtocol → FileSystemActor → LocalFileSystemDataSource

This replaces the custom WebSocket handling with a clean, reusable Actor pattern.
`);
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateActorFilesystem()
    .then(() => explainActorAdvantages())
    .catch(console.error);
}

export { FileSystemActorServer, FileSystemClient, demonstrateActorFilesystem };