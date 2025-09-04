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
  /**
   * Write a file to the filesystem - base class will wrap result
   */
  async _execute(input) {
    try {
      const { file_path, content } = input;
      
      // Base class handles input validation based on schema

      // Check if path is a directory
      try {
        const stats = await fs.stat(file_path);
        if (stats.isDirectory()) {
          const error = new Error(`Path is a directory, not a file: ${file_path}`);
          error.code = 'INVALID_PARAMETER';
          throw error;
        }
      } catch (error) {
        // File doesn't exist, which is fine for writing
        if (error.code !== 'ENOENT') {
          if (error.code === 'EACCES') {
            const newError = new Error(`Permission denied: ${file_path}`);
            newError.code = 'PERMISSION_DENIED';
            throw newError;
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
          const newError = new Error(`Permission denied creating directory: ${dir}`);
          newError.code = 'PERMISSION_DENIED';
          throw newError;
        }
        throw error;
      }

      // Write the file (string content only)
      await fs.writeFile(file_path, content, 'utf8');
      const bytesWritten = Buffer.byteLength(content, 'utf8');

      return {
        file_path,
        bytes_written: bytesWritten,
        created: !fileExists
      };

    } catch (error) {
      // Handle write errors
      if (error.code === 'EACCES') {
        const newError = new Error(`Permission denied writing file: ${input.file_path}`);
        newError.code = 'PERMISSION_DENIED';
        throw newError;
      }
      if (error.code === 'ENOSPC') {
        const newError = new Error(`No space left on device: ${input.file_path}`);
        newError.code = 'RESOURCE_ERROR';
        throw newError;
      }
      
      // Re-throw with code or add generic code
      if (error.code) {
        throw error;
      } else {
        const newError = new Error(`Failed to write file: ${error.message}`);
        newError.code = 'EXECUTION_ERROR';
        throw newError;
      }
    }
  }

}