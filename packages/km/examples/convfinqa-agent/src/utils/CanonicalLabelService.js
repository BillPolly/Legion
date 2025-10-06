/**
 * CanonicalLabelService - Deterministic label canonicalization
 *
 * Provides pure functions for converting raw labels into canonical forms.
 * CRITICAL: Same input must always produce same output (no LLM, no randomness)
 *
 * This ensures ontology and instance KG use identical labels, enabling exact matching.
 */

export class CanonicalLabelService {
  /**
   * Canonicalize a label deterministically
   *
   * Rules:
   * - Lowercase
   * - Normalize whitespace
   * - Preserve alphanumeric, spaces, and ampersands (&)
   * - Remove other punctuation
   *
   * @param {string} rawLabel - Raw label from table or text
   * @returns {string} Canonical label (always the same for same input)
   *
   * @example
   * canonicalize("Non-Cash Expenses") → "non cash expenses"
   * canonicalize("S&P 500 Index")     → "s&p 500 index"
   * canonicalize("basic earnings per share") → "basic earnings per share"
   */
  static canonicalize(rawLabel) {
    if (!rawLabel) return '';

    return String(rawLabel)
      .trim()
      .toLowerCase()
      // Normalize whitespace first
      .replace(/\s+/g, ' ')
      // Keep only: letters, numbers, spaces, ampersands
      // Remove: hyphens, periods, commas, parentheses, etc.
      .replace(/[^a-z0-9\s&]/g, ' ')
      // Normalize whitespace again after char removal
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Convert canonical label to property name (snake_case URI)
   *
   * @param {string} canonicalLabel - Canonical label
   * @returns {string} Property name in snake_case
   *
   * @example
   * toPropertyName("non cash expenses") → "non_cash_expenses"
   * toPropertyName("s&p 500 index")     → "s_and_p_500_index"
   */
  static toPropertyName(canonicalLabel) {
    return canonicalLabel
      .replace(/&/g, 'and')    // & → "and" for URIs
      .replace(/\s+/g, '_');   // spaces → underscores
  }

  /**
   * Extract year from header label
   *
   * @param {string} headerLabel - Header cell text
   * @returns {number|null} Year if found, null otherwise
   *
   * @example
   * extractYear("2009") → 2009
   * extractYear("year ended june 30 2009") → 2009
   * extractYear("12/31/09") → 2009
   */
  static extractYear(headerLabel) {
    if (!headerLabel) return null;

    const str = String(headerLabel);

    // Try 4-digit year (2009, 2008, etc.)
    const fourDigit = str.match(/\b(19|20)\d{2}\b/);
    if (fourDigit) {
      return parseInt(fourDigit[0]);
    }

    // Try 2-digit year in date format (12/31/09 → 2009)
    const twoDigit = str.match(/\/(\d{2})$/);
    if (twoDigit) {
      const year = parseInt(twoDigit[1]);
      // Assume 00-30 → 2000s, 31-99 → 1900s
      return year <= 30 ? 2000 + year : 1900 + year;
    }

    return null;
  }

  /**
   * Extract ALL years from column header (for compound headers)
   *
   * @param {string} headerLabel - Column header text
   * @returns {Array<number>} Array of years (4-digit)
   *
   * @example
   * extractAllYears("2009") → [2009]
   * extractAllYears("year ended june 30 2009 2008") → [2009, 2008]
   * extractAllYears("12/31/09") → [2009]
   */
  static extractAllYears(headerLabel) {
    if (!headerLabel) return [];

    const str = String(headerLabel);
    const years = [];

    // Extract all 4-digit years
    const fourDigitMatches = str.matchAll(/\b(19|20)\d{2}\b/g);
    for (const match of fourDigitMatches) {
      years.push(parseInt(match[0]));
    }

    // If no 4-digit years, try 2-digit year in date format
    if (years.length === 0) {
      const twoDigit = str.match(/\/(\d{2})$/);
      if (twoDigit) {
        const year = parseInt(twoDigit[1]);
        years.push(year <= 30 ? 2000 + year : 1900 + year);
      }
    }

    return years;
  }

  /**
   * Infer value type from cell values
   *
   * @param {Array<string>} values - Cell values from row
   * @returns {string} Value type: currency, percentage, number, text
   */
  static inferValueType(values) {
    if (!values || values.length === 0) return 'text';

    // Check first non-empty value
    const sample = values.find(v => v && String(v).trim());
    if (!sample) return 'text';

    const str = String(sample).trim();

    // Currency: starts with $
    if (str.startsWith('$')) return 'currency';

    // Percentage: contains %
    if (str.includes('%')) return 'percentage';

    // Number: can be parsed as number (after removing formatting)
    const cleaned = str.replace(/[,$()]/g, '').replace(/\s+/g, '');
    if (!isNaN(parseFloat(cleaned))) return 'number';

    return 'text';
  }

  /**
   * Infer precision from cell values (number of decimal places)
   *
   * @param {Array<string>} values - Cell values from row
   * @returns {number} Maximum decimal places found (0 for integers)
   *
   * @example
   * inferPrecision(["100", "200"]) → 0
   * inferPrecision(["9362.2", "9244.9"]) → 1
   * inferPrecision(["$100.00", "$89.49"]) → 2
   */
  static inferPrecision(values) {
    if (!values || values.length === 0) return 0;

    let maxPrecision = 0;

    for (const value of values) {
      if (!value) continue;

      const str = String(value).trim();
      // Remove currency symbols, commas, parentheses
      const cleaned = str.replace(/[$,()]/g, '').trim();

      // Check for decimal point
      const decimalMatch = cleaned.match(/\.(\d+)/);
      if (decimalMatch) {
        const decimals = decimalMatch[1].length;
        maxPrecision = Math.max(maxPrecision, decimals);
      }
    }

    return maxPrecision;
  }

  /**
   * Infer unit from label and values
   *
   * @param {string} label - Row label
   * @param {Array<string>} values - Cell values
   * @returns {string|null} Unit (e.g., "thousands", "millions", "percent")
   */
  static inferUnit(label, values) {
    const labelLower = String(label).toLowerCase();

    // Check label for unit indicators
    if (labelLower.includes('thousand')) return 'thousands';
    if (labelLower.includes('million')) return 'millions';
    if (labelLower.includes('billion')) return 'billions';
    if (labelLower.includes('percent') || labelLower.includes('%')) return 'percent';

    // Check values
    const valueType = this.inferValueType(values);
    if (valueType === 'percentage') return 'percent';

    return null;
  }
}
