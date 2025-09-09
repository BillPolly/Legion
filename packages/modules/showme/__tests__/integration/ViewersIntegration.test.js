/**
 * Integration Tests for Viewers with Real Legion Components
 * 
 * Tests each viewer type with actual asset rendering and display
 * NO MOCKS - Tests real viewer implementations with Legion components
 */

import { AssetDisplayManager } from '../../apps/showme-ui/src/services/AssetDisplayManager.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ResourceManager } from '@legion/resource-manager';
import { ImageRenderer } from '../../src/renderers/ImageRenderer.js';
import { JSONRenderer } from '../../src/renderers/JSONRenderer.js';
import { TableRenderer } from '../../src/renderers/TableRenderer.js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// For DOM simulation in Node environment
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Viewers Integration Tests', () => {
  let server;
  let displayManager;
  let resourceManager;
  let testPort;
  let dom;
  let document;
  let window;

  beforeAll(async () => {
    // Set up ResourceManager
    resourceManager = await ResourceManager.getInstance();
    
    // Find available port
    testPort = 4800 + Math.floor(Math.random() * 100);
    
    // Create DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: `http://localhost:${testPort}`,
      pretendToBeVisual: true,
      resources: 'usable'
    });
    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;
    
    // Start server
    server = new ShowMeServer({ 
      port: testPort,
      skipLegionPackages: true 
    });
    await server.initialize();
    await server.start();
    
    // Create display manager
    displayManager = new AssetDisplayManager({
      container: document.body
    });
    displayManager.serverUrl = `http://localhost:${testPort}`;
    displayManager.setServer(server); // Set server reference for asset fetching
    await displayManager.initialize();
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
    if (dom) {
      dom.window.close();
    }
  });

  describe('ImageRenderer integration', () => {
    test('should render PNG image from URL', async () => {
      const imageUrl = 'https://via.placeholder.com/300x200.png';
      
      // Store asset directly in server state (no HTTP API)
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      server.assets.set(assetId, {
        id: assetId,
        asset: imageUrl,
        type: 'image',
        title: 'Test Image',
        timestamp: Date.now()
      });
      
      const window = displayManager.createWindow({
        title: 'Test PNG Image',
        assetId: assetId
      });
      const windowId = window.id;
      
      expect(windowId).toBeTruthy();
      
      // Verify window was created
      const windowElement = document.getElementById(`window-${windowId}`);
      expect(windowElement).toBeTruthy();
    });

    test('should render base64 encoded image', async () => {
      // Create a small test image (1x1 red pixel)
      const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
      
      // Store asset directly in server state (no HTTP API)
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      server.assets.set(assetId, {
        id: assetId,
        asset: base64Image,
        type: 'image',
        title: 'Base64 Image',
        timestamp: Date.now()
      });
      
      const window = displayManager.createWindow({
        title: 'Base64 Test Image',
        assetId: assetId
      });
      const windowId = window.id;
      
      const windowElement = document.getElementById(`window-${windowId}`);
      expect(windowElement).toBeTruthy();
      
      const imgElement = windowElement.querySelector('img');
      expect(imgElement).toBeTruthy();
      expect(imgElement.src).toContain('data:image');
    });

    test('should handle image loading errors gracefully', async () => {
      const invalidImageUrl = 'https://invalid-domain-12345.com/image.png';
      
      // Store asset directly in server state (no HTTP API)
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      server.assets.set(assetId, {
        id: assetId,
        asset: invalidImageUrl,
        type: 'image',
        title: 'Invalid Image',
        timestamp: Date.now()
      });
      
      const window = displayManager.createWindow({
        title: 'Error Test Image',
        assetId: assetId
      });
      const windowId = window.id;
      
      const windowElement = document.getElementById(`window-${windowId}`);
      const imgElement = windowElement.querySelector('img');
      
      // Simulate error event
      const errorEvent = new window.Event('error');
      imgElement.dispatchEvent(errorEvent);
      
      // Check error handling - should show error message
      await new Promise(resolve => setTimeout(resolve, 100));
      const errorElement = windowElement.querySelector('.error-message');
      expect(errorElement).toBeTruthy();
    });

    test('should apply image viewer controls', async () => {
      const imageUrl = 'https://via.placeholder.com/600x400.png';
      
      // Store asset directly in server state (no HTTP API)
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      server.assets.set(assetId, {
        id: assetId,
        asset: imageUrl,
        type: 'image',
        title: 'Controlled Image',
        timestamp: Date.now()
      });
      
      const window = displayManager.createWindow({
        title: 'Image with Controls',
        assetId: assetId,
        controls: true
      });
      const windowId = window.id;
      
      const windowElement = document.getElementById(`window-${windowId}`);
      
      // Check for control buttons
      const zoomInBtn = windowElement.querySelector('.zoom-in');
      const zoomOutBtn = windowElement.querySelector('.zoom-out');
      const resetBtn = windowElement.querySelector('.zoom-reset');
      
      expect(zoomInBtn).toBeTruthy();
      expect(zoomOutBtn).toBeTruthy();
      expect(resetBtn).toBeTruthy();
    });
  });

  describe('JSONRenderer integration', () => {
    test('should render simple JSON object', async () => {
      const jsonData = {
        name: 'Test User',
        age: 25,
        active: true,
        tags: ['javascript', 'nodejs', 'testing']
      };
      
      // Store asset directly in server state (no HTTP API)
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      server.assets.set(assetId, {
        id: assetId,
        asset: jsonData,
        type: 'json',
        title: 'User Data',
        timestamp: Date.now()
      });
      
      const window = displayManager.createWindow({
        title: 'JSON Data Display',
        assetId: assetId
      });
      const windowId = window.id;
      
      expect(windowId).toBeTruthy();
      
      // Verify window was created
      const windowElement = document.getElementById(`window-${windowId}`);
      expect(windowElement).toBeTruthy();
      
      const preElement = windowElement.querySelector('pre');
      expect(preElement).toBeTruthy();
      expect(preElement.textContent).toContain('Test User');
    });

    test('should render nested JSON with collapsible sections', async () => {
      const nestedData = {
        user: {
          id: 1,
          profile: {
            firstName: 'John',
            lastName: 'Doe',
            address: {
              street: '123 Main St',
              city: 'Anytown',
              country: 'USA'
            }
          },
          settings: {
            theme: 'dark',
            notifications: {
              email: true,
              push: false
            }
          }
        }
      };
      
      // Store asset directly in server state (no HTTP API)
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      server.assets.set(assetId, {
        id: assetId,
        asset: nestedData,
        type: 'json',
        title: 'Nested Data',
        timestamp: Date.now()
      });
      
      const window = displayManager.createWindow({
        title: 'Nested JSON Display',
        assetId: assetId,
        collapsible: true
      });
      const windowId = window.id;
      
      const windowElement = document.getElementById(`window-${windowId}`);
      
      // Check for collapsible elements
      const collapsibleElements = windowElement.querySelectorAll('.json-collapsible');
      expect(collapsibleElements.length).toBeGreaterThan(0);
    });

    test('should handle large JSON arrays', async () => {
      const largeArray = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        value: `Item ${i}`,
        timestamp: Date.now() + i
      }));
      
      // Store asset directly in server state (no HTTP API)
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      server.assets.set(assetId, {
        id: assetId,
        asset: largeArray,
        type: 'json',
        title: 'Large Array',
        timestamp: Date.now()
      });
      
      const window = displayManager.createWindow({
        title: 'Large JSON Array',
        assetId: assetId,
        maxHeight: 400
      });
      const windowId = window.id;
      
      const windowElement = document.getElementById(`window-${windowId}`);
      const contentElement = windowElement.querySelector('.json-content');
      
      // Should have scrollable content
      expect(contentElement.style.maxHeight).toBe('400px');
      expect(contentElement.style.overflow).toBe('auto');
    });
  });

  describe('TableRenderer integration', () => {
    test('should render array of objects as table', async () => {
      const tableData = [
        { id: 1, name: 'Alice', role: 'Developer', active: true },
        { id: 2, name: 'Bob', role: 'Designer', active: false },
        { id: 3, name: 'Charlie', role: 'Manager', active: true }
      ];
      
      // Store asset directly in server state (no HTTP API)
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      server.assets.set(assetId, {
        id: assetId,
        asset: tableData,
        type: 'table',
        title: 'User Table',
        timestamp: Date.now()
      });
      
      const window = displayManager.createWindow({
        title: 'User Data Table',
        assetId: assetId
      });
      const windowId = window.id;
      
      expect(windowId).toBeTruthy();
      
      // Verify window was created
      const windowElement = document.getElementById(`window-${windowId}`);
      expect(windowElement).toBeTruthy();
      
      const table = windowElement.querySelector('table');
      expect(table).toBeTruthy();
      
      // Check headers
      const headers = table.querySelectorAll('thead th');
      expect(headers.length).toBe(4); // id, name, role, active
      
      // Check rows
      const rows = table.querySelectorAll('tbody tr');
      expect(rows.length).toBe(3); // 3 data rows
    });

    test('should render CSV data as table', async () => {
      const csvData = `Name,Age,City
John,30,New York
Jane,25,Los Angeles
Bob,35,Chicago`;
      
      // Store asset directly in server state (no HTTP API)
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      server.assets.set(assetId, {
        id: assetId,
        asset: csvData,
        type: 'csv',
        title: 'CSV Data',
        timestamp: Date.now()
      });
      
      const window = displayManager.createWindow({
        title: 'CSV Table Display',
        assetId: assetId,
        format: 'csv'
      });
      const windowId = window.id;
      
      const windowElement = document.getElementById(`window-${windowId}`);
      const table = windowElement.querySelector('table');
      
      // Check CSV was parsed correctly
      const headers = table.querySelectorAll('thead th');
      expect(headers[0].textContent).toBe('Name');
      expect(headers[1].textContent).toBe('Age');
      expect(headers[2].textContent).toBe('City');
      
      const firstRow = table.querySelector('tbody tr:first-child');
      const cells = firstRow.querySelectorAll('td');
      expect(cells[0].textContent).toBe('John');
      expect(cells[1].textContent).toBe('30');
      expect(cells[2].textContent).toBe('New York');
    });

    test('should support table sorting', async () => {
      const sortableData = [
        { name: 'Zebra', value: 10 },
        { name: 'Apple', value: 30 },
        { name: 'Mango', value: 20 }
      ];
      
      // Store asset directly in server state (no HTTP API)
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      server.assets.set(assetId, {
        id: assetId,
        asset: sortableData,
        type: 'table',
        title: 'Sortable Table',
        timestamp: Date.now()
      });
      
      const window = displayManager.createWindow({
        title: 'Sortable Data Table',
        assetId: assetId,
        sortable: true
      });
      const windowId = window.id;
      
      const windowElement = document.getElementById(`window-${windowId}`);
      
      // Check for sort indicators
      const sortButtons = windowElement.querySelectorAll('th .sort-indicator');
      expect(sortButtons.length).toBeGreaterThan(0);
      
      // Click to sort by name
      const nameHeader = windowElement.querySelector('th[data-column="name"]');
      nameHeader.click();
      
      // Check first row after sorting
      await new Promise(resolve => setTimeout(resolve, 100));
      const firstRow = windowElement.querySelector('tbody tr:first-child td:first-child');
      expect(firstRow.textContent).toBe('Apple');
    });

    test('should support table filtering', async () => {
      const filterableData = [
        { product: 'Laptop', category: 'Electronics', price: 999 },
        { product: 'Mouse', category: 'Electronics', price: 25 },
        { product: 'Desk', category: 'Furniture', price: 350 },
        { product: 'Chair', category: 'Furniture', price: 150 }
      ];
      
      // Store asset directly in server state (no HTTP API)
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      server.assets.set(assetId, {
        id: assetId,
        asset: filterableData,
        type: 'table',
        title: 'Product Table',
        timestamp: Date.now()
      });
      
      const window = displayManager.createWindow({
        title: 'Filterable Product Table',
        assetId: assetId,
        filterable: true
      });
      const windowId = window.id;
      
      const windowElement = document.getElementById(`window-${windowId}`);
      
      // Check for filter input
      const filterInput = windowElement.querySelector('.table-filter');
      expect(filterInput).toBeTruthy();
      
      // Type in filter
      filterInput.value = 'Electronics';
      filterInput.dispatchEvent(new window.Event('input'));
      
      // Check filtered results
      await new Promise(resolve => setTimeout(resolve, 100));
      const visibleRows = windowElement.querySelectorAll('tbody tr:not([hidden])');
      expect(visibleRows.length).toBe(2); // Only electronics items
    });
  });
});