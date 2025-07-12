import { ContextProvider } from '../runtime/context/types';
import { PromptTemplate } from '../prompt/types';
import { LLMProvider } from '../core/providers/types';
import { SessionState, StatePersistenceAdapter } from '../runtime/session/types';

// Command Types
export interface CommandRegistry {
  [commandName: string]: CommandDefinition;
}

export interface CommandDefinition {
  // Core functionality
  handler: CommandHandler;
  description: string;
  
  // Parameters with detailed metadata
  parameters?: ParameterDefinition[];
  
  // Rich information for LLM
  examples?: CommandExample[];
  useCases?: string[];
  relatedCommands?: string[];
  category?: string;
  
  // Dynamic help based on current state
  helpGenerator?: (session: SessionState) => string;
  
  // Execution requirements
  requirements?: CommandRequirements;
  
  // Custom metadata
  metadata?: Record<string, any>;
}

export interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
  description: string;
  required: boolean;
  default?: any;
  
  // Validation
  validator?: (value: any) => boolean;
  validationError?: string;
  
  // Hints for LLM
  examples?: any[];
  enum?: any[];
  pattern?: string;
  
  // For array types
  items?: { type: 'string' | 'number' | 'boolean' | 'object' };
}

// Alias for better naming
export type CommandParameter = ParameterDefinition;

export interface CommandExample {
  input: string;
  description?: string;
  context?: string;
  output?: string;
}

export interface CommandRequirements {
  // Required state keys
  requiredState?: string[];
  
  // Custom requirement checker
  customChecker?: (session: SessionState) => boolean;
  
  // Error message if requirements not met
  errorMessage?: string;
}

export type CommandHandler = (args: CommandArgs, session: SessionState) => Promise<CommandResult>;

export interface CommandArgs {
  [key: string]: any;
}

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: any;
  
  // State updates
  stateUpdates?: Map<string, any>;
  
  // Suggestions for next actions
  suggestions?: string[];
  
  // Additional context for response generation
  responseContext?: Record<string, any>;
}

// Framework Configuration
export interface LLMCLIConfig {
  // LLM Configuration
  llmProvider: LLMProvider;
  
  // Command Registry
  commands: CommandRegistry;
  
  // Context Providers
  contextProviders?: ContextProvider[];
  
  // Customization
  systemPrompt?: string;
  promptTemplate?: PromptTemplate;
  
  // Session Configuration
  sessionConfig?: SessionConfig;
  
  // Hooks
  hooks?: FrameworkHooks;
  
  // Default chat behavior
  disableDefaultChat?: boolean;
}

export interface SessionConfig {
  // Maximum conversation history to maintain
  maxHistoryLength?: number;
  
  // Session timeout in milliseconds
  timeout?: number;
  
  // Initial state
  initialState?: Map<string, any>;
  
  // State persistence adapter
  persistenceAdapter?: StatePersistenceAdapter;
}

export interface FrameworkHooks {
  // Called before command execution
  beforeCommand?: (command: string, args: any, session: SessionState) => Promise<void>;
  
  // Called after command execution
  afterCommand?: (result: CommandResult, session: SessionState) => Promise<void>;
  
  // Called when session starts
  onSessionStart?: (session: SessionState) => Promise<void>;
  
  // Called when session ends
  onSessionEnd?: (session: SessionState) => Promise<void>;
}

// Error Types
export enum ErrorType {
  INTENT_RECOGNITION_FAILED = 'INTENT_RECOGNITION_FAILED',
  COMMAND_NOT_FOUND = 'COMMAND_NOT_FOUND',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  LLM_ERROR = 'LLM_ERROR',
  CONTEXT_ERROR = 'CONTEXT_ERROR',
  SESSION_ERROR = 'SESSION_ERROR'
}

export interface FrameworkError {
  type: ErrorType;
  message: string;
  details?: any;
  suggestions?: string[];
}

export class LLMCLIError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public details?: any,
    public suggestions?: string[]
  ) {
    super(message);
    this.name = 'LLMCLIError';
  }
}