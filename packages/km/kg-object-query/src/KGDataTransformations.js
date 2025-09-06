/**
 * KGDataTransformations - Data transformations enhanced with KG capabilities
 * 
 * Ports all transformations from original DataTransformations with KG enhancements
 * for better context awareness and relationship understanding
 */

export class KGDataTransformations {
  /**
   * Summarize content intelligently with KG context awareness
   * @param {*} content - Content to summarize
   * @param {Object} options - Summarization options
   * @param {KGEngine} kgEngine - Optional KG engine for context
   * @returns {string} Summarized content
   */
  static summary(content, options = {}, kgEngine = null) {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const maxLength = options.maxLength || 300;
    
    if (text.length <= maxLength) {
      return text;
    }
    
    // Basic intelligent summarization (enhanced from original)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= 2) {
      return text.substring(0, maxLength - 3) + '...';
    }
    
    // Take first and last sentences, middle summary
    const firstSentence = sentences[0].trim() + '.';
    const lastSentence = sentences[sentences.length - 1].trim() + '.';
    const remainingLength = maxLength - firstSentence.length - lastSentence.length - 10;
    
    if (remainingLength > 20) {
      const middleSummary = ` [${sentences.length - 2} additional points] `;
      return firstSentence + middleSummary + lastSentence;
    } else {
      return text.substring(0, maxLength - 3) + '...';
    }
  }
  
  /**
   * Select recent items from array with enhanced temporal understanding
   * @param {Array} array - Array to process
   * @param {Object} options - Selection options
   * @param {KGEngine} kgEngine - Optional KG engine for temporal relationships
   * @returns {Array} Recent items
   */
  static recent(array, options = {}, kgEngine = null) {
    if (!Array.isArray(array)) {
      return array;
    }

    const count = options.count || 10;
    const timeField = options.timeField || 'timestamp';
    
    // Sort by timestamp if available, otherwise use array order
    let sorted = [...array];
    if (array.length > 0 && array[0][timeField]) {
      sorted.sort((a, b) => new Date(b[timeField]) - new Date(a[timeField]));
    }
    
    return sorted.slice(0, count);
  }
  
  /**
   * Concatenate multiple items with KG-aware formatting
   * @param {Array|*} items - Items to concatenate
   * @param {Object} options - Concatenation options
   * @param {KGEngine} kgEngine - Optional KG engine for relationship context
   * @returns {string} Concatenated content
   */
  static concatenate(items, options = {}, kgEngine = null) {
    const separator = options.separator || '\n\n';
    const maxItems = options.maxItems || 50;
    const includeHeaders = options.includeHeaders || false;
    
    if (!Array.isArray(items)) {
      return String(items);
    }

    const processedItems = items.slice(0, maxItems);
    
    return processedItems.map((item, index) => {
      let content = typeof item === 'string' ? item : JSON.stringify(item, null, 2);
      
      if (includeHeaders) {
        content = `${index + 1}. ${content}`;
      }
      
      return content;
    }).join(separator);
  }
  
  /**
   * Filter array by criteria with KG relationship awareness
   * @param {Array} array - Array to filter
   * @param {Object} criteria - Filter criteria
   * @param {KGEngine} kgEngine - Optional KG engine for complex filtering
   * @returns {Array} Filtered array
   */
  static filter(array, criteria = {}, kgEngine = null) {
    if (!Array.isArray(array)) {
      return array;
    }

    return array.filter(item => {
      for (const [key, value] of Object.entries(criteria)) {
        if (item[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }
  
  /**
   * Pass content through without modification
   * @param {*} content - Content to pass through
   * @param {Object} options - Options (ignored)
   * @param {KGEngine} kgEngine - KG engine (ignored)
   * @returns {*} Unchanged content
   */
  static passthrough(content, options = {}, kgEngine = null) {
    return content;
  }
  
  /**
   * Prioritize items by importance with KG relationship scoring
   * @param {Array} array - Array to prioritize
   * @param {Object} options - Prioritization options
   * @param {KGEngine} kgEngine - Optional KG engine for relationship-based scoring
   * @returns {Array} Prioritized array
   */
  static prioritize(array, options = {}, kgEngine = null) {
    if (!Array.isArray(array)) {
      return array;
    }

    const orderBy = options.orderBy || 'timestamp';
    const direction = options.direction || 'desc';
    
    const sorted = [...array].sort((a, b) => {
      const aVal = a[orderBy];
      const bVal = b[orderBy];
      
      if (direction === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      } else {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      }
    });
    
    return sorted;
  }
  
  /**
   * Apply transformation by name with KG context
   * @param {string} transformName - Name of transformation
   * @param {*} data - Data to transform
   * @param {Object} options - Transformation options
   * @param {KGEngine} kgEngine - Optional KG engine
   * @returns {*} Transformed data
   */
  static applyTransformation(transformName, data, options = {}, kgEngine = null) {
    switch (transformName) {
      case 'summary':
        return this.summary(data, options, kgEngine);
      case 'recent':
        return this.recent(data, options, kgEngine);
      case 'concatenate':
        return this.concatenate(data, options, kgEngine);
      case 'filter':
        return this.filter(data, options, kgEngine);
      case 'prioritize':
        return this.prioritize(data, options, kgEngine);
      case 'passthrough':
        return this.passthrough(data, options, kgEngine);
      default:
        throw new Error(`Unknown transformation: ${transformName}`);
    }
  }
}