/**
 * @fileoverview StopNodeTool - Stop Node.js processes with graceful shutdown
 */

import { Tool } from '@legion/tools-registry';
import { jsonSchemaToZod } from '@legion/schema';

export class StopNodeTool extends Tool {
  constructor(module) {
    super({
      name: 'stop_node',
      description: 'Stop running Node.js processes by process ID, session ID, or all processes with configurable termination behavior',
      schema: {
        input: {
        type: 'object',
        properties: {
          processId: {
            type: 'string',
            description: 'Specific process ID to terminate',
            minLength: 1
          },
          sessionId: {
            type: 'string', 
            description: 'Session ID - stops all processes in this session',
            minLength: 1
          },
          stopAll: {
            type: 'boolean',
            description: 'Stop all running processes',
            default: false
          },
          graceful: {
            type: 'boolean',
            description: 'Use graceful termination (SIGTERM) before forceful kill',
            default: true
          },
          timeout: {
            type: 'number',
            description: 'Maximum time to wait for graceful shutdown in milliseconds',
            minimum: 1000,
            maximum: 60000,
            default: 10000
          }
        },
        additionalProperties: false,
        anyOf: [
          { required: ['processId'] },
          { required: ['sessionId'] },
          { required: ['stopAll'] }
        ]
        }
      }
    });
    
    this.module = module;
    this.validator = jsonSchemaToZod(this.inputSchema);
  }

  async execute(args) {
    // Validate input
    const validatedArgs = this.validator.parse(args);
    
    this.emit('progress', { percentage: 0, status: 'Starting termination...' });
    
    try {
      let stoppedProcesses = [];
      let terminationType = 'unknown';
      
      if (validatedArgs.processId) {
        // Stop single process by ID
        terminationType = 'single-process';
        this.emit('progress', { percentage: 20, status: 'Stopping single process...' });
        this.emit('info', { message: `Stopping process: ${validatedArgs.processId}` });
        
        const killed = await this.module.processManager.kill(validatedArgs.processId);
        
        if (killed) {
          stoppedProcesses.push(validatedArgs.processId);
          this.emit('progress', { percentage: 100, status: 'Process stopped successfully' });
          
          return {
            success: true,
            stoppedProcesses,
            terminationType,
            message: `Process ${validatedArgs.processId} stopped successfully`
          };
        } else {
          return {
            success: false,
            stoppedProcesses: [],
            terminationType,
            message: `Process ${validatedArgs.processId} not found or already stopped`
          };
        }
        
      } else if (validatedArgs.sessionId) {
        // Stop all processes in session
        terminationType = 'session';
        this.emit('progress', { percentage: 20, status: 'Finding session processes...' });
        
        const session = await this.module.sessionManager.getSession(validatedArgs.sessionId);
        if (!session) {
          return {
            success: false,
            stoppedProcesses: [],
            terminationType,
            message: `Session not found: ${validatedArgs.sessionId}`
          };
        }
        
        this.emit('info', { message: `Stopping all processes in session: ${validatedArgs.sessionId}` });
        
        // Get all running processes and filter by session
        const runningProcesses = this.module.processManager.getRunningProcesses();
        const sessionProcesses = [];
        
        for (const processId of runningProcesses) {
          const processInfo = this.module.processManager.getProcessInfo(processId);
          if (processInfo && processInfo.sessionId === validatedArgs.sessionId) {
            sessionProcesses.push(processId);
          }
        }
        
        this.emit('progress', { percentage: 40, status: `Stopping ${sessionProcesses.length} processes...` });
        
        // Stop each process in the session
        for (const processId of sessionProcesses) {
          const killed = await this.module.processManager.kill(processId);
          if (killed) {
            stoppedProcesses.push(processId);
          }
        }
        
        this.emit('progress', { percentage: 80, status: 'Ending session...' });
        
        // End the session
        await this.module.sessionManager.endSession(validatedArgs.sessionId);
        
        this.emit('progress', { percentage: 100, status: 'Session stopped successfully' });
        
        return {
          success: true,
          stoppedProcesses,
          terminationType,
          message: `Session ${validatedArgs.sessionId} stopped with ${stoppedProcesses.length} processes terminated`
        };
        
      } else if (validatedArgs.stopAll) {
        // Stop all running processes
        terminationType = 'all-processes';
        this.emit('progress', { percentage: 20, status: 'Stopping all processes...' });
        this.emit('info', { message: 'Stopping all running processes' });
        
        const runningProcesses = this.module.processManager.getRunningProcesses();
        this.emit('progress', { percentage: 40, status: `Stopping ${runningProcesses.length} processes...` });
        
        await this.module.processManager.killAll();
        stoppedProcesses = [...runningProcesses]; // Copy the list before they're cleared
        
        this.emit('progress', { percentage: 100, status: 'All processes stopped' });
        
        return {
          success: true,
          stoppedProcesses,
          terminationType,
          message: `All processes stopped (${stoppedProcesses.length} processes terminated)`
        };
      }
      
      // Should not reach here due to schema validation
      throw new Error('Invalid termination parameters');
      
    } catch (error) {
      this.emit('error', {
        message: `Termination failed: ${error.message}`,
        error: error.name
      });
      throw error;
    }
  }
}