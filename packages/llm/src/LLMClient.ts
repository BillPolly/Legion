import { ILLMProvider, LLMModel } from './providers/ILLMProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { MockProvider } from './providers/MockProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { EventEmitter } from 'events';

/**
 * Configuration options for the LLM client
 */
export interface LLMClientConfig {
  provider?: 'anthropic' | 'openai' | 'mock';
  apiKey?: string;
  model?: string;
  maxRetries?: number;
  baseDelay?: number;
  serverErrorDelay?: number;
}

/**
 * Response validator function type
 */
export type ResponseValidator = (response: string) => boolean;

/**
 * Error thrown when maximum retry attempts are exceeded for LLM operations
 */
export class MaxRetriesExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaxRetriesExceededError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MaxRetriesExceededError);
    }
  }
}

/**
 * Error thrown when validation of data or responses fails
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

/**
 * LLM interaction event data
 */
export interface LLMInteractionEvent {
  id: string;
  timestamp: string;
  type: 'request' | 'response' | 'error';
  prompt?: string;
  response?: string;
  error?: string;
  model: string;
  provider: string;
  attempt: number;
  maxTokens?: number;
}

/**
 * Robust LLM client with retry logic and error handling for knowledge graph construction
 */
export class LLMClient extends EventEmitter {
  private readonly provider: ILLMProvider;
  private model: string;
  private readonly maxRetries: number;
  private readonly baseDelay: number;
  private readonly serverErrorDelay: number;
  private interactionCounter: number = 0;
  public readonly clientId: string; // Unique identifier for this client instance

  constructor(config: LLMClientConfig) {
    super();
    
    // Generate unique client ID
    this.clientId = `llm-client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Initialize provider based on config
    const providerType = config.provider || 'anthropic';
    
    switch (providerType) {
      case 'anthropic':
        if (!config.apiKey) {
          throw new Error('API key is required for Anthropic provider');
        }
        this.provider = new AnthropicProvider(config.apiKey);
        break;
      case 'openai':
        if (!config.apiKey) {
          throw new Error('API key is required for OpenAI provider');
        }
        this.provider = new OpenAIProvider(config.apiKey);
        break;
      case 'mock':
        this.provider = new MockProvider();
        break;
      default:
        throw new Error(`Unknown provider: ${providerType}`);
    }

    this.model = config.model || 'claude-3-sonnet-20240229';
    this.maxRetries = config.maxRetries !== undefined ? config.maxRetries : 3;
    this.baseDelay = config.baseDelay || 1000;
    this.serverErrorDelay = config.serverErrorDelay || 5000;
  }

  /**
   * Standard completion with retry logic and error handling
   */
  async complete(prompt: string, maxTokens: number = 1000): Promise<string> {
    const interactionId = `llm-${++this.interactionCounter}-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // Log the request with client ID and short prompt snippet
    const promptSnippet = prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt;
    console.log(`[LLMClient ${this.clientId}] REQUEST ${timestamp}: "${promptSnippet}"`);
    
    // Emit request event
    this.emitInteractionEvent({
      id: interactionId,
      timestamp,
      type: 'request',
      prompt,
      model: this.model,
      provider: this.provider.getProviderName(),
      attempt: 1,
      maxTokens
    });

    // Handle zero maxRetries case
    if (this.maxRetries === 0) {
      const error = new MaxRetriesExceededError(`Failed after ${this.maxRetries} attempts`);
      this.emitInteractionEvent({
        id: interactionId,
        timestamp: new Date().toISOString(),
        type: 'error',
        prompt,
        error: error.message,
        model: this.model,
        provider: this.provider.getProviderName(),
        attempt: 1
      });
      throw error;
    }
    
    let lastError: any;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.provider.complete(prompt, this.model, maxTokens);
        
        // Log the response with client ID and short response snippet
        const responseSnippet = response.length > 50 ? response.substring(0, 50) + '...' : response;
        console.log(`[LLMClient ${this.clientId}] RESPONSE ${new Date().toISOString()}: "${responseSnippet}"`);
        
        // Emit successful response event
        this.emitInteractionEvent({
          id: interactionId,
          timestamp: new Date().toISOString(),
          type: 'response',
          prompt,
          response,
          model: this.model,
          provider: this.provider.getProviderName(),
          attempt: attempt + 1
        });
        
        return response;
        
      } catch (error: any) {
        lastError = error;
        
        // Emit error event for this attempt
        this.emitInteractionEvent({
          id: `${interactionId}-attempt-${attempt + 1}`,
          timestamp: new Date().toISOString(),
          type: 'error',
          prompt,
          error: error.message,
          model: this.model,
          provider: this.provider.getProviderName(),
          attempt: attempt + 1
        });
        
        if (error.status === 429) { // Rate limit
          if (attempt < this.maxRetries - 1) {
            await this.sleep(this.calculateBackoffDelay(attempt));
            continue;
          }
        } else if (error.status >= 500) { // Server error
          if (attempt < this.maxRetries - 1) {
            await this.sleep(this.serverErrorDelay);
            continue;
          }
        } else {
          // Client errors (4xx except 429) - don't retry
          throw error;
        }
      }
    }
    
    throw new MaxRetriesExceededError(`Failed after ${this.maxRetries} attempts`);
  }

  /**
   * Emit interaction event
   */
  private emitInteractionEvent(event: LLMInteractionEvent): void {
    this.emit('interaction', event);
  }

  /**
   * Complete with custom validation of response
   */
  async completeWithValidation(
    prompt: string, 
    validator: ResponseValidator,
    maxTokens: number = 1000
  ): Promise<string> {
    let currentPrompt = prompt;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const response = await this.complete(currentPrompt, maxTokens);
      
      if (validator(response)) {
        return response;
      }
      
      currentPrompt += `\n\nPrevious response was invalid: ${response}\nPlease correct and respond again.`;
    }
    
    throw new ValidationError(`Failed to get valid response after ${this.maxRetries} attempts`);
  }

  /**
   * Complete with JSON response validation
   */
  async completeWithJsonValidation(
    prompt: string,
    maxTokens: number = 1000
  ): Promise<string> {
    const jsonValidator: ResponseValidator = (response: string) => {
      try {
        // Look for both JSON objects {} and JSON arrays []
        const jsonMatch = response.match(/[\{\[][\s\S]*[\}\]]/);
        if (!jsonMatch) return false;
        JSON.parse(jsonMatch[0]);
        return true;
      } catch {
        return false;
      }
    };

    return this.completeWithValidation(prompt, jsonValidator, maxTokens);
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    return this.baseDelay * Math.pow(2, attempt);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the current model being used
   */
  get currentModel(): string {
    return this.model;
  }

  /**
   * Get the maximum number of retries configured
   */
  get maxRetriesConfigured(): number {
    return this.maxRetries;
  }

  /**
   * Get available models from the current provider
   */
  async getAvailableModels(): Promise<LLMModel[]> {
    return await this.provider.getAvailableModels();
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return this.provider.getProviderName();
  }

  /**
   * Update the model being used
   */
  updateModel(model: string): void {
    this.model = model;
  }

  /**
   * Generate embeddings for given text (requires provider that supports embeddings)
   */
  async generateEmbeddings(text: string | string[], model?: string): Promise<number[][]> {
    if (!this.provider.generateEmbeddings) {
      throw new Error(`Provider ${this.provider.getProviderName()} does not support embeddings`);
    }

    const interactionId = `embedding-${++this.interactionCounter}-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // Log the request
    const textSample = Array.isArray(text) ? `[${text.length} texts]` : text.substring(0, 50) + '...';
    console.log(`[LLMClient ${this.clientId}] EMBEDDING REQUEST ${timestamp}: "${textSample}"`);

    try {
      const embeddings = await this.provider.generateEmbeddings(text, model);
      
      // Log successful response
      console.log(`[LLMClient ${this.clientId}] EMBEDDING RESPONSE ${new Date().toISOString()}: Generated ${embeddings.length} embeddings`);
      
      return embeddings;
      
    } catch (error: any) {
      console.error(`[LLMClient ${this.clientId}] EMBEDDING ERROR ${new Date().toISOString()}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if the current provider supports embeddings
   */
  supportsEmbeddings(): boolean {
    return !!this.provider.generateEmbeddings;
  }
}
