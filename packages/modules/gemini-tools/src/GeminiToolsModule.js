/**
 * GeminiToolsModule - Gemini CLI tools ported to Legion framework patterns
 * Follows Legion's Module pattern with metadata-driven architecture
 */

import { Module } from '@legion/tools-registry';
import ReadFileTool from './tools/ReadFileTool.js';
import WriteFileTool from './tools/WriteFileTool.js';
import ListFilesTool from './tools/ListFilesTool.js';
import GrepTool from './tools/GrepTool.js';
import EditFileTool from './tools/EditFileTool.js';
import ShellTool from './tools/ShellTool.js';
import GlobTool from './tools/GlobTool.js';
import ReadManyFilesTool from './tools/ReadManyFilesTool.js';
import WebFetchTool from './tools/WebFetchTool.js';
import WebSearchTool from './tools/WebSearchTool.js';
import MemoryTool from './tools/MemoryTool.js';
import SmartEditTool from './tools/SmartEditTool.js';
import RipGrepTool from './tools/RipGrepTool.js';
import { fileURLToPath } from 'url';

/**
 * GeminiToolsModule - Provides Gemini CLI tools using Legion patterns
 */
class GeminiToolsModule extends Module {
  constructor({ basePath, encoding = 'utf-8' } = {}) {
    super();
    
    // Set required properties as expected by base Module class
    this.name = 'gemini-tools';
    this.description = 'Gemini CLI tools ported to Legion framework patterns';
    
    // Set metadata path for automatic loading
    this.metadataPath = './module.json';
    
    // Store configuration for tools
    this.config = {
      basePath: basePath || process.cwd(),
      encoding
    };
  }

  /**
   * Override getModulePath to support proper path resolution
   */
  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new GeminiToolsModule({});
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module - metadata-driven approach
   */
  async initialize() {
    await super.initialize(); // This will load metadata automatically
    
    // Create all 13 tools that have metadata defined
    const tools = [
      { key: 'read_file', class: ReadFileTool },
      { key: 'write_file', class: WriteFileTool },
      { key: 'list_files', class: ListFilesTool },
      { key: 'grep_search', class: GrepTool },
      { key: 'edit_file', class: EditFileTool },
      { key: 'shell_command', class: ShellTool },
      { key: 'glob_pattern', class: GlobTool },
      { key: 'read_many_files', class: ReadManyFilesTool },
      { key: 'save_memory', class: MemoryTool },
      { key: 'smart_edit', class: SmartEditTool },
      { key: 'web_fetch', class: WebFetchTool },
      { key: 'web_search', class: WebSearchTool },
      { key: 'ripgrep_search', class: RipGrepTool }
    ];

    for (const { key, class: ToolClass } of tools) {
      const tool = this.createToolFromMetadata(key, ToolClass);
      // Pass configuration to tool after creation
      if (tool.config !== undefined) {
        Object.assign(tool, this.config);
      } else {
        tool.config = this.config;
      }
      this.registerTool(tool.name, tool);
    }
  }

  /**
   * Invoke a specific tool
   * @param {string} toolName - The name of the tool to invoke
   * @param {Object} params - The parameters for the tool
   * @returns {Promise<Object>} The result of the operation
   */
  async invoke(toolName, params) {
    const tool = this.getTool(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
        data: {}
      };
    }
    
    // Tools return wrapped results via their execute() method
    return await tool.execute(params);
  }

  /**
   * Get module statistics
   * @returns {Object} Module statistics
   */
  getStatistics() {
    return {
      toolCount: 13,
      basePath: this.config.basePath,
      encoding: this.config.encoding,
      tools: [
        'read_file',
        'write_file', 
        'list_files',
        'grep_search',
        'edit_file',
        'shell_command',
        'glob_pattern',
        'read_many_files',
        'save_memory',
        'smart_edit',
        'web_fetch',
        'web_search',
        'ripgrep_search'
      ]
    };
  }
}

export default GeminiToolsModule;