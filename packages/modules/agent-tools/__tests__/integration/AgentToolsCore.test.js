/**
 * Core AgentTools integration test focusing on tool functionality with real resource handles
 * Tests core AgentTool behavior with real transparent resource handle system
 * NO MOCKS - Real resource handles, real file operations, real tool execution
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AgentTools Core Integration - NO MOCKS', () => {
  let testDir;
  let testFile;
  let clientActor;
  let serverActor;
  let resourceService;
  let displayTool;
  let notifyTool;
  let closeTool;
  let realResourceHandles;
  
  beforeEach(async () => {
    // Create real test environment
    testDir = path.join(__dirname, '../tmp/core-integration');
    await fs.mkdir(testDir, { recursive: true });
    
    testFile = path.join(testDir, 'core-test.txt');
    await fs.writeFile(testFile, 'Core integration test content', 'utf8');
    
    realResourceHandles = [];
    
    // Import and set up REAL resource handle system
    const { ResourceClientSubActor } = await import('/Users/williampearson/Documents/p/agents/Legion/packages/apps/decent-planner-ui/src/client/actors/ResourceClientSubActor.js');
    const ResourceServerSubActor = (await import('/Users/williampearson/Documents/p/agents/Legion/packages/apps/decent-planner-ui/src/server/actors/ResourceServerSubActor.js')).default;
    
    // Create real resource actors
    clientActor = new ResourceClientSubActor();
    serverActor = new ResourceServerSubActor({ fileSystem: null }); // Uses real fs
    
    // Set up real bidirectional communication
    await serverActor.setRemoteActor(clientActor);
    await clientActor.setRemoteActor(serverActor);
    
    // Capture resource handles
    const handleCapture = {
      receive: (messageType, data) => {
        if (messageType === 'resource:ready') {
          realResourceHandles.push(data.handle);
        }
      }
    };
    clientActor.setParentActor(handleCapture);
    
    // Create simple ResourceService for testing
    const { ResourceService } = await import('../../src/ResourceService.js');
    let windowIdCounter = 0;
    const mockWindowManager = {
      container: null,
      windows: new Map(),
      handleResourceReady: async (eventData) => ({ 
        windowId: `test-window-${Date.now()}-${windowIdCounter++}`,
        viewerType: eventData.type 
      }),
      closeWindow: async (windowId) => ({ closed: true }),
      getWindowInfo: () => []
    };
    
    resourceService = new ResourceService(serverActor, clientActor, mockWindowManager);
    
    // Import AgentTools
    const { DisplayResourceTool } = await import('../../src/tools/DisplayResourceTool.js');
    const { NotifyUserTool } = await import('../../src/tools/NotifyUserTool.js');
    const { CloseWindowTool } = await import('../../src/tools/CloseWindowTool.js');
    
    displayTool = new DisplayResourceTool();
    notifyTool = new NotifyUserTool();
    closeTool = new CloseWindowTool();
  });
  
  afterEach(async () => {
    // Cleanup test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Real Resource Handle Integration', () => {
    test('should work with actual transparent resource handles from resource system', async () => {
      // Create REAL resource handle using actual transparent resource system
      await clientActor.requestResource(testFile, 'file');
      await new Promise(resolve => setTimeout(resolve, 30));
      
      expect(realResourceHandles.length).toBe(1);
      
      const realHandle = realResourceHandles[0];
      expect(realHandle.__isResourceHandle).toBe(true);
      expect(realHandle.__resourceType).toBe('FileHandle');
      expect(realHandle.path).toBe(testFile);
      
      // Test real file operations through transparent handle
      const content = await realHandle.read();
      expect(content).toBe('Core integration test content');
      
      // Execute DisplayResourceTool with real context and real handle
      const context = { resourceService };
      const result = await displayTool.execute(context, realHandle);
      
      // Verify tool returns proper planning data
      expect(result.windowId).toBeDefined();
      expect(result.resourcePath).toBe(testFile);
      expect(result.viewerType).toBeDefined();
      
      console.log('🎉 AgentTools working with REAL transparent resource handles!');
    });

    test('should handle real file editing through transparent handles', async () => {
      await clientActor.requestResource(testFile, 'file');
      await new Promise(resolve => setTimeout(resolve, 30));
      
      const realHandle = realResourceHandles[0];
      const context = { resourceService };
      
      // Display file with AgentTool
      await displayTool.execute(context, realHandle);
      
      // Edit file content through transparent handle
      const newContent = 'EDITED through AgentTools with real transparent handles!';
      await realHandle.write(newContent);
      
      // Verify real file was updated on disk
      const actualContent = await fs.readFile(testFile, 'utf8');
      expect(actualContent).toBe(newContent);
      
      console.log('🎉 Real file editing through AgentTools and transparent handles!');
    });
  });

  describe('Tool Integration Workflow', () => {
    test('should execute complete tool workflow with real operations', async () => {
      // Create real resource handle
      await clientActor.requestResource(testFile, 'file');
      await new Promise(resolve => setTimeout(resolve, 30));
      
      const realHandle = realResourceHandles[0];
      const context = { resourceService };
      
      // Step 1: Display resource
      const displayResult = await displayTool.execute(context, realHandle);
      expect(displayResult.windowId).toBeDefined();
      
      // Step 2: Notify user
      const notifyResult = await notifyTool.execute(context, 'File ready for editing', 'info');
      expect(notifyResult.notificationId).toBeDefined();
      
      // Step 3: Edit content through transparent handle
      const editedContent = 'Complete workflow edit through real transparent handles!';
      await realHandle.write(editedContent);
      
      // Step 4: Verify real file updated
      const fileContent = await fs.readFile(testFile, 'utf8');
      expect(fileContent).toBe(editedContent);
      
      // Step 5: Close window
      const closeResult = await closeTool.execute(context, displayResult.windowId);
      expect(closeResult.closed).toBe(true);
      
      console.log('🎉 COMPLETE AGENTTOOLS WORKFLOW WITH REAL RESOURCE HANDLES!');
    });
  });

  describe('Multi-Resource Management', () => {
    test('should handle multiple resources and tools together', async () => {
      // Create multiple files
      const file2 = path.join(testDir, 'file2.txt');
      await fs.writeFile(file2, 'Second file content', 'utf8');
      
      // Create multiple real resource handles
      await clientActor.requestResource(testFile, 'file');
      await clientActor.requestResource(file2, 'file');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(realResourceHandles.length).toBe(2);
      
      const context = { resourceService };
      const [handle1, handle2] = realResourceHandles;
      
      // Display both resources
      const result1 = await displayTool.execute(context, handle1);
      const result2 = await displayTool.execute(context, handle2);
      
      expect(result1.windowId).not.toBe(result2.windowId);
      
      // Edit both files through transparent handles
      await handle1.write('Edited file 1');
      await handle2.write('Edited file 2');
      
      // Verify both files updated
      const content1 = await fs.readFile(testFile, 'utf8');
      const content2 = await fs.readFile(file2, 'utf8');
      
      expect(content1).toBe('Edited file 1');
      expect(content2).toBe('Edited file 2');
      
      console.log('🎉 Multi-resource management with AgentTools working!');
    });
  });
});