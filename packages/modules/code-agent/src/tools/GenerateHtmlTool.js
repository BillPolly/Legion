/**
 * GenerateHtmlTool - Proper Tool class for HTML generation
 */

import { Tool } from '@legion/tools-registry';

export class GenerateHtmlTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
  }

  async _execute(params) {
    const { HTMLGenerator } = this.module.generators;
    const generator = new HTMLGenerator();
    
    console.log(`Executing GenerateHtmlTool with params:`, params);
    
    const result = await generator.generatePage({
      title: params.title || 'Generated Page',
      content: params.content || '',
      style: params.style || 'default'
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