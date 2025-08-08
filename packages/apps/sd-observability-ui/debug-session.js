/**
 * Debug Session - Monitor both frontend and backend logs
 */

import { spawn } from 'child_process';
import WebSocket from 'ws';

console.log('🔍 Starting SD Observability Debug Session...\n');

// Create a simple WebSocket client to test the backend
const testBackend = () => {
  console.log('🔌 Testing backend connection...');
  
  const ws = new WebSocket('ws://localhost:3007');
  
  ws.on('open', () => {
    console.log('✅ Connected to backend WebSocket');
    
    // Send a test handshake
    const handshake = {
      type: 'actor_handshake',
      clientActors: {
        observability: 'test-client-observability'
      }
    };
    
    console.log('📤 Sending handshake:', handshake);
    ws.send(JSON.stringify(handshake));
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📥 Backend response:', message);
      
      if (message.type === 'actor_handshake_ack') {
        // Now test a chat message
        console.log('💬 Testing chat message...');
        
        const chatMessage = {
          targetGuid: message.serverActors.observability,
          payload: {
            type: 'chat_message',
            payload: {
              content: 'What is the SD system?',
              sessionId: 'test-session-123'
            }
          }
        };
        
        console.log('📤 Sending chat message:', chatMessage);
        ws.send(JSON.stringify(chatMessage));
      }
    } catch (error) {
      console.error('❌ Error parsing message:', error);
      console.log('Raw message:', data.toString());
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 Backend connection closed');
  });
  
  ws.on('error', (error) => {
    console.error('❌ Backend WebSocket error:', error);
  });
  
  // Close after 10 seconds
  setTimeout(() => {
    console.log('⏰ Closing test connection...');
    ws.close();
  }, 10000);
};

// Test backend after a short delay
setTimeout(testBackend, 2000);

// Instructions for manual testing
console.log(`
📋 Manual Testing Instructions:

1. Open browser to http://localhost:3006
2. Open Developer Console (F12)
3. Look for WebSocket debug messages starting with [WebSocket]
4. Try sending a chat message like "What is the SD system?"
5. Check both browser console and this terminal for debug output

🔍 Browser Debug Commands:
- wsDebugger.testConnection() - Test WebSocket connection
- wsDebugger.getCurrentWebSocket() - Get WebSocket instance

🖥️ Backend Health: curl http://localhost:3007/health
🌐 Frontend Health: curl http://localhost:3006/health
`);

// Keep the process running
process.stdin.resume();