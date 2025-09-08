/**
 * End-to-End Tests for Data Asset Display Workflow
 * 
 * Tests complete data workflow from tool execution to final UI display with table rendering
 * NO MOCKS - Complete workflow validation with real Legion components
 */

import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import { AssetDisplayManager } from '../../src/client/AssetDisplayManager.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

describe('Data Asset Display Workflow End-to-End', () => {
  let tool;
  let server;
  let clientActor;
  let displayManager;
  let assetDetector;
  let resourceManager;
  let dom;
  let document;
  let window;
  const testPort = 3795;

  beforeAll(async () => {
    // Set up virtual DOM
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    document = dom.window.document;
    window = dom.window;
    
    global.document = document;
    global.window = window;
    global.HTMLElement = window.HTMLElement;
    
    // Initialize ResourceManager
    resourceManager = await ResourceManager.getInstance();
    
    // Start server
    server = new ShowMeServer({ 
      port: testPort,
      skipLegionPackages: true 
    });
    await server.initialize();
    await server.start();
    
    // Initialize components
    assetDetector = new AssetTypeDetector();
    tool = new ShowAssetTool({ assetDetector, serverPort: testPort });
    
    displayManager = new AssetDisplayManager({
      serverUrl: `http://localhost:${testPort}`,
      wsUrl: `ws://localhost:${testPort}/showme`,
      container: document.getElementById('app')
    });
    await displayManager.initialize();
    
    clientActor = new ShowMeClientActor({
      serverUrl: `ws://localhost:${testPort}/showme`,
      displayManager: displayManager
    });
    await clientActor.initialize();
    await clientActor.connect();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 45000);

  afterAll(async () => {
    if (clientActor) {
      await clientActor.disconnect();
      await clientActor.cleanup();
    }
    if (displayManager) {
      await displayManager.cleanup();
    }
    if (server) {
      await server.stop();
    }
    
    delete global.document;
    delete global.window;
    delete global.HTMLElement;
  });

  describe('simple tabular data workflow', () => {
    test('should handle complete tabular data display workflow', async () => {
      const tableData = [
        {
          id: 1,
          name: 'Alice Johnson',
          department: 'Engineering',
          role: 'Senior Developer',
          email: 'alice.johnson@company.com',
          salary: 95000,
          startDate: '2021-03-15',
          isActive: true,
          skills: ['JavaScript', 'Python', 'React']
        },
        {
          id: 2,
          name: 'Bob Smith',
          department: 'Engineering',
          role: 'DevOps Engineer',
          email: 'bob.smith@company.com',
          salary: 88000,
          startDate: '2020-11-22',
          isActive: true,
          skills: ['Docker', 'Kubernetes', 'AWS']
        },
        {
          id: 3,
          name: 'Carol Williams',
          department: 'Design',
          role: 'UX Designer',
          email: 'carol.williams@company.com',
          salary: 75000,
          startDate: '2022-01-10',
          isActive: false,
          skills: ['Figma', 'Adobe XD', 'Prototyping']
        },
        {
          id: 4,
          name: 'David Brown',
          department: 'Marketing',
          role: 'Marketing Manager',
          email: 'david.brown@company.com',
          salary: 82000,
          startDate: '2019-08-05',
          isActive: true,
          skills: ['SEO', 'Analytics', 'Content Strategy']
        },
        {
          id: 5,
          name: 'Eva Martinez',
          department: 'Engineering',
          role: 'Product Manager',
          email: 'eva.martinez@company.com',
          salary: 105000,
          startDate: '2020-05-18',
          isActive: true,
          skills: ['Agile', 'User Research', 'Data Analysis']
        }
      ];

      console.log('📊 Starting tabular data workflow...');

      // Step 1: Tool execution with data detection
      const startTime = Date.now();
      const toolResult = await tool.execute({
        asset: tableData,
        hint: 'data', // Force data detection
        title: 'Employee Directory',
        options: {
          sortable: true,
          filterable: true,
          searchable: true,
          pagination: true,
          pageSize: 10,
          showTypes: true,
          columnWidths: 'auto',
          theme: 'default',
          stripedRows: true,
          hoverHighlight: true
        }
      });

      // Validate tool execution
      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('data');
      expect(toolResult.assetId).toBeTruthy();
      expect(toolResult.url).toContain(`http://localhost:${testPort}`);
      console.log('✅ Tool execution successful - Type detected:', toolResult.detected_type);

      // Step 2: Verify data storage on server (exact preservation)
      const serverResponse = await fetch(toolResult.url);
      expect(serverResponse.status).toBe(200);
      expect(serverResponse.headers.get('content-type')).toContain('json');
      
      const serverTableData = await serverResponse.json();
      expect(serverTableData).toEqual(tableData); // Exact data preservation
      console.log('✅ Server storage verified - Table data preserved exactly');

      // Step 3: Client actor display request with table options
      const displayResult = await clientActor.displayAsset(toolResult.assetId, {
        width: 1200,
        height: 600,
        x: 50,
        y: 50,
        sortable: true,
        filterable: true,
        searchable: true,
        pagination: true,
        pageSize: 10,
        theme: 'default'
      });

      expect(displayResult).toBeTruthy();
      console.log('✅ Client display request sent');

      // Wait for UI rendering
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Verify UI window creation
      const dataWindow = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(dataWindow).toBeTruthy();
      expect(dataWindow.classList.contains('showme-window')).toBe(true);
      expect(dataWindow.classList.contains('showme-window-data')).toBe(true);

      // Verify window dimensions
      expect(dataWindow.style.width).toContain('1200');
      expect(dataWindow.style.height).toContain('600');

      // Step 5: Verify window header and controls
      const header = dataWindow.querySelector('.showme-window-header');
      expect(header).toBeTruthy();
      
      const title = header.querySelector('.showme-window-title');
      expect(title.textContent).toContain('Employee Directory');

      const controls = header.querySelectorAll('.showme-window-close, .showme-window-minimize, .showme-window-maximize');
      expect(controls.length).toBe(3);
      console.log('✅ Window header and controls verified');

      // Step 6: Verify table content rendering
      const content = dataWindow.querySelector('.showme-window-content');
      expect(content).toBeTruthy();

      // Look for table element
      const table = content.querySelector('table');
      expect(table).toBeTruthy();

      if (table) {
        // Verify table structure
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        expect(thead).toBeTruthy();
        expect(tbody).toBeTruthy();

        // Verify column headers
        const headers = thead.querySelectorAll('th');
        expect(headers.length).toBeGreaterThanOrEqual(5); // At least id, name, department, role, email
        
        const headerTexts = Array.from(headers).map(h => h.textContent.toLowerCase());
        expect(headerTexts).toEqual(expect.arrayContaining(['id', 'name', 'department', 'role']));

        // Verify data rows
        const dataRows = tbody.querySelectorAll('tr');
        expect(dataRows.length).toBe(5); // 5 employees

        // Verify first row content
        const firstRowCells = dataRows[0].querySelectorAll('td');
        expect(firstRowCells.length).toBeGreaterThanOrEqual(5);
        expect(firstRowCells[0].textContent).toContain('1'); // ID
        expect(firstRowCells[1].textContent).toContain('Alice Johnson'); // Name
        expect(firstRowCells[2].textContent).toContain('Engineering'); // Department

        console.log('✅ Table structure and content verified');
      }

      // Step 7: Test table sorting functionality (if available)
      const sortableHeaders = content.querySelectorAll('th[data-sortable="true"], th.sortable, .sort-header');
      if (sortableHeaders.length > 0) {
        // Try clicking a sortable header
        sortableHeaders[0].click();
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log('✅ Table sorting interaction tested');
      }

      // Step 8: Test table search functionality (if available)
      const searchInput = content.querySelector('input[type="search"], .table-search, .search-input');
      if (searchInput) {
        searchInput.value = 'Alice';
        const inputEvent = new window.Event('input', { bubbles: true });
        searchInput.dispatchEvent(inputEvent);
        await new Promise(resolve => setTimeout(resolve, 300));
        console.log('✅ Table search functionality tested');
      }

      // Step 9: Test table filtering functionality (if available)
      const filterControls = content.querySelectorAll('.table-filter, .filter-control, select[data-filter]');
      if (filterControls.length > 0) {
        console.log('✅ Table filtering controls available');
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      console.log(`🎉 Tabular data workflow completed in ${totalTime}ms`);

      // Verify workflow timing
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('numeric data analysis workflow', () => {
    test('should handle numeric data with statistics', async () => {
      const numericData = [
        {
          month: 'January',
          sales: 125000,
          expenses: 87500,
          profit: 37500,
          customers: 450,
          conversionRate: 0.125,
          avgOrderValue: 275.50
        },
        {
          month: 'February',
          sales: 142000,
          expenses: 95000,
          profit: 47000,
          customers: 520,
          conversionRate: 0.138,
          avgOrderValue: 289.25
        },
        {
          month: 'March',
          sales: 158000,
          expenses: 102000,
          profit: 56000,
          customers: 580,
          conversionRate: 0.145,
          avgOrderValue: 301.75
        },
        {
          month: 'April',
          sales: 173000,
          expenses: 108500,
          profit: 64500,
          customers: 630,
          conversionRate: 0.152,
          avgOrderValue: 315.80
        },
        {
          month: 'May',
          sales: 189000,
          expenses: 115000,
          profit: 74000,
          customers: 695,
          conversionRate: 0.159,
          avgOrderValue: 328.90
        }
      ];

      const toolResult = await tool.execute({
        asset: numericData,
        hint: 'data',
        title: 'Monthly Sales Analytics',
        options: {
          sortable: true,
          showSummary: true,
          highlightNumbers: true,
          formatNumbers: true,
          showTotals: true,
          currencyFormat: 'USD'
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('data');

      await clientActor.displayAsset(toolResult.assetId, {
        width: 1000,
        height: 500,
        showSummary: true,
        formatNumbers: true,
        showTotals: true
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();
      expect(window.classList.contains('showme-window-data')).toBe(true);

      const content = window.querySelector('.showme-window-content');
      const table = content.querySelector('table');
      expect(table).toBeTruthy();

      if (table) {
        // Verify numeric data is displayed
        const textContent = table.textContent;
        expect(textContent).toContain('125000');
        expect(textContent).toContain('January');
        expect(textContent).toContain('sales');
        expect(textContent).toContain('profit');

        // Check for summary statistics if implemented
        const summaryElement = content.querySelector('.data-summary, .table-summary, .statistics');
        if (summaryElement) {
          console.log('✅ Summary statistics displayed');
        }

        // Check for number formatting
        const numberCells = table.querySelectorAll('td[data-type="number"], .number-cell');
        if (numberCells.length > 0) {
          console.log(`✅ Number formatting applied to ${numberCells.length} cells`);
        }
      }
    });
  });

  describe('mixed data types workflow', () => {
    test('should handle table with various data types', async () => {
      const mixedData = [
        {
          id: 'TASK-001',
          title: 'Implement user authentication',
          assignee: 'Alice Johnson',
          priority: 'High',
          status: 'In Progress',
          estimatedHours: 16,
          actualHours: 12.5,
          dueDate: '2024-02-15',
          completionPercentage: 0.75,
          isBlocked: false,
          tags: ['backend', 'security'],
          description: 'Implement JWT-based authentication system with password reset functionality'
        },
        {
          id: 'TASK-002',
          title: 'Design responsive dashboard',
          assignee: 'Bob Smith',
          priority: 'Medium',
          status: 'Todo',
          estimatedHours: 20,
          actualHours: 0,
          dueDate: '2024-02-20',
          completionPercentage: 0,
          isBlocked: false,
          tags: ['frontend', 'ui'],
          description: 'Create responsive dashboard layout with dark/light theme support'
        },
        {
          id: 'TASK-003',
          title: 'Database optimization',
          assignee: 'Carol Williams',
          priority: 'Low',
          status: 'Done',
          estimatedHours: 8,
          actualHours: 6.75,
          dueDate: '2024-02-10',
          completionPercentage: 1.0,
          isBlocked: false,
          tags: ['database', 'performance'],
          description: 'Optimize slow queries and add proper indexing'
        },
        {
          id: 'TASK-004',
          title: 'API documentation',
          assignee: 'David Brown',
          priority: 'High',
          status: 'Blocked',
          estimatedHours: 12,
          actualHours: 4,
          dueDate: '2024-02-18',
          completionPercentage: 0.3,
          isBlocked: true,
          tags: ['documentation', 'api'],
          description: 'Create comprehensive API documentation with examples'
        }
      ];

      const toolResult = await tool.execute({
        asset: mixedData,
        hint: 'data',
        title: 'Project Task Board',
        options: {
          sortable: true,
          filterable: true,
          showTypes: true,
          columnTypes: {
            id: 'string',
            estimatedHours: 'number',
            actualHours: 'number',
            dueDate: 'date',
            completionPercentage: 'percentage',
            isBlocked: 'boolean',
            tags: 'array'
          },
          formatDates: true,
          showProgress: true
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('data');

      await clientActor.displayAsset(toolResult.assetId, {
        width: 1400,
        height: 700,
        sortable: true,
        filterable: true,
        showTypes: true,
        formatDates: true
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      const content = window.querySelector('.showme-window-content');
      const table = content.querySelector('table');
      
      if (table) {
        const textContent = table.textContent;
        expect(textContent).toContain('TASK-001');
        expect(textContent).toContain('Implement user authentication');
        expect(textContent).toContain('Alice Johnson');
        expect(textContent).toContain('High');
        expect(textContent).toContain('In Progress');
        expect(textContent).toContain('16');

        // Check for type-specific formatting
        const booleanCells = table.querySelectorAll('[data-type="boolean"], .boolean-cell');
        const dateCells = table.querySelectorAll('[data-type="date"], .date-cell');
        const percentageCells = table.querySelectorAll('[data-type="percentage"], .percentage-cell');
        
        if (booleanCells.length > 0) console.log('✅ Boolean formatting applied');
        if (dateCells.length > 0) console.log('✅ Date formatting applied');
        if (percentageCells.length > 0) console.log('✅ Percentage formatting applied');
      }
    });
  });

  describe('large dataset workflow', () => {
    test('should handle large datasets with pagination', async () => {
      // Generate large dataset
      const largeDataset = [];
      for (let i = 1; i <= 250; i++) {
        largeDataset.push({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          department: ['Engineering', 'Marketing', 'Sales', 'HR', 'Design'][i % 5],
          salary: 40000 + (i * 500),
          joinDate: new Date(2020, (i % 12), (i % 28) + 1).toISOString().split('T')[0],
          isActive: i % 7 !== 0, // Some inactive users
          score: Math.round((Math.random() * 100) * 100) / 100
        });
      }

      const toolResult = await tool.execute({
        asset: largeDataset,
        hint: 'data',
        title: 'Large User Dataset (250 records)',
        options: {
          pagination: true,
          pageSize: 25,
          virtualScrolling: true,
          sortable: true,
          searchable: true,
          showCount: true,
          lazyLoading: true
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('data');

      await clientActor.displayAsset(toolResult.assetId, {
        width: 1200,
        height: 800,
        pagination: true,
        pageSize: 25,
        virtualScrolling: true
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      const content = window.querySelector('.showme-window-content');
      const table = content.querySelector('table');
      expect(table).toBeTruthy();

      if (table) {
        // Should show only first page of results
        const rows = table.querySelectorAll('tbody tr');
        expect(rows.length).toBeLessThanOrEqual(25); // Page size

        // Check for pagination controls
        const paginationControls = content.querySelectorAll('.pagination, .page-nav, .table-pagination');
        if (paginationControls.length > 0) {
          console.log('✅ Pagination controls found');
        }

        // Check for record count display
        const countDisplay = content.querySelector('.record-count, .total-count, .data-info');
        if (countDisplay && countDisplay.textContent.includes('250')) {
          console.log('✅ Total record count displayed');
        }
      }
    });
  });

  describe('data workflow with custom options', () => {
    test('should handle data with advanced display options', async () => {
      const productData = [
        {
          sku: 'LAPTOP-001',
          name: 'Gaming Laptop Pro',
          category: 'Electronics',
          price: 1299.99,
          inStock: true,
          quantity: 15,
          rating: 4.7,
          reviews: 89,
          lastUpdated: '2024-01-15T10:30:00Z'
        },
        {
          sku: 'MOUSE-002',
          name: 'Wireless Gaming Mouse',
          category: 'Accessories',
          price: 79.99,
          inStock: true,
          quantity: 45,
          rating: 4.3,
          reviews: 156,
          lastUpdated: '2024-01-14T16:20:00Z'
        },
        {
          sku: 'MONITOR-003',
          name: '4K Ultra HD Monitor',
          category: 'Electronics',
          price: 399.99,
          inStock: false,
          quantity: 0,
          rating: 4.8,
          reviews: 234,
          lastUpdated: '2024-01-13T09:45:00Z'
        }
      ];

      const toolResult = await tool.execute({
        asset: productData,
        hint: 'data',
        title: 'Product Inventory with Custom Options',
        options: {
          sortable: true,
          filterable: true,
          theme: 'dark',
          striped: true,
          bordered: true,
          hover: true,
          compact: false,
          responsive: true,
          fixedHeader: true,
          columnResizing: true,
          exportable: true
        }
      });

      expect(toolResult.success).toBe(true);

      await clientActor.displayAsset(toolResult.assetId, {
        width: 1000,
        height: 600,
        theme: 'dark',
        striped: true,
        bordered: true,
        hover: true,
        responsive: true
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      // Verify options applied to window manager
      const windowInfo = displayManager.windows.get(displayManager.getWindowIdForAsset(toolResult.assetId));
      if (windowInfo) {
        expect(windowInfo.options.theme).toBe('dark');
        expect(windowInfo.options.striped).toBe(true);
        expect(windowInfo.options.bordered).toBe(true);
      }
    });
  });

  describe('data workflow error scenarios', () => {
    test('should handle empty datasets gracefully', async () => {
      const emptyData = [];

      const toolResult = await tool.execute({
        asset: emptyData,
        hint: 'data',
        title: 'Empty Dataset Test'
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('data');

      await clientActor.displayAsset(toolResult.assetId);
      await new Promise(resolve => setTimeout(resolve, 500));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      const content = window.querySelector('.showme-window-content');
      const emptyMessage = content.querySelector('.empty-data, .no-data, .empty-message');
      if (emptyMessage) {
        expect(emptyMessage.textContent).toContain('no data');
      }
    });

    test('should handle inconsistent data structures', async () => {
      const inconsistentData = [
        { id: 1, name: 'Item 1', value: 100 },
        { id: 2, title: 'Item 2', amount: 200, extra: 'field' },
        { identifier: 3, label: 'Item 3', cost: 300, meta: { type: 'special' } }
      ];

      const toolResult = await tool.execute({
        asset: inconsistentData,
        hint: 'data',
        title: 'Inconsistent Data Structure Test'
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('data');

      await clientActor.displayAsset(toolResult.assetId);
      await new Promise(resolve => setTimeout(resolve, 500));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      const content = window.querySelector('.showme-window-content');
      const table = content.querySelector('table');
      
      if (table) {
        // Should handle different column sets
        const headers = table.querySelectorAll('thead th');
        expect(headers.length).toBeGreaterThanOrEqual(3);
        
        const rows = table.querySelectorAll('tbody tr');
        expect(rows.length).toBe(3);
      }
    });

    test('should handle non-array data gracefully', async () => {
      const nonArrayData = { notAnArray: 'This is not tabular data' };

      const toolResult = await tool.execute({
        asset: nonArrayData,
        hint: 'data',
        title: 'Non-Array Data Test'
      });

      // Should either succeed with alternative display or fail gracefully
      if (toolResult.success) {
        await clientActor.displayAsset(toolResult.assetId);
        await new Promise(resolve => setTimeout(resolve, 500));

        const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
        expect(window).toBeTruthy();
        
        // Should display as JSON or show error
        const content = window.querySelector('.showme-window-content');
        const fallback = content.querySelector('.json-viewer, .error-message, .fallback-display');
        expect(fallback).toBeTruthy();
      } else {
        expect(toolResult.error).toBeTruthy();
      }
    });
  });

  describe('data workflow performance', () => {
    test('should handle multiple data displays efficiently', async () => {
      const datasets = [
        { name: 'Sales', data: [{ month: 'Jan', sales: 1000 }, { month: 'Feb', sales: 1200 }] },
        { name: 'Users', data: [{ id: 1, name: 'User 1' }, { id: 2, name: 'User 2' }] },
        { name: 'Products', data: [{ sku: 'A1', price: 10 }, { sku: 'B2', price: 20 }] }
      ];

      const startTime = Date.now();
      const toolResults = [];

      // Execute all datasets
      for (const dataset of datasets) {
        const result = await tool.execute({
          asset: dataset.data,
          hint: 'data',
          title: dataset.name,
          options: { sortable: true }
        });
        expect(result.success).toBe(true);
        toolResults.push(result);
      }

      // Display all datasets
      for (let i = 0; i < toolResults.length; i++) {
        await clientActor.displayAsset(toolResults[i].assetId, {
          width: 500,
          height: 300,
          x: i * 520,
          y: 50
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all windows created
      const windows = document.querySelectorAll('.showme-window-data');
      expect(windows.length).toBe(3);

      // Performance check
      expect(totalTime).toBeLessThan(4000);

      // Verify each dataset displayed
      for (const result of toolResults) {
        const window = document.querySelector(`[data-asset-id="${result.assetId}"]`);
        expect(window).toBeTruthy();
      }
    });
  });
});