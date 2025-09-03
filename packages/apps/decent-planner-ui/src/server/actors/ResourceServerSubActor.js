/**
 * ResourceServerSubActor - Dedicated server actor for resource management operations
 * Provides point-to-point communication with ResourceClientSubActor
 * Handles: file operations, image operations, directory operations
 */

import { ResourceHandleManager } from '../../shared/resources/ResourceHandleManager.js';
import { ResourceTypeRegistry } from '../../shared/resources/ResourceTypeRegistry.js';
import fs from 'fs/promises';
import path from 'path';

export default class ResourceServerSubActor {
  constructor(services) {
    this.services = services;
    this.remoteActor = null;
    this.parentActor = null;
    
    // Initialize resource management
    this.resourceManager = new ResourceHandleManager();
    this.typeRegistry = new ResourceTypeRegistry();
    this.fileSystem = services.fileSystem || this.createFileSystemWrapper();
    
    // State
    this.state = {
      connected: false,
      processing: false,
      handlesCreated: 0,
      initialized: false
    };
  }

  setParentActor(parentActor) {
    this.parentActor = parentActor;
  }

  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    this.state.connected = true;
    this.state.initialized = true;
    
    console.log('🎭 Resource server sub-actor connected');
    
    // Send ready signal
    this.remoteActor.receive('ready', {
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Create a file system wrapper compatible with handle expectations
   */
  createFileSystemWrapper() {
    return {
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
      },
      
      mkdir: async (dirPath) => {
        await fs.mkdir(dirPath, { recursive: true });
        return true;
      },
      
      unlink: async (filePath) => {
        await fs.unlink(filePath);
        return true;
      },
      
      rmdir: async (dirPath) => {
        await fs.rmdir(dirPath);
        return true;
      },
      
      watch: async (filePath, callback) => {
        // For MVP - just return a dummy watcher
        return { close: () => {} };
      }
    };
  }

  receive(messageType, data) {
    console.log('📨 Resource server received:', messageType);
    
    switch (messageType) {
      case 'resource:request':
        this.handleResourceRequest(data);
        break;
        
      case 'resource:call':
        this.handleResourceCall(data);
        break;
        
      case 'resource:release':
        this.handleResourceRelease(data);
        break;
        
      default:
        console.warn(`ResourceServerSubActor: Unknown message type: ${messageType}`);
    }
  }

  async handleResourceRequest(data) {
    try {
      const { path, type } = data;
      console.log('Creating resource handle for:', path, type);
      
      let handle;
      let resourceType;
      
      // Create appropriate handle based on type
      if (type === 'file') {
        handle = this.resourceManager.createFileHandle(path, this.fileSystem);
        resourceType = 'FileHandle';
      } else if (type === 'image') {
        handle = this.resourceManager.createImageHandle(path, this.fileSystem);
        resourceType = 'ImageHandle';
      } else if (type === 'directory') {
        handle = this.resourceManager.createDirectoryHandle(path, this.fileSystem);
        resourceType = 'DirectoryHandle';
      } else {
        // Default to file handle
        handle = this.resourceManager.createFileHandle(path, this.fileSystem);
        resourceType = 'FileHandle';
      }
      
      // Track the handle
      this.resourceManager.trackHandle(handle.handleId, handle);
      this.state.handlesCreated++;
      
      // Send handle metadata to client (not the actual handle)
      const handleMetadata = {
        handleId: handle.handleId,
        resourceType: resourceType,
        methodSignatures: this.resourceManager.getResourceType(resourceType),
        metadata: {
          path: path,
          extension: this.typeRegistry.extractExtension(path),
          type: type
        }
      };
      
      this.remoteActor.receive('resource:handle', handleMetadata);
      
    } catch (error) {
      console.error('Error creating resource handle:', error);
      this.remoteActor.receive('resource:error', {
        path: data.path,
        error: error.message
      });
    }
  }

  async handleResourceCall(data) {
    try {
      const { handleId, method, args } = data;
      
      // Get the real handle
      const handle = this.resourceManager.getHandle(handleId);
      if (!handle) {
        throw new Error(`Handle ${handleId} not found`);
      }
      
      console.log(`Executing ${method} on handle ${handleId} with args:`, args);
      
      // Execute method on real handle
      const result = await handle[method](...args);
      
      
      // Send result back to client
      this.remoteActor.receive('resource:result', {
        handleId,
        method,
        result
      });
      
    } catch (error) {
      console.error('Error executing resource method:', error);
      this.remoteActor.receive('resource:result', {
        handleId: data.handleId,
        method: data.method,
        error: error.message
      });
    }
  }

  async handleResourceRelease(data) {
    const { handleId } = data;
    
    console.log('Releasing handle:', handleId);
    this.resourceManager.releaseHandle(handleId);
    
    // Acknowledge release
    this.remoteActor.receive('resource:released', { handleId });
  }

  // Get actor metadata for debugging
  getMetadata() {
    return {
      type: 'ResourceServerSubActor',
      connected: this.state.connected,
      handlesCreated: this.state.handlesCreated,
      activeHandles: this.resourceManager.handles.size
    };
  }
}