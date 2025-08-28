/**
 * CodeAgentModule - Legion module for code generation and testing
 * 
 * Provides tools for JavaScript code generation, validation, and project creation
 * without the complex factory registration system.
 */

import { Module } from '@legion/tools-registry';
import { HTMLGenerator } from './generation/HTMLGenerator.js';
import { JSGenerator } from './generation/JSGenerator.js';
import { CSSGenerator } from './generation/CSSGenerator.js';
import { TestGenerator } from './generation/TestGenerator.js';
import { ValidationUtils } from './utils/ValidationUtils.js';
import { EslintConfigManager } from './config/EslintConfigManager.js';
import { JestConfigManager } from './config/JestConfigManager.js';

/**
 * Simple tool to generate HTML pages
 */
class GenerateHTMLTool {
  constructor() {
    this.name = 'generate_html';
    this.description = 'Generate HTML pages with templates and components';
    this.schema = {
      input: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Page title' },
          content: { type: 'string', description: 'HTML content' },
          template: { type: 'string', description: 'Template type', enum: ['basic', 'bootstrap', 'tailwind'] }
        },
        required: ['title', 'content']
      },
      output: {
        type: 'object',
        properties: {
          html: { type: 'string', description: 'Generated HTML' },
          filename: { type: 'string', description: 'Suggested filename' }
        }
      }
    };
  }

  async _execute(params) {
    const generator = new HTMLGenerator();
    const html = await generator.generateHTML({
      title: params.title,
      body: { content: params.content },
      template: params.template || 'basic'
    });
    
    return {
      html: html,
      filename: `${params.title.toLowerCase().replace(/\s+/g, '-')}.html`
    };
  }

  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      input: this.schema.input,
      output: this.schema.output
    };
  }
}

/**
 * Simple tool to generate JavaScript code
 */
class GenerateJavaScriptTool {
  constructor() {
    this.name = 'generate_javascript';
    this.description = 'Generate JavaScript functions, classes, and modules';
    this.schema = {
      input: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Code type', enum: ['function', 'class', 'module'] },
          name: { type: 'string', description: 'Function/class/module name' },
          parameters: { type: 'array', items: { type: 'string' }, description: 'Function parameters' },
          description: { type: 'string', description: 'What the code should do' }
        },
        required: ['type', 'name']
      },
      output: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Generated JavaScript code' },
          filename: { type: 'string', description: 'Suggested filename' }
        }
      }
    };
  }

  async _execute(params) {
    const generator = new JSGenerator();
    let code;
    
    switch (params.type) {
      case 'function':
        code = await generator.generateFunction({
          name: params.name,
          parameters: params.parameters || [],
          description: params.description || `${params.name} function`
        });
        break;
      case 'class':
        code = await generator.generateClass({
          name: params.name,
          description: params.description || `${params.name} class`
        });
        break;
      case 'module':
        code = await generator.generateModule({
          name: params.name,
          description: params.description || `${params.name} module`
        });
        break;
      default:
        throw new Error(`Unsupported code type: ${params.type}`);
    }
    
    return {
      code: code,
      filename: `${params.name}.js`
    };
  }

  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      input: this.schema.input,
      output: this.schema.output
    };
  }
}

/**
 * Simple tool to generate CSS styles
 */
class GenerateCSSTool {
  constructor() {
    this.name = 'generate_css';
    this.description = 'Generate CSS stylesheets with modern patterns';
    this.schema = {
      input: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector' },
          styles: { type: 'object', description: 'Style properties' },
          framework: { type: 'string', description: 'CSS framework', enum: ['vanilla', 'flexbox', 'grid'] }
        },
        required: ['selector', 'styles']
      },
      output: {
        type: 'object',
        properties: {
          css: { type: 'string', description: 'Generated CSS' },
          filename: { type: 'string', description: 'Suggested filename' }
        }
      }
    };
  }

  async _execute(params) {
    const generator = new CSSGenerator();
    const css = await generator.generateStylesheet({
      selector: params.selector,
      rules: params.styles,
      framework: params.framework || 'vanilla'
    });
    
    return {
      css: css,
      filename: 'styles.css'
    };
  }

  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      input: this.schema.input,
      output: this.schema.output
    };
  }
}

/**
 * Simple tool to generate test files
 */
class GenerateTestTool {
  constructor() {
    this.name = 'generate_test';
    this.description = 'Generate Jest test files for JavaScript code';
    this.schema = {
      input: {
        type: 'object',
        properties: {
          targetFile: { type: 'string', description: 'File to test' },
          testType: { type: 'string', description: 'Test type', enum: ['unit', 'integration', 'e2e'] },
          functions: { type: 'array', items: { type: 'string' }, description: 'Functions to test' }
        },
        required: ['targetFile']
      },
      output: {
        type: 'object',
        properties: {
          test: { type: 'string', description: 'Generated test code' },
          filename: { type: 'string', description: 'Test filename' }
        }
      }
    };
  }

  async _execute(params) {
    const generator = new TestGenerator();
    const test = await generator.generateTest({
      targetFile: params.targetFile,
      testType: params.testType || 'unit',
      functions: params.functions || []
    });
    
    return {
      test: test,
      filename: `${params.targetFile.replace('.js', '')}.test.js`
    };
  }

  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      input: this.schema.input,
      output: this.schema.output
    };
  }
}

/**
 * CodeAgentModule - Main Legion module
 */
export class CodeAgentModule extends Module {
  constructor() {
    super();
    this.name = 'code-agent';
    this.description = 'Code generation and testing tools for JavaScript development';
    this.version = '1.0.0';
  }

  /**
   * Initialize the module
   */
  async initialize() {
    await super.initialize();
    
    // Create tools
    this.registerTool('generate_html', new GenerateHTMLTool());
    this.registerTool('generate_javascript', new GenerateJavaScriptTool());
    this.registerTool('generate_css', new GenerateCSSTool());
    this.registerTool('generate_test', new GenerateTestTool());
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
      author: 'Legion Team',
      tools: this.getTools().length,
      capabilities: [
        'HTML page generation with templates',
        'JavaScript function, class, and module generation',
        'CSS stylesheet generation with modern patterns',
        'Jest test file generation for unit/integration/e2e testing',
        'Code validation and linting'
      ],
      supportedFeatures: [
        'Template-based HTML generation',
        'ES6+ JavaScript code generation',
        'Modern CSS with Flexbox/Grid support',
        'Comprehensive test generation',
        'Code quality validation'
      ]
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