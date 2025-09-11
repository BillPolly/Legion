/**
 * Helper utilities for analytics operations
 */
export class AnalyticsHelper {
  /**
   * Calculate average of values
   * @param {number[]} values - Array of numbers
   * @returns {number} The calculated average
   */
  static calculateAverage(values) {
    if (!Array.isArray(values) || !values.length) return 0;
    const validNumbers = values.filter(val => typeof val === 'number' && !isNaN(val));
    if (!validNumbers.length) return 0;
    return validNumbers.reduce((sum, val) => sum + val, 0) / validNumbers.length;
  }

  /**
   * Format metric value for display
   * @param {number} value - The metric value
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted value
   */
  static formatMetricValue(value, decimals = 2) {
    return value.toFixed(decimals);
  }
}
