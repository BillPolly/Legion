/**
 * LLM Client Package
 * 
 * Provides robust LLM client functionality with retry logic and error handling
 */

export { 
  LLMClient, 
  LLMClientConfig, 
  ResponseValidator,
  MaxRetriesExceededError,
  ValidationError 
} from './LLMClient.js';

export { SimplePromptClient } from './SimplePromptClient.js';

export { RobustJsonParser } from './utils/RobustJsonParser.js';
export { OpenAIProvider } from './providers/OpenAIProvider.js';
export { MockProvider } from './providers/MockProvider.js';

// Package information
export const PACKAGE_NAME = 'llm';
export const PACKAGE_VERSION = '1.0.0';

export function getPackageInfo() {
  return {
    name: PACKAGE_NAME,
    version: PACKAGE_VERSION,
    ready: true,
    description: 'LLM client with retry logic and error handling'
  };
}