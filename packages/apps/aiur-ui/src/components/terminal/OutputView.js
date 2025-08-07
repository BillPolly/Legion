/**
 * OutputView Component - Manages output display
 * Maintains 2-way mapping between state and DOM elements
 */

export class OutputView {
  constructor(container) {
    this.container = container;
    
    // State - array of output objects
    this.state = [];
    
    // DOM mapping - keeps track of each output line element
    this.elementMap = new Map(); // outputId -> DOM element
    
    // DOM elements
    this.elements = {
      outputList: null
    };
    
    // Initialize
    this.createDOM();
  }
  
  /**
   * Create DOM structure - called once
   */
  createDOM() {
    // Clear container
    this.container.innerHTML = '';
    
    // Create output list container
    this.elements.outputList = document.createElement('div');
    this.elements.outputList.className = 'output-list';
    
    // Apply styles
    Object.assign(this.elements.outputList.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px'
    });
    
    // Add to container
    this.container.appendChild(this.elements.outputList);
  }
  
  /**
   * Update state and sync with DOM - maintains 2-way mapping
   */
  setState(newState) {
    const oldState = this.state;
    this.state = [...newState]; // Copy array to avoid mutations
    
    // Efficiently update DOM based on state changes
    this.syncDOMWithState(oldState);
    
    // Auto-scroll to bottom
    this.scrollToBottom();
  }
  
  /**
   * Sync DOM with state changes - incremental updates only
   */
  syncDOMWithState(oldState) {
    // Get sets of IDs for comparison
    const oldIds = new Set(oldState.map(item => item.id));
    const newIds = new Set(this.state.map(item => item.id));
    
    // Remove elements that are no longer in state
    for (const oldId of oldIds) {
      if (!newIds.has(oldId)) {
        this.removeOutputElement(oldId);
      }
    }
    
    // Add or update elements
    this.state.forEach((output, index) => {
      if (this.elementMap.has(output.id)) {
        // Update existing element if content changed
        this.updateOutputElement(output);
      } else {
        // Create new element
        this.createOutputElement(output, index);
      }
    });
    
    // Ensure correct order
    this.ensureCorrectOrder();
  }
  
  /**
   * Create new output element - maintains mapping
   */
  createOutputElement(output, index) {
    const element = document.createElement('div');
    element.className = `output-line output-${output.type}`;
    element.dataset.outputId = output.id;
    
    // Set content
    element.textContent = output.text;
    
    // Apply styling based on type
    this.applyTypeStyles(element, output.type);
    
    // Store in mapping
    this.elementMap.set(output.id, element);
    
    // Add to DOM at correct position
    const nextElement = this.elements.outputList.children[index];
    if (nextElement) {
      this.elements.outputList.insertBefore(element, nextElement);
    } else {
      this.elements.outputList.appendChild(element);
    }
  }
  
  /**
   * Update existing output element if needed
   */
  updateOutputElement(output) {
    const element = this.elementMap.get(output.id);
    if (!element) return;
    
    // Update content if changed
    if (element.textContent !== output.text) {
      element.textContent = output.text;
    }
    
    // Update type if changed
    const currentType = element.className.match(/output-(\w+)/)?.[1];
    if (currentType !== output.type) {
      element.className = `output-line output-${output.type}`;
      this.applyTypeStyles(element, output.type);
    }
  }
  
  /**
   * Remove output element and mapping
   */
  removeOutputElement(outputId) {
    const element = this.elementMap.get(outputId);
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
    this.elementMap.delete(outputId);
  }
  
  /**
   * Ensure DOM elements are in correct order
   */
  ensureCorrectOrder() {
    this.state.forEach((output, index) => {
      const element = this.elementMap.get(output.id);
      if (element) {
        const currentIndex = Array.from(this.elements.outputList.children).indexOf(element);
        if (currentIndex !== index) {
          // Move element to correct position
          const nextElement = this.elements.outputList.children[index];
          if (nextElement) {
            this.elements.outputList.insertBefore(element, nextElement);
          } else {
            this.elements.outputList.appendChild(element);
          }
        }
      }
    });
  }
  
  /**
   * Apply styling based on output type
   */
  applyTypeStyles(element, type) {
    const colors = {
      command: '#4a9eff',
      info: '#e0e0e0',
      success: '#51cf66',
      error: '#ff6b6b',
      warning: '#ffd93d'
    };
    
    Object.assign(element.style, {
      color: colors[type] || colors.info,
      padding: '1px 0',
      lineHeight: '1.4',
      wordBreak: 'break-word'
    });
  }
  
  /**
   * Scroll to bottom
   */
  scrollToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }
  
  /**
   * Get current state
   */
  getState() {
    return [...this.state];
  }
  
  /**
   * Get element by output ID - for debugging
   */
  getElement(outputId) {
    return this.elementMap.get(outputId);
  }
  
  /**
   * Clear all output - resets state and DOM
   */
  clear() {
    this.setState([]);
  }
  
  /**
   * Destroy component
   */
  destroy() {
    this.elementMap.clear();
    this.container.innerHTML = '';
  }
}