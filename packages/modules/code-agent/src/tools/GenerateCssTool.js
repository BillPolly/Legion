/**
 * GenerateCssTool - Proper Tool class for CSS generation
 */

import { Tool } from '@legion/tools-registry';

export class GenerateCssTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
  }

  async execute(params) {
    const { CSSGenerator } = this.module.generators;
    const generator = new CSSGenerator();
    
    console.log(`Executing GenerateCssTool with params:`, params);
    
    const result = await generator.generateStylesheet({
      selector: params.selector || 'body',
      properties: params.properties || {},
      responsive: params.responsive || false
    });

    return {
      success: true,
      data: result,
      metadata: {
        toolName: this.name,
        timestamp: new Date().toISOString()
      }
    };
  }
}