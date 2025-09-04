/**
 * Agent Protocol Debug Test
 * Tests complete agent workflow through actor protocol communication
 * Sees exactly what UI sees - all server logs and client messages
 * NO MOCKS - Real actor communication like UI uses
 */

import { ResourceManager } from '@legion/resource-manager';

describe('Agent Protocol Debug Test - Like UI Communication', () => {
  let serverActor;
  let clientActor;
  let chatMessages;
  let resourceManager;
  
  beforeEach(async () => {
    chatMessages = [];
    
    // Get real resource manager
    resourceManager = await ResourceManager.getInstance();
    expect(resourceManager).toBeDefined();
    
    // Import real actors
    const RootServerActor = (await import('../../src/server/actors/RootServerActor.js')).default;
    const { RootClientActor } = await import('../../src/client/actors/RootClientActor.js');
    
    // Create real server actor with real services (same as UI)
    const services = {
      resourceManager: resourceManager
    };
    serverActor = new RootServerActor(services);
    
    // Create real client actor
    clientActor = new RootClientActor();
    
    // Set up bidirectional communication (exactly like UI)
    await serverActor.setRemoteActor(clientActor);
    await clientActor.setRemoteActor(serverActor);
    
    // Capture chat messages (like UI would see)
    const originalReceive = clientActor.receive.bind(clientActor);
    clientActor.receive = (messageType, data) => {
      if (messageType.startsWith('chat-')) {
        chatMessages.push({ messageType, data, timestamp: new Date().toISOString() });
        console.log(`📨 Client received: ${messageType}`, data?.text || data?.error || '');
      }
      return originalReceive(messageType, data);
    };
    
    console.log('🎭 Protocol test setup complete - real actor communication established');
  });

  describe('Agent Tool Discovery Debug', () => {
    test('should debug complete agent message processing through protocol', async () => {
      console.log('🔍 Testing agent processing through real actor protocol...');
      
      const userMessage = 'create a picture of a scifi cat shooting a laser gun and show it to me';
      console.log(`User message: "${userMessage}"`);
      
      // Send message through real actor protocol (exactly like UI does)
      await serverActor.receive('chat-send-message', {
        text: userMessage,
        timestamp: new Date().toLocaleTimeString()
      });
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check what messages client received (exactly like UI)
      console.log(`\\n📨 Client received ${chatMessages.length} messages:`);
      chatMessages.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.messageType}: ${msg.data?.text?.substring(0, 100) || msg.data?.error || 'no text'}`);
      });
      
      // Verify agent responded (should not be "no tools found")
      const agentResponse = chatMessages.find(msg => msg.messageType === 'chat-agent-response');
      if (agentResponse) {
        console.log('\\n🤖 Agent response received:');
        console.log('  Text:', agentResponse.data.text?.substring(0, 200));
        console.log('  Tools used:', agentResponse.data.toolsUsed || []);
        console.log('  Success:', !agentResponse.data.text?.includes('no relevant tools'));
        
        // Should NOT be the "no tools found" error
        expect(agentResponse.data.text).not.toContain('no relevant tools');
        expect(agentResponse.data.toolsUsed?.length).toBeGreaterThan(0);
      }
      
      // Check for LLM interactions
      const llmInteractions = chatMessages.filter(msg => msg.messageType === 'chat-agent-llm-interaction');
      console.log(`\\n🧠 LLM interactions: ${llmInteractions.length}`);
      llmInteractions.forEach((interaction, i) => {
        console.log(`  ${i + 1}. ${interaction.data.purpose}: ${interaction.data.type}`);
      });
      
      expect(llmInteractions.length).toBeGreaterThan(0);
      
    }, 30000);

    test('should debug why tool discovery is failing', async () => {
      console.log('🔍 Testing tool discovery step by step...');
      
      // Access the chat agent directly to debug
      const chatSubActor = serverActor.chatSubActor;
      expect(chatSubActor).toBeDefined();
      expect(chatSubActor.toolAgent).toBeDefined();
      
      const agent = chatSubActor.toolAgent;
      console.log('Agent state:');
      console.log('  Has toolRegistry:', !!agent.toolRegistry);
      console.log('  Has llmClient:', !!agent.llmClient);
      console.log('  Context artifacts keys:', Object.keys(agent.executionContext.artifacts));
      
      // Test tool discovery directly
      console.log('\\n🔍 Testing direct tool search...');
      try {
        const searchResults = await agent.searchForTools('create image and display');
        console.log(`Direct search found ${searchResults.length} tools:`);
        searchResults.forEach(tool => {
          console.log(`  ${tool.name}: ${tool.description?.substring(0, 60)}...`);
        });
        
        const hasGenerate = searchResults.find(tool => tool.name === 'generate_image');
        const hasDisplay = searchResults.find(tool => tool.name === 'display_resource');
        
        console.log('\\nKey tools found:');
        console.log('  generate_image:', hasGenerate ? 'YES' : 'NO');
        console.log('  display_resource:', hasDisplay ? 'YES' : 'NO');
        
        if (!hasGenerate) {
          // Test direct tool access
          console.log('\\n🔧 Testing direct tool access...');
          const directGenerateTool = await agent.toolRegistry.getTool('generate_image');
          console.log('Direct generate_image access:', directGenerateTool ? 'SUCCESS' : 'FAILED');
        }
        
      } catch (error) {
        console.error('❌ Direct search failed:', error.message);
        console.error('Error details:', error.stack);
      }
    });

    test('should test individual tool execution', async () => {
      console.log('🧪 Testing individual tool execution...');
      
      const agent = serverActor.chatSubActor.toolAgent;
      
      // Test generate_image tool directly
      try {
        const generateTool = await agent.toolRegistry.getTool('generate_image');
        if (generateTool) {
          console.log('✅ generate_image tool found');
          
          console.log('Testing image generation...');
          const imageResult = await generateTool.execute({
            prompt: 'test scifi cat',
            size: '1024x1024'
          });
          
          console.log('Image result:', imageResult.success ? 'SUCCESS' : 'FAILED');
          if (imageResult.success) {
            console.log('  Generated file:', imageResult.data.filePath);
          } else {
            console.log('  Error:', imageResult.error);
          }
        } else {
          console.log('❌ generate_image tool not found');
        }
      } catch (error) {
        console.error('❌ Tool execution failed:', error.message);
      }
    }, 30000);
  });
});