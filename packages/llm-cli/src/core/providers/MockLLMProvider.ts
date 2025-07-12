import { LLMProvider, LLMOptions } from './types';

export class MockLLMProvider implements LLMProvider {
  private responses: Map<string, string> = new Map();
  private structuredResponse: any = null;
  private defaultResponse: string = JSON.stringify({
    command: 'unknown',
    parameters: {},
    confidence: 0.5
  });

  addResponse(pattern: string, response: string): void {
    this.responses.set(pattern, response);
  }

  clearResponses(): void {
    this.responses.clear();
    this.structuredResponse = null;
  }

  setDefaultResponse(response: string): void {
    this.defaultResponse = response;
  }

  setStructuredResponse(response: any): void {
    this.structuredResponse = response;
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    // Find matching pattern
    for (const [pattern, response] of this.responses) {
      if (prompt.includes(pattern)) {
        return response;
      }
    }
    
    // Return default response
    return this.defaultResponse;
  }

  async completeStructured<T>(
    prompt: string, 
    schema: object,
    options?: LLMOptions
  ): Promise<T> {
    if (this.structuredResponse !== null) {
      return this.structuredResponse as T;
    }
    
    const response = await this.complete(prompt, options);
    try {
      return JSON.parse(response) as T;
    } catch (error) {
      throw new Error('Failed to parse structured response');
    }
  }

  getProviderName(): string {
    return 'mock';
  }

  getModelName(): string {
    return 'mock-model';
  }

  supportsStructuredOutput(): boolean {
    return true;
  }

  getMaxTokens(): number {
    return 4096;
  }
}