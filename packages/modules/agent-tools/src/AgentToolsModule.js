/**
 * AgentToolsModule - UI tools for agent planning
 * 
 * Provides tools that enable agents to plan rich user interactions
 * involving floating windows, notifications, and resource display.
 */

import { Module } from '@legion/tools-registry';
import { DisplayResourceTool } from './tools/DisplayResourceTool.js';
import { NotifyUserTool } from './tools/NotifyUserTool.js';
import { CloseWindowTool } from './tools/CloseWindowTool.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class AgentToolsModule extends Module {
  constructor() {
    super();
    this.name = 'agent-tools-module';
    this.description = 'UI tools for agent planning that integrate with transparent resource handle system';
    this.version = '1.0.0';
    this.resourceManager = null;
    
    // Set metadata path for base class to load module.json
    this.metadataPath = path.join(__dirname, 'module.json');
    
    // Tools will be initialized in initialize() - use object format for Module base class
    this.tools = {};
  }
  
  /**
   * Initialize the module and create tool instances
   */
  async initialize() {
    console.log('🔄 Initializing AgentToolsModule...');
    
    try {
      // Call parent initialize() to load metadata automatically
      await super.initialize();
      
      console.log('🔍 Metadata loaded:', this.metadata ? 'YES' : 'NO');
      console.log('🔍 Metadata file path:', this.metadataPath);
      if (this.metadata) {
        console.log('🔍 Metadata tools:', Object.keys(this.metadata.tools || {}).length);
        console.log('🔍 Tool keys:', Object.keys(this.metadata.tools || {}));
      }
      
      // Create tools using proper base class pattern with metadata
      if (this.metadata) {
        const tools = [
          { key: 'display_resource', class: DisplayResourceTool },
          { key: 'notify_user', class: NotifyUserTool },
          { key: 'close_window', class: CloseWindowTool }
        ];

        for (const { key, class: ToolClass } of tools) {
          try {
            const toolMetadata = this.getToolMetadata(key);
            if (toolMetadata) {
              // Use base class method with proper Tool class constructor
              const tool = this.createToolFromMetadata(key, ToolClass);
              this.registerTool(toolMetadata.name, tool);
              console.log(`✅ Created proper Tool instance: ${toolMetadata.name}`);
            }
          } catch (error) {
            console.warn(`Failed to create tool ${key}: ${error.message}`);
          }
        }
      }
      
      console.log(`✅ AgentToolsModule initialized with ${Object.keys(this.tools).length} tools`);
      
      // Debug: Test getTools() method and tool structure
      try {
        const toolsArray = this.getTools();
        console.log('🔍 getTools() returns:', Array.isArray(toolsArray) ? `array with ${toolsArray.length} tools` : 'not an array');
        if (Array.isArray(toolsArray)) {
          console.log('🔍 Tool names:', toolsArray.map(t => t.name));
          toolsArray.forEach(tool => {
            console.log(`🔍 Tool ${tool.name}:`);
            console.log(`   - has name: ${!!tool.name}`);
            console.log(`   - has execute: ${typeof tool.execute === 'function'}`);
            console.log(`   - has _execute: ${typeof tool._execute === 'function'}`);
            console.log(`   - constructor: ${tool.constructor.name}`);
          });
        }
      } catch (error) {
        console.error('❌ getTools() error:', error.message);
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize AgentToolsModule:', error);
      throw error;
    }
  }
  
  /**
   * Static factory method required by tool registry
   * @param {Object} resourceManager - Resource manager instance
   * @returns {AgentToolsModule} Module instance
   */
  static async create(resourceManager) {
    const module = new AgentToolsModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }
  
  /**
   * Get tool by name
   * @param {string} toolName - Name of the tool
   * @returns {Object|null} Tool instance or null
   */
  getTool(toolName) {
    return this.tools.find(tool => tool.name === toolName) || null;
  }
  
  /**
   * Get all tool names
   * @returns {Array<string>} Array of tool names
   */
  getToolNames() {
    return this.tools.map(tool => tool.name);
  }
}