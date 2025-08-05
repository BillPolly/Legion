#!/usr/bin/env node

/**
 * Voice Integration Demo
 * 
 * Demonstrates how the actor system allows running frontend and backend
 * components together using a mock WebSocket for testing.
 */

import { MockWebSocket } from './mocks/MockWebSocket.js';

console.log('Voice Integration Demo\n');
console.log('This demonstrates how we can connect frontend and backend actors using MockWebSocket.\n');

// Create a pair of connected mock WebSockets
const [clientSocket, serverSocket] = MockWebSocket.createPair();

console.log('1. Created paired MockWebSockets');

// Simulate frontend sending a voice input message
clientSocket.onopen = () => {
  console.log('2. Client connected');
  
  // Send a voice input message
  const voiceMessage = {
    type: 'voice_input',
    audio: 'bW9jay1hdWRpby1kYXRh', // base64 mock audio
    format: 'webm'
  };
  
  clientSocket.send(JSON.stringify(voiceMessage));
  console.log('3. Client sent voice input:', voiceMessage);
};

// Simulate backend receiving and processing the message
serverSocket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('4. Server received:', message);
  
  if (message.type === 'voice_input') {
    // Simulate transcription
    setTimeout(() => {
      const transcriptionResult = {
        type: 'voice_transcription',
        text: 'Hello, this is a test message',
        language: 'en'
      };
      
      serverSocket.send(JSON.stringify(transcriptionResult));
      console.log('5. Server sent transcription:', transcriptionResult);
    }, 100);
  }
};

// Client receives transcription
clientSocket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('6. Client received:', message);
  
  if (message.type === 'voice_transcription') {
    console.log('\n✅ Voice integration flow complete!');
    console.log(`   Transcribed text: "${message.text}"`);
    
    // Test TTS flow
    testTextToSpeech();
  }
};

// Test text-to-speech flow
function testTextToSpeech() {
  console.log('\nTesting Text-to-Speech flow...\n');
  
  const ttsRequest = {
    type: 'generate_speech',
    text: 'This is a test response',
    voice: 'nova',
    messageId: 'msg_123'
  };
  
  clientSocket.send(JSON.stringify(ttsRequest));
  console.log('7. Client requested TTS:', ttsRequest);
  
  // Server handles TTS request
  serverSocket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    if (message.type === 'generate_speech') {
      console.log('8. Server processing TTS request');
      
      setTimeout(() => {
        const audioResponse = {
          type: 'voice_audio',
          audio: 'bW9jay1hdWRpby1yZXNwb25zZQ==', // base64 mock audio
          format: 'mp3',
          messageId: message.messageId
        };
        
        serverSocket.send(JSON.stringify(audioResponse));
        console.log('9. Server sent audio data');
      }, 100);
    }
  };
  
  // Client receives audio
  clientSocket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    if (message.type === 'voice_audio') {
      console.log('10. Client received audio for playback');
      console.log('\n✅ TTS flow complete!');
      
      demonstrateTestCapabilities();
    }
  };
}

// Demonstrate test capabilities
function demonstrateTestCapabilities() {
  console.log('\n📊 Test Capabilities Demonstrated:\n');
  console.log('1. ✅ Bidirectional communication without network');
  console.log('2. ✅ Message tracking for assertions');
  console.log('3. ✅ Async message handling');
  console.log('4. ✅ Full integration testing possible\n');
  
  console.log('Sent messages from client:', clientSocket.getSentMessages());
  console.log('Sent messages from server:', serverSocket.getSentMessages());
  
  console.log('\n🎯 Key Benefits:');
  console.log('- Run real components together');
  console.log('- No network delays');
  console.log('- Easy debugging');
  console.log('- Predictable test execution');
  
  process.exit(0);
}