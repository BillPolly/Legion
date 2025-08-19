/**
 * ReadTool - Read files from the filesystem
 * Supports text, images, PDFs, and Jupyter notebooks
 */

import { Tool } from '@legion/tools-registry';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';

// Input schema for validation
const readToolSchema = z.object({
  file_path: z.string().min(1),
  limit: z.number().positive().optional(),
  offset: z.number().int().min(0).optional()
});

export class ReadTool extends Tool {
  constructor() {
    super({
      name: 'Read',
      description: 'Read files from the filesystem (supports text, images, PDFs, Jupyter notebooks)',
      inputSchema: readToolSchema,
      execute: async (input) => this.readFile(input),
      getMetadata: () => this.getToolMetadata()
    });
  }

  /**
   * Read a file from the filesystem
   */
  async readFile(input) {
    try {
      // Input is already validated by Tool base class via the schema
      const { file_path, limit, offset = 0 } = input;

      // Check if file exists
      try {
        const stats = await fs.stat(file_path);
        
        // Check if it's a directory
        if (stats.isDirectory()) {
          return {
            success: false,
            error: {
              code: 'INVALID_PARAMETER',
              message: `Path is a directory, not a file: ${file_path}`,
              path: file_path
            }
          };
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          return {
            success: false,
            error: {
              code: 'RESOURCE_NOT_FOUND',
              message: `File not found: ${file_path}`,
              path: file_path
            }
          };
        }
        if (error.code === 'EACCES') {
          return {
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: `Permission denied: ${file_path}`,
              path: file_path
            }
          };
        }
        throw error;
      }

      // Detect file type
      const ext = path.extname(file_path).toLowerCase();
      const isNotebook = ext === '.ipynb';
      const isBinary = this.isBinaryFile(ext);

      let content;
      let encoding = 'utf8';
      let metadata = {};

      if (isNotebook) {
        // Handle Jupyter notebook
        content = await this.readNotebook(file_path);
        metadata.type = 'notebook';
      } else if (isBinary) {
        // Handle binary files
        const buffer = await fs.readFile(file_path);
        content = buffer.toString('base64');
        encoding = 'base64';
        metadata.type = 'binary';
      } else {
        // Handle text files
        content = await fs.readFile(file_path, 'utf8');
        
        // Apply line limits if specified
        if (limit !== undefined) {
          const lines = content.split(/\r?\n|\r/);
          const startLine = offset;
          const endLine = startLine + limit;
          content = lines.slice(startLine, endLine).join('\n');
        } else if (offset > 0) {
          const lines = content.split(/\r?\n|\r/);
          content = lines.slice(offset).join('\n');
        }
      }

      // Get file size
      const stats = await fs.stat(file_path);

      return {
        success: true,
        data: {
          content,
          file_path,
          size: isBinary ? stats.size : content.length,
          encoding,
          metadata
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: `Failed to read file: ${error.message}`,
          details: error.stack
        }
      };
    }
  }

  /**
   * Read and parse a Jupyter notebook
   */
  async readNotebook(filePath) {
    const notebookJson = await fs.readFile(filePath, 'utf8');
    const notebook = JSON.parse(notebookJson);
    
    let content = '';
    
    // Extract content from cells
    for (const cell of notebook.cells || []) {
      if (cell.cell_type === 'markdown') {
        const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
        content += source + '\n\n';
      } else if (cell.cell_type === 'code') {
        const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
        content += source + '\n\n';
      }
    }
    
    return content.trim();
  }

  /**
   * Check if a file extension indicates a binary file
   */
  isBinaryFile(ext) {
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.tar', '.gz', '.7z', '.rar',
      '.exe', '.dll', '.so', '.dylib',
      '.mp3', '.mp4', '.avi', '.mov', '.wav',
      '.ttf', '.woff', '.woff2', '.eot'
    ];
    
    return binaryExtensions.includes(ext);
  }

  /**
   * Get tool metadata
   */
  getToolMetadata() {
    return {
      name: 'Read',
      description: 'Read files from the filesystem (supports text, images, PDFs, Jupyter notebooks)',
      input: {
        file_path: {
          type: 'string',
          required: true,
          description: 'Absolute path to the file to read'
        },
        limit: {
          type: 'number',
          required: false,
          description: 'Number of lines to read'
        },
        offset: {
          type: 'number',
          required: false,
          description: 'Line number to start reading from'
        }
      },
      output: {
        content: {
          type: 'string',
          description: 'File contents (text or base64-encoded for binary)'
        },
        file_path: {
          type: 'string',
          description: 'Path of the file that was read'
        },
        size: {
          type: 'number',
          description: 'Size of the file in bytes'
        },
        encoding: {
          type: 'string',
          description: 'Encoding used (utf8 or base64)'
        },
        metadata: {
          type: 'object',
          description: 'Additional file metadata'
        }
      }
    };
  }
}