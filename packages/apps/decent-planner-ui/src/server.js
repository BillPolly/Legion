/**
 * Server for Decent Planner UI
 * Uses the actor framework from @legion/server-framework
 */

import { createConfigurableServer } from '@legion/server-framework';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startServer() {
  console.log('🚀 Starting Decent Planner UI Server...');
  
  const config = {
    name: 'decent-planner-ui',
    port: 8083,
    routes: [
      {
        path: '/planner',
        serverActor: join(__dirname, 'server/actors/RootServerActor.js'),
        clientActor: join(__dirname, 'client/actors/RootClientActor.js'),
        title: '🧠 Decent Planner'
      }
    ],
    static: {
      '/src': __dirname,
      '/': join(__dirname, '../public')  // Serve favicon and other public assets
    }
  };
  
  console.log("about to start");
  try {
  
    const server = await createConfigurableServer(config);
    await server.start(); // IMPORTANT: Actually start the server!
    
    console.log('✅ Server running on http://localhost:8083');
    console.log('📱 Open http://localhost:8083/planner to use the app');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();