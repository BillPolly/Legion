/**
 * StringUtils - String manipulation utilities
 */

export class StringUtils {
  /**
   * Calculate similarity between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Find best match for a string from candidates
   * @param {string} input - Input string
   * @param {string[]} candidates - Candidate strings
   * @returns {string|null} Best match or null
   */
  findBestMatch(input, candidates) {
    if (!input || !candidates || candidates.length === 0) return null;
    
    const lowerInput = input.toLowerCase();
    let bestMatch = null;
    let bestDistance = Infinity;
    
    for (const candidate of candidates) {
      const distance = this.levenshteinDistance(lowerInput, candidate.toLowerCase());
      
      // Accept matches with distance <= 3
      if (distance <= 3 && distance < bestDistance) {
        bestDistance = distance;
        bestMatch = candidate;
      }
    }
    
    return bestMatch;
  }

  /**
   * Find close matches for a string
   * @param {string} input - Input string
   * @param {string[]} candidates - Candidate strings
   * @returns {string[]} Close matches
   */
  findCloseMatches(input, candidates) {
    if (!input || !candidates || candidates.length === 0) return [];
    
    const lowerInput = input.toLowerCase();
    const matches = [];
    
    for (const candidate of candidates) {
      const distance = this.levenshteinDistance(lowerInput, candidate.toLowerCase());
      
      // Include if starts with input or has small edit distance
      if (candidate.toLowerCase().startsWith(lowerInput) || distance <= 2) {
        matches.push(candidate);
      }
    }
    
    return matches;
  }

  /**
   * Split command line respecting quotes
   * @param {string} command - Command line to split
   * @returns {string[]} Split command parts
   */
  splitCommandLine(command) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;
    
    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      
      if ((char === '"' || char === "'") && (i === 0 || command[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        } else {
          current += char;
        }
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      parts.push(current);
    }
    
    return parts;
  }

  /**
   * Truncate string to specified length
   * @param {string} str - String to truncate
   * @param {number} maxLength - Maximum length
   * @param {string} suffix - Suffix to add when truncated
   * @returns {string} Truncated string
   */
  truncate(str, maxLength, suffix = '...') {
    if (!str || str.length <= maxLength) {
      return str;
    }
    
    return str.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Pad string to specified length
   * @param {string} str - String to pad
   * @param {number} length - Target length
   * @param {string} padChar - Character to pad with
   * @param {string} direction - 'left' or 'right'
   * @returns {string} Padded string
   */
  pad(str, length, padChar = ' ', direction = 'right') {
    if (!str) str = '';
    
    const padLength = length - str.length;
    if (padLength <= 0) {
      return str;
    }
    
    const padding = padChar.repeat(Math.ceil(padLength / padChar.length)).substring(0, padLength);
    
    return direction === 'left' ? padding + str : str + padding;
  }

  /**
   * Convert string to camel case
   * @param {string} str - String to convert
   * @returns {string} Camel case string
   */
  toCamelCase(str) {
    return str.replace(/[_-](\w)/g, (_, char) => char.toUpperCase());
  }

  /**
   * Convert string to kebab case
   * @param {string} str - String to convert
   * @returns {string} Kebab case string
   */
  toKebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }
}

export default StringUtils;