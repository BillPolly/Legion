// Command Types

// Error Types
export const ErrorType = {
  INTENT_RECOGNITION_FAILED: 'INTENT_RECOGNITION_FAILED',
  COMMAND_NOT_FOUND: 'COMMAND_NOT_FOUND',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  LLM_ERROR: 'LLM_ERROR',
  CONTEXT_ERROR: 'CONTEXT_ERROR',
  SESSION_ERROR: 'SESSION_ERROR'
};

export class LLMCLIError extends Error {
  constructor(type, message, details, suggestions) {
    super(message);
    this.name = 'LLMCLIError';
    this.type = type;
    this.details = details;
    this.suggestions = suggestions;
  }
}