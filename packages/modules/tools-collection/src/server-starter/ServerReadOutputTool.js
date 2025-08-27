/**
 * ServerReadOutputTool - Read output from managed server processes
 */

import { Tool } from '@legion/tools-registry';
import { processRegistry } from './ServerStartTool.js';

export class ServerReadOutputTool extends Tool {
  constructor() {
    super({
      name: 'server_read_output',
      description: 'Read output from a managed server process',
      schema: {
        input: {
          type: 'object',
          properties: {
            processId: {
              type: 'number',
              description: 'Process ID of the server to read output from'
            },
            lines: {
              type: 'number',
              description: 'Number of lines to read from the end of output',
              default: 50
            }
          },
          required: ['processId']
        },
        output: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether reading output was successful'
            },
            processId: {
              type: 'number',
              description: 'Process ID that was read from'
            },
            lines: {
              type: 'number',
              description: 'Number of lines returned'
            },
            output: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of output lines from the server'
            },
            error: {
              type: 'string',
              description: 'Error message if reading failed'
            }
          },
          required: ['success']
        }
      }
    });
  }

  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.schema.input,
      outputSchema: this.schema.output,
      version: '1.0.0',
      category: 'server',
      tags: ['server', 'output', 'read'],
      security: { evaluation: 'safe' }
    };
  }

  validate(params) {
    const errors = [];
    const warnings = [];
    
    if (!params || typeof params !== 'object') {
      errors.push('Parameters must be an object');
      return { valid: false, errors, warnings };
    }
    
    if (params.processId === undefined || params.processId === null) {
      errors.push('processId is required for reading output');
    }
    
    if (params.processId !== undefined && typeof params.processId !== 'number') {
      errors.push('processId must be a number');
    }
    
    if (params.lines !== undefined && typeof params.lines !== 'number') {
      errors.push('lines must be a number');
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  async execute(params) {
    const { processId, lines = 50 } = params;

    // Validate required parameters
    if (processId === undefined || processId === null) {
      throw new Error('processId parameter is required');
    }

    try {
      // Look up the process in the registry
      const processInfo = processRegistry.get(processId);
      
      if (!processInfo) {
        return {
          success: false,
          error: `Process with ID ${processId} not found or not managed by server starter`,
          processId: processId
        };
      }

      // Get the requested number of lines from the end
      const outputLines = processInfo.outputLines.slice(-lines);
      
      return {
        success: true,
        processId: processId,
        lines: outputLines.length,
        output: outputLines
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        processId: processId
      };
    }
  }
}

export default ServerReadOutputTool;