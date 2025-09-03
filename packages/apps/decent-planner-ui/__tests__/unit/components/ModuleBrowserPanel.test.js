/**
 * Tests for ModuleBrowserPanel in decent-planner-ui
 * Protocol-based testing of the new search-enabled modules UI
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ModuleBrowserPanel } from '../../../src/client/components/ModuleBrowserPanel.js';

describe('ModuleBrowserPanel Integration Tests', () => {
  let container;
  let panel;
  let mockCallbacks;
  
  beforeEach(() => {
    // Create test DOM container
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    
    // Mock callbacks
    mockCallbacks = {
      onSearchModules: jest.fn(),
      onModuleSelect: jest.fn(),
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };
  });
  
  afterEach(() => {
    if (panel) {
      panel.destroy();
    }
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    jest.clearAllMocks();
  });
  
  describe('Component Initialization', () => {
    test('should create ModuleBrowserPanel with proper MVVM structure', () => {
      panel = new ModuleBrowserPanel(container, mockCallbacks);
      
      expect(panel).toBeDefined();
      expect(panel.viewModel).toBeDefined();
      expect(mockCallbacks.onMount).toHaveBeenCalled();
      
      // Check DOM structure
      expect(container.querySelector('.module-browser-panel')).toBeTruthy();
      expect(container.querySelector('.module-search-input')).toBeTruthy();
      expect(container.querySelector('.modules-content')).toBeTruthy();
    });
    
    test('should auto-trigger module search on initialization', () => {
      panel = new ModuleBrowserPanel(container, mockCallbacks);
      
      // Should trigger search for all modules (empty query)
      expect(mockCallbacks.onSearchModules).toHaveBeenCalledWith('');
    });
  });
  
  describe('Module Search Integration', () => {
    test('should trigger backend search when user types', async () => {
      panel = new ModuleBrowserPanel(container, mockCallbacks);
      
      const searchInput = container.querySelector('.module-search-input');
      expect(searchInput).toBeTruthy();
      
      // Simulate user typing
      searchInput.value = 'file';
      const inputEvent = new Event('input', { bubbles: true });
      searchInput.dispatchEvent(inputEvent);
      
      // Wait for debounce (300ms)
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(mockCallbacks.onSearchModules).toHaveBeenCalledWith('file');
    });
    
    test('should handle module search results from backend', () => {
      panel = new ModuleBrowserPanel(container, mockCallbacks);
      
      const testModules = [
        {
          name: 'file-operations',
          description: 'File handling tools',
          tools: ['file_read', 'file_write'],
          status: 'loaded'
        },
        {
          name: 'calculator',
          description: 'Math calculations',
          tools: ['calculator'],
          status: 'active'
        }
      ];
      
      // Simulate backend response
      panel.setModules(testModules);
      
      // Check that modules are displayed
      const moduleCards = container.querySelectorAll('.module-card');
      expect(moduleCards).toHaveLength(2);
      
      // Check module content
      expect(container.textContent).toContain('file-operations');
      expect(container.textContent).toContain('calculator');
      expect(container.textContent).toContain('2 tools');
      expect(container.textContent).toContain('1 tools');
    });
  });
  
  describe('Module Details and Tools Expansion', () => {
    test('should show expandable tools list for each module', () => {
      panel = new ModuleBrowserPanel(container, mockCallbacks);
      
      const moduleWithTools = [{
        name: 'file-module',
        description: 'File operations',
        tools: [
          { name: 'file_read', description: 'Read files' },
          { name: 'file_write', description: 'Write files' }
        ],
        status: 'loaded'
      }];
      
      panel.setModules(moduleWithTools);
      
      // Check tools section exists
      const toolsSection = container.querySelector('.module-tools-section');
      expect(toolsSection).toBeTruthy();
      
      // Check tools toggle button
      const toggleButton = container.querySelector('.module-tools-toggle');
      expect(toggleButton).toBeTruthy();
      expect(toggleButton.textContent).toContain('Show Tools');
      
      // Check tools list is initially hidden
      const toolsList = container.querySelector('.module-tools-list');
      expect(toolsList).toBeTruthy();
      expect(toolsList.classList.contains('expanded')).toBeFalsy();
    });
    
    test('should toggle tools visibility when clicking show/hide', () => {
      panel = new ModuleBrowserPanel(container, mockCallbacks);
      
      const moduleWithTools = [{
        name: 'test-module',
        tools: ['tool1', 'tool2'],
        status: 'loaded'
      }];
      
      panel.setModules(moduleWithTools);
      
      const toggleButton = container.querySelector('.module-tools-toggle');
      const toolsList = container.querySelector('.module-tools-list');
      
      // Initially hidden
      expect(toolsList.classList.contains('expanded')).toBeFalsy();
      expect(toggleButton.textContent).toContain('Show Tools');
      
      // Click to expand
      toggleButton.click();
      
      // Should be expanded after click
      expect(toolsList.classList.contains('expanded')).toBeTruthy();
      expect(toggleButton.textContent).toContain('Hide Tools');
    });
  });
  
  describe('Module Selection', () => {
    test('should trigger callback when module is selected', () => {
      panel = new ModuleBrowserPanel(container, mockCallbacks);
      
      const testModule = {
        name: 'selected-module',
        description: 'Test module',
        tools: ['tool1'],
        status: 'active'
      };
      
      panel.setModules([testModule]);
      
      // Click on module card
      const moduleCard = container.querySelector('.module-card');
      expect(moduleCard).toBeTruthy();
      moduleCard.click();
      
      expect(mockCallbacks.onModuleSelect).toHaveBeenCalledWith(testModule);
    });
  });
  
  describe('Search and Filtering', () => {
    test('should filter modules by search query', () => {
      panel = new ModuleBrowserPanel(container, mockCallbacks);
      
      const modules = [
        { name: 'file-module', description: 'File operations', tools: ['read'] },
        { name: 'math-module', description: 'Calculations', tools: ['calc'] },
        { name: 'network-module', description: 'Network tools', tools: ['fetch'] }
      ];
      
      panel.setModules(modules);
      
      // Search for 'file'
      const searchInput = container.querySelector('.module-search-input');
      searchInput.value = 'file';
      const inputEvent = new Event('input', { bubbles: true });
      searchInput.dispatchEvent(inputEvent);
      
      // Should still show all modules (filtering is done backend-side)
      // Frontend shows what backend returns
      const moduleCards = container.querySelectorAll('.module-card');
      expect(moduleCards).toHaveLength(3); // Shows all until backend responds
    });
    
    test('should handle empty search results gracefully', () => {
      panel = new ModuleBrowserPanel(container, mockCallbacks);
      
      // Set empty modules (backend returned no results)
      panel.setModules([]);
      
      // Should show no modules message
      const noModulesDiv = container.querySelector('.no-modules');
      expect(noModulesDiv).toBeTruthy();
      expect(container.textContent).toContain('No modules found');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle missing callback gracefully', () => {
      // Create panel without search callback
      panel = new ModuleBrowserPanel(container, {});
      
      const searchInput = container.querySelector('.module-search-input');
      searchInput.value = 'test';
      
      // Should not throw error
      expect(() => {
        const inputEvent = new Event('input', { bubbles: true });
        searchInput.dispatchEvent(inputEvent);
      }).not.toThrow();
    });
    
    test('should handle malformed module data', () => {
      panel = new ModuleBrowserPanel(container, mockCallbacks);
      
      const malformedModules = [
        { name: 'good-module', tools: ['tool1'] },
        { /* missing name */ description: 'Bad module' },
        null,
        undefined,
        { name: '', tools: null }
      ];
      
      // Should not throw error
      expect(() => {
        panel.setModules(malformedModules);
      }).not.toThrow();
      
      // Should handle gracefully and show valid modules only
      const moduleCards = container.querySelectorAll('.module-card');
      expect(moduleCards.length).toBeGreaterThan(0);
    });
  });
});