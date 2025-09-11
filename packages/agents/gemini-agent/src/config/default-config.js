export const defaultConfig = {
  agent: {
    name: 'Gemini Compatible Agent',
    version: '1.0.0',
    maxTokens: 2048,
    temperature: 0.7,
    contextWindow: 4096
  },
  services: {
    logging: {
      level: 'info',
      format: 'json'
    },
    metrics: {
      enabled: true,
      interval: 60000
    }
  },
  tools: {
    timeout: 30000,
    maxConcurrent: 5
  }
};
