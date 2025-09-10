/**
 * Actor-based server for Gemini Compatible Agent
 * Uses Legion's actor framework while preserving all existing functionality
 */

import { createConfigurableServer } from '@legion/server-framework';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startActorServer() {
  console.log('🎭 Starting Gemini Agent with Legion Actor Framework...');
  
  const config = {
    name: 'gemini-compatible-agent',
    port: 4011, // Different port to avoid conflicts with existing server
    routes: [
      {
        path: '/gemini',
        serverActor: join(__dirname, 'actors/GeminiRootServerActor.js'),
        clientActor: join(__dirname, 'actors/GeminiRootClientActor.js'),
        title: '🤖 Gemini Compatible Agent - Actor Framework'
      }
    ],
    static: {
      '/src': __dirname,
      '/': join(__dirname, '../public')
    }
  };
  
  try {
    const server = await createConfigurableServer(config);
    await server.start();
    
    console.log('✅ Actor-based server running on http://localhost:4011');
    console.log('🎭 Open http://localhost:4011/gemini to use actor-based interface');
    console.log('📊 Existing server still available on http://localhost:4010 (backup)');
    
  } catch (error) {
    console.error('❌ Failed to start actor server:', error);
    console.error('💡 Fallback: Use existing server on http://localhost:4010');
    process.exit(1);
  }
}

startActorServer();