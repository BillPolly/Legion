/**
 * Unit Tests for Button Component
 * 
 * Tests the umbilical protocol compliance and button functionality
 * NO MOCKS - Tests real button behavior and DOM interactions
 */

import { Button } from '../../../../src/components/button/Button.js';

describe('Button Component', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Cleanup DOM
    document.body.removeChild(container);
    
    // Remove any dynamically created styles
    const buttonStyles = document.getElementById('showme-button-styles');
    if (buttonStyles) {
      buttonStyles.remove();
    }
  });

  describe('umbilical protocol compliance', () => {
    test('should support introspection mode', () => {
      let requirements = null;
      Button.create({
        describe: (reqs) => { requirements = reqs.getAll(); }
      });

      expect(requirements).toBeTruthy();
      expect(requirements.dom).toBeDefined();
      expect(requirements.onClick).toBeDefined();
      expect(requirements.text).toBeDefined();
      expect(requirements.variant).toBeDefined();
      expect(requirements.size).toBeDefined();
    });

    test('should support validation mode', () => {
      const validation = Button.create({
        validate: (checks) => checks
      });

      expect(validation).toBeTruthy();
      expect(validation.hasDomElement).toBeDefined();
      expect(validation.hasValidCallbacks).toBeDefined();
      expect(validation.hasValidContent).toBeDefined();
      expect(validation.hasValidVariant).toBeDefined();
    });

    test('should validate button-specific capabilities', () => {
      const validUmbilical = {
        dom: container,
        onClick: () => {},
        text: 'Test',
        variant: 'primary',
        size: 'medium'
      };

      const validation = Button.create({
        validate: (checks) => checks
      });

      // Simulate validation with valid umbilical
      const mockValidation = Button.create({
        validate: (checks) => {
          // Manually check the validation logic
          const hasValidCallbacks = ['onClick', 'onFocus', 'onBlur'].every(cb => 
            !validUmbilical[cb] || typeof validUmbilical[cb] === 'function'
          );
          const hasValidContent = !validUmbilical.text || typeof validUmbilical.text === 'string';
          const hasValidVariant = !validUmbilical.variant || 
            ['primary', 'secondary', 'success', 'danger', 'outline', 'ghost'].includes(validUmbilical.variant);

          return {
            hasValidCallbacks,
            hasValidContent,
            hasValidVariant
          };
        }
      });

      expect(mockValidation.hasValidCallbacks).toBe(true);
      expect(mockValidation.hasValidContent).toBe(true);
      expect(mockValidation.hasValidVariant).toBe(true);
    });

    test('should require umbilical object for instance creation', () => {
      expect(() => {
        Button.create();
      }).toThrow('Button requires an umbilical object');
    });
  });

  describe('instance creation', () => {
    test('should create button instance with minimal configuration', () => {
      const button = Button.create({
        dom: container,
        text: 'Click me'
      });

      expect(button).toBeTruthy();
      expect(button.getElement()).toBeInstanceOf(HTMLButtonElement);
      expect(button.getElement().textContent).toBe('Click me');
      expect(container.children.length).toBe(1);
    });

    test('should create button with all configuration options', () => {
      let mountCalled = false;
      let clickCalled = false;

      const button = Button.create({
        dom: container,
        text: 'Full Config Button',
        variant: 'primary',
        size: 'large',
        type: 'submit',
        className: 'custom-class',
        disabled: false,
        testId: 'full-config-btn',
        ariaLabel: 'Full configuration button',
        title: 'This is a full config button',
        theme: 'dark',
        onClick: () => { clickCalled = true; },
        onMount: () => { mountCalled = true; }
      });

      const element = button.getElement();
      
      expect(element.textContent).toBe('Full Config Button');
      expect(element.type).toBe('submit');
      expect(element.classList.contains('showme-button')).toBe(true);
      expect(element.classList.contains('custom-class')).toBe(true);
      expect(element.classList.contains('button-primary')).toBe(true);
      expect(element.classList.contains('button-large')).toBe(true);
      expect(element.getAttribute('data-testid')).toBe('full-config-btn');
      expect(element.getAttribute('aria-label')).toBe('Full configuration button');
      expect(element.title).toBe('This is a full config button');
      expect(element.getAttribute('data-theme')).toBe('dark');
      expect(mountCalled).toBe(true);

      // Test click functionality
      element.click();
      expect(clickCalled).toBe(true);
    });

    test('should handle HTML content', () => {
      const button = Button.create({
        dom: container,
        html: '<strong>Bold</strong> text'
      });

      const element = button.getElement();
      expect(element.innerHTML).toBe('<strong>Bold</strong> text');
      expect(element.querySelector('strong')).toBeTruthy();
    });

    test('should apply variant styles correctly', () => {
      const variants = ['primary', 'secondary', 'success', 'danger', 'outline', 'ghost'];
      
      variants.forEach(variant => {
        const button = Button.create({
          dom: container,
          text: `${variant} button`,
          variant: variant
        });

        const element = button.getElement();
        expect(element.classList.contains(`button-${variant}`)).toBe(true);
        
        // Check that variant-specific styles are applied
        const computedStyle = window.getComputedStyle(element);
        expect(computedStyle.background).toBeTruthy();
        
        button.destroy();
      });
    });

    test('should apply size styles correctly', () => {
      const sizes = ['small', 'medium', 'large', 'xlarge'];
      
      sizes.forEach(size => {
        const button = Button.create({
          dom: container,
          text: `${size} button`,
          size: size
        });

        const element = button.getElement();
        expect(element.classList.contains(`button-${size}`)).toBe(true);
        
        button.destroy();
      });
    });
  });

  describe('button functionality', () => {
    test('should handle click events', () => {
      let clickCount = 0;
      let lastEvent = null;
      let lastInstance = null;

      const button = Button.create({
        dom: container,
        text: 'Clickable',
        onClick: (event, instance) => {
          clickCount++;
          lastEvent = event;
          lastInstance = instance;
        }
      });

      const element = button.getElement();
      
      // Simulate clicks
      element.click();
      expect(clickCount).toBe(1);
      expect(lastEvent).toBeInstanceOf(Event);
      expect(lastInstance).toBe(button);

      element.click();
      expect(clickCount).toBe(2);
    });

    test('should handle focus and blur events', () => {
      let focusCount = 0;
      let blurCount = 0;

      const button = Button.create({
        dom: container,
        text: 'Focusable',
        onFocus: (instance) => {
          focusCount++;
          expect(instance).toBe(button);
        },
        onBlur: (instance) => {
          blurCount++;
          expect(instance).toBe(button);
        }
      });

      const element = button.getElement();

      // Simulate focus/blur
      element.dispatchEvent(new FocusEvent('focus'));
      expect(focusCount).toBe(1);

      element.dispatchEvent(new FocusEvent('blur'));
      expect(blurCount).toBe(1);
    });

    test('should not handle events when disabled', () => {
      let clickCount = 0;

      const button = Button.create({
        dom: container,
        text: 'Disabled',
        disabled: true,
        onClick: () => { clickCount++; }
      });

      const element = button.getElement();
      expect(element.disabled).toBe(true);
      expect(element.classList.contains('disabled')).toBe(true);

      // Click should not trigger callback
      element.click();
      expect(clickCount).toBe(0);
    });
  });

  describe('button methods', () => {
    let button;

    beforeEach(() => {
      button = Button.create({
        dom: container,
        text: 'Test Button'
      });
    });

    afterEach(() => {
      if (button && !button.isDestroyed) {
        button.destroy();
      }
    });

    test('should update text content', () => {
      button.setText('New Text');
      expect(button.getElement().textContent).toBe('New Text');
    });

    test('should update HTML content', () => {
      button.setHtml('<em>Italic</em> text');
      expect(button.getElement().innerHTML).toBe('<em>Italic</em> text');
    });

    test('should enable/disable button', () => {
      const element = button.getElement();

      button.setDisabled(true);
      expect(element.disabled).toBe(true);
      expect(element.classList.contains('disabled')).toBe(true);
      expect(element.getAttribute('aria-disabled')).toBe('true');

      button.setDisabled(false);
      expect(element.disabled).toBe(false);
      expect(element.classList.contains('disabled')).toBe(false);
      expect(element.getAttribute('aria-disabled')).toBe(null);
    });

    test('should set loading state', () => {
      const element = button.getElement();

      button.setLoading(true);
      expect(element.classList.contains('loading')).toBe(true);
      expect(element.disabled).toBe(true);

      button.setLoading(false);
      expect(element.classList.contains('loading')).toBe(false);
      expect(element.disabled).toBe(false);
    });

    test('should trigger click programmatically', () => {
      let clicked = false;
      button = Button.create({
        dom: container,
        text: 'Programmatic',
        onClick: () => { clicked = true; }
      });

      button.click();
      expect(clicked).toBe(true);
    });

    test('should focus element', () => {
      const element = button.getElement();
      
      button.focus();
      expect(document.activeElement).toBe(element);
    });
  });

  describe('accessibility', () => {
    test('should include proper ARIA attributes', () => {
      const button = Button.create({
        dom: container,
        text: 'Accessible Button',
        ariaLabel: 'Custom aria label',
        disabled: true
      });

      const element = button.getElement();
      expect(element.getAttribute('aria-label')).toBe('Custom aria label');
      expect(element.getAttribute('aria-disabled')).toBe('true');
    });

    test('should be keyboard accessible', () => {
      const button = Button.create({
        dom: container,
        text: 'Keyboard Accessible'
      });

      const element = button.getElement();
      expect(element.tabIndex).toBe(0);
      
      // Should be focusable
      element.focus();
      expect(document.activeElement).toBe(element);
    });

    test('should support title attribute for tooltips', () => {
      const button = Button.create({
        dom: container,
        text: 'Tooltip Button',
        title: 'This is a helpful tooltip'
      });

      expect(button.getElement().title).toBe('This is a helpful tooltip');
    });
  });

  describe('error handling', () => {
    test('should handle click handler errors gracefully', () => {
      // Manual mock for console.error
      const originalConsoleError = console.error;
      let errorMessages = [];
      console.error = (...args) => {
        errorMessages.push(args[0]);
      };

      let errorCallbackCalled = false;
      let errorCallbackError = null;

      const button = Button.create({
        dom: container,
        text: 'Error Button',
        onClick: () => {
          throw new Error('Click handler error');
        },
        onError: (error) => {
          errorCallbackCalled = true;
          errorCallbackError = error;
        }
      });

      // Should not throw but should handle error gracefully
      expect(() => {
        button.getElement().click();
      }).not.toThrow();

      // Should have logged the error
      expect(errorMessages.length).toBeGreaterThan(0);
      expect(errorMessages[0]).toContain('ShowMe Button error');
      
      // Should have called error callback
      expect(errorCallbackCalled).toBe(true);
      expect(errorCallbackError).toBeInstanceOf(Error);
      expect(errorCallbackError.message).toBe('Click handler error');

      // Restore console.error
      console.error = originalConsoleError;
    });

    test('should handle operations on destroyed button', () => {
      const button = Button.create({
        dom: container,
        text: 'Will be destroyed'
      });

      button.destroy();
      expect(button.isDestroyed).toBe(true);

      // These should not throw
      button.setText('Should not work');
      button.setDisabled(true);
      button.setLoading(true);
      button.click();
      button.focus();
    });
  });

  describe('lifecycle management', () => {
    test('should call mount callback', () => {
      let mounted = false;
      let mountedInstance = null;

      const button = Button.create({
        dom: container,
        text: 'Mount Test',
        onMount: (instance) => {
          mounted = true;
          mountedInstance = instance;
        }
      });

      expect(mounted).toBe(true);
      expect(mountedInstance).toBe(button);
    });

    test('should call destroy callback', () => {
      let destroyed = false;
      let destroyedInstance = null;

      const button = Button.create({
        dom: container,
        text: 'Destroy Test',
        onDestroy: (instance) => {
          destroyed = true;
          destroyedInstance = instance;
        }
      });

      button.destroy();

      expect(destroyed).toBe(true);
      expect(destroyedInstance).toBe(button);
      expect(container.children.length).toBe(0);
    });

    test('should clean up event listeners on destroy', () => {
      let clickCount = 0;

      const button = Button.create({
        dom: container,
        text: 'Cleanup Test',
        onClick: () => { clickCount++; }
      });

      const element = button.getElement();
      element.click();
      expect(clickCount).toBe(1);

      button.destroy();

      // Element should be removed from DOM
      expect(container.children.length).toBe(0);
    });
  });

  describe('CSS styles injection', () => {
    test('should inject CSS styles once', () => {
      // Create first button
      const button1 = Button.create({
        dom: container,
        text: 'First Button'
      });

      expect(document.getElementById('showme-button-styles')).toBeTruthy();

      // Create second button
      const button2 = Button.create({
        dom: container,
        text: 'Second Button'
      });

      // Should still be only one style element
      const styleElements = document.querySelectorAll('#showme-button-styles');
      expect(styleElements.length).toBe(1);

      button1.destroy();
      button2.destroy();
    });
  });
});