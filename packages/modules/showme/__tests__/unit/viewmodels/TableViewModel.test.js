/**
 * Tests for TableViewModel
 * 
 * Comprehensive test suite for MVVM table state management
 * NO MOCKS - Tests real state management and business logic
 */

import { TableViewModel } from '../../../src/viewmodels/TableViewModel.js';

describe('TableViewModel', () => {
  let viewModel;
  
  // Sample test data
  const sampleData = [
    { id: 1, name: 'John Doe', age: 30, department: 'Engineering' },
    { id: 2, name: 'Jane Smith', age: 28, department: 'Design' },
    { id: 3, name: 'Bob Johnson', age: 35, department: 'Engineering' },
    { id: 4, name: 'Alice Brown', age: 32, department: 'Marketing' },
    { id: 5, name: 'Charlie Wilson', age: 29, department: 'Design' }
  ];

  beforeEach(() => {
    viewModel = new TableViewModel({
      pageSize: 3,
      sortable: true,
      filterable: true,
      paginated: true
    });
  });

  afterEach(() => {
    if (viewModel) {
      viewModel.destroy();
    }
  });

  describe('initialization', () => {
    test('should create with default configuration', () => {
      const defaultViewModel = new TableViewModel();
      
      expect(defaultViewModel.getConfig()).toEqual({
        pageSize: 10,
        sortable: true,
        filterable: true,
        paginated: false,
        allowExport: true
      });
      
      expect(defaultViewModel.getCurrentPage()).toBe(1);
      expect(defaultViewModel.getSortState()).toEqual({ column: null, direction: 'asc' });
      expect(defaultViewModel.getFilterTerm()).toBe('');
      
      defaultViewModel.destroy();
    });

    test('should create with custom configuration', () => {
      const customViewModel = new TableViewModel({
        pageSize: 5,
        sortable: false,
        filterable: false,
        paginated: true,
        allowExport: false
      });
      
      expect(customViewModel.getConfig()).toEqual({
        pageSize: 5,
        sortable: false,
        filterable: false,
        paginated: true,
        allowExport: false
      });
      
      customViewModel.destroy();
    });
  });

  describe('data management', () => {
    test('should set and get data', () => {
      viewModel.setData(sampleData);
      
      expect(viewModel.getOriginalData()).toEqual(sampleData);
      expect(viewModel.getProcessedData()).toEqual(sampleData);
      expect(viewModel.hasData()).toBe(true);
      expect(viewModel.getTotalItems()).toBe(5);
      expect(viewModel.getColumns()).toEqual(['id', 'name', 'age', 'department']);
    });

    test('should handle empty data', () => {
      viewModel.setData([]);
      
      expect(viewModel.getOriginalData()).toEqual([]);
      expect(viewModel.getProcessedData()).toEqual([]);
      expect(viewModel.hasData()).toBe(false);
      expect(viewModel.getTotalItems()).toBe(0);
      expect(viewModel.getColumns()).toEqual([]);
    });

    test('should handle non-array data', () => {
      viewModel.setData(null);
      
      expect(viewModel.getOriginalData()).toEqual([]);
      expect(viewModel.hasData()).toBe(false);
    });

    test('should preserve original data when processing changes', () => {
      viewModel.setData(sampleData);
      
      // Apply filter
      viewModel.setFilterTerm('John');
      
      expect(viewModel.getOriginalData()).toEqual(sampleData);
      expect(viewModel.getProcessedData()).toHaveLength(2); // John Doe, Bob Johnson
    });
  });

  describe('pagination', () => {
    beforeEach(() => {
      viewModel.setData(sampleData);
    });

    test('should handle pagination state', () => {
      expect(viewModel.getCurrentPage()).toBe(1);
      expect(viewModel.getTotalPages()).toBe(2); // 5 items, 3 per page
      expect(viewModel.getPageSize()).toBe(3);
      expect(viewModel.shouldShowPagination()).toBe(true);
    });

    test('should get current page data', () => {
      // First page
      let pageData = viewModel.getCurrentPageData();
      expect(pageData).toHaveLength(3);
      expect(pageData[0].id).toBe(1);
      expect(pageData[2].id).toBe(3);

      // Second page
      viewModel.setCurrentPage(2);
      pageData = viewModel.getCurrentPageData();
      expect(pageData).toHaveLength(2);
      expect(pageData[0].id).toBe(4);
      expect(pageData[1].id).toBe(5);
    });

    test('should navigate pages', () => {
      expect(viewModel.nextPage()).toBe(true);
      expect(viewModel.getCurrentPage()).toBe(2);
      
      expect(viewModel.previousPage()).toBe(true);
      expect(viewModel.getCurrentPage()).toBe(1);
      
      // Can't go below page 1
      expect(viewModel.previousPage()).toBe(false);
      expect(viewModel.getCurrentPage()).toBe(1);
      
      // Go to page 2
      viewModel.setCurrentPage(2);
      
      // Can't go beyond last page
      expect(viewModel.nextPage()).toBe(false);
      expect(viewModel.getCurrentPage()).toBe(2);
    });

    test('should clamp page numbers to valid range', () => {
      expect(viewModel.setCurrentPage(-1)).toBe(false); // Already on page 1
      expect(viewModel.getCurrentPage()).toBe(1);
      
      expect(viewModel.setCurrentPage(0)).toBe(false); // Already on page 1
      expect(viewModel.getCurrentPage()).toBe(1);
      
      expect(viewModel.setCurrentPage(10)).toBe(true); // Clamped to page 2
      expect(viewModel.getCurrentPage()).toBe(2);
    });

    test('should handle page size changes', () => {
      viewModel.setCurrentPage(2); // Start on page 2
      
      viewModel.setPageSize(5); // Increase page size
      expect(viewModel.getPageSize()).toBe(5);
      expect(viewModel.getTotalPages()).toBe(1);
      expect(viewModel.getCurrentPage()).toBe(1); // Adjusted to valid page
    });

    test('should handle pagination with no data', () => {
      viewModel.setData([]);
      
      expect(viewModel.getTotalPages()).toBe(1);
      expect(viewModel.getCurrentPage()).toBe(1);
      expect(viewModel.shouldShowPagination()).toBe(false);
      expect(viewModel.getCurrentPageData()).toEqual([]);
    });
  });

  describe('sorting', () => {
    beforeEach(() => {
      viewModel.setData(sampleData);
    });

    test('should handle sort state', () => {
      expect(viewModel.getSortState()).toEqual({ column: null, direction: 'asc' });
      expect(viewModel.isSortable()).toBe(true);
    });

    test('should sort by column ascending', () => {
      viewModel.setSortState('name', 'asc');
      
      expect(viewModel.getSortState()).toEqual({ column: 'name', direction: 'asc' });
      
      const sortedData = viewModel.getProcessedData();
      expect(sortedData[0].name).toBe('Alice Brown');
      expect(sortedData[1].name).toBe('Bob Johnson');
      expect(sortedData[4].name).toBe('John Doe');
    });

    test('should sort by column descending', () => {
      viewModel.setSortState('age', 'desc');
      
      expect(viewModel.getSortState()).toEqual({ column: 'age', direction: 'desc' });
      
      const sortedData = viewModel.getProcessedData();
      expect(sortedData[0].age).toBe(35); // Bob Johnson
      expect(sortedData[1].age).toBe(32); // Alice Brown
      expect(sortedData[4].age).toBe(28); // Jane Smith
    });

    test('should handle numeric vs string sorting', () => {
      // Test numeric sorting
      viewModel.setSortState('age', 'asc');
      let sortedData = viewModel.getProcessedData();
      expect(sortedData[0].age).toBe(28);
      expect(sortedData[4].age).toBe(35);
      
      // Test string sorting
      viewModel.setSortState('department', 'asc');
      sortedData = viewModel.getProcessedData();
      expect(sortedData[0].department).toBe('Design');
      expect(sortedData[4].department).toBe('Marketing');
    });

    test('should toggle sort direction', () => {
      // First toggle - sort asc
      viewModel.toggleSort('name');
      expect(viewModel.getSortState()).toEqual({ column: 'name', direction: 'asc' });
      
      // Second toggle - sort desc
      viewModel.toggleSort('name');
      expect(viewModel.getSortState()).toEqual({ column: 'name', direction: 'desc' });
      
      // Different column - reset to asc
      viewModel.toggleSort('age');
      expect(viewModel.getSortState()).toEqual({ column: 'age', direction: 'asc' });
    });

    test('should clear sort', () => {
      viewModel.setSortState('name', 'desc');
      expect(viewModel.getSortState().column).toBe('name');
      
      viewModel.clearSort();
      expect(viewModel.getSortState()).toEqual({ column: null, direction: 'asc' });
      
      // Data should be back to original order
      const data = viewModel.getProcessedData();
      expect(data[0].id).toBe(1); // John Doe
      expect(data[1].id).toBe(2); // Jane Smith
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      viewModel.setData(sampleData);
    });

    test('should handle filter state', () => {
      expect(viewModel.getFilterTerm()).toBe('');
      expect(viewModel.isFilterable()).toBe(true);
    });

    test('should filter by term', () => {
      viewModel.setFilterTerm('John');
      
      expect(viewModel.getFilterTerm()).toBe('John');
      
      const filteredData = viewModel.getProcessedData();
      expect(filteredData).toHaveLength(2);
      expect(filteredData[0].name).toBe('John Doe');
      expect(filteredData[1].name).toBe('Bob Johnson');
    });

    test('should filter case-insensitively', () => {
      viewModel.setFilterTerm('ENGINEERING');
      
      const filteredData = viewModel.getProcessedData();
      expect(filteredData).toHaveLength(2);
      expect(filteredData.every(row => row.department === 'Engineering')).toBe(true);
    });

    test('should filter across all columns', () => {
      viewModel.setFilterTerm('30');
      
      const filteredData = viewModel.getProcessedData();
      expect(filteredData).toHaveLength(1);
      expect(filteredData[0].age).toBe(30);
    });

    test('should reset to first page when filtering', () => {
      viewModel.setCurrentPage(2);
      expect(viewModel.getCurrentPage()).toBe(2);
      
      viewModel.setFilterTerm('Design');
      expect(viewModel.getCurrentPage()).toBe(1);
    });

    test('should clear filter', () => {
      viewModel.setFilterTerm('John');
      expect(viewModel.getProcessedData()).toHaveLength(2);
      
      viewModel.clearFilter();
      expect(viewModel.getFilterTerm()).toBe('');
      expect(viewModel.getProcessedData()).toHaveLength(5);
    });

    test('should handle empty filter results', () => {
      viewModel.setFilterTerm('nonexistent');
      
      expect(viewModel.getProcessedData()).toHaveLength(0);
      expect(viewModel.hasCurrentPageData()).toBe(false);
      expect(viewModel.getTotalPages()).toBe(1);
    });
  });

  describe('combined operations', () => {
    beforeEach(() => {
      viewModel.setData(sampleData);
    });

    test('should handle filter + sort combination', () => {
      // Filter for Engineering department
      viewModel.setFilterTerm('Engineering');
      expect(viewModel.getProcessedData()).toHaveLength(2);
      
      // Sort by age descending
      viewModel.setSortState('age', 'desc');
      
      const data = viewModel.getProcessedData();
      expect(data).toHaveLength(2);
      expect(data[0].age).toBe(35); // Bob Johnson
      expect(data[1].age).toBe(30); // John Doe
    });

    test('should handle pagination with filtered data', () => {
      // Set small page size
      viewModel.setPageSize(1);
      
      // Filter to 2 results
      viewModel.setFilterTerm('Engineering');
      expect(viewModel.getTotalPages()).toBe(2);
      expect(viewModel.getCurrentPageData()).toHaveLength(1);
      
      // Navigate pages
      viewModel.nextPage();
      expect(viewModel.getCurrentPage()).toBe(2);
      expect(viewModel.getCurrentPageData()).toHaveLength(1);
    });
  });

  describe('data export', () => {
    beforeEach(() => {
      viewModel.setData(sampleData);
    });

    test('should export as JSON', () => {
      const json = viewModel.exportData('json');
      const parsed = JSON.parse(json);
      
      expect(parsed).toEqual(sampleData);
    });

    test('should export as CSV', () => {
      const csv = viewModel.exportData('csv');
      const lines = csv.split('\n');
      
      expect(lines[0]).toBe('id,name,age,department');
      expect(lines[1]).toBe('1,John Doe,30,Engineering');
      expect(lines).toHaveLength(6); // Header + 5 data rows
    });

    test('should export CSV with quotes for special characters', () => {
      const testData = [{ name: 'John, Jr.', description: 'Has "quotes"' }];
      viewModel.setData(testData);
      
      const csv = viewModel.exportData('csv');
      expect(csv).toContain('"John, Jr."');
      expect(csv).toContain('"Has ""quotes"""');
    });

    test('should export current page only', () => {
      viewModel.setPageSize(2);
      viewModel.setCurrentPage(2);
      
      const json = viewModel.exportData('json', true);
      const parsed = JSON.parse(json);
      
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe(3); // Third item (first on page 2)
    });

    test('should export filtered data', () => {
      viewModel.setFilterTerm('Design');
      
      const json = viewModel.exportData('json');
      const parsed = JSON.parse(json);
      
      expect(parsed).toHaveLength(2);
      expect(parsed.every(row => row.department === 'Design')).toBe(true);
    });

    test('should throw error for unsupported format', () => {
      expect(() => {
        viewModel.exportData('xml');
      }).toThrow('Unsupported export format: xml');
    });
  });

  describe('event listeners', () => {
    beforeEach(() => {
      viewModel.setData(sampleData);
    });

    test('should notify on state changes', () => {
      let stateChanges = 0;
      let lastViewModel = null;
      
      viewModel.onStateChange((vm) => {
        stateChanges++;
        lastViewModel = vm;
      });
      
      viewModel.setCurrentPage(2);
      expect(stateChanges).toBe(1);
      expect(lastViewModel).toBe(viewModel);
      
      viewModel.setSortState('name', 'asc');
      expect(stateChanges).toBe(2);
      
      viewModel.setFilterTerm('test');
      expect(stateChanges).toBe(3);
    });

    test('should notify on data changes', () => {
      let dataChanges = 0;
      let lastOriginal = null;
      let lastProcessed = null;
      
      viewModel.onDataChange((original, processed) => {
        dataChanges++;
        lastOriginal = original;
        lastProcessed = processed;
      });
      
      const newData = [...sampleData, { id: 6, name: 'New User', age: 25, department: 'Sales' }];
      viewModel.setData(newData);
      
      expect(dataChanges).toBe(1);
      expect(lastOriginal).toEqual(newData);
      expect(lastProcessed).toEqual(newData);
    });

    test('should notify on page changes', () => {
      let pageChanges = 0;
      let lastNewPage = null;
      let lastOldPage = null;
      
      viewModel.onPageChange((newPage, oldPage) => {
        pageChanges++;
        lastNewPage = newPage;
        lastOldPage = oldPage;
      });
      
      viewModel.setCurrentPage(2);
      
      expect(pageChanges).toBe(1);
      expect(lastNewPage).toBe(2);
      expect(lastOldPage).toBe(1);
    });

    test('should notify on sort changes', () => {
      let sortChanges = 0;
      let lastColumn = null;
      let lastDirection = null;
      
      viewModel.onSortChange((column, direction) => {
        sortChanges++;
        lastColumn = column;
        lastDirection = direction;
      });
      
      viewModel.setSortState('name', 'desc');
      
      expect(sortChanges).toBe(1);
      expect(lastColumn).toBe('name');
      expect(lastDirection).toBe('desc');
    });

    test('should notify on filter changes', () => {
      let filterChanges = 0;
      let lastTerm = null;
      
      viewModel.onFilterChange((term) => {
        filterChanges++;
        lastTerm = term;
      });
      
      viewModel.setFilterTerm('test');
      
      expect(filterChanges).toBe(1);
      expect(lastTerm).toBe('test');
    });

    test('should handle listener errors gracefully', () => {
      const originalError = console.error;
      let errorMessages = [];
      console.error = (...args) => {
        errorMessages.push(args[0]);
      };
      
      viewModel.onStateChange(() => {
        throw new Error('Listener error');
      });
      
      // Should not throw
      expect(() => {
        viewModel.setCurrentPage(2);
      }).not.toThrow();
      
      expect(errorMessages).toHaveLength(1);
      expect(errorMessages[0]).toBe('Error in state change listener:');
      
      console.error = originalError;
    });

    test('should remove all listeners', () => {
      let changes = 0;
      viewModel.onStateChange(() => changes++);
      viewModel.onDataChange(() => changes++);
      
      viewModel.setCurrentPage(2);
      expect(changes).toBe(1);
      
      viewModel.removeAllListeners();
      
      viewModel.setCurrentPage(1);
      expect(changes).toBe(1); // No additional changes
    });
  });

  describe('state summary', () => {
    test('should provide complete state summary', () => {
      viewModel.setData(sampleData);
      viewModel.setCurrentPage(2);
      viewModel.setSortState('name', 'desc');
      viewModel.setFilterTerm('test');
      
      const state = viewModel.getState();
      
      expect(state).toEqual({
        hasData: true,
        totalItems: 0, // Filtered result count
        currentPage: 1, // Reset due to filter
        totalPages: 1,
        pageSize: 3,
        sortColumn: 'name',
        sortDirection: 'desc',
        filterTerm: 'test',
        shouldShowPagination: false,
        columns: ['id', 'name', 'age', 'department']
      });
    });

    test('should provide state for empty data', () => {
      const state = viewModel.getState();
      
      expect(state).toEqual({
        hasData: false,
        totalItems: 0,
        currentPage: 1,
        totalPages: 1,
        pageSize: 3,
        sortColumn: null,
        sortDirection: 'asc',
        filterTerm: '',
        shouldShowPagination: false,
        columns: []
      });
    });
  });

  describe('cleanup', () => {
    test('should cleanup resources on destroy', () => {
      viewModel.setData(sampleData);
      
      let listenerCalled = false;
      viewModel.onStateChange(() => { listenerCalled = true; });
      
      viewModel.destroy();
      
      // Should clear data
      expect(viewModel.getOriginalData()).toEqual([]);
      expect(viewModel.getProcessedData()).toEqual([]);
      
      // Should remove listeners
      viewModel.setCurrentPage(2); // This would normally trigger listener
      expect(listenerCalled).toBe(false);
    });
  });
});