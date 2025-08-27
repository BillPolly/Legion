/**
 * EditTool - Make exact string replacements in files
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';

export class EditTool extends Tool {
  constructor() {
    super({
      name: 'Edit',
      description: 'Make exact string replacements in files',
      schema: {
        input: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              minLength: 1,
              description: 'Absolute path to the file to edit'
            },
            old_string: {
              type: 'string',
              description: 'Exact text to replace'
            },
            new_string: {
              type: 'string',
              description: 'Replacement text'
            },
            replace_all: {
              type: 'boolean',
              description: 'Replace all occurrences (default: false)',
              default: false
            }
          },
          required: ['file_path', 'old_string', 'new_string']
        },
        output: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Path of the edited file'
            },
            replacements_made: {
              type: 'number',
              description: 'Number of replacements made'
            },
            preview: {
              type: 'string',
              description: 'Preview of changes made'
            }
          },
          required: ['file_path', 'replacements_made', 'preview']
        }
      }
    });
  }

  /**
   * Execute the Edit tool
   */
  async execute(input) {
    return await this.editFile(input);
  }

  /**
   * Edit a file by replacing strings
   */
  async editFile(input) {
    try {
      const { file_path, old_string, new_string, replace_all = false } = input;

      // Check if old_string and new_string are the same
      if (old_string === new_string) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMETER',
            message: 'old_string and new_string cannot be the same',
            details: { old_string, new_string }
          }
        };
      }

      // Read the file
      let content;
      try {
        content = await fs.readFile(file_path, 'utf8');
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

      // Check if old_string exists in the file
      if (!content.includes(old_string)) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `String not found in file: "${old_string}"`,
            details: { file_path, old_string }
          }
        };
      }

      // Count occurrences
      const occurrences = content.split(old_string).length - 1;
      
      // Check if old_string is unique when replace_all is false
      if (!replace_all && occurrences > 1) {
        return {
          success: false,
          error: {
            code: 'AMBIGUOUS_MATCH',
            message: `String is not unique in file (found ${occurrences} occurrences). Use replace_all=true or provide more context.`,
            details: { file_path, old_string, occurrences }
          }
        };
      }

      // Perform replacement
      let newContent;
      let replacementsMade;
      
      if (replace_all) {
        newContent = content.split(old_string).join(new_string);
        replacementsMade = occurrences;
      } else {
        const index = content.indexOf(old_string);
        newContent = content.substring(0, index) + new_string + content.substring(index + old_string.length);
        replacementsMade = 1;
      }

      // Write the file back
      try {
        await fs.writeFile(file_path, newContent, 'utf8');
      } catch (error) {
        if (error.code === 'EACCES') {
          return {
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: `Permission denied writing file: ${file_path}`,
              path: file_path
            }
          };
        }
        throw error;
      }

      // Generate preview
      const preview = this.generatePreview(content, newContent, old_string, new_string);

      return {
        success: true,
        data: {
          file_path,
          replacements_made: replacementsMade,
          preview
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: `Failed to edit file: ${error.message}`,
          details: error.stack
        }
      };
    }
  }

  /**
   * Generate a preview of the changes
   */
  generatePreview(oldContent, newContent, oldString, newString) {
    const index = oldContent.indexOf(oldString);
    if (index === -1) return '';

    const contextLength = 30;
    const start = Math.max(0, index - contextLength);
    const end = Math.min(oldContent.length, index + oldString.length + contextLength);
    
    const before = oldContent.substring(start, index);
    const after = oldContent.substring(index + oldString.length, end);
    
    return `...${before}[${oldString} → ${newString}]${after}...`;
  }

}