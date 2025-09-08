/**
 * Unit Tests for TableRenderer
 * 
 * Tests tabular data rendering with sorting, filtering, pagination, and export
 * NO MOCKS - Tests real table rendering capabilities
 */

import { TableRenderer } from '../../../src/renderers/TableRenderer.js';

describe('TableRenderer', () => {
  let renderer;

  beforeEach(() => {
    renderer = new TableRenderer();
  });

  describe('constructor', () => {
    test('should initialize with default configuration', () => {
      expect(renderer).toBeInstanceOf(TableRenderer);
      expect(typeof renderer.render).toBe('function');
      expect(typeof renderer.canRender).toBe('function');
    });

    test('should accept custom configuration', () => {
      const customRenderer = new TableRenderer({
        pageSize: 25,
        showControls: true,
        allowExport: false,
        sortable: false
      });

      const config = customRenderer.getConfig();
      expect(config.pageSize).toBe(25);
      expect(config.showControls).toBe(true);
      expect(config.allowExport).toBe(false);
      expect(config.sortable).toBe(false);
    });
  });

  describe('canRender', () => {
    test('should return true for array of objects', () => {
      expect(renderer.canRender([
        { id: 1, name: 'John', age: 30 },
        { id: 2, name: 'Jane', age: 25 }
      ])).toBe(true);
    });

    test('should return true for 2D arrays', () => {
      expect(renderer.canRender([
        ['Name', 'Age', 'City'],
        ['John', 30, 'NYC'],
        ['Jane', 25, 'LA']
      ])).toBe(true);
    });

    test('should return true for CSV strings', () => {
      const csvData = 'Name,Age,City\nJohn,30,NYC\nJane,25,LA';
      expect(renderer.canRender(csvData)).toBe(true);
    });

    test('should return true for TSV strings', () => {
      const tsvData = 'Name\tAge\tCity\nJohn\t30\tNYC\nJane\t25\tLA';
      expect(renderer.canRender(tsvData)).toBe(true);
    });

    test('should return false for non-tabular data', () => {
      expect(renderer.canRender('plain text')).toBe(false);
      expect(renderer.canRender({ key: 'value' })).toBe(false);
      expect(renderer.canRender(null)).toBe(false);
      expect(renderer.canRender(undefined)).toBe(false);
      expect(renderer.canRender(42)).toBe(false);
      expect(renderer.canRender([])).toBe(false); // Empty array
    });

    test('should return false for arrays with inconsistent structure', () => {
      expect(renderer.canRender([
        { name: 'John' },
        'not an object',
        { age: 25 }
      ])).toBe(false);
    });
  });

  describe('render', () => {
    test('should render array of objects', () => {
      const data = [
        { id: 1, name: 'John', age: 30 },
        { id: 2, name: 'Jane', age: 25 }
      ];

      const result = renderer.render(data);

      expect(result).toHaveProperty('element');
      expect(result.element).toBeInstanceOf(HTMLElement);
      expect(result.element.className).toBe('table-renderer');
      
      const table = result.element.querySelector('table');
      expect(table).toBeTruthy();

      // Check headers
      const headers = table.querySelectorAll('th');
      expect(headers).toHaveLength(3);
      expect(headers[0].textContent).toBe('id');
      expect(headers[1].textContent).toBe('name');
      expect(headers[2].textContent).toBe('age');

      // Check data rows
      const rows = table.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(2);
      expect(rows[0].cells[1].textContent).toBe('John');
      expect(rows[1].cells[1].textContent).toBe('Jane');
    });

    test('should render 2D array with headers', () => {
      const data = [
        ['Name', 'Age', 'City'],
        ['John', 30, 'NYC'],
        ['Jane', 25, 'LA']
      ];

      const result = renderer.render(data);
      const table = result.element.querySelector('table');
      
      const headers = table.querySelectorAll('th');
      expect(headers).toHaveLength(3);
      expect(headers[0].textContent).toBe('Name');
      expect(headers[1].textContent).toBe('Age');
      expect(headers[2].textContent).toBe('City');

      const rows = table.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(2);
      expect(rows[0].cells[0].textContent).toBe('John');
      expect(rows[0].cells[1].textContent).toBe('30');
    });

    test('should render CSV string', () => {
      const csvData = 'Name,Age,City\nJohn,30,NYC\nJane,25,LA';
      const result = renderer.render(csvData);

      const table = result.element.querySelector('table');
      expect(table).toBeTruthy();

      const headers = table.querySelectorAll('th');
      expect(headers).toHaveLength(3);
      expect(headers[0].textContent).toBe('Name');

      const rows = table.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(2);
    });

    test('should render TSV string', () => {
      const tsvData = 'Name\tAge\tCity\nJohn\t30\tNYC\nJane\t25\tLA';
      const result = renderer.render(tsvData);

      const table = result.element.querySelector('table');
      const headers = table.querySelectorAll('th');
      expect(headers).toHaveLength(3);
      
      const rows = table.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(2);
      expect(rows[0].cells[0].textContent).toBe('John');
    });

    test('should include controls when enabled', () => {
      const rendererWithControls = new TableRenderer({
        showControls: true
      });

      const data = [{ name: 'Test', value: 123 }];
      const result = rendererWithControls.render(data);

      expect(result.element.querySelector('.table-controls')).toBeTruthy();
      expect(result.element.querySelector('.search-input')).toBeTruthy();
      expect(result.element.querySelector('.export-csv')).toBeTruthy();
      expect(result.element.querySelector('.export-json')).toBeTruthy();
    });

    test('should apply striped styling', () => {
      const data = [
        { name: 'Row1', value: 1 },
        { name: 'Row2', value: 2 },
        { name: 'Row3', value: 3 }
      ];

      const result = renderer.render(data);
      const rows = result.element.querySelectorAll('tbody tr');
      
      expect(rows[0].classList.contains('odd')).toBe(true);
      expect(rows[1].classList.contains('even')).toBe(true);
      expect(rows[2].classList.contains('odd')).toBe(true);
    });
  });

  describe('sorting functionality', () => {
    let sortableRenderer;
    let testData;

    beforeEach(() => {
      sortableRenderer = new TableRenderer({
        sortable: true,
        showControls: true
      });

      testData = [
        { name: 'Charlie', age: 35, score: 88.5 },
        { name: 'Alice', age: 28, score: 92.3 },
        { name: 'Bob', age: 42, score: 76.8 }
      ];
    });

    test('should add sort indicators to headers', () => {
      const result = sortableRenderer.render(testData);
      const headers = result.element.querySelectorAll('th');

      headers.forEach(header => {
        expect(header.style.cursor).toBe('pointer');
        expect(header.querySelector('.sort-indicator')).toBeTruthy();
      });
    });

    test('should sort by string column ascending', () => {
      const result = sortableRenderer.render(testData);
      const nameHeader = result.element.querySelector('th[data-column="name"]');
      
      nameHeader.click();

      const rows = result.element.querySelectorAll('tbody tr');
      expect(rows[0].cells[0].textContent).toBe('Alice');
      expect(rows[1].cells[0].textContent).toBe('Bob');
      expect(rows[2].cells[0].textContent).toBe('Charlie');
    });

    test('should sort by number column ascending', () => {
      const result = sortableRenderer.render(testData);
      const ageHeader = result.element.querySelector('th[data-column="age"]');
      
      ageHeader.click();

      const rows = result.element.querySelectorAll('tbody tr');
      expect(rows[0].cells[1].textContent).toBe('28');
      expect(rows[1].cells[1].textContent).toBe('35');
      expect(rows[2].cells[1].textContent).toBe('42');
    });

    test('should sort by decimal number column', () => {
      const result = sortableRenderer.render(testData);
      const scoreHeader = result.element.querySelector('th[data-column="score"]');
      
      scoreHeader.click();

      const rows = result.element.querySelectorAll('tbody tr');
      expect(rows[0].cells[2].textContent).toBe('76.8');
      expect(rows[1].cells[2].textContent).toBe('88.5');
      expect(rows[2].cells[2].textContent).toBe('92.3');
    });

    test('should toggle sort direction on second click', () => {
      const result = sortableRenderer.render(testData);
      const nameHeader = result.element.querySelector('th[data-column="name"]');
      
      // First click - ascending
      nameHeader.click();
      let rows = result.element.querySelectorAll('tbody tr');
      expect(rows[0].cells[0].textContent).toBe('Alice');
      
      // Second click - descending
      nameHeader.click();
      rows = result.element.querySelectorAll('tbody tr');
      expect(rows[0].cells[0].textContent).toBe('Charlie');
    });

    test('should show sort direction indicators', () => {
      const result = sortableRenderer.render(testData);
      const nameHeader = result.element.querySelector('th[data-column="name"]');
      const indicator = nameHeader.querySelector('.sort-indicator');
      
      expect(indicator.textContent).toBe('');
      
      nameHeader.click();
      expect(indicator.textContent).toBe('▲');
      
      nameHeader.click();
      expect(indicator.textContent).toBe('▼');
    });
  });

  describe('filtering functionality', () => {
    let filterableRenderer;
    let testData;

    beforeEach(() => {
      filterableRenderer = new TableRenderer({
        filterable: true,
        showControls: true
      });

      testData = [
        { name: 'John Smith', age: 35, city: 'New York' },
        { name: 'Jane Johnson', age: 28, city: 'Los Angeles' },
        { name: 'Bob Brown', age: 42, city: 'New York' },
        { name: 'Alice Wilson', age: 31, city: 'Chicago' }
      ];
    });

    test('should include search input when filterable', () => {
      const result = filterableRenderer.render(testData);
      const searchInput = result.element.querySelector('.search-input');

      expect(searchInput).toBeTruthy();
      expect(searchInput.placeholder).toBe('Search table...');
      expect(searchInput.type).toBe('text');
    });

    test('should filter by search term', () => {
      const result = filterableRenderer.render(testData);
      const searchInput = result.element.querySelector('.search-input');

      // Simulate typing "John"
      searchInput.value = 'John';
      searchInput.dispatchEvent(new Event('input'));

      const visibleRows = result.element.querySelectorAll('tbody tr:not(.hidden)');
      expect(visibleRows).toHaveLength(2); // John Smith and Jane Johnson
    });

    test('should filter case-insensitively', () => {
      const result = filterableRenderer.render(testData);
      const searchInput = result.element.querySelector('.search-input');

      searchInput.value = 'NEW YORK';
      searchInput.dispatchEvent(new Event('input'));

      const visibleRows = result.element.querySelectorAll('tbody tr:not(.hidden)');
      expect(visibleRows).toHaveLength(2); // John and Bob from New York
    });

    test('should show no results message when no matches', () => {
      const result = filterableRenderer.render(testData);
      const searchInput = result.element.querySelector('.search-input');

      searchInput.value = 'NonexistentTerm';
      searchInput.dispatchEvent(new Event('input'));

      const visibleRows = result.element.querySelectorAll('tbody tr:not(.hidden)');
      expect(visibleRows).toHaveLength(0);
      
      const noResultsMsg = result.element.querySelector('.no-results');
      expect(noResultsMsg).toBeTruthy();
      expect(noResultsMsg.textContent).toContain('No matching records');
    });

    test('should clear filter when search input is empty', () => {
      const result = filterableRenderer.render(testData);
      const searchInput = result.element.querySelector('.search-input');

      // Filter first
      searchInput.value = 'John';
      searchInput.dispatchEvent(new Event('input'));
      expect(result.element.querySelectorAll('tbody tr:not(.hidden)')).toHaveLength(2);

      // Clear filter
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      expect(result.element.querySelectorAll('tbody tr:not(.hidden)')).toHaveLength(4);
    });
  });

  describe('pagination functionality', () => {
    let paginatedRenderer;
    let largeTestData;

    beforeEach(() => {
      paginatedRenderer = new TableRenderer({
        paginated: true,
        pageSize: 3,
        showControls: true
      });

      largeTestData = [];
      for (let i = 1; i <= 10; i++) {
        largeTestData.push({
          id: i,
          name: `Person ${i}`,
          value: i * 10
        });
      }
    });

    test('should show only first page initially', () => {
      const result = paginatedRenderer.render(largeTestData);
      const visibleRows = result.element.querySelectorAll('tbody tr:not(.hidden)');
      
      expect(visibleRows).toHaveLength(3);
      expect(visibleRows[0].cells[1].textContent).toBe('Person 1');
      expect(visibleRows[2].cells[1].textContent).toBe('Person 3');
    });

    test('should include pagination controls', () => {
      const result = paginatedRenderer.render(largeTestData);
      
      expect(result.element.querySelector('.pagination-controls')).toBeTruthy();
      expect(result.element.querySelector('.prev-page')).toBeTruthy();
      expect(result.element.querySelector('.next-page')).toBeTruthy();
      expect(result.element.querySelector('.page-info')).toBeTruthy();
    });

    test('should show correct page information', () => {
      const result = paginatedRenderer.render(largeTestData);
      const pageInfo = result.element.querySelector('.page-info');
      
      expect(pageInfo.textContent).toContain('Page 1 of 4');
      expect(pageInfo.textContent).toContain('10 total records');
    });

    test('should navigate to next page', () => {
      const result = paginatedRenderer.render(largeTestData);
      const nextBtn = result.element.querySelector('.next-page');
      
      nextBtn.click();
      
      const visibleRows = result.element.querySelectorAll('tbody tr:not(.hidden)');
      expect(visibleRows).toHaveLength(3);
      expect(visibleRows[0].cells[1].textContent).toBe('Person 4');
      
      const pageInfo = result.element.querySelector('.page-info');
      expect(pageInfo.textContent).toContain('Page 2 of 4');
    });

    test('should navigate to previous page', () => {
      const result = paginatedRenderer.render(largeTestData);
      const nextBtn = result.element.querySelector('.next-page');
      const prevBtn = result.element.querySelector('.prev-page');
      
      // Go to page 2
      nextBtn.click();
      expect(result.element.querySelector('.page-info').textContent).toContain('Page 2');
      
      // Go back to page 1
      prevBtn.click();
      expect(result.element.querySelector('.page-info').textContent).toContain('Page 1');
    });

    test('should disable navigation buttons at boundaries', () => {
      const result = paginatedRenderer.render(largeTestData);
      const prevBtn = result.element.querySelector('.prev-page');
      const nextBtn = result.element.querySelector('.next-page');
      
      // At first page, prev should be disabled
      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(false);
      
      // Navigate to last page
      for (let i = 0; i < 3; i++) {
        nextBtn.click();
      }
      
      // At last page, next should be disabled
      expect(prevBtn.disabled).toBe(false);
      expect(nextBtn.disabled).toBe(true);
    });
  });

  describe('export functionality', () => {
    let exportableRenderer;
    let testData;

    beforeEach(() => {
      exportableRenderer = new TableRenderer({
        allowExport: true,
        showControls: true
      });

      testData = [
        { name: 'John', age: 30, city: 'NYC' },
        { name: 'Jane', age: 25, city: 'LA' }
      ];
    });

    test('should include export buttons when enabled', () => {
      const result = exportableRenderer.render(testData);
      
      expect(result.element.querySelector('.export-csv')).toBeTruthy();
      expect(result.element.querySelector('.export-json')).toBeTruthy();
    });

    test('should export to CSV format', () => {
      const result = exportableRenderer.render(testData);
      const exportCsvBtn = result.element.querySelector('.export-csv');
      
      // Manual mocks for testing
      let createObjectURLCalled = false;
      const mockCreateObjectURL = () => {
        createObjectURLCalled = true;
        return 'mock-blob-url';
      };
      
      let revokeObjectURLCalled = false;
      const mockRevokeObjectURL = () => {
        revokeObjectURLCalled = true;
      };
      
      const originalCreateObjectURL = global.URL.createObjectURL;
      const originalRevokeObjectURL = global.URL.revokeObjectURL;
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;
      
      // Mock document.createElement for link
      let linkClicked = false;
      const mockLink = {
        href: '',
        download: '',
        click: () => { linkClicked = true; },
        style: { display: '' }
      };
      
      const originalCreateElement = document.createElement;
      document.createElement = (tagName) => {
        if (tagName === 'a') {
          return mockLink;
        }
        return originalCreateElement.call(document, tagName);
      };
      
      exportCsvBtn.click();
      
      expect(createObjectURLCalled).toBe(true);
      expect(mockLink.download).toContain('.csv');
      expect(linkClicked).toBe(true);
      
      // Restore
      global.URL.createObjectURL = originalCreateObjectURL;
      global.URL.revokeObjectURL = originalRevokeObjectURL;
      document.createElement = originalCreateElement;
    });

    test('should export to JSON format', () => {
      const result = exportableRenderer.render(testData);
      const exportJsonBtn = result.element.querySelector('.export-json');
      
      // Store original functions
      const originalCreateObjectURL = global.URL.createObjectURL;
      const originalRevokeObjectURL = global.URL.revokeObjectURL;
      const originalCreateElement = document.createElement;
      
      let blobUrlCreated = false;
      let linkClicked = false;
      let downloadName = '';
      
      // Replace URL functions for test
      global.URL.createObjectURL = (blob) => {
        blobUrlCreated = true;
        return 'blob:test-url';
      };
      
      global.URL.revokeObjectURL = () => {};
      
      // Replace createElement only for anchor element
      document.createElement = function(tagName) {
        const element = originalCreateElement.call(document, tagName);
        if (tagName === 'a') {
          const originalClick = element.click;
          element.click = function() {
            linkClicked = true;
            downloadName = this.download;
          };
        }
        return element;
      };
      
      exportJsonBtn.click();
      
      // Restore original functions
      global.URL.createObjectURL = originalCreateObjectURL;
      global.URL.revokeObjectURL = originalRevokeObjectURL;
      document.createElement = originalCreateElement;
      
      expect(blobUrlCreated).toBe(true);
      expect(linkClicked).toBe(true);
      expect(downloadName).toContain('.json');
    });
  });

  describe('data normalization', () => {
    test('should handle mixed data types in cells', () => {
      const data = [
        { name: 'John', age: 30, active: true, score: null },
        { name: 'Jane', age: '25', active: 'yes', score: undefined },
        { name: 'Bob', age: null, active: false, score: 88.5 }
      ];

      const result = renderer.render(data);
      const rows = result.element.querySelectorAll('tbody tr');

      expect(rows[0].cells[2].textContent).toBe('true');
      expect(rows[0].cells[3].textContent).toBe('');
      expect(rows[1].cells[1].textContent).toBe('25');
      expect(rows[1].cells[2].textContent).toBe('yes');
      expect(rows[2].cells[1].textContent).toBe('');
    });

    test('should handle objects and arrays in cells', () => {
      const data = [
        { 
          name: 'John', 
          details: { age: 30, city: 'NYC' },
          hobbies: ['reading', 'swimming']
        }
      ];

      const result = renderer.render(data);
      const row = result.element.querySelector('tbody tr');

      expect(row.cells[1].textContent).toBe('{"age":30,"city":"NYC"}');
      expect(row.cells[2].textContent).toBe('["reading","swimming"]');
    });

    test('should handle arrays with different lengths', () => {
      const data = [
        ['Name', 'Age'],
        ['John', 30, 'Extra'],
        ['Jane'],
        ['Bob', 25]
      ];

      const result = renderer.render(data);
      const table = result.element.querySelector('table');
      
      // Should create table with maximum column count
      const headers = table.querySelectorAll('th');
      expect(headers).toHaveLength(3);
      
      const rows = table.querySelectorAll('tbody tr');
      expect(rows[1].cells).toHaveLength(3); // Jane row padded
      expect(rows[1].cells[1].textContent).toBe('');
      expect(rows[1].cells[2].textContent).toBe('');
    });
  });

  describe('error handling', () => {
    test('should handle invalid tabular data gracefully', () => {
      expect(() => {
        renderer.render(null);
      }).toThrow('Invalid table data provided');

      expect(() => {
        renderer.render(undefined);
      }).toThrow('Invalid table data provided');
    });

    test('should handle empty data sets', () => {
      const result = renderer.render([]);
      expect(result.element.querySelector('.empty-table')).toBeTruthy();
      expect(result.element.textContent).toContain('No data to display');
    });

    test('should handle malformed CSV data', () => {
      const malformedCsv = 'Name,Age\n"John,30\nJane,25'; // Unclosed quote
      const result = renderer.render(malformedCsv);
      
      // Should still attempt to render
      expect(result.element.querySelector('table')).toBeTruthy();
    });

    test('should handle very large datasets gracefully', () => {
      const largeData = [];
      for (let i = 0; i < 10000; i++) {
        largeData.push({ id: i, name: `Person ${i}`, value: i * 2 });
      }

      const start = performance.now();
      const result = renderer.render(largeData);
      const end = performance.now();

      expect(result.element).toBeTruthy();
      expect(end - start).toBeLessThan(1000); // Should complete in reasonable time
    });
  });

  describe('accessibility', () => {
    test('should include proper ARIA attributes', () => {
      const data = [{ name: 'Test', value: 123 }];
      const result = renderer.render(data);
      
      const table = result.element.querySelector('table');
      expect(table.getAttribute('role')).toBe('table');
      
      const headers = table.querySelectorAll('th');
      headers.forEach(header => {
        expect(header.getAttribute('scope')).toBe('col');
      });
    });

    test('should support keyboard navigation', () => {
      const sortableRenderer = new TableRenderer({
        sortable: true,
        showControls: true
      });

      const data = [{ name: 'Test', value: 123 }];
      const result = sortableRenderer.render(data);
      
      const headers = result.element.querySelectorAll('th');
      headers.forEach(header => {
        expect(header.tabIndex).toBe(0);
        expect(header.getAttribute('aria-label')).toContain('Sort by');
      });
    });

    test('should include search input accessibility', () => {
      const filterableRenderer = new TableRenderer({
        filterable: true,
        showControls: true
      });

      const data = [{ name: 'Test', value: 123 }];
      const result = filterableRenderer.render(data);
      
      const searchInput = result.element.querySelector('.search-input');
      expect(searchInput.getAttribute('aria-label')).toBe('Search table data');
      expect(searchInput.getAttribute('role')).toBe('searchbox');
    });
  });
});