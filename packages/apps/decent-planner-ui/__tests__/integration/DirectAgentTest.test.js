/**
 * Direct Agent Workflow Test
 * Tests ToolUsingChatAgent workflow directly to debug planning loop
 * NO UI - Direct agent testing with real dependencies
 */

import { getToolRegistry } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';

describe('Direct Agent Workflow Test', () => {
  let agent;
  let toolRegistry;
  let resourceManager;
  
  beforeEach(async () => {
    // Get real dependencies
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await getToolRegistry();
    const llmClient = await resourceManager.get('llmClient');
    
    expect(resourceManager).toBeDefined();
    expect(toolRegistry).toBeDefined();
    expect(llmClient).toBeDefined();
    
    // Create real ToolUsingChatAgent
    const { ToolUsingChatAgent } = await import('../../src/server/actors/tool-agent/ToolUsingChatAgent.js');
    agent = new ToolUsingChatAgent(toolRegistry, llmClient);
    
    console.log('🎭 Direct agent test setup complete');
    console.log('  Agent has toolRegistry:', !!agent.toolRegistry);
    console.log('  Agent has llmClient:', !!agent.llmClient);
  });

  describe('Tool Discovery Debug', () => {
    test('should find tools through agent search', async () => {
      console.log('🔍 Testing agent tool search...');
      
      const userInput = 'create image and display';
      
      try {
        const searchResults = await agent.searchForTools(userInput);
        
        console.log(`\\nSearch results for "${userInput}":`);
        console.log(`  Found ${searchResults.length} tools`);
        
        searchResults.forEach((tool, i) => {
          console.log(`  ${i + 1}. ${tool.name}: ${tool.description?.substring(0, 80)}...`);
        });
        
        const hasGenerate = searchResults.find(tool => tool.name === 'generate_image');
        const hasDisplay = searchResults.find(tool => tool.name === 'display_resource');
        
        console.log('\\n🎯 Key tools found:');
        console.log('  generate_image:', hasGenerate ? 'YES' : 'NO');
        console.log('  display_resource:', hasDisplay ? 'YES' : 'NO');
        
        expect(searchResults.length).toBeGreaterThan(0);
        
      } catch (error) {
        console.error('❌ Search failed:', error.message);
        console.error('Error stack:', error.stack);
        throw error;
      }
    });

    test('should test capability extraction', () => {
      console.log('🔍 Testing capability extraction...');
      
      const testInputs = [
        'create a picture of a scifi cat',
        'generate an image and show it',
        'make a cat image and display it'
      ];
      
      testInputs.forEach(input => {
        const capabilities = agent.extractCapabilities(input);
        console.log(`\\nInput: "${input}"`);
        console.log(`  Capabilities: [${capabilities.join(', ')}]`);
        
        expect(capabilities).toContain('generate image');
        expect(capabilities).toContain('display resource');
      });
    });

    test('should test direct tool registry access', async () => {
      console.log('🔧 Testing direct tool registry access...');
      
      try {
        const generateTool = await toolRegistry.getTool('generate_image');
        const displayTool = await toolRegistry.getTool('display_resource');
        
        console.log('\\nDirect tool access:');
        console.log('  generate_image:', generateTool ? 'FOUND' : 'NOT FOUND');
        console.log('  display_resource:', displayTool ? 'FOUND' : 'NOT FOUND');
        
        if (generateTool) {
          console.log('  Generate description:', generateTool.description);
        }
        if (displayTool) {
          console.log('  Display description:', displayTool.description);
        }
        
        expect(generateTool).toBeDefined();
        expect(displayTool).toBeDefined();
        
      } catch (error) {
        console.error('❌ Direct access failed:', error.message);
        throw error;
      }
    });
  });

  describe('Agent Planning Debug', () => {
    test('should debug complete agent processing', async () => {
      console.log('🤖 Testing complete agent message processing...');
      
      const userMessage = 'create a scifi cat picture and show it';
      
      try {
        const result = await agent.processMessage(userMessage);
        
        console.log('\\n📋 Agent processing result:');
        console.log('  Success:', result.success);
        console.log('  Response:', (result.userResponse || result.text || '').substring(0, 150));
        console.log('  Tools used:', result.toolsUsed || []);
        console.log('  Context updated:', result.contextUpdated || []);
        console.log('  Error:', result.error || 'none');
        
        // Check current search results
        console.log('\\n🔍 Agent search state:');
        console.log('  Current search results count:', agent.currentSearchResults?.length || 0);
        
        if (agent.currentSearchResults?.length > 0) {
          console.log('  Search results:');
          agent.currentSearchResults.forEach((tool, i) => {
            console.log(`    ${i + 1}. ${tool.name}: ${tool.description?.substring(0, 60)}...`);
          });
        }
        
        // Check execution context
        console.log('\\n💾 Execution context:');
        console.log('  Artifacts keys:', Object.keys(agent.executionContext.artifacts));
        console.log('  Chat history length:', agent.chatHistory.length);
        console.log('  Operation history length:', agent.operationHistory.length);
        
        // Should have found tools and attempted execution
        expect(result).toBeDefined();
        
      } catch (error) {
        console.error('❌ Agent processing failed:', error.message);
        console.error('Error stack:', error.stack);
        throw error;
      }
      
    }, 30000);
  });
});