const { OpenAIModule } = require('@jsenvoy/core');
// Import tool from local calculator package
const { CalculatorEvaluateTool } = require('../calculator');

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