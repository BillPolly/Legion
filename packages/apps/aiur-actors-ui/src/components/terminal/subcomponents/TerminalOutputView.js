/**
 * TerminalOutputView - Output subcomponent for terminal
 * Manages its own DOM completely with persistent references
 */
import { BaseView } from '../../base/BaseView.js';

export class TerminalOutputView extends BaseView {
  constructor(container) {
    super();
    this.container = container;
    
    // DOM element references - create once, update many
    this.elements = {
      output: null,
      lines: new Map() // lineId -> DOM element mapping
    };
    
    // State
    this.maxLines = 10000;
    this.autoScroll = true;
    this.lineIdCounter = 0;
    this.linesData = []; // Array of line data
    
    this.initialized = false;
  }

  /**
   * Render the output component - creates DOM once, updates on subsequent calls
   */
  render(options = {}) {
    if (!this.initialized) {
      this.createDOMStructure();
      this.bindEvents();
      this.initialized = true;
    }
    
    // Update with options
    this.update(options);
    
    return this.elements.output;
  }
  
  /**
   * Create DOM structure - ONLY CALLED ONCE
   */
  createDOMStructure() {
    // Create output scrollable area
    this.elements.output = document.createElement('div');
    this.elements.output.className = 'terminal-output';
    
    // Add to container
    this.container.appendChild(this.elements.output);
  }
  
  /**
   * Update existing DOM - called multiple times
   */
  update(options = {}) {
    if (!this.elements.output) return;
    
    // Update theme
    if (options.theme) {
      // Remove old theme classes
      const classes = Array.from(this.elements.output.classList);
      classes.forEach(cls => {
        if (cls.startsWith('terminal-output-theme-')) {
          this.elements.output.classList.remove(cls);
        }
      });
      // Add new theme
      this.elements.output.classList.add(`terminal-output-theme-${options.theme}`);
    }
    
    // Update max lines
    if (options.maxLines !== undefined) {
      this.maxLines = options.maxLines;
      this.trimLines();
    }
  }
  
  /**
   * Bind event handlers - ONLY CALLED ONCE
   */
  bindEvents() {
    // Track scroll position for auto-scroll
    this.addTrackedListener(this.elements.output, 'scroll', () => {
      this.checkAutoScroll();
    });
    
    // Disable auto-scroll when user scrolls up
    this.addTrackedListener(this.elements.output, 'wheel', (e) => {
      if (e.deltaY < 0) {
        this.autoScroll = false;
        // Re-enable after delay if at bottom
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
    const output = this.elements.output;
    const isAtBottom = output.scrollTop + output.clientHeight >= output.scrollHeight - 10;
    this.autoScroll = isAtBottom;
  }

  /**
   * Add a line to the output
   */
  addLine(content, type = 'info') {
    console.log('🔵 TerminalOutputView.addLine() called:', { content, type });
    
    const lineId = `line_${++this.lineIdCounter}`;
    
    // Create line data
    const lineData = {
      id: lineId,
      content: content,
      type: type,
      timestamp: new Date()
    };
    
    // Add to data array
    this.linesData.push(lineData);
    
    // Create DOM element
    const lineElement = this.createLineElement(lineData);
    console.log('📄 Created line element:', lineElement);
    
    // Store reference
    this.elements.lines.set(lineId, lineElement);
    
    // Add to DOM
    console.log('➕ Appending to output container:', this.elements.output);
    this.elements.output.appendChild(lineElement);
    
    // Check where it was added
    const outputRect = this.elements.output.getBoundingClientRect();
    const lineRect = lineElement.getBoundingClientRect();
    console.log('📍 Output container position:', outputRect);
    console.log('📍 New line position:', lineRect);
    console.log('📍 Line is', lineRect.top < outputRect.bottom ? 'ABOVE' : 'BELOW', 'the bottom of output container');
    
    // Trim if needed
    this.trimLines();
    
    // Auto-scroll
    if (this.autoScroll) {
      this.scrollToBottom();
    }
    
    return lineId;
  }

  /**
   * Add the old addOutput method for compatibility
   */
  addOutput(output) {
    const content = typeof output === 'string' ? output : output.content;
    const type = typeof output === 'string' ? 'info' : output.type;
    return this.addLine(content, type);
  }

  /**
   * Create a line element
   */
  createLineElement(lineData) {
    const element = document.createElement('div');
    element.className = `terminal-output-line terminal-output-line-${lineData.type}`;
    element.dataset.lineId = lineData.id;
    element.dataset.type = lineData.type;
    
    // Handle content
    if (typeof lineData.content === 'object' && lineData.content !== null) {
      this.renderComplexContent(element, lineData.content);
    } else {
      element.textContent = String(lineData.content || '');
    }
    
    return element;
  }

  /**
   * Render complex content
   */
  renderComplexContent(element, content) {
    if (content.html) {
      element.innerHTML = content.html;
    } else if (content.json) {
      const pre = document.createElement('pre');
      pre.className = 'json-content';
      pre.textContent = JSON.stringify(content.json, null, 2);
      element.appendChild(pre);
    } else {
      element.textContent = JSON.stringify(content);
    }
  }

  /**
   * Trim lines to maxLines
   */
  trimLines() {
    while (this.linesData.length > this.maxLines) {
      const removed = this.linesData.shift();
      const element = this.elements.lines.get(removed.id);
      if (element) {
        element.remove();
        this.elements.lines.delete(removed.id);
      }
    }
  }

  /**
   * Clear all output
   */
  clear() {
    // Remove all line elements
    this.elements.lines.forEach(element => {
      element.remove();
    });
    
    // Clear references
    this.elements.lines.clear();
    this.linesData = [];
    this.lineIdCounter = 0;
  }

  /**
   * Remove a specific line
   */
  removeLine(lineId) {
    const element = this.elements.lines.get(lineId);
    if (element) {
      element.remove();
      this.elements.lines.delete(lineId);
      this.linesData = this.linesData.filter(line => line.id !== lineId);
    }
  }

  /**
   * Update an existing line
   */
  updateLine(lineId, updates) {
    const lineIndex = this.linesData.findIndex(line => line.id === lineId);
    if (lineIndex >= 0) {
      // Update data
      Object.assign(this.linesData[lineIndex], updates);
      
      // Update DOM element
      const element = this.elements.lines.get(lineId);
      if (element) {
        // Update content
        if (updates.content !== undefined) {
          element.textContent = String(updates.content);
        }
        // Update type/class
        if (updates.type !== undefined) {
          element.className = `terminal-output-line terminal-output-line-${updates.type}`;
          element.dataset.type = updates.type;
        }
      }
    }
  }

  /**
   * Scroll to bottom
   */
  scrollToBottom() {
    if (this.elements.output) {
      this.elements.output.scrollTop = this.elements.output.scrollHeight;
    }
  }

  /**
   * Scroll to top
   */
  scrollToTop() {
    if (this.elements.output) {
      this.elements.output.scrollTop = 0;
    }
  }

  /**
   * Get all lines data
   */
  getLines() {
    return [...this.linesData];
  }

  /**
   * Find lines by type
   */
  findLinesByType(type) {
    return this.linesData.filter(line => line.type === type);
  }

  /**
   * Search lines by content
   */
  searchLines(query) {
    const lowerQuery = query.toLowerCase();
    return this.linesData.filter(line => 
      String(line.content).toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Set auto-scroll
   */
  setAutoScroll(enabled) {
    this.autoScroll = enabled;
  }

  /**
   * Set max lines
   */
  setMaxLines(maxLines) {
    this.maxLines = maxLines;
    this.trimLines();
  }

  /**
   * Clean up
   */
  destroy() {
    // Clear timeout
    if (this.autoScrollTimeout) {
      clearTimeout(this.autoScrollTimeout);
    }
    
    // Clear DOM references
    this.elements.lines.clear();
    this.elements.output = null;
    
    // Clear data
    this.linesData = [];
    
    this.initialized = false;
    super.destroy();
  }
}