/**
 * prompt-manager package exports
 */

export { PromptManager } from './PromptManager.js';
export { default as TemplatedPrompt } from './TemplatedPrompt.js';
export { default as PromptRegistry } from './PromptRegistry.js';

// Convenience factory functions
export function createPrompt(template, options = {}) {
  const { default: TemplatedPrompt } = await import('./TemplatedPrompt.js');
  return new TemplatedPrompt(template, options);
}

export async function createRegistry(directories = []) {
  const { default: PromptRegistry } = await import('./PromptRegistry.js');
  const registry = new PromptRegistry();
  
  for (const dir of directories) {
    registry.addDirectory(dir);
  }
  
  if (directories.length > 0) {
    await registry.loadPrompts();
  }
  
  return registry;
}