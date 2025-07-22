/**
 * @legion/tools - Collection of AI agent tools
 * 
 * This package provides ready-to-use tool implementations for various tasks
 * All tools follow the standard function calling format and are loaded generically
 * by the module-loader using ModuleFactory.
 */

// Export only module classes - let module-loader handle everything generically
import CalculatorModule from './calculator/index.js';
import FileModule from './file/index.js';
import GitHubModule from './github/GitHubModule.js';

// Export module classes only - no hardcoded tool instantiation
export {
  CalculatorModule,
  FileModule,
  GitHubModule
};