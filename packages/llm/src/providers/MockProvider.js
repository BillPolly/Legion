/**
 * Mock provider for testing purposes
 */
export class MockProvider {
  constructor() {
    this.responses = [
      "This is a mock response from the LLM provider.",
      "Here is another sample response for testing.",
      "Mock provider returning predictable output."
    ];
    this.responseIndex = 0;
  }

  async getAvailableModels() {
    return [
      {
        id: 'mock-model-1',
        name: 'Mock Model 1',
        description: 'First mock model for testing',
        contextWindow: 4096,
        maxTokens: 1024
      },
      {
        id: 'mock-model-2', 
        name: 'Mock Model 2',
        description: 'Second mock model for testing',
        contextWindow: 8192,
        maxTokens: 2048
      }
    ];
  }

  async complete(prompt, model, maxTokens = 1000) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return cyclical responses for predictable testing
    const response = this.responses[this.responseIndex % this.responses.length];
    this.responseIndex++;
    
    return `Mock response for "${prompt.substring(0, 50)}...": ${response}`;
  }

  async generateEmbeddings(text, model) {
    // Return mock embeddings - simple hash-based approach for consistency
    const input = Array.isArray(text) ? text : [text];
    const embeddings = [];
    
    for (const t of input) {
      // Generate consistent fake embedding based on text hash
      const embedding = [];
      let hash = 0;
      for (let i = 0; i < t.length; i++) {
        const char = t.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      
      // Generate 1536 dimensions (like OpenAI embeddings)
      for (let i = 0; i < 1536; i++) {
        embedding.push((Math.sin(hash + i) + 1) / 2); // Normalize to [0, 1]
      }
      
      embeddings.push(embedding);
    }
    
    return embeddings;
  }

  getProviderName() {
    return 'mock';
  }

  isReady() {
    return true;
  }

  /**
   * Set custom responses for testing
   */
  setMockResponses(responses) {
    this.responses = responses;
    this.responseIndex = 0;
  }

  /**
   * Reset response index
   */
  resetResponseIndex() {
    this.responseIndex = 0;
  }
}