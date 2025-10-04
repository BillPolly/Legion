import { UmbilicalUtils, UmbilicalError } from '@legion/components';

/**
 * BooleanField Component
 * 
 * A reusable checkbox/toggle field editor for boolean values.
 * Can be used standalone or within other components like Grid.
 */
export const BooleanField = {
  /**
   * Create a BooleanField instance or provide introspection
   */
  create(umbilical) {
    if (!umbilical) {
      return {
        name: 'BooleanField',
        version: '1.0.0',
        capabilities: ['input', 'validation', 'events', 'boolean']
      };
    }

    const {
      value = false,
      defaultValue = false,
      style = 'checkbox', // 'checkbox', 'toggle', 'radio'
      trueLabel = 'Yes',
      falseLabel = 'No',
      required = false,
      disabled = false,
      readonly = false,
      validator = null,
      onChange = null,
      onValidate = null,
      onFocus = null,
      onBlur = null,
      dom = null
    } = umbilical;

    if (!dom) {
      throw new UmbilicalError('BooleanField requires a DOM container element', 'BooleanField');
    }

    let currentValue = Boolean(value);
    let isValid = true;
    let validationMessage = null;
    let isFocused = false;

    // Create container
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-family: inherit;
    `;

    let input, label;

    if (style === 'toggle') {
      // Create toggle switch
      const toggleContainer = document.createElement('div');
      toggleContainer.style.cssText = `
        position: relative;
        width: 44px;
        height: 24px;
        background: ${currentValue ? '#3b82f6' : '#cbd5e1'};
        border-radius: 12px;
        cursor: ${disabled || readonly ? 'not-allowed' : 'pointer'};
        transition: background-color 0.2s;
        opacity: ${disabled ? '0.5' : '1'};
      `;

      const toggleKnob = document.createElement('div');
      toggleKnob.style.cssText = `
        position: absolute;
        top: 2px;
        left: ${currentValue ? '22px' : '2px'};
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        transition: left 0.2s;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      `;

      toggleContainer.appendChild(toggleKnob);

      // Create hidden input for form submission
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = currentValue;
      input.disabled = disabled;
      input.style.display = 'none';

      // Label
      label = document.createElement('span');
      label.textContent = currentValue ? trueLabel : falseLabel;
      label.style.cssText = `
        color: ${disabled ? '#94a3b8' : '#1e293b'};
        cursor: ${disabled || readonly ? 'not-allowed' : 'pointer'};
      `;

      container.appendChild(toggleContainer);
      container.appendChild(input);
      container.appendChild(label);

      // Click handler for toggle
      const handleToggleClick = () => {
        if (disabled || readonly) return;
        
        const newValue = !currentValue;
        const oldValue = currentValue;
        currentValue = newValue;
        
        // Update UI
        input.checked = newValue;
        toggleContainer.style.background = newValue ? '#3b82f6' : '#cbd5e1';
        toggleKnob.style.left = newValue ? '22px' : '2px';
        label.textContent = newValue ? trueLabel : falseLabel;
        
        // Validate and notify
        const validation = validateValue(newValue);
        updateValidation(validation);
        
        if (onChange) {
          onChange(newValue, oldValue);
        }
      };

      toggleContainer.addEventListener('click', handleToggleClick);
      label.addEventListener('click', handleToggleClick);

    } else {
      // Create checkbox or radio
      input = document.createElement('input');
      input.type = style === 'radio' ? 'radio' : 'checkbox';
      input.checked = currentValue;
      input.disabled = disabled;
      
      input.style.cssText = `
        width: 16px;
        height: 16px;
        margin: 0;
        cursor: ${disabled || readonly ? 'not-allowed' : 'pointer'};
        accent-color: #3b82f6;
      `;

      // Label
      label = document.createElement('label');
      label.textContent = currentValue ? trueLabel : falseLabel;
      label.style.cssText = `
        color: ${disabled ? '#94a3b8' : '#1e293b'};
        cursor: ${disabled || readonly ? 'not-allowed' : 'pointer'};
        user-select: none;
      `;

      container.appendChild(input);
      container.appendChild(label);

      // Click handler for checkbox/radio
      const handleInputChange = () => {
        if (readonly) {
          input.checked = currentValue;
          return;
        }
        
        const newValue = input.checked;
        const oldValue = currentValue;
        currentValue = newValue;
        
        // Update label
        label.textContent = newValue ? trueLabel : falseLabel;
        
        // Validate and notify
        const validation = validateValue(newValue);
        updateValidation(validation);
        
        if (onChange) {
          onChange(newValue, oldValue);
        }
      };

      input.addEventListener('change', handleInputChange);
      label.addEventListener('click', () => {
        if (!disabled && !readonly) {
          input.click();
        }
      });
    }

    // Create validation message element
    const validationEl = document.createElement('div');
    validationEl.style.cssText = `
      margin-top: 4px;
      font-size: 12px;
      color: #ef4444;
      display: none;
    `;

    // Validation function
    const validateValue = (val) => {
      if (required && !val) {
        return { valid: false, message: 'This field is required' };
      }
      
      if (validator) {
        return validator(val);
      }
      
      return { valid: true, message: null };
    };

    // Update validation state
    const updateValidation = (validation) => {
      isValid = validation.valid;
      validationMessage = validation.message;
      
      if (isValid) {
        container.style.borderColor = 'transparent';
        validationEl.style.display = 'none';
      } else {
        validationEl.textContent = validationMessage;
        validationEl.style.display = 'block';
      }
      
      if (onValidate) {
        onValidate(validation);
      }
    };

    // Focus/blur handlers
    const handleFocus = () => {
      isFocused = true;
      if (onFocus) {
        onFocus();
      }
    };

    const handleBlur = () => {
      isFocused = false;
      if (onBlur) {
        onBlur();
      }
    };

    input.addEventListener('focus', handleFocus);
    input.addEventListener('blur', handleBlur);

    // Append to DOM
    dom.appendChild(container);
    dom.appendChild(validationEl);

    // Initial validation
    const initialValidation = validateValue(currentValue);
    updateValidation(initialValidation);

    // Return component instance
    return {
      getValue() {
        return currentValue;
      },
      
      setValue(newValue) {
        const boolValue = Boolean(newValue);
        currentValue = boolValue;
        input.checked = boolValue;
        
        if (style === 'toggle') {
          const toggleContainer = container.firstChild;
          const toggleKnob = toggleContainer.firstChild;
          toggleContainer.style.background = boolValue ? '#3b82f6' : '#cbd5e1';
          toggleKnob.style.left = boolValue ? '22px' : '2px';
        }
        
        label.textContent = boolValue ? trueLabel : falseLabel;
        
        const validation = validateValue(boolValue);
        updateValidation(validation);
      },
      
      focus() {
        input.focus();
      },
      
      blur() {
        input.blur();
      },
      
      setDisabled(isDisabled) {
        input.disabled = isDisabled;
        container.style.opacity = isDisabled ? '0.5' : '1';
        const cursor = isDisabled ? 'not-allowed' : 'pointer';
        
        if (style === 'toggle') {
          container.firstChild.style.cursor = cursor;
        } else {
          input.style.cursor = cursor;
        }
        
        label.style.cursor = cursor;
        label.style.color = isDisabled ? '#94a3b8' : '#1e293b';
      },
      
      setReadonly(isReadonly) {
        const cursor = isReadonly ? 'not-allowed' : 'pointer';
        
        if (style === 'toggle') {
          container.firstChild.style.cursor = cursor;
        } else {
          input.style.cursor = cursor;
        }
        
        label.style.cursor = cursor;
      },
      
      isValid() {
        return isValid;
      },
      
      getValidationMessage() {
        return validationMessage;
      },
      
      validate() {
        const validation = validateValue(currentValue);
        updateValidation(validation);
        return validation;
      },
      
      destroy() {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
        dom.removeChild(container);
        dom.removeChild(validationEl);
      }
    };
  }
};