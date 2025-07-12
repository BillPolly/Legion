/**
 * ToolNotFoundError - Error thrown when a tool is not found
 */

export class ToolNotFoundError extends Error {
  constructor(toolName, availableTools = []) {
    super(`Tool not found: ${toolName}`);
    this.name = 'ToolNotFoundError';
    this.toolName = toolName;
    this.availableTools = availableTools;
    
    // Extract module name if provided
    if (toolName.includes('.')) {
      const [moduleName, tool] = toolName.split('.');
      this.moduleName = moduleName;
      this.tool = tool;
    }
  }
}

export default ToolNotFoundError;