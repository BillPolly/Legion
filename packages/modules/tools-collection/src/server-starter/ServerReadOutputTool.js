/**
 * ServerReadOutputTool - Read output from managed server processes
 */

import { Tool } from '@legion/tools-registry';
import { processRegistry } from './ServerStartTool.js';

export class ServerReadOutputTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
    this.shortName = 'readout';
  }

  async _execute(params) {
    const { pid, lines = 100 } = params;

    // Validate required parameters
    if (pid === undefined || pid === null) {
      throw new Error('pid parameter is required');
    }

    // Look up the process in the registry
    const processInfo = processRegistry.get(pid);
    
    if (!processInfo) {
      throw new Error(`Process with ID ${pid} not found or not managed by server starter`);
    }

    // Get the requested number of lines from the end
    const outputLines = processInfo.outputLines.slice(-lines);
    
    // Return just the data - execute() will wrap it
    return {
      pid: pid,
      lines: outputLines.length,
      output: outputLines.join('\n'),  // Return as string for consistency with module.json
      success: true  // Include for backward compatibility in data structure
    };
  }
}

export default ServerReadOutputTool;