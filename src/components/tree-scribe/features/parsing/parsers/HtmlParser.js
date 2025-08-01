/**
 * HtmlParser - HTML document parser for TreeScribe
 * Extracts semantic structure from HTML documents
 */

import { BaseParser } from '../BaseParser.js';

export class HtmlParser extends BaseParser {
  /**
   * Get parser name
   * @returns {string}
   */
  getName() {
    return 'HtmlParser';
  }

  /**
   * Get supported formats
   * @returns {string[]}
   */
  getSupportedFormats() {
    return ['html', 'htm', 'xhtml'];
  }

  /**
   * Get supported MIME types
   * @returns {string[]}
   */
  getSupportedMimeTypes() {
    return [
      'text/html',
      'application/xhtml+xml',
      'application/xml'
    ];
  }

  /**
   * Check if content can be parsed as HTML
   * @param {string} content - Document content
   * @param {Object} hints - Format hints
   * @returns {number} Confidence score (0-1)
   */
  canParse(content, hints = {}) {
    // Check hints first
    if (hints.format && this.getSupportedFormats().includes(hints.format.toLowerCase())) {
      return 1.0;
    }

    if (hints.mimeType && this.getSupportedMimeTypes().includes(hints.mimeType.toLowerCase())) {
      return 1.0;
    }

    // Check content for HTML patterns
    if (!content || typeof content !== 'string') {
      return 0;
    }

    const trimmed = content.trim().toLowerCase();
    
    // Check for HTML indicators
    const htmlPatterns = [
      { pattern: /^<!doctype\s+html/i, weight: 0.4 },
      { pattern: /<html[\s>]/i, weight: 0.3 },
      { pattern: /<head[\s>]/i, weight: 0.2 },
      { pattern: /<body[\s>]/i, weight: 0.2 },
      { pattern: /<\/html>/i, weight: 0.2 },
      { pattern: /<meta[\s>]/i, weight: 0.1 },
      { pattern: /<title[\s>]/i, weight: 0.1 },
      { pattern: /<h[1-6][\s>]/i, weight: 0.15 },
      { pattern: /<p[\s>]/i, weight: 0.1 },
      { pattern: /<div[\s>]/i, weight: 0.1 },
      { pattern: /<[a-z]+[^>]*>/i, weight: 0.05 }
    ];

    let confidence = 0;
    let matchCount = 0;
    
    for (const { pattern, weight } of htmlPatterns) {
      if (pattern.test(content)) {
        confidence += weight;
        matchCount++;
      }
    }

    // Check for XML declaration (could be XHTML)
    if (/^<\?xml/i.test(trimmed)) {
      confidence += 0.1;
    }

    // Boost confidence if structure looks complete
    if (matchCount >= 4 && content.includes('</html>')) {
      confidence = Math.min(confidence * 1.2, 0.95);
    }

    return Math.min(confidence, 0.95);
  }

  /**
   * Validate HTML content before parsing
   * @param {string} content - Document content
   * @returns {Object} {valid: boolean, errors: string[]}
   */
  validate(content) {
    if (!content || typeof content !== 'string') {
      return { 
        valid: false, 
        errors: ['Content must be a non-empty string'] 
      };
    }

    // Basic validation - check for any tags
    if (!/<[a-z]/i.test(content)) {
      return { 
        valid: false, 
        errors: ['No HTML tags found'] 
      };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Parse HTML content into tree structure
   * @param {string} content - HTML content
   * @param {Object} options - Parser options
   * @returns {Object} Normalized tree structure
   */
  parse(content, options = {}) {
    try {
      // Validate content first
      const validation = this.validate(content);
      if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
      }

      // Parse HTML into DOM structure
      const doc = this._parseHtmlString(content);
      
      // Extract document structure
      const structure = this._extractDocumentStructure(doc, options);
      
      // Normalize the structure
      const normalized = this._normalizeNode(structure);
      normalized.sourceFormat = 'html';
      
      return normalized;

    } catch (error) {
      console.error('[HtmlParser] Parse error:', error);
      return this._normalizeNode({
        title: 'Parse Error',
        content: error.message,
        contentType: 'error',
        children: [],
        sourceFormat: 'html',
        metadata: {
          error: true,
          errorMessage: error.message,
          parser: this.getName()
        }
      });
    }
  }

  /**
   * Parse HTML string into DOM-like structure
   * @private
   */
  _parseHtmlString(html) {
    // Simple regex-based parser for node environment
    // In a real implementation, we'd use a proper HTML parser
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'HTML Document';
    
    // Extract meta description
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1] : null;
    
    // Extract body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : html;
    
    return {
      title,
      description,
      content: bodyContent,
      raw: html
    };
  }

  /**
   * Extract hierarchical structure from HTML
   * @private
   */
  _extractDocumentStructure(doc, options = {}) {
    const skipTags = options.skipTags || ['script', 'style', 'meta', 'link', 'br', 'hr', 'img'];
    const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    const semanticTags = ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer'];
    
    // Create root node
    const root = {
      title: doc.title || 'HTML Document',
      content: doc.description || '',
      contentType: 'html',
      children: [],
      metadata: {
        documentType: 'html',
        hasDescription: !!doc.description
      }
    };
    
    // Extract headings and create hierarchy
    const headings = this._extractHeadings(doc.content);
    if (headings.length > 0) {
      root.children = this._buildHeadingHierarchy(headings, doc.content);
    }
    
    // If no headings, extract semantic structure
    if (root.children.length === 0) {
      const semanticStructure = this._extractSemanticStructure(doc.content, semanticTags);
      if (semanticStructure.length > 0) {
        root.children = semanticStructure;
      }
    }
    
    // If still no structure, create basic content node
    if (root.children.length === 0 && doc.content.trim()) {
      root.children.push({
        title: 'Content',
        content: this._extractTextContent(doc.content),
        contentType: 'html'
      });
    }
    
    return root;
  }

  /**
   * Extract headings from HTML content
   * @private
   */
  _extractHeadings(html) {
    const headings = [];
    const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;
    
    while ((match = headingRegex.exec(html)) !== null) {
      const level = parseInt(match[1].charAt(1));
      const content = this._extractTextContent(match[2]);
      
      if (content.trim()) {
        headings.push({
          level,
          title: content.trim(),
          position: match.index,
          fullMatch: match[0]
        });
      }
    }
    
    return headings;
  }

  /**
   * Build hierarchy from headings
   * @private
   */
  _buildHeadingHierarchy(headings, html) {
    const root = [];
    const stack = [];
    let lastPosition = 0;
    
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const nextPosition = i < headings.length - 1 ? headings[i + 1].position : html.length;
      
      // Extract content between this heading and the next
      const contentStart = heading.position + heading.fullMatch.length;
      const contentEnd = nextPosition;
      const content = html.substring(contentStart, contentEnd).trim();
      
      const node = {
        title: heading.title,
        content: this._extractTextContent(content),
        contentType: 'html',
        level: heading.level,
        children: []
      };
      
      // Find parent based on heading level
      while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }
      
      if (stack.length === 0) {
        root.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }
      
      stack.push(node);
    }
    
    return root;
  }

  /**
   * Extract semantic structure from HTML
   * @private
   */
  _extractSemanticStructure(html, semanticTags) {
    const structure = [];
    
    for (const tag of semanticTags) {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
      let match;
      
      while ((match = regex.exec(html)) !== null) {
        const content = match[1].trim();
        if (content) {
          // Check for nested headings
          const headings = this._extractHeadings(content);
          
          structure.push({
            title: this._capitalizeTag(tag),
            content: headings.length > 0 ? '' : this._extractTextContent(content),
            contentType: 'html',
            tagName: tag,
            children: headings.length > 0 ? this._buildHeadingHierarchy(headings, content) : []
          });
        }
      }
    }
    
    return structure;
  }

  /**
   * Extract text content from HTML
   * @private
   */
  _extractTextContent(html) {
    // Remove script and style content
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Remove HTML tags but preserve structure indicators
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<\/[^>]+>/g, ' ');
    text = text.replace(/<[^>]+>/g, '');
    
    // Clean up whitespace
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    
    // Normalize whitespace
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/\n\s+/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');
    
    return text.trim();
  }

  /**
   * Capitalize tag name for display
   * @private
   */
  _capitalizeTag(tag) {
    return tag.charAt(0).toUpperCase() + tag.slice(1);
  }

  /**
   * Get parser capabilities
   * @returns {Object}
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      supportsPartialParse: true,
      preservesFormatting: false,
      features: [
        'dom-tree',
        'semantic-structure',
        'heading-hierarchy',
        'metadata-extraction',
        'text-extraction'
      ]
    };
  }
}