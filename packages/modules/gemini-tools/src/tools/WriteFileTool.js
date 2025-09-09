/**
 * WriteFileTool - Ported from Gemini CLI write-file.ts to Legion patterns
 * Writes content to files with proper validation and directory creation
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for writing files (ported from Gemini CLI's write-file.ts)
 */
class WriteFileTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.basePath = config.basePath || process.cwd();
      this.encoding = config.encoding || 'utf-8';
      this.shortName = 'write';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      const { basePath, encoding = 'utf-8' } = moduleOrConfig || {};
      
      super({
        name: 'write_file',
        shortName: 'write',
        description: 'Writes content to a file (ported from Gemini CLI)',
        schema: {
          input: {
            type: 'object',
            properties: {
              absolute_path: {
                type: 'string',
                description: 'The absolute path to the file to write'
              },
              content: {
                type: 'string',
                description: 'The content to write to the file'
              },
              encoding: {
                type: 'string',
                description: 'File encoding (default: utf8)',
                default: 'utf8'
              }
            },
            required: ['absolute_path', 'content']
          },
          output: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The resolved path where the file was written'
              },
              bytesWritten: {
                type: 'number',
                description: 'Number of bytes written'
              }
            },
            required: ['path', 'bytesWritten']
          }
        }
      });

      this.basePath = basePath || process.cwd();
      this.encoding = encoding;
    }
  }

  /**
   * Execute the file writer tool (core logic ported from Gemini CLI)
   * @param {Object} args - The arguments for writing the file
   * @returns {Promise<Object>} The result of writing the file
   */
  async _execute(args) {
    try {
      const { absolute_path, content, encoding } = args;

      // Validate input (ported from Gemini CLI validation)
      if (typeof absolute_path !== 'string') {
        throw new Error('File path must be a string');
      }

      if (absolute_path.trim() === '') {
        throw new Error('File path cannot be empty');
      }

      if (content === undefined || content === null) {
        throw new Error('Content is required');
      }

      // Security check for null bytes
      if (absolute_path.includes('\0')) {
        throw new Error('Invalid file path');
      }

      // Resolve the file path
      const resolvedPath = path.resolve(absolute_path);

      // Get directory and ensure it exists (ported logic from Gemini CLI)
      const directory = path.dirname(resolvedPath);
      
      try {
        await fs.mkdir(directory, { recursive: true });
      } catch (error) {
        // Directory creation failed
        throw new Error(`Failed to create directory: ${directory}`);
      }

      // Use provided encoding or default
      const fileEncoding = encoding || this.encoding;

      // Write the file (ported from Gemini CLI)
      const contentString = typeof content === 'string' ? content : String(content);
      await fs.writeFile(resolvedPath, contentString, fileEncoding);

      // Calculate bytes written
      const bytesWritten = Buffer.byteLength(contentString, fileEncoding);

      return {
        path: resolvedPath,
        bytesWritten
      };

    } catch (error) {
      // Legion pattern: fail fast, no fallbacks
      throw new Error(error.message || 'Failed to write file');
    }
  }
}

export default WriteFileTool;