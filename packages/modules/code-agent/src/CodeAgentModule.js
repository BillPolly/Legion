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
export class CodeAgentModule extends Module {
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
    
    // NEW APPROACH: Create tools using metadata
    if (this.metadata) {
      const tools = [
        { key: 'generate_html', generator: 'HTMLGenerator' },
        { key: 'generate_javascript', generator: 'JSGenerator' },
        { key: 'generate_css', generator: 'CSSGenerator' },
        { key: 'generate_test', generator: 'TestGenerator' }
      ];

      for (const { key, generator } of tools) {
        try {
          const toolDef = this.metadata.tools[key];
          if (toolDef) {
            // Don't override implementation if it exists in metadata
            if (!toolDef.implementation) {
              toolDef.implementation = { generator };
            }
            const tool = this.createToolFromMetadata(toolDef);
            this.registerTool(toolDef.name, tool);
          }
        } catch (error) {
          console.warn(`Failed to create metadata tool ${key}: ${error.message}`);
        }
      }
    }
    // No fallback needed - this module is metadata-driven only
  }

  /**
   * Create a tool instance from metadata definition
   */
  createToolFromMetadata(toolDef) {
    const module = this; // Capture module reference
    
    const tool = {
      name: toolDef.name,
      description: toolDef.description,
      
      _execute: async function(params) {
        const implementation = toolDef.implementation;
        const GeneratorClass = module.generators[implementation.generator];
        const generator = new GeneratorClass();
        
        // Debug logging
        console.log(`Executing tool ${toolDef.name} with method ${implementation.method}`);
        console.log(`Available generator methods:`, Object.getOwnPropertyNames(Object.getPrototypeOf(generator)));
        
        let result;
        if (implementation.method === 'dynamic') {
          // Handle dynamic logic for complex tools like generate_javascript
          switch (params.type) {
            case 'function':
              result = await generator.generateFunction({
                name: params.name,
                parameters: params.parameters || [],
                description: params.description || `${params.name} function`
              });
              break;
            case 'class':
              result = await generator.generateClass({
                name: params.name,
                description: params.description || `${params.name} class`
              });
              break;
            case 'module':
              result = await generator.generateModule({
                name: params.name,
                description: params.description || `${params.name} module`
              });
              break;
            default:
              throw new Error(`Unsupported code type: ${params.type}`);
          }
        } else {
          // Handle standard mapping (fallback to basic parameter passing)
          const mapping = implementation.mapping || {};
          const args = {};
          
          // If no mapping defined, pass params directly to the method
          if (Object.keys(mapping).length === 0) {
            result = await generator[implementation.method](params);
          } else {
            // Special handling for specific tools that need structured specs
            if (toolDef.name === 'generate_test') {
              // Create minimal test spec structure for TestGenerator
              args.target = params.targetFile;
              args.testType = params.testType || 'unit';
              args.functions = params.functions || [];
              args.setup = undefined; // Explicitly set to undefined
              args.imports = [];
              args.framework = 'jest';
            } else {
              // Standard mapping for other tools
              for (const [key, value] of Object.entries(mapping)) {
                if (typeof value === 'string' && value.includes('||')) {
                  // Handle default values like "template || 'basic'"
                  const [paramName, defaultValue] = value.split(' || ');
                  args[key] = params[paramName.trim()] || eval(defaultValue.trim());
                } else if (typeof value === 'object') {
                  // Handle nested mapping like { "content": "content" }
                  args[key] = {};
                  for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    args[key][nestedKey] = params[nestedValue];
                  }
                } else {
                  args[key] = params[value] || eval(value);
                }
              }
            }
            result = await generator[implementation.method](args);
          }
        }
        
        // Format output according to metadata
        const output = {};
        for (const [key, value] of Object.entries(implementation.output)) {
          if (value === 'result') {
            output[key] = result;
          } else if (value.startsWith('`')) {
            // Handle template literals
            output[key] = eval(value);
          } else {
            output[key] = eval(value);
          }
        }
        
        return output;
      },
      
      getMetadata() {
        return {
          name: toolDef.name,
          description: toolDef.description,
          input: toolDef.inputSchema,
          output: toolDef.outputSchema
        };
      }
    };
    
    return tool;
  }

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