const { OpenAIModule } = require('../core');
const CalculatorEvaluateTool = require('../tools/calculator/CalculatorEvaluateTool');

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