/**
 * ReadFileTool - Ported from Gemini CLI read-file.ts to Legion patterns
 * Reads file content with encoding detection and error handling
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';
import MultimodalFileProcessor from '../../../../agents/gemini-agent/src/utils/MultimodalFileProcessor.js';

/**
 * Tool for reading files (ported from Gemini CLI's read-file.ts)
 */
class ReadFileTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.basePath = config.basePath || process.cwd();
      this.encoding = config.encoding || 'utf-8';
      this.shortName = 'read';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      const { basePath, encoding = 'utf-8' } = moduleOrConfig || {};
      
      super({
        name: 'read_file',
        shortName: 'read',
        description: 'Reads and returns the content of a specified file (ported from Gemini CLI)',
        schema: {
          input: {
            type: 'object',
            properties: {
              absolute_path: {
                type: 'string',
                description: 'The absolute path to the file to read'
              },
              offset: {
                type: 'number',
                description: 'The line number to start reading from (optional)'
              },
              limit: {
                type: 'number',
                description: 'The number of lines to read (optional)'
              }
            },
            required: ['absolute_path']
          },
          output: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'The contents of the file'
              },
              path: {
                type: 'string',
                description: 'The resolved path of the file'
              },
              lines: {
                type: 'number',
                description: 'Number of lines in the file'
              },
              truncated: {
                type: 'boolean',
                description: 'Whether content was truncated'
              }
            },
            required: ['content', 'path']
          }
        }
      });

      this.basePath = basePath || process.cwd();
      this.encoding = encoding;
      
      // Initialize multimodal processor (ported from Gemini CLI)
      this.multimodalProcessor = new MultimodalFileProcessor();
    }
  }

  /**
   * Execute the file reader tool (core logic ported from Gemini CLI)
   * @param {Object} args - The arguments for reading the file
   * @returns {Promise<Object>} The result of reading the file
   */
  async _execute(args) {
    try {
      const { absolute_path, offset, limit } = args;

      // Validate input (ported from Gemini CLI validation)
      if (typeof absolute_path !== 'string') {
        throw new Error('File path must be a string');
      }

      if (absolute_path.trim() === '') {
        throw new Error('File path cannot be empty');
      }

      // Security check for null bytes
      if (absolute_path.includes('\0')) {
        throw new Error('Invalid file path');
      }

      // Resolve the file path
      const resolvedPath = path.resolve(absolute_path);

      // Check file accessibility (ported from Gemini CLI)
      try {
        await fs.access(resolvedPath);
      } catch (error) {
        throw new Error('File not found or not accessible');
      }

      // Read the file (ported logic from Gemini CLI)
      let content = await fs.readFile(resolvedPath, this.encoding);
      
      // Handle line-based reading if offset/limit specified (ported from Gemini CLI)
      let lines = null;
      let truncated = false;
      
      if (offset !== undefined || limit !== undefined) {
        const allLines = content.split('\n');
        lines = allLines.length;
        
        const startLine = offset || 0;
        const endLine = limit ? startLine + limit : allLines.length;
        
        if (endLine < allLines.length) {
          truncated = true;
        }
        
        content = allLines.slice(startLine, endLine).join('\n');
      } else {
        lines = content.split('\n').length;
      }

      return {
        content,
        path: resolvedPath,
        lines,
        truncated
      };

    } catch (error) {
      // Legion pattern: fail fast, no fallbacks
      throw new Error(error.message || 'Failed to read file');
    }
  }
}

export default ReadFileTool;