#!/usr/bin/env node

import { ChatAgent } from '../../src/agents/ChatAgent.js';

const TEST_PROMPT = "please write a node server that has an endpoint that can add 2 numbers";

async function runTest() {
  console.log('🚀 Starting Simple TaskOrchestrator Test via ChatAgent');
  console.log('📝 Test Prompt:', TEST_PROMPT);
  console.log('=' . repeat(60));
  
  try {
    // Create ChatAgent which includes TaskOrchestrator
    const agent = new ChatAgent();
    
    // Mock remote agent for responses
    const mockRemoteAgent = {
      receive: async (message) => {
        console.log('📨 Message from agent:', JSON.stringify(message, null, 2).substring(0, 500));
      }
    };
    
    agent.setRemoteAgent(mockRemoteAgent);
    
    // Send the request
    console.log('\n📤 Sending request to agent...\n');
    await agent.receive({
      type: 'chat_message',
      content: TEST_PROMPT
    });
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error.message);
    console.error(error.stack);
  }
}

// Run with timeout
const timeout = setTimeout(() => {
  console.error('\n⏱️ Test timed out after 60 seconds');
  process.exit(1);
}, 60000);

runTest().then(() => {
  clearTimeout(timeout);
  process.exit(0);
}).catch(error => {
  clearTimeout(timeout);
  console.error('Fatal error:', error);
  process.exit(1);
});