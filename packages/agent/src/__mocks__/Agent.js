import { jest } from '@jest/globals';

export const Agent = jest.fn().mockImplementation((config) => ({
  name: config.name || 'MockAgent',
  bio: config.bio || 'Mock agent bio',
  model: config.model || {},
  tools: config.tools || [],
  run: jest.fn().mockResolvedValue({
    type: 'string',
    message: 'Mock response from agent'
  }),
  setShowToolUsage: jest.fn(),
  executeTool: jest.fn().mockResolvedValue({
    isSuccess: () => true,
    getData: () => ({ result: 'mock result' })
  })
}));