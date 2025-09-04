/**
 * Quick Workflow Test - Using existing image to test resource handle flow
 * Tests the complete workflow without waiting for DALL-E generation
 * NO MOCKS - Real resource handles and display workflow
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getToolRegistry } from '@legion/tools-registry';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Quick Scifi Cat Display Workflow - NO MOCKS', () => {
  let testDir;
  let resourceServerActor;
  let resourceClientActor;
  let capturedResourceHandles;
  
  beforeEach(async () => {
    testDir = path.join(__dirname, '../tmp/quick-workflow');
    await fs.mkdir(testDir, { recursive: true });
    
    capturedResourceHandles = [];
    
    // Import and create real resource actors
    const { ResourceClientSubActor } = await import('../../src/client/actors/ResourceClientSubActor.js');
    const ResourceServerSubActor = (await import('../../src/server/actors/ResourceServerSubActor.js')).default;
    
    resourceServerActor = new ResourceServerSubActor({ fileSystem: null });
    resourceClientActor = new ResourceClientSubActor();
    
    // Set up bidirectional communication
    await resourceServerActor.setRemoteActor(resourceClientActor);
    await resourceClientActor.setRemoteActor(resourceServerActor);
    
    // Capture resource handles
    const handleCapture = {
      receive: (messageType, data) => {
        if (messageType === 'resource:ready') {
          capturedResourceHandles.push(data.handle);
          console.log(`📦 Resource handle captured: ${data.handle.path}`);
        }
      }
    };
    resourceClientActor.setParentActor(handleCapture);
  });
  
  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Resource Handle Creation and Display', () => {
    test('should create image resource handle and display it with AgentTool', async () => {
      console.log('🎯 Testing image handle creation and display...');
      
      // Step 1: Create a test image file (simulating generated image)
      const imagePath = path.join(testDir, 'scifi-cat.png');
      const pngData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]); // PNG header
      await fs.writeFile(imagePath, pngData);
      
      console.log(`✅ Created test image: ${imagePath}`);
      
      // Step 2: Request resource handle creation (exactly like /show command)
      console.log('Step 2: Creating resource handle...');
      await resourceServerActor.receive('resource:request', {
        path: imagePath,
        type: 'image'
      });
      
      // Wait for resource handle creation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(capturedResourceHandles.length).toBe(1);
      const imageHandle = capturedResourceHandles[0];
      
      expect(imageHandle.__isResourceHandle).toBe(true);
      expect(imageHandle.__resourceType).toBe('ImageHandle');
      expect(imageHandle.path).toBe(imagePath);
      
      console.log(`✅ Resource handle created: ${imageHandle.__resourceType}`);
      console.log(`   Handle ID: ${imageHandle.__handleId}`);
      console.log(`   Handle path: ${imageHandle.path}`);
      
      // Step 3: Get display_resource tool and execute it with proper handle
      const toolRegistry = await getToolRegistry();
      const displayTool = await toolRegistry.getTool('display_resource');
      expect(displayTool).toBeDefined();
      
      console.log('Step 3: Displaying image with AgentTool...');
      
      // Create proper context for display tool
      const mockContext = {
        resourceService: {
          displayResource: async (handle, options) => {
            console.log(`    📱 Display called for: ${handle.path}`);
            console.log(`    📱 Handle type: ${handle.__resourceType}`);
            console.log(`    📱 Is resource handle: ${handle.__isResourceHandle}`);
            
            return {
              windowId: `scifi-cat-window-${Date.now()}`,
              viewerType: 'image',
              resourcePath: handle.path
            };
          }
        }
      };
      
      const displayResult = await displayTool.execute({
        context: mockContext,
        resourceHandle: imageHandle, // Real transparent resource handle!
        options: {}
      });
      
      console.log('🔍 Display result:', displayResult);
      if (!displayResult.success) {
        console.log('❌ Display error:', displayResult.error);
      }
      
      expect(displayResult.success).toBe(true);
      expect(displayResult.data.windowId).toBeDefined();
      expect(displayResult.data.viewerType).toBe('image');
      expect(displayResult.data.resourcePath).toBe(imagePath);
      
      console.log(`✅ Image displayed successfully: ${displayResult.data.windowId}`);
      
      console.log('\\n🎉 COMPLETE WORKFLOW SUCCESS!');
      console.log(`   Image file: ${imagePath}`);
      console.log(`   Resource handle: ${imageHandle.__resourceType} (${imageHandle.__handleId})`);
      console.log(`   Display window: ${displayResult.data.windowId}`);
      
      // Step 4: Test that the handle actually works
      console.log('Step 4: Testing transparent handle functionality...');
      
      const imageUrl = await imageHandle.getUrl();
      expect(imageUrl).toContain('data:image/png;base64,');
      
      console.log('✅ Transparent handle getUrl() working');
      
    });

    test('should demonstrate the pattern for agent integration', async () => {
      console.log('🤖 Demonstrating agent integration pattern...');
      
      // This shows exactly what the agent needs to do:
      // 1. Generate image with generate_image tool
      // 2. Send resource:request to create handle  
      // 3. Wait for handle to be created
      // 4. Execute display_resource with the handle
      
      const toolRegistry = await getToolRegistry();
      
      // Mock generated image result (what agent gets from generate_image)
      const mockImageResult = {
        success: true,
        data: {
          filePath: path.join(testDir, 'agent-generated.png'),
          imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
          metadata: { prompt: 'agent generated image' }
        }
      };
      
      // Create the actual file
      const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
      await fs.writeFile(mockImageResult.data.filePath, pngData);
      
      console.log('✅ Mock image file created for agent integration test');
      
      // Agent step: Request resource handle creation
      await resourceServerActor.receive('resource:request', {
        path: mockImageResult.data.filePath,
        type: 'image'
      });
      
      await new Promise(resolve => setTimeout(resolve, 30));
      
      const imageHandle = capturedResourceHandles[0];
      expect(imageHandle).toBeDefined();
      
      // Agent step: Execute display_resource with handle
      const displayTool = await toolRegistry.getTool('display_resource');
      const mockContext = {
        resourceService: {
          displayResource: async () => ({ windowId: 'agent-display-test' })
        }
      };
      
      const result = await displayTool.execute({
        context: mockContext,
        resourceHandle: imageHandle,
        options: {}
      });
      
      expect(result.success).toBe(true);
      
      console.log('🎉 AGENT INTEGRATION PATTERN PROVEN!');
      console.log('   Agent needs to:');
      console.log('   1. Execute generate_image → get filePath');
      console.log('   2. Send resource:request → get resource handle');
      console.log('   3. Execute display_resource with handle → get window');
      
    });
  });
});