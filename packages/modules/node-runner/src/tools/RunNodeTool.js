/**
 * @fileoverview RunNodeTool - Execute Node.js processes with comprehensive logging
 */

import { Tool } from '@legion/tools-registry';
import { jsonSchemaToZod } from '@legion/schema';
import { existsSync } from 'fs';

export class RunNodeTool extends Tool {
  constructor(module) {
    super({
      name: 'run_node',
      description: 'Execute Node.js process with comprehensive logging, capturing both backend and frontend logs, with automatic session management and optional dependency installation',
      schema: {
        input: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to the Node.js project directory',
            minLength: 1
          },
          command: {
            type: 'string',
            description: 'Command to execute (e.g., "npm start", "node server.js")',
            minLength: 1
          },
          args: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Additional command line arguments',
            default: []
          },
          description: {
            type: 'string',
            description: 'Optional description for this execution session',
            default: ''
          },
          installDependencies: {
            type: 'boolean',
            description: 'Whether to run npm/yarn install before execution',
            default: false
          },
          env: {
            type: 'object',
            additionalProperties: {
              type: 'string'
            },
            description: 'Environment variables to set for the process',
            default: {}
          },
          timeout: {
            type: 'number',
            description: 'Maximum execution time in milliseconds',
            minimum: 1000,
            maximum: 600000,
            default: 300000
          }
        },
        required: ['projectPath', 'command'],
        additionalProperties: false
        }
      }
    });
    
    this.module = module;
    this.validator = jsonSchemaToZod(this.inputSchema);
  }

  async _execute(args) {
    // Validate input
    const validatedArgs = this.validator.parse(args);
    
    this.emit('progress', { percentage: 0, status: 'Starting execution...' });
    
    try {
      // Validate project path exists
      if (!existsSync(validatedArgs.projectPath)) {
        throw new Error(`Project path does not exist: ${validatedArgs.projectPath}`);
      }
      
      this.emit('progress', { percentage: 10, status: 'Creating session...' });
      
      // Create new session
      const session = await this.module.sessionManager.createSession({
        projectPath: validatedArgs.projectPath,
        command: `${validatedArgs.command} ${(validatedArgs.args || []).join(' ')}`.trim(),
        description: validatedArgs.description || `Running ${validatedArgs.command}`,
        tags: ['node-runner', 'execution']
      });
      
      this.emit('info', { message: `Created session: ${session.sessionId}` });
      this.emit('progress', { percentage: 20, status: 'Session created' });
      
      // Install dependencies if requested
      if (validatedArgs.installDependencies) {
        this.emit('progress', { percentage: 30, status: 'Installing dependencies...' });
        this.emit('info', { message: 'Installing dependencies...' });
        
        await this.module.packageManager.installDependencies(validatedArgs.projectPath);
        
        this.emit('progress', { percentage: 50, status: 'Dependencies installed' });
      }
      
      this.emit('progress', { percentage: 60, status: 'Starting process...' });
      this.emit('info', { message: `Starting process: ${validatedArgs.command}` });
      
      // Parse command into command and args if needed
      let command, args;
      if (validatedArgs.args && validatedArgs.args.length > 0) {
        // Args provided separately
        command = validatedArgs.command;
        args = validatedArgs.args;
      } else {
        // Parse command string
        const commandParts = validatedArgs.command.trim().split(/\s+/);
        command = commandParts[0];
        args = commandParts.slice(1);
      }
      
      // Start the process
      const processResult = await this.module.processManager.start({
        command,
        args,
        workingDir: validatedArgs.projectPath,
        sessionId: session.sessionId,
        env: validatedArgs.env,
        timeout: validatedArgs.timeout
      });
      
      this.emit('progress', { percentage: 80, status: 'Process started' });
      
      // Update session with process info
      await this.module.sessionManager.updateSession(session.sessionId, {
        processId: processResult.processId,
        status: 'running'
      });
      
      this.emit('progress', { percentage: 100, status: 'Execution started successfully' });
      this.emit('info', { 
        message: `Process started successfully. Session: ${session.sessionId}, Process: ${processResult.processId}` 
      });
      
      return {
        sessionId: session.sessionId,
        processId: processResult.processId,
        message: `Node.js process started successfully in ${validatedArgs.projectPath}`,
        projectPath: validatedArgs.projectPath,
        command: validatedArgs.command,
        args: validatedArgs.args || []
      };
      
    } catch (error) {
      this.emit('error', { 
        message: `Execution failed: ${error.message}`,
        error: error.name
      });
      throw error;
    }
  }
}