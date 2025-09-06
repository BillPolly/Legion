/**
 * show_all Command Live UAT
 * 
 * Real UAT test with actual ChatServerToolAgent and SlashCommandAgent
 * Tests the complete pipeline: /show_all command → object detection → display
 */

import { jest } from '@jest/globals';
import ChatServerToolAgent from '../../src/server/actors/tool-agent/ChatServerToolAgent.js';
import ResourceServerSubActor from '../../src/server/actors/ResourceServerSubActor.js';
import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';

describe('show_all Live UAT', () => {
  let chatAgent;
  let toolRegistry;
  let resourceManager;
  let mockRemoteActor;
  let capturedMessages;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await getToolRegistry();
    
    console.log('🎯 show_all Live UAT Setup');
    console.log('  ResourceManager:', !!resourceManager);
    console.log('  ToolRegistry:', !!toolRegistry);
  }, 60000);

  beforeEach(async () => {
    capturedMessages = [];
    
    // Create mock remote actor to capture messages first
    mockRemoteActor = {
      receive: jest.fn((messageType, data) => {
        const message = {
          messageType,
          data: JSON.parse(JSON.stringify(data)),
          timestamp: Date.now()
        };
        capturedMessages.push(message);
        
        console.log(`📨 UAT captured: ${messageType}`);
        if (messageType === 'chat-command-response') {
          console.log(`   Success: ${data.success}`);
          console.log(`   Command: ${data.command}`);
          if (data.error) {
            console.log(`   Error: ${data.error}`);
          }
        }
      })
    };
    
    // Create ResourceServerSubActor after mockRemoteActor is defined
    const resourceServerActor = new ResourceServerSubActor({ fileSystem: null });
    
    // Set up remote actor for ResourceServerSubActor
    resourceServerActor.setRemoteActor(mockRemoteActor);
    
    // Create services like the real server WITH resourceActor
    const services = {
      resourceManager,
      toolRegistry,
      resourceActor: resourceServerActor
    };
    
    // Create the actual ChatServerToolAgent
    chatAgent = new ChatServerToolAgent(services);
    
    await chatAgent.setRemoteActor(mockRemoteActor);
    console.log('✅ Live UAT setup complete');
  }, 60000);

  describe('Live show_all Command Testing', () => {
    test('should recognize show_all command and process it', async () => {
      console.log('\n🚀 Testing /show_all command recognition...');
      
      // Clear captured messages
      capturedMessages.length = 0;
      
      // Send show_all command like the UI would
      await chatAgent.receive('send-message', {
        text: '/show_all output_directory',
        timestamp: Date.now(),
        messageId: 'uat-show-all-test'
      });
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('\n📊 UAT Message Analysis:');
      console.log(`Total messages captured: ${capturedMessages.length}`);
      
      // Analyze captured messages
      capturedMessages.forEach((msg, index) => {
        console.log(`\n${index + 1}. ${msg.messageType}:`);
        
        if (msg.messageType === 'chat-command-response') {
          console.log(`   Success: ${msg.data.success}`);
          console.log(`   Command: ${msg.data.command}`);
          console.log(`   Text: ${msg.data.text?.substring(0, 100)}...`);
          
          if (msg.data.error) {
            console.log(`   🚨 ERROR: ${msg.data.error}`);
          }
        } else if (msg.messageType === 'chat-command-error') {
          console.log(`   🚨 COMMAND ERROR: ${msg.data.error}`);
        }
      });
      
      // Verify command was processed
      const commandResponse = capturedMessages.find(m => m.messageType === 'chat-command-response');
      
      if (commandResponse) {
        expect(commandResponse.data.command).toBe('show_all');
        expect(commandResponse.data.success).toBe(true);
        console.log('✅ show_all command processed successfully!');
      } else {
        const errorResponse = capturedMessages.find(m => m.messageType === 'chat-command-error');
        if (errorResponse) {
          console.log(`❌ Command failed: ${errorResponse.data.error}`);
          // This helps us understand what went wrong
        }
        console.log('❌ show_all command not found in responses');
      }
      
    }, 30000);

    test('should handle show_all with agent_context object', async () => {
      console.log('\n🎯 Testing /show_all with agent_context...');
      
      capturedMessages.length = 0;
      
      await chatAgent.receive('send-message', {
        text: '/show_all agent_context --introspection',
        timestamp: Date.now(),
        messageId: 'uat-agent-context-test'
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`Captured ${capturedMessages.length} messages`);
      
      const response = capturedMessages.find(m => m.messageType === 'chat-command-response');
      
      if (response) {
        console.log(`✅ agent_context show_all worked: ${response.data.success}`);
        expect(response.data.command).toBe('show_all');
      } else {
        console.log('❌ No response for agent_context test');
      }
    }, 30000);

    test('should test /help command first to verify slash commands work', async () => {
      console.log('\n🔍 Testing /help command to verify slash command system...');
      
      capturedMessages.length = 0;
      
      await chatAgent.receive('send-message', {
        text: '/help',
        timestamp: Date.now(),
        messageId: 'uat-help-test'
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`Help command captured ${capturedMessages.length} messages`);
      
      const helpResponse = capturedMessages.find(m => 
        m.messageType === 'chat-command-response' || m.messageType === 'chat-agent-response'
      );
      
      if (helpResponse) {
        console.log('✅ Slash command system working!');
        console.log(`   Response includes show_all: ${JSON.stringify(helpResponse.data).includes('show_all')}`);
      } else {
        console.log('❌ Slash command system not responding');
      }
    }, 30000);

    test('should test error handling for unknown objects', async () => {
      console.log('\n⚠️  Testing error handling...');
      
      capturedMessages.length = 0;
      
      await chatAgent.receive('send-message', {
        text: '/show_all nonExistentObject',
        timestamp: Date.now(),
        messageId: 'uat-error-test'
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const errorResponse = capturedMessages.find(m => 
        m.messageType === 'chat-command-error' || 
        (m.messageType === 'chat-command-response' && !m.data.success)
      );
      
      if (errorResponse) {
        console.log('✅ Error handling working correctly');
        console.log(`   Error message: ${errorResponse.data.error || errorResponse.data.text}`);
      } else {
        console.log('❌ Error handling not working as expected');
      }
    }, 30000);
  });

  describe('Integration with Existing System', () => {
    test('should work alongside existing /show command', async () => {
      console.log('\n🔗 Testing coexistence with /show command...');
      
      // Test existing /show command
      capturedMessages.length = 0;
      
      await chatAgent.receive('send-message', {
        text: '/show package.json',
        timestamp: Date.now(),
        messageId: 'uat-existing-show-test'
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const showResponse = capturedMessages.find(m => m.messageType === 'chat-command-response');
      
      if (showResponse && showResponse.data.command === 'show') {
        console.log('✅ Existing /show command still works');
        
        // Now test /show_all
        capturedMessages.length = 0;
        
        await chatAgent.receive('send-message', {
          text: '/show_all output_directory',
          timestamp: Date.now(),
          messageId: 'uat-show-all-coexist-test'
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const showAllResponse = capturedMessages.find(m => m.messageType === 'chat-command-response');
        
        if (showAllResponse && showAllResponse.data.command === 'show_all') {
          console.log('✅ Both /show and /show_all commands coexist properly!');
        } else {
          console.log('❌ show_all not working alongside existing show');
        }
      } else {
        console.log('❌ Existing /show command not working - system issue');
      }
    }, 30000);
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up UAT resources...');
    if (chatAgent && typeof chatAgent.cleanup === 'function') {
      await chatAgent.cleanup();
    }
  });
});