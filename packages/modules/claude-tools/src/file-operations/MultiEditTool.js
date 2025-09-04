/**
 * MultiEditTool - Make multiple edits to a single file in one operation
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';

export class MultiEditTool extends Tool {
  constructor() {
    super({
      name: 'MultiEdit',
      description: 'Make multiple edits to a single file in one atomic operation',
      schema: {
        input: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              minLength: 1,
              description: 'Absolute path to the file to edit'
            },
            edits: {
              type: 'array',
              minItems: 1,
              description: 'Array of edit operations to perform sequentially',
              items: {
                type: 'object',
                properties: {
                  old_string: {
                    type: 'string',
                    description: 'Text to replace'
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
                required: ['old_string', 'new_string']
              }
            }
          },
          required: ['file_path', 'edits']
        },
        output: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Path of the edited file'
            },
            total_edits: {
              type: 'number',
              description: 'Total number of edits requested'
            },
            successful_edits: {
              type: 'number',
              description: 'Number of successful edits'
            },
            edit_summary: {
              type: 'array',
              description: 'Summary of each edit operation',
              items: {
                type: 'object',
                properties: {
                  edit_index: {
                    type: 'number',
                    description: 'Index of the edit operation'
                  },
                  replacements_made: {
                    type: 'number',
                    description: 'Number of replacements made for this edit'
                  },
                  status: {
                    type: 'string',
                    description: 'Status of the edit operation'
                  }
                }
              }
            }
          },
          required: ['file_path', 'total_edits', 'successful_edits', 'edit_summary']
        }
      }
    });
  }

  async _execute(input) {
    return await this.multiEditFile(input);
  }

  /**
   * Make multiple edits to a file
   */
  async multiEditFile(input) {
    try {
      const { file_path, edits } = input;

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

      // Validate all edits before applying any
      const validationResults = [];
      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        
        // Check if old_string and new_string are the same
        if (edit.old_string === edit.new_string) {
          return {
            success: false,
            error: {
              code: 'INVALID_PARAMETER',
              message: `Edit ${i + 1}: old_string and new_string cannot be the same`,
              details: { edit_index: i, edit }
            }
          };
        }

        // Check if old_string exists
        if (!content.includes(edit.old_string)) {
          return {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Edit ${i + 1}: String not found: "${edit.old_string}"`,
              details: { edit_index: i, edit }
            }
          };
        }

        const occurrences = content.split(edit.old_string).length - 1;
        
        // Check for ambiguous matches
        if (!edit.replace_all && occurrences > 1) {
          return {
            success: false,
            error: {
              code: 'AMBIGUOUS_MATCH',
              message: `Edit ${i + 1}: String is not unique (found ${occurrences} occurrences)`,
              details: { edit_index: i, edit, occurrences }
            }
          };
        }

        validationResults.push({ valid: true, occurrences });
      }

      // Apply all edits sequentially
      let workingContent = content;
      const editSummary = [];

      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        const occurrences = validationResults[i].occurrences;
        
        let replacementsMade;
        if (edit.replace_all) {
          const newContent = workingContent.split(edit.old_string).join(edit.new_string);
          replacementsMade = workingContent.split(edit.old_string).length - 1;
          workingContent = newContent;
        } else {
          const index = workingContent.indexOf(edit.old_string);
          workingContent = workingContent.substring(0, index) + 
                          edit.new_string + 
                          workingContent.substring(index + edit.old_string.length);
          replacementsMade = 1;
        }

        editSummary.push({
          edit_index: i,
          replacements_made: replacementsMade,
          status: 'success'
        });
      }

      // Write the file back
      try {
        await fs.writeFile(file_path, workingContent, 'utf8');
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

      return {
          file_path,
          total_edits: edits.length,
          successful_edits: edits.length,
          edit_summary: editSummary
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

}