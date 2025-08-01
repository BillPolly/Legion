/**
 * VirtualScrollManager - Efficient scrolling for large tree documents
 * 
 * Implements virtual scrolling to handle thousands of nodes efficiently
 * by only rendering visible items plus a small buffer.
 */

export class VirtualScrollManager {
  constructor(options = {}) {
    this.options = {
      container: null,
      itemHeight: 30,
      totalItems: 0,
      buffer: 5,
      overscan: 3,
      debounceDelay: 16, // ~60fps
      smoothScroll: true,
      ...options
    };

    this.destroyed = false;
    this.container = this.options.container;
    this.scrollContainer = null;
    this.spacer = null;
    
    // State
    this.visibleRange = { start: 0, end: 0 };
    this.scrollTop = 0;
    this.viewportHeight = 0;
    this.totalHeight = 0;
    this.focusedItemIndex = null;
    
    // Callbacks
    this.callbacks = {
      visibleRangeChange: [],
      focusRestore: [],
      announcement: [],
      batchUpdate: []
    };
    
    // Performance
    this.scrollRAF = null;
    this.scrollTimeout = null;
    this.cache = {
      viewport: null,
      renderInfo: null
    };
    
    // Initialize
    this._init();
  }

  /**
   * Initialize virtual scroll
   * @private
   */
  _init() {
    if (!this.container) {
      throw new Error('Container element is required');
    }

    // Create scroll container structure
    this._createScrollStructure();
    
    // Calculate initial state
    this._updateViewport();
    this._calculateVisibleRange();
    
    // Attach event listeners
    this._attachListeners();
    
    // Initial render callback
    if (this.options.onVisibleRangeChange) {
      this.onVisibleRangeChange(this.options.onVisibleRangeChange);
    }
    
    // Trigger initial range
    this._notifyRangeChange();
  }

  /**
   * Create scroll container structure
   * @private
   */
  _createScrollStructure() {
    // Create inner scroll container
    this.scrollContainer = this.container.querySelector('.virtual-scroll-container');
    if (!this.scrollContainer) {
      this.scrollContainer = document.createElement('div');
      this.scrollContainer.className = 'virtual-scroll-container';
      this.scrollContainer.style.position = 'relative';
      this.scrollContainer.style.width = '100%';
      
      // Move existing content
      while (this.container.firstChild) {
        this.scrollContainer.appendChild(this.container.firstChild);
      }
      
      this.container.appendChild(this.scrollContainer);
    }

    // Create spacer for total height
    this.spacer = document.createElement('div');
    this.spacer.className = 'virtual-scroll-spacer';
    this.spacer.style.position = 'absolute';
    this.spacer.style.top = '0';
    this.spacer.style.left = '0';
    this.spacer.style.width = '1px';
    this.spacer.style.pointerEvents = 'none';
    this._updateSpacerHeight();
    
    this.scrollContainer.appendChild(this.spacer);
  }

  /**
   * Update spacer height
   * @private
   */
  _updateSpacerHeight() {
    this.totalHeight = this.options.totalItems * this.options.itemHeight;
    if (this.spacer) {
      this.spacer.style.height = `${this.totalHeight}px`;
    }
  }

  /**
   * Attach event listeners
   * @private
   */
  _attachListeners() {
    this._handleScroll = this._handleScroll.bind(this);
    this._handleResize = this._handleResize.bind(this);
    
    this.container.addEventListener('scroll', this._handleScroll, { passive: true });
    window.addEventListener('resize', this._handleResize);
  }

  /**
   * Handle scroll event
   * @private
   */
  _handleScroll() {
    // Clear cache immediately
    this.cache.viewport = null;
    this.cache.renderInfo = null;
    
    // Cancel previous updates
    if (this.scrollRAF) {
      cancelAnimationFrame(this.scrollRAF);
    }
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    // Use RAF for smooth updates
    this.scrollRAF = requestAnimationFrame(() => {
      this._updateViewport();
      this._calculateVisibleRange();
      this._notifyRangeChange();
    });

    // Debounce for final update
    this.scrollTimeout = setTimeout(() => {
      this._updateViewport();
      this._calculateVisibleRange();
      this._notifyRangeChange();
      this._announcePosition();
    }, this.options.debounceDelay);
  }

  /**
   * Handle resize event
   * @private
   */
  _handleResize() {
    this._updateViewport();
    this._calculateVisibleRange();
    this._notifyRangeChange();
    
    // Clear cache
    this.cache.viewport = null;
    this.cache.renderInfo = null;
  }

  /**
   * Update viewport measurements
   * @private
   */
  _updateViewport() {
    const rect = this.container.getBoundingClientRect();
    this.viewportHeight = rect.height;
    this.scrollTop = this.container.scrollTop;
  }

  /**
   * Calculate visible range
   * @private
   */
  _calculateVisibleRange() {
    const visibleStart = Math.floor(this.scrollTop / this.options.itemHeight);
    const visibleEnd = Math.ceil((this.scrollTop + this.viewportHeight) / this.options.itemHeight);
    
    // Add buffer
    const start = Math.max(0, visibleStart - this.options.buffer);
    const end = Math.min(this.options.totalItems - 1, visibleEnd + this.options.buffer);
    
    this.visibleRange = { start, end };
  }

  /**
   * Notify range change
   * @private
   */
  _notifyRangeChange() {
    const range = {
      start: this.visibleRange.start,
      end: this.visibleRange.end,
      visibleStart: Math.floor(this.scrollTop / this.options.itemHeight),
      visibleEnd: Math.ceil((this.scrollTop + this.viewportHeight) / this.options.itemHeight)
    };
    
    this.callbacks.visibleRangeChange.forEach(cb => {
      try {
        cb(range);
      } catch (error) {
        console.error('Error in visibleRangeChange callback:', error);
      }
    });
    
    // Check if focused item needs restoration
    if (this.focusedItemIndex !== null) {
      this.callbacks.focusRestore.forEach(cb => {
        try {
          cb(this.focusedItemIndex);
        } catch (error) {
          console.error('Error in focusRestore callback:', error);
        }
      });
    }
  }

  /**
   * Get current viewport info
   */
  getViewport() {
    if (this.cache.viewport) {
      return this.cache.viewport;
    }

    const viewport = {
      height: this.viewportHeight,
      scrollTop: this.scrollTop,
      visibleStart: Math.floor(this.scrollTop / this.options.itemHeight),
      visibleEnd: Math.ceil((this.scrollTop + this.viewportHeight) / this.options.itemHeight),
      totalHeight: this.totalHeight
    };
    
    this.cache.viewport = viewport;
    return viewport;
  }

  /**
   * Get item position
   */
  getItemPosition(index) {
    return {
      top: index * this.options.itemHeight,
      height: this.options.itemHeight
    };
  }

  /**
   * Check if item is visible
   */
  isItemVisible(index) {
    const itemTop = index * this.options.itemHeight;
    const itemBottom = itemTop + this.options.itemHeight;
    
    return itemBottom > this.scrollTop && itemTop < this.scrollTop + this.viewportHeight;
  }

  /**
   * Get render info for items
   */
  getRenderInfo(items) {
    if (this.cache.renderInfo && this.cache.renderInfo.scrollTop === this.scrollTop) {
      return this.cache.renderInfo;
    }

    const { start, end } = this.visibleRange;
    const overscanStart = Math.max(0, start - this.options.overscan);
    const overscanEnd = Math.min(items.length - 1, end + this.options.overscan);
    
    const visibleItems = items.slice(overscanStart, overscanEnd + 1);
    const offsetY = overscanStart * this.options.itemHeight;
    
    const renderInfo = {
      visibleItems,
      offsetY,
      startIndex: overscanStart,
      endIndex: overscanEnd,
      scrollTop: this.scrollTop
    };
    
    this.cache.renderInfo = renderInfo;
    return renderInfo;
  }

  /**
   * Get item render props
   */
  getItemRenderProps(index) {
    const position = this.getItemPosition(index);
    
    return {
      style: {
        position: 'absolute',
        top: `${position.top}px`,
        height: `${position.height}px`,
        width: '100%'
      },
      'data-index': index,
      'data-virtual-row': true
    };
  }

  /**
   * Scroll to item
   */
  scrollToItem(index, options = {}) {
    const position = this.getItemPosition(index);
    const scrollOptions = {
      top: position.top,
      behavior: options.smooth ? 'smooth' : 'auto'
    };
    
    if (this.scrollAnimation) {
      cancelAnimationFrame(this.scrollAnimation);
    }
    
    if (options.smooth && this.options.smoothScroll) {
      this._smoothScrollTo(position.top);
    } else {
      this.container.scrollTop = position.top;
    }
  }

  /**
   * Smooth scroll implementation
   * @private
   */
  _smoothScrollTo(targetTop) {
    const startTop = this.container.scrollTop;
    const distance = targetTop - startTop;
    const duration = 300;
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      this.container.scrollTop = startTop + (distance * easeProgress);
      
      if (progress < 1) {
        this.scrollAnimation = requestAnimationFrame(animate);
      }
    };
    
    this.scrollAnimation = requestAnimationFrame(animate);
  }

  /**
   * Ensure item is visible
   */
  ensureVisible(index) {
    if (!this.isItemVisible(index)) {
      const itemTop = index * this.options.itemHeight;
      const itemBottom = itemTop + this.options.itemHeight;
      
      if (itemTop < this.scrollTop) {
        // Item is above viewport
        this.scrollToItem(index);
      } else if (itemBottom > this.scrollTop + this.viewportHeight) {
        // Item is below viewport
        const scrollTop = itemBottom - this.viewportHeight + this.options.itemHeight;
        this.container.scrollTop = scrollTop;
      }
    }
  }

  /**
   * Update total items
   */
  updateTotalItems(count) {
    this.options.totalItems = count;
    this._updateSpacerHeight();
    this._calculateVisibleRange();
    this._notifyRangeChange();
  }

  /**
   * Update item height
   */
  updateItemHeight(height) {
    this.options.itemHeight = height;
    this._updateSpacerHeight();
    this._calculateVisibleRange();
    this._notifyRangeChange();
  }

  /**
   * Force recalculation
   */
  recalculate() {
    this._updateViewport();
    this._calculateVisibleRange();
    this._notifyRangeChange();
    
    // Clear cache
    this.cache.viewport = null;
    this.cache.renderInfo = null;
  }

  /**
   * Set focused item for restoration
   */
  setFocusedItem(index) {
    this.focusedItemIndex = index;
  }

  /**
   * Announce position for screen readers
   * @private
   */
  _announcePosition() {
    const visibleStart = Math.floor(this.scrollTop / this.options.itemHeight);
    const announcement = `Showing items ${visibleStart + 1} to ${Math.min(visibleStart + Math.ceil(this.viewportHeight / this.options.itemHeight), this.options.totalItems)} of ${this.options.totalItems}`;
    
    this.callbacks.announcement.forEach(cb => {
      try {
        cb(announcement);
      } catch (error) {
        console.error('Error in announcement callback:', error);
      }
    });
  }

  /**
   * Batch update operations
   */
  batchUpdate(updateFn) {
    if (!this.batchTimeout) {
      this.batchUpdates = [];
      
      this.batchTimeout = setTimeout(() => {
        // Execute all updates
        this.batchUpdates.forEach(fn => fn());
        
        // Notify batch complete
        this.callbacks.batchUpdate.forEach(cb => {
          try {
            cb();
          } catch (error) {
            console.error('Error in batchUpdate callback:', error);
          }
        });
        
        this.batchTimeout = null;
        this.batchUpdates = null;
      }, 0);
    }
    
    this.batchUpdates.push(updateFn);
  }

  /**
   * Add callback
   */
  onVisibleRangeChange(callback) {
    this.callbacks.visibleRangeChange.push(callback);
    return () => {
      const index = this.callbacks.visibleRangeChange.indexOf(callback);
      if (index > -1) {
        this.callbacks.visibleRangeChange.splice(index, 1);
      }
    };
  }

  /**
   * Add focus restore callback
   */
  onFocusRestore(callback) {
    this.callbacks.focusRestore.push(callback);
  }

  /**
   * Add announcement callback
   */
  onAnnouncement(callback) {
    this.callbacks.announcement.push(callback);
  }

  /**
   * Add batch update callback
   */
  onBatchUpdate(callback) {
    this.callbacks.batchUpdate.push(callback);
  }

  /**
   * Destroy
   */
  destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    
    // Cancel animations
    if (this.scrollRAF) {
      cancelAnimationFrame(this.scrollRAF);
    }
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    if (this.scrollAnimation) {
      cancelAnimationFrame(this.scrollAnimation);
    }
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    // Remove listeners
    this.container.removeEventListener('scroll', this._handleScroll);
    window.removeEventListener('resize', this._handleResize);
    
    // Remove spacer
    if (this.spacer && this.spacer.parentNode) {
      this.spacer.parentNode.removeChild(this.spacer);
    }
    
    // Clear references
    this.container = null;
    this.scrollContainer = null;
    this.spacer = null;
    this.callbacks = {
      visibleRangeChange: [],
      focusRestore: [],
      announcement: [],
      batchUpdate: []
    };
    this.cache = {};
  }
}