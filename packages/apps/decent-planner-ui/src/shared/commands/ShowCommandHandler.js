/**
 * ShowCommandHandler - Processes /show commands and creates appropriate floating windows
 * 
 * Handles the complete flow from command parsing to resource request to window creation
 * with appropriate viewers (CodeEditor, ImageViewer, etc.)
 */

import { ResourceTypeRegistry } from '../resources/ResourceTypeRegistry.js';
import path from 'path';

export class ShowCommandHandler {
  constructor(resourceActor, container) {
    this.resourceActor = resourceActor;
    this.container = container;
    this.typeRegistry = new ResourceTypeRegistry();
    this.openWindows = new Map(); // path -> window instance
    this.pendingRequests = new Map(); // path -> { resolve, reject }
  }
  
  /**
   * Get viewer type for a resource path
   * @param {string} resourcePath - Path to the resource
   * @returns {string} Viewer component name
   */
  getViewerType(resourcePath) {
    return this.typeRegistry.getViewerForPath(resourcePath);
  }
  
  /**
   * Get resource type for a path
   * @param {string} resourcePath - Path to the resource  
   * @returns {string} Resource type (file, image, directory)
   */
  getResourceType(resourcePath) {
    if (this.typeRegistry.isDirectoryPath(resourcePath)) {
      return 'directory';
    }
    
    const extension = this.typeRegistry.extractExtension(resourcePath);
    const viewerType = this.typeRegistry.getViewerForExtension(extension);
    
    if (viewerType === 'ImageViewer') {
      return 'image';
    } else {
      return 'file';
    }
  }
  
  /**
   * Process a /show command
   * @param {string} resourcePath - Path to resource to show
   * @returns {Promise<Object>} Command result
   */
  async handleShowCommand(resourcePath) {
    console.log(`Processing /show command for: ${resourcePath}`);
    
    try {
      // Close existing window for this resource if open
      if (this.openWindows.has(resourcePath)) {
        const existingWindow = this.openWindows.get(resourcePath);
        existingWindow.close();
        this.openWindows.delete(resourcePath);
      }
      
      // Determine resource type and viewer
      const resourceType = this.getResourceType(resourcePath);
      const viewerType = this.getViewerType(resourcePath);
      
      console.log(`Resource type: ${resourceType}, Viewer type: ${viewerType}`);
      
      // Request resource handle
      await this.resourceActor.requestResource(resourcePath, resourceType);
      
      // Return success info
      return {
        success: true,
        path: resourcePath,
        resourceType,
        viewerType,
        message: `Requesting ${resourceType} resource: ${path.basename(resourcePath)}`
      };
      
    } catch (error) {
      console.error(`Failed to process /show command for ${resourcePath}:`, error);
      throw error;
    }
  }
  
  /**
   * Handle resource:ready events from ResourceClientSubActor
   * @param {Object} eventData - Resource ready event data
   * @returns {Object} Window creation result
   */
  handleResourceReady(eventData) {
    const { path: resourcePath, type, extension, handle } = eventData;
    
    console.log(`Resource ready for: ${resourcePath}`);
    
    // Determine viewer type
    const viewerType = this.getViewerType(resourcePath);
    
    // Create window and viewer (this will be implemented in Phase 5)
    const result = {
      windowCreated: true,
      viewerType,
      path: resourcePath,
      handle
    };
    
    console.log(`Would create ${viewerType} window for ${resourcePath}`);
    
    return result;
  }
  
  /**
   * Register a window for a resource path
   * @param {string} resourcePath - Resource path
   * @param {Object} window - Window instance
   */
  registerWindow(resourcePath, window) {
    // Close existing window if present
    if (this.openWindows.has(resourcePath)) {
      const existingWindow = this.openWindows.get(resourcePath);
      if (existingWindow.close) {
        existingWindow.close();
      }
    }
    
    this.openWindows.set(resourcePath, window);
    
    console.log(`Registered window for: ${resourcePath}`);
  }
  
  /**
   * Unregister a window
   * @param {string} resourcePath - Resource path
   */
  unregisterWindow(resourcePath) {
    this.openWindows.delete(resourcePath);
    console.log(`Unregistered window for: ${resourcePath}`);
  }
  
  /**
   * Get all open windows
   * @returns {Map} Map of path -> window
   */
  getOpenWindows() {
    return new Map(this.openWindows);
  }
  
  /**
   * Close all open windows
   */
  closeAllWindows() {
    for (const [path, window] of this.openWindows) {
      if (window.close) {
        window.close();
      }
    }
    this.openWindows.clear();
    console.log('Closed all windows');
  }
}