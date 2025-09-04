/**
 * FullAgentChatFlow.test.js
 * 
 * Integration test that recreates the exact agent communication flow
 * when a user types "please write a hello world program in node js and run it"
 * in the chat UI. Tests the complete protocol from chat message to tool execution.
 */

import { jest } from '@jest/globals';
import ChatServerToolAgent from '../../src/server/actors/tool-agent/ChatServerToolAgent.js';
import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';

describe('Full Agent Chat Protocol Flow', () => {
  let chatAgent;
  let toolRegistry;
  let resourceManager;
  let mockRemoteActor;
  let capturedMessages;

  beforeAll(async () => {
    // Get real instances
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await getToolRegistry();
    
    console.log('🧪 Full Agent Integration Test Setup:');
    console.log('  ResourceManager:', !!resourceManager);
    console.log('  ToolRegistry:', !!toolRegistry);
    
    // Create services object like the real server
    const services = {
      resourceManager,
      toolRegistry
    };
    
    // Create the actual ChatServerToolAgent
    chatAgent = new ChatServerToolAgent(services);
    
    // Create mock remote actor to capture messages
    capturedMessages = [];
    mockRemoteActor = {
      receive: jest.fn((messageType, data) => {
        capturedMessages.push({ messageType, data, timestamp: Date.now() });
        console.log(`📨 Mock client received: ${messageType}`);
      })
    };
    
    // Initialize the agent like the real server does
    await chatAgent.setRemoteActor(mockRemoteActor);
    
    console.log('  ChatServerToolAgent initialized:', !!chatAgent);
    console.log('  Tool agent state:', chatAgent.state);
    
  }, 60000);

  test('should handle complete chat message flow with tool execution', async () => {
    console.log('\n🚀 Testing Complete Chat Message Flow');
    console.log('=====================================');
    
    const userMessage = "please write a hello world program in node js and run it";
    
    console.log('📝 Sending chat message:', userMessage);
    console.log('📡 Simulating exact UI protocol...\n');
    
    // Clear captured messages
    capturedMessages.length = 0;
    
    // Send the message exactly like the UI does
    await chatAgent.receive('send-message', {
      text: userMessage,
      timestamp: Date.now(),
      messageId: 'test-message-1'
    });
    
    console.log('\n📊 Message Flow Analysis:');
    console.log('  Messages captured:', capturedMessages.length);
    
    // Analyze captured messages
    const messageTypes = capturedMessages.map(m => m.messageType);
    console.log('  Message types received:', messageTypes);
    
    // Look for specific agent responses
    const agentResponse = capturedMessages.find(m => m.messageType === 'chat-agent-response');
    const contextUpdate = capturedMessages.find(m => m.messageType === 'chat-context-state-update');
    const llmInteractions = capturedMessages.filter(m => m.messageType === 'chat-agent-llm-interaction');
    
    console.log('\n🔍 Response Analysis:');
    if (agentResponse) {
      console.log('  ✅ Agent response received');
      console.log('  Tools used:', agentResponse.data.toolsUsed?.length || 0);
      console.log('  Operation count:', agentResponse.data.operationCount);
      console.log('  Response text preview:', agentResponse.data.text?.substring(0, 100) + '...');
    } else {
      console.log('  ❌ No agent response received');
    }
    
    if (contextUpdate) {
      console.log('  ✅ Context update received');
      console.log('  Operation history:', contextUpdate.data.contextState?.operationHistory?.length || 0);
      console.log('  Artifacts keys:', Object.keys(contextUpdate.data.contextState?.artifacts || {}));
    } else {
      console.log('  ❌ No context update received');
    }
    
    console.log('  LLM interactions:', llmInteractions.length);
    
    // Check if the plan was executed properly
    if (contextUpdate && contextUpdate.data.contextState?.operationHistory) {
      const operations = contextUpdate.data.contextState.operationHistory;
      console.log('\n🔧 Tool Execution Analysis:');
      operations.forEach((op, index) => {
        console.log(`  ${index + 1}. ${op.tool}:`);
        console.log(`     Success: ${op.success}`);
        console.log(`     Inputs: ${Object.keys(op.inputs || {}).join(', ')}`);
        if (op.tool === 'generate_javascript_module') {
          console.log(`     File written: ${op.outputs?.written}`);
          console.log(`     File path: ${op.outputs?.filePath}`);
        }
        if (op.tool === 'run_node') {
          console.log(`     Execution result: ${op.outputs?.success}`);
          console.log(`     Session ID: ${op.outputs?.sessionId}`);
        }
      });
      
      // Verify both tools executed
      const toolsUsed = operations.map(op => op.tool);
      const hasFileGeneration = toolsUsed.includes('generate_javascript_module');
      const hasExecution = toolsUsed.includes('run_node');
      
      console.log('\n✅ Execution Verification:');
      console.log(`  File generation: ${hasFileGeneration ? '✅' : '❌'}`);
      console.log(`  Code execution: ${hasExecution ? '✅' : '❌'}`);
      
      expect(hasFileGeneration).toBe(true);
      expect(hasExecution).toBe(true);
      expect(operations.length).toBe(2);
    } else {
      console.log('\n❌ No operation history found in context update');
      expect(contextUpdate).toBeDefined();
    }
    
    // Verify overall success
    expect(agentResponse).toBeDefined();
    expect(agentResponse.data.complete).toBe(true);
    
    console.log('\n🎉 Full agent chat flow test completed successfully!');
    
  }, 120000);

  afterAll(async () => {
    console.log('\n🧹 Cleaning up agent test resources...');
    
    if (chatAgent && typeof chatAgent.cleanup === 'function') {
      await chatAgent.cleanup();
    }
  });
});