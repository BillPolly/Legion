/**
 * CodeAgentModule - Legion module for code generation and testing
 * 
 * Provides tools for JavaScript code generation, validation, and project creation
 * using the metadata-driven architecture.
 */

import { Module } from '@legion/tools-registry';
import { HTMLGenerator } from './generation/HTMLGenerator.js';
import { JSGenerator } from './generation/JSGenerator.js';
import { CSSGenerator } from './generation/CSSGenerator.js';
import { TestGenerator } from './generation/TestGenerator.js';
import { GenerateHtmlTool } from './tools/GenerateHtmlTool.js';
import { GenerateJavascriptTool } from './tools/GenerateJavascriptTool.js';
import { GenerateCssTool } from './tools/GenerateCssTool.js';
import { GenerateTestTool } from './tools/GenerateTestTool.js';
import { ValidationUtils } from './utils/ValidationUtils.js';
import { EslintConfigManager } from './config/EslintConfigManager.js';
import { JestConfigManager } from './config/JestConfigManager.js';
import { createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


/**
 * CodeAgentModule - Main Legion module using metadata-driven architecture
 */
class CodeAgentModule extends Module {
  constructor() {
    super();
    this.name = 'code-agent';
    this.description = 'Code generation tools for HTML, JavaScript, CSS, and tests';
    this.version = '1.0.0';
    
    // NEW: Set metadata path for automatic loading
    this.metadataPath = './tools-metadata.json';
    
    this.generators = {
      HTMLGenerator,
      JSGenerator, 
      CSSGenerator,
      TestGenerator
    };
  }

  /**
   * Override getModulePath to support proper path resolution
   */
  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  /**
   * Initialize the module using metadata-driven architecture
   */
  async initialize() {
    await super.initialize(); // This loads metadata automatically
    
    // FIXED APPROACH: Create tools using proper base class pattern
    if (this.metadata) {
      const tools = [
        { key: 'generate_html', class: GenerateHtmlTool },
        { key: 'generate_javascript', class: GenerateJavascriptTool },
        { key: 'generate_css', class: GenerateCssTool },
        { key: 'generate_test', class: GenerateTestTool }
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
  }

  // REMOVED: Broken createToolFromMetadata override
  // Now using base class method that creates proper Tool instances

  /**
   * Get all tools provided by this module
   */
  getTools() {
    if (!this.initialized) {
      throw new Error('CodeAgentModule must be initialized before getting tools');
    }

    return Object.values(this.tools);
  }

  /**
   * Get tool by name
   */
  getTool(name) {
    return this.tools[name];
  }

  /**
   * Cleanup the module
   */
  async cleanup() {
    this.tools = {};
    await super.cleanup();
  }

  /**
   * Get module metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      version: this.version,
      author: this.author || 'Legion Team',
      tools: this.getTools().length,
      capabilities: this.capabilities || [],
      supportedFeatures: this.supportedFeatures || []
    };
  }

  /**
   * Static async factory method
   */
  static async create(resourceManager) {
    const module = new CodeAgentModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }
}

export default CodeAgentModule;