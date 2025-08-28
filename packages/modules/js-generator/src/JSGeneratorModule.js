/**
 * JSGeneratorModule - Legion module for JavaScript code generation
 * 
 * Provides tools for generating JavaScript modules, functions, classes, API endpoints,
 * event handlers, and validating JavaScript syntax.
 */

import { Module } from '@legion/tools-registry';
import { GenerateJavaScriptModuleTool } from './tools/GenerateJavaScriptModuleTool.js';
import { GenerateJavaScriptFunctionTool } from './tools/GenerateJavaScriptFunctionTool.js';
import { GenerateJavaScriptClassTool } from './tools/GenerateJavaScriptClassTool.js';
import { GenerateApiEndpointTool } from './tools/GenerateApiEndpointTool.js';
import { GenerateEventHandlerTool } from './tools/GenerateEventHandlerTool.js';
import { GenerateUnitTestsTool } from './tools/GenerateUnitTestsTool.js';
import { ValidateJavaScriptSyntaxTool } from './tools/ValidateJavaScriptSyntaxTool.js';
import { GenerateHTMLPageTool } from './tools/GenerateHTMLPageTool.js';

class JSGeneratorModule extends Module {
  constructor() {
    super();
    this.name = 'js-generator';
    this.description = 'JavaScript code generation tools for creating modules, functions, classes, and API endpoints';
    this.version = '1.0.0';
    this.config = {};
    this.resourceManager = null;
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new JSGeneratorModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    await super.initialize();
    
    // Create and register tools
    const tools = [
      new GenerateJavaScriptModuleTool(),
      new GenerateJavaScriptFunctionTool(),
      new GenerateJavaScriptClassTool(),
      new GenerateApiEndpointTool(),
      new GenerateEventHandlerTool(),
      new GenerateUnitTestsTool(),
      new ValidateJavaScriptSyntaxTool(),
      new GenerateHTMLPageTool()
    ];
    
    for (const tool of tools) {
      this.registerTool(tool.name, tool);
    }
  }



  /**
   * Generate complete JavaScript project structure
   * Convenience method that orchestrates multiple tools
   */
  async generateProject(projectSpec) {
    const results = {
      modules: [],
      functions: [],
      classes: [],
      validations: []
    };

    try {
      // Generate main module
      if (projectSpec.mainModule) {
        const moduleResult = await this.getTool('generate_javascript_module').execute(projectSpec.mainModule);
        results.modules.push(moduleResult);
      }

      // Generate additional modules
      if (projectSpec.additionalModules) {
        for (const moduleSpec of projectSpec.additionalModules) {
          const moduleResult = await this.getTool('generate_javascript_module').execute(moduleSpec);
          results.modules.push(moduleResult);
        }
      }

      // Generate standalone functions
      if (projectSpec.standaloneFunctions) {
        for (const funcSpec of projectSpec.standaloneFunctions) {
          const funcResult = await this.getTool('generate_javascript_function').execute(funcSpec);
          results.functions.push(funcResult);
        }
      }

      // Validate all generated code
      if (projectSpec.validateGenerated !== false) {
        for (const module of results.modules) {
          const validation = await this.getTool('validate_javascript_syntax').execute({ code: module.code });
          results.validations.push({
            type: 'module',
            filename: module.filename,
            validation
          });
        }

        for (const func of results.functions) {
          const validation = await this.getTool('validate_javascript_syntax').execute({ code: func.code });
          results.validations.push({
            type: 'function',
            validation
          });
        }
      }

      return {
        success: true,
        results,
        summary: {
          modulesGenerated: results.modules.length,
          functionsGenerated: results.functions.length,
          validationsPassed: results.validations.filter(v => v.validation.valid).length,
          validationsFailed: results.validations.filter(v => !v.validation.valid).length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        results
      };
    }
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
      author: 'Legion Team',
      tools: Object.keys(this.tools).length,
      capabilities: [
        'JavaScript module generation',
        'Function generation with JSDoc',
        'Class generation with methods and properties',
        'API endpoint handler generation',
        'Event handler generation',
        'Syntax validation',
        'Code quality analysis'
      ],
      supportedFeatures: [
        'ES2020+ syntax',
        'ESM module system',
        'Async/await functions',
        'Arrow functions',
        'Class inheritance',
        'JSDoc documentation',
        'Express.js endpoints',
        'DOM event handling'
      ]
    };
  }
}

export default JSGeneratorModule;
