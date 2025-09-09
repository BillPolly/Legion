/**
 * EditFileTool - Ported from Gemini CLI edit.ts to Legion patterns
 * Edits files with search and replace functionality
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for editing files (ported from Gemini CLI's edit.ts)
 */
class EditFileTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.basePath = config.basePath || process.cwd();
      this.encoding = config.encoding || 'utf-8';
      this.shortName = 'edit';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      const { basePath, encoding = 'utf-8' } = moduleOrConfig || {};
      
      super({
        name: 'edit_file',
        shortName: 'edit',
        description: 'Edits files with search and replace (ported from Gemini CLI)',
        schema: {
          input: {
            type: 'object',
            properties: {
              absolute_path: {
                type: 'string',
                description: 'The absolute path to the file to edit'
              },
              old_string: {
                type: 'string',
                description: 'The text to replace'
              },
              new_string: {
                type: 'string',
                description: 'The replacement text'
              },
              replace_all: {
                type: 'boolean',
                description: 'Replace all occurrences (default: false)',
                default: false
              }
            },
            required: ['absolute_path', 'old_string', 'new_string']
          },
          output: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The path of the edited file'
              },
              replacements: {
                type: 'number',
                description: 'Number of replacements made'
              },
              backup_path: {
                type: 'string',
                description: 'Path to backup file (if created)'
              }
            },
            required: ['path', 'replacements']
          }
        }
      });

      this.basePath = basePath || process.cwd();
      this.encoding = encoding;
    }
  }

  /**
   * Execute the file edit tool (core logic ported from Gemini CLI)
   * @param {Object} args - The arguments for editing the file
   * @returns {Promise<Object>} The result of editing the file
   */
  async _execute(args) {
    try {
      const { absolute_path, old_string, new_string, replace_all = false } = args;

      // Validate input (ported from Gemini CLI validation)
      if (typeof absolute_path !== 'string') {
        throw new Error('File path must be a string');
      }

      if (absolute_path.trim() === '') {
        throw new Error('File path cannot be empty');
      }

      if (old_string === undefined || new_string === undefined) {
        throw new Error('Both old_string and new_string are required');
      }

      if (old_string === new_string) {
        throw new Error('old_string and new_string cannot be identical');
      }

      // Security check for null bytes
      if (absolute_path.includes('\0')) {
        throw new Error('Invalid file path');
      }

      // Resolve the file path
      const resolvedPath = path.resolve(absolute_path);

      // Check file exists and is accessible
      try {
        await fs.access(resolvedPath);
      } catch (error) {
        throw new Error('File not found or not accessible');
      }

      // Read current file content
      let content;
      try {
        content = await fs.readFile(resolvedPath, this.encoding);
      } catch (error) {
        throw new Error('Failed to read file content');
      }

      // Create backup before editing (ported from Gemini CLI backup logic)
      const backupPath = `${resolvedPath}.backup.${Date.now()}`;
      await fs.writeFile(backupPath, content, this.encoding);

      // Perform replacements (ported logic from Gemini CLI)
      let newContent;
      let replacements;

      if (replace_all) {
        // Replace all occurrences
        const regex = new RegExp(this._escapeRegExp(old_string), 'g');
        newContent = content.replace(regex, new_string);
        replacements = (content.match(regex) || []).length;
      } else {
        // Replace only first occurrence
        const index = content.indexOf(old_string);
        if (index === -1) {
          // Clean up backup if no changes made
          await fs.unlink(backupPath);
          throw new Error('String not found in file');
        }
        
        newContent = content.substring(0, index) + 
                    new_string + 
                    content.substring(index + old_string.length);
        replacements = 1;
      }

      // Write updated content
      await fs.writeFile(resolvedPath, newContent, this.encoding);

      return {
        path: resolvedPath,
        replacements,
        backup_path: backupPath
      };

    } catch (error) {
      // Legion pattern: fail fast, no fallbacks
      throw new Error(error.message || 'Failed to edit file');
    }
  }

  /**
   * Escape special regex characters
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export default EditFileTool;