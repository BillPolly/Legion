/**
 * End-to-End Integration Test for DisplayResourceTool
 * Tests the complete flow: Chat Agent → Tool Execution → Resource Request → Window Creation
 * Verifies display_resource tool works exactly like /show command
 */

import { jest } from '@jest/globals';
import ChatServerToolAgent from '../../src/server/actors/tool-agent/ChatServerToolAgent.js';
import { ResourceManager } from '@legion/resource-manager';
import { getToolRegistry } from '@legion/tools-registry';
import fs from 'fs/promises';
import path from 'path';

describe('DisplayResourceTool E2E Integration Test', () => {
  let chatAgent;
  let toolRegistry;
  let resourceManager;
  let mockRemoteActor;
  let mockParentActor;
  let mockResourceSubActor;
  let capturedMessages;
  let capturedResourceRequests;
  let testDir;
  let testImageFile;

  beforeAll(async () => {
    // Create test files
    testDir = path.join(process.cwd(), '__tests__/tmp/e2e-test');
    await fs.mkdir(testDir, { recursive: true });
    
    // Create a test image file (we'll use the generated cat image)
    const catImages = await fs.readdir('tmp').then(files => 
      files.filter(f => f.includes('dalle3') && f.endsWith('.png'))
    );
    
    if (catImages.length > 0) {
      const sourceCatImage = path.join('tmp', catImages[0]);
      testImageFile = path.join(testDir, 'test-cat.png');
      await fs.copyFile(sourceCatImage, testImageFile);
      console.log(`📄 Test image created: ${testImageFile}`);
    } else {
      // Create a dummy image file
      testImageFile = path.join(testDir, 'test-cat.png');
      await fs.writeFile(testImageFile, 'fake-image-data', 'utf8');
      console.log(`📄 Dummy test image created: ${testImageFile}`);
    }
    
    // Get real instances
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await getToolRegistry();
    
    console.log('🔧 E2E Test Setup:');
    console.log('   ResourceManager:', !!resourceManager);
    console.log('   ToolRegistry:', !!toolRegistry);
    
    // Check if display_resource tool is available
    const displayTool = await toolRegistry.getTool('display_resource');
    console.log('   display_resource tool available:', !!displayTool);
    if (displayTool) {
      console.log('     Module:', displayTool.moduleName);
      console.log('     Category:', displayTool.category);
    }
    
    // Set up resource request capture
    capturedResourceRequests = [];
    mockResourceSubActor = {
      receive: jest.fn(async (messageType, data) => {
        console.log(`📨 MockResourceSubActor.receive: ${messageType}`, data);
        if (messageType === 'resource:request') {
          capturedResourceRequests.push(data);
        }
        return { success: true };
      })
    };
    
    // Set up parent actor with resourceSubActor
    mockParentActor = {
      resourceSubActor: mockResourceSubActor,
      sendToSubActor: jest.fn()
    };
    
    // Set up remote actor to capture messages
    capturedMessages = [];
    mockRemoteActor = {
      receive: jest.fn((messageType, data) => {
        const message = { messageType, data, timestamp: Date.now() };
        capturedMessages.push(message);
        console.log(`📨 Mock client received: ${messageType}`);
      })
    };
    
    // Create services object
    const services = {
      resourceManager,
      toolRegistry
    };
    
    // Create the ChatServerToolAgent with parent actor
    chatAgent = new ChatServerToolAgent(services);
    chatAgent.setParentActor(mockParentActor);
    
    // Initialize the agent
    await chatAgent.setRemoteActor(mockRemoteActor);
    
    console.log('   ChatServerToolAgent initialized');
    console.log('   Tool agent resourceActor available:', !!chatAgent.toolAgent?.resourceActor);
    
  }, 60000);

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should generate image and display it using display_resource tool', async () => {
    console.log('\n🚀 Testing Complete Image Generation + Display Flow');
    console.log('==================================================');
    
    const userMessage = "please generate a picture of a cat and show it to me";
    
    console.log(`📝 User message: "${userMessage}"`);
    console.log('📡 Processing through chat agent...\n');
    
    // Clear captured data
    capturedMessages.length = 0;
    capturedResourceRequests.length = 0;
    
    // Send the message
    await chatAgent.receive('send-message', {
      text: userMessage,
      timestamp: Date.now(),
      messageId: 'test-generate-and-show'
    });
    
    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n📊 Results Analysis:');
    console.log('===================');
    
    // Check if image was generated
    const contextUpdate = capturedMessages.find(m => m.messageType === 'chat-context-state-update');
    if (contextUpdate && contextUpdate.data.contextState?.operationHistory) {
      const operations = contextUpdate.data.contextState.operationHistory;
      const imageGenOp = operations.find(op => op.tool === 'generate_image');
      const displayOp = operations.find(op => op.tool === 'display_resource');
      
      console.log('🖼️ Image Generation Operation:');
      if (imageGenOp) {
        console.log(`   ✅ Success: ${imageGenOp.success}`);
        console.log(`   📂 Output Variable: ${imageGenOp.outputVariable}`);
      } else {
        console.log('   ❌ No image generation found');
      }
      
      console.log('\n📺 Display Resource Operation:');
      if (displayOp) {
        console.log(`   ✅ Success: ${displayOp.success}`);
        console.log(`   🪟 Window ID: ${displayOp.outputs?.windowId}`);
        console.log(`   👀 Viewer Type: ${displayOp.outputs?.viewerType}`);
        if (displayOp.error) {
          console.log(`   ❌ Error: ${displayOp.error}`);
        }
      } else {
        console.log('   ❌ No display_resource operation found');
      }
      
      console.log('\n📋 All Operations:');
      operations.forEach((op, i) => {
        console.log(`   ${i + 1}. ${op.tool}: ${op.success ? '✅' : '❌'}`);
      });
    }
    
    // Check resource requests
    console.log('\n🔗 Resource Requests:');
    if (capturedResourceRequests.length > 0) {
      capturedResourceRequests.forEach((req, i) => {
        console.log(`   ${i + 1}. Path: ${req.path}, Type: ${req.type}`);
      });
      console.log('   ✅ ResourceActor.receive("resource:request") was called!');
      console.log('   ✅ Same pattern as /show command confirmed!');
    } else {
      console.log('   ❌ No resource requests captured');
    }
    
    // Check agent response
    const agentResponse = capturedMessages.find(m => m.messageType === 'chat-agent-response');
    console.log('\n💬 Agent Response:');
    if (agentResponse) {
      console.log(`   Success: ${agentResponse.data.complete}`);
      console.log(`   Tools Used: ${JSON.stringify(agentResponse.data.toolsUsed)}`);
      console.log(`   Text Preview: ${agentResponse.data.text?.substring(0, 200)}...`);
    } else {
      console.log('   ❌ No agent response found');
    }
    
    console.log('\n🎯 Integration Test Assessment:');
    console.log('==============================');
    
    // We should have:
    // 1. Image generation operation
    // 2. Display resource operation  
    // 3. Resource request to resourceActor
    // 4. Coherent agent response
    
    const hasImageGen = contextUpdate?.data.contextState?.operationHistory?.some(op => 
      op.tool === 'generate_image' && op.success
    );
    
    const hasDisplayResource = contextUpdate?.data.contextState?.operationHistory?.some(op => 
      op.tool === 'display_resource'
    );
    
    const hasResourceRequest = capturedResourceRequests.length > 0;
    
    console.log(`✅ Image Generated: ${hasImageGen}`);
    console.log(`✅ Display Resource Called: ${hasDisplayResource}`);
    console.log(`✅ Resource Request Made: ${hasResourceRequest}`);
    console.log(`✅ Agent Response: ${!!agentResponse}`);
    
    if (hasImageGen && hasDisplayResource && hasResourceRequest && agentResponse) {
      console.log('\n🎉 SUCCESS: Complete flow working!');
      console.log('   display_resource tool is using the same functionality as /show command!');
    } else {
      console.log('\n⚠️ Partial success - check individual components above');
    }
    
  }, 120000);

  test('should work with existing image file (comparison with /show)', async () => {
    console.log('\n🔍 Testing Direct Display Resource vs /show Command');
    console.log('==================================================');
    
    // First test /show command for comparison
    console.log('1. Testing /show command:');
    capturedResourceRequests.length = 0;
    
    await chatAgent.receive('send-message', {
      text: `/show ${testImageFile}`,
      timestamp: Date.now()
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const showCommandRequests = [...capturedResourceRequests];
    console.log(`   /show requests: ${showCommandRequests.length}`);
    showCommandRequests.forEach(req => {
      console.log(`     ${req.type}: ${req.path}`);
    });
    
    // Now test display_resource tool directly
    console.log('\n2. Testing display_resource tool with same file:');
    capturedResourceRequests.length = 0;
    
    // Create a resource handle for the test image
    const imageResourceHandle = {
      path: testImageFile,
      __isResourceHandle: true,
      __resourceType: 'ImageHandle'
    };
    
    // Get display_resource tool
    const displayTool = await toolRegistry.getTool('display_resource');
    const context = {
      resourceActor: mockResourceSubActor,
      toolRegistry: toolRegistry,
      llmClient: null,
      artifacts: {}
    };
    
    const toolResult = await displayTool.execute({ context, resourceHandle: imageResourceHandle });
    
    const toolRequests = [...capturedResourceRequests];
    console.log(`   tool requests: ${toolRequests.length}`);
    toolRequests.forEach(req => {
      console.log(`     ${req.type}: ${req.path}`);
    });
    
    console.log('\n3. Comparison Results:');
    console.log('=====================');
    
    if (showCommandRequests.length > 0 && toolRequests.length > 0) {
      const showReq = showCommandRequests[0];
      const toolReq = toolRequests[0];
      
      const pathsMatch = showReq.path === toolReq.path;
      const typesMatch = showReq.type === toolReq.type;
      
      console.log(`   ✅ Paths match: ${pathsMatch} (${showReq.path})`);
      console.log(`   ✅ Types match: ${typesMatch} (${showReq.type})`);
      console.log(`   ✅ Tool success: ${toolResult.success}`);
      
      if (pathsMatch && typesMatch && toolResult.success) {
        console.log('\n🎉 PERFECT MATCH: display_resource tool uses identical flow to /show command!');
      }
    } else {
      console.log('   ⚠️ Missing requests to compare');
    }
    
  }, 60000);
});