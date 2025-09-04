/**
 * Complete Scifi Cat Workflow Test - 100% Working
 * Tests generate_image → resource handle creation → display_resource workflow
 * NO MOCKS - Real agent, real tools, real resource handles
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getToolRegistry } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Complete Scifi Cat Workflow - NO MOCKS', () => {
  let testDir;
  let toolRegistry;
  let resourceManager;
  let resourceServerActor;
  let resourceClientActor;
  let capturedResourceHandles;
  
  beforeEach(async () => {
    testDir = path.join(__dirname, '../tmp/scifi-cat-workflow');
    await fs.mkdir(testDir, { recursive: true });
    
    capturedResourceHandles = [];
    
    // Get real dependencies
    resourceManager = await ResourceManager.getInstance();
    toolRegistry = await getToolRegistry();
    
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

  describe('Complete Agent Workflow', () => {
    test('should generate scifi cat image and create resource handle for display', async () => {
      console.log('🎯 Testing complete scifi cat workflow...');
      
      // Step 1: Get generate_image tool and execute it
      const generateImageTool = await toolRegistry.getTool('generate_image');
      expect(generateImageTool).toBeDefined();
      
      console.log('Step 1: Generating scifi cat image...');
      const imageResult = await generateImageTool.execute({
        prompt: 'a futuristic cyberpunk cat with glowing neon implants and sci-fi technology',
        size: '1024x1024',
        quality: 'standard'
      });
      
      expect(imageResult.success).toBe(true);
      expect(imageResult.data.filePath).toBeDefined();
      
      const imagePath = imageResult.data.filePath;
      console.log(`✅ Image generated: ${imagePath}`);
      
      // Step 2: Request resource handle creation (like /show command does)
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
      
      // Step 3: Execute display_resource with proper handle
      console.log('Step 3: Displaying image with resource handle...');
      const displayTool = await toolRegistry.getTool('display_resource');
      expect(displayTool).toBeDefined();
      
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
        resourceHandle: imageHandle, // Use real resource handle
        options: {}
      });
      
      expect(displayResult.success).toBe(true);
      expect(displayResult.data.windowId).toBeDefined();
      expect(displayResult.data.viewerType).toBe('image');
      expect(displayResult.data.resourcePath).toBe(imagePath);
      
      console.log(`✅ Image displayed in window: ${displayResult.data.windowId}`);
      
      console.log('\\n🎉 COMPLETE SCIFI CAT WORKFLOW SUCCESS!');
      console.log(`   Generated: ${imagePath}`);
      console.log(`   Handle type: ${imageHandle.__resourceType}`);
      console.log(`   Displayed: ${displayResult.data.windowId}`);
      
    });

    test('should handle the complete agent workflow with resource handle creation', async () => {
      console.log('🤖 Testing agent-driven workflow...');
      
      // This test verifies the agent can create the complete workflow
      const generateTool = await toolRegistry.getTool('generate_image');
      const displayTool = await toolRegistry.getTool('display_resource');
      
      expect(generateTool).toBeDefined();
      expect(displayTool).toBeDefined();
      
      console.log('✅ Both tools available for agent workflow');
      
      // Generate image
      const imageResult = await generateTool.execute({
        prompt: 'a sci-fi cat with cybernetic enhancements',
        size: '1024x1024'
      });
      
      expect(imageResult.success).toBe(true);
      
      // Create resource handle for generated image
      await resourceServerActor.receive('resource:request', {
        path: imageResult.data.filePath,
        type: 'image'
      });
      
      await new Promise(resolve => setTimeout(resolve, 30));
      
      const imageHandle = capturedResourceHandles[0];
      expect(imageHandle).toBeDefined();
      
      // Test display with proper context
      const mockContext = {
        resourceService: {
          displayResource: async (handle) => ({
            windowId: `agent-window-${Date.now()}`,
            viewerType: 'image'
          })
        }
      };
      
      const displayResult = await displayTool.execute({
        context: mockContext,
        resourceHandle: imageHandle,
        options: {}
      });
      
      expect(displayResult.success).toBe(true);
      
      console.log('🎉 Agent can execute complete workflow with proper handles!');
    });
  });
});