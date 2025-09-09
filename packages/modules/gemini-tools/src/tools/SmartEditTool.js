/**
 * SmartEditTool - Ported from Gemini CLI smart-edit.ts to Legion patterns
 * Intelligent file editing with enhanced validation
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tool for smart editing (ported from Gemini CLI's smart-edit.ts)
 */
class SmartEditTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.basePath = config.basePath || process.cwd();
      this.encoding = config.encoding || 'utf-8';
      this.shortName = 'smartedit';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      const { basePath, encoding = 'utf-8' } = moduleOrConfig || {};
      
      super({
        name: 'smart_edit',
        shortName: 'smartedit',
        description: 'Intelligent file editing with enhanced validation (ported from Gemini CLI)',
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
              create_backup: {
                type: 'boolean',
                description: 'Create backup before editing (default: true)',
                default: true
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
              changes_made: {
                type: 'boolean',
                description: 'Whether any changes were actually made'
              },
              validation_passed: {
                type: 'boolean',
                description: 'Whether post-edit validation passed'
              },
              backup_path: {
                type: 'string',
                description: 'Path to backup file (if created)'
              }
            },
            required: ['path', 'changes_made', 'validation_passed']
          }
        }
      });

      this.basePath = basePath || process.cwd();
      this.encoding = encoding;
    }
  }

  /**
   * Execute smart edit (enhanced logic ported from Gemini CLI)
   * @param {Object} args - The arguments for smart editing
   * @returns {Promise<Object>} The edit result with validation
   */
  async _execute(args) {
    try {
      const { absolute_path, old_string, new_string, create_backup = true } = args;

      // Enhanced validation (ported from Gemini CLI smart-edit)
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

      // Resolve and validate file path
      const resolvedPath = path.resolve(absolute_path);

      // Check file exists and is accessible
      try {
        await fs.access(resolvedPath);
      } catch (error) {
        throw new Error('File not found or not accessible');
      }

      // Read current content
      let content;
      try {
        content = await fs.readFile(resolvedPath, this.encoding);
      } catch (error) {
        throw new Error('Failed to read file content');
      }

      // Create backup if requested (ported from Gemini CLI backup logic)
      let backupPath;
      if (create_backup) {
        backupPath = `${resolvedPath}.backup.${Date.now()}`;
        await fs.writeFile(backupPath, content, this.encoding);
      }

      // Perform smart edit with validation (enhanced from basic edit)
      const originalContent = content;
      
      // Check if old_string exists
      if (!content.includes(old_string)) {
        if (backupPath) {
          await fs.unlink(backupPath); // Clean up unused backup
        }
        
        return {
          path: resolvedPath,
          changes_made: false,
          validation_passed: true,
          backup_path: null
        };
      }

      // Perform replacement
      const newContent = content.replace(old_string, new_string);
      
      // Enhanced validation (ported concept from Gemini CLI smart-edit)
      const validationResult = await this._validateEdit(originalContent, newContent, resolvedPath);
      
      if (!validationResult.isValid) {
        if (backupPath) {
          await fs.unlink(backupPath); // Clean up unused backup
        }
        throw new Error(`Edit validation failed: ${validationResult.reason}`);
      }

      // Write updated content
      await fs.writeFile(resolvedPath, newContent, this.encoding);

      return {
        path: resolvedPath,
        changes_made: newContent !== originalContent,
        validation_passed: true,
        backup_path: backupPath || null
      };

    } catch (error) {
      // Legion pattern: fail fast, no fallbacks
      throw new Error(error.message || 'Failed to perform smart edit');
    }
  }

  /**
   * Validate edit result (enhanced validation from Gemini CLI concept)
   * @param {string} originalContent - Original file content
   * @param {string} newContent - New file content after edit
   * @param {string} filePath - File being edited
   * @returns {Promise<Object>} Validation result
   */
  async _validateEdit(originalContent, newContent, filePath) {
    try {
      // Basic syntax validation for common file types
      const ext = path.extname(filePath);
      
      switch (ext) {
        case '.json':
          try {
            JSON.parse(newContent);
          } catch (error) {
            return { isValid: false, reason: 'Invalid JSON syntax' };
          }
          break;
          
        case '.js':
        case '.ts':
          // Basic JavaScript/TypeScript validation
          if (this._hasUnbalancedBrackets(newContent)) {
            return { isValid: false, reason: 'Unbalanced brackets detected' };
          }
          break;
      }

      // Check for common edit issues
      if (newContent.length === 0 && originalContent.length > 0) {
        return { isValid: false, reason: 'Edit resulted in empty file' };
      }

      return { isValid: true };

    } catch (error) {
      return { isValid: false, reason: `Validation error: ${error.message}` };
    }
  }

  /**
   * Check for unbalanced brackets (basic syntax validation)
   * @param {string} content - Content to check
   * @returns {boolean} Whether brackets are unbalanced
   */
  _hasUnbalancedBrackets(content) {
    const brackets = { '{': 0, '[': 0, '(': 0 };
    
    for (const char of content) {
      switch (char) {
        case '{': brackets['{']++; break;
        case '}': brackets['{']--; break;
        case '[': brackets['[']++; break;
        case ']': brackets['[']--; break;
        case '(': brackets['(']++; break;
        case ')': brackets['(']--; break;
      }
    }

    return Object.values(brackets).some(count => count !== 0);
  }
}

export default SmartEditTool;