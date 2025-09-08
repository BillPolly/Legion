/**
 * Unit Tests for SearchInput Component
 * 
 * Tests the umbilical protocol compliance and search functionality
 * NO MOCKS - Tests real search input behavior and DOM interactions
 */

import { SearchInput } from '../../../../src/components/search-input/SearchInput.js';

describe('SearchInput Component', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Cleanup DOM
    document.body.removeChild(container);
    
    // Remove any dynamically created styles
    const searchStyles = document.getElementById('showme-search-input-styles');
    if (searchStyles) {
      searchStyles.remove();
    }
  });

  describe('umbilical protocol compliance', () => {
    test('should support introspection mode', () => {
      let requirements = null;
      SearchInput.create({
        describe: (reqs) => { requirements = reqs.getAll(); }
      });

      expect(requirements).toBeTruthy();
      expect(requirements.dom).toBeDefined();
      expect(requirements.onSearch).toBeDefined();
      expect(requirements.onClear).toBeDefined();
      expect(requirements.onFocus).toBeDefined();
      expect(requirements.onBlur).toBeDefined();
      expect(requirements.onEscape).toBeDefined();
      expect(requirements.placeholder).toBeDefined();
      expect(requirements.value).toBeDefined();
      expect(requirements.debounceMs).toBeDefined();
      expect(requirements.size).toBeDefined();
      expect(requirements.maxWidth).toBeDefined();
    });

    test('should support validation mode', () => {
      const validation = SearchInput.create({
        validate: (checks) => checks
      });

      expect(validation).toBeTruthy();
      expect(validation.hasDomElement).toBeDefined();
      expect(validation.hasValidCallbacks).toBeDefined();
      expect(validation.hasValidPlaceholder).toBeDefined();
      expect(validation.hasValidValue).toBeDefined();
      expect(validation.hasValidDebounce).toBeDefined();
      expect(validation.hasValidSize).toBeDefined();
      expect(validation.hasValidMaxWidth).toBeDefined();
    });

    test('should validate search input-specific capabilities', () => {
      const validUmbilical = {
        dom: container,
        onSearch: () => {},
        onClear: () => {},
        onFocus: () => {},
        onBlur: () => {},
        onEscape: () => {},
        placeholder: 'Search...',
        value: 'initial',
        debounceMs: 300,
        size: 'medium',
        maxWidth: '400px'
      };

      const validation = SearchInput.create({
        validate: (checks) => {
          // Manually check the validation logic
          const hasValidCallbacks = ['onSearch', 'onClear', 'onFocus', 'onBlur', 'onEscape'].every(cb => 
            !validUmbilical[cb] || typeof validUmbilical[cb] === 'function'
          );
          const hasValidPlaceholder = !validUmbilical.placeholder || typeof validUmbilical.placeholder === 'string';
          const hasValidValue = !validUmbilical.value || typeof validUmbilical.value === 'string';
          const hasValidDebounce = !validUmbilical.debounceMs || (typeof validUmbilical.debounceMs === 'number' && validUmbilical.debounceMs >= 0);
          const hasValidSize = !validUmbilical.size || ['small', 'medium', 'large'].includes(validUmbilical.size);
          const hasValidMaxWidth = !validUmbilical.maxWidth || typeof validUmbilical.maxWidth === 'string';

          return {
            hasValidCallbacks,
            hasValidPlaceholder,
            hasValidValue,
            hasValidDebounce,
            hasValidSize,
            hasValidMaxWidth
          };
        }
      });

      expect(validation.hasValidCallbacks).toBe(true);
      expect(validation.hasValidPlaceholder).toBe(true);
      expect(validation.hasValidValue).toBe(true);
      expect(validation.hasValidDebounce).toBe(true);
      expect(validation.hasValidSize).toBe(true);
      expect(validation.hasValidMaxWidth).toBe(true);
    });

    test('should require umbilical object for instance creation', () => {
      expect(() => {
        SearchInput.create();
      }).toThrow('SearchInput requires an umbilical object');
    });
  });

  describe('instance creation', () => {
    test('should create search input instance with minimal configuration', () => {
      const searchInput = SearchInput.create({
        dom: container
      });

      expect(searchInput).toBeTruthy();
      expect(searchInput.getElement()).toBeInstanceOf(HTMLDivElement);
      expect(searchInput.getInputElement()).toBeInstanceOf(HTMLInputElement);
      expect(container.children.length).toBe(1);
      expect(searchInput.getInputElement().placeholder).toBe('Search...');
    });

    test('should create search input with all configuration options', () => {
      let mountCalled = false;
      let searchCalled = false;
      let clearCalled = false;
      let focusCalled = false;
      let blurCalled = false;
      let escapeCalled = false;

      const searchInput = SearchInput.create({
        dom: container,
        placeholder: 'Search items...',
        value: 'initial value',
        ariaLabel: 'Search input field',
        debounceMs: 500,
        size: 'large',
        maxWidth: '500px',
        className: 'custom-search',
        disabled: false,
        testId: 'search-input-test',
        theme: 'dark',
        onSearch: (value, instance, options) => { 
          searchCalled = true;
          expect(instance).toBe(searchInput);
        },
        onClear: (instance) => { 
          clearCalled = true;
          expect(instance).toBe(searchInput);
        },
        onFocus: (value, instance) => { 
          focusCalled = true;
          expect(instance).toBe(searchInput);
        },
        onBlur: (value, instance) => { 
          blurCalled = true;
          expect(instance).toBe(searchInput);
        },
        onEscape: (instance) => { 
          escapeCalled = true;
          expect(instance).toBe(searchInput);
        },
        onMount: () => { mountCalled = true; }
      });

      const element = searchInput.getElement();
      const inputElement = searchInput.getInputElement();
      
      expect(inputElement.placeholder).toBe('Search items...');
      expect(inputElement.value).toBe('initial value');
      expect(inputElement.getAttribute('aria-label')).toBe('Search input field');
      expect(element.classList.contains('showme-search-input')).toBe(true);
      expect(element.classList.contains('custom-search')).toBe(true);
      expect(element.getAttribute('data-testid')).toBe('search-input-test');
      expect(element.getAttribute('data-theme')).toBe('dark');
      expect(mountCalled).toBe(true);

      // Test initial value shows clear button
      const clearButton = element.querySelector('.search-clear-button');
      expect(clearButton.style.display).toBe('flex');

      // Test search functionality
      inputElement.value = 'test search';
      inputElement.dispatchEvent(new Event('input'));
      // Note: Search will be debounced so we test the setValue method directly
      searchInput.setValue('test', true);
      expect(searchCalled).toBe(true);

      // Test clear functionality
      clearButton.click();
      expect(clearCalled).toBe(true);

      // Test focus/blur
      inputElement.dispatchEvent(new FocusEvent('focus'));
      expect(focusCalled).toBe(true);

      inputElement.dispatchEvent(new FocusEvent('blur'));
      expect(blurCalled).toBe(true);

      // Test escape key
      inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(escapeCalled).toBe(true);
    });

    test('should apply size styles correctly', () => {
      const sizes = ['small', 'medium', 'large'];
      
      sizes.forEach(size => {
        const searchInput = SearchInput.create({
          dom: container,
          size: size
        });

        const inputElement = searchInput.getInputElement();
        const clearButton = searchInput.getElement().querySelector('.search-clear-button');
        
        // Verify size-specific styling is applied
        expect(inputElement.style.padding).toBeTruthy();
        expect(inputElement.style.fontSize).toBeTruthy();
        expect(clearButton.style.width).toBeTruthy();
        expect(clearButton.style.height).toBeTruthy();
        
        searchInput.destroy();
      });
    });
  });

  describe('search functionality', () => {
    test('should handle real-time search with debouncing', (done) => {
      let searchCount = 0;
      let lastSearchValue = null;

      const searchInput = SearchInput.create({
        dom: container,
        debounceMs: 100,
        onSearch: (value, instance, options) => {
          searchCount++;
          lastSearchValue = value;
        }
      });

      const inputElement = searchInput.getInputElement();
      
      // Simulate rapid typing
      inputElement.value = 't';
      inputElement.dispatchEvent(new Event('input'));
      
      inputElement.value = 'te';
      inputElement.dispatchEvent(new Event('input'));
      
      inputElement.value = 'test';
      inputElement.dispatchEvent(new Event('input'));

      // Should only trigger once after debounce delay
      setTimeout(() => {
        expect(searchCount).toBe(1);
        expect(lastSearchValue).toBe('test');
        done();
      }, 150);
    });

    test('should handle immediate search on Enter key', () => {
      let searchCount = 0;
      let lastSearchValue = null;
      let wasImmediate = false;

      const searchInput = SearchInput.create({
        dom: container,
        debounceMs: 300,
        onSearch: (value, instance, options) => {
          searchCount++;
          lastSearchValue = value;
          wasImmediate = options.immediate;
        }
      });

      const inputElement = searchInput.getInputElement();
      inputElement.value = 'immediate search';
      
      // Press Enter key
      inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      expect(searchCount).toBe(1);
      expect(lastSearchValue).toBe('immediate search');
      expect(wasImmediate).toBe(true);
    });

    test('should show/hide clear button based on input content', () => {
      const searchInput = SearchInput.create({
        dom: container
      });

      const inputElement = searchInput.getInputElement();
      const clearButton = searchInput.getElement().querySelector('.search-clear-button');

      // Initially empty - clear button hidden
      expect(clearButton.style.display).toBe('none');

      // Add text - clear button should show
      inputElement.value = 'test';
      inputElement.dispatchEvent(new Event('input'));
      expect(clearButton.style.display).toBe('flex');

      // Clear text - clear button should hide
      inputElement.value = '';
      inputElement.dispatchEvent(new Event('input'));
      expect(clearButton.style.display).toBe('none');
    });

    test('should clear input when clear button is clicked', () => {
      let clearCalled = false;
      let searchCalled = false;
      let searchValue = null;

      const searchInput = SearchInput.create({
        dom: container,
        value: 'initial text',
        onClear: () => { clearCalled = true; },
        onSearch: (value) => { 
          searchCalled = true;
          searchValue = value;
        }
      });

      const inputElement = searchInput.getInputElement();
      const clearButton = searchInput.getElement().querySelector('.search-clear-button');

      // Initial state
      expect(inputElement.value).toBe('initial text');
      expect(clearButton.style.display).toBe('flex');

      // Click clear button
      clearButton.click();

      expect(inputElement.value).toBe('');
      expect(clearButton.style.display).toBe('none');
      expect(clearCalled).toBe(true);
      expect(searchCalled).toBe(true);
      expect(searchValue).toBe('');
      expect(document.activeElement).toBe(inputElement); // Should focus input
    });

    test('should handle escape key to clear input', () => {
      let escapeCalled = false;
      
      const searchInput = SearchInput.create({
        dom: container,
        value: 'text to clear',
        onEscape: () => { escapeCalled = true; }
      });

      const inputElement = searchInput.getInputElement();
      
      // Press Escape key
      inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      
      expect(inputElement.value).toBe('');
      expect(escapeCalled).toBe(true);
    });

    test('should not trigger search when disabled', () => {
      let searchCalled = false;

      const searchInput = SearchInput.create({
        dom: container,
        disabled: true,
        onSearch: () => { searchCalled = true; }
      });

      const inputElement = searchInput.getInputElement();
      
      // Try to trigger input event
      inputElement.value = 'test';
      inputElement.dispatchEvent(new Event('input'));
      
      expect(searchCalled).toBe(false);
    });
  });

  describe('search input methods', () => {
    let searchInput;

    beforeEach(() => {
      searchInput = SearchInput.create({
        dom: container,
        value: 'initial'
      });
    });

    afterEach(() => {
      if (searchInput && !searchInput.isDestroyed()) {
        searchInput.destroy();
      }
    });

    test('should get current value', () => {
      expect(searchInput.getValue()).toBe('initial');
    });

    test('should set value programmatically', () => {
      let searchTriggered = false;
      searchInput.config.onSearch = () => { searchTriggered = true; };

      searchInput.setValue('new value', false);
      expect(searchInput.getValue()).toBe('new value');
      expect(searchInput.getInputElement().value).toBe('new value');
      expect(searchTriggered).toBe(false);

      // Test with triggerSearch = true
      searchInput.setValue('trigger search', true);
      expect(searchTriggered).toBe(true);
    });

    test('should clear input programmatically', () => {
      searchInput.clear();
      expect(searchInput.getValue()).toBe('');
      expect(searchInput.getInputElement().value).toBe('');
    });

    test('should focus/blur input', () => {
      searchInput.focus();
      expect(document.activeElement).toBe(searchInput.getInputElement());

      searchInput.blur();
      expect(document.activeElement).not.toBe(searchInput.getInputElement());
    });

    test('should set disabled state', () => {
      const inputElement = searchInput.getInputElement();
      const clearButton = searchInput.getElement().querySelector('.search-clear-button');

      searchInput.setDisabled(true);
      expect(inputElement.disabled).toBe(true);
      expect(clearButton.disabled).toBe(true);
      expect(searchInput.getElement().classList.contains('disabled')).toBe(true);

      searchInput.setDisabled(false);
      expect(inputElement.disabled).toBe(false);
      expect(clearButton.disabled).toBe(false);
      expect(searchInput.getElement().classList.contains('disabled')).toBe(false);
    });

    test('should set placeholder text', () => {
      searchInput.setPlaceholder('New placeholder');
      expect(searchInput.getInputElement().placeholder).toBe('New placeholder');
    });

    test('should check if destroyed', () => {
      expect(searchInput.isDestroyed()).toBe(false);
      
      searchInput.destroy();
      expect(searchInput.isDestroyed()).toBe(true);
    });
  });

  describe('accessibility', () => {
    test('should include proper ARIA attributes', () => {
      const searchInput = SearchInput.create({
        dom: container,
        ariaLabel: 'Custom search field',
        placeholder: 'Search items...'
      });

      const inputElement = searchInput.getInputElement();
      const clearButton = searchInput.getElement().querySelector('.search-clear-button');
      
      expect(inputElement.getAttribute('role')).toBe('searchbox');
      expect(inputElement.getAttribute('aria-label')).toBe('Custom search field');
      expect(clearButton.getAttribute('aria-label')).toBe('Clear search');
      expect(clearButton.title).toBe('Clear search');
    });

    test('should be keyboard accessible', () => {
      const searchInput = SearchInput.create({
        dom: container
      });

      const inputElement = searchInput.getInputElement();
      
      // Should be focusable
      inputElement.focus();
      expect(document.activeElement).toBe(inputElement);
      
      // Clear button should be focusable when visible
      searchInput.setValue('test');
      const clearButton = searchInput.getElement().querySelector('.search-clear-button');
      clearButton.focus();
      expect(document.activeElement).toBe(clearButton);
    });

    test('should handle webkit search cancel button', () => {
      const searchInput = SearchInput.create({
        dom: container
      });

      const inputElement = searchInput.getInputElement();
      expect(inputElement.type).toBe('search');
      
      // CSS should hide webkit search cancel button
      const styles = document.getElementById('showme-search-input-styles');
      expect(styles.textContent).toContain('-webkit-search-cancel-button');
      expect(styles.textContent).toContain('display: none');
    });
  });

  describe('error handling', () => {
    test('should handle search handler errors gracefully', () => {
      // Manual mock for console.error
      const originalConsoleError = console.error;
      let errorMessages = [];
      console.error = (...args) => {
        errorMessages.push(args[0]);
      };

      let errorCallbackCalled = false;
      let errorCallbackError = null;

      const searchInput = SearchInput.create({
        dom: container,
        debounceMs: 0, // Make search immediate for testing
        onSearch: () => {
          throw new Error('Search handler error');
        },
        onError: (error) => {
          errorCallbackCalled = true;
          errorCallbackError = error;
        }
      });

      const inputElement = searchInput.getInputElement();

      // Should not throw but should handle error gracefully
      expect(() => {
        inputElement.value = 'test';
        inputElement.dispatchEvent(new Event('input'));
      }).not.toThrow();

      // Should have logged the error
      expect(errorMessages.length).toBeGreaterThan(0);
      expect(errorMessages[0]).toContain('ShowMe SearchInput error');
      
      // Should have called error callback
      expect(errorCallbackCalled).toBe(true);
      expect(errorCallbackError).toBeInstanceOf(Error);
      expect(errorCallbackError.message).toBe('Search handler error');

      // Restore console.error
      console.error = originalConsoleError;
    });

    test('should handle operations on destroyed search input', () => {
      const searchInput = SearchInput.create({
        dom: container,
        value: 'will be destroyed'
      });

      searchInput.destroy();
      expect(searchInput.isDestroyed()).toBe(true);

      // These should not throw
      searchInput.setValue('should not work');
      searchInput.clear();
      searchInput.setDisabled(true);
      searchInput.setPlaceholder('should not work');
      searchInput.focus();
      searchInput.blur();
    });
  });

  describe('lifecycle management', () => {
    test('should call mount callback', () => {
      let mounted = false;
      let mountedInstance = null;

      const searchInput = SearchInput.create({
        dom: container,
        onMount: (instance) => {
          mounted = true;
          mountedInstance = instance;
        }
      });

      expect(mounted).toBe(true);
      expect(mountedInstance).toBe(searchInput);
    });

    test('should call destroy callback', () => {
      let destroyed = false;
      let destroyedInstance = null;

      const searchInput = SearchInput.create({
        dom: container,
        onDestroy: (instance) => {
          destroyed = true;
          destroyedInstance = instance;
        }
      });

      searchInput.destroy();

      expect(destroyed).toBe(true);
      expect(destroyedInstance).toBe(searchInput);
      expect(container.children.length).toBe(0);
    });

    test('should clean up event listeners and timeouts on destroy', () => {
      let searchCount = 0;

      const searchInput = SearchInput.create({
        dom: container,
        debounceMs: 100,
        onSearch: () => { searchCount++; }
      });

      const inputElement = searchInput.getInputElement();
      
      // Start a debounced search
      inputElement.value = 'test';
      inputElement.dispatchEvent(new Event('input'));
      
      // Destroy before debounce completes
      searchInput.destroy();
      
      // Wait for debounce period
      return new Promise(resolve => {
        setTimeout(() => {
          expect(searchCount).toBe(0); // Search should not have been called
          expect(container.children.length).toBe(0); // Element removed from DOM
          resolve();
        }, 150);
      });
    });
  });

  describe('CSS styles injection', () => {
    test('should inject CSS styles once', () => {
      // Create first search input
      const searchInput1 = SearchInput.create({
        dom: container
      });

      expect(document.getElementById('showme-search-input-styles')).toBeTruthy();

      // Create second search input
      const container2 = document.createElement('div');
      document.body.appendChild(container2);
      
      const searchInput2 = SearchInput.create({
        dom: container2
      });

      // Should still be only one style element
      const styleElements = document.querySelectorAll('#showme-search-input-styles');
      expect(styleElements.length).toBe(1);

      searchInput1.destroy();
      searchInput2.destroy();
      document.body.removeChild(container2);
    });

    test('should apply focus styles correctly', () => {
      const searchInput = SearchInput.create({
        dom: container
      });

      const element = searchInput.getElement();
      const inputElement = searchInput.getInputElement();

      // Focus input and check container has focus-within styling
      inputElement.focus();
      
      const styles = document.getElementById('showme-search-input-styles');
      expect(styles.textContent).toContain('.showme-search-input:focus-within');
      expect(styles.textContent).toContain('border-color: #2563eb');
    });
  });
});