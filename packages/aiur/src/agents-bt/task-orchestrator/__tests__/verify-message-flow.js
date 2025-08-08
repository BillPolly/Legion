#!/usr/bin/env node

/**
 * Verify Message Flow from TaskOrchestrator to User
 */

import { TaskOrchestrator } from '../TaskOrchestrator.js';
import { ResourceManager } from '@legion/module-loader';

// Create a mock ChatAgent that logs all messages
class MockChatAgent {
  constructor() {
    this.messages = [];
    this.orchestratorActive = false;
  }
  
  // This is what TaskOrchestrator calls when using agentContext
  emit(eventType, message) {
    console.log(`\n[${eventType.toUpperCase()}] received:`);
    
    if (message.type === 'chat_response') {
      console.log(`  Progress: ${message.progress}%`);
      console.log(`  Content: ${message.content.split('\n')[0].substring(0, 70)}...`);
    } else if (message.type === 'agent_thought') {
      console.log(`  Thought: ${message.thought}`);
    }
    
    this.messages.push({ eventType, message });
  }
  
  handleOrchestratorMessage(message) {
    console.log('\n[FALLBACK METHOD] Message:', message.type);
    this.messages.push({ fallback: true, message });
  }
}

const verifyMessageFlow = async () => {
  console.log('🧪 Verifying Message Flow...\n');
  
  try {
    // Create minimal dependencies
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const mockChatAgent = new MockChatAgent();
    
    // Create orchestrator
    const orchestrator = new TaskOrchestrator({
      sessionId: 'test',
      chatAgent: mockChatAgent,
      resourceManager: resourceManager,
      moduleLoader: null, // Will create its own
      artifactManager: null // Will create its own
    });
    
    await orchestrator.initialize();
    
    console.log('✅ Orchestrator initialized\n');
    
    // Start a task with agentContext (simulating ChatAgent passing itself)
    console.log('🚀 Starting task with agentContext...\n');
    
    await orchestrator.receive({
      type: 'start_task',
      description: 'create a hello world script',
      agentContext: mockChatAgent  // This simulates ChatAgent passing itself
    });
    
    // Wait a bit to see initial messages
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n\n📊 Message Flow Summary:');
    console.log(`Total messages captured: ${mockChatAgent.messages.length}`);
    
    // Check if agentContext was used
    const contextMessages = mockChatAgent.messages.filter(m => !m.fallback);
    const fallbackMessages = mockChatAgent.messages.filter(m => m.fallback);
    
    console.log(`  • Via agentContext (emit): ${contextMessages.length}`);
    console.log(`  • Via fallback method: ${fallbackMessages.length}`);
    
    if (contextMessages.length > 0) {
      console.log('\n✅ SUCCESS: Messages are flowing through agentContext.emit()!');
    } else {
      console.log('\n❌ FAIL: No messages through agentContext, using fallback');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

verifyMessageFlow().catch(console.error);