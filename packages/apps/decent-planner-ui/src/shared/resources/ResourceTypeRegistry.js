/**
 * ResourceTypeRegistry - Maps file extensions to appropriate viewers and resource types
 * 
 * Provides centralized mapping between file extensions, viewer components, 
 * resource handle types, and programming languages for the transparent handle system.
 */

export class ResourceTypeRegistry {
  constructor() {
    this.extensionToViewer = new Map();
    this.extensionToResourceType = new Map();
    this.extensionToLanguage = new Map();
    
    // Initialize built-in mappings
    this._initializeBuiltInMappings();
  }
  
  /**
   * Initialize built-in extension mappings
   * @private
   */
  _initializeBuiltInMappings() {
    // Text files -> CodeEditor
    const textExtensions = ['.txt', '.js', '.ts', '.py', '.html', '.css', '.json', '.md', '.xml', '.yaml', '.yml'];
    textExtensions.forEach(ext => {
      this.extensionToViewer.set(ext, 'CodeEditor');
      this.extensionToResourceType.set(ext, 'FileHandle');
    });
    
    // Image files -> ImageViewer  
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
    imageExtensions.forEach(ext => {
      this.extensionToViewer.set(ext, 'ImageViewer');
      this.extensionToResourceType.set(ext, 'ImageHandle');
    });
    
    // Programming language mappings
    this.extensionToLanguage.set('.js', 'javascript');
    this.extensionToLanguage.set('.ts', 'typescript');
    this.extensionToLanguage.set('.py', 'python');
    this.extensionToLanguage.set('.html', 'html');
    this.extensionToLanguage.set('.css', 'css');
    this.extensionToLanguage.set('.json', 'json');
  }
  
  /**
   * Get viewer component for file extension
   * @param {string} extension - File extension (e.g., '.txt')
   * @returns {string} Viewer component name
   */
  getViewerForExtension(extension) {
    const normalizedExt = extension.toLowerCase();
    return this.extensionToViewer.get(normalizedExt) || 'CodeEditor';
  }
  
  /**
   * Get viewer component for file path
   * @param {string} path - File path
   * @returns {string} Viewer component name
   */
  getViewerForPath(path) {
    if (this.isDirectoryPath(path)) {
      return 'DirectoryBrowser';
    }
    
    const extension = this.extractExtension(path);
    return this.getViewerForExtension(extension);
  }
  
  /**
   * Get resource type for file path
   * @param {string} path - File path
   * @returns {string} Resource type name
   */
  getResourceTypeForPath(path) {
    if (this.isDirectoryPath(path)) {
      return 'DirectoryHandle';
    }
    
    const extension = this.extractExtension(path);
    const normalizedExt = extension.toLowerCase();
    return this.extensionToResourceType.get(normalizedExt) || 'FileHandle';
  }
  
  /**
   * Get programming language for file extension
   * @param {string} extension - File extension
   * @returns {string} Language name for syntax highlighting
   */
  getLanguageForExtension(extension) {
    const normalizedExt = extension.toLowerCase();
    return this.extensionToLanguage.get(normalizedExt) || 'javascript';
  }
  
  /**
   * Register a new extension mapping
   * @param {string} extension - File extension
   * @param {string} viewerType - Viewer component name
   */
  registerExtension(extension, viewerType) {
    if (this.extensionToViewer.has(extension)) {
      throw new Error(`Extension ${extension} already registered`);
    }
    this.extensionToViewer.set(extension, viewerType);
  }
  
  /**
   * Register a new resource type mapping
   * @param {string} extension - File extension
   * @param {string} resourceType - Resource handle type
   */
  registerResourceType(extension, resourceType) {
    this.extensionToResourceType.set(extension, resourceType);
  }
  
  /**
   * Check if a path represents a directory
   * @param {string} path - File path to check
   * @returns {boolean} True if path is a directory
   */
  isDirectoryPath(path) {
    // Simple heuristic: paths without extensions or ending with '/' are directories
    return path === '/' || (!path.includes('.') && !path.endsWith('.')) || path.endsWith('/');
  }
  
  /**
   * Extract file extension from path
   * @param {string} path - File path
   * @returns {string} File extension (lowercase) or empty string
   */
  extractExtension(path) {
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    const dotIndex = filename.lastIndexOf('.');
    
    if (dotIndex === -1 || dotIndex === 0) {
      return '';
    }
    
    return filename.substring(dotIndex).toLowerCase();
  }
}