/**
 * Cat Image Generation Debug Test
 * 
 * Integration test that recreates the exact agent communication flow
 * when a user asks for a cat picture. Tests the complete protocol from 
 * chat message to image generation with full logging.
 */

import { jest } from '@jest/globals';
import ChatServerToolAgent from '../../src/server/actors/tool-agent/ChatServerToolAgent.js';
import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';

describe('Cat Image Generation Debug Test', () => {
  let chatAgent;
  let toolRegistry;
  let resourceManager;
  let mockRemoteActor;
  let capturedMessages;

  beforeAll(async () => {
    // Get real instances
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await getToolRegistry();
    
    console.log('🐱 Cat Image Generation Debug Test Setup:');
    console.log('  ResourceManager:', !!resourceManager);
    console.log('  ToolRegistry:', !!toolRegistry);
    
    // Check if generate_image tool is available
    const generateTool = await toolRegistry.getTool('generate_image');
    console.log('  generate_image tool available:', !!generateTool);
    if (generateTool) {
      console.log('    Module:', generateTool.moduleName);
      console.log('    Description:', generateTool.description);
    }
    
    // Create services object like the real server
    const services = {
      resourceManager,
      toolRegistry
    };
    
    // Create the actual ChatServerToolAgent
    chatAgent = new ChatServerToolAgent(services);
    
    // Create mock remote actor to capture ALL messages with detailed logging
    capturedMessages = [];
    mockRemoteActor = {
      receive: jest.fn((messageType, data) => {
        const message = { 
          messageType, 
          data: JSON.parse(JSON.stringify(data)), // Deep clone to avoid mutations
          timestamp: Date.now() 
        };
        capturedMessages.push(message);
        
        console.log(`📨 Mock client received: ${messageType}`);
        
        // Log detailed information for specific message types
        if (messageType === 'chat-agent-llm-interaction') {
          console.log(`   LLM Type: ${data.type}`);
          if (data.type === 'request') {
            console.log(`   Request: ${data.request?.substring(0, 100)}...`);
          } else if (data.type === 'response') {
            console.log(`   Response: ${data.response?.substring(0, 100)}...`);
          }
        } else if (messageType === 'chat-agent-response') {
          console.log(`   Complete: ${data.complete}`);
          console.log(`   Tools used: ${data.toolsUsed?.length || 0}`);
          console.log(`   Operation count: ${data.operationCount}`);
          if (data.error) {
            console.log(`   ERROR: ${data.error}`);
          }
        } else if (messageType === 'chat-context-state-update') {
          console.log(`   Artifacts: ${Object.keys(data.contextState?.artifacts || {}).length}`);
          console.log(`   Operations: ${data.contextState?.operationHistory?.length || 0}`);
        }
      })
    };
    
    // Initialize the agent like the real server does
    await chatAgent.setRemoteActor(mockRemoteActor);
    
    console.log('  ChatServerToolAgent initialized:', !!chatAgent);
    console.log('  Tool agent state:', chatAgent.state);
    
  }, 60000);

  test('should handle cat image generation request with full debugging', async () => {
    console.log('\n🚀 Testing Cat Image Generation Flow');
    console.log('====================================');
    
    const userMessage = "please generate a picture of a cat";
    
    console.log('📝 User message:', userMessage);
    console.log('📡 Simulating exact UI protocol...\n');
    
    // Clear captured messages
    capturedMessages.length = 0;
    
    // Send the message exactly like the UI does
    await chatAgent.receive('send-message', {
      text: userMessage,
      timestamp: Date.now(),
      messageId: 'test-cat-message-1'
    });
    
    console.log('\n📊 Complete Message Flow Analysis:');
    console.log('==================================');
    console.log('Total messages captured:', capturedMessages.length);
    
    // Analyze all captured messages in detail
    capturedMessages.forEach((msg, index) => {
      console.log(`\n${index + 1}. ${msg.messageType} (${new Date(msg.timestamp).toISOString()})`);
      
      if (msg.messageType === 'chat-agent-llm-interaction') {
        console.log(`   Type: ${msg.data.type}`);
        console.log(`   Purpose: ${msg.data.purpose || 'unknown'}`);
        if (msg.data.request) {
          console.log(`   Request preview: ${msg.data.request.substring(0, 200)}...`);
        }
        if (msg.data.response) {
          console.log(`   Response preview: ${msg.data.response.substring(0, 200)}...`);
        }
      } else if (msg.messageType === 'chat-agent-response') {
        console.log(`   Complete: ${msg.data.complete}`);
        console.log(`   Success: ${msg.data.success}`);
        console.log(`   Tools used: ${JSON.stringify(msg.data.toolsUsed)}`);
        console.log(`   Operation count: ${msg.data.operationCount}`);
        console.log(`   Text preview: ${msg.data.text?.substring(0, 150)}...`);
        if (msg.data.error) {
          console.log(`   🚨 ERROR: ${msg.data.error}`);
        }
      } else if (msg.messageType === 'chat-context-state-update') {
        const artifacts = msg.data.contextState?.artifacts || {};
        const operations = msg.data.contextState?.operationHistory || [];
        console.log(`   Artifacts: ${Object.keys(artifacts).length} (${Object.keys(artifacts).join(', ')})`);
        console.log(`   Operations: ${operations.length}`);
        
        operations.forEach((op, opIndex) => {
          console.log(`     ${opIndex + 1}. ${op.tool}: ${op.success ? '✅' : '❌'}`);
          if (!op.success && op.error) {
            console.log(`        ERROR: ${op.error}`);
          }
          if (op.tool === 'generate_image') {
            console.log(`        Inputs: ${JSON.stringify(op.inputs)}`);
            if (op.outputs) {
              console.log(`        Outputs: ${JSON.stringify(Object.keys(op.outputs))}`);
            }
          }
        });
      }
    });
    
    // Specific analysis for image generation
    console.log('\n🖼️ Image Generation Specific Analysis:');
    console.log('=====================================');
    
    const agentResponse = capturedMessages.find(m => m.messageType === 'chat-agent-response');
    const contextUpdate = capturedMessages.find(m => m.messageType === 'chat-context-state-update');
    const llmInteractions = capturedMessages.filter(m => m.messageType === 'chat-agent-llm-interaction');
    
    if (contextUpdate && contextUpdate.data.contextState?.operationHistory) {
      const operations = contextUpdate.data.contextState.operationHistory;
      const imageGeneration = operations.find(op => op.tool === 'generate_image');
      
      if (imageGeneration) {
        console.log('🎯 Image Generation Operation Found:');
        console.log(`  Success: ${imageGeneration.success}`);
        console.log(`  Tool: ${imageGeneration.tool}`);
        console.log(`  Inputs: ${JSON.stringify(imageGeneration.inputs, null, 2)}`);
        
        if (imageGeneration.success) {
          console.log(`  Outputs: ${JSON.stringify(imageGeneration.outputs, null, 2)}`);
        } else {
          console.log(`  🚨 ERROR: ${imageGeneration.error}`);
          console.log(`  Error details: ${JSON.stringify(imageGeneration.errorDetails || {}, null, 2)}`);
        }
      } else {
        console.log('❌ No image generation operation found in history');
        console.log('Available operations:', operations.map(op => op.tool));
      }
    } else {
      console.log('❌ No operation history found');
    }
    
    // LLM interaction analysis
    console.log('\n🧠 LLM Interactions Analysis:');
    console.log('============================');
    console.log(`Total LLM interactions: ${llmInteractions.length}`);
    
    llmInteractions.forEach((interaction, index) => {
      console.log(`\n${index + 1}. ${interaction.data.purpose || interaction.data.type}:`);
      if (interaction.data.request) {
        // Look for tool selection in the request
        if (interaction.data.request.includes('generate_image') || interaction.data.request.includes('image')) {
          console.log('   🎯 Contains image generation content');
          console.log(`   Request excerpt: ${interaction.data.request.substring(0, 300)}...`);
        }
      }
      if (interaction.data.response) {
        // Look for tool plans or errors in response
        if (interaction.data.response.includes('generate_image') || interaction.data.response.includes('safety')) {
          console.log('   🎯 Contains image generation response');
          console.log(`   Response excerpt: ${interaction.data.response.substring(0, 300)}...`);
        }
      }
    });
    
    // Overall assessment
    console.log('\n📋 Final Assessment:');
    console.log('===================');
    
    if (agentResponse) {
      console.log('✅ Agent provided a response');
      if (agentResponse.data.success) {
        console.log('✅ Agent reported success');
      } else {
        console.log('❌ Agent reported failure');
        console.log(`   Error: ${agentResponse.data.error}`);
      }
    } else {
      console.log('❌ No agent response received');
    }
    
    // Don't fail the test - we want to see what happens regardless
    console.log('\n🎉 Cat image generation debug test completed!');
    console.log('Check the detailed logs above to understand the exact flow and any issues.');
    
  }, 120000);

  afterAll(async () => {
    console.log('\n🧹 Cleaning up cat image debug test resources...');
    
    if (chatAgent && typeof chatAgent.cleanup === 'function') {
      await chatAgent.cleanup();
    }
  });
});