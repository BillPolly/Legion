/**
 * Example Counter Application
 * Demonstrates Legion Server Framework usage
 */

import { BaseServer } from '../../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Server actor factory - creates a new instance per connection
function createCounterServerActor(services) {
  return {
    count: 0,
    remoteActor: null,
    
    // Set remote actor reference (called by framework)
    setRemoteActor(remoteActor) {
      this.remoteActor = remoteActor;
    },
    
    // Handle incoming messages (Actor protocol method)
    async receive(messageType, data) {
      let response;
      
      switch (messageType) {
        case 'increment':
          this.count++;
          response = { type: 'count_updated', count: this.count };
          break;
          
        case 'decrement':
          this.count--;
          response = { type: 'count_updated', count: this.count };
          break;
          
        case 'reset':
          this.count = 0;
          response = { type: 'count_updated', count: this.count };
          break;
          
        case 'get_count':
          response = { type: 'count_updated', count: this.count };
          break;
          
        default:
          throw new Error(`Unknown message type: ${messageType}`);
      }
      
      // Send response to client if we have a remote actor
      if (this.remoteActor && response) {
        // Use ActorSpace protocol: RemoteActor.receive() sends the message
        this.remoteActor.receive(response.type, response);
      }
      
      return response;
    },
    
    // Alternative handle method for compatibility
    async handle(message) {
      return this.receive(message.type, message.data);
    }
  };
}

// Create and configure server
async function main() {
  const server = new BaseServer();
  
  // Initialize with ResourceManager
  await server.initialize();
  
  // Register the counter route
  const clientActorFile = path.join(__dirname, 'client.js');
  server.registerRoute('/counter', createCounterServerActor, clientActorFile, 8080);
  
  // Register static assets
  const staticDir = path.join(__dirname, 'static');
  server.registerStaticRoute('/static', staticDir);
  
  // Start the server
  await server.start();
  
  console.log('Counter app running at http://localhost:8080/counter');
  console.log('Press Ctrl+C to stop');
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});