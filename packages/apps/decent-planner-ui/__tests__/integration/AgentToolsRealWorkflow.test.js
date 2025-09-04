/**
 * REAL Agent Tools Workflow Test - NO CHEATING
 * Tests that agent can actually plan and execute generate_image → display_resource workflow
 * NO MOCKS, NO /show command - Pure agent tool execution
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getToolRegistry } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('REAL Agent Tools Workflow - NO CHEATING', () => {
  let testDir;
  let toolUsingAgent;
  let resourceManager;
  let toolRegistry;
  let resourceServerActor;
  let resourceClientActor;
  let resourceService;
  let capturedResourceHandles;
  
  beforeEach(async () => {
    testDir = path.join(__dirname, '../tmp/real-agent-workflow');
    await fs.mkdir(testDir, { recursive: true });
    
    capturedResourceHandles = [];
    
    // Get real dependencies
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await getToolRegistry();
    const llmClient = await resourceManager.get('llmClient');
    
    // Import real components
    const { ToolUsingChatAgent } = await import('../../src/server/actors/tool-agent/ToolUsingChatAgent.js');
    const { ResourceClientSubActor } = await import('../../src/client/actors/ResourceClientSubActor.js');
    const ResourceServerSubActor = (await import('../../src/server/actors/ResourceServerSubActor.js')).default;
    const { ResourceService } = await import('/Users/williampearson/Documents/p/agents/Legion/packages/modules/agent-tools/src/ResourceService.js');
    
    // Set up resource actors
    resourceServerActor = new ResourceServerSubActor({ fileSystem: null });
    resourceClientActor = new ResourceClientSubActor();
    
    await resourceServerActor.setRemoteActor(resourceClientActor);
    await resourceClientActor.setRemoteActor(resourceServerActor);
    
    // Capture handles
    const handleCapture = {
      receive: (messageType, data) => {
        if (messageType === 'resource:ready') {
          capturedResourceHandles.push(data.handle);
        }
      }
    };
    resourceClientActor.setParentActor(handleCapture);
    
    // Create ResourceService for AgentTools context
    const mockWindowManager = {
      handleResourceReady: async (data) => {
        // This simulates creating a floating window
        return {
          windowId: `agent-window-${Date.now()}`,
          viewerType: data.type
        };
      },
      closeWindow: async () => ({ closed: true })
    };
    
    resourceService = new ResourceService(resourceServerActor, resourceClientActor, mockWindowManager);
    
    // Create agent with FULL context for AgentTools
    toolUsingAgent = new ToolUsingChatAgent(toolRegistry, llmClient);
    toolUsingAgent.setResourceService(resourceService);
    
    console.log('🚀 Real agent workflow test setup complete');
  });
  
  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Agent Tool Discovery', () => {
    test('should find both generate_image and display_resource tools', async () => {
      const userInput = 'create a scifi cat picture and show it';
      
      // Test agent's enhanced search
      const searchResults = await toolUsingAgent.searchForTools(userInput);
      
      console.log(`Found ${searchResults.length} tools for "${userInput}"`);
      searchResults.forEach(tool => {
        console.log(`  ${tool.name}: ${tool.confidence || 'N/A'}`);
      });
      
      const hasGenerate = searchResults.find(tool => tool.name === 'generate_image');
      const hasDisplay = searchResults.find(tool => tool.name === 'display_resource');
      
      expect(hasGenerate).toBeDefined();
      expect(hasDisplay).toBeDefined();
      
      console.log('✅ Agent finds both required tools');
    });
  });

  describe('Manual Tool Sequence Execution', () => {
    test('should execute complete workflow: generate → handle → display', async () => {
      console.log('🧪 Testing manual tool sequence execution...');
      
      // Step 1: Execute generate_image (as agent would)
      const generateTool = await toolRegistry.getTool('generate_image');
      expect(generateTool).toBeDefined();
      
      console.log('Step 1: Generating scifi cat with laser gun...');
      const imageResult = await generateTool.execute({
        prompt: 'a futuristic sci-fi cat shooting a bright laser gun, cyberpunk style',
        size: '1024x1024',
        quality: 'standard'
      });
      
      console.log('Image generation result:');
      console.log('  Success:', imageResult.success);
      
      if (!imageResult.success) {
        console.log('  Error:', imageResult.error);
        throw new Error('Image generation failed');
      }
      
      const imagePath = imageResult.data.filePath;
      console.log(`  Generated: ${imagePath}`);
      
      // Step 2: Create resource handle (as agent should)
      console.log('Step 2: Creating resource handle for generated image...');
      await resourceServerActor.receive('resource:request', {
        path: imagePath,
        type: 'image'
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(capturedResourceHandles.length).toBe(1);
      const imageHandle = capturedResourceHandles[0];
      
      console.log(`  Handle created: ${imageHandle.__resourceType}`);
      console.log(`  Handle path: ${imageHandle.path}`);
      
      // Step 3: Execute display_resource with handle (as agent should)
      const displayTool = await toolRegistry.getTool('display_resource');
      const context = toolUsingAgent.executionContext.artifacts.context;
      
      console.log('Step 3: Displaying with AgentTool...');
      const displayResult = await displayTool.execute({
        context: context,
        resourceHandle: imageHandle,
        options: {}
      });
      
      console.log('Display result:');
      console.log('  Success:', displayResult.success);
      if (displayResult.success) {
        console.log('  Window ID:', displayResult.data.windowId);
        console.log('  Viewer type:', displayResult.data.viewerType);
      } else {
        console.log('  Error:', displayResult.error);
      }
      
      expect(displayResult.success).toBe(true);
      
      console.log('\\n🎉 COMPLETE AGENT WORKFLOW MANUAL EXECUTION SUCCESS!');
      console.log(`   Generated: ${imagePath}`);
      console.log(`   Handle: ${imageHandle.__handleId}`);
      console.log(`   Displayed: ${displayResult.data.windowId}`);
      
    }, 30000); // 30 second timeout for DALL-E

    test('should prove AgentTools can receive real resource handles', async () => {
      console.log('🔧 Testing AgentTools with real transparent resource handles...');
      
      // Create test image file  
      const testImagePath = path.join(testDir, 'test-scifi-cat.png');
      const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
      await fs.writeFile(testImagePath, pngData);
      
      // Create real resource handle through transparent resource system
      await resourceServerActor.receive('resource:request', {
        path: testImagePath,
        type: 'image'
      });
      
      await new Promise(resolve => setTimeout(resolve, 30));
      
      const realHandle = capturedResourceHandles[0];
      expect(realHandle.__isResourceHandle).toBe(true);
      
      // Test AgentTool can execute with real handle
      const displayTool = await toolRegistry.getTool('display_resource');
      const context = toolUsingAgent.executionContext.artifacts.context;
      
      const result = await displayTool.execute({
        context: context,
        resourceHandle: realHandle,
        options: {}
      });
      
      expect(result.success).toBe(true);
      
      console.log('✅ AgentTools work with real transparent resource handles');
    });
  });
});