export const agentConfig = {
  name: 'GeminiCompatibleAgent',
  version: '1.0.0',
  capabilities: {
    toolCalling: true,
    contextManagement: true,
    multimodal: true
  },
  defaults: {
    maxTokens: 2048,
    temperature: 0.7,
    responseFormat: 'json'
  }
};
