// Re-export from split packages (commented out to avoid circular dependencies during tests)
// TODO: Uncomment these when all packages are properly set up
// const { Agent, AgentWithRetry, StructuredResponse } = require('@jsenvoy/agent');
// const { Model } = require('@jsenvoy/model-providers');
// const { ResponseParser, ResponseValidator, RetryManager } = require('@jsenvoy/response-parser');

// exports.Agent = Agent;
// exports.AgentWithRetry = AgentWithRetry;
// exports.StructuredResponse = StructuredResponse;
// exports.Model = Model;
// exports.ResponseParser = ResponseParser;
// exports.ResponseValidator = ResponseValidator;
// exports.RetryManager = RetryManager;

// Export ResourceManager and ModuleFactory
exports.ResourceManager = require('./core/ResourceManager').ResourceManager;
exports.ModuleFactory = require('./core/ModuleFactory').ModuleFactory;

// Export base module classes
exports.OpenAIModule = require('./core/OpenAIModule').OpenAIModule;
exports.OpenAITool = require('./core/OpenAITool').OpenAITool;

// Export modules
exports.CalculatorModule = require('./modules/CalculatorModule').CalculatorModule;
exports.FileModule = require('./modules/FileModule').FileModule;

// Re-export tools from @jsenvoy/tools for backward compatibility
const tools = require('@jsenvoy/tools');
exports.Tool = tools.Tool;
exports.ToolFunctionSpec = tools.ToolFunctionSpec || tools.Tool; // Fallback if not available

// Export all tools for backward compatibility
Object.keys(tools).forEach(key => {
  exports[key] = tools[key];
});