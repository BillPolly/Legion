/**
 * Unit tests for TabsComponent - Node Environment Adapted
 * Tests the component logic without DOM dependencies
 */

import { jest } from '@jest/globals';
import { TabsComponent } from '../../../src/components/TabsComponent.js';

// Mock DOM environment for node testing
const mockElement = () => ({
  innerHTML: '',
  appendChild: jest.fn(),
  removeChild: jest.fn(),
  querySelector: jest.fn(() => mockElement()),
  querySelectorAll: jest.fn(() => [mockElement(), mockElement()]),
  addEventListener: jest.fn(),
  click: jest.fn(),
  classList: {
    contains: jest.fn(),
    toggle: jest.fn(),
    add: jest.fn(),
    remove: jest.fn()
  },
  dataset: {},
  disabled: false,
  textContent: 'Mock Tab'
});

global.document = {
  createElement: jest.fn(() => mockElement()),
  body: mockElement()
};

describe('TabsComponent Logic Tests (Node Environment)', () => {
  let component;
  let container;
  
  beforeEach(() => {
    container = mockElement();
    // Reset all mocks
    jest.clearAllMocks();
  });
  
  describe('Component Construction', () => {
    test('should initialize with provided tabs', () => {
      const tabs = [
        { id: 'tab1', label: 'Tab 1' },
        { id: 'tab2', label: 'Tab 2' }
      ];
      
      component = new TabsComponent(container, { tabs });
      
      expect(component.model.tabs).toEqual(tabs);
      expect(component.model.activeTab).toBe('tab1');
    });
    
    test('should use custom active tab', () => {
      const tabs = [
        { id: 'tab1', label: 'Tab 1' },
        { id: 'tab2', label: 'Tab 2' }
      ];
      
      component = new TabsComponent(container, { 
        tabs, 
        activeTab: 'tab2' 
      });
      
      expect(component.model.activeTab).toBe('tab2');
    });
    
    test('should handle empty tabs array', () => {
      expect(() => {
        component = new TabsComponent(container, { tabs: [] });
      }).not.toThrow();
      
      expect(component.model.tabs).toEqual([]);
      expect(component.model.activeTab).toBeNull();
    });
  });
  
  describe('Tab Switching Logic', () => {
    beforeEach(() => {
      const tabs = [
        { id: 'planning', label: 'Planning' },
        { id: 'search', label: 'Search' },
        { id: 'tools', label: 'Tools', disabled: true }
      ];
      
      component = new TabsComponent(container, { tabs });
    });
    
    test('should switch to valid tab', () => {
      component.switchTab('search');
      
      expect(component.model.activeTab).toBe('search');
    });
    
    test('should not switch to same tab twice', () => {
      const onTabChange = jest.fn();
      component = new TabsComponent(container, { 
        tabs: component.model.tabs,
        onTabChange 
      });
      
      // Switch to tab that's already active
      component.switchTab('planning');
      
      expect(onTabChange).not.toHaveBeenCalled();
    });
    
    test('should call onChange callback when switching', () => {
      const onTabChange = jest.fn();
      component = new TabsComponent(container, { 
        tabs: component.model.tabs,
        onTabChange 
      });
      
      component.switchTab('search');
      
      expect(onTabChange).toHaveBeenCalledWith('search');
    });
  });
  
  describe('Tab State Management', () => {
    beforeEach(() => {
      const tabs = [
        { id: 'tab1', label: 'Tab 1' },
        { id: 'tab2', label: 'Tab 2', disabled: true }
      ];
      
      component = new TabsComponent(container, { tabs });
    });
    
    test('should enable disabled tab', () => {
      // Mock the buttons array that TabsComponent stores in elements
      const mockButton = {
        dataset: { tabId: 'tab2' },
        disabled: true
      };
      component.elements = {
        buttons: [mockButton]
      };
      
      component.enableTab('tab2', true);
      
      expect(mockButton.disabled).toBe(false);
    });
    
    test('should disable enabled tab', () => {
      // Mock the buttons array that TabsComponent stores in elements
      const mockButton = {
        dataset: { tabId: 'tab1' },
        disabled: false
      };
      component.elements = {
        buttons: [mockButton]
      };
      
      component.enableTab('tab1', false);
      
      expect(mockButton.disabled).toBe(true);
    });
    
    test('should update tab label', () => {
      const mockTabElement = {
        dataset: { tabId: 'tab1' },
        textContent: 'Old Label'
      };
      
      // Mock querySelectorAll to return array with our element
      container.querySelectorAll.mockReturnValue([mockTabElement]);
      
      component.updateTabLabel('tab1', 'New Label');
      
      // Verify the method attempts to find and update the tab
      expect(container.querySelectorAll).toHaveBeenCalledWith('.tab-btn');
    });
  });
  
  describe('Content Container Access', () => {
    test('should get content container for tab', () => {
      const tabs = [{ id: 'test-tab', label: 'Test' }];
      component = new TabsComponent(container, { tabs });
      
      const mockContentElement = { id: 'test-tab-content' };
      container.querySelector.mockReturnValue(mockContentElement);
      
      const result = component.getContentContainer('test-tab');
      
      expect(container.querySelector).toHaveBeenCalledWith('#test-tab-content');
      expect(result).toBe(mockContentElement);
    });
    
    test('should return null for non-existent tab content', () => {
      const tabs = [{ id: 'tab1', label: 'Tab 1' }];
      component = new TabsComponent(container, { tabs });
      
      container.querySelector.mockReturnValue(null);
      
      const result = component.getContentContainer('non-existent');
      
      expect(result).toBeNull();
    });
  });
  
  describe('Render and DOM Interaction', () => {
    test('should call render on construction', () => {
      const tabs = [{ id: 'tab1', label: 'Tab 1' }];
      
      // Mock container to track innerHTML changes
      container.innerHTML = '';
      
      component = new TabsComponent(container, { tabs });
      
      // Should have set innerHTML during render
      expect(container.innerHTML).not.toBe('');
    });
    
    test('should attach event listeners on construction', () => {
      const tabs = [{ id: 'tab1', label: 'Tab 1' }];
      
      // Mock querySelectorAll to return mock buttons
      const mockButton = mockElement();
      container.querySelectorAll.mockReturnValue([mockButton]);
      
      component = new TabsComponent(container, { tabs });
      
      // Should have called querySelectorAll to find buttons
      expect(container.querySelectorAll).toHaveBeenCalledWith('.tab-btn');
      
      // Should have attached event listener to mock button
      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });
  
  describe('Model State Consistency', () => {
    test('should maintain consistent model state', () => {
      const tabs = [
        { id: 'tab1', label: 'Tab 1' },
        { id: 'tab2', label: 'Tab 2' }
      ];
      
      component = new TabsComponent(container, { tabs });
      
      // Initial state
      expect(component.model.activeTab).toBe('tab1');
      
      // After switching
      component.switchTab('tab2');
      expect(component.model.activeTab).toBe('tab2');
      
      // Model should preserve tabs array
      expect(component.model.tabs).toEqual(tabs);
    });
    
    test('should handle callback function properly', () => {
      const mockCallback = jest.fn();
      const tabs = [{ id: 'tab1', label: 'Tab 1' }];
      
      component = new TabsComponent(container, { 
        tabs,
        onTabChange: mockCallback 
      });
      
      expect(component.model.onTabChange).toBe(mockCallback);
    });
  });
});