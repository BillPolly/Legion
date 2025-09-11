import { ResourceManager } from '../utils/ResourceAccess.js';

class GeminiToolRegistry {
  constructor() {
    this.tools = new Map();
    this.autoApproveList = new Set(['read_file', 'list_files', 'search_files']);
    this.requireApprovalList = new Set(['write_file', 'shell_command', 'delete_file']);
  }

  async registerTool(tool) {
    if (!tool.name || typeof tool.execute !== 'function') {
      throw new Error('Invalid tool registration - must have name and execute method');
    }
    this.tools.set(tool.name, tool);
  }

  async executeTool(toolName, params, signal, updateOutput) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    const needsApproval = this.requireApprovalList.has(toolName);
    if (needsApproval) {
      // Implement approval flow here
      const approved = await this.getToolApproval(toolName, params);
      if (!approved) {
        throw new Error(`Tool ${toolName} execution not approved`);
      }
    }

    try {
      return await tool.execute(params, signal, updateOutput);
    } catch (error) {
      throw new Error(`Tool ${toolName} execution failed: ${error.message}`);
    }
  }

  async getToolApproval(toolName, params) {
    // Implementation would integrate with UI for user approval
    return true; // Default implementation
  }

  isToolRegistered(toolName) {
    return this.tools.has(toolName);
  }

  getRegisteredTools() {
    return Array.from(this.tools.keys());
  }
}

export default GeminiToolRegistry;
