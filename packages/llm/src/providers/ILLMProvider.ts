/**
 * Interface for LLM providers
 */
export interface LLMModel {
  id: string;
  name: string;
  description: string;
  contextWindow?: number;
  maxTokens?: number;
}

export interface ILLMProvider {
  /**
   * Get available models from this provider
   */
  getAvailableModels(): Promise<LLMModel[]>;

  /**
   * Complete a prompt using the specified model
   */
  complete(prompt: string, model: string, maxTokens?: number): Promise<string>;

  /**
   * Generate embeddings for given text (optional - not all providers support this)
   */
  generateEmbeddings?(text: string | string[], model?: string): Promise<number[][]>;

  /**
   * Get the provider name
   */
  getProviderName(): string;

  /**
   * Check if the provider is configured and ready
   */
  isReady(): boolean;
}
