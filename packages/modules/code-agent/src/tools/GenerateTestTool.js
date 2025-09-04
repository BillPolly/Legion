/**
 * GenerateTestTool - Proper Tool class for test generation
 */

import { Tool } from '@legion/tools-registry';

export class GenerateTestTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
  }

  async _execute(params) {
    const { TestGenerator } = this.module.generators;
    const generator = new TestGenerator();
    
    console.log(`Executing GenerateTestTool with params:`, params);
    
    const result = await generator.generateTest({
      testType: params.testType || 'unit',
      functionName: params.functionName || 'testFunction',
      description: params.description || 'Generated test'
    });

    return {
      success: true,
      data: result,
      metadata: {
        toolName: this.name,
        testType: params.testType || 'unit',
        timestamp: new Date().toISOString()
      }
    };
  }
}