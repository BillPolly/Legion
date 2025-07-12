// Core types and interfaces
export * from './core/types';

// LLM Provider interfaces and implementations
export * from './core/providers/types';
export { MockLLMProvider } from './core/providers/MockLLMProvider';

// Session management
export * from './runtime/session/types';
export { SessionManager } from './runtime/session/SessionManager';
export { InMemoryPersistence } from './runtime/session/persistence/InMemoryPersistence';
export { FilePersistence } from './runtime/session/persistence/FilePersistence';

// Context system
export * from './runtime/context/types';
export { ContextManager } from './runtime/context/ContextManager';
export { StateContextProvider } from './runtime/context/providers/StateContextProvider';
export { HistoryContextProvider } from './runtime/context/providers/HistoryContextProvider';

// Prompt system
export * from './prompt/types';

// Intent recognition
export * from './processing/intent/types';

// Main Framework
export { LLMCLIFramework } from './core/framework/LLMCLIFramework';

// Commands
export { DefaultChatCommand } from './extensions/commands/DefaultChatCommand';
export type { DefaultChatCommandOptions } from './extensions/commands/DefaultChatCommand';

// Version info
export const VERSION = '1.0.0';