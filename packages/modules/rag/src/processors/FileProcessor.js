/**
 * FileProcessor - File-specific content processing
 * 
 * Handles file reading, directory scanning, and file validation
 * NO FALLBACKS - all operations must succeed or throw errors
 */

import { promises as fs } from 'fs';
import path from 'path';
import mime from 'mime-types';

export default class FileProcessor {
  constructor(options) {
    if (!options || !options.basePath) {
      throw new Error('basePath is required');
    }

    this.options = {
      basePath: path.resolve(options.basePath),
      supportedFileTypes: ['.txt', '.md', '.json', '.yaml', '.js', '.py', '.java', '.go', '.html'],
      maxFileSize: 50 * 1024 * 1024, // 50MB
      encoding: 'utf-8',
      ...options
    };
  }

  /**
   * Process a single file
   */
  async processFile(filePath) {
    // Validate path
    const resolvedPath = path.resolve(filePath);
    
    if (!this.isPathAllowed(resolvedPath)) {
      throw new Error(`Access denied: Path is outside allowed directory`);
    }

    // Check file exists and is accessible
    try {
      await fs.access(resolvedPath);
    } catch (error) {
      throw new Error(`File not found or not accessible: ${filePath}`);
    }

    // Get file stats
    const stats = await fs.stat(resolvedPath);
    
    if (stats.size > this.options.maxFileSize) {
      throw new Error(`File size exceeds maximum: ${stats.size} > ${this.options.maxFileSize}`);
    }

    // Check file type
    const extension = path.extname(resolvedPath).toLowerCase();
    if (!this.options.supportedFileTypes.includes(extension)) {
      throw new Error(`Unsupported file type: ${extension}`);
    }

    // Read file content
    const content = await fs.readFile(resolvedPath, this.options.encoding);
    
    // Determine content type
    const contentType = this.detectContentType(resolvedPath, content);
    
    return {
      filePath: resolvedPath,
      content,
      contentType,
      size: stats.size,
      metadata: {
        filename: path.basename(resolvedPath),
        extension,
        lastModified: stats.mtime,
        created: stats.birthtime,
        isDirectory: false
      }
    };
  }

  /**
   * Scan directory for supported files
   */
  async scanDirectory(dirPath, options = {}) {
    const {
      recursive = false,
      fileTypes = this.options.supportedFileTypes
    } = options;

    const resolvedDirPath = path.resolve(dirPath);
    
    if (!this.isPathAllowed(resolvedDirPath)) {
      throw new Error(`Access denied: Directory is outside allowed path`);
    }

    const files = [];
    
    try {
      await this._scanDirectoryRecursive(resolvedDirPath, files, recursive, fileTypes);
    } catch (error) {
      throw new Error(`Failed to scan directory ${dirPath}: ${error.message}`);
    }

    return files;
  }

  /**
   * Recursive directory scanning helper
   */
  async _scanDirectoryRecursive(dirPath, files, recursive, fileTypes) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        if (recursive) {
          await this._scanDirectoryRecursive(fullPath, files, recursive, fileTypes);
        }
      } else if (entry.isFile()) {
        const extension = path.extname(entry.name).toLowerCase();
        
        if (fileTypes.includes(extension)) {
          // Check file size before adding
          const stats = await fs.stat(fullPath);
          
          if (stats.size <= this.options.maxFileSize) {
            const contentType = this.detectContentType(fullPath);
            
            files.push({
              filePath: fullPath,
              contentType,
              size: stats.size,
              lastModified: stats.mtime,
              metadata: {
                filename: entry.name,
                extension,
                relativePath: path.relative(this.options.basePath, fullPath)
              }
            });
          }
        }
      }
    }
  }

  /**
   * Process multiple files in batch
   */
  async processFiles(fileList, options = {}) {
    const { maxConcurrent = 5 } = options;
    const results = [];
    
    // Process files in batches to avoid overwhelming the system
    for (let i = 0; i < fileList.length; i += maxConcurrent) {
      const batch = fileList.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (fileInfo) => {
        try {
          const result = await this.processFile(fileInfo.filePath);
          return {
            success: true,
            ...result
          };
        } catch (error) {
          return {
            success: false,
            filePath: fileInfo.filePath,
            error: error.message
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Filter list of file paths to only supported files
   */
  async filterSupportedFiles(filePaths) {
    const supported = [];
    
    for (const filePath of filePaths) {
      try {
        const resolvedPath = path.resolve(filePath);
        const extension = path.extname(resolvedPath).toLowerCase();
        
        if (this.options.supportedFileTypes.includes(extension)) {
          // Check if file exists and get stats
          const stats = await fs.stat(resolvedPath);
          
          if (stats.isFile() && stats.size <= this.options.maxFileSize) {
            const contentType = this.detectContentType(resolvedPath);
            
            supported.push({
              filePath: resolvedPath,
              contentType,
              size: stats.size,
              metadata: {
                filename: path.basename(resolvedPath),
                extension
              }
            });
          }
        }
      } catch (error) {
        // Skip files that can't be accessed
        continue;
      }
    }
    
    return supported;
  }

  /**
   * Detect content type from file path and content
   */
  detectContentType(filePath, content = null) {
    const extension = path.extname(filePath).toLowerCase();
    
    // Manual mapping to ensure consistent results
    const typeMap = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.markdown': 'text/markdown',
      '.json': 'application/json',
      '.yaml': 'application/yaml',
      '.yml': 'application/yaml',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.ts': 'text/typescript',
      '.py': 'text/python',
      '.java': 'text/java',
      '.go': 'text/go',
      '.html': 'text/html',
      '.htm': 'text/html'
    };
    
    return typeMap[extension] || 'application/octet-stream';
  }

  /**
   * Check if path is within allowed basePath
   */
  isPathAllowed(filePath) {
    const resolvedPath = path.resolve(filePath);
    const resolvedBasePath = path.resolve(this.options.basePath);
    
    // Special case: if the path IS the basePath, allow it
    if (resolvedPath === resolvedBasePath) {
      return true;
    }
    
    const relativePath = path.relative(resolvedBasePath, resolvedPath);
    
    // Path is allowed if it doesn't escape the base directory
    return relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  /**
   * Get file statistics for a directory
   */
  async getDirectoryStats(dirPath, options = {}) {
    const files = await this.scanDirectory(dirPath, options);
    
    const stats = {
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      fileTypes: {},
      largestFile: null,
      smallestFile: null
    };
    
    // Analyze file types
    for (const file of files) {
      const ext = file.metadata.extension;
      stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
    }
    
    // Find largest and smallest files
    if (files.length > 0) {
      stats.largestFile = files.reduce((max, file) => 
        file.size > max.size ? file : max
      );
      stats.smallestFile = files.reduce((min, file) => 
        file.size < min.size ? file : min
      );
    }
    
    return stats;
  }

  /**
   * Validate file processor configuration
   */
  static validateConfig(config) {
    if (!config.basePath) {
      throw new Error('basePath is required');
    }
    
    if (!Array.isArray(config.supportedFileTypes)) {
      throw new Error('supportedFileTypes must be an array');
    }
    
    if (config.maxFileSize && (typeof config.maxFileSize !== 'number' || config.maxFileSize <= 0)) {
      throw new Error('maxFileSize must be a positive number');
    }
    
    return true;
  }
}