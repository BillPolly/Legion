/**
 * Debug server - bypass hanging initialization to get the UI working
 */

import { createConfigurableServer } from '@legion/server-framework';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a simplified ServerPlannerActor that doesn't hang
class DebugServerPlannerActor {
  constructor(services) {
    this.services = services;
    this.remoteActor = null;
    this.isReady = false;
  }

  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🎭 Debug server planner actor connected');
    
    // Skip the hanging initialization and just send ready
    setTimeout(() => {
      this.remoteActor.receive('ready', {
        timestamp: new Date().toISOString(),
        debug: true,
        message: 'Running in debug mode - skipping full initialization'
      });
      this.isReady = true;
    }, 1000);
  }

  receive(messageType, data) {
    console.log('📨 Debug server received:', messageType);
    
    switch (messageType) {
      case 'plan-informal':
        // Send mock response
        setTimeout(() => {
          this.remoteActor.receive('plan-result', {
            success: false,
            error: 'Debug mode - planning not available',
            debug: true
          });
        }, 100);
        break;
        
      default:
        console.log('Debug mode - message not handled:', messageType);
        if (this.remoteActor) {
          this.remoteActor.receive('error', {
            message: `Debug mode - ${messageType} not implemented`,
            debug: true
          });
        }
    }
  }
}

async function startDebugServer() {
  console.log('🚀 Starting Debug Decent Planner UI Server...');
  
  const config = {
    name: 'decent-planner-ui-debug',
    port: 8083,
    routes: [
      {
        path: '/planner',
        // Use our debug actor instead
        serverActor: DebugServerPlannerActor,
        clientActor: './src/client/actors/ClientPlannerActor.js',
        title: '🧠 Decent Planner (Debug Mode)'
      }
    ],
    static: {
      '/src': './src'
    }
  };
  
  try {
    const server = await createConfigurableServer(config);
    await server.start();
    
    console.log('✅ Debug server running on http://localhost:8083');
    console.log('📱 Open http://localhost:8083/planner to use the app');
    console.log('⚠️  Running in DEBUG MODE - full functionality disabled');
    
  } catch (error) {
    console.error('❌ Failed to start debug server:', error);
    process.exit(1);
  }
}

startDebugServer();