/**
 * WriteTool - Write new files to the filesystem
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';

export class WriteTool extends Tool {
  constructor() {
    super({
      name: 'Write',
      description: 'Write new files to the filesystem',
      schema: {
        input: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              minLength: 1,
              description: 'Absolute path for the new file'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['file_path', 'content']
        },
        output: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Path of the file that was written'
            },
            bytes_written: {
              type: 'number',
              description: 'Number of bytes written to the file'
            },
            created: {
              type: 'boolean',
              description: 'Whether the file was created (true) or overwritten (false)'
            }
          },
          required: ['file_path', 'bytes_written', 'created']
        }
      }
    });
  }

  /**
   * Execute the Write tool
   */
  async execute(input) {
    return await this.writeFile(input);
  }

  /**
   * Write a file to the filesystem
   */
  async writeFile(input) {
    try {
      // Input is already validated by Tool base class via the schema
      const { file_path, content } = input;

      // Check if path is a directory
      try {
        const stats = await fs.stat(file_path);
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
        // File doesn't exist, which is fine for writing
        if (error.code !== 'ENOENT') {
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
          // Other errors, re-throw
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
      }

      // Check if file already exists
      let fileExists = false;
      try {
        await fs.access(file_path);
        fileExists = true;
      } catch {
        // File doesn't exist
      }

      // Ensure parent directory exists
      const dir = path.dirname(file_path);
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        if (error.code === 'EACCES') {
          return {
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: `Permission denied creating directory: ${dir}`,
              path: dir
            }
          };
        }
        throw error;
      }

      // Write the file
      let bytesWritten;
      if (Buffer.isBuffer(content)) {
        await fs.writeFile(file_path, content);
        bytesWritten = content.length;
      } else {
        // String content
        await fs.writeFile(file_path, content, 'utf8');
        bytesWritten = Buffer.byteLength(content, 'utf8');
      }

      return {
        success: true,
        data: {
          file_path,
          bytes_written: bytesWritten,
          created: !fileExists
        }
      };

    } catch (error) {
      // Handle write errors
      if (error.code === 'EACCES') {
        return {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: `Permission denied writing file: ${input.file_path}`,
            details: error.message
          }
        };
      }
      if (error.code === 'ENOSPC') {
        return {
          success: false,
          error: {
            code: 'RESOURCE_ERROR',
            message: `No space left on device: ${input.file_path}`,
            details: error.message
          }
        };
      }
      
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: `Failed to write file: ${error.message}`,
          details: error.stack
        }
      };
    }
  }

}