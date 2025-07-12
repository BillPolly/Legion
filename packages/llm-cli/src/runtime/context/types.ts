import { CommandResult } from '../../core/types';
import { SessionState } from '../session/types';

export interface ContextProvider {
  // Unique identifier
  name: string;
  
  // Description for debugging
  description: string;
  
  // Priority for ordering (higher = more important)
  priority?: number;
  
  // Get current context
  getContext(session: SessionState): Promise<ContextData>;
  
  // Update context after command execution
  updateContext?(session: SessionState, result: CommandResult): Promise<void>;
  
  // Check if this provider is relevant
  isRelevant?(session: SessionState): Promise<boolean>;
}

export interface ContextData {
  // Summary for LLM prompt
  summary: string;
  
  // Detailed data if needed
  details?: Record<string, any>;
  
  // Commands that are particularly relevant given this context
  relevantCommands?: string[];
  
  // Warnings or important notes
  warnings?: string[];
  
  // Suggested actions
  suggestions?: string[];
}