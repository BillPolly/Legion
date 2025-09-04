/**
 * GenerateJavascriptTool - Proper Tool class for JavaScript generation
 */

import { Tool } from '@legion/tools-registry';

export class GenerateJavascriptTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
  }

  async _execute(params) {
    const { JSGenerator } = this.module.generators;
    const generator = new JSGenerator();
    
    console.log(`Executing GenerateJavascriptTool with params:`, params);
    
    let result;
    if (params.type) {
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
      // Default to function generation
      result = await generator.generateFunction({
        name: params.name || 'generatedFunction',
        parameters: params.parameters || [],
        description: params.description || 'Generated function'
      });
    }

    return {
      success: true,
      data: result,
      metadata: {
        toolName: this.name,
        generatedType: params.type || 'function',
        timestamp: new Date().toISOString()
      }
    };
  }
}