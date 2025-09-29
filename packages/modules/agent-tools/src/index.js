/**
 * AgentTools Module - Entry point
 * 
 * Exports the AgentToolsModule for tool registry integration
 */

// Named exports
export { DisplayResourceTool } from './tools/DisplayResourceTool.js';
export { NotifyUserTool } from './tools/NotifyUserTool.js';  
export { CloseWindowTool } from './tools/CloseWindowTool.js';

// Default export - Legion Module
export { default as AgentToolsModule } from './AgentToolsModule.js';