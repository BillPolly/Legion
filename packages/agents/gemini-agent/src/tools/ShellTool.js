import { ResourceManager } from '../utils/ResourceAccess.js';

class ShellTool {
  constructor() {
    this.name = 'shell_command';
    this.schema = {
      type: 'object',
      properties: {
        command: { type: 'string' },
        working_directory: { type: 'string', optional: true },
        timeout: { type: 'number', optional: true }
      },
      required: ['command']
    };
  }

  async execute(params, signal, updateOutput) {
    const { command, working_directory, timeout } = params;
    const resourceManager = await ResourceManager.getInstance();

    try {
      // Validate command for security
      this.validateCommand(command);

      const result = await resourceManager.executeCommand(command, {
        cwd: working_directory,
        timeout,
        signal,
        onOutput: updateOutput
      });

      return {
        success: true,
        output: result.output,
        exit_code: result.exitCode
      };
    } catch (error) {
      throw new Error(`Shell command failed: ${error.message}`);
    }
  }

  validateCommand(command) {
    // Implement security validation
    const dangerousCommands = ['rm -rf', 'mkfs', 'dd', '> /dev'];
    if (dangerousCommands.some(cmd => command.includes(cmd))) {
      throw new Error('Potentially dangerous command rejected');
    }
  }
}

export default ShellTool;
