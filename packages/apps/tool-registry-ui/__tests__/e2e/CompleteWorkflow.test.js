/**
 * End-to-end tests for complete Tool Registry UI workflows
 */

import { ToolRegistryUI } from '../../src/index.js';
import { 
  querySelector,
  click,
  type,
  waitForElement,
  getText,
  waitForText,
  createTestContainer,
  cleanupTestContainer,
  waitForUpdates
} from '../helpers/domHelpers.js';
import { createConnectedMockActors } from '../helpers/mockActors.js';

describe('Tool Registry UI - Complete Workflows', () => {
  let ui;
  let container;
  let mockWs;
  let mockActors;
  
  beforeEach(async () => {
    // Create container
    container = createTestContainer();
    
    // Create mock WebSocket
    mockWs = new global.WebSocket('ws://localhost:8080');
    mockWs.readyState = 1; // OPEN
    
    // Create mock actors
    mockActors = createConnectedMockActors();
    
    // Create umbilical with all dependencies
    const umbilical = {
      dom: container,
      websocketUrl: 'ws://localhost:8080',
      createWebSocket: () => mockWs,
      actors: mockActors,
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };
    
    // Create UI instance
    ui = ToolRegistryUI.create(umbilical);
    
    // Wait for initial render
    await waitForUpdates();
  });
  
  afterEach(() => {
    if (ui && ui.destroy) {
      ui.destroy();
    }
    cleanupTestContainer();
    if (mockWs) {
      mockWs.close();
    }
  });
  
  describe('Tool Discovery and Execution Workflow', () => {
    test('should complete full tool discovery to execution flow', async () => {
      // 1. Wait for tools to load
      await waitForElement(container, '.tool-item');
      
      // 2. Search for specific tool
      const searchInput = querySelector(container, '.search-bar input');
      const searchButton = querySelector(container, '.search-bar button');
      
      type(searchInput, 'calculator');
      click(searchButton);
      await waitForUpdates();
      
      // 3. Verify filtered results
      const toolItems = container.querySelectorAll('.tool-item');
      expect(toolItems.length).toBe(1);
      expect(getText(toolItems[0])).toContain('calculator');
      
      // 4. Select the tool
      click(toolItems[0]);
      await waitForUpdates();
      
      // 5. Verify tool details are displayed
      const toolDetails = await waitForElement(container, '.tool-details');
      expect(getText(toolDetails)).toContain('calculator');
      expect(getText(toolDetails)).toContain('Evaluate mathematical expressions');
      
      // 6. Fill in execution parameters
      const executionForm = querySelector(container, '.execution-form');
      const argsTextarea = querySelector(executionForm, 'textarea');
      
      type(argsTextarea, '{"expression": "10 * 5 + 2"}');
      
      // 7. Execute the tool
      const executeButton = querySelector(executionForm, 'button');
      click(executeButton);
      await waitForUpdates();
      
      // 8. Verify execution results
      const results = await waitForElement(container, '.execution-results');
      expect(getText(results)).toContain('42'); // Mock result
      expect(results.classList.contains('success')).toBe(true);
    });
    
    test('should handle tool execution errors gracefully', async () => {
      // Select and try to execute unknown tool
      await waitForElement(container, '.tool-item');
      
      // Create a fake tool execution with invalid params
      const toolItem = container.querySelector('.tool-item');
      click(toolItem);
      await waitForUpdates();
      
      const argsTextarea = querySelector(container, '.execution-form textarea');
      type(argsTextarea, 'invalid json {');
      
      const executeButton = querySelector(container, '.execution-form button');
      click(executeButton);
      await waitForUpdates();
      
      // Should show error
      const errorMessage = await waitForElement(container, '.error-message');
      expect(getText(errorMessage)).toContain('Invalid JSON');
    });
  });
  
  describe('Database Browsing Workflow', () => {
    test('should browse collections and view documents', async () => {
      // 1. Switch to Database tab
      const tabs = container.querySelectorAll('.tab');
      click(tabs[1]);
      await waitForUpdates();
      
      // 2. Wait for collections to load
      await waitForElement(container, '.collection-item');
      
      // 3. Select a collection
      const collectionItems = container.querySelectorAll('.collection-item');
      expect(collectionItems.length).toBeGreaterThan(0);
      
      const toolsCollection = Array.from(collectionItems).find(
        item => getText(item).includes('tools')
      );
      click(toolsCollection);
      await waitForUpdates();
      
      // 4. Verify documents are displayed
      const documents = await waitForElement(container, '.document-item');
      expect(container.querySelectorAll('.document-item').length).toBeGreaterThan(0);
      
      // 5. Verify document content
      const firstDoc = container.querySelector('.document-item');
      expect(getText(firstDoc)).toContain('file_write');
    });
    
    test('should display collection statistics', async () => {
      // Switch to Database tab
      const tabs = container.querySelectorAll('.tab');
      click(tabs[1]);
      await waitForUpdates();
      
      // Check statistics display
      await waitForElement(container, '.database-stats');
      const stats = querySelector(container, '.database-stats');
      
      expect(getText(stats)).toContain('Total Collections: 3');
      expect(getText(stats)).toContain('Total Documents:');
    });
  });
  
  describe('Semantic Search Workflow', () => {
    test('should perform semantic search and display results', async () => {
      // 1. Switch to Database tab
      const tabs = container.querySelectorAll('.tab');
      click(tabs[1]);
      await waitForUpdates();
      
      // 2. Find semantic search interface
      const searchTextarea = await waitForElement(container, '.semantic-search textarea');
      const searchButton = querySelector(container, '.semantic-search button');
      
      // 3. Enter search query
      type(searchTextarea, 'tools for file system operations');
      
      // 4. Execute search
      click(searchButton);
      await waitForUpdates();
      
      // 5. Verify search results
      const results = await waitForElement(container, '.search-results');
      const resultItems = results.querySelectorAll('.result-item');
      
      expect(resultItems.length).toBeGreaterThan(0);
      
      // 6. Check result content
      const firstResult = resultItems[0];
      expect(getText(firstResult)).toContain('file_write');
      expect(getText(firstResult)).toContain('0.95'); // Score
      expect(getText(firstResult)).toContain('usage'); // Perspective
    });
    
    test('should display vector collection information', async () => {
      // Switch to Database tab
      const tabs = container.querySelectorAll('.tab');
      click(tabs[1]);
      await waitForUpdates();
      
      // Check vector collections display
      await waitForElement(container, '.vectors-section');
      const vectorsSection = querySelector(container, '.vectors-section');
      
      expect(getText(vectorsSection)).toContain('tool_perspectives');
      expect(getText(vectorsSection)).toContain('180 vectors');
      expect(getText(vectorsSection)).toContain('384 dimensions');
      expect(getText(vectorsSection)).toContain('Status: green');
    });
  });
  
  describe('Multi-Tab Workflow', () => {
    test('should maintain state when switching tabs', async () => {
      // 1. Select a tool in first tab
      await waitForElement(container, '.tool-item');
      const firstTool = container.querySelector('.tool-item');
      click(firstTool);
      await waitForUpdates();
      
      const selectedToolName = getText(firstTool).split('\n')[0];
      
      // 2. Switch to Database tab
      const tabs = container.querySelectorAll('.tab');
      click(tabs[1]);
      await waitForUpdates();
      
      // 3. Do something in database tab
      await waitForElement(container, '.collection-item');
      
      // 4. Switch back to Tools tab
      click(tabs[0]);
      await waitForUpdates();
      
      // 5. Verify tool is still selected
      const selectedTool = container.querySelector('.tool-item.selected');
      expect(selectedTool).toBeTruthy();
      expect(getText(selectedTool)).toContain(selectedToolName);
      
      // 6. Verify tool details are still displayed
      const toolDetails = container.querySelector('.tool-details');
      expect(toolDetails).toBeTruthy();
      expect(getText(toolDetails)).toContain(selectedToolName);
    });
  });
  
  describe('Error Recovery Workflow', () => {
    test('should recover from connection errors', async () => {
      // 1. Simulate connection loss
      mockWs.readyState = 3; // CLOSED
      mockWs.onclose(new Event('close'));
      
      // 2. Should show connection error
      await waitForElement(container, '.connection-error');
      
      // 3. Simulate reconnection
      mockWs.readyState = 1; // OPEN
      mockWs.onopen(new Event('open'));
      await waitForUpdates();
      
      // 4. Error should clear
      const errorElement = container.querySelector('.connection-error');
      expect(errorElement).toBeFalsy();
      
      // 5. Should reload data
      await waitForElement(container, '.tool-item');
      expect(container.querySelectorAll('.tool-item').length).toBeGreaterThan(0);
    });
    
    test('should handle and display API errors', async () => {
      // Make actor return error
      mockActors.toolRegistryActor.receive = async () => {
        throw new Error('API Error: Rate limit exceeded');
      };
      
      // Try to execute a tool
      await waitForElement(container, '.tool-item');
      const toolItem = container.querySelector('.tool-item');
      click(toolItem);
      await waitForUpdates();
      
      const executeButton = querySelector(container, '.execution-form button');
      click(executeButton);
      await waitForUpdates();
      
      // Should display error
      const errorMessage = await waitForElement(container, '.error-message');
      expect(getText(errorMessage)).toContain('Rate limit exceeded');
    });
  });
  
  describe('Performance and Loading States', () => {
    test('should show loading states during operations', async () => {
      // Slow down actor responses
      const originalReceive = mockActors.toolRegistryActor.receive;
      mockActors.toolRegistryActor.receive = async (msg) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return originalReceive.call(mockActors.toolRegistryActor, msg);
      };
      
      // Trigger a search
      const searchButton = querySelector(container, '.search-bar button');
      click(searchButton);
      
      // Should show loading indicator
      const loading = await waitForElement(container, '.loading');
      expect(getText(loading)).toContain('Loading');
      
      // Wait for completion
      await waitForUpdates();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Loading should be gone
      expect(container.querySelector('.loading')).toBeFalsy();
    });
    
    test('should handle rapid tab switching', async () => {
      const tabs = container.querySelectorAll('.tab');
      
      // Switch tabs rapidly
      for (let i = 0; i < 10; i++) {
        click(tabs[i % 2]);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      await waitForUpdates();
      
      // Should be on the last tab clicked
      const activeTab = container.querySelector('.tab.active');
      expect(activeTab).toBeTruthy();
      
      // Content should match active tab
      const activeTabText = getText(activeTab);
      if (activeTabText.includes('Tool Registry')) {
        expect(container.querySelector('#tools-tab').style.display).not.toBe('none');
      } else {
        expect(container.querySelector('#database-tab').style.display).not.toBe('none');
      }
    });
  });
  
  describe('Keyboard Navigation', () => {
    test('should support keyboard shortcuts', async () => {
      // Test Ctrl+F for search focus
      const searchInput = querySelector(container, '.search-bar input');
      
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true
      }));
      
      await waitForUpdates();
      expect(document.activeElement).toBe(searchInput);
      
      // Test Tab key for navigation
      searchInput.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Tab'
      }));
      
      await waitForUpdates();
      expect(document.activeElement).not.toBe(searchInput);
    });
  });
});