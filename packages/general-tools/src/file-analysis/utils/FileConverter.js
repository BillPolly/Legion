import fs from 'fs/promises';
import path from 'path';

/**
 * FileConverter - Utility class for reading and converting files for AI analysis
 */
export class FileConverter {
  /**
   * Read a file and prepare it for AI analysis
   * @param {string} filePath - Path to the file
   * @returns {Promise<Object>} File object with type, name, data, and mimeType
   */
  static async readFile(filePath) {
    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Read file data
      const data = await fs.readFile(filePath);
      const name = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      const type = this.getFileType(ext);
      const mimeType = this.getMimeType(ext);
      
      console.log(`[FileConverter] Read file: ${name} (${type}, ${mimeType}, ${data.length} bytes)`);
      
      return {
        type,
        name,
        data,
        mimeType
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }
  
  /**
   * Read file as base64 string
   * @param {string} filePath - Path to the file
   * @returns {Promise<string>} Base64 encoded file content
   */
  static async readAsBase64(filePath) {
    const file = await this.readFile(filePath);
    return file.data.toString('base64');
  }
  
  /**
   * Determine file type from extension
   * @param {string} ext - File extension (including dot)
   * @returns {string} File type: 'image', 'document', 'text', or 'auto'
   */
  static getFileType(ext) {
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
    const docExts = ['.pdf'];
    const textExts = ['.md', '.txt', '.csv', '.json', '.xml', '.html', '.js', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.rb', '.go', '.rs', '.swift', '.kt', '.ts', '.jsx', '.tsx'];
    
    if (imageExts.includes(ext)) return 'image';
    if (docExts.includes(ext)) return 'document';
    if (textExts.includes(ext)) return 'text';
    return 'auto';
  }
  
  /**
   * Get MIME type from extension
   * @param {string} ext - File extension (including dot)
   * @returns {string} MIME type
   */
  static getMimeType(ext) {
    const mimeMap = {
      // Images
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      
      // Documents
      '.pdf': 'application/pdf',
      
      // Text files
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.html': 'text/html',
      
      // Code files
      '.js': 'text/javascript',
      '.jsx': 'text/javascript',
      '.ts': 'text/typescript',
      '.tsx': 'text/typescript',
      '.py': 'text/x-python',
      '.java': 'text/x-java',
      '.cpp': 'text/x-c++',
      '.c': 'text/x-c',
      '.h': 'text/x-c',
      '.cs': 'text/x-csharp',
      '.rb': 'text/x-ruby',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.swift': 'text/x-swift',
      '.kt': 'text/x-kotlin'
    };
    
    return mimeMap[ext] || 'application/octet-stream';
  }
  
  /**
   * Validate file size
   * @param {string} filePath - Path to the file
   * @param {number} maxSizeMB - Maximum size in megabytes (default: 20MB)
   * @returns {Promise<void>} Throws if file is too large
   */
  static async validateFileSize(filePath, maxSizeMB = 20) {
    const stats = await fs.stat(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    if (fileSizeMB > maxSizeMB) {
      throw new Error(`File too large: ${fileSizeMB.toFixed(2)}MB (max: ${maxSizeMB}MB)`);
    }
  }
  
  /**
   * Check if file type is supported for analysis
   * @param {string} filePath - Path to the file
   * @returns {boolean} True if supported
   */
  static isSupported(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const type = this.getFileType(ext);
    return type !== 'auto';
  }
}