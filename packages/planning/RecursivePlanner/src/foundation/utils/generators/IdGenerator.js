/**
 * Utility for generating unique identifiers
 */

/**
 * Generate a random string of specified length
 * @param {number} length - Length of the string to generate
 * @returns {string} Random string
 */
function generateRandomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * ID Generator utility class
 */
export class IdGenerator {
  static counter = 0;

  /**
   * Generate a unique step ID
   * @param {string} prefix - Optional prefix for the ID
   * @returns {string} Unique step ID
   */
  static generateStepId(prefix = 'step') {
    return `${prefix}_${++this.counter}_${Date.now()}`;
  }

  /**
   * Generate a unique span ID for tracing
   * @returns {string} Unique span ID
   */
  static generateSpanId() {
    return `span_${generateRandomString(16)}`;
  }

  /**
   * Generate a unique trace ID for tracing
   * @returns {string} Unique trace ID
   */
  static generateTraceId() {
    return `trace_${generateRandomString(32)}`;
  }

  /**
   * Generate a unique agent ID
   * @param {string} agentType - Type of agent
   * @returns {string} Unique agent ID
   */
  static generateAgentId(agentType = 'agent') {
    return `${agentType}_${generateRandomString(12)}_${Date.now()}`;
  }

  /**
   * Generate a unique message ID
   * @returns {string} Unique message ID
   */
  static generateMessageId() {
    return `msg_${generateRandomString(16)}_${Date.now()}`;
  }

  /**
   * Generate a unique artifact ID
   * @param {string} type - Artifact type
   * @returns {string} Unique artifact ID
   */
  static generateArtifactId(type = 'artifact') {
    return `${type}_${generateRandomString(12)}_${Date.now()}`;
  }

  /**
   * Generate a correlation ID for tracking related operations
   * @returns {string} Unique correlation ID
   */
  static generateCorrelationId() {
    return `corr_${generateRandomString(24)}`;
  }

  /**
   * Reset the counter (mainly for testing)
   */
  static resetCounter() {
    this.counter = 0;
  }
}