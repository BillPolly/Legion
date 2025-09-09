/**
 * Gemini Tools Module - Main exports
 * 
 * Gemini CLI tools ported to Legion framework patterns
 */

export { default as GeminiToolsModule } from './GeminiToolsModule.js';
export { default as ReadFileTool } from './tools/ReadFileTool.js';
export { default as WriteFileTool } from './tools/WriteFileTool.js';
export { default as ListFilesTool } from './tools/ListFilesTool.js';

// Helper function to create module instance
export async function createGeminiToolsModule(resourceManager, config = {}) {
  const { GeminiToolsModule } = await import('./GeminiToolsModule.js');
  return await GeminiToolsModule.create(resourceManager);
}