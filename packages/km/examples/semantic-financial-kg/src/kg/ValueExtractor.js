/**
 * ValueExtractor - Parse financial values from text and extract structured metadata
 *
 * Handles various formats:
 * - "$1M" or "$1 million" → {value: 1.0, currency: USD, scale: millions, actual: 1000000}
 * - "103,102 (thousands)" → {value: 103102, currency: USD, scale: thousands, actual: 103102000}
 * - "14.1%" → {value: 14.1, unit: percentage}
 * - "(123.45)" → {value: -123.45} (negative in parentheses)
 */
export class ValueExtractor {
  constructor() {
    // Scale multipliers
    this.scaleMultipliers = {
      'thousands': 1000,
      'thousand': 1000,
      'k': 1000,
      'millions': 1000000,
      'million': 1000000,
      'm': 1000000,
      'billions': 1000000000,
      'billion': 1000000000,
      'b': 1000000000,
      'trillions': 1000000000000,
      'trillion': 1000000000000,
      't': 1000000000000
    };

    // Currency symbols
    this.currencySymbols = {
      '$': 'USD',
      '€': 'EUR',
      '£': 'GBP',
      '¥': 'JPY',
      '₹': 'INR'
    };
  }

  /**
   * Extract structured value from text
   * @param {string} text - Text containing a value (e.g., "$1M", "14.1%")
   * @param {Object} context - Optional context (column headers, row labels)
   * @returns {Object} Structured value with metadata
   */
  extractValue(text, context = {}) {
    if (text === null || text === undefined || text === '') {
      return null;
    }

    const textStr = String(text).trim();

    // Check if percentage
    if (textStr.includes('%')) {
      return this.extractPercentage(textStr);
    }

    // Check if negative (in parentheses)
    const isNegative = textStr.startsWith('(') && textStr.endsWith(')');
    const cleanText = isNegative ? textStr.slice(1, -1) : textStr;

    // Extract currency
    const currency = this.extractCurrency(cleanText, context);

    // Extract scale
    const scale = this.extractScale(cleanText, context);

    // Extract numeric value
    const numericValue = this.extractNumericValue(cleanText);

    if (numericValue === null) {
      return null;
    }

    // Calculate actual amount
    const multiplier = scale ? this.scaleMultipliers[scale.toLowerCase()] : 1;
    const actualAmount = numericValue * multiplier * (isNegative ? -1 : 1);

    return {
      numericValue: isNegative ? -numericValue : numericValue,
      currency: currency,
      scale: scale,
      actualAmount: actualAmount,
      unit: currency ? 'currency' : 'count',
      originalText: textStr,
      dataType: 'xsd:decimal'
    };
  }

  /**
   * Extract percentage value
   */
  extractPercentage(text) {
    const numMatch = text.match(/(-?[\d,]+\.?\d*)/);
    if (!numMatch) return null;

    const numericValue = parseFloat(numMatch[1].replace(/,/g, ''));

    return {
      numericValue: numericValue,
      unit: 'percentage',
      actualAmount: numericValue / 100,  // Normalize to decimal
      originalText: text,
      dataType: 'xsd:decimal'
    };
  }

  /**
   * Extract currency from text
   */
  extractCurrency(text, context = {}) {
    // Check for currency symbols
    for (const [symbol, code] of Object.entries(this.currencySymbols)) {
      if (text.includes(symbol)) {
        return code;
      }
    }

    // Check for currency codes (USD, EUR, etc.)
    const currencyMatch = text.match(/\b(USD|EUR|GBP|JPY|INR|CNY)\b/i);
    if (currencyMatch) {
      return currencyMatch[1].toUpperCase();
    }

    // Check context (column headers might specify currency)
    if (context.currency) {
      return context.currency;
    }

    // Default to USD for financial data (ConvFinQA is US companies)
    if (this.looksLikeFinancialValue(text)) {
      return 'USD';
    }

    return null;
  }

  /**
   * Extract scale from text
   */
  extractScale(text, context = {}) {
    const lowerText = text.toLowerCase();

    // Check for explicit scale indicators
    for (const scale of Object.keys(this.scaleMultipliers)) {
      if (lowerText.includes(scale)) {
        return scale;
      }
    }

    // Check for scale in parentheses: "103,102 (thousands)"
    const parenMatch = text.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const parenText = parenMatch[1].toLowerCase();
      for (const scale of Object.keys(this.scaleMultipliers)) {
        if (parenText.includes(scale)) {
          return scale;
        }
      }
    }

    // Check context (table metadata might specify scale)
    if (context.scale) {
      return context.scale;
    }

    return null;
  }

  /**
   * Extract numeric value from text
   */
  extractNumericValue(text) {
    // Remove currency symbols and scale text
    let cleanText = text
      .replace(/[$€£¥₹]/g, '')
      .replace(/\(thousands?\)/gi, '')
      .replace(/\(millions?\)/gi, '')
      .replace(/\(billions?\)/gi, '')
      .replace(/[kmbt]\b/gi, '')
      .replace(/thousands?/gi, '')
      .replace(/millions?/gi, '')
      .replace(/billions?/gi, '')
      .replace(/trillions?/gi, '')
      .trim();

    // Extract number with commas and decimals
    const numMatch = cleanText.match(/(-?[\d,]+\.?\d*)/);
    if (!numMatch) return null;

    // Remove commas and parse
    const numericValue = parseFloat(numMatch[1].replace(/,/g, ''));

    return isNaN(numericValue) ? null : numericValue;
  }

  /**
   * Check if text looks like a financial value
   */
  looksLikeFinancialValue(text) {
    // Has currency symbol or large number with commas
    return text.match(/[$€£¥₹]/) || text.match(/\d{1,3}(,\d{3})+/);
  }

  /**
   * Create URI for a financial value
   */
  createValueUri(extractedValue) {
    if (!extractedValue) return null;

    const parts = ['data:FinVal'];

    parts.push(Math.abs(extractedValue.numericValue).toString().replace(/\./g, '_'));

    if (extractedValue.currency) {
      parts.push(extractedValue.currency);
    }

    if (extractedValue.scale) {
      parts.push(extractedValue.scale);
    }

    if (extractedValue.unit === 'percentage') {
      parts.push('pct');
    }

    return parts.join('_');
  }

  /**
   * Create FinancialValue entity
   */
  createFinancialValueEntity(extractedValue) {
    if (!extractedValue) return null;

    const uri = this.createValueUri(extractedValue);

    return {
      uri: uri,
      type: 'kg:FinancialValue',
      label: extractedValue.originalText,
      properties: {
        'kg:numericValue': extractedValue.numericValue.toString(),
        'kg:actualAmount': extractedValue.actualAmount.toString(),
        'kg:originalText': extractedValue.originalText,
        'kg:dataType': extractedValue.dataType,
        'kg:unit': extractedValue.unit,
        ...(extractedValue.currency && { 'kg:currency': extractedValue.currency }),
        ...(extractedValue.scale && { 'kg:scale': extractedValue.scale })
      }
    };
  }

  /**
   * Normalize two values to same scale for comparison
   */
  normalizeValues(value1, value2) {
    return {
      value1: value1.actualAmount,
      value2: value2.actualAmount,
      unit: value1.currency || value1.unit,
      comparable: this.areComparable(value1, value2)
    };
  }

  /**
   * Check if two values are comparable (same unit type)
   */
  areComparable(value1, value2) {
    // Same currency or both percentages or both counts
    return (
      (value1.currency && value2.currency && value1.currency === value2.currency) ||
      (value1.unit === 'percentage' && value2.unit === 'percentage') ||
      (value1.unit === 'count' && value2.unit === 'count')
    );
  }
}
