/**
 * SyntaxHighlighter - Format-specific syntax highlighting
 */
export class SyntaxHighlighter {
  constructor(format, options = {}) {
    this.format = format;
    this.options = {
      theme: 'light',
      showLineNumbers: false,
      cssPrefix: 'syntax',
      ...options
    };
    
    this.supportedFormats = new Set(['json', 'xml', 'yaml', 'markdown']);
  }

  /**
   * Check if format is supported
   */
  isSupported(format) {
    return this.supportedFormats.has(format);
  }

  /**
   * Highlight content based on format
   */
  highlight(content) {
    if (!content || typeof content !== 'string') {
      return '';
    }

    if (content.trim() === '') {
      return content;
    }

    if (!this.isSupported(this.format)) {
      return this.escapeHtml(content);
    }

    try {
      switch (this.format) {
        case 'json':
          return this.highlightJson(content);
        case 'xml':
          return this.highlightXml(content);
        case 'yaml':
          return this.highlightYaml(content);
        case 'markdown':
          return this.highlightMarkdown(content);
        default:
          return this.escapeHtml(content);
      }
    } catch (error) {
      console.warn('Highlighting failed:', error);
      return this.escapeHtml(content);
    }
  }

  /**
   * Highlight JSON content
   * @private
   */
  highlightJson(content) {
    let highlighted = this.escapeHtml(content);
    const prefix = this.options.cssPrefix;
    
    // Highlight strings (including keys)
    highlighted = highlighted.replace(
      /"([^"\\]|\\.)*"/g,
      `<span class="${prefix}-string">$&</span>`
    );
    
    // Highlight numbers
    highlighted = highlighted.replace(
      /\b(-?\d+\.?\d*([eE][+-]?\d+)?)\b/g,
      `<span class="${prefix}-number">$1</span>`
    );
    
    // Highlight booleans
    highlighted = highlighted.replace(/\btrue\b/g, `<span class="${prefix}-boolean">true</span>`);
    highlighted = highlighted.replace(/\bfalse\b/g, `<span class="${prefix}-boolean">false</span>`);
    
    // Highlight null
    highlighted = highlighted.replace(/\bnull\b/g, `<span class="${prefix}-null">null</span>`);
    
    // Highlight structure tokens
    highlighted = highlighted.replace(/\{/g, `<span class="${prefix}-brace">{</span>`);
    highlighted = highlighted.replace(/\}/g, `<span class="${prefix}-brace">}</span>`);
    highlighted = highlighted.replace(/\[/g, `<span class="${prefix}-bracket">[</span>`);
    highlighted = highlighted.replace(/\]/g, `<span class="${prefix}-bracket">]</span>`);
    highlighted = highlighted.replace(/,/g, `<span class="${prefix}-comma">,</span>`);
    highlighted = highlighted.replace(/:/g, `<span class="${prefix}-colon">:</span>`);
    
    highlighted = this.applyTheme(highlighted);
    return this.wrapWithLineNumbers(highlighted);
  }

  /**
   * Highlight XML content
   * @private
   */
  highlightXml(content) {
    let highlighted = this.escapeHtml(content);
    
    // Highlight XML declaration
    highlighted = highlighted.replace(
      /(&lt;\?xml[^?]*\?&gt;)/g,
      '<span class="xml-declaration">$1</span>'
    );
    
    // Highlight comments
    highlighted = highlighted.replace(
      /(&lt;!--[\s\S]*?--&gt;)/g,
      '<span class="xml-comment">$1</span>'
    );
    
    // Highlight CDATA
    highlighted = highlighted.replace(
      /(&lt;!\[CDATA\[[\s\S]*?\]\]&gt;)/g,
      '<span class="xml-cdata">$1</span>'
    );
    
    // Highlight attributes first (before tags to avoid conflicts)
    highlighted = highlighted.replace(
      /\s([a-zA-Z:][a-zA-Z0-9:.-]*)=("[^"]*")/g,
      ' <span class="xml-attribute">$1</span>=<span class="xml-attribute-value">$2</span>'
    );
    
    // Highlight self-closing tags
    highlighted = highlighted.replace(
      /(&lt;[a-zA-Z:][a-zA-Z0-9:.-]*[^>]*\/&gt;)/g,
      '<span class="xml-tag xml-self-closing">$1</span>'
    );
    
    // Highlight opening and closing tags
    highlighted = highlighted.replace(
      /(&lt;\/?)([a-zA-Z:][a-zA-Z0-9:.-]*)/g,
      '$1<span class="xml-tag">$2</span>'
    );
    
    // Highlight text content between tags
    highlighted = highlighted.replace(
      /&gt;([^&<]+)&lt;/g,
      '&gt;<span class="xml-text">$1</span>&lt;'
    );
    
    return this.wrapWithLineNumbers(highlighted);
  }

  /**
   * Highlight YAML content
   * @private
   */
  highlightYaml(content) {
    let highlighted = this.escapeHtml(content);
    const lines = highlighted.split('\n');
    
    const highlightedLines = lines.map(line => {
      let highlightedLine = line;
      
      // Highlight comments
      highlightedLine = highlightedLine.replace(
        /(#.*)/g,
        '<span class="yaml-comment">$1</span>'
      );
      
      // Highlight document markers
      highlightedLine = highlightedLine.replace(
        /^(---|\.\.\.)$/g,
        '<span class="yaml-document-marker">$1</span>'
      );
      
      // Highlight keys (before colon)
      highlightedLine = highlightedLine.replace(
        /^(\s*)([^:\s#]+)(\s*:)(?!\s*$)/g,
        '$1<span class="yaml-key">$2</span>$3'
      );
      
      // Highlight list markers
      highlightedLine = highlightedLine.replace(
        /^(\s*)([-*+])(\s)/g,
        '$1<span class="yaml-list-marker">$2</span>$3'
      );
      
      // Highlight strings in quotes
      highlightedLine = highlightedLine.replace(
        /"([^"\\]|\\.)*"/g,
        '<span class="yaml-string">$&</span>'
      );
      
      highlightedLine = highlightedLine.replace(
        /'([^'\\]|\\.)*'/g,
        '<span class="yaml-string">$&</span>'
      );
      
      // Highlight numbers
      highlightedLine = highlightedLine.replace(
        /\b(-?\d+\.?\d*([eE][+-]?\d+)?)\b/g,
        '<span class="yaml-number">$1</span>'
      );
      
      // Highlight booleans
      highlightedLine = highlightedLine.replace(/\btrue\b/g, '<span class="yaml-boolean">true</span>');
      highlightedLine = highlightedLine.replace(/\bfalse\b/g, '<span class="yaml-boolean">false</span>');
      
      // Highlight null
      highlightedLine = highlightedLine.replace(/\bnull\b/g, '<span class="yaml-null">null</span>');
      highlightedLine = highlightedLine.replace(/\b~\b/g, '<span class="yaml-null">~</span>');
      
      // Highlight timestamps (ISO 8601 format)
      highlightedLine = highlightedLine.replace(
        /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})\b/g,
        '<span class="yaml-timestamp">$&</span>'
      );
      
      // Highlight literal and folded strings
      highlightedLine = highlightedLine.replace(
        /(\|\|?)(\+?-?)(\s*$)/g,
        '<span class="yaml-literal">$1$2</span>$3'
      );
      
      highlightedLine = highlightedLine.replace(
        /(&gt;\|?)(\+?-?)(\s*$)/g,
        '<span class="yaml-folded">$1$2</span>$3'
      );
      
      return highlightedLine;
    });
    
    return this.wrapWithLineNumbers(highlightedLines.join('\n'));
  }

  /**
   * Highlight Markdown content
   * @private
   */
  highlightMarkdown(content) {
    let highlighted = this.escapeHtml(content);
    const lines = highlighted.split('\n');
    
    const highlightedLines = lines.map((line, index) => {
      let highlightedLine = line;
      
      // Highlight ATX headings
      highlightedLine = highlightedLine.replace(
        /^(#{1,6})\s+(.+)$/g,
        (match, hashes, text) => {
          return `<span class="md-heading md-h${hashes.length}">${hashes} ${text}</span>`;
        }
      );
      
      // Highlight setext headings
      if (index > 0 && /^=+$/.test(line.trim())) {
        // Previous line is heading level 1
        highlightedLines[index - 1] = highlightedLines[index - 1].replace(
          /^(.+)$/,
          '<span class="md-heading md-h1">$1</span>'
        );
        highlightedLine = '<span class="md-heading-underline">$&</span>'.replace('$&', line);
      } else if (index > 0 && /^-+$/.test(line.trim())) {
        // Previous line is heading level 2
        highlightedLines[index - 1] = highlightedLines[index - 1].replace(
          /^(.+)$/,
          '<span class="md-heading md-h2">$1</span>'
        );
        highlightedLine = '<span class="md-heading-underline">$&</span>'.replace('$&', line);
      }
      
      // Highlight code blocks
      highlightedLine = highlightedLine.replace(
        /^```([a-zA-Z0-9]*)/g,
        '<span class="md-code-block language-$1">```$1</span>'
      );
      
      highlightedLine = highlightedLine.replace(
        /^```$/g,
        '<span class="md-code-block">```</span>'
      );
      
      // Highlight inline code
      highlightedLine = highlightedLine.replace(
        /`([^`]+)`/g,
        '<span class="md-inline-code">`$1`</span>'
      );
      
      // Highlight emphasis
      highlightedLine = highlightedLine.replace(
        /\*\*([^*]+)\*\*/g,
        '<span class="md-bold">**$1**</span>'
      );
      
      highlightedLine = highlightedLine.replace(
        /\*([^*]+)\*/g,
        '<span class="md-italic">*$1*</span>'
      );
      
      // Highlight links
      highlightedLine = highlightedLine.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<span class="md-link">[<span class="md-link-text">$1</span>](<span class="md-link-url">$2</span>)</span>'
      );
      
      // Highlight images
      highlightedLine = highlightedLine.replace(
        /!\[([^\]]*)\]\(([^)]+)\)/g,
        '<span class="md-image">![<span class="md-image-alt">$1</span>](<span class="md-image-url">$2</span>)</span>'
      );
      
      // Highlight list markers
      highlightedLine = highlightedLine.replace(
        /^(\s*)([-*+]|\d+\.)\s/g,
        '$1<span class="md-list-marker">$2</span> '
      );
      
      // Highlight task lists
      highlightedLine = highlightedLine.replace(
        /^(\s*[-*+]\s*)(\[[ x]\])/g,
        '$1<span class="md-task-list">$2</span>'
      );
      
      // Highlight blockquotes
      highlightedLine = highlightedLine.replace(
        /^(\s*)(&gt;\s*)/g,
        '$1<span class="md-blockquote">$2</span>'
      );
      
      // Highlight horizontal rules
      highlightedLine = highlightedLine.replace(
        /^(\s*)([-*_]{3,})(\s*)$/g,
        '$1<span class="md-hr">$2</span>$3'
      );
      
      // Highlight tables
      if (/^\s*\|/.test(line) && /\|\s*$/.test(line)) {
        highlightedLine = '<span class="md-table">' + highlightedLine + '</span>';
      }
      
      return highlightedLine;
    });
    
    return this.wrapWithLineNumbers(highlightedLines.join('\n'));
  }

  /**
   * Wrap content with line numbers if enabled
   * @private
   */
  wrapWithLineNumbers(content) {
    if (!this.options.showLineNumbers) {
      return content;
    }
    
    const lines = content.split('\n');
    const numberedLines = lines.map((line, index) => {
      const lineNumber = index + 1;
      return `<span class="line-number">${lineNumber}</span>${line}`;
    });
    
    return numberedLines.join('\n');
  }

  /**
   * Escape HTML characters
   * @private
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Apply custom theme colors
   */
  applyTheme(highlighted) {
    if (!this.options.theme || typeof this.options.theme === 'string') {
      return highlighted;
    }

    let themedContent = highlighted;
    
    // Apply custom colors if theme is an object
    Object.entries(this.options.theme).forEach(([tokenType, color]) => {
      const className = `${this.options.cssPrefix}-${tokenType}`;
      themedContent = themedContent.replace(
        new RegExp(`<span class="${className}">`, 'g'),
        `<span class="${className}" style="color: ${color}">`
      );
    });
    
    return themedContent;
  }
}