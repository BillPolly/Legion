/**
 * PaginationControls Component - Reusable pagination controls following umbilical protocol
 * 
 * Provides pagination functionality with Previous/Next buttons, page information,
 * and customizable styling for the ShowMe module.
 */

import { ShowMeBaseComponent } from '../base/ShowMeBaseComponent.js';

/**
 * PaginationControls Instance Class
 */
class PaginationControlsInstance {
  constructor(umbilical, config) {
    this.umbilical = umbilical;
    this.config = config;
    this.element = null;
    this.prevButton = null;
    this.nextButton = null;
    this.pageInfoElement = null;
    this.eventListeners = [];
    this._isDestroyed = false;
    
    // Current pagination state
    this.currentPage = this.config.currentPage || 1;
    this.totalItems = this.config.totalItems || 0;
    this.pageSize = this.config.pageSize || 10;
    
    this.createElement();
    this.attachEventListeners();
    this.updateDisplay();
    
    // Handle mount callback
    ShowMeBaseComponent.handleLifecycle('mount', umbilical, this);
  }

  /**
   * Create the pagination controls container and elements
   */
  createElement() {
    // Create container
    this.element = ShowMeBaseComponent.createElement('div', 'showme-pagination-controls', this.config);
    
    // Create previous button
    this.prevButton = document.createElement('button');
    this.prevButton.type = 'button';
    this.prevButton.className = 'pagination-prev-button';
    this.prevButton.innerHTML = this.config.prevText || '← Previous';
    this.prevButton.title = 'Previous page';
    this.prevButton.setAttribute('aria-label', 'Go to previous page');
    
    // Create next button
    this.nextButton = document.createElement('button');
    this.nextButton.type = 'button';
    this.nextButton.className = 'pagination-next-button';
    this.nextButton.innerHTML = this.config.nextText || 'Next →';
    this.nextButton.title = 'Next page';
    this.nextButton.setAttribute('aria-label', 'Go to next page');
    
    // Create page info element
    this.pageInfoElement = document.createElement('span');
    this.pageInfoElement.className = 'pagination-page-info';
    this.pageInfoElement.setAttribute('role', 'status');
    this.pageInfoElement.setAttribute('aria-live', 'polite');
    
    // Assemble structure
    this.element.appendChild(this.prevButton);
    this.element.appendChild(this.pageInfoElement);
    this.element.appendChild(this.nextButton);

    // Apply styling
    this.applyPaginationStyles();
    
    // Append to DOM if parent provided
    if (this.config.dom) {
      this.config.dom.appendChild(this.element);
    }
  }

  /**
   * Apply pagination controls styling
   */
  applyPaginationStyles() {
    // Container styles
    this.element.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: ${this.config.padding || '8px'};
      background: ${this.config.backgroundColor || '#f9f9f9'};
      border-top: 1px solid ${this.config.borderColor || '#ddd'};
      gap: 8px;
      font-family: system-ui, sans-serif;
      font-size: ${this.config.fontSize || '14px'};
    `;

    // Button base styles
    const buttonStyles = `
      padding: 6px 12px;
      border: 1px solid ${this.config.buttonBorderColor || '#ccc'};
      background: ${this.config.buttonBackgroundColor || 'white'};
      border-radius: 4px;
      cursor: pointer;
      font-size: ${this.config.fontSize || '12px'};
      transition: all 0.2s ease;
      color: ${this.config.buttonTextColor || '#333'};
      min-width: 80px;
    `;

    this.prevButton.style.cssText = buttonStyles;
    this.nextButton.style.cssText = buttonStyles;

    // Page info styles
    this.pageInfoElement.style.cssText = `
      font-size: ${this.config.fontSize || '14px'};
      color: ${this.config.infoTextColor || '#666'};
      text-align: center;
      min-width: 200px;
    `;

    // Ensure CSS classes are available
    this.ensurePaginationStyles();
  }

  /**
   * Ensure pagination CSS classes are available in document
   */
  ensurePaginationStyles() {
    const styleId = 'showme-pagination-controls-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .showme-pagination-controls.disabled {
        opacity: 0.5;
        pointer-events: none;
      }

      .pagination-prev-button:hover:not(:disabled),
      .pagination-next-button:hover:not(:disabled) {
        background-color: #f3f4f6;
        border-color: #d1d5db;
      }

      .pagination-prev-button:focus,
      .pagination-next-button:focus {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
      }

      .pagination-prev-button:active:not(:disabled),
      .pagination-next-button:active:not(:disabled) {
        background-color: #e5e7eb;
        transform: scale(0.98);
      }

      .pagination-prev-button:disabled,
      .pagination-next-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background-color: #f9f9f9;
        border-color: #e5e7eb;
        color: #9ca3af;
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Previous button click handler
    const prevHandler = ShowMeBaseComponent.createBoundEventHandler(this, (event) => {
      if (this._isDestroyed || this.config.disabled) return;
      
      if (this.currentPage > 1) {
        const previousPage = this.currentPage;
        this.currentPage--;
        this.updateDisplay();
        
        if (this.config.onPageChange) {
          try {
            this.config.onPageChange(this.currentPage, previousPage, this);
          } catch (error) {
            ShowMeBaseComponent.handleComponentError(error, 'PaginationControls', this.umbilical);
          }
        }
      }
    });

    // Next button click handler  
    const nextHandler = ShowMeBaseComponent.createBoundEventHandler(this, (event) => {
      if (this._isDestroyed || this.config.disabled) return;
      
      const totalPages = this.getTotalPages();
      if (this.currentPage < totalPages) {
        const previousPage = this.currentPage;
        this.currentPage++;
        this.updateDisplay();
        
        if (this.config.onPageChange) {
          try {
            this.config.onPageChange(this.currentPage, previousPage, this);
          } catch (error) {
            ShowMeBaseComponent.handleComponentError(error, 'PaginationControls', this.umbilical);
          }
        }
      }
    });

    // Attach listeners
    this.prevButton.addEventListener('click', prevHandler);
    this.nextButton.addEventListener('click', nextHandler);

    // Store for cleanup
    this.eventListeners.push(
      { element: this.prevButton, event: 'click', handler: prevHandler },
      { element: this.nextButton, event: 'click', handler: nextHandler }
    );
  }

  /**
   * Calculate total pages based on total items and page size
   * @returns {number} Total number of pages
   */
  getTotalPages() {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  /**
   * Update the pagination display
   */
  updateDisplay() {
    if (this._isDestroyed) return;
    
    const totalPages = this.getTotalPages();
    
    // Update button states
    this.prevButton.disabled = this.currentPage <= 1;
    this.nextButton.disabled = this.currentPage >= totalPages;
    
    // Update page information
    const startItem = (this.currentPage - 1) * this.pageSize + 1;
    const endItem = Math.min(this.currentPage * this.pageSize, this.totalItems);
    
    let pageInfoText;
    if (this.totalItems === 0) {
      pageInfoText = 'No items';
    } else if (this.config.showDetailedInfo !== false) {
      pageInfoText = `Page ${this.currentPage} of ${totalPages} (${this.totalItems} total items)`;
    } else {
      pageInfoText = `${startItem}-${endItem} of ${this.totalItems}`;
    }
    
    this.pageInfoElement.textContent = pageInfoText;
  }

  /**
   * Get current page number
   * @returns {number} Current page number
   */
  getCurrentPage() {
    return this.currentPage;
  }

  /**
   * Set current page number
   * @param {number} page - Page number to set
   * @param {boolean} triggerCallback - Whether to trigger page change callback
   */
  setCurrentPage(page, triggerCallback = false) {
    if (this._isDestroyed) return;
    
    const totalPages = this.getTotalPages();
    const previousPage = this.currentPage;
    
    // Clamp to valid range
    this.currentPage = Math.max(1, Math.min(page, totalPages));
    
    this.updateDisplay();
    
    if (triggerCallback && previousPage !== this.currentPage && this.config.onPageChange) {
      try {
        this.config.onPageChange(this.currentPage, previousPage, this);
      } catch (error) {
        ShowMeBaseComponent.handleComponentError(error, 'PaginationControls', this.umbilical);
      }
    }
  }

  /**
   * Get total items count
   * @returns {number} Total items count
   */
  getTotalItems() {
    return this.totalItems;
  }

  /**
   * Set total items count
   * @param {number} totalItems - New total items count
   */
  setTotalItems(totalItems) {
    if (this._isDestroyed) return;
    
    this.totalItems = Math.max(0, totalItems);
    
    // Adjust current page if necessary
    const totalPages = this.getTotalPages();
    if (this.currentPage > totalPages) {
      this.currentPage = Math.max(1, totalPages);
    }
    
    this.updateDisplay();
  }

  /**
   * Get page size
   * @returns {number} Page size
   */
  getPageSize() {
    return this.pageSize;
  }

  /**
   * Set page size
   * @param {number} pageSize - New page size
   */
  setPageSize(pageSize) {
    if (this._isDestroyed) return;
    
    this.pageSize = Math.max(1, pageSize);
    
    // Recalculate current page to maintain roughly the same position
    const currentFirstItem = (this.currentPage - 1) * this.config.pageSize + 1;
    this.currentPage = Math.max(1, Math.ceil(currentFirstItem / this.pageSize));
    
    this.updateDisplay();
  }

  /**
   * Set disabled state
   * @param {boolean} disabled - Whether to disable the pagination
   */
  setDisabled(disabled) {
    if (this._isDestroyed) return;
    
    this.config.disabled = disabled;
    this.prevButton.disabled = disabled || this.currentPage <= 1;
    this.nextButton.disabled = disabled || this.currentPage >= this.getTotalPages();
    
    if (disabled) {
      this.element.classList.add('disabled');
    } else {
      this.element.classList.remove('disabled');
    }
  }

  /**
   * Get the DOM element
   * @returns {HTMLElement} Pagination controls container element
   */
  getElement() {
    return this.element;
  }

  /**
   * Check if component is destroyed
   * @returns {boolean} True if destroyed
   */
  isDestroyed() {
    return this._isDestroyed;
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this._isDestroyed) return;
    
    // Remove event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      if (element && typeof element.removeEventListener === 'function') {
        element.removeEventListener(event, handler);
      }
    });
    
    // Remove from DOM if still attached
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    // Handle destroy callback
    ShowMeBaseComponent.handleLifecycle('destroy', this.umbilical, this);
    
    // Clean up references
    this.element = null;
    this.prevButton = null;
    this.nextButton = null;
    this.pageInfoElement = null;
    this.eventListeners = [];
    this._isDestroyed = true;
  }
}

/**
 * PaginationControls Component Factory
 */
export const PaginationControls = {
  create(umbilical) {
    // 1. Introspection mode
    if (umbilical && umbilical.describe) {
      const requirements = ShowMeBaseComponent.defineRequirements();
      
      // Add pagination-specific requirements
      requirements.add('onPageChange', 'function', 'Page change event handler - optional', false);
      requirements.add('currentPage', 'number', 'Current page number (1-based) - optional', false);
      requirements.add('totalItems', 'number', 'Total number of items - optional', false);
      requirements.add('pageSize', 'number', 'Number of items per page - optional', false);
      requirements.add('prevText', 'string', 'Previous button text - optional', false);
      requirements.add('nextText', 'string', 'Next button text - optional', false);
      requirements.add('showDetailedInfo', 'boolean', 'Show detailed page info - optional', false);
      requirements.add('padding', 'string', 'Container padding CSS value - optional', false);
      requirements.add('backgroundColor', 'string', 'Background color - optional', false);
      requirements.add('borderColor', 'string', 'Border color - optional', false);
      requirements.add('buttonBackgroundColor', 'string', 'Button background color - optional', false);
      requirements.add('buttonBorderColor', 'string', 'Button border color - optional', false);
      requirements.add('buttonTextColor', 'string', 'Button text color - optional', false);
      requirements.add('infoTextColor', 'string', 'Info text color - optional', false);
      requirements.add('fontSize', 'string', 'Font size CSS value - optional', false);
      
      umbilical.describe(requirements);
      return;
    }

    // 2. Validation mode
    if (umbilical && umbilical.validate) {
      const checks = ShowMeBaseComponent.validateCapabilities(umbilical);
      
      const paginationChecks = {
        ...checks,
        hasValidCallback: !umbilical.onPageChange || typeof umbilical.onPageChange === 'function',
        hasValidCurrentPage: !umbilical.currentPage || (typeof umbilical.currentPage === 'number' && umbilical.currentPage >= 1),
        hasValidTotalItems: !umbilical.totalItems || (typeof umbilical.totalItems === 'number' && umbilical.totalItems >= 0),
        hasValidPageSize: !umbilical.pageSize || (typeof umbilical.pageSize === 'number' && umbilical.pageSize >= 1),
        hasValidText: (!umbilical.prevText || typeof umbilical.prevText === 'string') && 
                     (!umbilical.nextText || typeof umbilical.nextText === 'string'),
        hasValidShowDetailedInfo: umbilical.showDetailedInfo === undefined || typeof umbilical.showDetailedInfo === 'boolean'
      };
      
      return umbilical.validate(paginationChecks);
    }

    // 3. Instance creation mode
    if (!umbilical) {
      throw new Error('PaginationControls requires an umbilical object');
    }

    // Extract configuration
    const config = ShowMeBaseComponent.extractConfig(umbilical, {
      currentPage: 1,
      totalItems: 0,
      pageSize: 10,
      prevText: '← Previous',
      nextText: 'Next →',
      showDetailedInfo: true,
      padding: '8px',
      backgroundColor: '#f9f9f9',
      borderColor: '#ddd',
      buttonBackgroundColor: 'white',
      buttonBorderColor: '#ccc',
      buttonTextColor: '#333',
      infoTextColor: '#666',
      fontSize: '14px',
      onPageChange: umbilical.onPageChange
    });

    // Create and return instance
    return new PaginationControlsInstance(umbilical, config);
  }
};