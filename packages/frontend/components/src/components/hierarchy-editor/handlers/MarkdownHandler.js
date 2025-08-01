/**
 * Markdown Handler - Parse and serialize Markdown to/from HierarchyNode format
 */
import { BaseFormatHandler } from './BaseFormatHandler.js';
import { HierarchyNode } from '../model/HierarchyNode.js';

export class MarkdownHandler extends BaseFormatHandler {
  static format = 'markdown';
  
  constructor(config = {}) {
    super(config);
    this.indentSize = config.indentSize || 2;
    this.indentChar = ' ';
  }

  /**
   * Parse Markdown string to HierarchyNode
   */
  parse(markdownString) {
    if (!markdownString || typeof markdownString !== 'string') {
      return null;
    }

    const trimmed = markdownString.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const lines = trimmed.split('\n');
      const sections = this.parseIntoSections(lines);
      
      if (sections.length === 0) {
        return null;
      }

      // If no headings found, treat entire content as single content block
      if (sections.every(section => section.type === 'content')) {
        return {
          id: this.generateNodeId(),
          type: 'document',
          name: '',
          value: null,
          children: [{
            id: this.generateNodeId(),
            type: 'content',
            name: 'content-1',
            value: sections.map(s => s.content).join('\n\n'),
            children: [],
            metadata: {}
          }],
          metadata: {}
        };
      }

      const hierarchy = this.buildHierarchy(sections);
      
      return {
        id: this.generateNodeId(),
        type: 'document',
        name: '',
        value: null,
        children: hierarchy,
        metadata: {}
      };
    } catch (error) {
      throw new Error(`Failed to parse Markdown: ${error.message}`);
    }
  }

  /**
   * Serialize HierarchyNode to Markdown string
   */
  serialize(node, options = {}) {
    if (!node) {
      return '';
    }

    // Track visited nodes to prevent circular references
    const visited = new WeakSet();
    
    if (node.type === 'document') {
      return this.serializeChildren(node.children || [], visited);
    } else {
      return this.serializeNode(node, visited);
    }
  }

  /**
   * Parse lines into sections (headings and content blocks)
   * @private
   */
  parseIntoSections(lines) {
    const sections = [];
    let currentContent = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = this.parseHeading(line);
      
      if (headingMatch) {
        // Save any accumulated content before this heading
        if (currentContent.length > 0) {
          const contentText = currentContent.join('\n').trim();
          if (contentText) {
            sections.push({
              type: 'content',
              content: contentText
            });
          }
          currentContent = [];
        }
        
        // Add the heading
        sections.push({
          type: 'heading',
          level: headingMatch.level,
          text: headingMatch.text
        });
      } else {
        // Check for setext headings (underlined with = or -)
        const setextMatch = this.parseSetextHeading(lines, i);
        if (setextMatch) {
          // Save any accumulated content before the heading text
          if (currentContent.length > 1) {
            const contentText = currentContent.slice(0, -1).join('\n').trim();
            if (contentText) {
              sections.push({
                type: 'content',
                content: contentText
              });
            }
          }
          
          sections.push({
            type: 'heading',
            level: setextMatch.level,
            text: setextMatch.text
          });
          
          currentContent = [];
          i++; // Skip the underline
        } else {
          // Regular content line
          currentContent.push(line);
        }
      }
    }
    
    // Add any remaining content
    if (currentContent.length > 0) {
      const contentText = currentContent.join('\n').trim();
      if (contentText) {
        sections.push({
          type: 'content',
          content: contentText
        });
      }
    }
    
    return sections;
  }

  /**
   * Parse ATX heading (# ## ### etc.)
   * @private
   */
  parseHeading(line) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      return {
        level: match[1].length,
        text: match[2].trim()
      };
    }
    return null;
  }

  /**
   * Parse Setext heading (underlined with = or -)
   * @private
   */
  parseSetextHeading(lines, index) {
    if (index + 1 >= lines.length) {
      return null;
    }
    
    const currentLine = lines[index].trim();
    const nextLine = lines[index + 1].trim();
    
    if (!currentLine) {
      return null;
    }
    
    // Check for level 1 heading (=== underline)
    if (/^=+$/.test(nextLine) && nextLine.length >= currentLine.length) {
      return {
        level: 1,
        text: currentLine
      };
    }
    
    // Check for level 2 heading (--- underline)
    if (/^-+$/.test(nextLine) && nextLine.length >= currentLine.length) {
      return {
        level: 2,
        text: currentLine
      };
    }
    
    return null;
  }

  /**
   * Build hierarchy from flat sections
   * @private
   */
  buildHierarchy(sections) {
    const stack = []; // Stack of heading nodes
    const result = [];
    
    for (const section of sections) {
      if (section.type === 'heading') {
        const headingNode = {
          id: this.generateNodeId(),
          type: 'heading',
          name: section.text,
          value: null,
          children: [],
          metadata: { level: section.level }
        };
        
        // Find the correct parent based on heading level
        while (stack.length > 0 && stack[stack.length - 1].metadata.level >= section.level) {
          stack.pop();
        }
        
        if (stack.length === 0) {
          // Top-level heading
          result.push(headingNode);
        } else {
          // Child heading
          stack[stack.length - 1].children.push(headingNode);
        }
        
        stack.push(headingNode);
      } else if (section.type === 'content') {
        const contentNode = {
          id: this.generateNodeId(),
          type: 'content',
          name: `content-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          value: section.content,
          children: [],
          metadata: this.analyzeContentType(section.content)
        };
        
        if (stack.length === 0) {
          // Content without heading - shouldn't happen if we have headings
          result.push(contentNode);
        } else {
          // Add content to current heading
          stack[stack.length - 1].children.push(contentNode);
        }
      }
    }
    
    return result;
  }

  /**
   * Analyze content to determine its type
   * @private
   */
  analyzeContentType(content) {
    const trimmed = content.trim();
    
    // Code block - check for backticks anywhere in content
    if (trimmed.includes('```')) {
      const lines = trimmed.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('```')) {
          const language = line.substring(line.indexOf('```') + 3).trim();
          return { type: 'code', language: language || 'text' };
        }
      }
    }
    
    // Blockquote - check if any line starts with >
    const lines = trimmed.split('\n');
    if (lines.some(line => line.trim().startsWith('>'))) {
      return { type: 'blockquote' };
    }
    
    // List - check if any line looks like a list item
    if (lines.some(line => /^[\s]*[-*+]\s/.test(line) || /^[\s]*\d+\.\s/.test(line))) {
      return { type: 'list' };
    }
    
    return { type: 'paragraph' };
  }

  /**
   * Serialize a node to Markdown string
   * @private
   */
  serializeNode(node, visited) {
    if (!node || !node.type) {
      throw new Error('Invalid node: missing type');
    }

    // Check for circular references
    if (visited.has(node)) {
      throw new Error('Circular reference detected in Markdown structure');
    }
    visited.add(node);

    try {
      switch (node.type) {
        case 'document':
          return this.serializeChildren(node.children || [], visited);
        case 'heading':
          return this.serializeHeading(node, visited);
        case 'content':
          return this.serializeContent(node);
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }
    } finally {
      visited.delete(node);
    }
  }

  /**
   * Serialize heading node
   * @private
   */
  serializeHeading(node, visited) {
    const level = node.metadata?.level || 1;
    const hashes = '#'.repeat(Math.min(Math.max(level, 1), 6));
    
    let result = `${hashes} ${node.name || ''}\n`;
    
    if (node.children && node.children.length > 0) {
      result += '\n';
      result += this.serializeChildren(node.children, visited);
    }
    
    return result;
  }

  /**
   * Serialize content node
   * @private
   */
  serializeContent(node) {
    if (!node.value) {
      return '';
    }
    
    const contentType = node.metadata?.type || 'paragraph';
    
    switch (contentType) {
      case 'code':
        const language = node.metadata?.language || '';
        return `\`\`\`${language}\n${node.value}\n\`\`\`\n`;
        
      case 'blockquote':
        return node.value.split('\n')
          .map(line => `> ${line}`)
          .join('\n') + '\n';
        
      case 'list':
      case 'paragraph':
      default:
        return node.value + '\n';
    }
  }

  /**
   * Serialize children nodes
   * @private
   */
  serializeChildren(children, visited) {
    let result = '';
    
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childContent = this.serializeNode(child, visited);
      
      result += childContent;
      
      // Add spacing between sections
      if (i < children.length - 1) {
        if (child.type === 'heading' || children[i + 1].type === 'heading') {
          result += '\n';
        }
      }
    }
    
    return result.replace(/\n+$/, '\n'); // Clean up trailing newlines
  }

  /**
   * Generate unique node ID
   * @private
   */
  generateNodeId() {
    return 'md-node-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get format metadata
   */
  getMetadata() {
    return {
      format: this.format,
      mimeType: this.mimeType,
      fileExtensions: this.fileExtensions,
      supportsHierarchy: true,
      supportsHeadings: true,
      supportsFormatting: true,
      supportsCodeBlocks: true,
      supportsLists: true,
      supportsBlockquotes: true
    };
  }

  /**
   * Validate Markdown content
   */
  validate(content) {
    try {
      this.parse(content);
      return { valid: true, errors: [] };
    } catch (error) {
      return { 
        valid: false, 
        errors: [error.message] 
      };
    }
  }

  /**
   * Detect if content is likely Markdown
   */
  detect(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }

    const trimmed = content.trim();
    const lines = trimmed.split('\n');
    
    let markdownFeatures = 0;
    
    for (const line of lines.slice(0, 20)) { // Check first 20 lines
      const trimmedLine = line.trim();
      
      // ATX headings
      if (/^#{1,6}\s+.+/.test(trimmedLine)) {
        markdownFeatures += 2;
      }
      
      // Lists
      if (/^[\s]*[-*+]\s/.test(line) || /^[\s]*\d+\.\s/.test(line)) {
        markdownFeatures++;
      }
      
      // Blockquotes
      if (/^\s*>\s/.test(line)) {
        markdownFeatures++;
      }
      
      // Code blocks
      if (/^```/.test(trimmedLine)) {
        markdownFeatures += 2;
      }
      
      // Emphasis/strong
      if (/[*_]{1,2}[^*_]+[*_]{1,2}/.test(trimmedLine)) {
        markdownFeatures++;
      }
      
      // Links
      if (/\[.+\]\(.+\)/.test(trimmedLine)) {
        markdownFeatures++;
      }
      
      // Inline code
      if (/`.+`/.test(trimmedLine)) {
        markdownFeatures++;
      }
    }
    
    // Check for setext headings
    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i].trim();
      const nextLine = lines[i + 1].trim();
      
      if (currentLine && (/^=+$/.test(nextLine) || /^-+$/.test(nextLine))) {
        markdownFeatures += 2;
      }
    }
    
    return markdownFeatures >= 1;
  }

  /**
   * Get editable fields configuration
   */
  getEditableFields() {
    return {
      keyEditable: false,     // Markdown structure is implicit
      valueEditable: true,    // Can edit text content
      typeChangeable: false,  // Node types are determined by syntax
      structureEditable: true // Can add/remove/move nodes
    };
  }
}

// Register the handler
BaseFormatHandler.register('markdown', MarkdownHandler);