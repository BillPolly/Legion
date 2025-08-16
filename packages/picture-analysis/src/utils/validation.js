import { z } from 'zod';

/**
 * Zod schema for input validation as specified in DESIGN.md
 */
export const InputSchema = z.object({
  file_path: z.string()
    .min(1, "File path is required"),
  
  prompt: z.string()
    .min(10, "Prompt must be at least 10 characters")
    .max(2000, "Prompt must not exceed 2000 characters")
});

/**
 * Validate input parameters using Zod schema
 * @param {Object} input - Input parameters to validate
 * @returns {Object} Parsed and validated input
 */
export function validateInputParameters(input) {
  return InputSchema.parse(input);
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