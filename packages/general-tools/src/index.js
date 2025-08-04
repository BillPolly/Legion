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
import JsonModule from './json/JsonModule.js';
import SerperModule from './serper/index.js';
import CommandExecutorModule from './command-executor/index.js';
import AIGenerationModule from './ai-generation/index.js';

// Export module classes only - no hardcoded tool instantiation
export {
  CalculatorModule,
  FileModule,
  GitHubModule,
  JsonModule,
  SerperModule,
  CommandExecutorModule,
  AIGenerationModule
};