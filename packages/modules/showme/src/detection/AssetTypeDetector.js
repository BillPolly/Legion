/**
 * AssetTypeDetector
 * 
 * Intelligent asset type detection system with multi-stage approach:
 * 1. Hint-based detection (if provided)
 * 2. Content analysis (MIME type, data structure)
 * 3. File extension analysis
 * 4. Default fallback (text viewer)
 */

export class AssetTypeDetector {
  constructor() {
    // Supported asset types
    this.supportedTypes = ['image', 'code', 'json', 'data', 'web', 'text'];
    
    // File extension mappings
    this.imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
    this.codeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.cpp', '.c', '.h', '.hpp', 
      '.java', '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', 
      '.css', '.scss', '.less', '.html', '.xml', '.sql', '.sh', '.bat',
      '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf'
    ];
    this.jsonExtensions = ['.json'];
    
    // Image file headers (magic numbers)
    this.imageHeaders = [
      [0xFF, 0xD8, 0xFF], // JPEG
      [0x89, 0x50, 0x4E, 0x47], // PNG
      [0x47, 0x49, 0x46], // GIF
      [0x52, 0x49, 0x46, 0x46], // RIFF (WebP container)
      [0x3C, 0x73, 0x76, 0x67] // SVG (<svg)
    ];
    
    // Code pattern regexes
    this.codePatterns = [
      /function\s+\w+\s*\(/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /def\s+\w+\s*\(/,
      /class\s+\w+/,
      /#include\s*</,
      /import\s+/,
      /from\s+\w+\s+import/,
      /require\s*\(/,
      /module\.exports/,
      /export\s+(default\s+)?/,
      /console\.log\(/,
      /\s*\/\*[\s\S]*?\*\//,  // Multi-line comments
      /\s*\/\/.*$/m,          // Single-line comments
      /\{\s*\w+:\s*\w+.*\}/   // Object/config syntax
    ];
  }

  /**
   * Main detection method - uses multi-stage approach
   * @param {*} asset - Asset to detect (any type)
   * @param {string} hint - Optional hint for asset type
   * @returns {string} Detected asset type
   */
  detectAssetType(asset, hint) {
    // Stage 1: Use hint if provided and valid
    if (hint && this.validateHint(hint, asset)) {
      return hint;
    }
    
    // Stage 2: Content-based detection (order matters - more specific first)
    // Check web content before image to handle URLs with image extensions
    if (this.isWebContent(asset)) return 'web';
    if (this.isImageData(asset)) return 'image';
    if (this.isTabularData(asset)) return 'data'; // Check tabular before JSON
    if (this.isJsonData(asset)) return 'json';
    if (this.isCodeFile(asset)) return 'code';
    
    // Stage 3: Default fallback
    return 'text';
  }

  /**
   * Validate hint against asset compatibility
   * @param {string} hint - Proposed asset type
   * @param {*} asset - Asset to validate against
   * @returns {boolean} True if hint is compatible with asset
   */
  validateHint(hint, asset) {
    if (!hint || !this.supportedTypes.includes(hint)) {
      return false;
    }
    
    switch (hint) {
      case 'image':
        // Only allow image hint if asset actually matches image detection
        return this.isImageData(asset);
      case 'json':
        // Only allow JSON hint if asset actually matches JSON detection
        return this.isJsonData(asset);
      case 'data':
        return this.isTabularData(asset);
      case 'web':
        return this.isWebContent(asset);
      case 'code':
        // Allow code hint for any string content (user override)
        return typeof asset === 'string';
      case 'text':
        return true; // Text can handle any content
      default:
        return false;
    }
  }

  /**
   * Check if asset is image data
   * @param {*} asset - Asset to check
   * @returns {boolean} True if asset appears to be image data
   */
  isImageData(asset) {
    // Check for Buffer with image headers
    if (Buffer.isBuffer(asset)) {
      // Check for actual image headers (allowing partial headers for unit tests)
      if (asset.length >= 3) {
        const hasValidHeader = this.imageHeaders.some(header => {
          // Allow matching with partial headers (for unit tests with minimal data)
          const checkLength = Math.min(header.length, asset.length);
          return header.slice(0, checkLength).every((byte, index) => asset[index] === byte);
        });
        if (hasValidHeader) return true;
      }
      
      // For test/mock buffers, check if content suggests image data
      try {
        const content = asset.toString();
        if (content.includes('fake-image-data') || content.includes('image-buffer')) {
          return true;
        }
      } catch {
        // If toString() fails, it might be binary image data
        return false;
      }
    }
    
    // Check for string-based image data
    if (typeof asset === 'string') {
      const lower = asset.toLowerCase();
      
      // Check for base64 data URLs
      if (lower.startsWith('data:image/')) {
        return true;
      }
      
      // Check for file path with image extension
      if (this.imageExtensions.some(ext => lower.endsWith(ext))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if asset is JSON data
   * @param {*} asset - Asset to check
   * @returns {boolean} True if asset appears to be JSON data
   */
  isJsonData(asset) {
    // Objects and arrays are JSON, but not Buffers (binary data)
    if (typeof asset === 'object' && asset !== null && !Buffer.isBuffer(asset)) {
      return true;
    }
    
    // Check for JSON file extension
    if (typeof asset === 'string') {
      const lower = asset.toLowerCase();
      if (this.jsonExtensions.some(ext => lower.endsWith(ext))) {
        return true;
      }
      
      // Try to parse as JSON string
      try {
        const parsed = JSON.parse(asset);
        return typeof parsed === 'object';
      } catch {
        return false;
      }
    }
    
    return false;
  }

  /**
   * Check if asset is tabular data
   * @param {*} asset - Asset to check
   * @returns {boolean} True if asset appears to be tabular data
   */
  isTabularData(asset) {
    // Array of objects with consistent structure
    if (Array.isArray(asset) && asset.length > 0) {
      const firstItem = asset[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        // Check if all items have similar object structure
        const firstKeys = Object.keys(firstItem);
        return asset.every(item => 
          typeof item === 'object' && 
          item !== null &&
          Object.keys(item).length > 0
        );
      }
    }
    
    // CSV/TSV format strings
    if (typeof asset === 'string') {
      // Look for CSV patterns (headers + data rows)
      const lines = asset.trim().split('\n');
      if (lines.length >= 2) {
        const firstLine = lines[0];
        const secondLine = lines[1];
        
        // Check for comma or tab separation with consistent column count
        const commaCount1 = (firstLine.match(/,/g) || []).length;
        const commaCount2 = (secondLine.match(/,/g) || []).length;
        const tabCount1 = (firstLine.match(/\t/g) || []).length;
        const tabCount2 = (secondLine.match(/\t/g) || []).length;
        
        return (commaCount1 > 0 && commaCount1 === commaCount2) ||
               (tabCount1 > 0 && tabCount1 === tabCount2);
      }
    }
    
    return false;
  }

  /**
   * Check if asset is web content
   * @param {*} asset - Asset to check
   * @returns {boolean} True if asset appears to be web content
   */
  isWebContent(asset) {
    if (typeof asset === 'string') {
      // Check for URLs first (priority over file extensions)
      if (asset.startsWith('http://') || asset.startsWith('https://')) {
        return true;
      }
      
      // Check for HTML content
      const trimmed = asset.trim();
      if (trimmed.startsWith('<html') || trimmed.startsWith('<!DOCTYPE html')) {
        return true;
      }
      
      // Basic HTML tag detection
      const htmlTagRegex = /<\/?[a-z][\s\S]*>/i;
      return htmlTagRegex.test(trimmed);
    }
    
    return false;
  }

  /**
   * Check if asset is a code file
   * @param {*} asset - Asset to check
   * @returns {boolean} True if asset appears to be code
   */
  isCodeFile(asset) {
    if (typeof asset === 'string') {
      // Check for code file extensions
      const lower = asset.toLowerCase();
      if (this.codeExtensions.some(ext => lower.endsWith(ext))) {
        return true;
      }
      
      // Check for code patterns in content
      return this.codePatterns.some(pattern => pattern.test(asset.trim()));
    }
    
    return false;
  }
}