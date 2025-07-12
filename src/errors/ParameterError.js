/**
 * ParameterError - Error thrown for parameter validation failures
 */

export class ParameterError extends Error {
  constructor(message, toolName = null, parameterName = null) {
    super(message);
    this.name = 'ParameterError';
    this.toolName = toolName;
    this.parameterName = parameterName;
  }
}

export default ParameterError;