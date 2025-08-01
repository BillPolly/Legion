import { UmbilicalUtils, UmbilicalError } from '../../umbilical/index.js';

/**
 * Button Component
 * 
 * Generic interactive element - handles clicks and triggers actions.
 * Reusable across different contexts with customizable behavior.
 */
export const Button = {
  /**
   * Create a Button instance or provide introspection
   */
  create(umbilical) {
    // Introspection mode - describe requirements
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'DOM element to make interactive (button, div, etc.)');
      requirements.add('onClick', 'function', 'Callback fired when button is clicked');
      requirements.add('text', 'string', 'Button text content (optional)');
      requirements.add('disabled', 'boolean', 'Whether button starts disabled (optional)');
      requirements.add('className', 'string', 'CSS class name to apply (optional)');
      requirements.add('onStateChange', 'function', 'Callback fired when button state changes (optional)');
      
      umbilical.describe(requirements);
      return;
    }

    // Validation mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
        hasClickHandler: typeof umbilical.onClick === 'function',
        hasValidDisabled: umbilical.disabled === undefined || typeof umbilical.disabled === 'boolean'
      });
    }

    // Instance creation mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom', 'onClick'], 'Button');

    if (umbilical.dom.nodeType !== Node.ELEMENT_NODE) {
      throw new UmbilicalError('Button requires a valid DOM element', 'Button');
    }

    const element = umbilical.dom;
    let isDisabled = umbilical.disabled || false;
    let clickCount = 0;

    // Set initial text if provided
    if (umbilical.text) {
      element.textContent = umbilical.text;
    }

    // Apply CSS class if provided
    if (umbilical.className) {
      element.classList.add(umbilical.className);
    }

    // Make element focusable and accessible if it's not already a button
    if (element.tagName !== 'BUTTON') {
      element.setAttribute('role', 'button');
      element.setAttribute('tabindex', '0');
    }

    // Internal state change handler
    const notifyStateChange = (state, reason, buttonInstance) => {
      if (umbilical.onStateChange) {
        umbilical.onStateChange(state, reason, buttonInstance);
      }
    };

    // Update disabled state
    const updateDisabledState = (buttonInstance) => {
      if (isDisabled) {
        element.setAttribute('disabled', 'true');
        element.setAttribute('aria-disabled', 'true');
        element.classList.add('disabled');
      } else {
        element.removeAttribute('disabled');
        element.removeAttribute('aria-disabled');
        element.classList.remove('disabled');
      }
      if (buttonInstance) {
        notifyStateChange({ disabled: isDisabled }, 'disabled-change', buttonInstance);
      }
    };

    // Variable to hold instance reference
    let instance;

    // Click handler
    const handleClick = (event) => {
      if (isDisabled) {
        event.preventDefault();
        return;
      }

      clickCount++;
      
      try {
        umbilical.onClick(event, instance, clickCount);
      } catch (error) {
        if (umbilical.onError) {
          umbilical.onError(error);
        } else {
          console.error('Button click handler error:', error);
        }
      }
    };

    // Keyboard handler for accessibility
    const handleKeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick(event);
      }
    };

    // Set up event listeners
    element.addEventListener('click', handleClick);
    element.addEventListener('keydown', handleKeydown);

    // Apply initial disabled state (without notifying since instance doesn't exist yet)
    updateDisabledState();

    // Create instance interface
    instance = {
      // State access
      get element() {
        return element;
      },

      get disabled() {
        return isDisabled;
      },

      get clickCount() {
        return clickCount;
      },

      // Operations
      enable() {
        if (isDisabled) {
          isDisabled = false;
          updateDisabledState(instance);
        }
      },

      disable() {
        if (!isDisabled) {
          isDisabled = true;
          updateDisabledState(instance);
        }
      },

      setText(text) {
        element.textContent = text;
        notifyStateChange({ text }, 'text-change', instance);
      },

      addClass(className) {
        element.classList.add(className);
      },

      removeClass(className) {
        element.classList.remove(className);
      },

      // Programmatic click
      click() {
        if (!isDisabled) {
          element.click();
        }
      },

      // Focus management
      focus() {
        element.focus();
      },

      blur() {
        element.blur();
      }
    };

    // Lifecycle setup
    if (umbilical.onMount) {
      umbilical.onMount(instance);
    }

    // Cleanup handler
    if (umbilical.onDestroy) {
      instance.destroy = () => {
        element.removeEventListener('click', handleClick);
        element.removeEventListener('keydown', handleKeydown);
        
        if (umbilical.className) {
          element.classList.remove(umbilical.className);
        }
        
        umbilical.onDestroy(instance);
      };
    }

    return instance;
  }
};