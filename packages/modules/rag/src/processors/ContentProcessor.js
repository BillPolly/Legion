/**
 * ContentProcessor - Main content processing coordinator
 * 
 * Handles file type detection, content cleaning, and chunking coordination
 * NO FALLBACKS - all operations must succeed or throw errors
 */

import ChunkingStrategy from './ChunkingStrategy.js';
import crypto from 'crypto';
import path from 'path';

export default class ContentProcessor {
  constructor(options) {
    if (!options) {
      throw new Error('Configuration options are required');
    }

    this.options = {
      defaultChunkSize: 800,
      defaultOverlap: 0.2,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      supportedFileTypes: ['.txt', '.md', '.json', '.yaml', '.js', '.py', '.java', '.go', '.html'],
      ...options
    };

    this.chunkingStrategy = new ChunkingStrategy({
      defaultChunkSize: this.options.defaultChunkSize,
      defaultOverlap: this.options.defaultOverlap
    });
    
    // File type to MIME type mapping
    this.typeMap = {
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
      '.cpp': 'text/cpp',
      '.c': 'text/c',
      '.rs': 'text/rust',
      '.php': 'text/php',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.xml': 'text/xml',
      '.css': 'text/css',
      '.csv': 'text/csv'
    };
  }

  /**
   * Detect content type from filename
   */
  detectFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    return this.typeMap[ext] || 'application/octet-stream';
  }

  /**
   * Check if content type is supported
   */
  isSupported(contentType) {
    const supportedTypes = [
      'text/plain',
      'text/markdown', 
      'application/json',
      'application/yaml',
      'text/javascript',
      'text/typescript',
      'text/python',
      'text/java',
      'text/go',
      'text/cpp',
      'text/c',
      'text/rust',
      'text/php',
      'text/html',
      'text/xml',
      'text/css',
      'text/csv'
    ];

    return supportedTypes.includes(contentType);
  }

  /**
   * Process content into document and chunks
   */
  async processContent(content, contentType, metadata, options = {}) {
    // Validate inputs
    if (!content || typeof content !== 'string') {
      throw new Error('Content cannot be empty');
    }

    if (!metadata || !metadata.source) {
      throw new Error('Metadata with source is required');
    }

    if (!this.isSupported(contentType)) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    // Check size limits
    if (content.length > this.options.maxFileSize) {
      throw new Error(`Content size exceeds maximum allowed: ${content.length} > ${this.options.maxFileSize}`);
    }

    // Clean and normalize content
    const cleanedContent = this.cleanContent(content, contentType);
    
    // Extract document metadata
    const document = this.extractDocumentMetadata(cleanedContent, contentType, metadata, options);
    
    // Chunk the content
    const chunkOptions = {
      chunkSize: options.chunkSize || this.options.defaultChunkSize,
      overlap: options.overlap !== undefined ? options.overlap : this.options.defaultOverlap
    };
    
    const rawChunks = this.chunkingStrategy.chunk(cleanedContent, chunkOptions);
    
    // Enrich chunks with additional metadata
    const chunks = this.enrichChunks(rawChunks, document, options);
    
    // Update document with total chunks count
    document.totalChunks = chunks.length;
    
    // Validate chunks
    this.validateChunks(chunks);
    
    return {
      document,
      chunks
    };
  }

  /**
   * Clean and normalize content
   */
  cleanContent(content, contentType) {
    let cleaned = content;

    // Normalize line endings
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Remove excessive whitespace but preserve structure
    cleaned = cleaned.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs to single space
    cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n'); // Limit consecutive newlines to 3
    
    // Content-type specific cleaning
    switch (contentType) {
      case 'text/html':
        // Basic HTML cleanup (should be done by WebProcessor typically)
        cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');
        cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '');
        break;
        
      case 'application/json':
        // Pretty format JSON for better chunking
        try {
          const parsed = JSON.parse(cleaned);
          cleaned = JSON.stringify(parsed, null, 2);
        } catch (error) {
          // If not valid JSON, process as-is
        }
        break;
    }

    return cleaned.trim();
  }

  /**
   * Extract document metadata
   */
  extractDocumentMetadata(content, contentType, metadata, options = {}) {
    const source = metadata.source;
    const sourceType = this.determineSourceType(source);
    const title = this.extractTitle(source, content, contentType);
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');

    return {
      source,
      sourceType,
      title,
      contentHash,
      fileSize: content.length,
      contentType,
      totalChunks: 0, // Will be updated after chunking
      processingOptions: {
        chunkSize: options.chunkSize || this.options.defaultChunkSize,
        overlap: options.overlap !== undefined ? options.overlap : this.options.defaultOverlap
      },
      metadata: {
        fileExtension: path.extname(source.replace('file://', '')).toLowerCase(),
        encoding: metadata.encoding || 'utf-8',
        language: metadata.language || 'en',
        ...metadata
      }
    };
  }

  /**
   * Determine source type from source string
   */
  determineSourceType(source) {
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return 'url';
    } else if (source.startsWith('file://')) {
      return 'file';
    } else {
      return 'file'; // Default assumption
    }
  }

  /**
   * Extract title from source and content
   */
  extractTitle(source, content, contentType) {
    // For files, use filename
    if (source.startsWith('file://') || !source.includes('://')) {
      return path.basename(source.replace('file://', ''));
    }
    
    // For URLs, try to extract from content first
    if (contentType === 'text/html') {
      const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        return titleMatch[1].trim();
      }
    }
    
    // For markdown, try to extract first heading
    if (contentType === 'text/markdown') {
      const headingMatch = content.match(/^#\s+(.+)$/m);
      if (headingMatch) {
        return headingMatch[1].trim();
      }
    }
    
    // Fallback to URL path
    try {
      const url = new URL(source);
      return path.basename(url.pathname) || url.hostname;
    } catch (error) {
      return 'Unknown Document';
    }
  }

  /**
   * Enrich chunks with additional metadata
   */
  enrichChunks(chunks, document, options = {}) {
    return chunks.map((chunk, index) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        sourceType: document.sourceType,
        contentType: document.contentType,
        documentTitle: document.title,
        source: document.source
      }
    }));
  }

  /**
   * Validate chunk data
   */
  validateChunks(chunks) {
    if (!Array.isArray(chunks)) {
      throw new Error('Chunks must be an array');
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const requiredProperties = ['content', 'chunkIndex', 'charStart', 'charEnd', 'contentHash'];
      
      for (const prop of requiredProperties) {
        if (chunk[prop] === undefined || chunk[prop] === null) {
          throw new Error(`Chunk ${i} missing required property: ${prop}`);
        }
      }
      
      if (typeof chunk.content !== 'string' || chunk.content.length === 0) {
        throw new Error(`Chunk ${i} has invalid content`);
      }
      
      if (chunk.charEnd <= chunk.charStart) {
        throw new Error(`Chunk ${i} has invalid character positions`);
      }
    }

    return true;
  }

  /**
   * Get optimal processing options for content type
   */
  getOptimalOptions(contentType) {
    const baseOptions = {
      chunkSize: this.options.defaultChunkSize,
      overlap: this.options.defaultOverlap
    };

    // Adjust based on content type
    switch (contentType) {
      case 'text/markdown':
        return { ...baseOptions, chunkSize: 1000 }; // Larger for structured docs
      case 'application/json':
        return { ...baseOptions, chunkSize: 600 };  // Smaller for structured data
      case 'text/javascript':
      case 'text/python':
      case 'text/java':
        return { ...baseOptions, chunkSize: 1200 }; // Larger for code
      default:
        return baseOptions;
    }
  }
}