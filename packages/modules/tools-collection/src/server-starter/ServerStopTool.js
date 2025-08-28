/**
 * ServerStopTool - Stop managed server processes
 */

import { Tool } from '@legion/tools-registry';
import { processRegistry } from './ServerStartTool.js';

export class ServerStopTool extends Tool {
  constructor() {
    super({
      name: 'server_stop',
      description: 'Stop a managed server process',
      schema: {
        input: {
          type: 'object',
          properties: {
            processId: {
              type: 'number',
              description: 'Process ID of the server to stop'
            },
            graceful: {
              type: 'boolean',
              description: 'Whether to attempt graceful shutdown with SIGTERM first',
              default: true
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds to wait for graceful shutdown',
              default: 5000
            }
          },
          required: ['processId']
        },
        output: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether stopping the server was successful'
            },
            processId: {
              type: 'number',
              description: 'Process ID that was stopped'
            },
            status: {
              type: 'string',
              description: 'Final status of the stop operation'
            },
            method: {
              type: 'string',
              description: 'Method used to stop the process (graceful or forced)'
            },
            finalOutput: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Final lines of output before stopping'
            },
            error: {
              type: 'string',
              description: 'Error message if stopping failed'
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
      tags: ['server', 'stop', 'process'],
      security: { evaluation: 'restricted' }
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
      errors.push('processId is required for stopping server');
    }
    
    if (params.processId !== undefined && typeof params.processId !== 'number') {
      errors.push('processId must be a number');
    }
    
    if (params.graceful !== undefined && typeof params.graceful !== 'boolean') {
      errors.push('graceful must be a boolean');
    }
    
    if (params.timeout !== undefined && typeof params.timeout !== 'number') {
      errors.push('timeout must be a number');
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  async _execute(params) {
    const { processId, graceful = true, timeout = 5000 } = params;

    // Validate required parameters
    if (processId === undefined || processId === null) {
      throw new Error('processId parameter is required');
    }

    // Look up the process in the registry
    const processInfo = processRegistry.get(processId);
    
    if (!processInfo) {
      throw new Error(`Process with ID ${processId} not found or not managed by server starter`);
    }

    const { process: serverProcess, outputLines } = processInfo;
    
    // Check if process is already terminated
    if (serverProcess.killed || serverProcess.exitCode !== null) {
      processRegistry.delete(processId);
      throw new Error(`Process with ID ${processId} is already terminated`);
    }

    let stopMethod = 'forced';
    
    if (graceful) {
      // Attempt graceful shutdown with SIGTERM
      serverProcess.kill('SIGTERM');
      stopMethod = 'graceful';
      
      // Wait for graceful shutdown with timeout
      const gracefulPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          // Force kill if graceful timeout
          try {
            serverProcess.kill('SIGKILL');
            stopMethod = 'forced';
            resolve();
          } catch (killError) {
            reject(killError);
          }
        }, timeout);

        serverProcess.on('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      
      await gracefulPromise;
    } else {
      // Force kill immediately
      serverProcess.kill('SIGKILL');
      stopMethod = 'forced';
    }
    
    // Get final output
    const finalOutput = outputLines.slice(-10);
    
    // Remove from registry
    processRegistry.delete(processId);
    
    return {
      processId: processId,
      status: 'stopped',
      method: stopMethod,
      finalOutput: finalOutput
    };
  }
}

export default ServerStopTool;