/**
 * Unit tests for TabsComponent using jsdom
 * Tests MVVM pattern with two-way data binding
 */

import { jest } from '@jest/globals';
import { TabsComponent } from '../../../src/components/TabsComponent.js';

describe('TabsComponent MVVM Tests', () => {
  let component;
  let container;
  
  beforeEach(() => {
    // Create DOM container
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create component
    component = new TabsComponent();
  });
  
  afterEach(() => {
    // Clean up DOM
    document.body.removeChild(container);
  });
  
  describe('Component Initialization', () => {
    test('should initialize with default model state', () => {
      expect(component.model).toBeDefined();
      expect(component.model.activeTab).toBe('planning');
      expect(component.model.tabs).toHaveProperty('planning');
      expect(component.model.tabs).toHaveProperty('search');
      expect(component.model.tabs).toHaveProperty('toolDiscovery');
      expect(component.model.tabs).toHaveProperty('formalPlanning');
    });
    
    test('should set default enabled states', () => {
      expect(component.model.tabs.planning.enabled).toBe(true);
      expect(component.model.tabs.search.enabled).toBe(true);
      expect(component.model.tabs.toolDiscovery.enabled).toBe(false);
      expect(component.model.tabs.formalPlanning.enabled).toBe(false);
    });
    
    test('should render to container', () => {
      const element = component.render();
      container.appendChild(element);
      
      expect(container.querySelector('.tabs-container')).toBeTruthy();
      expect(container.querySelectorAll('.tab-button').length).toBeGreaterThan(0);
    });
  });
  
  describe('Two-Way Data Binding', () => {
    test('should update view when model changes', () => {
      const element = component.render();
      container.appendChild(element);
      
      // Change model
      component.setActiveTab('search');
      
      // View should update
      const activeTab = container.querySelector('.tab-button.active');
      expect(activeTab.textContent).toContain('Search');
    });
    
    test('should update model when view events occur', () => {
      const element = component.render();
      container.appendChild(element);
      
      // Find and click search tab
      const searchTab = Array.from(container.querySelectorAll('.tab-button'))
        .find(btn => btn.textContent.includes('Search'));
      
      searchTab.click();
      
      // Model should update
      expect(component.model.activeTab).toBe('search');
    });
    
    test('should disable tabs based on model state', () => {
      const element = component.render();
      container.appendChild(element);
      
      // Initially tool discovery should be disabled
      const toolTab = Array.from(container.querySelectorAll('.tab-button'))
        .find(btn => btn.textContent.includes('Tool Discovery'));
      
      expect(toolTab.classList.contains('disabled')).toBe(true);
      
      // Enable it in model
      component.enableTab('toolDiscovery');
      
      // Should now be enabled
      expect(toolTab.classList.contains('disabled')).toBe(false);
    });
  });
  
  describe('Event Handling', () => {
    test('should emit tab change events', () => {
      const element = component.render();
      container.appendChild(element);
      
      const changeHandler = jest.fn();
      component.onTabChange(changeHandler);
      
      // Click a tab
      const searchTab = Array.from(container.querySelectorAll('.tab-button'))
        .find(btn => btn.textContent.includes('Search'));
      searchTab.click();
      
      expect(changeHandler).toHaveBeenCalledWith('search');
    });
    
    test('should not change to disabled tab', () => {
      const element = component.render();
      container.appendChild(element);
      
      const changeHandler = jest.fn();
      component.onTabChange(changeHandler);
      
      // Try to click disabled tab
      const formalTab = Array.from(container.querySelectorAll('.tab-button'))
        .find(btn => btn.textContent.includes('Formal'));
      
      expect(formalTab.classList.contains('disabled')).toBe(true);
      formalTab.click();
      
      // Should not trigger change
      expect(changeHandler).not.toHaveBeenCalled();
      expect(component.model.activeTab).toBe('planning');
    });
    
    test('should handle rapid tab switching', () => {
      const element = component.render();
      container.appendChild(element);
      
      const tabs = container.querySelectorAll('.tab-button:not(.disabled)');
      
      // Click tabs rapidly
      tabs[0].click();
      tabs[1].click();
      tabs[0].click();
      
      // Should end on first tab
      expect(component.model.activeTab).toBe('planning');
    });
  });
  
  describe('Tab Content Display', () => {
    test('should show content for active tab', () => {
      const element = component.render();
      container.appendChild(element);
      
      // Add content containers
      component.setContent('planning', '<div class="planning-content">Planning UI</div>');
      component.setContent('search', '<div class="search-content">Search UI</div>');
      
      // Initially should show planning content
      expect(container.querySelector('.planning-content')).toBeTruthy();
      expect(container.querySelector('.search-content')).toBeFalsy();
      
      // Switch to search
      component.setActiveTab('search');
      
      // Should now show search content
      expect(container.querySelector('.planning-content')).toBeFalsy();
      expect(container.querySelector('.search-content')).toBeTruthy();
    });
    
    test('should handle empty content gracefully', () => {
      const element = component.render();
      container.appendChild(element);
      
      // Set active to tab with no content
      component.setActiveTab('search');
      
      // Should not throw error
      const contentArea = container.querySelector('.tab-content');
      expect(contentArea).toBeTruthy();
      expect(contentArea.innerHTML).toBe('');
    });
  });
  
  describe('Tab State Management', () => {
    test('should track tab history', () => {
      const element = component.render();
      container.appendChild(element);
      
      // Navigate through tabs
      component.setActiveTab('planning');
      component.setActiveTab('search');
      component.setActiveTab('planning');
      
      const history = component.getTabHistory();
      expect(history).toEqual(['planning', 'search', 'planning']);
    });
    
    test('should enable/disable multiple tabs at once', () => {
      const element = component.render();
      container.appendChild(element);
      
      // Enable multiple tabs
      component.updateTabStates({
        toolDiscovery: true,
        formalPlanning: true
      });
      
      expect(component.model.tabs.toolDiscovery.enabled).toBe(true);
      expect(component.model.tabs.formalPlanning.enabled).toBe(true);
      
      const enabledTabs = container.querySelectorAll('.tab-button:not(.disabled)');
      expect(enabledTabs.length).toBe(4); // All tabs enabled
    });
    
    test('should maintain tab state across re-renders', () => {
      const element = component.render();
      container.appendChild(element);
      
      // Set state
      component.setActiveTab('search');
      component.enableTab('toolDiscovery');
      
      // Remove and re-render
      container.removeChild(element);
      const newElement = component.render();
      container.appendChild(newElement);
      
      // State should be preserved
      expect(component.model.activeTab).toBe('search');
      expect(component.model.tabs.toolDiscovery.enabled).toBe(true);
    });
  });
  
  describe('Visual Feedback', () => {
    test('should apply active class to current tab', () => {
      const element = component.render();
      container.appendChild(element);
      
      component.setActiveTab('search');
      
      const searchTab = Array.from(container.querySelectorAll('.tab-button'))
        .find(btn => btn.textContent.includes('Search'));
      
      expect(searchTab.classList.contains('active')).toBe(true);
    });
    
    test('should show visual indicator for disabled tabs', () => {
      const element = component.render();
      container.appendChild(element);
      
      const disabledTab = container.querySelector('.tab-button.disabled');
      
      // Check for disabled styling
      expect(disabledTab).toBeTruthy();
      expect(getComputedStyle(disabledTab).cursor).toBe('not-allowed');
    });
    
    test('should animate tab transitions', () => {
      const element = component.render();
      container.appendChild(element);
      
      component.enableAnimation(true);
      component.setActiveTab('search');
      
      const activeTab = container.querySelector('.tab-button.active');
      expect(activeTab.classList.contains('transitioning')).toBe(true);
      
      // After animation completes
      setTimeout(() => {
        expect(activeTab.classList.contains('transitioning')).toBe(false);
      }, 300);
    });
  });
  
  describe('Accessibility', () => {
    test('should have proper ARIA attributes', () => {
      const element = component.render();
      container.appendChild(element);
      
      const tabList = container.querySelector('[role="tablist"]');
      expect(tabList).toBeTruthy();
      
      const tabs = container.querySelectorAll('[role="tab"]');
      expect(tabs.length).toBeGreaterThan(0);
      
      tabs.forEach(tab => {
        expect(tab.hasAttribute('aria-selected')).toBe(true);
        expect(tab.hasAttribute('aria-controls')).toBe(true);
      });
    });
    
    test('should handle keyboard navigation', () => {
      const element = component.render();
      container.appendChild(element);
      
      const activeTab = container.querySelector('.tab-button.active');
      
      // Simulate arrow key navigation
      const arrowRightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      activeTab.dispatchEvent(arrowRightEvent);
      
      // Should move to next tab
      expect(component.model.activeTab).toBe('search');
    });
  });
});