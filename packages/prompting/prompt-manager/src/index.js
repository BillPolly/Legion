/**
 * @legion/prompting-manager - Complete LLM interaction orchestrator
 * 
 * This package provides the top-level orchestration for the entire
 * intelligent prompting pipeline, integrating object-query, prompt-builder,
 * and output-schema with retry logic and error handling.
 */

// Main exports
export { PromptManager } from './PromptManager.js';
export { RetryHandler } from './RetryHandler.js';

// Default export - the most common use case
export { PromptManager as default } from './PromptManager.js';