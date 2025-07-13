// Core types and interfaces
export * from './core/types.js';

// LLM Provider interfaces and implementations
export * from './core/providers/types.js';
export { MockLLMProvider } from './core/providers/MockLLMProvider.js';

// Session management
export * from './runtime/session/types.js';
export { SessionManager } from './runtime/session/SessionManager.js';
export { InMemoryPersistence } from './runtime/session/persistence/InMemoryPersistence.js';
export { FilePersistence } from './runtime/session/persistence/FilePersistence.js';

// Context system
export * from './runtime/context/types.js';
export { ContextManager } from './runtime/context/ContextManager.js';
export { StateContextProvider } from './runtime/context/providers/StateContextProvider.js';
export { HistoryContextProvider } from './runtime/context/providers/HistoryContextProvider.js';

// Prompt system
export * from './prompt/types.js';

// Intent recognition
export * from './processing/intent/types.js';

// Main Framework
export { LLMCLIFramework } from './core/framework/LLMCLIFramework.js';

// Commands
export { DefaultChatCommand } from './extensions/commands/DefaultChatCommand.js';

// Version info
export const VERSION = '1.0.0';