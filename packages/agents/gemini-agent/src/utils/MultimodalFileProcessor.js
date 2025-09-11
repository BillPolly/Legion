/**
 * MultimodalFileProcessor - Ported from Gemini CLI fileUtils.ts
 * Handles processing of images, PDFs, audio, video, and other media files
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Binary file extensions (ported from Gemini CLI)
 */
export const BINARY_EXTENSIONS = [
  '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.ico',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'
];

/**
 * Multimodal file processor (ported from Gemini CLI)
 */
export class MultimodalFileProcessor {
  constructor() {
    this.supportedImageTypes = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];
    this.supportedDocTypes = ['.pdf', '.doc', '.docx'];
    this.supportedMediaTypes = ['.mp3', '.mp4', '.avi', '.mov', '.wav'];
  }

  /**
   * Detect file type based on extension and content (ported from Gemini CLI)
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} File type
   */
  async detectFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    // TypeScript files (special case from Gemini CLI)
    if (['.ts', '.mts', '.cts'].includes(ext)) {
      return 'text';
    }
    
    if (ext === '.svg') {
      return 'svg';
    }
    
    // Image files
    if (this.supportedImageTypes.includes(ext)) {
      return 'image';
    }
    
    // PDF files
    if (ext === '.pdf') {
      return 'pdf';
    }
    
    // Audio files
    if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
      return 'audio';
    }
    
    // Video files
    if (['.mp4', '.avi', '.mov', '.mkv', '.webm'].includes(ext)) {
      return 'video';
    }
    
    // Binary check
    if (BINARY_EXTENSIONS.includes(ext)) {
      return 'binary';
    }
    
    // Content-based detection for unknown extensions
    if (await this.isBinaryFile(filePath)) {
      return 'binary';
    }
    
    return 'text';
  }

  /**
   * Check if file is binary by content analysis (ported from Gemini CLI)
   * @param {string} filePath - File to check
   * @returns {Promise<boolean>} Whether file is binary
   */
  async isBinaryFile(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      
      // Check first 512 bytes for null bytes (common binary indicator)
      const sampleSize = Math.min(512, buffer.length);
      for (let i = 0; i < sampleSize; i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false; // Assume text if we can't read
    }
  }

  /**
   * Process file based on type (ported from Gemini CLI processSingleFileContent)
   * @param {string} filePath - File to process
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processed file result
   */
  async processFile(filePath, options = {}) {
    try {
      const fileType = await this.detectFileType(filePath);
      const { offset, limit, includeMetadata = true } = options;
      
      switch (fileType) {
        case 'text':
          return await this._processTextFile(filePath, offset, limit);
          
        case 'image':
          return await this._processImageFile(filePath, includeMetadata);
          
        case 'pdf':
          return await this._processPdfFile(filePath, includeMetadata);
          
        case 'audio':
        case 'video':
          return await this._processMediaFile(filePath, fileType, includeMetadata);
          
        case 'svg':
          return await this._processSvgFile(filePath);
          
        case 'binary':
        default:
          return await this._processBinaryFile(filePath, includeMetadata);
      }
    } catch (error) {
      return {
        success: false,
        fileType: 'unknown',
        error: error.message,
        content: null
      };
    }
  }

  /**
   * Process text file (existing logic enhanced)
   * @param {string} filePath - Text file path
   * @param {number} offset - Line offset
   * @param {number} limit - Line limit
   * @returns {Promise<Object>} Text processing result
   * @private
   */
  async _processTextFile(filePath, offset, limit) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let processedContent = content;
    let isTruncated = false;
    let linesShown = [1, lines.length];
    
    if (offset || limit) {
      const startLine = offset || 0;
      const endLine = limit ? startLine + limit : lines.length;
      
      if (endLine < lines.length) {
        isTruncated = true;
      }
      
      processedContent = lines.slice(startLine, endLine).join('\n');
      linesShown = [startLine + 1, Math.min(endLine, lines.length)];
    }
    
    return {
      success: true,
      fileType: 'text',
      content: processedContent,
      lines: lines.length,
      isTruncated,
      linesShown,
      encoding: 'utf-8'
    };
  }

  /**
   * Process image file (ported from Gemini CLI)
   * @param {string} filePath - Image file path
   * @param {boolean} includeMetadata - Whether to include metadata
   * @returns {Promise<Object>} Image processing result
   * @private
   */
  async _processImageFile(filePath, includeMetadata) {
    const buffer = await fs.readFile(filePath);
    const base64Data = buffer.toString('base64');
    const stats = await fs.stat(filePath);
    
    const result = {
      success: true,
      fileType: 'image',
      content: `[IMAGE FILE: ${path.basename(filePath)}]`,
      base64Data,
      mimeType: this._getMimeType(filePath),
      size: stats.size,
      description: `Image file ready for LLM analysis`
    };
    
    if (includeMetadata) {
      result.metadata = {
        filename: path.basename(filePath),
        extension: path.extname(filePath),
        created: stats.birthtime,
        modified: stats.mtime
      };
    }
    
    return result;
  }

  /**
   * Process PDF file (ported from Gemini CLI)
   * @param {string} filePath - PDF file path
   * @param {boolean} includeMetadata - Whether to include metadata
   * @returns {Promise<Object>} PDF processing result
   * @private
   */
  async _processPdfFile(filePath, includeMetadata) {
    const buffer = await fs.readFile(filePath);
    const base64Data = buffer.toString('base64');
    const stats = await fs.stat(filePath);
    
    const result = {
      success: true,
      fileType: 'pdf',
      content: `[PDF FILE: ${path.basename(filePath)}]`,
      base64Data,
      mimeType: 'application/pdf',
      size: stats.size,
      description: `PDF document ready for LLM analysis`
    };
    
    if (includeMetadata) {
      result.metadata = {
        filename: path.basename(filePath),
        pages: 'Unknown', // Would require PDF parsing library
        created: stats.birthtime,
        modified: stats.mtime
      };
    }
    
    return result;
  }

  /**
   * Process media file (audio/video)
   * @param {string} filePath - Media file path
   * @param {string} fileType - Detected file type
   * @param {boolean} includeMetadata - Whether to include metadata
   * @returns {Promise<Object>} Media processing result
   * @private
   */
  async _processMediaFile(filePath, fileType, includeMetadata) {
    const stats = await fs.stat(filePath);
    
    const result = {
      success: true,
      fileType,
      content: `[${fileType.toUpperCase()} FILE: ${path.basename(filePath)}]`,
      mimeType: this._getMimeType(filePath),
      size: stats.size,
      description: `${fileType} file (${this._formatFileSize(stats.size)})`
    };
    
    if (includeMetadata) {
      result.metadata = {
        filename: path.basename(filePath),
        duration: 'Unknown', // Would require media parsing
        created: stats.birthtime,
        modified: stats.mtime
      };
    }
    
    return result;
  }

  /**
   * Process SVG file (special handling)
   * @param {string} filePath - SVG file path
   * @returns {Promise<Object>} SVG processing result
   * @private
   */
  async _processSvgFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    
    return {
      success: true,
      fileType: 'svg',
      content: content,
      mimeType: 'image/svg+xml',
      description: 'SVG vector graphic (text-based)'
    };
  }

  /**
   * Process binary file
   * @param {string} filePath - Binary file path
   * @param {boolean} includeMetadata - Whether to include metadata
   * @returns {Promise<Object>} Binary processing result
   * @private
   */
  async _processBinaryFile(filePath, includeMetadata) {
    const stats = await fs.stat(filePath);
    
    return {
      success: true,
      fileType: 'binary',
      content: `[BINARY FILE: ${path.basename(filePath)}]`,
      size: stats.size,
      description: `Binary file (${this._formatFileSize(stats.size)}) - not readable as text`
    };
  }

  /**
   * Get MIME type for file (ported utility)
   * @param {string} filePath - File path
   * @returns {string} MIME type
   * @private
   */
  _getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.avi': 'video/avi'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size
   * @private
   */
  _formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Check if file type is supported for multimodal processing
   * @param {string} filePath - File to check
   * @returns {Promise<boolean>} Whether file is supported
   */
  async isMultimodalSupported(filePath) {
    const fileType = await this.detectFileType(filePath);
    return ['image', 'pdf', 'svg'].includes(fileType);
  }

  /**
   * Get supported file types
   * @returns {Object} Supported file types
   */
  getSupportedTypes() {
    return {
      images: this.supportedImageTypes,
      documents: this.supportedDocTypes,
      media: this.supportedMediaTypes,
      text: ['.txt', '.md', '.js', '.ts', '.json', '.yml', '.yaml']
    };
  }
}

export default MultimodalFileProcessor;