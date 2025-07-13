import { jest } from '@jest/globals';

export const RetryManager = jest.fn().mockImplementation(() => ({
  processResponse: jest.fn().mockResolvedValue({
    success: true,
    data: { task_completed: true, response: { type: 'string', message: 'Mock response' } },
    retries: 0
  }),
  maxRetries: 3,
  tools: []
}));