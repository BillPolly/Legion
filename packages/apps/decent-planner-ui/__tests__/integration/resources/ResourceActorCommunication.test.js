/**
 * Integration tests for ResourceClientSubActor ↔ ResourceServerSubActor communication
 * Tests complete resource handle lifecycle with real actor communication
 * NO MOCKS - uses real actors communicating through protocol
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Resource Actor Communication Integration - NO MOCKS', () => {
  let clientActor;
  let serverActor;
  let testDir;
  let testFile;
  
  beforeEach(async () => {
    // Create real test directory and file
    testDir = path.join(__dirname, '../../tmp/resource-tests');
    await fs.mkdir(testDir, { recursive: true });
    
    testFile = path.join(testDir, 'test-file.txt');
    await fs.writeFile(testFile, 'initial content', 'utf8');
    
    // Create real file system wrapper (not mock)
    const realFileSystem = {
      readFile: async (filePath, encoding = 'utf8') => {
        return await fs.readFile(filePath, encoding);
      },
      writeFile: async (filePath, content, encoding = 'utf8') => {
        await fs.writeFile(filePath, content, encoding);
        return true;
      },
      stat: async (filePath) => {
        return await fs.stat(filePath);
      },
      readdir: async (dirPath) => {
        return await fs.readdir(dirPath);
      }
    };
    
    // Import actors
    const { ResourceClientSubActor } = await import('../../../src/client/actors/ResourceClientSubActor.js');
    const ResourceServerSubActor = (await import('../../../src/server/actors/ResourceServerSubActor.js')).default;
    
    // Create actors with real dependencies
    clientActor = new ResourceClientSubActor();
    serverActor = new ResourceServerSubActor({ fileSystem: realFileSystem });
    
    // Set up bidirectional communication
    await serverActor.setRemoteActor(clientActor);
    await clientActor.setRemoteActor(serverActor);
    
    // Set parent to capture resource:ready events
    const parentCapture = { capturedEvents: [] };
    parentCapture.receive = (messageType, data) => {
      parentCapture.capturedEvents.push({ messageType, data });
    };
    clientActor.setParentActor(parentCapture);
    clientActor.parentCapture = parentCapture; // Store for access in tests
  });
  
  afterEach(async () => {
    // Cleanup test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Resource Handle Lifecycle - REAL FILES', () => {
    test('should create file handle and read real file content', async () => {
      // Request file resource
      await clientActor.requestResource(testFile, 'file');
      
      // Wait for handle creation
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Should have received resource:ready
      const readyEvent = clientActor.parentCapture.capturedEvents.find(e => e.messageType === 'resource:ready');
      expect(readyEvent).toBeDefined();
      expect(readyEvent.data.path).toBe(testFile);
      expect(readyEvent.data.handle.__isResourceHandle).toBe(true);
      
      // Use the transparent handle to read REAL file
      const handle = readyEvent.data.handle;
      const content = await handle.read();
      
      expect(content).toBe('initial content');
    });

    test('should write to real file through transparent handle', async () => {
      await clientActor.requestResource(testFile, 'file');
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const readyEvent = clientActor.parentCapture.capturedEvents.find(e => e.messageType === 'resource:ready');
      const handle = readyEvent.data.handle;
      
      // Write new content through transparent handle
      await handle.write('updated content');
      
      // Verify real file was updated
      const actualContent = await fs.readFile(testFile, 'utf8');
      expect(actualContent).toBe('updated content');
    });

    test('should handle real directory operations', async () => {
      await clientActor.requestResource(testDir, 'directory');
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const readyEvent = clientActor.parentCapture.capturedEvents.find(e => e.messageType === 'resource:ready');
      const dirHandle = readyEvent.data.handle;
      
      // List real directory contents
      const contents = await dirHandle.list();
      expect(contents).toContain('test-file.txt');
      
      // Create new file through handle
      const result = await dirHandle.createFile('new-file.txt');
      expect(result).toBe(true); // For MVP, just return success
      
      // Verify real file was created
      const newFilePath = path.join(testDir, 'new-file.txt');
      const exists = await fs.stat(newFilePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    test('should handle real image file metadata', async () => {
      // Create a simple test image file (just binary data for testing)
      const imagePath = path.join(testDir, 'test-image.png');
      await fs.writeFile(imagePath, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])); // PNG header
      
      await clientActor.requestResource(imagePath, 'image');
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const readyEvent = clientActor.parentCapture.capturedEvents.find(e => e.messageType === 'resource:ready');
      const imageHandle = readyEvent.data.handle;
      
      // Get real metadata
      const metadata = await imageHandle.getMetadata();
      expect(metadata.size).toBeGreaterThan(0);
      expect(metadata.extension).toBe('png');
    });
  });

  describe('Error Handling - FAIL FAST', () => {
    test('should fail fast for non-existent files', async () => {
      const nonExistentFile = path.join(testDir, 'does-not-exist.txt');
      
      await clientActor.requestResource(nonExistentFile, 'file');
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const readyEvent = clientActor.parentCapture.capturedEvents.find(e => e.messageType === 'resource:ready');
      const handle = readyEvent.data.handle;
      
      // Should fail fast when trying to read non-existent file
      await expect(handle.read()).rejects.toThrow();
    });
  });

  describe('Multiple Handle Management', () => {
    test('should manage multiple concurrent handles', async () => {
      // Create multiple test files
      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.txt');
      
      await fs.writeFile(file1, 'content 1', 'utf8');
      await fs.writeFile(file2, 'content 2', 'utf8');
      
      // Request multiple handles
      await clientActor.requestResource(file1, 'file');
      await clientActor.requestResource(file2, 'file');
      
      await new Promise(resolve => setTimeout(resolve, 30));
      
      // Should have two handles
      expect(clientActor.proxies.size).toBe(2);
      expect(serverActor.resourceManager.handles.size).toBe(2);
      
      // Both handles should work independently
      const events = clientActor.parentCapture.capturedEvents.filter(e => e.messageType === 'resource:ready');
      expect(events).toHaveLength(2);
      
      const handle1 = events.find(e => e.data.path === file1).data.handle;
      const handle2 = events.find(e => e.data.path === file2).data.handle;
      
      const content1 = await handle1.read();
      const content2 = await handle2.read();
      
      expect(content1).toBe('content 1');
      expect(content2).toBe('content 2');
    });
  });
});