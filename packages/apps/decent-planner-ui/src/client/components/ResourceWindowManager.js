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

// Import UI components from Legion frontend components package
async function loadUIComponents() {
  try {
    console.log('🔄 Loading Legion UI components...');
    
    // Import only Window and ImageViewer components (CodeEditor has complex dependencies)
    const [WindowModule, ImageViewerModule] = await Promise.all([
      import('/legion/components/src/components/window/index.js'),
      import('/legion/components/src/components/image-viewer/index.js')
    ]);
    
    console.log('✅ Successfully loaded Legion Window and ImageViewer components');
    
    // Create simplified CodeEditor for MVP
    const SimpleCodeEditor = {
      create: (umbilical) => {
        console.log('✅ Creating simplified CodeEditor for MVP');
        
        // Create textarea-based editor
        const textarea = document.createElement('textarea');
        textarea.style.cssText = `
          width: 100%;
          height: 100%;
          border: none;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          padding: 16px;
          resize: none;
          outline: none;
          background: #fafafa;
          border-radius: 4px;
        `;
        textarea.value = umbilical.content || '';
        
        // Handle content changes with transparent handle integration
        textarea.addEventListener('input', () => {
          if (umbilical.onContentChange) {
            umbilical.onContentChange(textarea.value);
          }
        });
        
        umbilical.dom.appendChild(textarea);
        
        return {
          setContent: (content) => textarea.value = content,
          getContent: () => textarea.value,
          destroy: () => textarea.remove()
        };
      }
    };
    
    return {
      Window: WindowModule.Window,
      CodeEditor: SimpleCodeEditor,
      ImageViewer: ImageViewerModule.ImageViewer
    };
    
  } catch (error) {
    console.error('❌ Failed to load Legion UI components:', error);
    throw new Error(`UI components not available: ${error.message}. Legion components must be properly served on /legion/ routes.`);
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
  async createViewer(type, extension, handle, container, components) {
    switch (type) {
      case 'file':
        return await this.createFileViewer(extension, handle, container, components);
      case 'image':
        return await this.createImageViewer(handle, container, components);
      case 'directory':
        return await this.createDirectoryViewer(handle, container, components);
      default:
        // Default to file viewer
        return await this.createFileViewer(extension, handle, container, components);
    }
  }
  
  /**
   * Create CodeEditor for file resources
   */
  async createFileViewer(extension, handle, container, components) {
    // Read file content through transparent handle
    const content = await handle.read();
    
    // Detect programming language
    const language = this.typeRegistry.getLanguageForExtension(extension);
    
    // Create CodeEditor with transparent handle integration
    const editor = components.CodeEditor.create({
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
  async createImageViewer(handle, container, components) {
    // Get image URL through transparent handle
    const imageUrl = await handle.getUrl();
    
    // Create ImageViewer
    const viewer = components.ImageViewer.create({
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
  async createDirectoryViewer(handle, container, components) {
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