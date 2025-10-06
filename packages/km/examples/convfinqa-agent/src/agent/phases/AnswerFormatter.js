/**
 * AnswerFormatter - Deterministic answer formatting based on output requirements
 *
 * Takes a raw numerical value and formats it according to:
 * - Unit (percentage, dollars, millions, billions, number)
 * - Precision (decimal places)
 * - Symbol inclusion (%, $, etc.)
 *
 * NO LLM NEEDED - Pure deterministic rules
 */

export class AnswerFormatter {
  constructor(logger = console) {
    this.logger = logger;
  }

  /**
   * Format a raw numerical answer according to output format requirements
   *
   * @param {number} rawValue - The raw numerical value to format
   * @param {Object} outputFormat - Format specification from understanding phase
   * @param {string} outputFormat.unit - Unit type (percentage, dollars, millions, billions, number)
   * @param {number} outputFormat.precision - Number of decimal places
   * @param {boolean} outputFormat.includeSymbol - Whether to include unit symbol
   * @param {string} outputFormat.symbol - The symbol to include
   * @returns {string} Formatted answer string
   */
  format(rawValue, outputFormat) {
    if (typeof rawValue !== 'number' || isNaN(rawValue)) {
      this.logger.error('format_invalid_value', { rawValue });
      throw new Error(`Invalid raw value: ${rawValue}`);
    }

    const {
      unit = 'number',
      precision = 2,
      includeSymbol = false,
      symbol = ''
    } = outputFormat;

    this.logger.debug('format_answer', { rawValue, unit, precision, includeSymbol, symbol });

    let formattedValue;

    // Apply unit-specific formatting
    switch (unit.toLowerCase()) {
      case 'percentage':
      case '%':
        // Convert decimal (0.0-1.0) to percentage (0-100) if needed
        let percentageValue = rawValue;
        if (rawValue >= 0 && rawValue <= 1) {
          percentageValue = rawValue * 100;
        }
        formattedValue = percentageValue.toFixed(precision);
        if (includeSymbol || symbol === '%') {
          formattedValue += '%';
        }
        break;

      case 'dollars':
      case '$':
        formattedValue = rawValue.toFixed(precision);
        if (includeSymbol || symbol === '$') {
          formattedValue = '$' + formattedValue;
        }
        break;

      case 'millions':
        // Convert to millions if not already
        formattedValue = rawValue.toFixed(precision);
        break;

      case 'billions':
        // Convert to billions if not already
        formattedValue = rawValue.toFixed(precision);
        break;

      case 'number':
      case 'raw':
      default:
        formattedValue = rawValue.toFixed(precision);
        if (symbol && includeSymbol) {
          formattedValue += symbol;
        }
        break;
    }

    this.logger.info('format_answer_success', {
      rawValue,
      formatted: formattedValue,
      unit,
      precision
    });

    return formattedValue;
  }

  /**
   * Parse output format from understanding phase
   * Provides defaults if certain fields are missing
   *
   * @param {Object} understanding - Understanding from semantic phase
   * @returns {Object} Normalized output format
   */
  normalizeOutputFormat(understanding) {
    const outputFormat = understanding.outputFormat || {};

    // Determine default precision based on unit
    let defaultPrecision = 2;
    if (outputFormat.unit === 'percentage' || outputFormat.unit === '%') {
      defaultPrecision = 1; // Default 1 decimal for percentages
    }

    // Determine if symbol should be included
    let includeSymbol = outputFormat.includeSymbol || false;
    let symbol = outputFormat.symbol || '';

    if (outputFormat.unit === 'percentage' || outputFormat.unit === '%') {
      includeSymbol = true;
      symbol = '%';
    } else if (outputFormat.unit === 'dollars' || outputFormat.unit === '$') {
      includeSymbol = true;
      symbol = '$';
    }

    return {
      unit: outputFormat.unit || 'number',
      precision: outputFormat.precision !== undefined ? outputFormat.precision : defaultPrecision,
      includeSymbol,
      symbol
    };
  }

  /**
   * Extract numerical value from a string answer
   * Useful for parsing LLM-generated answers that may include units
   *
   * @param {string} answer - String answer potentially containing units
   * @returns {number|null} Extracted numerical value or null
   */
  extractNumericalValue(answer) {
    if (typeof answer === 'number') {
      return answer;
    }

    if (typeof answer !== 'string') {
      return null;
    }

    // Remove common symbols and extract number
    const cleaned = answer.replace(/[$,%]/g, '').trim();

    // Match number (including negative, decimals)
    const match = cleaned.match(/[-+]?[0-9]*\.?[0-9]+/);

    if (match) {
      const value = parseFloat(match[0]);
      return isNaN(value) ? null : value;
    }

    return null;
  }
}
