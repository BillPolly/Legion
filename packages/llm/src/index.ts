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
} from './LLMClient';

export { RobustJsonParser } from './utils/RobustJsonParser';
export { ILLMProvider, LLMModel } from './providers/ILLMProvider';
export { OpenAIProvider } from './providers/OpenAIProvider';
export { MockProvider } from './providers/MockProvider';

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
