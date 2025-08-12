/**
 * Unit tests for ToolRegistryView with jsdom
 */

import { ToolRegistryView } from '../../../src/view/ToolRegistryView.js';
import { 
  querySelector, 
  querySelectorAll, 
  click, 
  type, 
  waitForElement,
  getText,
  isVisible,
  hasClass,
  createTestContainer,
  cleanupTestContainer,
  waitForUpdates
} from '../../helpers/domHelpers.js';

describe('ToolRegistryView', () => {
  let view;
  let container;
  
  beforeEach(() => {
    container = createTestContainer();
    view = new ToolRegistryView(container);
  });
  
  afterEach(() => {
    if (view) {
      view.destroy();
      view = null;
    }
    cleanupTestContainer();
  });
  
  describe('Initialization and Rendering', () => {
    test('should render main container with tabs', () => {
      expect(container.querySelector('.tool-registry-container')).toBeTruthy();
      expect(container.querySelector('.tabs-container')).toBeTruthy();
      expect(container.querySelector('.tab-content')).toBeTruthy();
    });
    
    test('should render two tabs', () => {
      const tabs = querySelectorAll(container, '.tab');
      expect(tabs).toHaveLength(2);
      expect(getText(tabs[0])).toContain('Tool Registry');
      expect(getText(tabs[1])).toContain('Database & Vectors');
    });
    
    test('should have Tool Registry tab active by default', () => {
      const toolsTab = container.querySelector('.tab');
      expect(hasClass(toolsTab, 'active')).toBe(true);
      
      const toolsContent = container.querySelector('#tools-tab');
      expect(isVisible(toolsContent)).toBe(true);
      
      const dbContent = container.querySelector('#database-tab');
      expect(isVisible(dbContent)).toBe(false);
    });
    
    test('should inject CSS styles', () => {
      const styleElement = document.head.querySelector('style[data-component="tool-registry"]');
      expect(styleElement).toBeTruthy();
      expect(styleElement.textContent).toContain('.tool-registry-container');
    });
  });
  
  describe('Tab Switching', () => {
    test('should switch tabs on click', async () => {
      const tabs = querySelectorAll(container, '.tab');
      const dbTab = tabs[1];
      
      click(dbTab);
      await waitForUpdates();
      
      expect(hasClass(dbTab, 'active')).toBe(true);
      expect(hasClass(tabs[0], 'active')).toBe(false);
      
      const dbContent = container.querySelector('#database-tab');
      expect(isVisible(dbContent)).toBe(true);
      
      const toolsContent = container.querySelector('#tools-tab');
      expect(isVisible(toolsContent)).toBe(false);
    });
    
    test('should emit tab change event', async () => {
      const listener = jest.fn();
      view.on('tab:changed', listener);
      
      const tabs = querySelectorAll(container, '.tab');
      click(tabs[1]);
      
      await waitForUpdates();
      
      expect(listener).toHaveBeenCalledWith('database');
    });
  });
  
  describe('Tool Registry Tab', () => {
    test('should render search bar', () => {
      const searchBar = container.querySelector('.search-bar');
      expect(searchBar).toBeTruthy();
      
      const searchInput = searchBar.querySelector('input[type="text"]');
      expect(searchInput).toBeTruthy();
      expect(searchInput.placeholder).toContain('Search tools');
      
      const searchButton = searchBar.querySelector('button');
      expect(searchButton).toBeTruthy();
      expect(getText(searchButton)).toBe('Search');
    });
    
    test('should render module filter', () => {
      const moduleFilter = container.querySelector('select#module-filter');
      expect(moduleFilter).toBeTruthy();
      
      const options = querySelectorAll(moduleFilter, 'option');
      expect(options.length).toBeGreaterThan(0);
      expect(options[0].value).toBe('');
      expect(getText(options[0])).toBe('All Modules');
    });
    
    test('should emit search event', async () => {
      const listener = jest.fn();
      view.on('tools:search', listener);
      
      const searchInput = container.querySelector('.search-bar input');
      const searchButton = container.querySelector('.search-bar button');
      
      type(searchInput, 'file');
      click(searchButton);
      
      await waitForUpdates();
      
      expect(listener).toHaveBeenCalledWith({ query: 'file' });
    });
    
    test('should emit filter event on module change', async () => {
      const listener = jest.fn();
      view.on('tools:filter', listener);
      
      const moduleFilter = container.querySelector('#module-filter');
      moduleFilter.value = 'file';
      moduleFilter.dispatchEvent(new Event('change'));
      
      await waitForUpdates();
      
      expect(listener).toHaveBeenCalledWith({ module: 'file' });
    });
    
    test('should render tools list', () => {
      const toolsList = container.querySelector('.tools-list');
      expect(toolsList).toBeTruthy();
      
      const mockTools = [
        { name: 'file_write', module: 'file', description: 'Write to file' },
        { name: 'calculator', module: 'calculator', description: 'Calculate' }
      ];
      
      view.renderTools(mockTools);
      
      const toolItems = querySelectorAll(toolsList, '.tool-item');
      expect(toolItems).toHaveLength(2);
      
      expect(getText(toolItems[0])).toContain('file_write');
      expect(getText(toolItems[0])).toContain('file');
      expect(getText(toolItems[0])).toContain('Write to file');
    });
    
    test('should handle tool selection', async () => {
      const listener = jest.fn();
      view.on('tool:selected', listener);
      
      const mockTools = [
        { name: 'file_write', module: 'file', description: 'Write to file' }
      ];
      
      view.renderTools(mockTools);
      
      const toolItem = container.querySelector('.tool-item');
      click(toolItem);
      
      await waitForUpdates();
      
      expect(listener).toHaveBeenCalledWith('file_write');
      expect(hasClass(toolItem, 'selected')).toBe(true);
    });
    
    test('should render tool details', () => {
      const mockTool = {
        name: 'file_write',
        module: 'file',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            filepath: { type: 'string', description: 'Path to file' },
            content: { type: 'string', description: 'Content to write' }
          }
        }
      };
      
      view.renderToolDetails(mockTool);
      
      const details = container.querySelector('.tool-details');
      expect(getText(details)).toContain('file_write');
      expect(getText(details)).toContain('Write content to a file');
      expect(getText(details)).toContain('Input Schema');
      
      const schemaDisplay = details.querySelector('.schema-display');
      expect(getText(schemaDisplay)).toContain('filepath');
      expect(getText(schemaDisplay)).toContain('content');
    });
    
    test('should render tool execution form', () => {
      const mockTool = {
        name: 'calculator',
        inputSchema: {
          type: 'object',
          properties: {
            expression: { type: 'string' }
          }
        }
      };
      
      view.renderToolDetails(mockTool);
      
      const executionForm = container.querySelector('.execution-form');
      expect(executionForm).toBeTruthy();
      
      const textarea = executionForm.querySelector('textarea');
      expect(textarea).toBeTruthy();
      
      const executeButton = executionForm.querySelector('button');
      expect(getText(executeButton)).toBe('Execute');
    });
    
    test('should emit tool execution event', async () => {
      const listener = jest.fn();
      view.on('tool:execute', listener);
      
      const mockTool = {
        name: 'calculator',
        inputSchema: {
          type: 'object',
          properties: {
            expression: { type: 'string' }
          }
        }
      };
      
      view.renderToolDetails(mockTool);
      
      const textarea = container.querySelector('.execution-form textarea');
      const executeButton = container.querySelector('.execution-form button');
      
      type(textarea, '{"expression": "2 + 2"}');
      click(executeButton);
      
      await waitForUpdates();
      
      expect(listener).toHaveBeenCalledWith({
        toolName: 'calculator',
        args: { expression: '2 + 2' }
      });
    });
    
    test('should display execution results', () => {
      view.renderExecutionResult({
        success: true,
        result: 42,
        message: 'Calculation complete'
      });
      
      const results = container.querySelector('.execution-results');
      expect(results).toBeTruthy();
      expect(hasClass(results, 'success')).toBe(true);
      expect(getText(results)).toContain('42');
    });
    
    test('should display execution errors', () => {
      view.renderExecutionResult({
        success: false,
        error: 'Invalid expression'
      });
      
      const results = container.querySelector('.execution-results');
      expect(hasClass(results, 'error')).toBe(true);
      expect(getText(results)).toContain('Invalid expression');
    });
  });
  
  describe('Database Tab', () => {
    beforeEach(async () => {
      // Switch to database tab
      const tabs = querySelectorAll(container, '.tab');
      click(tabs[1]);
      await waitForUpdates();
    });
    
    test('should render collections list', () => {
      const mockCollections = [
        { name: 'tools', count: 45 },
        { name: 'modules', count: 12 }
      ];
      
      view.renderCollections(mockCollections);
      
      const collectionsList = container.querySelector('.collections-list');
      const items = querySelectorAll(collectionsList, '.collection-item');
      
      expect(items).toHaveLength(2);
      expect(getText(items[0])).toContain('tools');
      expect(getText(items[0])).toContain('45 documents');
    });
    
    test('should handle collection selection', async () => {
      const listener = jest.fn();
      view.on('collection:selected', listener);
      
      const mockCollections = [{ name: 'tools', count: 45 }];
      view.renderCollections(mockCollections);
      
      const collectionItem = container.querySelector('.collection-item');
      click(collectionItem);
      
      await waitForUpdates();
      
      expect(listener).toHaveBeenCalledWith('tools');
      expect(hasClass(collectionItem, 'selected')).toBe(true);
    });
    
    test('should render documents', () => {
      const mockDocs = [
        { _id: '1', name: 'file_write', module: 'file' },
        { _id: '2', name: 'file_read', module: 'file' }
      ];
      
      view.renderDocuments(mockDocs, 'tools');
      
      const docsView = container.querySelector('.documents-view');
      const docItems = querySelectorAll(docsView, '.document-item');
      
      expect(docItems).toHaveLength(2);
      expect(getText(docItems[0])).toContain('file_write');
    });
    
    test('should render vector collections', () => {
      const mockVectorCollections = [
        { 
          name: 'tool_perspectives', 
          vectors_count: 180,
          dimension: 384,
          status: 'green'
        }
      ];
      
      view.renderVectorCollections(mockVectorCollections);
      
      const vectorsSection = container.querySelector('.vectors-section');
      expect(getText(vectorsSection)).toContain('tool_perspectives');
      expect(getText(vectorsSection)).toContain('180 vectors');
      expect(getText(vectorsSection)).toContain('384 dimensions');
    });
    
    test('should render semantic search interface', () => {
      const searchInterface = container.querySelector('.semantic-search');
      expect(searchInterface).toBeTruthy();
      
      const searchInput = searchInterface.querySelector('textarea');
      expect(searchInput).toBeTruthy();
      expect(searchInput.placeholder).toContain('semantic search');
      
      const searchButton = searchInterface.querySelector('button');
      expect(getText(searchButton)).toBe('Search');
    });
    
    test('should emit semantic search event', async () => {
      const listener = jest.fn();
      view.on('semantic:search', listener);
      
      const searchInput = container.querySelector('.semantic-search textarea');
      const searchButton = container.querySelector('.semantic-search button');
      
      type(searchInput, 'find tools for file operations');
      click(searchButton);
      
      await waitForUpdates();
      
      expect(listener).toHaveBeenCalledWith({
        query: 'find tools for file operations'
      });
    });
    
    test('should render search results', () => {
      const mockResults = [
        {
          score: 0.95,
          payload: {
            toolName: 'file_write',
            perspective: 'usage',
            content: 'Use this to write files'
          }
        }
      ];
      
      view.renderSearchResults(mockResults);
      
      const results = container.querySelector('.search-results');
      const resultItems = querySelectorAll(results, '.result-item');
      
      expect(resultItems).toHaveLength(1);
      expect(getText(resultItems[0])).toContain('file_write');
      expect(getText(resultItems[0])).toContain('0.95');
      expect(getText(resultItems[0])).toContain('usage');
    });
  });
  
  describe('Loading States', () => {
    test('should show loading indicator', () => {
      view.showLoading('Loading tools...');
      
      const loading = container.querySelector('.loading');
      expect(loading).toBeTruthy();
      expect(getText(loading)).toContain('Loading tools...');
    });
    
    test('should hide loading indicator', () => {
      view.showLoading('Loading...');
      view.hideLoading();
      
      const loading = container.querySelector('.loading');
      expect(loading).toBeFalsy();
    });
  });
  
  describe('Error Handling', () => {
    test('should display error messages', () => {
      view.showError('Failed to load tools');
      
      const error = container.querySelector('.error-message');
      expect(error).toBeTruthy();
      expect(getText(error)).toContain('Failed to load tools');
    });
    
    test('should clear error messages', () => {
      view.showError('Error');
      view.clearError();
      
      const error = container.querySelector('.error-message');
      expect(error).toBeFalsy();
    });
  });
  
  describe('Cleanup', () => {
    test('should remove styles on destroy', () => {
      view.destroy();
      
      const styleElement = document.head.querySelector('style[data-component="tool-registry"]');
      expect(styleElement).toBeFalsy();
    });
    
    test('should clear container on destroy', () => {
      view.destroy();
      
      expect(container.innerHTML).toBe('');
    });
    
    test('should remove event listeners on destroy', () => {
      const listener = jest.fn();
      view.on('test:event', listener);
      
      view.destroy();
      view.emit('test:event');
      
      expect(listener).not.toHaveBeenCalled();
    });
  });
});