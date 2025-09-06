/**
 * @legion/prompt-builder - Intelligent template processing with labeled inputs
 * 
 * This package provides smart prompt formatting capabilities, taking prepared
 * labeled inputs and templates to generate optimally formatted prompts with
 * size constraints and content-aware processing.
 */

// Main exports
export { PromptBuilder } from './PromptBuilder.js';
export { TemplateProcessor } from './TemplateProcessor.js';
export { ContentHandler, ContentHandlerRegistry, TextHandler, ArrayHandler, ObjectHandler } from './ContentHandlers.js';
export { SizeManager } from './SizeManager.js';
export { ContextManager } from './ContextManager.js';

// Default export - the most common use case
export { PromptBuilder as default } from './PromptBuilder.js';