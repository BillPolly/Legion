/**
 * NotebookEditTool - Edit specific cells in Jupyter notebooks
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

export class NotebookEditTool extends Tool {
  constructor() {
    super({
      name: 'NotebookEdit',
      description: 'Edit specific cells in Jupyter notebooks (.ipynb files)',
      schema: {
        input: {
          type: 'object',
          properties: {
            notebook_path: {
              type: 'string',
              minLength: 1,
              description: 'Absolute path to the Jupyter notebook file'
            },
            new_source: {
              type: 'string',
              description: 'New source code for the cell'
            },
            cell_id: {
              type: 'string',
              description: 'ID of the cell to edit (optional for replace mode)'
            },
            cell_type: {
              type: 'string',
              enum: ['code', 'markdown'],
              description: 'Type of cell (required for insert mode)'
            },
            edit_mode: {
              type: 'string',
              enum: ['replace', 'insert', 'delete'],
              description: 'Edit mode: replace (default), insert, or delete',
              default: 'replace'
            }
          },
          required: ['notebook_path', 'new_source']
        },
        output: {
          type: 'object',
          properties: {
            notebook_path: {
              type: 'string',
              description: 'Path of the edited notebook'
            },
            cell_modified: {
              type: 'string',
              description: 'ID of the modified cell'
            },
            operation: {
              type: 'string',
              description: 'Operation performed (replace, insert, or delete)'
            },
            notebook_metadata: {
              type: 'object',
              description: 'Updated notebook metadata'
            }
          },
          required: ['notebook_path', 'cell_modified', 'operation', 'notebook_metadata']
        }
      }
    });
  }

  async _execute(input) {
    return await this.editNotebook(input);
  }

  /**
   * Edit a Jupyter notebook
   */
  async editNotebook(input) {
    try {
      const { 
        notebook_path, 
        new_source, 
        cell_id, 
        cell_type, 
        edit_mode = 'replace' 
      } = input;

      // Read the notebook
      let notebookContent;
      let notebook;
      try {
        notebookContent = await fs.readFile(notebook_path, 'utf8');
        notebook = JSON.parse(notebookContent);
      } catch (error) {
        if (error.code === 'ENOENT') {
          return {
            success: false,
            error: {
              code: 'RESOURCE_NOT_FOUND',
              message: `Notebook not found: ${notebook_path}`,
              path: notebook_path
            }
          };
        }
        if (error.code === 'EACCES') {
          return {
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: `Permission denied: ${notebook_path}`,
              path: notebook_path
            }
          };
        }
        if (error instanceof SyntaxError) {
          return {
            success: false,
            error: {
              code: 'INVALID_FORMAT',
              message: `Invalid notebook format: ${notebook_path}`,
              details: error.message
            }
          };
        }
        throw error;
      }

      // Validate notebook structure
      if (!notebook.cells || !Array.isArray(notebook.cells)) {
        const error = new Error('Invalid notebook structure: missing cells array');
        error.code = 'INVALID_FORMAT';
        throw error;
      }

      let modifiedCellId;
      let operation = edit_mode;

      if (edit_mode === 'delete') {
        // Delete a cell
        if (!cell_id) {
          const error = new Error('cell_id is required for delete operation'
            ); error.code = 'MISSING_PARAMETER'; throw error;
        }

        const cellIndex = this.findCellIndex(notebook.cells, cell_id);
        if (cellIndex === -1) {
          return {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Cell not found: ${cell_id}`,
              details: { cell_id }
            }
          };
        }

        notebook.cells.splice(cellIndex, 1);
        modifiedCellId = cell_id;

      } else if (edit_mode === 'insert') {
        // Insert a new cell
        const newCell = this.createCell(new_source, cell_type || 'code');
        
        if (cell_id) {
          // Insert after specified cell
          const cellIndex = this.findCellIndex(notebook.cells, cell_id);
          if (cellIndex === -1) {
            return {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: `Reference cell not found: ${cell_id}`,
                details: { cell_id }
              }
            };
          }
          notebook.cells.splice(cellIndex + 1, 0, newCell);
        } else {
          // Insert at the beginning
          notebook.cells.unshift(newCell);
        }
        
        modifiedCellId = newCell.id || 'new_cell';

      } else {
        // Replace mode (default)
        if (!cell_id) {
          // If no cell_id, replace the first cell
          if (notebook.cells.length === 0) {
            const error = new Error('No cells in notebook to replace'
              ); error.code = 'NOT_FOUND'; throw error;
          }
          
          const cell = notebook.cells[0];
          cell.source = this.formatSource(new_source);
          if (cell_type) {
            cell.cell_type = cell_type;
          }
          modifiedCellId = cell.id || 'cell_0';
        } else {
          // Find and replace specific cell
          const cellIndex = this.findCellIndex(notebook.cells, cell_id);
          if (cellIndex === -1) {
            return {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: `Cell not found: ${cell_id}`,
                details: { cell_id }
              }
            };
          }
          
          const cell = notebook.cells[cellIndex];
          cell.source = this.formatSource(new_source);
          if (cell_type) {
            cell.cell_type = cell_type;
          }
          modifiedCellId = cell_id;
        }
      }

      // Update notebook metadata
      if (!notebook.metadata) {
        notebook.metadata = {};
      }
      notebook.metadata.last_modified = new Date().toISOString();

      // Write the notebook back
      try {
        const updatedContent = JSON.stringify(notebook, null, 2);
        await fs.writeFile(notebook_path, updatedContent, 'utf8');
      } catch (error) {
        if (error.code === 'EACCES') {
          return {
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: `Permission denied writing notebook: ${notebook_path}`,
              path: notebook_path
            }
          };
        }
        throw error;
      }

      return {
          notebook_path,
          cell_modified: modifiedCellId,
          operation: operation,
          notebook_metadata: notebook.metadata
        };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: `Failed to edit notebook: ${error.message}`,
          details: error.stack
        }
      };
    }
  }

  /**
   * Find cell index by ID
   */
  findCellIndex(cells, cellId) {
    return cells.findIndex(cell => 
      cell.id === cellId || 
      (cell.metadata && cell.metadata.id === cellId)
    );
  }

  /**
   * Create a new cell
   */
  createCell(source, cellType) {
    const cell = {
      cell_type: cellType,
      metadata: {
        id: uuidv4()
      },
      source: this.formatSource(source)
    };

    if (cellType === 'code') {
      cell.execution_count = null;
      cell.outputs = [];
    }

    return cell;
  }

  /**
   * Format source as array of strings (Jupyter format)
   */
  formatSource(source) {
    if (Array.isArray(source)) {
      return source;
    }
    
    // Split by newlines but keep the newlines
    const lines = source.split('\n');
    return lines.map((line, index) => 
      index === lines.length - 1 ? line : line + '\n'
    );
  }

}