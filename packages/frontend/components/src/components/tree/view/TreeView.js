/**
 * TreeView - View layer for the tree component
 * 
 * Handles DOM rendering, styling, animations, and user interactions
 * following the View layer of MVVM pattern.
 */
export class TreeView {
  constructor(element, config) {
    this.element = element;
    this.config = config;
    this.rendered = false;
    
    // DOM references
    this.treeContainer = null;
    this.treeList = null;
    
    // Event handlers storage
    this.eventHandlers = new Map();
    
    // Animation state
    this.animating = new Set();
    
    // Drag & drop state
    this.dragGhost = null;
    this.dropIndicator = null;
    
    // Initialize container
    this.initializeContainer();
  }
  
  initializeContainer() {
    // Apply CSS classes
    const themeClass = this.config.theme === 'dark' ? 'theme-dark' : '';
    const editableClass = this.config.editable ? 'editable' : '';
    this.element.className = `umbilical-tree ${themeClass} ${editableClass} ${this.config.className || ''}`.trim();
    
    // Inject CSS styles
    this.injectStyles();
    
    // Create main tree container
    this.treeContainer = document.createElement('div');
    this.treeContainer.className = 'tree-container';
    
    this.treeList = document.createElement('ul');
    this.treeList.className = 'tree-list tree-root';
    this.treeList.setAttribute('role', 'tree');
    
    this.treeContainer.appendChild(this.treeList);
    this.element.appendChild(this.treeContainer);
  }
  
  injectStyles() {
    const styleId = 'umbilical-tree-styles';
    if (document.getElementById(styleId)) return;
    
    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
      .umbilical-tree {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #374151;
        background: white;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        overflow: hidden;
        --tree-indent: 24px;
        --tree-node-height: 32px;
        --tree-hover-bg: #f9fafb;
        --tree-selected-bg: #dbeafe;
        --tree-selected-border: #3b82f6;
        --tree-drag-bg: rgba(59, 130, 246, 0.1);
        --tree-drop-indicator: #3b82f6;
      }
      
      .umbilical-tree.theme-dark {
        background: #1f2937;
        border-color: #374151;
        color: #f9fafb;
        --tree-hover-bg: #374151;
        --tree-selected-bg: #1e40af;
        --tree-selected-border: #60a5fa;
        --tree-drag-bg: rgba(96, 165, 250, 0.2);
      }
      
      .tree-container {
        max-height: 100%;
        overflow: auto;
      }
      
      .tree-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      
      .tree-node {
        position: relative;
        user-select: none;
      }
      
      .tree-node-content {
        display: flex;
        align-items: center;
        min-height: var(--tree-node-height);
        padding: 4px 8px;
        cursor: pointer;
        border-radius: 6px;
        margin: 1px 4px;
        transition: all 0.15s ease;
        position: relative;
      }
      
      .tree-node-content:hover {
        background: var(--tree-hover-bg);
      }
      
      .tree-node-content.selected {
        background: var(--tree-selected-bg);
        border: 1px solid var(--tree-selected-border);
        margin: 0 4px;
      }
      
      .tree-node-content.dragging {
        background: var(--tree-drag-bg);
        opacity: 0.7;
        transform: rotate(2deg);
        z-index: 1000;
      }
      
      .tree-node-content.drag-over {
        background: var(--tree-drag-bg);
        border: 2px dashed var(--tree-drop-indicator);
        margin: -1px 4px;
      }
      
      .tree-node-indent {
        width: var(--tree-indent);
        display: inline-block;
        position: relative;
      }
      
      .tree-node-expand {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 4px;
        border: none;
        background: transparent;
        cursor: pointer;
        transition: opacity 0.2s ease;
        flex-shrink: 0;
        padding: 0;
      }
      
      .tree-node-expand:hover {
        opacity: 0.7;
      }
      
      .tree-node-expand.empty {
        cursor: default;
        visibility: hidden;
      }
      
      .tree-node-expand-icon {
        width: 14px;
        height: 14px;
        transition: transform 0.2s ease;
        fill: currentColor;
        opacity: 0.7;
        transform: rotate(-90deg);
      }
      
      .tree-node-expand.expanded .tree-node-expand-icon {
        transform: rotate(0deg);
      }
      
      .tree-node-icon {
        width: 16px;
        height: 16px;
        margin-right: 8px;
        flex-shrink: 0;
        opacity: 0.8;
      }
      
      .tree-node-label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: default;
        border-radius: 3px;
        padding: 2px 4px;
        margin: -2px -4px;
        transition: background-color 0.2s ease;
      }
      
      .umbilical-tree.editable .tree-node-label {
        cursor: text;
      }
      
      .umbilical-tree.editable .tree-node-label:hover {
        background: rgba(0, 0, 0, 0.05);
      }
      
      .tree-node-label.editing {
        background: white;
        border: 2px solid var(--tree-selected-border);
        outline: none;
        cursor: text;
        overflow: visible;
        white-space: normal;
      }
      
      .tree-node-label-input {
        width: 100%;
        border: none;
        outline: none;
        background: transparent;
        font: inherit;
        color: inherit;
        padding: 0;
        margin: 0;
      }
      
      .tree-node-drag-handle {
        width: 16px;
        height: 16px;
        margin-left: 8px;
        opacity: 0;
        cursor: grab;
        transition: opacity 0.2s ease;
        flex-shrink: 0;
      }
      
      .tree-node-content:hover .tree-node-drag-handle {
        opacity: 0.5;
      }
      
      .tree-node-drag-handle:hover {
        opacity: 1 !important;
      }
      
      .tree-node-drag-handle:active {
        cursor: grabbing;
      }
      
      .tree-children {
        list-style: none;
        margin: 0;
        padding: 0;
        margin-left: var(--tree-indent);
        overflow: hidden;
        transition: all 0.3s ease;
      }
      
      .tree-children.collapsed {
        max-height: 0;
        opacity: 0;
        transform: translateY(-4px);
      }
      
      .tree-children.expanded {
        max-height: 2000px;
        opacity: 1;
        transform: translateY(0);
      }
      
      .tree-drop-indicator {
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--tree-drop-indicator);
        border-radius: 1px;
        pointer-events: none;
        z-index: 100;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      .tree-drop-indicator.visible {
        opacity: 1;
      }
      
      .tree-drop-indicator.above {
        top: -1px;
      }
      
      .tree-drop-indicator.below {
        bottom: -1px;
      }
      
      .tree-drag-ghost {
        position: fixed;
        pointer-events: none;
        z-index: 10000;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 4px 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        transform: rotate(2deg);
        opacity: 0.9;
        transition: none;
      }
      
      .tree-node-connecting-line {
        position: absolute;
        left: 10px;
        top: 0;
        bottom: 0;
        width: 1px;
        background: rgba(0, 0, 0, 0.1);
        pointer-events: none;
      }
      
      .tree-node:last-child > .tree-node-connecting-line {
        height: 16px;
      }
      
      /* Focus styles for accessibility */
      .tree-node-content:focus {
        outline: 2px solid var(--tree-selected-border);
        outline-offset: 2px;
      }
      
      /* Animation classes */
      .tree-node-highlight {
        animation: tree-highlight 0.6s ease;
      }
      
      @keyframes tree-highlight {
        0% { background: var(--tree-selected-bg); }
        100% { background: transparent; }
      }
      
      /* Loading state */
      .tree-node-loading {
        opacity: 0.6;
      }
      
      .tree-node-loading::after {
        content: '';
        width: 12px;
        height: 12px;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-left: 8px;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    
    document.head.appendChild(styles);
  }
  
  render(visibleNodes, nodeRenderer) {
    this.treeList.innerHTML = '';
    
    visibleNodes.forEach(nodeInfo => {
      const nodeElement = this.createNodeElement(nodeInfo, nodeRenderer);
      this.treeList.appendChild(nodeElement);
    });
    
    this.rendered = true;
  }
  
  createNodeElement(nodeInfo, nodeRenderer) {
    const { node, nodeId, depth, hasChildren, isExpanded, isSelected } = nodeInfo;
    
    // Create main node element
    const li = document.createElement('li');
    li.className = 'tree-node';
    li.setAttribute('data-node-id', nodeId);
    li.setAttribute('role', 'treeitem');
    li.setAttribute('aria-expanded', hasChildren ? isExpanded : null);
    li.setAttribute('aria-selected', isSelected);
    
    // Create node content container
    const content = document.createElement('div');
    content.className = `tree-node-content ${isSelected ? 'selected' : ''}`;
    content.setAttribute('tabindex', '0');
    content.setAttribute('data-node-id', nodeId);
    content.setAttribute('data-action', 'select');
    
    // Add indentation
    for (let i = 0; i < depth; i++) {
      const indent = document.createElement('span');
      indent.className = 'tree-node-indent';
      
      // Add connecting lines for visual hierarchy
      if (i === depth - 1) {
        const line = document.createElement('div');
        line.className = 'tree-node-connecting-line';
        indent.appendChild(line);
      }
      
      content.appendChild(indent);
    }
    
    // Add expand/collapse button
    const expandButton = document.createElement('button');
    expandButton.className = `tree-node-expand ${hasChildren ? (isExpanded ? 'expanded' : 'collapsed') : 'empty'}`;
    expandButton.setAttribute('aria-label', hasChildren ? (isExpanded ? 'Collapse' : 'Expand') : '');
    expandButton.setAttribute('tabindex', '-1');
    expandButton.setAttribute('data-node-id', nodeId);
    expandButton.setAttribute('data-action', 'expand');
    
    if (hasChildren) {
      expandButton.innerHTML = `
        <svg class="tree-node-expand-icon" viewBox="0 0 16 16">
          <path d="M5 6l3 3 3-3z"/>
        </svg>
      `;
    }
    
    content.appendChild(expandButton);
    
    // Add node icon (if provided by renderer)
    const iconElement = this.createNodeIcon(node, nodeInfo);
    if (iconElement) {
      content.appendChild(iconElement);
    }
    
    // Add node label/content
    const labelElement = this.createNodeLabel(node, nodeInfo, nodeRenderer);
    content.appendChild(labelElement);
    
    // Add drag handle (if draggable)
    if (this.config.draggable) {
      const dragHandle = document.createElement('div');
      dragHandle.className = 'tree-node-drag-handle';
      dragHandle.innerHTML = `
        <svg viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="3" r="1"/>
          <circle cx="3" cy="8" r="1"/>
          <circle cx="3" cy="13" r="1"/>
          <circle cx="8" cy="3" r="1"/>
          <circle cx="8" cy="8" r="1"/>
          <circle cx="8" cy="13" r="1"/>
        </svg>
      `;
      content.appendChild(dragHandle);
    }
    
    li.appendChild(content);
    
    // Add drop indicator
    const dropIndicator = document.createElement('div');
    dropIndicator.className = 'tree-drop-indicator';
    li.appendChild(dropIndicator);
    
    return li;
  }
  
  createNodeIcon(node, nodeInfo) {
    // Default icon logic - can be overridden by config
    if (this.config.getNodeIcon) {
      const iconData = this.config.getNodeIcon(node, nodeInfo);
      if (iconData) {
        const icon = document.createElement('div');
        icon.className = 'tree-node-icon';
        if (typeof iconData === 'string') {
          icon.innerHTML = iconData;
        } else {
          icon.appendChild(iconData);
        }
        return icon;
      }
    }
    
    // Default folder/file icons
    if (nodeInfo.hasChildren) {
      const icon = document.createElement('div');
      icon.className = 'tree-node-icon';
      icon.innerHTML = nodeInfo.isExpanded 
        ? '📂' // Open folder
        : '📁'; // Closed folder
      return icon;
    }
    
    return null;
  }
  
  createNodeLabel(node, nodeInfo, nodeRenderer) {
    const label = document.createElement('div');
    label.className = 'tree-node-label';
    label.setAttribute('data-node-id', nodeInfo.nodeId);
    label.setAttribute('data-action', 'edit');
    
    if (nodeRenderer) {
      const rendered = nodeRenderer(node, nodeInfo.depth, nodeInfo.isExpanded);
      if (typeof rendered === 'string') {
        label.innerHTML = rendered;
      } else if (rendered instanceof HTMLElement) {
        label.appendChild(rendered);
      } else {
        label.textContent = String(rendered);
      }
    } else {
      // Default rendering
      label.textContent = node.name || node.label || node.title || String(node);
    }
    
    return label;
  }
  
  /**
   * Update expansion state of a specific node
   */
  updateNodeExpansion(nodeId, isExpanded) {
    const nodeElement = this.element.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) return;
    
    const expandButton = nodeElement.querySelector('.tree-node-expand');
    const childrenContainer = nodeElement.querySelector('.tree-children');
    
    if (expandButton) {
      expandButton.className = `tree-node-expand ${isExpanded ? 'expanded' : 'collapsed'}`;
      expandButton.setAttribute('aria-label', isExpanded ? 'Collapse' : 'Expand');
    }
    
    if (childrenContainer) {
      if (isExpanded) {
        childrenContainer.className = 'tree-children expanded';
      } else {
        childrenContainer.className = 'tree-children collapsed';
      }
    }
    
    nodeElement.setAttribute('aria-expanded', isExpanded);
  }
  
  /**
   * Update selection state of nodes
   */
  updateSelection(selectedIds) {
    // Clear all selections
    this.element.querySelectorAll('.tree-node-content.selected').forEach(el => {
      el.classList.remove('selected');
      el.closest('.tree-node').setAttribute('aria-selected', 'false');
    });
    
    // Apply new selections
    selectedIds.forEach(nodeId => {
      const nodeElement = this.element.querySelector(`[data-node-id="${nodeId}"]`);
      if (nodeElement) {
        const content = nodeElement.querySelector('.tree-node-content');
        content.classList.add('selected');
        nodeElement.setAttribute('aria-selected', 'true');
      }
    });
  }
  
  /**
   * Drag and drop visual feedback
   */
  startDragVisual(nodeId, event) {
    const nodeElement = this.element.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) return;
    
    const content = nodeElement.querySelector('.tree-node-content');
    content.classList.add('dragging');
    
    // Create drag ghost that maintains tree structure appearance
    this.dragGhost = document.createElement('div');
    this.dragGhost.className = 'tree-drag-ghost';
    
    // Clone the entire content including indentation to maintain tree appearance
    const clonedContent = content.cloneNode(true);
    clonedContent.classList.remove('dragging');
    this.dragGhost.appendChild(clonedContent);
    
    // Position the ghost
    this.dragGhost.style.left = event.clientX + 10 + 'px';
    this.dragGhost.style.top = event.clientY - 10 + 'px';
    document.body.appendChild(this.dragGhost);
  }
  
  updateDragVisual(event) {
    if (this.dragGhost) {
      this.dragGhost.style.left = event.clientX + 10 + 'px';
      this.dragGhost.style.top = event.clientY - 10 + 'px';
    }
  }
  
  showDropIndicator(targetNodeId, position) {
    this.hideDropIndicator();
    
    const targetElement = this.element.querySelector(`[data-node-id="${targetNodeId}"]`);
    if (!targetElement) return;
    
    const indicator = targetElement.querySelector('.tree-drop-indicator');
    if (indicator) {
      indicator.className = `tree-drop-indicator visible ${position}`;
    }
    
    if (position === 'inside') {
      const content = targetElement.querySelector('.tree-node-content');
      content.classList.add('drag-over');
    }
  }
  
  hideDropIndicator() {
    this.element.querySelectorAll('.tree-drop-indicator').forEach(el => {
      el.className = 'tree-drop-indicator';
    });
    
    this.element.querySelectorAll('.tree-node-content.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
  }
  
  endDragVisual() {
    this.element.querySelectorAll('.tree-node-content.dragging').forEach(el => {
      el.classList.remove('dragging');
    });
    
    this.hideDropIndicator();
    
    if (this.dragGhost) {
      document.body.removeChild(this.dragGhost);
      this.dragGhost = null;
    }
  }
  
  /**
   * Highlight a node (useful for search results or navigation)
   */
  highlightNode(nodeId) {
    const nodeElement = this.element.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) return;
    
    const content = nodeElement.querySelector('.tree-node-content');
    content.classList.add('tree-node-highlight');
    
    // Remove highlight after animation
    setTimeout(() => {
      content.classList.remove('tree-node-highlight');
    }, 600);
    
    // Scroll into view (if method exists - not available in jsdom)
    if (nodeElement.scrollIntoView) {
      nodeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  
  /**
   * Focus a specific node
   */
  focusNode(nodeId) {
    const nodeElement = this.element.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) return;
    
    const content = nodeElement.querySelector('.tree-node-content');
    content.focus();
  }
  
  /**
   * Get node element from point (useful for drag operations)
   */
  getNodeAtPoint(x, y) {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;
    
    const nodeElement = element.closest('.tree-node');
    if (!nodeElement) return null;
    
    const nodeId = nodeElement.getAttribute('data-node-id');
    const rect = nodeElement.getBoundingClientRect();
    
    // Determine drop position based on mouse position
    const relativeY = y - rect.top;
    const height = rect.height;
    
    let position;
    if (relativeY < height * 0.3) {
      position = 'before';
    } else if (relativeY > height * 0.7) {
      position = 'after';
    } else {
      position = 'inside';
    }
    
    return { nodeId, position, element: nodeElement };
  }
  
  /**
   * Event delegation setup
   */
  addEventHandler(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
    
    // Add actual DOM event listener
    this.element.addEventListener(event, handler);
  }
  
  removeEventHandler(event, handler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index >= 0) {
        handlers.splice(index, 1);
        this.element.removeEventListener(event, handler);
      }
    }
  }
  
  /**
   * Start inline editing of a node label
   */
  startEditingNode(nodeId, currentValue, emoji = '') {
    const nodeElement = this.element.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) return null;
    
    const labelElement = nodeElement.querySelector('.tree-node-label');
    if (!labelElement || labelElement.classList.contains('editing')) return null;
    
    // Store original content and emoji
    const originalContent = labelElement.textContent;
    labelElement.setAttribute('data-original', originalContent);
    labelElement.setAttribute('data-emoji', emoji);
    
    // Create a container for emoji + input
    const editContainer = document.createElement('div');
    editContainer.className = 'tree-node-edit-container';
    editContainer.style.display = 'flex';
    editContainer.style.alignItems = 'center';
    editContainer.style.gap = '4px';
    
    // Add emoji if present
    if (emoji) {
      const emojiSpan = document.createElement('span');
      emojiSpan.textContent = emoji;
      emojiSpan.className = 'tree-node-emoji';
      editContainer.appendChild(emojiSpan);
    }
    
    // Create input element
    const input = document.createElement('input');
    input.className = 'tree-node-label-input';
    input.type = 'text';
    input.value = currentValue || originalContent;
    input.style.flex = '1';
    input.style.minWidth = '0';
    
    editContainer.appendChild(input);
    
    // Replace label content with edit container
    labelElement.innerHTML = '';
    labelElement.appendChild(editContainer);
    labelElement.classList.add('editing');
    
    // Focus and select all text
    input.focus();
    input.select();
    
    return input;
  }
  
  /**
   * Finish editing a node label
   */
  finishEditingNode(nodeId, newValue, cancelled = false) {
    const nodeElement = this.element.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) return null;
    
    const labelElement = nodeElement.querySelector('.tree-node-label');
    if (!labelElement || !labelElement.classList.contains('editing')) return null;
    
    const originalContent = labelElement.getAttribute('data-original');
    const emoji = labelElement.getAttribute('data-emoji') || '';
    
    labelElement.removeAttribute('data-original');
    labelElement.removeAttribute('data-emoji');
    labelElement.classList.remove('editing');
    
    // Get the text from input if not cancelled
    let textValue = originalContent;
    if (!cancelled) {
      const input = labelElement.querySelector('.tree-node-label-input');
      textValue = newValue || (input ? input.value : originalContent);
    }
    
    // Reconstruct full value with emoji
    const finalValue = emoji ? `${emoji} ${textValue}` : textValue;
    labelElement.textContent = finalValue;
    
    return {
      originalValue: originalContent,
      newValue: finalValue,
      changed: !cancelled && finalValue !== originalContent
    };
  }
  
  /**
   * Cancel editing and restore original value
   */
  cancelEditingNode(nodeId) {
    return this.finishEditingNode(nodeId, null, true);
  }
  
  /**
   * Check if a node is currently being edited
   */
  isEditingNode(nodeId) {
    const nodeElement = this.element.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) return false;
    
    const labelElement = nodeElement.querySelector('.tree-node-label');
    return labelElement && labelElement.classList.contains('editing');
  }
  
  /**
   * Update theme
   */
  updateTheme(theme) {
    this.config.theme = theme;
    const themeClass = theme === 'dark' ? 'theme-dark' : '';
    const editableClass = this.config.editable ? 'editable' : '';
    this.element.className = `umbilical-tree ${themeClass} ${editableClass} ${this.config.className || ''}`.trim();
  }

  /**
   * Cleanup
   */
  destroy() {
    // Remove all event listeners
    this.eventHandlers.forEach((handlers, event) => {
      handlers.forEach(handler => {
        this.element.removeEventListener(event, handler);
      });
    });
    this.eventHandlers.clear();
    
    // Clean up drag ghost if exists
    if (this.dragGhost && this.dragGhost.parentNode) {
      this.dragGhost.parentNode.removeChild(this.dragGhost);
    }
    
    // Clear container
    this.element.innerHTML = '';
  }
}