/**
 * TableViewModel - State management for tabular data rendering
 * 
 * Implements MVVM pattern by separating business logic and state management
 * from DOM manipulation. Manages pagination, sorting, filtering, and data
 * transformations independently of the view layer.
 */

/**
 * TableViewModel class for managing table state and business logic
 */
export class TableViewModel {
  constructor(config = {}) {
    // Configuration
    this.config = {
      pageSize: 10,
      sortable: true,
      filterable: true,
      paginated: false,
      allowExport: true,
      ...config
    };

    // Core state
    this.originalData = [];
    this.processedData = [];
    this.currentPage = 1;
    this.sortColumn = null;
    this.sortDirection = 'asc';
    this.filterTerm = '';
    
    // Event listeners for state changes
    this.stateChangeListeners = [];
    this.dataChangeListeners = [];
    this.pageChangeListeners = [];
    this.sortChangeListeners = [];
    this.filterChangeListeners = [];
  }

  /**
   * Get current configuration
   * @returns {Object} Configuration object
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Set table data
   * @param {Array} data - Raw data array
   */
  setData(data) {
    this.originalData = Array.isArray(data) ? [...data] : [];
    this.processedData = [...this.originalData];
    this.currentPage = 1;
    
    // Apply current filtering and sorting
    this.applyProcessing();
    this.notifyDataChange();
  }

  /**
   * Get original unprocessed data
   * @returns {Array} Original data array
   */
  getOriginalData() {
    return [...this.originalData];
  }

  /**
   * Get processed data (after filtering and sorting)
   * @returns {Array} Processed data array
   */
  getProcessedData() {
    return [...this.processedData];
  }

  /**
   * Get data for current page
   * @returns {Array} Current page data
   */
  getCurrentPageData() {
    if (!this.config.paginated) {
      return this.getProcessedData();
    }

    const startIndex = (this.currentPage - 1) * this.config.pageSize;
    const endIndex = startIndex + this.config.pageSize;
    return this.processedData.slice(startIndex, endIndex);
  }

  /**
   * Get column names from data
   * @returns {Array} Column names
   */
  getColumns() {
    if (this.originalData.length === 0) return [];
    return Object.keys(this.originalData[0]);
  }

  /**
   * Get current page number
   * @returns {number} Current page (1-based)
   */
  getCurrentPage() {
    return this.currentPage;
  }

  /**
   * Set current page
   * @param {number} page - Page number (1-based)
   * @returns {boolean} True if page was changed
   */
  setCurrentPage(page) {
    const totalPages = this.getTotalPages();
    const newPage = Math.max(1, Math.min(page, totalPages));
    
    if (newPage !== this.currentPage) {
      const oldPage = this.currentPage;
      this.currentPage = newPage;
      this.notifyPageChange(newPage, oldPage);
      this.notifyStateChange();
      return true;
    }
    return false;
  }

  /**
   * Go to next page
   * @returns {boolean} True if page was changed
   */
  nextPage() {
    return this.setCurrentPage(this.currentPage + 1);
  }

  /**
   * Go to previous page
   * @returns {boolean} True if page was changed
   */
  previousPage() {
    return this.setCurrentPage(this.currentPage - 1);
  }

  /**
   * Get total number of pages
   * @returns {number} Total pages
   */
  getTotalPages() {
    if (!this.config.paginated) return 1;
    return Math.max(1, Math.ceil(this.processedData.length / this.config.pageSize));
  }

  /**
   * Get total number of items
   * @returns {number} Total items count
   */
  getTotalItems() {
    return this.processedData.length;
  }

  /**
   * Get page size
   * @returns {number} Items per page
   */
  getPageSize() {
    return this.config.pageSize;
  }

  /**
   * Set page size
   * @param {number} pageSize - New page size
   */
  setPageSize(pageSize) {
    if (pageSize > 0 && pageSize !== this.config.pageSize) {
      // Calculate new page to maintain roughly the same position
      const currentFirstItem = (this.currentPage - 1) * this.config.pageSize + 1;
      this.config.pageSize = pageSize;
      this.currentPage = Math.max(1, Math.ceil(currentFirstItem / this.config.pageSize));
      
      this.notifyStateChange();
    }
  }

  /**
   * Get current sort state
   * @returns {Object} Sort state with column and direction
   */
  getSortState() {
    return {
      column: this.sortColumn,
      direction: this.sortDirection
    };
  }

  /**
   * Set sort column and direction
   * @param {string} column - Column to sort by
   * @param {string} direction - Sort direction ('asc' or 'desc')
   */
  setSortState(column, direction = 'asc') {
    if (column !== this.sortColumn || direction !== this.sortDirection) {
      this.sortColumn = column;
      this.sortDirection = direction;
      
      this.applyProcessing();
      this.notifySortChange(column, direction);
      this.notifyStateChange();
    }
  }

  /**
   * Toggle sort on a column
   * @param {string} column - Column to sort by
   */
  toggleSort(column) {
    let direction = 'asc';
    
    if (this.sortColumn === column) {
      direction = this.sortDirection === 'asc' ? 'desc' : 'asc';
    }
    
    this.setSortState(column, direction);
  }

  /**
   * Clear sorting
   */
  clearSort() {
    if (this.sortColumn !== null) {
      this.sortColumn = null;
      this.sortDirection = 'asc';
      
      this.applyProcessing();
      this.notifySortChange(null, 'asc');
      this.notifyStateChange();
    }
  }

  /**
   * Get current filter term
   * @returns {string} Current filter term
   */
  getFilterTerm() {
    return this.filterTerm;
  }

  /**
   * Set filter term
   * @param {string} term - Filter term
   */
  setFilterTerm(term) {
    const newTerm = String(term || '');
    if (newTerm !== this.filterTerm) {
      this.filterTerm = newTerm;
      this.currentPage = 1; // Reset to first page when filtering
      
      this.applyProcessing();
      this.notifyFilterChange(newTerm);
      this.notifyStateChange();
    }
  }

  /**
   * Clear filter
   */
  clearFilter() {
    this.setFilterTerm('');
  }

  /**
   * Check if table has data
   * @returns {boolean} True if table has data
   */
  hasData() {
    return this.originalData.length > 0;
  }

  /**
   * Check if current page has data
   * @returns {boolean} True if current page has data
   */
  hasCurrentPageData() {
    return this.getCurrentPageData().length > 0;
  }

  /**
   * Check if pagination is enabled and has multiple pages
   * @returns {boolean} True if pagination should be shown
   */
  shouldShowPagination() {
    return this.config.paginated && this.getTotalPages() > 1;
  }

  /**
   * Check if sorting is enabled
   * @returns {boolean} True if sorting is enabled
   */
  isSortable() {
    return this.config.sortable;
  }

  /**
   * Check if filtering is enabled
   * @returns {boolean} True if filtering is enabled
   */
  isFilterable() {
    return this.config.filterable;
  }

  /**
   * Export data in specified format
   * @param {string} format - Export format ('json', 'csv')
   * @param {boolean} currentPageOnly - Export only current page data
   * @returns {string} Exported data string
   */
  exportData(format, currentPageOnly = false) {
    const data = currentPageOnly ? this.getCurrentPageData() : this.getProcessedData();
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
      return this.generateCSV(data);
    }
    
    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Generate CSV content from data
   * @private
   * @param {Array} data - Data to export
   * @returns {string} CSV content
   */
  generateCSV(data) {
    if (data.length === 0) return '';

    const columns = this.getColumns();
    const csvRows = [columns.join(',')];

    data.forEach(row => {
      const values = columns.map(column => {
        const value = row[column] || '';
        // Escape quotes and wrap in quotes if contains comma
        if (String(value).includes(',') || String(value).includes('"')) {
          return `"${String(value).replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Apply current processing (filtering and sorting) to data
   * @private
   */
  applyProcessing() {
    let data = [...this.originalData];
    
    // Apply filtering
    if (this.filterTerm) {
      const term = this.filterTerm.toLowerCase();
      data = data.filter(row => {
        return Object.values(row).some(value =>
          String(value).toLowerCase().includes(term)
        );
      });
    }
    
    // Apply sorting
    if (this.sortColumn) {
      data.sort((a, b) => {
        const aVal = a[this.sortColumn] || '';
        const bVal = b[this.sortColumn] || '';
        
        // Try to parse as numbers
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        
        let comparison = 0;
        if (!isNaN(aNum) && !isNaN(bNum)) {
          comparison = aNum - bNum;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }

        return this.sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    
    this.processedData = data;
    
    // Ensure current page is valid
    const totalPages = this.getTotalPages();
    if (this.currentPage > totalPages) {
      this.currentPage = Math.max(1, totalPages);
    }
  }

  /**
   * Add state change listener
   * @param {Function} listener - Callback function
   */
  onStateChange(listener) {
    if (typeof listener === 'function') {
      this.stateChangeListeners.push(listener);
    }
  }

  /**
   * Add data change listener
   * @param {Function} listener - Callback function
   */
  onDataChange(listener) {
    if (typeof listener === 'function') {
      this.dataChangeListeners.push(listener);
    }
  }

  /**
   * Add page change listener
   * @param {Function} listener - Callback function
   */
  onPageChange(listener) {
    if (typeof listener === 'function') {
      this.pageChangeListeners.push(listener);
    }
  }

  /**
   * Add sort change listener
   * @param {Function} listener - Callback function
   */
  onSortChange(listener) {
    if (typeof listener === 'function') {
      this.sortChangeListeners.push(listener);
    }
  }

  /**
   * Add filter change listener
   * @param {Function} listener - Callback function
   */
  onFilterChange(listener) {
    if (typeof listener === 'function') {
      this.filterChangeListeners.push(listener);
    }
  }

  /**
   * Remove all listeners
   */
  removeAllListeners() {
    this.stateChangeListeners = [];
    this.dataChangeListeners = [];
    this.pageChangeListeners = [];
    this.sortChangeListeners = [];
    this.filterChangeListeners = [];
  }

  /**
   * Notify state change listeners
   * @private
   */
  notifyStateChange() {
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(this);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }

  /**
   * Notify data change listeners
   * @private
   */
  notifyDataChange() {
    this.dataChangeListeners.forEach(listener => {
      try {
        listener(this.originalData, this.processedData);
      } catch (error) {
        console.error('Error in data change listener:', error);
      }
    });
  }

  /**
   * Notify page change listeners
   * @private
   * @param {number} newPage - New page number
   * @param {number} oldPage - Previous page number
   */
  notifyPageChange(newPage, oldPage) {
    this.pageChangeListeners.forEach(listener => {
      try {
        listener(newPage, oldPage);
      } catch (error) {
        console.error('Error in page change listener:', error);
      }
    });
  }

  /**
   * Notify sort change listeners
   * @private
   * @param {string} column - Sort column
   * @param {string} direction - Sort direction
   */
  notifySortChange(column, direction) {
    this.sortChangeListeners.forEach(listener => {
      try {
        listener(column, direction);
      } catch (error) {
        console.error('Error in sort change listener:', error);
      }
    });
  }

  /**
   * Notify filter change listeners
   * @private
   * @param {string} term - Filter term
   */
  notifyFilterChange(term) {
    this.filterChangeListeners.forEach(listener => {
      try {
        listener(term);
      } catch (error) {
        console.error('Error in filter change listener:', error);
      }
    });
  }

  /**
   * Get current state summary
   * @returns {Object} State summary
   */
  getState() {
    return {
      hasData: this.hasData(),
      totalItems: this.getTotalItems(),
      currentPage: this.getCurrentPage(),
      totalPages: this.getTotalPages(),
      pageSize: this.getPageSize(),
      sortColumn: this.sortColumn,
      sortDirection: this.sortDirection,
      filterTerm: this.filterTerm,
      shouldShowPagination: this.shouldShowPagination(),
      columns: this.getColumns()
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.removeAllListeners();
    this.originalData = [];
    this.processedData = [];
  }
}