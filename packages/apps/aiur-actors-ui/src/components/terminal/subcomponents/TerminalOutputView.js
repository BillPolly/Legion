/**
 * TerminalOutputView - Output subcomponent for terminal
 * Handles output display, scrolling, and line management
 */
import { BaseView } from '../../base/BaseView.js';

export class TerminalOutputView extends BaseView {
  constructor(container) {
    super();
    this.container = container;
    
    // Elements
    this.outputElement = null;
    
    // State
    this.maxLines = 10000;
    this.autoScroll = true;
    this.lines = [];
    this.lineIdCounter = 0;
  }

  /**
   * Render the output component
   * @param {Object} options - Render options
   */
  render(options = {}) {
    // Clear container
    this.container.innerHTML = '';
    
    // Create output area
    this.outputElement = this.createElement('div', ['terminal-output']);
    
    // Apply theme
    if (options.theme) {
      this.outputElement.classList.add(`terminal-output-theme-${options.theme}`);
    }
    
    // Set max lines
    if (options.maxLines) {
      this.maxLines = options.maxLines;
    }
    
    // Add to container
    this.container.appendChild(this.outputElement);
    
    // Bind events
    this.bindEvents();
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // Scroll event to manage auto-scroll
    this.addTrackedListener(this.outputElement, 'scroll', () => {
      this.checkAutoScroll();
    });
    
    // Mouse wheel to temporarily disable auto-scroll
    this.addTrackedListener(this.outputElement, 'wheel', (e) => {
      if (e.deltaY < 0) {
        // Scrolling up - disable auto-scroll temporarily
        this.autoScroll = false;
        
        // Re-enable auto-scroll after a delay if at bottom
        clearTimeout(this.autoScrollTimeout);
        this.autoScrollTimeout = setTimeout(() => {
          this.checkAutoScroll();
        }, 1000);
      }
    });
  }

  /**
   * Check if we should auto-scroll
   */
  checkAutoScroll() {
    if (!this.outputElement) return;
    
    const { scrollTop, scrollHeight, clientHeight } = this.outputElement;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px tolerance
    
    this.autoScroll = isAtBottom;
  }

  /**
   * Add output line
   * @param {Object} output - Output object
   */
  addOutput(output) {
    // Create output object with ID
    const outputLine = {
      id: output.id || `line_${++this.lineIdCounter}`,
      content: output.content || '',
      type: output.type || 'info',
      timestamp: output.timestamp || new Date(),
      metadata: output.metadata || {}
    };
    
    // Add to lines array
    this.lines.push(outputLine);
    
    // Enforce max lines
    if (this.lines.length > this.maxLines) {
      const removed = this.lines.shift();
      // Remove from DOM
      const removedElement = this.outputElement.querySelector(`[data-line-id="${removed.id}"]`);
      if (removedElement) {
        removedElement.remove();
      }
    }
    
    // Create and append DOM element
    const lineElement = this.createOutputLine(outputLine);
    this.outputElement.appendChild(lineElement);
    
    // Auto-scroll if enabled
    if (this.autoScroll) {
      this.scrollToBottom();
    }
    
    return outputLine.id;
  }

  /**
   * Add multiple output lines
   * @param {Array} outputs - Array of output objects
   */
  addOutputs(outputs) {
    outputs.forEach(output => this.addOutput(output));
  }

  /**
   * Create output line element
   * @param {Object} outputLine - Output line object
   * @returns {HTMLElement} Line element
   */
  createOutputLine(outputLine) {
    const lineElement = this.createElement('div', [
      'terminal-output-line',
      `terminal-output-line-${outputLine.type}`
    ]);
    
    lineElement.setAttribute('data-line-id', outputLine.id);
    lineElement.setAttribute('data-type', outputLine.type);
    
    // Handle different content types
    if (typeof outputLine.content === 'object') {
      this.renderObjectContent(lineElement, outputLine.content, outputLine.type);
    } else {
      this.renderTextContent(lineElement, outputLine.content, outputLine.type);
    }
    
    // Add timestamp if needed
    if (outputLine.metadata.showTimestamp) {
      this.addTimestamp(lineElement, outputLine.timestamp);
    }
    
    return lineElement;
  }

  /**
   * Render text content
   * @param {HTMLElement} element - Line element
   * @param {string} content - Text content
   * @param {string} type - Line type
   */
  renderTextContent(element, content, type) {
    if (type === 'result' && this.isJsonString(content)) {
      // Pretty print JSON results
      try {
        const parsed = JSON.parse(content);
        const pre = this.createElement('pre', ['json-content']);
        pre.textContent = JSON.stringify(parsed, null, 2);
        element.appendChild(pre);
      } catch {
        element.textContent = content;
      }
    } else {
      // Regular text content
      element.textContent = content;
    }
  }

  /**
   * Render object content
   * @param {HTMLElement} element - Line element
   * @param {Object} content - Object content
   * @param {string} type - Line type
   */
  renderObjectContent(element, content, type) {
    if (content.html) {
      // HTML content (be careful with security)
      element.innerHTML = content.html;
    } else if (content.json) {
      // JSON content
      const pre = this.createElement('pre', ['json-content']);
      pre.textContent = JSON.stringify(content.json, null, 2);
      element.appendChild(pre);
    } else if (content.table) {
      // Table content
      this.renderTable(element, content.table);
    } else {
      // Fallback to string representation
      element.textContent = JSON.stringify(content);
    }
  }

  /**
   * Render table content
   * @param {HTMLElement} element - Line element
   * @param {Object} tableData - Table data
   */
  renderTable(element, tableData) {
    const table = this.createElement('table', ['output-table']);
    
    // Headers
    if (tableData.headers) {
      const thead = this.createElement('thead');
      const headerRow = this.createElement('tr');
      
      tableData.headers.forEach(header => {
        const th = this.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
      });
      
      thead.appendChild(headerRow);
      table.appendChild(thead);
    }
    
    // Body
    if (tableData.rows) {
      const tbody = this.createElement('tbody');
      
      tableData.rows.forEach(row => {
        const tr = this.createElement('tr');
        
        row.forEach(cell => {
          const td = this.createElement('td');
          td.textContent = cell;
          tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
      });
      
      table.appendChild(tbody);
    }
    
    element.appendChild(table);
  }

  /**
   * Add timestamp to line
   * @param {HTMLElement} element - Line element
   * @param {Date} timestamp - Timestamp
   */
  addTimestamp(element, timestamp) {
    const timeElement = this.createElement('span', ['line-timestamp']);
    timeElement.textContent = timestamp.toLocaleTimeString();
    element.appendChild(timeElement);
  }

  /**
   * Clear all output
   */
  clear() {
    this.outputElement.innerHTML = '';
    this.lines = [];
    this.lineIdCounter = 0;
  }

  /**
   * Remove specific line
   * @param {string} lineId - Line ID to remove
   */
  removeLine(lineId) {
    // Remove from lines array
    this.lines = this.lines.filter(line => line.id !== lineId);
    
    // Remove from DOM
    const element = this.outputElement.querySelector(`[data-line-id="${lineId}"]`);
    if (element) {
      element.remove();
    }
  }

  /**
   * Update existing line
   * @param {string} lineId - Line ID to update
   * @param {Object} updates - Updates to apply
   */
  updateLine(lineId, updates) {
    // Update in lines array
    const lineIndex = this.lines.findIndex(line => line.id === lineId);
    if (lineIndex >= 0) {
      Object.assign(this.lines[lineIndex], updates);
      
      // Update DOM element
      const element = this.outputElement.querySelector(`[data-line-id="${lineId}"]`);
      if (element) {
        // Recreate the line element with updates
        const newElement = this.createOutputLine(this.lines[lineIndex]);
        element.replaceWith(newElement);
      }
    }
  }

  /**
   * Scroll to bottom
   */
  scrollToBottom() {
    if (this.outputElement) {
      this.outputElement.scrollTop = this.outputElement.scrollHeight;
    }
  }

  /**
   * Scroll to top
   */
  scrollToTop() {
    if (this.outputElement) {
      this.outputElement.scrollTop = 0;
    }
  }

  /**
   * Scroll to specific line
   * @param {string} lineId - Line ID to scroll to
   */
  scrollToLine(lineId) {
    const element = this.outputElement.querySelector(`[data-line-id="${lineId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Get all lines
   * @returns {Array} Array of line objects
   */
  getLines() {
    return [...this.lines];
  }

  /**
   * Find lines by type
   * @param {string} type - Line type
   * @returns {Array} Matching lines
   */
  findLinesByType(type) {
    return this.lines.filter(line => line.type === type);
  }

  /**
   * Search lines by content
   * @param {string} query - Search query
   * @returns {Array} Matching lines
   */
  searchLines(query) {
    const lowerQuery = query.toLowerCase();
    return this.lines.filter(line => 
      line.content.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Set auto-scroll behavior
   * @param {boolean} enabled - Whether to enable auto-scroll
   */
  setAutoScroll(enabled) {
    this.autoScroll = enabled;
  }

  /**
   * Set maximum number of lines
   * @param {number} maxLines - Maximum lines
   */
  setMaxLines(maxLines) {
    this.maxLines = maxLines;
    
    // Trim existing lines if needed
    if (this.lines.length > maxLines) {
      const toRemove = this.lines.length - maxLines;
      const removedLines = this.lines.splice(0, toRemove);
      
      // Remove from DOM
      removedLines.forEach(line => {
        const element = this.outputElement.querySelector(`[data-line-id="${line.id}"]`);
        if (element) {
          element.remove();
        }
      });
    }
  }

  /**
   * Check if string is valid JSON
   * @param {string} str - String to check
   * @returns {boolean} True if valid JSON
   */
  isJsonString(str) {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create DOM element with classes
   * @param {string} tag - Element tag
   * @param {Array} classes - CSS classes
   * @returns {HTMLElement} Created element
   */
  createElement(tag, classes = []) {
    const element = document.createElement(tag);
    if (classes.length > 0) {
      element.classList.add(...classes);
    }
    return element;
  }

  /**
   * Clean up
   */
  destroy() {
    // Clear timeouts
    if (this.autoScrollTimeout) {
      clearTimeout(this.autoScrollTimeout);
    }
    
    // Clear state
    this.lines = [];
    
    super.destroy();
  }
}