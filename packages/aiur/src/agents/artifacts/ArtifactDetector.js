import { promises as fs } from 'fs';
import path from 'path';

/**
 * ArtifactDetector - Analyzes tool results to identify and extract artifacts
 * 
 * This class scans tool execution results to find files, documents, code, images,
 * and other artifacts that should be displayed to the user in the chat interface.
 */
export class ArtifactDetector {
  constructor() {
    // File extensions for different artifact types
    this.typeMap = {
      code: [
        'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'php',
        'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'clj', 'fs', 'ml', 'hs',
        'lua', 'pl', 'r', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat'
      ],
      markup: ['html', 'htm', 'xml', 'svg', 'jsx', 'vue', 'svelte'],
      stylesheet: ['css', 'scss', 'sass', 'less', 'styl'],
      config: [
        'json', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env',
        'gitignore', 'dockerignore', 'editorconfig'
      ],
      document: [
        'md', 'txt', 'rtf', 'pdf', 'doc', 'docx', 'odt',
        'tex', 'rst', 'adoc', 'org'
      ],
      image: [
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff',
        'ico', 'avif', 'heic'
      ],
      data: ['csv', 'tsv', 'xls', 'xlsx', 'db', 'sqlite', 'sql'],
      archive: ['zip', 'tar', 'gz', 'bz2', '7z', 'rar'],
      executable: ['exe', 'app', 'deb', 'rpm', 'dmg', 'pkg']
    };

    // MIME type mapping for content-based detection
    this.mimeMap = {
      'text/javascript': 'code',
      'application/javascript': 'code',
      'text/html': 'markup',
      'text/css': 'stylesheet',
      'application/json': 'config',
      'text/markdown': 'document',
      'text/plain': 'document',
      'image/png': 'image',
      'image/jpeg': 'image',
      'image/gif': 'image',
      'image/webp': 'image',
      'image/svg+xml': 'image',
      'text/csv': 'data',
      'application/pdf': 'document'
    };
  }

  /**
   * Analyze tool results to detect artifacts
   * @param {string} toolName - Name of the tool that was executed
   * @param {Object} toolResult - Result object from tool execution
   * @returns {Promise<Array>} Array of detected artifacts
   */
  async detectArtifacts(toolName, toolResult) {
    const artifacts = [];

    if (!toolResult || typeof toolResult !== 'object') {
      return artifacts;
    }

    try {
      // Strategy 1: Look for explicit file paths in result
      const filePaths = this.extractFilePaths(toolResult);
      for (const filePath of filePaths) {
        const artifact = await this.analyzeFilePath(filePath, toolName);
        if (artifact) {
          artifacts.push(artifact);
        }
      }

      // Strategy 2: Look for content-based artifacts
      const contentArtifacts = this.extractContentArtifacts(toolResult, toolName);
      artifacts.push(...contentArtifacts);

      // Strategy 3: Look for URLs and links
      const urlArtifacts = this.extractUrlArtifacts(toolResult, toolName);
      artifacts.push(...urlArtifacts);

      // Strategy 4: Tool-specific artifact detection
      const toolSpecificArtifacts = this.detectToolSpecificArtifacts(toolName, toolResult);
      artifacts.push(...toolSpecificArtifacts);

    } catch (error) {
      console.warn('Error detecting artifacts:', error);
    }

    return artifacts;
  }

  /**
   * Extract file paths from tool result
   * @param {Object} toolResult - Tool execution result
   * @returns {Array<string>} Array of file paths found
   */
  extractFilePaths(toolResult) {
    const filePaths = [];
    
    // Common keys that might contain file paths
    const pathKeys = ['path', 'filePath', 'file', 'output', 'outputPath', 'location'];
    
    const extractFromValue = (value) => {
      if (typeof value === 'string') {
        // Check if it looks like a file path
        if (this.looksLikeFilePath(value)) {
          filePaths.push(value);
        }
      } else if (Array.isArray(value)) {
        value.forEach(extractFromValue);
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(extractFromValue);
      }
    };

    // Check specific keys first
    pathKeys.forEach(key => {
      if (toolResult[key]) {
        extractFromValue(toolResult[key]);
      }
    });

    // Then check all values recursively
    Object.values(toolResult).forEach(extractFromValue);

    return [...new Set(filePaths)]; // Remove duplicates
  }

  /**
   * Check if a string looks like a file path
   * @param {string} str - String to check
   * @returns {boolean} True if it looks like a file path
   */
  looksLikeFilePath(str) {
    if (!str || typeof str !== 'string') return false;
    
    // Basic file path patterns
    const patterns = [
      /^\/[^\/\0]+/, // Unix absolute path
      /^[A-Za-z]:[\\\/]/, // Windows absolute path
      /^\.{1,2}[\/\\]/, // Relative path starting with ./ or ../
      /\.[a-zA-Z0-9]{1,10}$/, // Has file extension
      /[\/\\].*\.[a-zA-Z0-9]{1,10}$/ // Contains directory separator and extension
    ];

    return patterns.some(pattern => pattern.test(str)) && 
           str.length < 500 && // Reasonable path length
           !str.includes('\n') && // No newlines
           !str.includes('\0'); // No null bytes
  }

  /**
   * Analyze a file path to create an artifact
   * @param {string} filePath - Path to the file
   * @param {string} toolName - Name of the tool that created it
   * @returns {Promise<Object|null>} Artifact object or null
   */
  async analyzeFilePath(filePath, toolName) {
    try {
      // Check if file exists and get stats
      let stats = null;
      let exists = false;
      
      try {
        stats = await fs.stat(filePath);
        exists = true;
      } catch (error) {
        // File might not exist yet, but we can still create artifact metadata
        console.debug(`File not found: ${filePath}`);
      }

      const extension = path.extname(filePath).toLowerCase().slice(1);
      const fileName = path.basename(filePath);
      const dirName = path.dirname(filePath);
      
      // Determine artifact type
      const artifactType = this.getArtifactTypeFromExtension(extension);
      
      // Generate preview if possible
      let preview = null;
      if (exists && stats.isFile() && stats.size < 10000) { // Only preview small files
        try {
          const content = await fs.readFile(filePath, 'utf8');
          preview = this.generatePreview(content, artifactType);
        } catch (error) {
          console.debug(`Could not read file for preview: ${filePath}`);
        }
      }

      return {
        id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: artifactType,
        subtype: extension || 'unknown',
        title: fileName,
        path: filePath,
        directory: dirName,
        size: stats ? stats.size : 0,
        exists,
        preview,
        createdBy: toolName,
        createdAt: new Date().toISOString(),
        metadata: {
          isFile: true,
          extension,
          ...(stats && {
            modified: stats.mtime.toISOString(),
            isDirectory: stats.isDirectory()
          })
        }
      };
    } catch (error) {
      console.warn(`Error analyzing file path ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Extract content-based artifacts (code snippets, data, etc.)
   * @param {Object} toolResult - Tool execution result
   * @param {string} toolName - Name of the tool
   * @returns {Array} Array of content artifacts
   */
  extractContentArtifacts(toolResult, toolName) {
    const artifacts = [];

    // Look for code/content in common keys
    const contentKeys = ['code', 'content', 'html', 'css', 'javascript', 'output', 'result', 'data'];
    
    contentKeys.forEach(key => {
      if (toolResult[key] && typeof toolResult[key] === 'string') {
        const content = toolResult[key];
        
        // Only create artifact for substantial content
        if (content.length > 50) {
          const type = this.detectContentType(content, key);
          
          artifacts.push({
            id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            subtype: key,
            title: `Generated ${key}`,
            content,
            size: content.length,
            exists: true,
            preview: this.generatePreview(content, type),
            createdBy: toolName,
            createdAt: new Date().toISOString(),
            metadata: {
              isContent: true,
              contentKey: key
            }
          });
        }
      }
    });

    return artifacts;
  }

  /**
   * Extract URL artifacts
   * @param {Object} toolResult - Tool execution result
   * @param {string} toolName - Name of the tool
   * @returns {Array} Array of URL artifacts
   */
  extractUrlArtifacts(toolResult, toolName) {
    const artifacts = [];
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    
    const extractUrls = (value) => {
      if (typeof value === 'string') {
        const matches = value.match(urlPattern);
        if (matches) {
          matches.forEach(url => {
            artifacts.push({
              id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: 'url',
              subtype: 'link',
              title: this.extractDomainFromUrl(url),
              url,
              size: url.length,
              exists: true,
              preview: url,
              createdBy: toolName,
              createdAt: new Date().toISOString(),
              metadata: {
                isUrl: true,
                domain: this.extractDomainFromUrl(url)
              }
            });
          });
        }
      } else if (Array.isArray(value)) {
        value.forEach(extractUrls);
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(extractUrls);
      }
    };

    Object.values(toolResult).forEach(extractUrls);
    
    return artifacts;
  }

  /**
   * Detect artifacts specific to certain tools
   * @param {string} toolName - Name of the tool
   * @param {Object} toolResult - Tool execution result
   * @returns {Array} Array of tool-specific artifacts
   */
  detectToolSpecificArtifacts(toolName, toolResult) {
    const artifacts = [];

    switch (toolName) {
      case 'generate_html_page':
        if (toolResult.html) {
          artifacts.push({
            id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'markup',
            subtype: 'html',
            title: 'Generated HTML Page',
            content: toolResult.html,
            size: toolResult.size || toolResult.html.length,
            exists: true,
            preview: this.generatePreview(toolResult.html, 'markup'),
            createdBy: toolName,
            createdAt: new Date().toISOString(),
            metadata: {
              isGenerated: true,
              language: 'html'
            }
          });
        }
        break;

      case 'file_writer':
      case 'file_write':
        // File writer tools typically return path and bytesWritten
        if (toolResult.path) {
          // This will be caught by the file path detection, but we can add metadata
        }
        break;

      case 'directory_list':
        if (toolResult.files && Array.isArray(toolResult.files)) {
          artifacts.push({
            id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'data',
            subtype: 'directory',
            title: `Directory Listing (${toolResult.files.length} items)`,
            content: JSON.stringify(toolResult.files, null, 2),
            size: toolResult.files.length,
            exists: true,
            preview: `${toolResult.files.length} items`,
            createdBy: toolName,
            createdAt: new Date().toISOString(),
            metadata: {
              isDirectory: true,
              itemCount: toolResult.files.length
            }
          });
        }
        break;
    }

    return artifacts;
  }

  /**
   * Get artifact type from file extension
   * @param {string} extension - File extension (without dot)
   * @returns {string} Artifact type
   */
  getArtifactTypeFromExtension(extension) {
    if (!extension) return 'document';
    
    for (const [type, extensions] of Object.entries(this.typeMap)) {
      if (extensions.includes(extension.toLowerCase())) {
        return type;
      }
    }
    
    return 'document'; // Default fallback
  }

  /**
   * Detect content type from string content
   * @param {string} content - String content to analyze
   * @param {string} hint - Hint about the content type (key name)
   * @returns {string} Detected content type
   */
  detectContentType(content, hint = '') {
    // Use hint first
    const hintLower = hint.toLowerCase();
    if (hintLower.includes('html')) return 'markup';
    if (hintLower.includes('css')) return 'stylesheet';
    if (hintLower.includes('js') || hintLower.includes('javascript')) return 'code';
    if (hintLower.includes('json')) return 'config';
    if (hintLower.includes('code')) return 'code';

    // Analyze content patterns
    const trimmed = content.trim();
    
    // HTML detection
    if (trimmed.startsWith('<!DOCTYPE') || 
        (trimmed.startsWith('<') && trimmed.endsWith('>') && trimmed.includes('</'))) {
      return 'markup';
    }
    
    // JSON detection
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        return 'config';
      } catch (e) {
        // Not valid JSON
      }
    }
    
    // CSS detection
    if (trimmed.includes('{') && trimmed.includes('}') && trimmed.includes(':')) {
      return 'stylesheet';
    }
    
    // Code detection (simple heuristics)
    const codePatterns = [
      /function\s+\w+\s*\(/, // Function declarations
      /class\s+\w+/, // Class declarations
      /import\s+.*from/, // ES6 imports
      /const\s+\w+\s*=/, // Variable declarations
      /if\s*\(.*\)\s*{/, // If statements
      /for\s*\(.*\)\s*{/ // For loops
    ];
    
    if (codePatterns.some(pattern => pattern.test(content))) {
      return 'code';
    }
    
    return 'document'; // Default fallback
  }

  /**
   * Generate a preview of content
   * @param {string} content - Content to preview
   * @param {string} type - Content type
   * @returns {string} Preview string
   */
  generatePreview(content, type) {
    if (!content) return '';
    
    const maxLength = 200;
    const trimmed = content.trim();
    
    if (trimmed.length <= maxLength) {
      return trimmed;
    }
    
    // For code, try to get first few meaningful lines
    if (type === 'code' || type === 'markup' || type === 'stylesheet') {
      const lines = trimmed.split('\n').filter(line => line.trim());
      let preview = '';
      
      for (const line of lines.slice(0, 5)) {
        if (preview.length + line.length > maxLength) break;
        preview += line + '\n';
      }
      
      return preview.trim() || trimmed.substring(0, maxLength) + '...';
    }
    
    // For other content, just truncate
    return trimmed.substring(0, maxLength) + '...';
  }

  /**
   * Extract domain from URL
   * @param {string} url - URL string
   * @returns {string} Domain name
   */
  extractDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return url.split('/')[2] || url;
    }
  }
}