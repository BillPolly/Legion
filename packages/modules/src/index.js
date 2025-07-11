/**
 * @jsenvoy/modules - Core infrastructure for building modular tool systems
 * 
 * This package provides the essential infrastructure for creating extensible
 * tool libraries with dependency injection and modular architecture.
 */

// Export core infrastructure
exports.ResourceManager = require("./ResourceManager").ResourceManager;
exports.ModuleFactory = require("./ModuleFactory").ModuleFactory;

// Export base classes
exports.Tool = require("./Tool");
exports.Module = require("./Module").Module;
exports.ModularTool = require("./ModularTool").ModularTool;
