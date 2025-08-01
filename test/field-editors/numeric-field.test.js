/**
 * @jest-environment jsdom
 */

import { NumericField } from '../../src/components/field-editors/numeric-field/index.js';

describe('NumericField Component', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Introspection', () => {
    test('should return component info when called without umbilical', () => {
      const info = NumericField.create();
      
      expect(info.name).toBe('NumericField');
      expect(info.version).toBe('1.0.0');
      expect(info.capabilities).toContain('input');
      expect(info.capabilities).toContain('validation');
      expect(info.capabilities).toContain('events');
      expect(info.capabilities).toContain('numeric');
    });
  });

  describe('Instance Creation', () => {
    test('should create numeric field with minimal configuration', () => {
      const field = NumericField.create({
        dom: container
      });

      expect(field).toBeDefined();
      expect(field.getValue()).toBe(0);
      expect(container.children.length).toBe(2); // input + validation message
      
      const input = container.querySelector('input');
      expect(input).toBeDefined();
      expect(input.type).toBe('number');
      expect(input.style.textAlign).toBe('right');
    });

    test('should throw error when DOM container is missing', () => {
      expect(() => {
        NumericField.create({});
      }).toThrow('NumericField requires a DOM container element');
    });

    test('should initialize with provided numeric value', () => {
      const field = NumericField.create({
        value: 42,
        dom: container
      });

      expect(field.getValue()).toBe(42);
      const input = container.querySelector('input');
      expect(input.value).toBe('42');
    });

    test('should parse string values to numbers', () => {
      const field = NumericField.create({
        value: '123.45',
        dom: container
      });

      expect(field.getValue()).toBe(123.45);
    });

    test('should apply numeric constraints', () => {
      const field = NumericField.create({
        min: 0,
        max: 100,
        step: 0.5,
        dom: container
      });

      const input = container.querySelector('input');
      expect(input.min).toBe('0');
      expect(input.max).toBe('100');
      expect(input.step).toBe('0.5');
    });

    test('should handle decimal precision', () => {
      const field = NumericField.create({
        value: 123.456789,
        decimals: 2,
        dom: container
      });

      expect(field.getValue()).toBe(123.46); // rounded to 2 decimals
      const input = container.querySelector('input');
      expect(input.value).toBe('123.46');
    });
  });

  describe('Number Parsing and Formatting', () => {
    test('should parse valid numbers correctly', () => {
      const field = NumericField.create({
        dom: container
      });

      field.setValue('42.5');
      expect(field.getValue()).toBe(42.5);

      field.setValue('-10');
      expect(field.getValue()).toBe(-10);

      field.setValue('0');
      expect(field.getValue()).toBe(0);
    });

    test('should handle invalid input gracefully', () => {
      const field = NumericField.create({
        dom: container
      });

      field.setValue('not a number');
      expect(field.getValue()).toBe(null);

      field.setValue('');
      expect(field.getValue()).toBe(null);
    });

    test('should format numbers on blur', () => {
      const field = NumericField.create({
        decimals: 2,
        dom: container
      });

      const input = container.querySelector('input');
      
      // Set raw value and focus
      input.value = '42.1';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('focus'));
      
      // Should show raw number while focused
      expect(input.value).toBe('42.1');
      
      // Should format on blur
      input.dispatchEvent(new Event('blur'));
      expect(input.value).toBe('42.10');
    });

    test('should use custom formatter when provided', () => {
      const currencyFormatter = (num) => `$${num.toFixed(2)}`;
      
      const field = NumericField.create({
        value: 42.5,
        format: currencyFormatter,
        dom: container
      });

      // Should be formatted initially (not focused)
      const input = container.querySelector('input');
      expect(input.value).toBe('$42.50');
      
      // Should show raw number on focus
      input.dispatchEvent(new Event('focus'));
      expect(input.value).toBe('42.5');
      
      // Should format again on blur
      input.dispatchEvent(new Event('blur'));
      expect(input.value).toBe('$42.50');
    });
  });

  describe('User Input', () => {
    test('should update value when user types valid numbers', () => {
      const onChange = jest.fn();
      const field = NumericField.create({
        onChange,
        dom: container
      });

      const input = container.querySelector('input');
      input.value = '123.45';
      input.dispatchEvent(new Event('input'));

      expect(field.getValue()).toBe(123.45);
      expect(onChange).toHaveBeenCalledWith(123.45, 0);
    });

    test('should handle programmatic value changes', () => {
      const field = NumericField.create({
        dom: container
      });

      field.setValue(99.99);

      expect(field.getValue()).toBe(99.99);
      const input = container.querySelector('input');
      expect(input.value).toBe('99.99');
    });

    test('should handle negative numbers', () => {
      const field = NumericField.create({
        dom: container
      });

      field.setValue(-42);

      expect(field.getValue()).toBe(-42);
      const input = container.querySelector('input');
      expect(input.value).toBe('-42');
    });

    test('should respect decimal precision on input', () => {
      const field = NumericField.create({
        decimals: 1,
        dom: container
      });

      field.setValue(123.456);
      expect(field.getValue()).toBe(123.5); // rounded to 1 decimal
    });
  });

  describe('Validation', () => {
    test('should validate required fields', () => {
      const onValidate = jest.fn();
      const field = NumericField.create({
        required: true,
        onValidate,
        dom: container
      });

      // Null value should be invalid
      field.setValue(null);
      const validation = field.validate();
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('This field is required');
      expect(onValidate).toHaveBeenCalledWith(validation);

      // Numeric value should be valid
      field.setValue(42);
      const validation2 = field.validate();
      expect(validation2.valid).toBe(true);
      expect(validation2.message).toBe(null);
    });

    test('should validate minimum value constraint', () => {
      const field = NumericField.create({
        min: 10,
        dom: container
      });

      field.setValue(5);
      const validation = field.validate();
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('Value must be at least 10');

      field.setValue(15);
      const validation2 = field.validate();
      expect(validation2.valid).toBe(true);
    });

    test('should validate maximum value constraint', () => {
      const field = NumericField.create({
        max: 100,
        dom: container
      });

      field.setValue(150);
      const validation = field.validate();
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('Value must be at most 100');

      field.setValue(50);
      const validation2 = field.validate();
      expect(validation2.valid).toBe(true);
    });

    test('should validate number format', () => {
      const field = NumericField.create({
        dom: container
      });

      const input = container.querySelector('input');
      input.value = 'not a number';
      input.dispatchEvent(new Event('input'));

      expect(field.getValue()).toBe(null);
      
      const validation = field.validate();
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('Please enter a valid number');
    });

    test('should use custom validator when provided', () => {
      const evenNumberValidator = (value) => {
        if (value !== null && value % 2 !== 0) {
          return { valid: false, message: 'Must be an even number' };
        }
        return { valid: true, message: null };
      };

      const field = NumericField.create({
        validator: evenNumberValidator,
        dom: container
      });

      field.setValue(7);
      const validation = field.validate();
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('Must be an even number');

      field.setValue(8);
      const validation2 = field.validate();
      expect(validation2.valid).toBe(true);
    });

    test('should show validation errors in UI', () => {
      const field = NumericField.create({
        min: 10,
        dom: container
      });

      field.setValue(5);
      field.validate();

      const input = container.querySelector('input');
      const validationEl = container.children[1];
      
      expect(input.style.borderColor).toBe('rgb(239, 68, 68)'); // red
      expect(validationEl.style.display).toBe('block');
      expect(validationEl.textContent).toBe('Value must be at least 10');
    });
  });

  describe('Focus and Blur Events', () => {
    test('should handle focus events and show raw number', () => {
      const onFocus = jest.fn();
      const field = NumericField.create({
        value: 42.1,
        decimals: 2,
        onFocus,
        dom: container
      });

      const input = container.querySelector('input');
      
      // Initially formatted
      expect(input.value).toBe('42.10');
      
      input.dispatchEvent(new Event('focus'));

      expect(onFocus).toHaveBeenCalled();
      expect(input.value).toBe('42.1'); // raw number for editing
      expect(input.style.borderColor).toBe('rgb(59, 130, 246)'); // blue
    });

    test('should handle blur events and format number', () => {
      const onBlur = jest.fn();
      const field = NumericField.create({
        decimals: 2,
        onBlur,
        dom: container
      });

      const input = container.querySelector('input');
      input.value = '42.1';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('focus'));
      input.dispatchEvent(new Event('blur'));

      expect(onBlur).toHaveBeenCalled();
      expect(input.value).toBe('42.10'); // formatted
      expect(input.style.borderColor).toBe('rgb(226, 232, 240)'); // gray
    });
  });

  describe('State Management', () => {
    test('should enable/disable field', () => {
      const field = NumericField.create({
        dom: container
      });

      const input = container.querySelector('input');
      expect(input.disabled).toBe(false);

      field.setDisabled(true);
      expect(input.disabled).toBe(true);
      expect(input.style.background).toBe('rgb(248, 250, 252)'); // disabled bg

      field.setDisabled(false);
      expect(input.disabled).toBe(false);
      expect(input.style.background).toBe('rgb(255, 255, 255)'); // enabled bg
    });

    test('should make field readonly', () => {
      const field = NumericField.create({
        dom: container
      });

      const input = container.querySelector('input');
      expect(input.readOnly).toBe(false);

      field.setReadonly(true);
      expect(input.readOnly).toBe(true);

      field.setReadonly(false);
      expect(input.readOnly).toBe(false);
    });

    test('should focus and blur programmatically', () => {
      const field = NumericField.create({
        dom: container
      });

      const input = container.querySelector('input');
      const focusSpy = jest.spyOn(input, 'focus');
      const blurSpy = jest.spyOn(input, 'blur');

      field.focus();
      expect(focusSpy).toHaveBeenCalled();

      field.blur();
      expect(blurSpy).toHaveBeenCalled();
    });

    test('should report validation state', () => {
      const field = NumericField.create({
        min: 10,
        dom: container
      });

      field.setValue(5);
      expect(field.isValid()).toBe(false);
      expect(field.getValidationMessage()).toBe('Value must be at least 10');

      field.setValue(15);
      expect(field.isValid()).toBe(true);
      expect(field.getValidationMessage()).toBe(null);
    });

    test('should handle value changes while focused vs blurred', () => {
      const field = NumericField.create({
        decimals: 1,
        dom: container
      });

      const input = container.querySelector('input');
      
      // When not focused, should show formatted value
      field.setValue(42.12);
      expect(input.value).toBe('42.1');
      
      // When focused, should show raw value
      input.dispatchEvent(new Event('focus'));
      field.setValue(99.98);
      expect(input.value).toBe('99.98');
    });
  });

  describe('Lifecycle Management', () => {
    test('should clean up event listeners on destroy', () => {
      const field = NumericField.create({
        dom: container
      });

      const input = container.querySelector('input');
      const removeEventListenerSpy = jest.spyOn(input, 'removeEventListener');

      field.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('input', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('blur', expect.any(Function));
    });

    test('should remove DOM elements on destroy', () => {
      const field = NumericField.create({
        dom: container
      });

      expect(container.children.length).toBe(2);

      field.destroy();

      expect(container.children.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero values correctly', () => {
      const field = NumericField.create({
        dom: container
      });

      field.setValue(0);
      expect(field.getValue()).toBe(0);
      
      const input = container.querySelector('input');
      expect(input.value).toBe('0');
    });

    test('should handle very large numbers', () => {
      const largeNumber = 1234567890.123456;
      const field = NumericField.create({
        dom: container
      });

      field.setValue(largeNumber);
      expect(field.getValue()).toBe(largeNumber);
    });

    test('should handle very small decimal numbers', () => {
      const smallNumber = 0.000001;
      const field = NumericField.create({
        dom: container
      });

      field.setValue(smallNumber);
      expect(field.getValue()).toBe(smallNumber);
    });

    test('should handle scientific notation input', () => {
      const field = NumericField.create({
        dom: container
      });

      const input = container.querySelector('input');
      input.value = '1e6';
      input.dispatchEvent(new Event('input'));

      expect(field.getValue()).toBe(1000000);
    });

    test('should handle infinity and NaN gracefully', () => {
      const field = NumericField.create({
        dom: container
      });

      field.setValue(Infinity);
      expect(field.getValue()).toBe(null);

      field.setValue(NaN);
      expect(field.getValue()).toBe(null);
    });

    test('should handle rapid value changes', () => {
      const onChange = jest.fn();
      const field = NumericField.create({
        onChange,
        dom: container
      });

      // Rapid changes
      field.setValue(1);
      field.setValue(2);
      field.setValue(3);

      expect(onChange).toHaveBeenCalledTimes(3);
      expect(field.getValue()).toBe(3);
    });

    test('should maintain precision with decimal operations', () => {
      const field = NumericField.create({
        decimals: 2,
        dom: container
      });

      // Test common floating point precision issues
      field.setValue(0.1 + 0.2); // Usually 0.30000000000000004
      expect(field.getValue()).toBe(0.30); // Should be rounded to 2 decimals
    });
  });
});