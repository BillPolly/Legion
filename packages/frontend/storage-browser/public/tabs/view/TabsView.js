/**
 * TabsView - DOM rendering and visual presentation for Tabs component
 * 
 * Handles DOM creation, styling, animations, and visual feedback.
 * Maintains separation between presentation logic and business logic.
 */

export class TabsView {
  constructor(container, config = {}) {
    this.container = container;
    this.config = {
      theme: config.theme || 'light',
      position: config.position || 'top', // 'top', 'bottom', 'left', 'right'
      variant: config.variant || 'default', // 'default', 'pills', 'underline', 'cards'
      animationDuration: config.animationDuration || 300,
      showCloseButtons: config.showCloseButtons !== false,
      showAddButton: config.showAddButton || false,
      scrollable: config.scrollable !== false,
      ...config
    };

    // DOM elements
    this.elements = {
      wrapper: null,
      tabsContainer: null,
      tabsScroller: null,
      tabsList: null,
      contentContainer: null,
      addButton: null,
      scrollLeftButton: null,
      scrollRightButton: null
    };

    // State
    this.tabs = new Map(); // tabId -> { element, contentElement, ... }
    this.activeTabId = null;
    this.dragState = null;
    this.eventListeners = new Map();

    this._createStructure();
    this._applyTheme();
    this._setupScrolling();
  }

  /**
   * Create the basic DOM structure
   */
  _createStructure() {
    // Main wrapper
    this.elements.wrapper = document.createElement('div');
    this.elements.wrapper.className = 'umbilical-tabs';
    this.elements.wrapper.setAttribute('data-theme', this.config.theme);
    this.elements.wrapper.setAttribute('data-position', this.config.position);
    this.elements.wrapper.setAttribute('data-variant', this.config.variant);

    // Tabs container
    this.elements.tabsContainer = document.createElement('div');
    this.elements.tabsContainer.className = 'umbilical-tabs-container';

    // Scrollable tabs area
    this.elements.tabsScroller = document.createElement('div');
    this.elements.tabsScroller.className = 'umbilical-tabs-scroller';

    // Tabs list
    this.elements.tabsList = document.createElement('div');
    this.elements.tabsList.className = 'umbilical-tabs-list';
    this.elements.tabsList.setAttribute('role', 'tablist');

    // Scroll buttons
    if (this.config.scrollable) {
      this.elements.scrollLeftButton = this._createScrollButton('left', '‹');
      this.elements.scrollRightButton = this._createScrollButton('right', '›');
      this.elements.tabsContainer.appendChild(this.elements.scrollLeftButton);
    }

    // Add button
    if (this.config.showAddButton) {
      this.elements.addButton = this._createAddButton();
      this.elements.tabsContainer.appendChild(this.elements.addButton);
    }

    // Content container
    this.elements.contentContainer = document.createElement('div');
    this.elements.contentContainer.className = 'umbilical-tabs-content';
    this.elements.contentContainer.setAttribute('role', 'tabpanel');

    // Assemble structure
    this.elements.tabsScroller.appendChild(this.elements.tabsList);
    this.elements.tabsContainer.appendChild(this.elements.tabsScroller);
    
    if (this.config.scrollable) {
      this.elements.tabsContainer.appendChild(this.elements.scrollRightButton);
    }

    this.elements.wrapper.appendChild(this.elements.tabsContainer);
    this.elements.wrapper.appendChild(this.elements.contentContainer);

    // Insert into container
    this.container.appendChild(this.elements.wrapper);
  }

  /**
   * Create scroll button
   */
  _createScrollButton(direction, text) {
    const button = document.createElement('button');
    button.className = `umbilical-tabs-scroll umbilical-tabs-scroll-${direction}`;
    button.setAttribute('type', 'button');
    button.setAttribute('aria-label', `Scroll tabs ${direction}`);
    button.textContent = text;
    button.style.display = 'none'; // Initially hidden
    return button;
  }

  /**
   * Create add button
   */
  _createAddButton() {
    const button = document.createElement('button');
    button.className = 'umbilical-tabs-add';
    button.setAttribute('type', 'button');
    button.setAttribute('aria-label', 'Add new tab');
    button.innerHTML = '<span>+</span>';
    return button;
  }

  /**
   * Apply theme styles
   */
  _applyTheme() {
    const styles = this._getThemeStyles();
    
    // Remove existing style element if present
    const existingStyle = this.container.querySelector('.umbilical-tabs-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create new style element
    const styleElement = document.createElement('style');
    styleElement.className = 'umbilical-tabs-styles';
    styleElement.textContent = styles;
    this.container.appendChild(styleElement);
  }

  /**
   * Get variant-specific tab background
   */
  _getTabBackground(colors) {
    switch (this.config.variant) {
      case 'pills':
        return colors.tabBackground;
      case 'cards':
        return colors.tabBackground;
      case 'underline':
        return 'transparent';
      default:
        return colors.tabBackground;
    }
  }

  /**
   * Get variant-specific tab border
   */
  _getTabBorder(colors) {
    switch (this.config.variant) {
      case 'pills':
        return `1px solid ${colors.border}`;
      case 'cards':
        return `1px solid ${colors.border}`;
      case 'underline':
        return 'none';
      default:
        return `1px solid transparent`;
    }
  }

  /**
   * Get variant-specific border radius
   */
  _getTabBorderRadius() {
    switch (this.config.variant) {
      case 'pills':
        return '20px';
      case 'cards':
        return '8px 8px 0 0';
      case 'underline':
        return '0';
      default:
        return '4px 4px 0 0';
    }
  }

  /**
   * Get variant-specific hover background
   */
  _getTabHoverBackground(colors) {
    switch (this.config.variant) {
      case 'underline':
        return 'rgba(79, 70, 229, 0.05)';
      default:
        return colors.tabHoverBackground;
    }
  }

  /**
   * Get variant-specific active background
   */
  _getTabActiveBackground(colors) {
    switch (this.config.variant) {
      case 'underline':
        return 'rgba(79, 70, 229, 0.1)';
      case 'pills':
        return colors.tabActiveBackground;
      case 'cards':
        return colors.background; // Make active card appear "lifted"
      default:
        return colors.tabActiveBackground;
    }
  }

  /**
   * Get theme-specific CSS styles
   */
  _getThemeStyles() {
    const colors = this.config.theme === 'dark' ? {
      background: '#1f2937',
      tabBackground: '#374151',
      tabActiveBackground: '#4f46e5',
      tabHoverBackground: '#4b5563',
      text: '#f9fafb',
      textActive: '#ffffff',
      textMuted: '#9ca3af',
      border: '#4b5563',
      borderActive: '#4f46e5',
      scrollButton: '#6b7280',
      addButton: '#4f46e5'
    } : {
      background: '#ffffff',
      tabBackground: '#f8fafc',
      tabActiveBackground: '#4f46e5',
      tabHoverBackground: '#f1f5f9',
      text: '#1f2937',
      textActive: '#ffffff',
      textMuted: '#6b7280',
      border: '#e2e8f0',
      borderActive: '#4f46e5',
      scrollButton: '#6b7280',
      addButton: '#4f46e5'
    };

    return `
      .umbilical-tabs {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        flex-direction: ${this.config.position === 'left' || this.config.position === 'right' ? 'row' : 'column'};
        width: 100%;
        height: 100%;
        background: ${colors.background};
        border-radius: 8px;
        overflow: hidden;
      }

      .umbilical-tabs-container {
        display: flex;
        align-items: center;
        background: ${colors.background};
        border-bottom: ${this.config.position === 'top' ? `2px solid ${colors.border}` : 'none'};
        border-top: ${this.config.position === 'bottom' ? `2px solid ${colors.border}` : 'none'};
        border-right: ${this.config.position === 'left' ? `2px solid ${colors.border}` : 'none'};
        border-left: ${this.config.position === 'right' ? `2px solid ${colors.border}` : 'none'};
        position: relative;
        flex-shrink: 0;
      }

      .umbilical-tabs-scroller {
        flex: 1;
        overflow: hidden;
        position: relative;
      }

      .umbilical-tabs-list {
        display: flex;
        gap: ${this.config.variant === 'pills' ? '8px' : this.config.variant === 'underline' ? '0' : '2px'};
        padding: ${this.config.variant === 'pills' ? '8px' : this.config.variant === 'cards' ? '8px 8px 0 8px' : '0'};
        transition: transform ${this.config.animationDuration}ms ease;
        align-items: stretch;
        ${this.config.variant === 'underline' ? `border-bottom: 2px solid ${colors.border};` : ''}
      }

      .umbilical-tabs[data-position="left"] .umbilical-tabs-list,
      .umbilical-tabs[data-position="right"] .umbilical-tabs-list {
        flex-direction: column;
      }

      .umbilical-tab {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: ${this.config.variant === 'pills' ? '10px 18px' : this.config.variant === 'cards' ? '14px 18px' : '12px 16px'};
        cursor: pointer;
        user-select: none;
        position: relative;
        white-space: nowrap;
        transition: all ${this.config.animationDuration}ms ease;
        color: ${colors.text};
        background: ${this._getTabBackground(colors)};
        border: ${this._getTabBorder(colors)};
        border-radius: ${this._getTabBorderRadius()};
        min-width: ${this.config.variant === 'pills' ? '80px' : '100px'};
        flex-shrink: 0;
        ${this.config.variant === 'cards' ? `margin-bottom: -2px; border-bottom: 2px solid ${colors.border};` : ''}
        ${this.config.variant === 'underline' ? `margin-bottom: -2px; border-bottom: 2px solid transparent;` : ''}
      }

      .umbilical-tab:hover {
        background: ${this._getTabHoverBackground(colors)};
        color: ${colors.text};
        ${this.config.variant === 'underline' ? `border-bottom-color: ${colors.borderActive} !important;` : ''}
        ${this.config.variant === 'cards' ? `border-bottom-color: ${colors.borderActive} !important;` : ''}
      }

      .umbilical-tab.active {
        background: ${this._getTabActiveBackground(colors)};
        color: ${colors.textActive};
        font-weight: 600;
        ${this.config.variant === 'underline' ? `border-bottom-color: ${colors.borderActive} !important;` : ''}
        ${this.config.variant === 'cards' ? `border-bottom-color: ${colors.tabActiveBackground} !important; z-index: 1;` : ''}
      }

      .umbilical-tab.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }

      .umbilical-tab.dragging {
        opacity: 0.5;
        transform: rotate(2deg);
        z-index: 1000;
      }

      .umbilical-tab.drag-over {
        background: ${colors.borderActive} !important;
        transform: scale(1.05);
      }

      /* Variant-specific styles */
      .umbilical-tabs[data-variant="pills"] .umbilical-tabs-container {
        border: none;
        background: transparent;
      }

      .umbilical-tabs[data-variant="cards"] .umbilical-tabs-container {
        background: ${colors.tabBackground};
        border-bottom: 2px solid ${colors.border};
      }

      .umbilical-tabs[data-variant="underline"] .umbilical-tabs-container {
        border: none;
        background: transparent;
      }
      
      .umbilical-tabs[data-variant="underline"] .umbilical-tabs-list {
        border-bottom: 2px solid ${colors.border};
      }

      /* Pills variant - fully rounded, spaced tabs */
      .umbilical-tabs[data-variant="pills"] .umbilical-tab {
        border-radius: 20px;
        margin: 0 2px;
      }

      /* Cards variant - connected tabs with borders */
      .umbilical-tabs[data-variant="cards"] .umbilical-tab {
        border-radius: 8px 8px 0 0;
        border-bottom: none;
        margin-right: 1px;
      }

      .umbilical-tabs[data-variant="cards"] .umbilical-tab.active {
        border-bottom: 2px solid ${colors.background};
        margin-bottom: -2px;
      }

      /* Underline variant - minimal tabs with bottom border indicator */
      .umbilical-tabs[data-variant="underline"] .umbilical-tab {
        border: none;
        border-radius: 0;
        background: transparent;
        border-bottom: 3px solid transparent;
        margin-bottom: -2px;
      }

      .umbilical-tabs[data-variant="underline"] .umbilical-tab:hover {
        background: rgba(79, 70, 229, 0.05);
        border-bottom-color: rgba(79, 70, 229, 0.3);
      }

      .umbilical-tabs[data-variant="underline"] .umbilical-tab.active {
        background: rgba(79, 70, 229, 0.1);
        border-bottom-color: ${colors.borderActive};
        color: ${colors.borderActive};
        font-weight: 600;
      }

      .umbilical-tab-icon {
        flex-shrink: 0;
        width: 16px;
        height: 16px;
      }

      .umbilical-tab-title {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .umbilical-tab-badge {
        background: #ef4444;
        color: white;
        border-radius: 10px;
        padding: 2px 6px;
        font-size: 11px;
        font-weight: 600;
        min-width: 16px;
        text-align: center;
      }

      .umbilical-tab-close {
        background: none;
        border: none;
        color: currentColor;
        cursor: pointer;
        padding: 2px;
        border-radius: 3px;
        opacity: 0.7;
        transition: all 0.2s ease;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        line-height: 1;
      }

      .umbilical-tab-close:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.2);
      }

      .umbilical-tabs-scroll {
        background: ${colors.scrollButton};
        color: white;
        border: none;
        padding: 8px;
        cursor: pointer;
        transition: opacity 0.3s ease;
        font-size: 18px;
        line-height: 1;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        margin: 4px;
      }

      .umbilical-tabs-scroll:hover {
        opacity: 0.8;
      }

      .umbilical-tabs-scroll:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .umbilical-tabs-add {
        background: ${colors.addButton};
        color: white;
        border: none;
        padding: 8px 12px;
        cursor: pointer;
        border-radius: 6px;
        margin: 4px;
        transition: all 0.2s ease;
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .umbilical-tabs-add:hover {
        transform: scale(1.05);
        opacity: 0.9;
      }

      .umbilical-tabs-content {
        flex: 1;
        overflow: auto;
        padding: 16px;
        background: ${colors.background};
      }

      .umbilical-tab-content {
        display: none;
        animation: fadeIn ${this.config.animationDuration}ms ease;
      }

      .umbilical-tab-content.active {
        display: block;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes slideIn {
        from { transform: translateX(20px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }

      .umbilical-tab.newly-added {
        animation: slideIn ${this.config.animationDuration}ms ease;
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .umbilical-tab {
          min-width: 80px;
          padding: 10px 12px;
        }
        
        .umbilical-tab-title {
          font-size: 14px;
        }
      }
    `;
  }

  /**
   * Setup scrolling functionality
   */
  _setupScrolling() {
    if (!this.config.scrollable) return;

    const { scrollLeftButton, scrollRightButton, tabsScroller, tabsList } = this.elements;

    // Scroll functions
    const scrollTabs = (direction) => {
      const scrollAmount = 200;
      const currentScroll = tabsScroller.scrollLeft;
      const newScroll = direction === 'left' 
        ? Math.max(0, currentScroll - scrollAmount)
        : currentScroll + scrollAmount;
      
      tabsScroller.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      });
    };

    // Update scroll button visibility
    const updateScrollButtons = () => {
      const canScrollLeft = tabsScroller.scrollLeft > 0;
      const canScrollRight = tabsScroller.scrollLeft < (tabsScroller.scrollWidth - tabsScroller.clientWidth);
      
      scrollLeftButton.style.display = canScrollLeft ? 'flex' : 'none';
      scrollRightButton.style.display = canScrollRight ? 'flex' : 'none';
    };

    // Event listeners
    scrollLeftButton.addEventListener('click', () => scrollTabs('left'));
    scrollRightButton.addEventListener('click', () => scrollTabs('right'));
    
    tabsScroller.addEventListener('scroll', updateScrollButtons);
    
    // Resize observer to update buttons when tabs change
    const resizeObserver = new ResizeObserver(updateScrollButtons);
    resizeObserver.observe(tabsList);
    
    // Store for cleanup
    this.scrollResizeObserver = resizeObserver;
    
    // Initial update
    updateScrollButtons();
  }

  /**
   * Create a tab element
   */
  createTabElement(tab) {
    const tabElement = document.createElement('div');
    tabElement.className = 'umbilical-tab';
    tabElement.setAttribute('role', 'tab');
    tabElement.setAttribute('aria-controls', `content-${tab.id}`);
    tabElement.setAttribute('aria-selected', 'false');
    tabElement.setAttribute('tabindex', '-1');
    tabElement.dataset.tabId = tab.id;

    if (tab.tooltip) {
      tabElement.title = tab.tooltip;
    }

    if (tab.disabled) {
      tabElement.classList.add('disabled');
      tabElement.setAttribute('aria-disabled', 'true');
    }

    // Icon
    if (tab.icon) {
      const iconElement = document.createElement('span');
      iconElement.className = 'umbilical-tab-icon';
      iconElement.innerHTML = tab.icon;
      tabElement.appendChild(iconElement);
    }

    // Title
    const titleElement = document.createElement('span');
    titleElement.className = 'umbilical-tab-title';
    titleElement.textContent = tab.title;
    tabElement.appendChild(titleElement);

    // Badge
    if (tab.badge) {
      const badgeElement = document.createElement('span');
      badgeElement.className = 'umbilical-tab-badge';
      badgeElement.textContent = tab.badge;
      tabElement.appendChild(badgeElement);
    }

    // Close button
    if (tab.closable && this.config.showCloseButtons) {
      const closeButton = document.createElement('button');
      closeButton.className = 'umbilical-tab-close';
      closeButton.setAttribute('type', 'button');
      closeButton.setAttribute('aria-label', `Close ${tab.title}`);
      closeButton.innerHTML = '×';
      tabElement.appendChild(closeButton);
    }

    // Content element
    const contentElement = document.createElement('div');
    contentElement.className = 'umbilical-tab-content';
    contentElement.setAttribute('role', 'tabpanel');
    contentElement.setAttribute('aria-labelledby', tab.id);
    contentElement.id = `content-${tab.id}`;

    if (tab.content) {
      if (typeof tab.content === 'string') {
        contentElement.innerHTML = tab.content;
      } else if (tab.content instanceof HTMLElement) {
        contentElement.appendChild(tab.content);
      }
    }

    return { tabElement, contentElement };
  }

  /**
   * Add tab to view
   */
  addTab(tab, index = -1) {
    const { tabElement, contentElement } = this.createTabElement(tab);

    // Add to tabs list
    if (index >= 0 && index < this.elements.tabsList.children.length) {
      this.elements.tabsList.insertBefore(tabElement, this.elements.tabsList.children[index]);
    } else {
      this.elements.tabsList.appendChild(tabElement);
    }

    // Add to content container
    this.elements.contentContainer.appendChild(contentElement);

    // Store references
    this.tabs.set(tab.id, { 
      tabElement, 
      contentElement, 
      tab: { ...tab } 
    });

    // Add animation class
    tabElement.classList.add('newly-added');
    setTimeout(() => {
      tabElement.classList.remove('newly-added');
    }, this.config.animationDuration);

    return { tabElement, contentElement };
  }

  /**
   * Remove tab from view
   */
  removeTab(tabId) {
    const tabData = this.tabs.get(tabId);
    if (!tabData) return;

    const { tabElement, contentElement } = tabData;

    // Animate out
    tabElement.style.transform = 'translateX(-100%)';
    tabElement.style.opacity = '0';

    setTimeout(() => {
      tabElement.remove();
      contentElement.remove();
      this.tabs.delete(tabId);
    }, this.config.animationDuration);
  }

  /**
   * Update tab appearance
   */
  updateTab(tabId, updates) {
    const tabData = this.tabs.get(tabId);
    if (!tabData) return;

    const { tabElement, contentElement, tab } = tabData;
    const updatedTab = { ...tab, ...updates };

    // Update stored tab data
    this.tabs.set(tabId, { ...tabData, tab: updatedTab });

    // Update title
    if (updates.title !== undefined) {
      const titleElement = tabElement.querySelector('.umbilical-tab-title');
      if (titleElement) {
        titleElement.textContent = updates.title;
      }
    }

    // Update icon
    if (updates.icon !== undefined) {
      let iconElement = tabElement.querySelector('.umbilical-tab-icon');
      if (updates.icon) {
        if (!iconElement) {
          iconElement = document.createElement('span');
          iconElement.className = 'umbilical-tab-icon';
          tabElement.insertBefore(iconElement, tabElement.firstChild);
        }
        iconElement.innerHTML = updates.icon;
      } else if (iconElement) {
        iconElement.remove();
      }
    }

    // Update badge
    if (updates.badge !== undefined) {
      let badgeElement = tabElement.querySelector('.umbilical-tab-badge');
      if (updates.badge) {
        if (!badgeElement) {
          badgeElement = document.createElement('span');
          badgeElement.className = 'umbilical-tab-badge';
          const closeButton = tabElement.querySelector('.umbilical-tab-close');
          if (closeButton) {
            tabElement.insertBefore(badgeElement, closeButton);
          } else {
            tabElement.appendChild(badgeElement);
          }
        }
        badgeElement.textContent = updates.badge;
      } else if (badgeElement) {
        badgeElement.remove();
      }
    }

    // Update disabled state
    if (updates.disabled !== undefined) {
      tabElement.classList.toggle('disabled', updates.disabled);
      tabElement.setAttribute('aria-disabled', updates.disabled.toString());
    }

    // Update content
    if (updates.content !== undefined) {
      contentElement.innerHTML = '';
      if (updates.content) {
        if (typeof updates.content === 'string') {
          contentElement.innerHTML = updates.content;
        } else if (updates.content instanceof HTMLElement) {
          contentElement.appendChild(updates.content);
        }
      }
    }

    // Update tooltip
    if (updates.tooltip !== undefined) {
      if (updates.tooltip) {
        tabElement.title = updates.tooltip;
      } else {
        tabElement.removeAttribute('title');
      }
    }
  }

  /**
   * Set active tab
   */
  setActiveTab(tabId) {
    // Remove active state from all tabs
    this.tabs.forEach((tabData, id) => {
      const { tabElement, contentElement } = tabData;
      tabElement.classList.remove('active');
      tabElement.setAttribute('aria-selected', 'false');
      tabElement.setAttribute('tabindex', '-1');
      contentElement.classList.remove('active');
    });

    // Set active state for new tab
    const activeTabData = this.tabs.get(tabId);
    if (activeTabData) {
      const { tabElement, contentElement } = activeTabData;
      tabElement.classList.add('active');
      tabElement.setAttribute('aria-selected', 'true');
      tabElement.setAttribute('tabindex', '0');
      contentElement.classList.add('active');
      
      // Scroll tab into view if needed
      this.scrollTabIntoView(tabId);
    }

    this.activeTabId = tabId;
  }

  /**
   * Scroll tab into view
   */
  scrollTabIntoView(tabId) {
    if (!this.config.scrollable) return;

    const tabData = this.tabs.get(tabId);
    if (!tabData) return;

    const { tabElement } = tabData;
    const { tabsScroller } = this.elements;

    const tabRect = tabElement.getBoundingClientRect();
    const scrollerRect = tabsScroller.getBoundingClientRect();

    if (tabRect.left < scrollerRect.left) {
      // Tab is to the left of visible area
      tabsScroller.scrollTo({
        left: tabsScroller.scrollLeft - (scrollerRect.left - tabRect.left) - 20,
        behavior: 'smooth'
      });
    } else if (tabRect.right > scrollerRect.right) {
      // Tab is to the right of visible area
      tabsScroller.scrollTo({
        left: tabsScroller.scrollLeft + (tabRect.right - scrollerRect.right) + 20,
        behavior: 'smooth'
      });
    }
  }

  /**
   * Add event listener
   */
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    
    // Store for cleanup
    if (!this.eventListeners.has(element)) {
      this.eventListeners.set(element, []);
    }
    this.eventListeners.get(element).push({ event, handler });
  }

  /**
   * Get tab element by ID
   */
  getTabElement(tabId) {
    const tabData = this.tabs.get(tabId);
    return tabData ? tabData.tabElement : null;
  }

  /**
   * Get content element by tab ID
   */
  getContentElement(tabId) {
    const tabData = this.tabs.get(tabId);
    return tabData ? tabData.contentElement : null;
  }

  /**
   * Update theme
   */
  updateTheme(newTheme) {
    this.config.theme = newTheme;
    this.elements.wrapper.setAttribute('data-theme', newTheme);
    this._applyTheme();
  }

  /**
   * Update variant
   */
  updateVariant(newVariant) {
    this.config.variant = newVariant;
    this.elements.wrapper.setAttribute('data-variant', newVariant);
    this._applyTheme(); // Regenerate styles
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    const oldVariant = this.config.variant;
    const oldTheme = this.config.theme;
    
    Object.assign(this.config, newConfig);
    
    // Update data attributes if needed
    if (newConfig.theme && newConfig.theme !== oldTheme) {
      this.elements.wrapper.setAttribute('data-theme', newConfig.theme);
    }
    
    if (newConfig.variant && newConfig.variant !== oldVariant) {
      this.elements.wrapper.setAttribute('data-variant', newConfig.variant);
    }
    
    // Regenerate styles if visual properties changed
    if (newConfig.theme !== oldTheme || 
        newConfig.variant !== oldVariant ||
        newConfig.animationDuration !== undefined) {
      this._applyTheme();
    }
  }

  /**
   * Get all tab elements in order
   */
  getTabElements() {
    return Array.from(this.elements.tabsList.children);
  }

  /**
   * Clear all tabs
   */
  clear() {
    this.elements.tabsList.innerHTML = '';
    this.elements.contentContainer.innerHTML = '';
    this.tabs.clear();
    this.activeTabId = null;
  }

  /**
   * Destroy view and cleanup
   */
  destroy() {
    // Clear resize observer
    if (this.scrollResizeObserver) {
      this.scrollResizeObserver.disconnect();
    }

    // Remove event listeners
    this.eventListeners.forEach((listeners, element) => {
      listeners.forEach(({ event, handler }) => {
        element.removeEventListener(event, handler);
      });
    });
    this.eventListeners.clear();

    // Remove DOM
    if (this.elements.wrapper) {
      this.elements.wrapper.remove();
    }

    // Clear references
    this.tabs.clear();
    this.elements = {};
    this.container = null;
  }
}