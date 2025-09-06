/**
 * MarkdownParser - Parse markdown structured responses from LLM output
 * 
 * Handles markdown with headers and lists
 */

import { SchemaExtensions } from '../SchemaExtensions.js';

export class MarkdownParser {
  constructor(schema, options = {}) {
    this.schema = schema;
    this.options = options;
    this.formatSpecs = SchemaExtensions.getFormatSpecs(schema, 'markdown');
  }

  parse(responseText) {
    if (!responseText || typeof responseText !== 'string') {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: 'Input is empty or invalid',
          field: null,
          suggestion: 'Ensure the response contains markdown structure'
        }]
      };
    }

    try {
      const sections = this._extractSections(responseText);
      return {
        success: true,
        data: sections
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: error.message,
          field: null,
          suggestion: 'Check markdown header format: ## Header'
        }]
      };
    }
  }

  _extractSections(text) {
    const result = {};
    const lines = text.split('\n');
    let currentSection = null;
    let currentContent = [];

    for (const line of lines) {
      const headerMatch = line.match(/^#{1,6}\s+(.+)$/);
      
      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          const content = currentContent.join('\n').trim();
          result[currentSection] = this._parseMarkdownContent(content);
        }
        
        // Start new section
        currentSection = headerMatch[1].toLowerCase().replace(/\s+/g, '_');
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    // Save final section
    if (currentSection) {
      const content = currentContent.join('\n').trim();
      result[currentSection] = this._parseMarkdownContent(content);
    }

    return result;
  }

  /**
   * Parse markdown content to handle lists and special structures
   * @private
   */
  _parseMarkdownContent(content) {
    if (!content) return content;
    
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Check if it's a list
    const listItems = [];
    let isList = true;
    
    for (const line of lines) {
      if (line.startsWith('- ') || line.startsWith('* ')) {
        listItems.push(line.substring(2).trim());
      } else if (/^\d+\.\s/.test(line)) {
        listItems.push(line.replace(/^\d+\.\s+/, '').trim());
      } else if (line.startsWith('  - ') || line.startsWith('  * ')) {
        // Nested list item
        listItems.push(line.substring(4).trim());
      } else {
        isList = false;
        break;
      }
    }
    
    if (isList && listItems.length > 0) {
      return listItems;
    }
    
    // Return as string if not a clear list
    return content;
  }
}