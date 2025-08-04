import { ArtifactRenderer } from '../ArtifactRenderer.js';

/**
 * DocumentRenderer - Renders document artifacts (text, markdown, etc.)
 */
export class DocumentRenderer extends ArtifactRenderer {
  constructor() {
    super('document');
  }

  renderContent(artifact, content) {
    const container = document.createElement('div');
    container.style.cssText = `
      background: #1a1a1a;
      border-radius: 6px;
      overflow: hidden;
    `;

    // Render based on document type
    if (artifact.subtype === 'md') {
      return this.renderMarkdown(content);
    } else {
      return this.renderPlainText(content);
    }
  }

  /**
   * Render markdown content
   * @param {string} content - Markdown content
   * @returns {HTMLElement} Rendered element
   */
  renderMarkdown(content) {
    const container = document.createElement('div');
    container.style.cssText = `
      padding: 20px;
      line-height: 1.6;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    `;

    // Simple markdown parser
    let html = this.parseMarkdown(content);
    container.innerHTML = html;

    // Apply styles to rendered elements
    this.styleMarkdownElements(container);

    return container;
  }

  /**
   * Render plain text content
   * @param {string} content - Plain text content
   * @returns {HTMLElement} Rendered element
   */
  renderPlainText(content) {
    const container = document.createElement('div');
    container.style.cssText = `
      padding: 20px;
      font-family: 'SFMono-Regular', 'Consolas', 'Monaco', monospace;
      font-size: 14px;
      line-height: 1.5;
      color: #e0e0e0;
      white-space: pre-wrap;
      word-wrap: break-word;
    `;

    container.textContent = content;
    return container;
  }

  /**
   * Parse markdown to HTML
   * @param {string} markdown - Markdown content
   * @returns {string} HTML content
   */
  parseMarkdown(markdown) {
    let html = markdown;

    // Escape HTML first
    html = html.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');

    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Lists
    html = html.replace(/^\* (.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    html = html.replace(/^\d+\. (.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');

    // Blockquotes
    html = html.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Paragraphs (simple)
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6])/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');

    return html;
  }

  /**
   * Apply styles to markdown elements
   * @param {HTMLElement} container - Container element
   */
  styleMarkdownElements(container) {
    // Headers
    const h1s = container.querySelectorAll('h1');
    h1s.forEach(h1 => {
      h1.style.cssText = `
        font-size: 28px;
        font-weight: 600;
        margin: 24px 0 16px 0;
        color: #f0f6fc;
        border-bottom: 1px solid #30363d;
        padding-bottom: 8px;
      `;
    });

    const h2s = container.querySelectorAll('h2');
    h2s.forEach(h2 => {
      h2.style.cssText = `
        font-size: 24px;
        font-weight: 600;
        margin: 20px 0 12px 0;
        color: #f0f6fc;
        border-bottom: 1px solid #30363d;
        padding-bottom: 6px;
      `;
    });

    const h3s = container.querySelectorAll('h3');
    h3s.forEach(h3 => {
      h3.style.cssText = `
        font-size: 20px;
        font-weight: 600;
        margin: 16px 0 8px 0;
        color: #f0f6fc;
      `;
    });

    // Paragraphs
    const paragraphs = container.querySelectorAll('p');
    paragraphs.forEach(p => {
      p.style.cssText = `
        margin: 16px 0;
        line-height: 1.6;
      `;
    });

    // Code blocks
    const codeBlocks = container.querySelectorAll('pre');
    codeBlocks.forEach(pre => {
      pre.style.cssText = `
        background: #0d1117;
        border: 1px solid #30363d;
        border-radius: 6px;
        padding: 16px;
        margin: 16px 0;
        overflow-x: auto;
        font-family: 'SFMono-Regular', 'Consolas', 'Monaco', monospace;
        font-size: 13px;
        line-height: 1.45;
        color: #c9d1d9;
      `;
    });

    // Inline code
    const inlineCodes = container.querySelectorAll('code');
    inlineCodes.forEach(code => {
      if (code.parentElement.tagName !== 'PRE') {
        code.style.cssText = `
          background: #6e768166;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: 'SFMono-Regular', 'Consolas', 'Monaco', monospace;
          font-size: 12px;
          color: #e6edf3;
        `;
      }
    });

    // Lists
    const lists = container.querySelectorAll('ul, ol');
    lists.forEach(list => {
      list.style.cssText = `
        margin: 16px 0;
        padding-left: 32px;
      `;
    });

    const listItems = container.querySelectorAll('li');
    listItems.forEach(li => {
      li.style.cssText = `
        margin: 4px 0;
      `;
    });

    // Blockquotes
    const blockquotes = container.querySelectorAll('blockquote');
    blockquotes.forEach(bq => {
      bq.style.cssText = `
        border-left: 4px solid #30363d;
        padding: 0 16px;
        margin: 16px 0;
        color: #8b949e;
        font-style: italic;
      `;
    });

    // Links
    const links = container.querySelectorAll('a');
    links.forEach(link => {
      link.style.cssText = `
        color: #58a6ff;
        text-decoration: none;
      `;
      
      link.addEventListener('mouseenter', () => {
        link.style.textDecoration = 'underline';
      });
      
      link.addEventListener('mouseleave', () => {
        link.style.textDecoration = 'none';
      });
    });

    // Horizontal rules
    const hrs = container.querySelectorAll('hr');
    hrs.forEach(hr => {
      hr.style.cssText = `
        border: none;
        border-top: 1px solid #30363d;
        margin: 24px 0;
      `;
    });

    // Strong/Bold
    const strongs = container.querySelectorAll('strong');
    strongs.forEach(strong => {
      strong.style.cssText = `
        font-weight: 600;
        color: #f0f6fc;
      `;
    });

    // Emphasis/Italic
    const ems = container.querySelectorAll('em');
    ems.forEach(em => {
      em.style.cssText = `
        font-style: italic;
        color: #f0f6fc;
      `;
    });
  }
}

/**
 * MarkdownRenderer - Specific renderer for markdown files
 */
export class MarkdownRenderer extends DocumentRenderer {
  constructor() {
    super();
    this.subtype = 'md';
  }

  renderContent(artifact, content) {
    return this.renderMarkdown(content);
  }
}