/**
 * @jest-environment jsdom
 */

import { TextField } from '../../src/components/field-editors/text-field/index.js';

describe('TextField Component', () => {
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
      const info = TextField.create();
      
      expect(info.name).toBe('TextField');
      expect(info.version).toBe('1.0.0');
      expect(info.capabilities).toContain('input');
      expect(info.capabilities).toContain('validation');
      expect(info.capabilities).toContain('events');
    });
  });

  describe('Instance Creation', () => {
    test('should create text field with minimal configuration', () => {
      const field = TextField.create({
        dom: container
      });

      expect(field).toBeDefined();
      expect(field.getValue()).toBe('');
      expect(container.children.length).toBe(2); // input + validation message
      
      const input = container.querySelector('input');
      expect(input).toBeDefined();
      expect(input.type).toBe('text');
    });

    test('should create multiline text field when specified', () => {
      const field = TextField.create({
        multiline: true,
        dom: container
      });

      const textarea = container.querySelector('textarea');
      expect(textarea).toBeDefined();
      expect(textarea.style.minHeight).toBe('80px');
    });

    test('should throw error when DOM container is missing', () => {
      expect(() => {
        TextField.create({});
      }).toThrow('TextField requires a DOM container element');
    });

    test('should initialize with provided value', () => {
      const field = TextField.create({
        value: 'Hello World',
        dom: container
      });

      expect(field.getValue()).toBe('Hello World');
      const input = container.querySelector('input');
      expect(input.value).toBe('Hello World');
    });

    test('should apply configuration options', () => {
      const field = TextField.create({
        placeholder: 'Enter text...',
        maxLength: 100,
        disabled: true,
        dom: container
      });

      const input = container.querySelector('input');
      expect(input.placeholder).toBe('Enter text...');
      expect(input.maxLength).toBe(100);
      expect(input.disabled).toBe(true);
    });
  });

  describe('User Input', () => {
    test('should update value when user types', () => {
      const onChange = jest.fn();
      const field = TextField.create({
        onChange,
        dom: container
      });

      const input = container.querySelector('input');
      input.value = 'New text';
      input.dispatchEvent(new Event('input'));

      expect(field.getValue()).toBe('New text');
      expect(onChange).toHaveBeenCalledWith('New text', '');
    });

    test('should handle programmatic value changes', () => {
      const onChange = jest.fn();
      const field = TextField.create({
        onChange,
        dom: container
      });

      field.setValue('Programmatic value');

      expect(field.getValue()).toBe('Programmatic value');
      const input = container.querySelector('input');
      expect(input.value).toBe('Programmatic value');
    });

    test('should clear value when set to empty string', () => {
      const field = TextField.create({
        value: 'Initial text',
        dom: container
      });

      field.setValue('');

      expect(field.getValue()).toBe('');
      const input = container.querySelector('input');
      expect(input.value).toBe('');
    });
  });

  describe('Validation', () => {
    test('should validate required fields', () => {
      const onValidate = jest.fn();
      const field = TextField.create({
        required: true,
        onValidate,
        dom: container
      });

      // Empty value should be invalid
      const validation = field.validate();
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('This field is required');
      expect(onValidate).toHaveBeenCalledWith(validation);

      // Non-empty value should be valid
      field.setValue('Some text');
      const validation2 = field.validate();
      expect(validation2.valid).toBe(true);
      expect(validation2.message).toBe(null);
    });

    test('should use custom validator when provided', () => {
      const customValidator = jest.fn((value) => {
        if (value.length < 5) {
          return { valid: false, message: 'Must be at least 5 characters' };
        }
        return { valid: true, message: null };
      });

      const field = TextField.create({
        validator: customValidator,
        dom: container
      });

      field.setValue('Hi');
      const validation = field.validate();
      
      expect(customValidator).toHaveBeenCalledWith('Hi');
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('Must be at least 5 characters');

      field.setValue('Hello World');
      const validation2 = field.validate();
      expect(validation2.valid).toBe(true);
    });

    test('should show validation errors in UI', () => {
      const field = TextField.create({
        required: true,
        dom: container
      });

      field.validate();

      const input = container.querySelector('input');
      const validationEl = container.children[1];
      
      expect(input.style.borderColor).toBe('rgb(239, 68, 68)'); // red
      expect(validationEl.style.display).toBe('block');
      expect(validationEl.textContent).toBe('This field is required');
    });

    test('should hide validation errors when field becomes valid', () => {
      const field = TextField.create({
        required: true,
        dom: container
      });

      // Make invalid first
      field.validate();
      let validationEl = container.children[1];
      expect(validationEl.style.display).toBe('block');

      // Make valid
      field.setValue('Valid text');
      validationEl = container.children[1];
      expect(validationEl.style.display).toBe('none');
    });
  });

  describe('Focus and Blur Events', () => {
    test('should handle focus events', () => {
      const onFocus = jest.fn();
      const field = TextField.create({
        onFocus,
        dom: container
      });

      const input = container.querySelector('input');
      input.dispatchEvent(new Event('focus'));

      expect(onFocus).toHaveBeenCalled();
      expect(input.style.borderColor).toBe('rgb(59, 130, 246)'); // blue
    });

    test('should handle blur events', () => {
      const onBlur = jest.fn();
      const field = TextField.create({
        onBlur,
        dom: container
      });

      const input = container.querySelector('input');
      input.dispatchEvent(new Event('focus'));
      input.dispatchEvent(new Event('blur'));

      expect(onBlur).toHaveBeenCalled();
      expect(input.style.borderColor).toBe('rgb(226, 232, 240)'); // gray
    });

    test('should maintain error styling on focus/blur when invalid', () => {
      const field = TextField.create({
        required: true,
        dom: container
      });

      const input = container.querySelector('input');
      field.validate(); // Make invalid
      
      input.dispatchEvent(new Event('focus'));
      expect(input.style.borderColor).toBe('rgb(239, 68, 68)'); // stays red
      
      input.dispatchEvent(new Event('blur'));
      expect(input.style.borderColor).toBe('rgb(239, 68, 68)'); // stays red
    });
  });

  describe('State Management', () => {
    test('should enable/disable field', () => {
      const field = TextField.create({
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
      const field = TextField.create({
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
      const field = TextField.create({
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
      const field = TextField.create({
        required: true,
        dom: container
      });

      expect(field.isValid()).toBe(false); // empty required field
      expect(field.getValidationMessage()).toBe('This field is required');

      field.setValue('Valid text');
      expect(field.isValid()).toBe(true);
      expect(field.getValidationMessage()).toBe(null);
    });
  });

  describe('Lifecycle Management', () => {
    test('should clean up event listeners on destroy', () => {
      const field = TextField.create({
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
      const field = TextField.create({
        dom: container
      });

      expect(container.children.length).toBe(2);

      field.destroy();

      expect(container.children.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null and undefined values gracefully', () => {
      const field = TextField.create({
        dom: container
      });

      field.setValue(null);
      expect(field.getValue()).toBe('');

      field.setValue(undefined);
      expect(field.getValue()).toBe('');
    });

    test('should handle rapid sequential changes', () => {
      const onChange = jest.fn();
      const field = TextField.create({
        onChange,
        dom: container
      });

      const input = container.querySelector('input');
      
      // Simulate rapid typing
      input.value = 'a';
      input.dispatchEvent(new Event('input'));
      input.value = 'ab';
      input.dispatchEvent(new Event('input'));
      input.value = 'abc';
      input.dispatchEvent(new Event('input'));

      expect(onChange).toHaveBeenCalledTimes(3);
      expect(field.getValue()).toBe('abc');
    });

    test('should handle very long text values', () => {
      const longText = 'a'.repeat(10000);
      const field = TextField.create({
        dom: container
      });

      field.setValue(longText);
      expect(field.getValue()).toBe(longText);
      
      const input = container.querySelector('input');
      expect(input.value).toBe(longText);
    });

    test('should handle special characters and unicode', () => {
      const specialText = '🚀 Hello 世界 ñañá @#$%';
      const field = TextField.create({
        dom: container
      });

      field.setValue(specialText);
      expect(field.getValue()).toBe(specialText);
    });
  });
});