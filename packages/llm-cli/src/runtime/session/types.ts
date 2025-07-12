import { ContextProvider } from '../context/types';
import { RecognizedIntent } from '../../processing/intent/types';
import { CommandResult } from '../../core/types';

export interface SessionState {
  // Generic state container
  state: Map<string, any>;
  
  // Conversation history
  history: HistoryEntry[];
  
  // Active context providers
  contextProviders: ContextProvider[];
  
  // Session metadata
  sessionId: string;
  startTime: Date;
  lastActivityTime: Date;
}

export interface HistoryEntry {
  id: string;
  timestamp: Date;
  
  // User input
  input: string;
  
  // Recognized intent
  intent?: RecognizedIntent;
  
  // Execution result
  result?: CommandResult;
  
  // State snapshot after this entry
  stateSnapshot?: Map<string, any>;
  
  // Any errors
  error?: string;
}

export interface StatePersistenceAdapter {
  // Save state
  saveState(sessionId: string, state: SessionState): Promise<void>;
  
  // Load state
  loadState(sessionId: string): Promise<SessionState | null>;
  
  // Delete state
  deleteState(sessionId: string): Promise<void>;
  
  // List sessions
  listSessions?(): Promise<string[]>;
}