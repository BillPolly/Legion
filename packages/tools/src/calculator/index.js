/**
 * Calculator module for OpenAI function calling
 * Exports the CalculatorModule which contains calculator tools
 */

const CalculatorModule = require('./CalculatorModule');

// Default export is the CalculatorModule
module.exports = CalculatorModule;

// Also export individual components
module.exports.CalculatorModule = CalculatorModule;
module.exports.CalculatorTool = CalculatorModule.CalculatorTool;