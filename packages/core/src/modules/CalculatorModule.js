const { OpenAIModule } = require('../core');
// Import tool from @jsenvoy/tools package
const { CalculatorEvaluateTool } = require('@jsenvoy/tools/src/calculator');

/**
 * Module containing calculator-related tools
 */
class CalculatorModule extends OpenAIModule {
  // No external dependencies needed
  static dependencies = [];

  constructor({}) {
    super();
    this.name = 'calculator';
    this.tools = [
      new CalculatorEvaluateTool()
    ];
  }
}

module.exports = CalculatorModule;