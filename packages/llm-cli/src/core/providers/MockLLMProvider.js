export class MockLLMProvider {
  constructor() {
    this.responses = new Map();
    this.structuredResponse = null;
    this.defaultResponse = JSON.stringify({
      command: 'unknown',
      parameters: {},
      confidence: 0.5
    });
  }

  addResponse(pattern, response) {
    this.responses.set(pattern, response);
  }

  clearResponses() {
    this.responses.clear();
    this.structuredResponse = null;
  }

  setDefaultResponse(response) {
    this.defaultResponse = response;
  }

  setStructuredResponse(response) {
    this.structuredResponse = response;
  }

  async complete(prompt, options) {
    // Find matching pattern
    for (const [pattern, response] of this.responses) {
      if (prompt.includes(pattern)) {
        return response;
      }
    }
    
    // Return default response
    return this.defaultResponse;
  }

  async completeStructured(prompt, schema, options) {
    if (this.structuredResponse !== null) {
      return this.structuredResponse;
    }
    
    const response = await this.complete(prompt, options);
    try {
      return JSON.parse(response);
    } catch (error) {
      throw new Error('Failed to parse structured response');
    }
  }

  getProviderName() {
    return 'mock';
  }

  getModelName() {
    return 'mock-model';
  }

  supportsStructuredOutput() {
    return true;
  }

  getMaxTokens() {
    return 4096;
  }
}