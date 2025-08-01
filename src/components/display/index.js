import { UmbilicalUtils, UmbilicalError } from '../../umbilical/index.js';

/**
 * Display Component
 * 
 * Generic DOM rendering component - displays any data source.
 * Focuses on presentation, no business logic.
 */
export const Display = {
  /**
   * Create a Display instance or provide introspection
   */
  create(umbilical) {
    // Introspection mode - describe requirements
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'DOM element to render into');
      requirements.add('format', 'function', 'Function to format data for display (optional)');
      requirements.add('className', 'string', 'CSS class name to apply (optional)');
      requirements.add('template', 'function', 'Template function for complex rendering (optional)');
      requirements.add('onRender', 'function', 'Callback fired after each render (optional)');
      
      umbilical.describe(requirements);
      return;
    }

    // Validation mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
        hasValidFormatter: !umbilical.format || typeof umbilical.format === 'function',
        hasValidTemplate: !umbilical.template || typeof umbilical.template === 'function'
      });
    }

    // Instance creation mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'Display');

    if (umbilical.dom.nodeType !== Node.ELEMENT_NODE) {
      throw new UmbilicalError('Display requires a valid DOM element', 'Display');
    }

    const element = umbilical.dom;
    let currentData = null;

    // Apply CSS class if provided
    if (umbilical.className) {
      element.classList.add(umbilical.className);
    }

    // Default formatters
    const defaultFormat = (data) => {
      if (data === null || data === undefined) return '';
      if (typeof data === 'object') return JSON.stringify(data, null, 2);
      return String(data);
    };

    const formatter = umbilical.format || defaultFormat;

    // Rendering function
    const render = (data) => {
      currentData = data;
      
      try {
        let content;
        
        if (umbilical.template) {
          // Use custom template function
          content = umbilical.template(data, element);
          if (typeof content === 'string') {
            element.innerHTML = content;
          }
          // If template returns non-string, assume it handled DOM manipulation directly
        } else {
          // Use formatter for simple text content
          content = formatter(data);
          element.textContent = content;
        }

        // Notify render completion
        if (umbilical.onRender) {
          umbilical.onRender(data, element, content);
        }

      } catch (error) {
        element.textContent = `Display Error: ${error.message}`;
        if (umbilical.onError) {
          umbilical.onError(error);
        }
      }
    };

    // Create instance interface
    const instance = {
      // Data access
      get data() {
        return currentData;
      },

      get element() {
        return element;
      },

      // Operations
      update(data) {
        render(data);
      },

      clear() {
        render(null);
      },

      // Utility methods
      addClass(className) {
        element.classList.add(className);
      },

      removeClass(className) {
        element.classList.remove(className);
      },

      setStyle(property, value) {
        element.style[property] = value;
      }
    };

    // Lifecycle setup
    if (umbilical.onMount) {
      umbilical.onMount(instance);
    }

    // Cleanup handler
    if (umbilical.onDestroy) {
      instance.destroy = () => {
        if (umbilical.className) {
          element.classList.remove(umbilical.className);
        }
        element.textContent = '';
        umbilical.onDestroy(instance);
      };
    }

    return instance;
  }
};