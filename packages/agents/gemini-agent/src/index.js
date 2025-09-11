/**
 * @legion/gemini-agent - Main exports
 * 
 * Gemini-compatible agent built with Legion framework patterns
 */

export { GeminiCompatibleAgent } from './core/GeminiCompatibleAgent.js';
export { getResourceManager } from './utils/ResourceAccess.js';

// Helper function to create agent instance
export async function createAgent(config = {}) {
  const { GeminiCompatibleAgent } = await import('./core/GeminiCompatibleAgent.js');
  const { getResourceManager } = await import('./utils/ResourceAccess.js');
  
  const resourceManager = await getResourceManager();
  const agent = new GeminiCompatibleAgent(config, resourceManager);
  await agent.initialize();
  
  return agent;
}