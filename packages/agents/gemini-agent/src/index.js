/**
 * @legion/gemini-agent - Main exports
 * 
 * Gemini-compatible agent built with Legion framework patterns
 */

export { default as ConversationManager } from './conversation/ConversationManager.js';
export { getResourceManager } from './utils/ResourceAccess.js';
export { handleSlashCommand } from './services/SlashCommandService.js';