/**
 * Tests for PaginationControls Component
 * 
 * Comprehensive test suite covering umbilical protocol compliance,
 * pagination functionality, accessibility, and error handling.
 */

import { PaginationControls } from '../../../../src/components/pagination-controls/PaginationControls.js';

describe('PaginationControls Component', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    
    // Clean up any injected styles
    const existingStyles = document.getElementById('showme-pagination-controls-styles');
    if (existingStyles) {
      existingStyles.remove();
    }
  });

  describe('umbilical protocol compliance', () => {
    test('should support introspection mode', () => {
      let requirements = null;
      
      PaginationControls.create({
        describe: (reqs) => {
          requirements = reqs.getAll();
        }
      });

      expect(requirements).not.toBeNull();
      expect(requirements.dom).toBeDefined();
      expect(requirements.onPageChange).toBeDefined();
      expect(requirements.currentPage).toBeDefined();
      expect(requirements.totalItems).toBeDefined();
      expect(requirements.pageSize).toBeDefined();
      expect(requirements.prevText).toBeDefined();
      expect(requirements.nextText).toBeDefined();
    });

    test('should support validation mode', () => {
      const validation = PaginationControls.create({
        dom: container,
        validate: (checks) => checks
      });

      expect(validation).toBeDefined();
      expect(validation.hasDomElement).toBe(true);
      expect(validation.hasValidCallback).toBe(true);
      expect(validation.hasValidCurrentPage).toBe(true);
      expect(validation.hasValidTotalItems).toBe(true);
      expect(validation.hasValidPageSize).toBe(true);
    });

    test('should validate pagination-specific capabilities', () => {
      const validation = PaginationControls.create({
        dom: container,
        onPageChange: () => {},
        currentPage: 2,
        totalItems: 100,
        pageSize: 20,
        prevText: 'Prev',
        nextText: 'Next',
        validate: (checks) => checks
      });

      expect(validation.hasValidCallback).toBe(true);
      expect(validation.hasValidCurrentPage).toBe(true);
      expect(validation.hasValidTotalItems).toBe(true);
      expect(validation.hasValidPageSize).toBe(true);
      expect(validation.hasValidText).toBe(true);
    });

    test('should require umbilical object for instance creation', () => {
      expect(() => {
        PaginationControls.create();
      }).toThrow('PaginationControls requires an umbilical object');
    });
  });

  describe('instance creation', () => {
    test('should create pagination controls with minimal configuration', () => {
      const pagination = PaginationControls.create({
        dom: container
      });

      expect(pagination).toBeDefined();
      expect(pagination.getCurrentPage()).toBe(1);
      expect(pagination.getTotalItems()).toBe(0);
      expect(pagination.getPageSize()).toBe(10);
      expect(pagination.getElement()).toBeInstanceOf(HTMLElement);
      expect(container.children.length).toBe(1);
    });

    test('should create pagination controls with all configuration options', () => {
      let mountCalled = false;
      let pageChangeCalled = false;

      const pagination = PaginationControls.create({
        dom: container,
        currentPage: 3,
        totalItems: 150,
        pageSize: 25,
        prevText: '◀ Back',
        nextText: 'Forward ▶',
        showDetailedInfo: false,
        backgroundColor: '#e0e0e0',
        onMount: () => { mountCalled = true; },
        onPageChange: () => { pageChangeCalled = true; }
      });

      expect(pagination.getCurrentPage()).toBe(3);
      expect(pagination.getTotalItems()).toBe(150);
      expect(pagination.getPageSize()).toBe(25);
      expect(mountCalled).toBe(true);

      // Check custom text
      const element = pagination.getElement();
      expect(element.querySelector('.pagination-prev-button').textContent).toBe('◀ Back');
      expect(element.querySelector('.pagination-next-button').textContent).toBe('Forward ▶');
    });

    test('should apply custom styling options', () => {
      const pagination = PaginationControls.create({
        dom: container,
        backgroundColor: '#123456',
        buttonBackgroundColor: '#abcdef',
        fontSize: '16px'
      });

      const element = pagination.getElement();
      expect(element.style.backgroundColor).toBe('rgb(18, 52, 86)'); // #123456
      expect(element.style.fontSize).toBe('16px');
    });
  });

  describe('pagination functionality', () => {
    test('should handle page navigation with callbacks', () => {
      let pageChangeEvents = [];

      const pagination = PaginationControls.create({
        dom: container,
        currentPage: 2,
        totalItems: 100,
        pageSize: 10,
        onPageChange: (newPage, oldPage, instance) => {
          pageChangeEvents.push({ newPage, oldPage });
        }
      });

      const element = pagination.getElement();
      const prevBtn = element.querySelector('.pagination-prev-button');
      const nextBtn = element.querySelector('.pagination-next-button');

      // Test previous page
      prevBtn.click();
      expect(pagination.getCurrentPage()).toBe(1);
      expect(pageChangeEvents).toHaveLength(1);
      expect(pageChangeEvents[0]).toEqual({ newPage: 1, oldPage: 2 });

      // Test next page
      nextBtn.click();
      expect(pagination.getCurrentPage()).toBe(2);
      expect(pageChangeEvents).toHaveLength(2);
      expect(pageChangeEvents[1]).toEqual({ newPage: 2, oldPage: 1 });
    });

    test('should disable previous button on first page', () => {
      const pagination = PaginationControls.create({
        dom: container,
        currentPage: 1,
        totalItems: 100,
        pageSize: 10
      });

      const element = pagination.getElement();
      const prevBtn = element.querySelector('.pagination-prev-button');
      const nextBtn = element.querySelector('.pagination-next-button');

      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(false);
    });

    test('should disable next button on last page', () => {
      const pagination = PaginationControls.create({
        dom: container,
        currentPage: 10,
        totalItems: 100,
        pageSize: 10
      });

      const element = pagination.getElement();
      const prevBtn = element.querySelector('.pagination-prev-button');
      const nextBtn = element.querySelector('.pagination-next-button');

      expect(prevBtn.disabled).toBe(false);
      expect(nextBtn.disabled).toBe(true);
    });

    test('should not navigate beyond boundaries', () => {
      const pagination = PaginationControls.create({
        dom: container,
        currentPage: 1,
        totalItems: 30,
        pageSize: 10
      });

      const element = pagination.getElement();
      const prevBtn = element.querySelector('.pagination-prev-button');
      const nextBtn = element.querySelector('.pagination-next-button');

      // Try to go before first page
      prevBtn.click();
      expect(pagination.getCurrentPage()).toBe(1);

      // Go to last page
      nextBtn.click(); // page 2
      nextBtn.click(); // page 3
      expect(pagination.getCurrentPage()).toBe(3);

      // Try to go beyond last page
      nextBtn.click();
      expect(pagination.getCurrentPage()).toBe(3);
    });

    test('should calculate total pages correctly', () => {
      const pagination = PaginationControls.create({
        dom: container,
        totalItems: 100,
        pageSize: 10
      });

      expect(pagination.getTotalPages()).toBe(10);

      // Test with partial last page
      pagination.setTotalItems(95);
      expect(pagination.getTotalPages()).toBe(10);

      // Test with exact division
      pagination.setTotalItems(90);
      expect(pagination.getTotalPages()).toBe(9);

      // Test with zero items
      pagination.setTotalItems(0);
      expect(pagination.getTotalPages()).toBe(1);
    });
  });

  describe('pagination state methods', () => {
    test('should get and set current page', () => {
      const pagination = PaginationControls.create({
        dom: container,
        totalItems: 100,
        pageSize: 10
      });

      expect(pagination.getCurrentPage()).toBe(1);

      pagination.setCurrentPage(5);
      expect(pagination.getCurrentPage()).toBe(5);

      // Should clamp to valid range
      pagination.setCurrentPage(20);
      expect(pagination.getCurrentPage()).toBe(10); // Max page for 100 items with page size 10

      pagination.setCurrentPage(-1);
      expect(pagination.getCurrentPage()).toBe(1); // Min page
    });

    test('should get and set total items', () => {
      const pagination = PaginationControls.create({
        dom: container,
        currentPage: 5,
        totalItems: 100,
        pageSize: 10
      });

      expect(pagination.getTotalItems()).toBe(100);

      // Reduce total items - should adjust current page
      pagination.setTotalItems(30);
      expect(pagination.getTotalItems()).toBe(30);
      expect(pagination.getCurrentPage()).toBe(3); // Adjusted from 5 to 3 (max for 30 items)
    });

    test('should get and set page size', () => {
      const pagination = PaginationControls.create({
        dom: container,
        currentPage: 3,
        totalItems: 100,
        pageSize: 10
      });

      expect(pagination.getPageSize()).toBe(10);

      // Change page size - should recalculate current page position
      pagination.setPageSize(20);
      expect(pagination.getPageSize()).toBe(20);
      expect(pagination.getCurrentPage()).toBe(2); // Recalculated to maintain position
    });

    test('should handle zero and negative values gracefully', () => {
      const pagination = PaginationControls.create({
        dom: container,
        totalItems: 0,
        pageSize: 1
      });

      pagination.setTotalItems(-5);
      expect(pagination.getTotalItems()).toBe(0);

      pagination.setPageSize(0);
      expect(pagination.getPageSize()).toBe(1);

      pagination.setPageSize(-10);
      expect(pagination.getPageSize()).toBe(1);
    });
  });

  describe('page info display', () => {
    test('should display page information correctly', () => {
      const pagination = PaginationControls.create({
        dom: container,
        currentPage: 3,
        totalItems: 100,
        pageSize: 10
      });

      const pageInfo = pagination.getElement().querySelector('.pagination-page-info');
      expect(pageInfo.textContent).toBe('Page 3 of 10 (100 total items)');
    });

    test('should show simplified info when showDetailedInfo is false', () => {
      const pagination = PaginationControls.create({
        dom: container,
        currentPage: 2,
        totalItems: 100,
        pageSize: 10,
        showDetailedInfo: false
      });

      const pageInfo = pagination.getElement().querySelector('.pagination-page-info');
      expect(pageInfo.textContent).toBe('11-20 of 100');
    });

    test('should handle empty data correctly', () => {
      const pagination = PaginationControls.create({
        dom: container,
        totalItems: 0,
        pageSize: 10
      });

      const pageInfo = pagination.getElement().querySelector('.pagination-page-info');
      expect(pageInfo.textContent).toBe('No items');
    });

    test('should update display when state changes', () => {
      const pagination = PaginationControls.create({
        dom: container,
        currentPage: 1,
        totalItems: 50,
        pageSize: 10
      });

      let pageInfo = pagination.getElement().querySelector('.pagination-page-info');
      expect(pageInfo.textContent).toBe('Page 1 of 5 (50 total items)');

      pagination.setTotalItems(100);
      expect(pageInfo.textContent).toBe('Page 1 of 10 (100 total items)');

      pagination.setCurrentPage(3);
      expect(pageInfo.textContent).toBe('Page 3 of 10 (100 total items)');
    });
  });

  describe('disabled state', () => {
    test('should set disabled state', () => {
      const pagination = PaginationControls.create({
        dom: container,
        currentPage: 2,
        totalItems: 100,
        pageSize: 10
      });

      const element = pagination.getElement();
      const prevBtn = element.querySelector('.pagination-prev-button');
      const nextBtn = element.querySelector('.pagination-next-button');

      pagination.setDisabled(true);
      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(true);
      expect(element.classList.contains('disabled')).toBe(true);

      pagination.setDisabled(false);
      expect(prevBtn.disabled).toBe(false); // Should be enabled on page 2
      expect(nextBtn.disabled).toBe(false);
      expect(element.classList.contains('disabled')).toBe(false);
    });

    test('should not trigger page change when disabled', () => {
      let pageChangeCalled = false;

      const pagination = PaginationControls.create({
        dom: container,
        currentPage: 2,
        totalItems: 100,
        pageSize: 10,
        disabled: true,
        onPageChange: () => { pageChangeCalled = true; }
      });

      const element = pagination.getElement();
      const prevBtn = element.querySelector('.pagination-prev-button');

      prevBtn.click();
      expect(pageChangeCalled).toBe(false);
      expect(pagination.getCurrentPage()).toBe(2);
    });
  });

  describe('accessibility', () => {
    test('should include proper ARIA attributes', () => {
      const pagination = PaginationControls.create({
        dom: container,
        totalItems: 100,
        pageSize: 10
      });

      const element = pagination.getElement();
      const prevBtn = element.querySelector('.pagination-prev-button');
      const nextBtn = element.querySelector('.pagination-next-button');
      const pageInfo = element.querySelector('.pagination-page-info');

      expect(prevBtn.getAttribute('aria-label')).toBe('Go to previous page');
      expect(nextBtn.getAttribute('aria-label')).toBe('Go to next page');
      expect(pageInfo.getAttribute('role')).toBe('status');
      expect(pageInfo.getAttribute('aria-live')).toBe('polite');
    });

    test('should be keyboard accessible', () => {
      const pagination = PaginationControls.create({
        dom: container,
        currentPage: 2,
        totalItems: 100,
        pageSize: 10
      });

      const element = pagination.getElement();
      const prevBtn = element.querySelector('.pagination-prev-button');
      const nextBtn = element.querySelector('.pagination-next-button');

      // Buttons should be focusable
      expect(prevBtn.tabIndex).toBe(0);
      expect(nextBtn.tabIndex).toBe(0);
    });
  });

  describe('error handling', () => {
    test('should handle page change handler errors gracefully', () => {
      // Manual mock for console.error
      const originalConsoleError = console.error;
      let errorMessages = [];
      console.error = (...args) => {
        errorMessages.push(args[0]);
      };

      let errorCallbackCalled = false;
      let errorCallbackError = null;

      const pagination = PaginationControls.create({
        dom: container,
        currentPage: 2,
        totalItems: 100,
        pageSize: 10,
        onPageChange: () => {
          throw new Error('Page change handler error');
        },
        onError: (error) => {
          errorCallbackCalled = true;
          errorCallbackError = error;
        }
      });

      const element = pagination.getElement();
      const prevBtn = element.querySelector('.pagination-prev-button');

      // Should not throw but should handle error gracefully
      expect(() => {
        prevBtn.click();
      }).not.toThrow();

      // Should have logged the error
      expect(errorMessages.length).toBeGreaterThan(0);
      expect(errorMessages[0]).toContain('ShowMe PaginationControls error');
      
      // Should have called error callback
      expect(errorCallbackCalled).toBe(true);
      expect(errorCallbackError).toBeInstanceOf(Error);
      expect(errorCallbackError.message).toBe('Page change handler error');

      // Restore console.error
      console.error = originalConsoleError;
    });

    test('should handle operations on destroyed pagination controls', () => {
      const pagination = PaginationControls.create({
        dom: container,
        totalItems: 100,
        pageSize: 10
      });

      pagination.destroy();
      expect(pagination.isDestroyed()).toBe(true);

      // Should handle method calls gracefully
      expect(() => {
        pagination.setCurrentPage(5);
        pagination.setTotalItems(200);
        pagination.setPageSize(20);
        pagination.setDisabled(true);
        pagination.updateDisplay();
      }).not.toThrow();
    });
  });

  describe('lifecycle management', () => {
    test('should call mount callback', () => {
      let mountCalled = false;
      let mountInstance = null;

      const pagination = PaginationControls.create({
        dom: container,
        onMount: (instance) => {
          mountCalled = true;
          mountInstance = instance;
        }
      });

      expect(mountCalled).toBe(true);
      expect(mountInstance).toBe(pagination);
    });

    test('should call destroy callback', () => {
      let destroyCalled = false;
      let destroyInstance = null;

      const pagination = PaginationControls.create({
        dom: container,
        onDestroy: (instance) => {
          destroyCalled = true;
          destroyInstance = instance;
        }
      });

      pagination.destroy();
      expect(destroyCalled).toBe(true);
      expect(destroyInstance).toBe(pagination);
    });

    test('should clean up event listeners and DOM on destroy', () => {
      const pagination = PaginationControls.create({
        dom: container,
        totalItems: 100,
        pageSize: 10
      });

      expect(container.children.length).toBe(1);
      expect(pagination.isDestroyed()).toBe(false);

      pagination.destroy();

      expect(container.children.length).toBe(0);
      expect(pagination.isDestroyed()).toBe(true);
      expect(pagination.getElement()).toBeNull();
    });
  });

  describe('CSS styles injection', () => {
    test('should inject CSS styles once', () => {
      const pagination1 = PaginationControls.create({
        dom: container
      });

      let styles = document.getElementById('showme-pagination-controls-styles');
      expect(styles).toBeTruthy();
      expect(styles.textContent).toContain('.pagination-prev-button:hover');

      // Create another instance
      const container2 = document.createElement('div');
      document.body.appendChild(container2);
      
      const pagination2 = PaginationControls.create({
        dom: container2
      });

      // Should not create duplicate styles
      const allStyles = document.querySelectorAll('#showme-pagination-controls-styles');
      expect(allStyles.length).toBe(1);

      // Cleanup
      document.body.removeChild(container2);
      pagination1.destroy();
      pagination2.destroy();
    });

    test('should apply hover and focus styles correctly', () => {
      const pagination = PaginationControls.create({
        dom: container,
        totalItems: 100,
        pageSize: 10
      });

      const styles = document.getElementById('showme-pagination-controls-styles');
      expect(styles.textContent).toContain(':hover:not(:disabled)');
      expect(styles.textContent).toContain(':focus');
      expect(styles.textContent).toContain(':disabled');
    });
  });
});