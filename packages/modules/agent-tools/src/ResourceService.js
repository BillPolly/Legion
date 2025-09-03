/**
 * ResourceService - Context service for AgentTools UI operations
 * 
 * Provides the context.resourceService interface that AgentTools use to
 * interact with the transparent resource handle system and UI components.
 */

import path from 'path';

export class ResourceService {
  constructor(resourceServerActor, resourceClientActor, windowManager) {
    // Validate required dependencies (fail fast)
    if (!resourceServerActor) {
      throw new Error('ResourceServer is required');
    }
    if (!resourceClientActor) {
      throw new Error('ResourceClient is required');
    }
    if (!windowManager) {
      throw new Error('WindowManager is required');
    }
    
    this.resourceServer = resourceServerActor;
    this.resourceClient = resourceClientActor;
    this.windowManager = windowManager;
    
    // Generate unique IDs for notifications and windows
    this.idCounter = 0;
  }
  
  /**
   * Display resource handle in appropriate floating window
   * @param {Object} resourceHandle - Resource handle to display
   * @param {Object} options - Display options {viewerType, windowId}
   * @returns {Object} Window information
   */
  async displayResource(resourceHandle, options = {}) {
    // Validate resource handle (fail fast)
    if (!resourceHandle) {
      throw new Error('Resource handle is required');
    }
    
    if (!resourceHandle.__isResourceHandle || !resourceHandle.path) {
      throw new Error('Invalid resource handle - must have __isResourceHandle and path properties');
    }
    
    console.log(`ResourceService: Displaying resource ${resourceHandle.path}`);
    
    try {
      // Prepare resource ready event data
      const eventData = {
        path: resourceHandle.path,
        type: this._detectResourceType(resourceHandle),
        extension: this._getExtension(resourceHandle.path),
        handle: resourceHandle,
        viewerType: options.viewerType,
        windowId: options.windowId
      };
      
      // For testing: if global components are available, create window directly
      if (typeof global !== 'undefined' && global.Window) {
        let window;
        let viewer;
        let windowId = options.windowId;
        
        // Check if we're reusing an existing window
        if (options.windowId && this.windowManager.windows.has(resourceHandle.path)) {
          const existingData = this.windowManager.windows.get(resourceHandle.path);
          window = existingData.window;
          viewer = existingData.viewer;
          windowId = options.windowId;
          
          // Update viewer content
          if (viewer.setContent) {
            const content = await resourceHandle.read();
            viewer.setContent(content);
          }
        } else {
          // Create new window
          window = global.Window.create({
            dom: this.windowManager.container,
            title: path.basename(resourceHandle.path),
            width: 800,
            height: 600
          });
          
          viewer = await this._createViewer(eventData.type, eventData.extension, resourceHandle, window.contentElement);
          windowId = windowId || this._generateWindowId(resourceHandle.path);
        }
        
        window.show();
        
        // Track window in window manager for consistency
        this.windowManager.windows.set(resourceHandle.path, {
          window,
          viewer,
          handle: resourceHandle,
          type: eventData.type,
          path: resourceHandle.path
        });
        
        return {
          windowId,
          viewerType: options.viewerType || eventData.type,
          resourcePath: resourceHandle.path
        };
      } else {
        // Production: use real window manager
        const result = await this.windowManager.handleResourceReady(eventData);
        return {
          windowId: result.windowId || options.windowId || this._generateWindowId(resourceHandle.path),
          viewerType: result.viewerType || 'auto',
          resourcePath: resourceHandle.path
        };
      }
      
      
    } catch (error) {
      console.error('ResourceService.displayResource failed:', error);
      throw error; // NO FALLBACKS - fail fast
    }
  }
  
  /**
   * Show notification to user
   * @param {string} message - Message to display
   * @param {string} type - Notification type
   * @param {number} duration - Display duration
   * @returns {Object} Notification information
   */
  async showNotification(message, type = 'info', duration = 3000) {
    console.log(`ResourceService: Showing ${type} notification: ${message}`);
    
    // For MVP: Create simple notification (could be enhanced with actual UI)
    const notificationId = this._generateNotificationId();
    
    // In full implementation, this would create actual UI notification elements
    
    return {
      notificationId,
      message,
      type,
      duration,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Close floating window by ID
   * @param {string} windowId - Window ID to close
   * @returns {Object} Close result
   */
  async closeWindow(windowId) {
    if (!windowId) {
      throw new Error('Window ID is required');
    }
    
    console.log(`ResourceService: Closing window ${windowId}`);
    
    try {
      const result = await this.windowManager.closeWindow(windowId);
      
      return {
        windowId,
        closed: result?.closed || true
      };
      
    } catch (error) {
      console.error('ResourceService.closeWindow failed:', error);
      throw error; // NO FALLBACKS - fail fast
    }
  }
  
  /**
   * Get list of open windows
   * @returns {Array} Array of window information
   */
  async getOpenWindows() {
    return this.windowManager.getWindowInfo();
  }
  
  /**
   * Detect resource type from handle
   * @private
   */
  _detectResourceType(handle) {
    if (handle.__resourceType === 'ImageHandle') return 'image';
    if (handle.__resourceType === 'DirectoryHandle') return 'directory';
    return 'file';
  }
  
  /**
   * Get file extension from path
   * @private
   */
  _getExtension(path) {
    const parts = path.split('.');
    return parts.length > 1 ? '.' + parts.pop().toLowerCase() : '';
  }
  
  /**
   * Generate unique window ID
   * @private
   */
  _generateWindowId(path) {
    return `window-${path.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Generate unique notification ID
   * @private
   */
  _generateNotificationId() {
    return `notification-${Date.now()}-${this.idCounter++}`;
  }
  
  /**
   * Create viewer for testing environment
   * @private
   */
  async _createViewer(type, extension, handle, container) {
    switch (type) {
      case 'file':
        if (global.CodeEditor) {
          const content = await handle.read();
          return global.CodeEditor.create({
            dom: container,
            content: content,
            onContentChange: async (newContent) => {
              await handle.write(newContent);
            }
          });
        }
        break;
      case 'image':
        if (global.ImageViewer && handle.getUrl) {
          const imageUrl = await handle.getUrl();
          return global.ImageViewer.create({
            dom: container,
            imageData: imageUrl
          });
        }
        break;
    }
    
    return { destroy: () => {} };
  }
}