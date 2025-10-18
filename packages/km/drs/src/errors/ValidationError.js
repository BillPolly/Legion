/**
 * ValidationError - Custom error class for validation failures
 */
export class ValidationError extends Error {
  /**
   * @param {string} stage - Stage name (e.g., "Stage1_MentionExtraction")
   * @param {object[]} errors - Detailed error list with paths and messages
   * @param {any} originalOutput - The invalid output for debugging
   */
  constructor(stage, errors, originalOutput = null) {
    super(`Validation failed in ${stage}`);
    this.name = 'ValidationError';
    this.stage = stage;
    this.errors = errors;
    this.originalOutput = originalOutput;
  }
}
