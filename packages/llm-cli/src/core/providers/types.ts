export interface LLMProvider {
  // Basic completion
  complete(prompt: string, options?: LLMOptions): Promise<string>;
  
  // Structured output (if supported)
  completeStructured?<T>(
    prompt: string, 
    schema: object,
    options?: LLMOptions
  ): Promise<T>;
  
  // Provider information
  getProviderName(): string;
  getModelName(): string;
  
  // Capabilities
  supportsStructuredOutput?(): boolean;
  getMaxTokens?(): number;
}

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  responseFormat?: 'text' | 'json';
}