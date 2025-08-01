/**
 * TreeScribe Custom Renderer Plugin Example
 * 
 * This example demonstrates how to create custom content renderers
 * for specialized content types in TreeScribe.
 */

/**
 * Code Syntax Highlighter Renderer
 * Renders code blocks with syntax highlighting and features
 */
export class CodeHighlightRenderer {
  getName() {
    return 'code-highlight';
  }

  getVersion() {
    return '1.0.0';
  }

  getSupportedTypes() {
    return ['code', 'javascript', 'python', 'java', 'css', 'html', 'json', 'sql'];
  }

  render(content, container, options = {}) {
    const codeElement = document.createElement('div');
    codeElement.className = 'code-highlight-container';
    
    // Extract language and code
    const language = options.language || this._detectLanguage(content);
    const code = typeof content === 'object' ? content.code : content;
    
    // Create header with language and copy button
    const header = this._createHeader(language, code);
    codeElement.appendChild(header);
    
    // Create code block
    const pre = document.createElement('pre');
    pre.className = `language-${language}`;
    
    const codeBlock = document.createElement('code');
    codeBlock.className = `language-${language}`;
    codeBlock.textContent = code;
    
    pre.appendChild(codeBlock);
    codeElement.appendChild(pre);
    
    // Apply syntax highlighting
    this._applySyntaxHighlighting(codeBlock, language);
    
    // Add line numbers if requested
    if (options.showLineNumbers !== false) {
      this._addLineNumbers(pre);
    }
    
    container.appendChild(codeElement);
    return codeElement;
  }

  _createHeader(language, code) {
    const header = document.createElement('div');
    header.className = 'code-header';
    
    const languageLabel = document.createElement('span');
    languageLabel.className = 'language-label';
    languageLabel.textContent = language.toUpperCase();
    
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.textContent = 'Copy';
    copyButton.onclick = () => this._copyCode(code, copyButton);
    
    header.appendChild(languageLabel);
    header.appendChild(copyButton);
    
    return header;
  }

  _detectLanguage(content) {
    if (typeof content === 'object' && content.language) {
      return content.language;
    }
    
    // Simple language detection based on content patterns
    const codeStr = typeof content === 'object' ? content.code : content;
    
    if (codeStr.includes('function ') || codeStr.includes('const ') || codeStr.includes('=>')) {
      return 'javascript';
    }
    if (codeStr.includes('def ') || codeStr.includes('import ') || codeStr.includes('class ')) {
      return 'python';
    }
    if (codeStr.includes('public class') || codeStr.includes('private ') || codeStr.includes('package ')) {
      return 'java';
    }
    if (codeStr.includes('SELECT') || codeStr.includes('FROM') || codeStr.includes('WHERE')) {
      return 'sql';
    }
    if (codeStr.startsWith('<') && codeStr.includes('>')) {
      return 'html';
    }
    if (codeStr.includes('{') && codeStr.includes('}') && codeStr.includes(':')) {
      try {
        JSON.parse(codeStr);
        return 'json';
      } catch (e) {
        return 'css';
      }
    }
    
    return 'text';
  }

  _applySyntaxHighlighting(codeElement, language) {
    // This is a simplified syntax highlighter
    // In a real implementation, you'd use a library like Prism.js or highlight.js
    
    const keywords = this._getKeywords(language);
    const strings = this._getStringPatterns();
    const comments = this._getCommentPatterns(language);
    
    let html = codeElement.textContent;
    
    // Highlight strings first (to avoid highlighting keywords inside strings)
    strings.forEach(pattern => {
      html = html.replace(pattern.regex, `<span class="string">${pattern.replacement}</span>`);
    });
    
    // Highlight comments
    comments.forEach(pattern => {
      html = html.replace(pattern.regex, `<span class="comment">${pattern.replacement}</span>`);
    });
    
    // Highlight keywords
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      html = html.replace(regex, `<span class="keyword">${keyword}</span>`);
    });
    
    // Highlight numbers
    html = html.replace(/\b\d+(\.\d+)?\b/g, '<span class="number">$&</span>');
    
    codeElement.innerHTML = html;
  }

  _getKeywords(language) {
    const keywordMap = {
      javascript: ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class', 'extends', 'import', 'export', 'async', 'await'],
      python: ['def', 'class', 'if', 'else', 'elif', 'for', 'while', 'return', 'import', 'from', 'as', 'try', 'except', 'finally'],
      java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'if', 'else', 'for', 'while', 'return', 'import', 'package'],
      sql: ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'INDEX'],
      css: ['color', 'background', 'margin', 'padding', 'border', 'width', 'height', 'display', 'position', 'flex']
    };
    
    return keywordMap[language] || [];
  }

  _getStringPatterns() {
    return [
      { regex: /"([^"\\]|\\.)*"/g, replacement: '$&' },
      { regex: /'([^'\\]|\\.)*'/g, replacement: '$&' },
      { regex: /`([^`\\]|\\.)*`/g, replacement: '$&' }
    ];
  }

  _getCommentPatterns(language) {
    const commentMap = {
      javascript: [
        { regex: /\/\/.*$/gm, replacement: '$&' },
        { regex: /\/\*[\s\S]*?\*\//g, replacement: '$&' }
      ],
      python: [
        { regex: /#.*$/gm, replacement: '$&' }
      ],
      java: [
        { regex: /\/\/.*$/gm, replacement: '$&' },
        { regex: /\/\*[\s\S]*?\*\//g, replacement: '$&' }
      ],
      css: [
        { regex: /\/\*[\s\S]*?\*\//g, replacement: '$&' }
      ],
      sql: [
        { regex: /--.*$/gm, replacement: '$&' }
      ]
    };
    
    return commentMap[language] || [];
  }

  _addLineNumbers(preElement) {
    const lines = preElement.textContent.split('\n');
    const lineNumbersDiv = document.createElement('div');
    lineNumbersDiv.className = 'line-numbers';
    
    lines.forEach((_, index) => {
      const lineNumber = document.createElement('span');
      lineNumber.textContent = (index + 1).toString();
      lineNumbersDiv.appendChild(lineNumber);
    });
    
    preElement.parentNode.insertBefore(lineNumbersDiv, preElement);
    preElement.parentNode.classList.add('has-line-numbers');
  }

  async _copyCode(code, button) {
    try {
      await navigator.clipboard.writeText(code);
      button.textContent = 'Copied!';
      button.classList.add('copied');
      
      setTimeout(() => {
        button.textContent = 'Copy';
        button.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
      button.textContent = 'Copy failed';
      setTimeout(() => {
        button.textContent = 'Copy';
      }, 2000);
    }
  }

  destroy() {
    // Cleanup if needed
  }
}

/**
 * Data Visualization Renderer
 * Renders data as charts and graphs
 */
export class DataVisualizationRenderer {
  getName() {
    return 'data-visualization';
  }

  getVersion() {
    return '1.0.0';
  }

  getSupportedTypes() {
    return ['chart', 'graph', 'visualization', 'data-viz'];
  }

  render(content, container, options = {}) {
    const vizContainer = document.createElement('div');
    vizContainer.className = 'data-visualization-container';
    
    const data = typeof content === 'string' ? JSON.parse(content) : content;
    const chartType = data.type || options.type || 'bar';
    
    // Create title if provided
    if (data.title) {
      const title = document.createElement('h4');
      title.className = 'viz-title';
      title.textContent = data.title;
      vizContainer.appendChild(title);
    }
    
    // Create the chart
    const chartElement = this._createChart(data, chartType);
    vizContainer.appendChild(chartElement);
    
    // Add legend if needed
    if (data.legend) {
      const legend = this._createLegend(data.legend);
      vizContainer.appendChild(legend);
    }
    
    container.appendChild(vizContainer);
    return vizContainer;
  }

  _createChart(data, type) {
    const canvas = document.createElement('canvas');
    canvas.width = data.width || 400;
    canvas.height = data.height || 300;
    
    const ctx = canvas.getContext('2d');
    
    switch (type) {
      case 'bar':
        this._drawBarChart(ctx, data, canvas.width, canvas.height);
        break;
      case 'line':
        this._drawLineChart(ctx, data, canvas.width, canvas.height);
        break;
      case 'pie':
        this._drawPieChart(ctx, data, canvas.width, canvas.height);
        break;
      default:
        this._drawBarChart(ctx, data, canvas.width, canvas.height);
    }
    
    return canvas;
  }

  _drawBarChart(ctx, data, width, height) {
    const margin = 40;
    const chartWidth = width - 2 * margin;
    const chartHeight = height - 2 * margin;
    
    const maxValue = Math.max(...data.values);
    const barWidth = chartWidth / data.values.length;
    
    // Draw axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // Draw bars
    data.values.forEach((value, index) => {
      const barHeight = (value / maxValue) * chartHeight;
      const x = margin + index * barWidth + barWidth * 0.1;
      const y = height - margin - barHeight;
      const w = barWidth * 0.8;
      
      ctx.fillStyle = data.colors ? data.colors[index] : `hsl(${index * 360 / data.values.length}, 70%, 50%)`;
      ctx.fillRect(x, y, w, barHeight);
      
      // Draw labels
      if (data.labels && data.labels[index]) {
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(data.labels[index], x + w / 2, height - margin + 20);
      }
      
      // Draw values
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(value.toString(), x + w / 2, y - 5);
    });
  }

  _drawLineChart(ctx, data, width, height) {
    const margin = 40;
    const chartWidth = width - 2 * margin;
    const chartHeight = height - 2 * margin;
    
    const maxValue = Math.max(...data.values);
    const minValue = Math.min(...data.values);
    const valueRange = maxValue - minValue;
    
    // Draw axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // Draw line
    ctx.strokeStyle = data.color || '#007bff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    data.values.forEach((value, index) => {
      const x = margin + (index / (data.values.length - 1)) * chartWidth;
      const y = height - margin - ((value - minValue) / valueRange) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Draw points
    ctx.fillStyle = data.color || '#007bff';
    data.values.forEach((value, index) => {
      const x = margin + (index / (data.values.length - 1)) * chartWidth;
      const y = height - margin - ((value - minValue) / valueRange) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  _drawPieChart(ctx, data, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;
    
    const total = data.values.reduce((sum, value) => sum + value, 0);
    let currentAngle = -Math.PI / 2;
    
    data.values.forEach((value, index) => {
      const sliceAngle = (value / total) * 2 * Math.PI;
      
      ctx.fillStyle = data.colors ? data.colors[index] : `hsl(${index * 360 / data.values.length}, 70%, 50%)`;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();
      
      // Draw labels
      if (data.labels && data.labels[index]) {
        const labelAngle = currentAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
        const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
        
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(data.labels[index], labelX, labelY);
      }
      
      currentAngle += sliceAngle;
    });
  }

  _createLegend(legendData) {
    const legend = document.createElement('div');
    legend.className = 'viz-legend';
    
    legendData.forEach((item, index) => {
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      
      const colorBox = document.createElement('div');
      colorBox.className = 'legend-color';
      colorBox.style.backgroundColor = item.color || `hsl(${index * 360 / legendData.length}, 70%, 50%)`;
      
      const label = document.createElement('span');
      label.textContent = item.label;
      
      legendItem.appendChild(colorBox);
      legendItem.appendChild(label);
      legend.appendChild(legendItem);
    });
    
    return legend;
  }

  destroy() {
    // Cleanup if needed
  }
}

/**
 * Interactive Table Renderer
 * Renders data as sortable, filterable tables
 */
export class InteractiveTableRenderer {
  getName() {
    return 'interactive-table';
  }

  getVersion() {
    return '1.0.0';
  }

  getSupportedTypes() {
    return ['table', 'datatable', 'grid'];
  }

  render(content, container, options = {}) {
    const data = typeof content === 'string' ? JSON.parse(content) : content;
    
    const tableContainer = document.createElement('div');
    tableContainer.className = 'interactive-table-container';
    
    // Create controls
    if (options.showControls !== false) {
      const controls = this._createControls(data, tableContainer);
      tableContainer.appendChild(controls);
    }
    
    // Create table
    const table = this._createTable(data);
    tableContainer.appendChild(table);
    
    // Add interactivity
    this._addInteractivity(table, data);
    
    container.appendChild(tableContainer);
    return tableContainer;
  }

  _createControls(data, container) {
    const controls = document.createElement('div');
    controls.className = 'table-controls';
    
    // Search box
    const searchBox = document.createElement('input');
    searchBox.type = 'text';
    searchBox.placeholder = 'Search...';
    searchBox.className = 'table-search';
    
    // Rows per page selector
    const pageSizeSelect = document.createElement('select');
    pageSizeSelect.className = 'page-size-select';
    [10, 25, 50, 100].forEach(size => {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = `${size} rows`;
      pageSizeSelect.appendChild(option);
    });
    
    controls.appendChild(searchBox);
    controls.appendChild(pageSizeSelect);
    
    return controls;
  }

  _createTable(data) {
    const table = document.createElement('table');
    table.className = 'interactive-table';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    data.columns.forEach(column => {
      const th = document.createElement('th');
      th.textContent = column.title || column.field;
      th.dataset.field = column.field;
      th.className = 'sortable';
      
      // Add sort indicator
      const sortIndicator = document.createElement('span');
      sortIndicator.className = 'sort-indicator';
      th.appendChild(sortIndicator);
      
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    
    data.rows.forEach(row => {
      const tr = document.createElement('tr');
      
      data.columns.forEach(column => {
        const td = document.createElement('td');
        const value = row[column.field];
        
        if (column.render) {
          td.innerHTML = column.render(value, row);
        } else {
          td.textContent = value || '';
        }
        
        tr.appendChild(td);
      });
      
      tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    
    return table;
  }

  _addInteractivity(table, data) {
    let sortColumn = null;
    let sortDirection = 'asc';
    
    // Add sorting
    const headers = table.querySelectorAll('th.sortable');
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const field = header.dataset.field;
        
        if (sortColumn === field) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = field;
          sortDirection = 'asc';
        }
        
        this._sortTable(table, data, sortColumn, sortDirection);
        this._updateSortIndicators(headers, header, sortDirection);
      });
    });
    
    // Add search functionality
    const searchBox = table.parentNode.querySelector('.table-search');
    if (searchBox) {
      searchBox.addEventListener('input', (e) => {
        this._filterTable(table, e.target.value);
      });
    }
  }

  _sortTable(table, data, column, direction) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    rows.sort((a, b) => {
      const aValue = this._getCellValue(a, column, data);
      const bValue = this._getCellValue(b, column, data);
      
      let comparison = 0;
      if (aValue > bValue) comparison = 1;
      if (aValue < bValue) comparison = -1;
      
      return direction === 'desc' ? -comparison : comparison;
    });
    
    rows.forEach(row => tbody.appendChild(row));
  }

  _getCellValue(row, column, data) {
    const columnIndex = data.columns.findIndex(col => col.field === column);
    const cell = row.cells[columnIndex];
    return cell.textContent.trim();
  }

  _updateSortIndicators(headers, activeHeader, direction) {
    headers.forEach(header => {
      const indicator = header.querySelector('.sort-indicator');
      indicator.textContent = '';
      header.classList.remove('sorted-asc', 'sorted-desc');
    });
    
    const activeIndicator = activeHeader.querySelector('.sort-indicator');
    activeIndicator.textContent = direction === 'asc' ? '↑' : '↓';
    activeHeader.classList.add(`sorted-${direction}`);
  }

  _filterTable(table, searchTerm) {
    const tbody = table.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const matches = text.includes(searchTerm.toLowerCase());
      row.style.display = matches ? '' : 'none';
    });
  }

  destroy() {
    // Cleanup event listeners if needed
  }
}

// Usage example:
/*
import { TreeScribe } from './path/to/treescribe/index.js';
import { CodeHighlightRenderer, DataVisualizationRenderer, InteractiveTableRenderer } from './custom-renderer-plugin.js';

const treeScribe = TreeScribe.create({
  dom: document.getElementById('tree-container'),
  renderers: {
    'code-highlight': new CodeHighlightRenderer(),
    'data-visualization': new DataVisualizationRenderer(),
    'interactive-table': new InteractiveTableRenderer()
  }
});

// Load YAML with custom content types
const yamlWithCustomContent = `
title: Custom Renderer Demo
children:
  - title: Code Example
    content:
      language: javascript
      code: |
        function fibonacci(n) {
          if (n <= 1) return n;
          return fibonacci(n - 1) + fibonacci(n - 2);
        }
    type: code-highlight
    
  - title: Sales Data
    content:
      type: bar
      title: Quarterly Sales
      values: [120, 150, 180, 220]
      labels: ["Q1", "Q2", "Q3", "Q4"]
      colors: ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4"]
    type: data-visualization
    
  - title: Employee Data
    content:
      columns:
        - { field: "name", title: "Name" }
        - { field: "department", title: "Department" }
        - { field: "salary", title: "Salary" }
      rows:
        - { name: "John Doe", department: "Engineering", salary: "$75,000" }
        - { name: "Jane Smith", department: "Marketing", salary: "$65,000" }
        - { name: "Bob Johnson", department: "Sales", salary: "$70,000" }
    type: interactive-table
`;

await treeScribe.loadYaml(yamlWithCustomContent);
*/