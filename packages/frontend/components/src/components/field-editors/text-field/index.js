import { UmbilicalUtils, UmbilicalError } from '@legion/components';

/**
 * TextField Component
 * 
 * A reusable text input field editor that follows the umbilical protocol.
 * Can be used standalone or within other components like Grid.
 */
export const TextField = {
  /**
   * Create a TextField instance or provide introspection
   */
  create(umbilical) {
    if (!umbilical) {
      return {
        name: 'TextField',
        version: '1.0.0',
        capabilities: ['input', 'validation', 'events']
      };
    }

    const {
      value = '',
      defaultValue = '',
      placeholder = '',
      maxLength = null,
      multiline = false,
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
      throw new UmbilicalError('TextField requires a DOM container element', 'TextField');
    }

    let currentValue = value;
    let isValid = true;
    let validationMessage = null;
    let isFocused = false;

    // Create input element
    const input = document.createElement(multiline ? 'textarea' : 'input');
    if (!multiline) {
      input.type = 'text';
    }
    
    input.value = currentValue;
    input.placeholder = placeholder;
    input.disabled = disabled;
    input.readOnly = readonly;
    
    if (maxLength) {
      input.maxLength = maxLength;
    }

    // Style the input to fit the cell exactly
    input.style.cssText = `
      width: 100%;
      height: 100%;
      padding: 6px 8px;
      border: 1px solid #3b82f6;
      border-radius: 0;
      font-size: 14px;
      font-family: inherit;
      background: ${disabled ? '#f8fafc' : '#ffffff'};
      color: ${disabled ? '#94a3b8' : '#1e293b'};
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      resize: ${multiline ? 'vertical' : 'none'};
      box-sizing: border-box;
      ${multiline ? 'min-height: 80px;' : ''}
    `;

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
      if (required && (!val || val.trim() === '')) {
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
        input.style.borderColor = isFocused ? '#3b82f6' : '#e2e8f0';
        input.style.boxShadow = isFocused ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none';
        validationEl.style.display = 'none';
      } else {
        input.style.borderColor = '#ef4444';
        input.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
        validationEl.textContent = validationMessage;
        validationEl.style.display = 'block';
      }
      
      if (onValidate) {
        onValidate(validation);
      }
    };

    // Handle input changes
    const handleChange = () => {
      const newValue = input.value;
      const oldValue = currentValue;
      currentValue = newValue;
      
      const validation = validateValue(newValue);
      updateValidation(validation);
      
      if (onChange) {
        onChange(newValue, oldValue);
      }
    };

    // Handle focus
    const handleFocus = () => {
      isFocused = true;
      if (isValid) {
        input.style.borderColor = '#3b82f6';
        input.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
      }
      if (onFocus) {
        onFocus();
      }
    };

    // Handle blur
    const handleBlur = () => {
      isFocused = false;
      if (isValid) {
        input.style.borderColor = '#e2e8f0';
        input.style.boxShadow = 'none';
      }
      if (onBlur) {
        onBlur();
      }
    };

    // Event listeners
    input.addEventListener('input', handleChange);
    input.addEventListener('focus', handleFocus);
    input.addEventListener('blur', handleBlur);

    // Append to DOM
    dom.appendChild(input);
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
        currentValue = newValue;
        input.value = newValue;
        const validation = validateValue(newValue);
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
        input.style.background = isDisabled ? '#f8fafc' : '#ffffff';
        input.style.color = isDisabled ? '#94a3b8' : '#1e293b';
      },
      
      setReadonly(isReadonly) {
        input.readOnly = isReadonly;
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
        input.removeEventListener('input', handleChange);
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
        dom.removeChild(input);
        dom.removeChild(validationEl);
      }
    };
  }
};