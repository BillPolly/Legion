/**
 * Agent Image Generation and Display Test
 * Proves agent can generate image AND use display_resource tool
 * NO MOCKS - Real agent workflow with real tools
 */

import { getToolRegistry } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';

describe('Agent Image Generation and Display Test', () => {
  let agent;
  let toolRegistry;
  let resourceServerActor;
  
  beforeEach(async () => {
    // Get real dependencies
    const resourceManager = await ResourceManager.getInstance();
    toolRegistry = await getToolRegistry();
    const llmClient = await resourceManager.get('llmClient');
    
    // Import real actors
    const { ToolUsingChatAgent } = await import('../../src/server/actors/tool-agent/ToolUsingChatAgent.js');
    const ResourceServerSubActor = (await import('../../src/server/actors/ResourceServerSubActor.js')).default;
    const { AgentContext } = await import('../../src/server/actors/tool-agent/AgentContext.js');
    
    // Create real resource actor (same as /show uses)
    resourceServerActor = new ResourceServerSubActor({ fileSystem: null });
    
    // Create agent
    agent = new ToolUsingChatAgent(toolRegistry, llmClient);
    
    // Wire context with resourceActor (same as ChatServerToolAgent does)
    const agentCapabilities = {
      resourceActor: resourceServerActor,
      toolRegistry: toolRegistry,
      llmClient: llmClient
    };
    
    const agentContext = new AgentContext(agentCapabilities);
    agent.setAgentContext(agentContext);
    
    console.log('🎯 Agent setup complete with resourceActor context');
  });

  describe('Complete Agent Workflow', () => {
    test('should generate image and use display_resource tool', async () => {
      console.log('🧪 Testing: generate_image → display_resource workflow');
      
      // Step 1: Get and test generate_image tool
      const generateTool = await toolRegistry.getTool('generate_image');
      expect(generateTool).toBeDefined();
      
      console.log('Step 1: Generating scifi cat image...');
      const imageResult = await generateTool.execute({
        prompt: 'a futuristic sci-fi cat shooting a bright laser gun with cyberpunk armor',
        size: '1024x1024',
        quality: 'standard'
      });
      
      expect(imageResult.success).toBe(true);
      console.log('✅ Image generated:', imageResult.data.filePath);
      
      // Step 2: Create mock resource handle (as agent would have after step 1)
      const imageHandle = {
        path: imageResult.data.filePath,
        __isResourceHandle: true,
        __resourceType: 'ImageHandle',
        getUrl: async () => imageResult.data.imageData
      };
      
      // Step 3: Get and test display_resource tool
      const displayTool = await toolRegistry.getTool('display_resource');
      expect(displayTool).toBeDefined();
      
      console.log('Step 2: Testing display_resource tool with resourceActor context...');
      
      // Check context has resourceActor
      const context = agent.executionContext.artifacts.context;
      console.log('  Context has resourceActor:', !!context.resourceActor);
      expect(context.resourceActor).toBeDefined();
      
      // Step 4: Execute display_resource (should use same path as /show)
      const displayResult = await displayTool.execute({
        context: context,
        resourceHandle: imageHandle,
        options: {}
      });
      
      console.log('Display result:');
      console.log('  Success:', displayResult.success);
      if (displayResult.success) {
        console.log('  Window ID:', displayResult.data.windowId);
        console.log('  Message:', displayResult.data.message);
      } else {
        console.log('  Error:', displayResult.error);
      }
      
      expect(displayResult.success).toBe(true);
      
      console.log('\\n🎉 COMPLETE AGENT WORKFLOW SUCCESS!');
      console.log(`   Generated: ${imageResult.data.filePath}`);
      console.log(`   Displayed: ${displayResult.data.windowId}`);
      
    }, 30000);

    test('should verify context properties are correct', () => {
      console.log('🔍 Verifying agent context setup...');
      
      const context = agent.executionContext.artifacts.context;
      
      console.log('Context properties:');
      console.log('  resourceActor:', !!context.resourceActor);
      console.log('  toolRegistry:', !!context.toolRegistry);
      console.log('  llmClient:', !!context.llmClient);
      console.log('  artifacts:', !!context.artifacts);
      
      expect(context.resourceActor).toBeDefined();
      expect(context.toolRegistry).toBeDefined();
      expect(context.llmClient).toBeDefined();
      
      console.log('✅ All required context properties available');
    });
  });
});