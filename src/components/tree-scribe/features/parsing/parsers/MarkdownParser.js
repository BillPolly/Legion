/**
 * MarkdownParser - Markdown document parser for TreeScribe
 * Converts Markdown heading hierarchy into tree structure
 */

import { BaseParser } from '../BaseParser.js';

export class MarkdownParser extends BaseParser {
  /**
   * Get parser name
   * @returns {string}
   */
  getName() {
    return 'MarkdownParser';
  }

  /**
   * Get supported formats
   * @returns {string[]}
   */
  getSupportedFormats() {
    return ['markdown', 'md', 'mdown', 'mkd'];
  }

  /**
   * Get supported MIME types
   * @returns {string[]}
   */
  getSupportedMimeTypes() {
    return [
      'text/markdown',
      'text/x-markdown',
      'application/markdown'
    ];
  }

  /**
   * Check if content can be parsed as Markdown
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

    // Check content for Markdown patterns
    if (!content || typeof content !== 'string') {
      return 0;
    }

    // Look for Markdown indicators
    const markdownPatterns = [
      { pattern: /^#{1,6}\s+.+$/m, weight: 0.3 },           // ATX headings
      { pattern: /^.+\n={3,}$/m, weight: 0.2 },             // Setext heading level 1
      { pattern: /^.+\n-{3,}$/m, weight: 0.2 },             // Setext heading level 2
      { pattern: /^---\s*$/m, weight: 0.15 },               // Frontmatter separator
      { pattern: /\*{1,3}[^*]+\*{1,3}/m, weight: 0.1 },     // Bold/italic
      { pattern: /^```/m, weight: 0.2 },                    // Code blocks
      { pattern: /^\s*[-*+]\s+/m, weight: 0.1 },           // Lists
      { pattern: /^\s*\d+\.\s+/m, weight: 0.1 },          // Numbered lists
      { pattern: /^\s*>\s+/m, weight: 0.1 },               // Blockquotes
      { pattern: /\[.*\]\(.*\)/, weight: 0.1 },            // Links
      { pattern: /!\[.*\]\(.*\)/, weight: 0.1 }            // Images
    ];

    let confidence = 0;
    let matchCount = 0;
    
    for (const { pattern, weight } of markdownPatterns) {
      if (pattern.test(content)) {
        confidence += weight;
        matchCount++;
      }
    }

    // Boost confidence if multiple patterns match
    if (matchCount >= 3) {
      confidence = Math.min(confidence * 1.2, 0.95);
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Validate Markdown content before parsing
   * @param {string} content - Document content
   * @returns {Object} {valid: boolean, errors: string[]}
   */
  validate(content) {
    if (content === null || content === undefined || typeof content !== 'string') {
      return { 
        valid: false, 
        errors: ['Content must be a string'] 
      };
    }

    // Markdown can be empty
    return { valid: true, errors: [] };
  }

  /**
   * Parse Markdown content into tree structure
   * @param {string} content - Markdown content
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

      // Handle empty content
      if (!content || content.trim() === '') {
        return this._normalizeNode({
          title: 'Empty Document',
          content: '',
          contentType: 'markdown',
          children: [],
          sourceFormat: 'markdown'
        });
      }

      // Parse frontmatter if present
      const { frontmatter, content: markdownContent } = this._extractFrontmatter(content);
      
      // Parse heading structure
      const headingStructure = this._parseHeadingStructure(markdownContent, options);
      
      // Build tree from heading structure
      const tree = this._buildTreeFromHeadings(headingStructure, frontmatter, options);
      
      // Ensure sourceFormat is set correctly
      tree.sourceFormat = 'markdown';
      
      // Add parser metadata
      tree.parseInfo = {
        ...tree.parseInfo,
        originalFormat: 'markdown',
        parseTime: new Date().toISOString(),
        hasFrontmatter: !!frontmatter,
        headingCount: headingStructure.length
      };

      return tree;

    } catch (error) {
      console.error('[MarkdownParser] Parse error:', error);
      // Return error document structure
      return this._normalizeNode({
        title: 'Parse Error',
        content: error.message,
        contentType: 'error',
        children: [],
        sourceFormat: 'markdown',
        metadata: {
          error: true,
          errorMessage: error.message,
          parser: this.getName()
        }
      });
    }
  }

  /**
   * Extract frontmatter from Markdown content
   * @private
   */
  _extractFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontmatterRegex);
    
    if (match) {
      const frontmatterText = match[1];
      const remainingContent = content.substring(match[0].length);
      
      // Try to parse frontmatter as YAML (basic support)
      let frontmatter = {};
      try {
        // Simple YAML parsing for common frontmatter patterns
        frontmatterText.split('\n').forEach(line => {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            frontmatter[key] = value.replace(/^["']|["']$/g, ''); // Remove quotes
          }
        });
      } catch (e) {
        // If frontmatter parsing fails, keep as text
        frontmatter = { raw: frontmatterText };
      }
      
      return { frontmatter, content: remainingContent };
    }
    
    return { frontmatter: null, content };
  }

  /**
   * Parse heading structure from Markdown
   * @private
   */
  _parseHeadingStructure(content, options = {}) {
    const lines = content.split('\n');
    const headings = [];
    let currentContent = [];
    let lineIndex = 0;

    while (lineIndex < lines.length) {
      const line = lines[lineIndex];
      
      // Check for ATX headings (# ## ### etc.)
      const atxMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (atxMatch) {
        // Save previous content if any
        if (currentContent.length > 0) {
          const lastHeading = headings[headings.length - 1];
          if (lastHeading) {
            lastHeading.content = currentContent.join('\n').trim();
          }
          currentContent = [];
        }

        headings.push({
          level: atxMatch[1].length,
          title: atxMatch[2].trim(),
          content: '',
          lineNumber: lineIndex + 1,
          type: 'atx'
        });
      }
      // Check for Setext headings (underlined with = or -)
      else if (lineIndex + 1 < lines.length) {
        const nextLine = lines[lineIndex + 1];
        if (nextLine.match(/^={3,}$/)) {
          // Level 1 Setext heading
          if (currentContent.length > 0) {
            const lastHeading = headings[headings.length - 1];
            if (lastHeading) {
              lastHeading.content = currentContent.join('\n').trim();
            }
            currentContent = [];
          }

          headings.push({
            level: 1,
            title: line.trim(),
            content: '',
            lineNumber: lineIndex + 1,
            type: 'setext'
          });
          
          lineIndex++; // Skip the underline
        } else if (nextLine.match(/^-{3,}$/)) {
          // Level 2 Setext heading
          if (currentContent.length > 0) {
            const lastHeading = headings[headings.length - 1];
            if (lastHeading) {
              lastHeading.content = currentContent.join('\n').trim();
            }
            currentContent = [];
          }

          headings.push({
            level: 2,
            title: line.trim(),
            content: '',
            lineNumber: lineIndex + 1,
            type: 'setext'
          });
          
          lineIndex++; // Skip the underline
        } else {
          currentContent.push(line);
        }
      } else {
        currentContent.push(line);
      }
      
      lineIndex++;
    }

    // Handle remaining content
    if (currentContent.length > 0) {
      if (headings.length > 0) {
        const lastHeading = headings[headings.length - 1];
        lastHeading.content = currentContent.join('\n').trim();
      } else {
        // No headings found, create a default structure
        headings.push({
          level: 1,
          title: 'Document',
          content: currentContent.join('\n').trim(),
          lineNumber: 1,
          type: 'default'
        });
      }
    }

    return headings;
  }

  /**
   * Build tree structure from heading hierarchy
   * @private
   */
  _buildTreeFromHeadings(headings, frontmatter, options = {}) {
    if (headings.length === 0) {
      return this._normalizeNode({
        title: 'Empty Document',
        content: '',
        contentType: 'markdown',
        sourceFormat: 'markdown'
      });
    }

    // Create document root
    let rootTitle = 'Document';
    let rootContent = '';

    // Use frontmatter title if available
    if (frontmatter && frontmatter.title) {
      rootTitle = frontmatter.title;
    } else if (headings.length > 0 && headings[0].level === 1) {
      // Use first level 1 heading as root
      rootTitle = headings[0].title;
      rootContent = headings[0].content;
      headings.shift(); // Remove the title heading
    }

    // Add frontmatter to root content if present
    if (frontmatter && Object.keys(frontmatter).length > 0) {
      const frontmatterText = Object.entries(frontmatter)
        .map(([key, value]) => `**${key}**: ${value}`)
        .join('\n');
      rootContent = frontmatterText + (rootContent ? '\n\n' + rootContent : '');
    }

    const root = this._normalizeNode({
      title: rootTitle,
      content: rootContent,
      contentType: 'markdown',
      sourceFormat: 'markdown',
      children: [],
      metadata: {
        frontmatter: frontmatter || {},
        headingCount: headings.length + 1
      }
    });

    // Build hierarchical structure
    const stack = [{ node: root, level: 0 }];

    headings.forEach(heading => {
      const headingNode = this._normalizeNode({
        title: heading.title,
        content: heading.content,
        contentType: 'markdown',
        sourceFormat: 'markdown',
        metadata: {
          level: heading.level,
          lineNumber: heading.lineNumber,
          type: heading.type
        }
      });

      // Find the correct parent based on heading level
      while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].node;
      parent.children.push(headingNode);
      
      // Add to stack for potential children
      stack.push({ node: headingNode, level: heading.level });
    });

    return root;
  }

  /**
   * Get parser capabilities
   * @returns {Object}
   */
  getCapabilities() {
    return {
      ...super.getCapabilities(),
      supportsPartialParse: true,
      bidirectional: false,  // Lossy conversion (formatting lost)
      features: [
        'frontmatter',      // YAML frontmatter support
        'atx-headings',     // # style headings
        'setext-headings',  // underlined headings
        'hierarchy',        // Heading level hierarchy
        'content-sections', // Content between headings
        'metadata'          // Frontmatter metadata
      ]
    };
  }

  /**
   * Get parser metadata
   * @returns {Object}
   */
  getMetadata() {
    return {
      name: this.getName(),
      version: '1.0.0',
      author: 'TreeScribe Team',
      description: 'Markdown document parser with heading-based hierarchy'
    };
  }

  /**
   * Get options schema
   * @returns {Object}
   */
  getOptionsSchema() {
    return {
      ...super.getOptionsSchema(),
      headerLevels: {
        type: 'number',
        default: 6,
        description: 'Maximum heading levels to parse (1-6)'
      },
      includeFrontmatter: {
        type: 'boolean',
        default: true,
        description: 'Parse YAML frontmatter if present'
      },
      preserveFormatting: {
        type: 'boolean',
        default: true,
        description: 'Preserve Markdown formatting in content'
      },
      contentPreview: {
        type: 'number',
        default: 200,
        description: 'Maximum characters to show in content preview'
      }
    };
  }
}