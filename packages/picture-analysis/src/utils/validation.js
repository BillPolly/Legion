
import { createValidator } from '@legion/schema';

/**
 * JSON Schema for input validation as specified in DESIGN.md
 */
const inputSchema = {
  type: 'object',
  properties: {
    file_path: {
      type: 'string',
      minLength: 1,
      description: 'File path is required'
    },
    prompt: {
      type: 'string',
      minLength: 10,
      maxLength: 2000,
      description: 'Prompt must be between 10 and 2000 characters'
    }
  },
  required: ['file_path', 'prompt']
};

export const InputSchema = createValidator(inputSchema);

/**
 * Validate input parameters using schema package
 * @param {Object} input - Input parameters to validate
 * @returns {Object} Parsed and validated input
 */
export function validateInputParameters(input) {
  return InputSchema.validate(input);
}

/**
 * Validate file path parameter
 * @param {string} filePath - File path to validate
 */
export function validateFilePath(filePath) {
  if (typeof filePath !== 'string') {
    throw new Error('File path must be a string');
  }
  
  if (!filePath || filePath.trim().length === 0) {
    throw new Error('File path is required');
  }
}

/**
 * Validate prompt parameter
 * @param {string} prompt - Prompt to validate
 */
export function validatePrompt(prompt) {
  if (typeof prompt !== 'string') {
    throw new Error('Prompt must be a string');
  }
  
  if (prompt.length < 10) {
    throw new Error('Prompt must be at least 10 characters');
  }
  
  if (prompt.length > 2000) {
    throw new Error('Prompt must not exceed 2000 characters');
  }
}