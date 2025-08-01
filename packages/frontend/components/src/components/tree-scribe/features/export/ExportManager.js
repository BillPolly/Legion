/**
 * ExportManager - Handles exporting TreeScribe content to various formats
 * 
 * Supports HTML, JSON, Markdown, and plain text exports with
 * customizable options and formatting.
 */

export class ExportManager {
  constructor(options = {}) {
    this.options = {
      includeMetadata: true,
      includeStyles: true,
      prettyPrint: true,
      indentSize: 2,
      maxDepth: Infinity,
      ...options
    };

    this.destroyed = false;
    this.activeExports = new Set();
  }

  /**
   * Export tree as HTML
   */
  exportHTML(tree, options = {}) {
    if (this.destroyed || !tree) {
      return this._createEmptyHTML(options.title);
    }

    const config = { ...this.options, ...options };
    
    try {
      const html = this._buildHTML(tree, config);
      return config.prettyPrint ? this._prettifyHTML(html) : this._minifyHTML(html);
    } catch (error) {
      if (config.onError) {
        config.onError(error);
      }
      return this._createEmptyHTML(config.title);
    }
  }

  /**
   * Export tree as JSON
   */
  exportJSON(tree, options = {}) {
    if (this.destroyed || !tree) {
      return JSON.stringify({ error: 'No content to export' });
    }

    const config = { ...this.options, ...options };
    
    try {
      const data = this._buildJSON(tree, config);
      const indent = config.prettyPrint ? config.indentSize : 0;
      return JSON.stringify(data, config.replacer || this._circularReplacer(), indent);
    } catch (error) {
      if (config.onError) {
        config.onError(error);
      }
      return JSON.stringify({ error: error.message });
    }
  }

  /**
   * Export tree as Markdown
   */
  exportMarkdown(tree, options = {}) {
    if (this.destroyed || !tree) {
      return '# No content to export';
    }

    const config = { ...this.options, ...options };
    
    try {
      return this._buildMarkdown(tree.root, config, 0);
    } catch (error) {
      if (config.onError) {
        config.onError(error);
      }
      return '# Export Error\n\n' + error.message;
    }
  }

  /**
   * Export tree as plain text
   */
  exportText(tree, options = {}) {
    if (this.destroyed || !tree) {
      return 'No content to export';
    }

    const config = { ...this.options, ...options };
    
    try {
      return this._buildText(tree.root, config, 0);
    } catch (error) {
      if (config.onError) {
        config.onError(error);
      }
      return 'Export Error: ' + error.message;
    }
  }

  /**
   * Stream HTML export for large trees
   */
  exportHTMLStream(tree, options = {}) {
    if (this.destroyed) return;

    const exportId = Date.now();
    this.activeExports.add(exportId);

    const config = { ...this.options, ...options };
    const chunks = [];

    // Start with document head
    chunks.push(this._createHTMLHead(config.title));

    // Process tree in chunks
    const processNode = (node, depth = 0) => {
      if (!this.activeExports.has(exportId)) return;

      const chunk = this._renderNodeHTML(node, config, depth);
      chunks.push(chunk);
      
      if (config.onChunk) {
        config.onChunk(chunk);
      }

      // Process children
      if (node.children && depth < config.maxDepth) {
        node.children.forEach(child => {
          setTimeout(() => processNode(child, depth + 1), 0);
        });
      }
    };

    // Start processing
    if (tree && tree.root) {
      processNode(tree.root);
    }

    // Complete export
    setTimeout(() => {
      if (this.activeExports.has(exportId)) {
        chunks.push(this._createHTMLFooter());
        this.activeExports.delete(exportId);
        
        if (config.onComplete) {
          config.onComplete();
        }
      }
    }, 100);
  }

  /**
   * Download HTML file
   */
  downloadHTML(tree, filename) {
    const html = this.exportHTML(tree);
    this._downloadFile(html, filename || this._generateFilename('html'), 'text/html');
  }

  /**
   * Download JSON file
   */
  downloadJSON(tree, filename) {
    const json = this.exportJSON(tree);
    this._downloadFile(json, filename || this._generateFilename('json'), 'application/json');
  }

  /**
   * Build HTML document
   * @private
   */
  _buildHTML(tree, config) {
    const parts = [
      this._createHTMLHead(config.title),
      '<body>',
      this._renderTreeHTML(tree, config),
      '</body>',
      '</html>'
    ];
    
    return parts.join('\n');
  }

  /**
   * Create HTML document head
   * @private
   */
  _createHTMLHead(title) {
    const parts = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      `<title>${title || 'Tree Export'}</title>`
    ];

    if (this.options.includeStyles) {
      parts.push(this._getDefaultStyles());
    }

    parts.push('</head>');
    return parts.join('\n');
  }

  /**
   * Create HTML footer
   * @private
   */
  _createHTMLFooter() {
    return '</body>\n</html>';
  }

  /**
   * Get default CSS styles
   * @private
   */
  _getDefaultStyles() {
    return `<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
  .tree-node { margin: 10px 0; padding: 10px; border-left: 3px solid #ddd; }
  .tree-node-level-0 { border-left-color: #007bff; }
  .tree-node-level-1 { margin-left: 20px; border-left-color: #28a745; }
  .tree-node-level-2 { margin-left: 40px; border-left-color: #ffc107; }
  .tree-node-level-3 { margin-left: 60px; border-left-color: #dc3545; }
  .tree-title { font-weight: bold; margin-bottom: 5px; }
  .tree-content { color: #333; line-height: 1.6; }
  pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
  code { background: #f0f0f0; padding: 2px 4px; border-radius: 2px; }
</style>`;
  }

  /**
   * Render tree as HTML
   * @private
   */
  _renderTreeHTML(tree, config) {
    if (!tree || !tree.root) {
      return '<div class="empty">No content to export</div>';
    }

    const cssClasses = config.cssClasses || {};
    const rootClass = cssClasses.root || 'tree-root';
    
    // If filtering by type and root doesn't match, render children directly
    if (config.filterTypes && !config.filterTypes.includes(tree.root.type)) {
      const childrenHtml = [];
      if (tree.root.children) {
        tree.root.children.forEach(child => {
          const html = this._renderNodeHTML(child, config, 0);
          if (html) childrenHtml.push(html);
        });
      }
      return `<div class="${rootClass}">${childrenHtml.join('\n')}</div>`;
    }
    
    return `<div class="${rootClass}">${this._renderNodeHTML(tree.root, config, 0)}</div>`;
  }

  /**
   * Render node as HTML
   * @private
   */
  _renderNodeHTML(node, config, depth = 0) {
    if (!node) return '';

    // Apply filters - but still render children of selected nodes
    const isSelected = !config.selectedIds || config.selectedIds.includes(node.id);
    const hasSelectedChildren = config.selectedIds && node.children && 
      node.children.some(child => this._hasSelectedDescendant(child, config.selectedIds));
    
    if (config.selectedIds && !isSelected && !hasSelectedChildren) {
      return '';
    }

    if (config.filterTypes && !config.filterTypes.includes(node.type)) {
      return '';
    }

    if (depth > config.maxDepth) {
      return '';
    }

    if (config.excludeEmpty && !node.content) {
      return '';
    }

    // Apply transformer
    let processedNode = node;
    if (config.transformer) {
      processedNode = config.transformer(node);
    }

    // Only render this node if it's selected (when filtering)
    if (config.selectedIds && !isSelected) {
      // Just render children if they have selected descendants
      if (hasSelectedChildren && processedNode.children) {
        const childParts = [];
        processedNode.children.forEach(child => {
          const childHtml = this._renderNodeHTML(child, config, depth);
          if (childHtml) childParts.push(childHtml);
        });
        return childParts.join('\n');
      }
      return '';
    }

    // Build node HTML
    const cssClasses = config.cssClasses || {};
    const nodeClass = cssClasses.node || 'tree-node';
    const attributes = [];

    attributes.push(`class="${nodeClass} tree-node-level-${depth}"`);

    if (config.includeMetadata) {
      attributes.push(`data-node-id="${processedNode.id}"`);
      attributes.push(`data-node-type="${processedNode.type}"`);
    }

    const parts = [
      `<div ${attributes.join(' ')}>`,
      `<div class="tree-title">${this._escapeHTML(processedNode.title || 'Untitled')}</div>`,
      `<div class="tree-content">${this._renderContent(processedNode, config)}</div>`
    ];

    // Render children
    if (processedNode.children && processedNode.children.length > 0) {
      parts.push('<div class="tree-children">');
      processedNode.children.forEach(child => {
        const childHtml = this._renderNodeHTML(child, config, depth + 1);
        if (childHtml) parts.push(childHtml);
      });
      parts.push('</div>');
    }

    parts.push('</div>');
    return parts.join('\n');
  }

  /**
   * Render node content based on type
   * @private
   */
  _renderContent(node, config) {
    const renderers = config.renderers || {};
    
    try {
      if (renderers[node.type]) {
        return renderers[node.type](node.content);
      }

      switch (node.type) {
        case 'markdown':
          return this._renderMarkdown(node.content);
        
        case 'yaml':
          return `<pre class="yaml"><code>${this._escapeHTML(this._yamlToString(node.content))}</code></pre>`;
        
        case 'plaintext':
        default:
          return this._escapeHTML(node.content || '');
      }
    } catch (error) {
      return this._escapeHTML(String(node.content || ''));
    }
  }

  /**
   * Render markdown content
   * @private
   */
  _renderMarkdown(content) {
    // Simple markdown rendering
    let html = this._escapeHTML(content);
    
    // Headers
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    
    // Code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    
    return html;
  }

  /**
   * Convert YAML object to string
   * @private
   */
  _yamlToString(obj) {
    if (typeof obj === 'string') return obj;
    
    const lines = [];
    const stringify = (value, indent = '') => {
      if (Array.isArray(value)) {
        value.forEach(item => {
          lines.push(`${indent}- ${item}`);
        });
      } else if (typeof value === 'object' && value !== null) {
        Object.entries(value).forEach(([key, val]) => {
          lines.push(`${indent}${key}:`);
          if (typeof val === 'object') {
            stringify(val, indent + '  ');
          } else {
            lines.push(`${indent}  ${val}`);
          }
        });
      } else {
        lines.push(`${indent}${value}`);
      }
    };
    
    stringify(obj);
    return lines.join('\n');
  }

  /**
   * Build JSON structure
   * @private
   */
  _buildJSON(tree, config) {
    const data = {};

    if (config.selectedIds) {
      // Export selected nodes only
      data.nodes = [];
      config.selectedIds.forEach(id => {
        const node = tree.getNodeById ? tree.getNodeById(id) : null;
        if (node) {
          data.nodes.push(this._nodeToJSON(node));
        }
      });
    } else {
      // Export full tree
      data.root = tree.root ? this._nodeToJSON(tree.root) : null;
    }

    if (config.includeMetadata) {
      data.metadata = {
        exportDate: new Date().toISOString(),
        version: '1.0.0',
        nodeCount: this._countNodes(tree.root)
      };
    }

    if (config.includeStats) {
      data.statistics = this._gatherStatistics(tree.root);
    }

    return data;
  }

  /**
   * Convert node to JSON
   * @private
   */
  _nodeToJSON(node) {
    if (!node) return null;

    const json = {
      id: node.id,
      title: node.title,
      content: node.content,
      type: node.type
    };

    if (node.children && node.children.length > 0) {
      json.children = node.children.map(child => this._nodeToJSON(child));
    }

    return json;
  }

  /**
   * Build markdown representation
   * @private
   */
  _buildMarkdown(node, config, depth = 0) {
    if (!node || depth > config.maxDepth) return '';

    const parts = [];
    const prefix = '#'.repeat(Math.min(depth + 1, 6));
    
    parts.push(`${prefix} ${node.title || 'Untitled'}`);
    parts.push('');

    if (node.content) {
      switch (node.type) {
        case 'markdown':
          parts.push(node.content);
          break;
        
        case 'yaml':
          parts.push('```yaml');
          parts.push(this._yamlToString(node.content));
          parts.push('```');
          break;
        
        default:
          parts.push(node.content);
      }
      parts.push('');
    }

    if (node.children) {
      node.children.forEach(child => {
        parts.push(this._buildMarkdown(child, config, depth + 1));
      });
    }

    return parts.join('\n');
  }

  /**
   * Build text representation
   * @private
   */
  _buildText(node, config, depth = 0) {
    if (!node || depth > config.maxDepth) return '';

    const parts = [];
    const indent = '  '.repeat(depth);
    
    parts.push(`${indent}${node.title || 'Untitled'}`);

    if (node.content) {
      const content = this._stripHTML(String(node.content));
      const lines = content.split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          parts.push(`${indent}  ${line}`);
        }
      });
    }

    if (node.children) {
      node.children.forEach(child => {
        parts.push(this._buildText(child, config, depth + 1));
      });
    }

    return parts.join('\n');
  }

  /**
   * Create empty HTML document
   * @private
   */
  _createEmptyHTML(title) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title || 'Tree Export'}</title>
</head>
<body>
  <div class="empty">No content to export</div>
</body>
</html>`;
  }

  /**
   * Escape HTML characters
   * @private
   */
  _escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Strip HTML tags
   * @private
   */
  _stripHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
  }

  /**
   * Prettify HTML
   * @private
   */
  _prettifyHTML(html) {
    // Simple prettifier
    return html
      .replace(/></g, '>\n<')
      .replace(/(<[^\/][^>]*>)\n/g, '$1\n  ')
      .trim();
  }

  /**
   * Minify HTML
   * @private
   */
  _minifyHTML(html) {
    return html
      .replace(/\n\s*/g, '')
      .replace(/>\s+</g, '><')
      .trim();
  }

  /**
   * Count nodes in tree
   * @private
   */
  _countNodes(node) {
    if (!node) return 0;
    
    let count = 1;
    if (node.children) {
      node.children.forEach(child => {
        count += this._countNodes(child);
      });
    }
    
    return count;
  }

  /**
   * Gather statistics
   * @private
   */
  _gatherStatistics(node) {
    const stats = {
      totalNodes: 0,
      nodesByType: {},
      maxDepth: 0
    };

    const traverse = (n, depth = 0) => {
      if (!n) return;
      
      stats.totalNodes++;
      stats.nodesByType[n.type] = (stats.nodesByType[n.type] || 0) + 1;
      stats.maxDepth = Math.max(stats.maxDepth, depth);

      if (n.children) {
        n.children.forEach(child => traverse(child, depth + 1));
      }
    };

    traverse(node);
    return stats;
  }

  /**
   * Circular reference replacer
   * @private
   */
  _circularReplacer() {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    };
  }

  /**
   * Download file
   * @private
   */
  _downloadFile(content, filename, mimeType) {
    // In jsdom environment, use data URL instead of blob
    if (typeof URL.createObjectURL !== 'function') {
      const link = document.createElement('a');
      link.href = `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Generate default filename
   * @private
   */
  _generateFilename(extension) {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    return `tree-export-${dateStr}.${extension}`;
  }

  /**
   * Check if node has selected descendant
   * @private
   */
  _hasSelectedDescendant(node, selectedIds) {
    if (selectedIds.includes(node.id)) return true;
    
    if (node.children) {
      return node.children.some(child => this._hasSelectedDescendant(child, selectedIds));
    }
    
    return false;
  }

  /**
   * Destroy manager
   */
  destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    
    // Cancel active exports
    this.activeExports.clear();
  }
}