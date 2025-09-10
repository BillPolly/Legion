/**
 * Validation schemas for different request types
 */

export const requestSchemas = {
  chatRequest: {
    message: { type: 'string', required: true },
    userId: { type: 'string', required: true },
    context: { type: 'object', required: false }
  },
  toolRequest: {
    toolName: { type: 'string', required: true },
    parameters: { type: 'object', required: true }
  }
};
