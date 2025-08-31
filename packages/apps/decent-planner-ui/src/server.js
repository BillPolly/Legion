/**
 * Server for Decent Planner UI
 * Uses the actor framework from @legion/server-framework
 */

import { createConfigurableServer } from '@legion/server-framework';

async function startServer() {
  console.log('🚀 Starting Decent Planner UI Server...');
  
  const config = {
    name: 'decent-planner-ui',
    port: 8083,
    routes: [
      {
        path: '/planner',
        serverActor: './src/server/actors/ServerPlannerActor.js',
        clientActor: './src/client/actors/ClientPlannerActor.js',
        title: '🧠 Decent Planner'
      }
    ],
    static: {
      '/src': './src'
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