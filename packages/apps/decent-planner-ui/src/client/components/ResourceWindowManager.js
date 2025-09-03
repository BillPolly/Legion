/**
 * ResourceWindowManager - Creates floating windows with appropriate viewers for resource handles
 * 
 * Handles the complete UI integration between resource handles and existing components:
 * - Window component for floating interface
 * - CodeEditor component for text files  
 * - ImageViewer component for images
 * - Future: DirectoryBrowser for directories
 */

import { ResourceTypeRegistry } from '../../shared/resources/ResourceTypeRegistry.js';

// Import UI components from frontend components package
// Note: These should be loaded via script tags in production
async function loadUIComponents() {
  try {
    // Try to access global components first (loaded via script tags)
    if (typeof global !== 'undefined' && global.Window && global.CodeEditor && global.ImageViewer) {
      return {
        Window: global.Window,
        CodeEditor: global.CodeEditor,
        ImageViewer: global.ImageViewer
      };
    }
    
    // In browser environment, components should be pre-loaded
    // For now, return placeholders that log the attempts
    return {
      Window: {
        create: (umbilical) => {
          console.log('🚨 Window component not available - would create window:', umbilical.title);
          return {
            contentElement: document.createElement('div'),
            setTitle: () => {},
            show: () => {},
            close: () => {},
            destroy: () => {}
          };
        }
      },
      CodeEditor: {
        create: (umbilical) => {
          console.log('🚨 CodeEditor component not available - would create editor for:', umbilical.content?.substring(0, 50));
          return {
            setContent: () => {},
            getContent: () => umbilical.content || '',
            destroy: () => {}
          };
        }
      },
      ImageViewer: {
        create: (umbilical) => {
          console.log('🚨 ImageViewer component not available - would show image:', umbilical.imageData?.substring(0, 50));
          return {
            loadImage: () => {},
            destroy: () => {}
          };
        }
      }
    };
  } catch (error) {
    console.error('Failed to load UI components:', error);
    throw error;
  }
}

export class ResourceWindowManager {
  constructor(container) {
    this.container = container;
    this.windows = new Map(); // path -> { window, viewer, handle }
    this.typeRegistry = new ResourceTypeRegistry();
    this.uiComponents = null; // Will be loaded on first use
  }
  
  /**
   * Load UI components on demand
   */
  async ensureComponentsLoaded() {
    if (!this.uiComponents) {
      this.uiComponents = await loadUIComponents();
    }
    return this.uiComponents;
  }
  
  /**
   * Handle resource:ready events from ResourceClientSubActor
   * @param {Object} eventData - Resource ready event data
   */
  async handleResourceReady(eventData) {
    const { path: resourcePath, type, extension, handle } = eventData;
    
    console.log(`ResourceWindowManager: Creating window for ${resourcePath}`);
    
    try {
      // Ensure UI components are loaded
      const components = await this.ensureComponentsLoaded();
      
      // Close existing window for this resource
      if (this.windows.has(resourcePath)) {
        this.closeWindow(resourcePath);
      }
      
      // Create floating window
      const window = await this.createWindow(resourcePath, components);
      
      // Create appropriate viewer based on resource type
      const viewer = await this.createViewer(type, extension, handle, window.contentElement, components);
      
      // Track window and viewer
      this.windows.set(resourcePath, {
        window,
        viewer,
        handle,
        type,
        path: resourcePath
      });
      
      // Show the window
      window.show();
      
      console.log(`✅ Created ${type} viewer for ${resourcePath}`);
      
      return { window, viewer };
      
    } catch (error) {
      console.error(`❌ Failed to create window for ${resourcePath}:`, error);
      throw error;
    }
  }
  
  /**
   * Create a floating window for the resource
   * @param {string} resourcePath - Path to the resource
   * @returns {Object} Window instance
   */
  createWindow(resourcePath, components) {
    const fileName = resourcePath.split('/').pop() || 'Resource';
    
    // Use Window component from loaded components
    const window = components.Window.create({
      dom: this.container,
      title: fileName,
      width: 800,
      height: 600,
      resizable: true,
      draggable: true,
      onClose: (windowInstance) => {
        this.closeWindow(resourcePath);
      }
    });
    
    return window;
  }
  
  /**
   * Create appropriate viewer for the resource type
   * @param {string} type - Resource type (file, image, directory)
   * @param {string} extension - File extension
   * @param {Object} handle - Transparent resource handle
   * @param {Element} container - Container element for the viewer
   * @returns {Object} Viewer instance
   */
  async createViewer(type, extension, handle, container) {
    switch (type) {
      case 'file':
        return await this.createFileViewer(extension, handle, container);
      case 'image':
        return await this.createImageViewer(handle, container);
      case 'directory':
        return await this.createDirectoryViewer(handle, container);
      default:
        // Default to file viewer
        return await this.createFileViewer(extension, handle, container);
    }
  }
  
  /**
   * Create CodeEditor for file resources
   */
  async createFileViewer(extension, handle, container) {
    // Read file content through transparent handle
    const content = await handle.read();
    
    // Detect programming language
    const language = this.typeRegistry.getLanguageForExtension(extension);
    
    // Create CodeEditor with transparent handle integration
    const editor = global.CodeEditor.create({
      dom: container,
      content: content,
      language: language,
      lineNumbers: true,
      autocompletion: true,
      onContentChange: async (newContent) => {
        // Write changes through transparent handle
        try {
          await handle.write(newContent);
          console.log('✅ File saved through transparent handle');
        } catch (error) {
          console.error('❌ Failed to save file:', error);
        }
      }
    });
    
    return editor;
  }
  
  /**
   * Create ImageViewer for image resources
   */
  async createImageViewer(handle, container) {
    // Get image URL through transparent handle
    const imageUrl = await handle.getUrl();
    
    // Create ImageViewer
    const viewer = global.ImageViewer.create({
      dom: container,
      imageData: imageUrl,
      showControls: true,
      showInfo: true
    });
    
    return viewer;
  }
  
  /**
   * Create DirectoryBrowser for directory resources (MVP: placeholder)
   */
  async createDirectoryViewer(handle, container) {
    // For MVP - create simple directory listing
    const contents = await handle.list();
    
    const listContainer = document.createElement('div');
    listContainer.style.padding = '20px';
    
    const title = document.createElement('h3');
    title.textContent = 'Directory Contents';
    listContainer.appendChild(title);
    
    const list = document.createElement('ul');
    contents.forEach(item => {
      const listItem = document.createElement('li');
      listItem.textContent = item;
      listItem.style.padding = '4px 0';
      list.appendChild(listItem);
    });
    listContainer.appendChild(list);
    
    container.appendChild(listContainer);
    
    return {
      destroy: () => {
        listContainer.remove();
      }
    };
  }
  
  /**
   * Close a window and clean up resources
   * @param {string} resourcePath - Path of the resource
   */
  closeWindow(resourcePath) {
    const windowData = this.windows.get(resourcePath);
    
    if (windowData) {
      const { window, viewer } = windowData;
      
      // Destroy viewer first
      if (viewer && viewer.destroy) {
        viewer.destroy();
      }
      
      // Destroy window
      if (window && window.destroy) {
        window.destroy();
      }
      
      // Remove from tracking
      this.windows.delete(resourcePath);
      
      console.log(`🗑️ Closed window for ${resourcePath}`);
    }
  }
  
  /**
   * Close all open windows
   */
  closeAllWindows() {
    for (const path of this.windows.keys()) {
      this.closeWindow(path);
    }
    console.log('🗑️ Closed all resource windows');
  }
  
  /**
   * Get window info for debugging
   */
  getWindowInfo() {
    const info = [];
    for (const [path, data] of this.windows) {
      info.push({
        path,
        type: data.type,
        handleId: data.handle.__handleId,
        resourceType: data.handle.__resourceType
      });
    }
    return info;
  }
}