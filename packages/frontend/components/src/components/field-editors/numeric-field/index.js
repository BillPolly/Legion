import { UmbilicalUtils, UmbilicalError } from '../../../umbilical/index.js';

/**
 * NumericField Component
 * 
 * A reusable numeric input field editor with validation.
 * Can be used standalone or within other components like Grid.
 */
export const NumericField = {
  /**
   * Create a NumericField instance or provide introspection
   */
  create(umbilical) {
    if (!umbilical) {
      return {
        name: 'NumericField',
        version: '1.0.0',
        capabilities: ['input', 'validation', 'events', 'numeric']
      };
    }

    const {
      value = 0,
      defaultValue = 0,
      placeholder = '',
      min = null,
      max = null,
      step = 1,
      decimals = null,
      required = false,
      disabled = false,
      readonly = false,
      format = null,
      validator = null,
      onChange = null,
      onValidate = null,
      onFocus = null,
      onBlur = null,
      dom = null
    } = umbilical;

    if (!dom) {
      throw new UmbilicalError('NumericField requires a DOM container element', 'NumericField');
    }

    // Parse and format number functions (moved up)
    const parseNumber = (val) => {
      if (val === '' || val == null) return null;
      const num = parseFloat(val);
      if (isNaN(num) || !isFinite(num)) return null;
      
      if (decimals !== null && decimals >= 0) {
        return parseFloat(num.toFixed(decimals));
      }
      
      return num;
    };

    const formatNumber = (num) => {
      if (num == null) return '';
      if (format) return format(num);
      
      if (decimals !== null && decimals >= 0) {
        return num.toFixed(decimals);
      }
      
      return num.toString();
    };

    let initialValue = typeof value === 'number' && isFinite(value) ? value : 
                      (typeof value === 'string' ? parseNumber(value) : null) || 0;
    let currentValue = parseNumber(initialValue) !== null ? parseNumber(initialValue) : initialValue;
    let isValid = true;
    let validationMessage = null;
    let isFocused = false;

    // Create input element
    const input = document.createElement('input');
    input.type = 'number';
    input.value = currentValue.toString();
    input.placeholder = placeholder;
    input.disabled = disabled;
    input.readOnly = readonly;
    input.step = step;
    
    if (min !== null) {
      input.min = min;
    }
    if (max !== null) {
      input.max = max;
    }

    // Style the input
    input.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      border: 2px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      background: ${disabled ? '#f8fafc' : '#ffffff'};
      color: ${disabled ? '#94a3b8' : '#1e293b'};
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      text-align: right;
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
      if (required && (val == null || val === '')) {
        return { valid: false, message: 'This field is required' };
      }
      
      if (val !== null && val !== '') {
        const num = parseNumber(val);
        
        if (num === null) {
          return { valid: false, message: 'Please enter a valid number' };
        }
        
        if (min !== null && num < min) {
          return { valid: false, message: `Value must be at least ${min}` };
        }
        
        if (max !== null && num > max) {
          return { valid: false, message: `Value must be at most ${max}` };
        }
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
      const inputValue = input.value;
      const newValue = parseNumber(inputValue);
      const oldValue = currentValue;
      currentValue = newValue;
      
      const validation = validateValue(inputValue);
      updateValidation(validation);
      
      if (onChange) {
        onChange(newValue, oldValue);
      }
    };

    // Handle blur - format the display value
    const handleBlur = () => {
      isFocused = false;
      
      // Format the display value on blur
      if (currentValue !== null) {
        input.value = formatNumber(currentValue);
      }
      
      if (isValid) {
        input.style.borderColor = '#e2e8f0';
        input.style.boxShadow = 'none';
      }
      
      if (onBlur) {
        onBlur();
      }
    };

    // Handle focus - show raw number for editing
    const handleFocus = () => {
      isFocused = true;
      
      // Show raw number for editing
      if (currentValue !== null) {
        input.value = currentValue.toString();
      }
      
      if (isValid) {
        input.style.borderColor = '#3b82f6';
        input.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
      }
      
      if (onFocus) {
        onFocus();
      }
    };

    // Event listeners
    input.addEventListener('input', handleChange);
    input.addEventListener('focus', handleFocus);
    input.addEventListener('blur', handleBlur);

    // Append to DOM
    dom.appendChild(input);
    dom.appendChild(validationEl);

    // Initial validation and formatting
    const initialValidation = validateValue(currentValue);
    updateValidation(initialValidation);
    input.value = formatNumber(currentValue);

    // Return component instance
    return {
      getValue() {
        return currentValue;
      },
      
      setValue(newValue) {
        const num = typeof newValue === 'number' && isFinite(newValue) ? newValue : parseNumber(newValue);
        currentValue = num;
        input.value = isFocused ? (num !== null ? num.toString() : '') : formatNumber(num);
        const validation = validateValue(num);
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