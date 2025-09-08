/**
 * Button Component - Reusable button following umbilical protocol
 * 
 * Provides consistent button behavior with theming, accessibility,
 * and event handling for the ShowMe module.
 */

import { ShowMeBaseComponent } from '../base/ShowMeBaseComponent.js';

/**
 * Button Instance Class
 */
class ButtonInstance {
  constructor(umbilical, config) {
    this.umbilical = umbilical;
    this.config = config;
    this.element = null;
    this.eventListeners = [];
    this.isDestroyed = false;
    
    this.createElement();
    this.attachEventListeners();
    
    // Handle mount callback
    ShowMeBaseComponent.handleLifecycle('mount', umbilical, this);
  }

  /**
   * Create the button element
   */
  createElement() {
    this.element = ShowMeBaseComponent.createElement('button', 'showme-button', this.config);
    
    // Set button content
    if (this.config.text) {
      this.element.textContent = this.config.text;
    }
    
    if (this.config.html) {
      this.element.innerHTML = this.config.html;
    }

    // Set accessibility attributes
    if (this.config.ariaLabel) {
      this.element.setAttribute('aria-label', this.config.ariaLabel);
    }
    
    if (this.config.title) {
      this.element.title = this.config.title;
    }

    // Set button type
    this.element.type = this.config.type || 'button';
    
    // Set button variant
    if (this.config.variant) {
      this.element.classList.add(`button-${this.config.variant}`);
    }
    
    // Set size
    if (this.config.size) {
      this.element.classList.add(`button-${this.config.size}`);
    }

    // Apply custom styling
    this.applyButtonStyles();
    
    // Append to DOM if parent provided
    if (this.config.dom) {
      this.config.dom.appendChild(this.element);
    }
  }

  /**
   * Apply button styling
   */
  applyButtonStyles() {
    const baseStyles = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid #ccc;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-family: inherit;
      line-height: 1.4;
      transition: all 0.2s ease;
      text-decoration: none;
      white-space: nowrap;
    `;

    // Add hover and focus styles
    const hoverStyles = `
      background-color: #f3f4f6;
      border-color: #d1d5db;
    `;
    
    const focusStyles = `
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    `;

    const disabledStyles = `
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    `;

    // Apply base styles
    this.element.style.cssText = baseStyles;
    
    // Add variant styles
    this.applyVariantStyles();
    this.applySizeStyles();
    
    // Add CSS class styles to document if not already present
    this.ensureButtonStyles();
  }

  /**
   * Apply variant-specific styles
   */
  applyVariantStyles() {
    const variant = this.config.variant;
    
    switch (variant) {
      case 'primary':
        this.element.style.background = '#2563eb';
        this.element.style.borderColor = '#2563eb';
        this.element.style.color = 'white';
        break;
      case 'secondary':
        this.element.style.background = '#6b7280';
        this.element.style.borderColor = '#6b7280';
        this.element.style.color = 'white';
        break;
      case 'success':
        this.element.style.background = '#16a34a';
        this.element.style.borderColor = '#16a34a';
        this.element.style.color = 'white';
        break;
      case 'danger':
        this.element.style.background = '#dc2626';
        this.element.style.borderColor = '#dc2626';
        this.element.style.color = 'white';
        break;
      case 'outline':
        this.element.style.background = 'transparent';
        this.element.style.borderColor = '#2563eb';
        this.element.style.color = '#2563eb';
        break;
      case 'ghost':
        this.element.style.background = 'transparent';
        this.element.style.border = 'none';
        this.element.style.color = '#374151';
        break;
    }
  }

  /**
   * Apply size-specific styles
   */
  applySizeStyles() {
    const size = this.config.size;
    
    switch (size) {
      case 'small':
        this.element.style.padding = '4px 8px';
        this.element.style.fontSize = '12px';
        break;
      case 'large':
        this.element.style.padding = '12px 24px';
        this.element.style.fontSize = '16px';
        break;
      case 'xlarge':
        this.element.style.padding = '16px 32px';
        this.element.style.fontSize = '18px';
        break;
      // 'medium' is default, no changes needed
    }
  }

  /**
   * Ensure button CSS classes are available in document
   */
  ensureButtonStyles() {
    const styleId = 'showme-button-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .showme-button:hover:not(:disabled):not(.disabled) {
        background-color: var(--button-hover-bg, #f3f4f6);
        border-color: var(--button-hover-border, #d1d5db);
        transform: translateY(-1px);
      }

      .showme-button:focus:not(:disabled):not(.disabled) {
        outline: 2px solid var(--button-focus-color, #2563eb);
        outline-offset: 2px;
      }

      .showme-button:active:not(:disabled):not(.disabled) {
        transform: translateY(0);
      }

      .showme-button.disabled,
      .showme-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }

      .showme-button.loading {
        cursor: wait;
      }

      .showme-button.loading::after {
        content: '';
        width: 12px;
        height: 12px;
        border: 2px solid currentColor;
        border-top: 2px solid transparent;
        border-radius: 50%;
        animation: button-spin 1s linear infinite;
        margin-left: 6px;
      }

      @keyframes button-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Click handler
    if (this.config.onClick) {
      const clickHandler = ShowMeBaseComponent.createBoundEventHandler(this, (event) => {
        if (this.isDestroyed || this.config.disabled) return;
        
        try {
          this.config.onClick(event, this);
        } catch (error) {
          ShowMeBaseComponent.handleComponentError(error, 'Button', this.umbilical);
        }
      });
      
      this.element.addEventListener('click', clickHandler);
      this.eventListeners.push({ event: 'click', handler: clickHandler });
    }

    // Focus/blur handlers for accessibility
    const focusHandler = () => {
      if (this.config.onFocus) {
        try {
          this.config.onFocus(this);
        } catch (error) {
          ShowMeBaseComponent.handleComponentError(error, 'Button', this.umbilical);
        }
      }
    };

    const blurHandler = () => {
      if (this.config.onBlur) {
        try {
          this.config.onBlur(this);
        } catch (error) {
          ShowMeBaseComponent.handleComponentError(error, 'Button', this.umbilical);
        }
      }
    };

    this.element.addEventListener('focus', focusHandler);
    this.element.addEventListener('blur', blurHandler);
    this.eventListeners.push({ event: 'focus', handler: focusHandler });
    this.eventListeners.push({ event: 'blur', handler: blurHandler });
  }

  /**
   * Set button text
   * @param {string} text - New button text
   */
  setText(text) {
    if (this.isDestroyed) return;
    this.element.textContent = text;
  }

  /**
   * Set button HTML content
   * @param {string} html - New HTML content
   */
  setHtml(html) {
    if (this.isDestroyed) return;
    this.element.innerHTML = html;
  }

  /**
   * Enable/disable the button
   * @param {boolean} disabled - Disabled state
   */
  setDisabled(disabled) {
    if (this.isDestroyed) return;
    
    this.config.disabled = disabled;
    this.element.disabled = disabled;
    
    if (disabled) {
      this.element.classList.add('disabled');
      this.element.setAttribute('aria-disabled', 'true');
    } else {
      this.element.classList.remove('disabled');
      this.element.removeAttribute('aria-disabled');
    }
  }

  /**
   * Set loading state
   * @param {boolean} loading - Loading state
   */
  setLoading(loading) {
    if (this.isDestroyed) return;
    
    if (loading) {
      this.element.classList.add('loading');
      this.element.disabled = true;
    } else {
      this.element.classList.remove('loading');
      this.element.disabled = this.config.disabled;
    }
  }

  /**
   * Trigger button click programmatically
   */
  click() {
    if (this.isDestroyed || this.config.disabled) return;
    this.element.click();
  }

  /**
   * Focus the button
   */
  focus() {
    if (this.isDestroyed) return;
    this.element.focus();
  }

  /**
   * Get the DOM element
   * @returns {HTMLElement} Button element
   */
  getElement() {
    return this.element;
  }

  /**
   * Check if button is destroyed
   * @returns {boolean} True if destroyed
   */
  isDestroyed() {
    return this.isDestroyed;
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.isDestroyed) return;
    
    // Remove event listeners
    ShowMeBaseComponent.removeEventListeners(this.element, this.eventListeners);
    
    // Remove from DOM if still attached
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    // Handle destroy callback
    ShowMeBaseComponent.handleLifecycle('destroy', this.umbilical, this);
    
    // Clean up references
    this.element = null;
    this.eventListeners = [];
    this.isDestroyed = true;
  }
}

/**
 * Button Component Factory
 */
export const Button = {
  create(umbilical) {
    // 1. Introspection mode
    if (umbilical && umbilical.describe) {
      const requirements = ShowMeBaseComponent.defineRequirements();
      
      // Add button-specific requirements
      requirements.add('onClick', 'function', 'Click event handler - optional', false);
      requirements.add('onFocus', 'function', 'Focus event handler - optional', false);
      requirements.add('onBlur', 'function', 'Blur event handler - optional', false);
      requirements.add('text', 'string', 'Button text content - optional', false);
      requirements.add('html', 'string', 'Button HTML content - optional', false);
      requirements.add('ariaLabel', 'string', 'ARIA label for accessibility - optional', false);
      requirements.add('title', 'string', 'Button title/tooltip - optional', false);
      requirements.add('type', 'string', 'Button type (button|submit|reset) - optional', false);
      requirements.add('variant', 'string', 'Button variant (primary|secondary|success|danger|outline|ghost) - optional', false);
      requirements.add('size', 'string', 'Button size (small|medium|large|xlarge) - optional', false);
      
      umbilical.describe(requirements);
      return;
    }

    // 2. Validation mode
    if (umbilical && umbilical.validate) {
      const checks = ShowMeBaseComponent.validateCapabilities(umbilical);
      
      const buttonChecks = {
        ...checks,
        hasValidCallbacks: ['onClick', 'onFocus', 'onBlur'].every(cb => 
          !umbilical[cb] || typeof umbilical[cb] === 'function'
        ),
        hasValidContent: !umbilical.text || typeof umbilical.text === 'string',
        hasValidType: !umbilical.type || ['button', 'submit', 'reset'].includes(umbilical.type),
        hasValidVariant: !umbilical.variant || 
          ['primary', 'secondary', 'success', 'danger', 'outline', 'ghost'].includes(umbilical.variant),
        hasValidSize: !umbilical.size || 
          ['small', 'medium', 'large', 'xlarge'].includes(umbilical.size)
      };
      
      return umbilical.validate(buttonChecks);
    }

    // 3. Instance creation mode
    if (!umbilical) {
      throw new Error('Button requires an umbilical object');
    }

    // Extract configuration
    const config = ShowMeBaseComponent.extractConfig(umbilical, {
      text: '',
      html: '',
      type: 'button',
      variant: 'default',
      size: 'medium',
      ariaLabel: null,
      title: null,
      onClick: umbilical.onClick,
      onFocus: umbilical.onFocus,
      onBlur: umbilical.onBlur
    });

    // Create and return instance
    return new ButtonInstance(umbilical, config);
  }
};