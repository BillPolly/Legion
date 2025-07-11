/**
 * @jsenvoy/core - Core infrastructure for building modular AI agent systems
 * 
 * This package provides the essential infrastructure for dependency injection,
 * module management, and base classes for tools and modules.
 */

// Export core infrastructure
exports.ResourceManager = require('./core/ResourceManager').ResourceManager;
exports.ModuleFactory = require('./core/ModuleFactory').ModuleFactory;

// Export base classes
exports.OpenAIModule = require('./core/OpenAIModule').OpenAIModule;
exports.OpenAITool = require('./core/OpenAITool').OpenAITool;