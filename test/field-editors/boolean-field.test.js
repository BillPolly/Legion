/**
 * @jest-environment jsdom
 */

import { BooleanField } from '../../src/components/field-editors/boolean-field/index.js';

describe('BooleanField Component', () => {
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
      const info = BooleanField.create();
      
      expect(info.name).toBe('BooleanField');
      expect(info.version).toBe('1.0.0');
      expect(info.capabilities).toContain('input');
      expect(info.capabilities).toContain('validation');
      expect(info.capabilities).toContain('events');
      expect(info.capabilities).toContain('boolean');
    });
  });

  describe('Instance Creation', () => {
    test('should create checkbox field with minimal configuration', () => {
      const field = BooleanField.create({
        dom: container
      });

      expect(field).toBeDefined();
      expect(field.getValue()).toBe(false);
      expect(container.children.length).toBe(2); // container + validation message
      
      const input = container.querySelector('input[type="checkbox"]');
      expect(input).toBeDefined();
      expect(input.checked).toBe(false);
    });

    test('should throw error when DOM container is missing', () => {
      expect(() => {
        BooleanField.create({});
      }).toThrow('BooleanField requires a DOM container element');
    });

    test('should initialize with provided boolean value', () => {
      const field = BooleanField.create({
        value: true,
        dom: container
      });

      expect(field.getValue()).toBe(true);
      const input = container.querySelector('input');
      expect(input.checked).toBe(true);
    });

    test('should coerce non-boolean values to boolean', () => {
      const field = BooleanField.create({
        value: 'true',
        dom: container
      });

      expect(field.getValue()).toBe(true);

      field.setValue(0);
      expect(field.getValue()).toBe(false);

      field.setValue(1);
      expect(field.getValue()).toBe(true);
    });

    test('should apply custom labels', () => {
      const field = BooleanField.create({
        value: true,
        trueLabel: 'Enabled',
        falseLabel: 'Disabled',
        dom: container
      });

      const label = container.querySelector('label');
      expect(label.textContent).toBe('Enabled');

      field.setValue(false);
      expect(label.textContent).toBe('Disabled');
    });
  });

  describe('Checkbox Style', () => {
    test('should create checkbox by default', () => {
      const field = BooleanField.create({
        dom: container
      });

      const input = container.querySelector('input[type="checkbox"]');
      expect(input).toBeDefined();
      expect(input.style.width).toBe('16px');
      expect(input.style.height).toBe('16px');
    });

    test('should handle checkbox interactions', () => {
      const onChange = jest.fn();
      const field = BooleanField.create({
        onChange,
        dom: container
      });

      const input = container.querySelector('input');
      const label = container.querySelector('label');

      // Click input directly
      input.click();
      expect(field.getValue()).toBe(true);
      expect(onChange).toHaveBeenCalledWith(true, false);

      // Click label (should trigger input)
      label.click();
      expect(field.getValue()).toBe(false);
      expect(onChange).toHaveBeenCalledWith(false, true);
    });

    test('should handle readonly state for checkbox', () => {
      const field = BooleanField.create({
        value: true,
        readonly: true,
        dom: container
      });

      const input = container.querySelector('input');
      
      // Try to change value - should revert
      input.click();
      expect(field.getValue()).toBe(true); // unchanged
      expect(input.checked).toBe(true); // reverted
    });
  });

  describe('Toggle Style', () => {
    test('should create toggle switch when specified', () => {
      const field = BooleanField.create({
        style: 'toggle',
        dom: container
      });

      const toggleContainer = container.querySelector('div div'); // nested div for toggle
      const hiddenInput = container.querySelector('input[type="checkbox"]');
      
      expect(toggleContainer).toBeDefined();
      expect(toggleContainer.style.width).toBe('44px');
      expect(toggleContainer.style.height).toBe('24px');
      expect(hiddenInput.style.display).toBe('none');
    });

    test('should handle toggle interactions', () => {
      const onChange = jest.fn();
      const field = BooleanField.create({
        style: 'toggle',
        onChange,
        dom: container
      });

      // Find toggle elements
      const mainContainer = container.firstChild;
      const toggleContainer = mainContainer.firstChild;
      const toggleKnob = toggleContainer.firstChild;
      const label = mainContainer.lastChild;

      expect(field.getValue()).toBe(false);
      expect(toggleContainer.style.background).toBe('rgb(203, 213, 225)'); // gray
      expect(toggleKnob.style.left).toBe('2px'); // left position

      // Click toggle container
      toggleContainer.click();
      
      expect(field.getValue()).toBe(true);
      expect(onChange).toHaveBeenCalledWith(true, false);
      expect(toggleContainer.style.background).toBe('rgb(59, 130, 246)'); // blue
      expect(toggleKnob.style.left).toBe('22px'); // right position

      // Click label should also work
      label.click();
      expect(field.getValue()).toBe(false);
      expect(onChange).toHaveBeenCalledWith(false, true);
    });

    test('should update toggle appearance when value changes programmatically', () => {
      const field = BooleanField.create({
        style: 'toggle',
        dom: container
      });

      const mainContainer = container.firstChild;
      const toggleContainer = mainContainer.firstChild;
      const toggleKnob = toggleContainer.firstChild;

      field.setValue(true);
      
      expect(toggleContainer.style.background).toBe('rgb(59, 130, 246)'); // blue
      expect(toggleKnob.style.left).toBe('22px'); // right position

      field.setValue(false);
      
      expect(toggleContainer.style.background).toBe('rgb(203, 213, 225)'); // gray
      expect(toggleKnob.style.left).toBe('2px'); // left position
    });

    test('should handle disabled state for toggle', () => {
      const field = BooleanField.create({
        style: 'toggle',
        disabled: true,
        dom: container
      });

      const mainContainer = container.firstChild;
      const toggleContainer = mainContainer.firstChild;
      
      expect(toggleContainer.style.opacity).toBe('0.5');
      expect(toggleContainer.style.cursor).toBe('not-allowed');

      // Click should not work when disabled
      toggleContainer.click();
      expect(field.getValue()).toBe(false); // unchanged
    });

    test('should handle readonly state for toggle', () => {
      const field = BooleanField.create({
        style: 'toggle',
        readonly: true,
        dom: container
      });

      const mainContainer = container.firstChild;
      const toggleContainer = mainContainer.firstChild;

      // Click should not work when readonly
      toggleContainer.click();
      expect(field.getValue()).toBe(false); // unchanged
    });
  });

  describe('Radio Style', () => {
    test('should create radio button when specified', () => {
      const field = BooleanField.create({
        style: 'radio',
        dom: container
      });

      const input = container.querySelector('input[type="radio"]');
      expect(input).toBeDefined();
      expect(input.checked).toBe(false);
    });

    test('should handle radio interactions like checkbox', () => {
      const onChange = jest.fn();
      const field = BooleanField.create({
        style: 'radio',
        onChange,
        dom: container
      });

      const input = container.querySelector('input');
      input.click();
      
      expect(field.getValue()).toBe(true);
      expect(onChange).toHaveBeenCalledWith(true, false);
    });
  });

  describe('User Interactions', () => {
    test('should update value when user interacts', () => {
      const onChange = jest.fn();
      const field = BooleanField.create({
        onChange,
        dom: container
      });

      const input = container.querySelector('input');
      input.click();

      expect(field.getValue()).toBe(true);
      expect(onChange).toHaveBeenCalledWith(true, false);
    });

    test('should handle programmatic value changes', () => {
      const field = BooleanField.create({
        dom: container
      });

      field.setValue(true);
      expect(field.getValue()).toBe(true);
      
      const input = container.querySelector('input');
      expect(input.checked).toBe(true);

      field.setValue(false);
      expect(field.getValue()).toBe(false);
      expect(input.checked).toBe(false);
    });

    test('should update label text when value changes', () => {
      const field = BooleanField.create({
        trueLabel: 'On',
        falseLabel: 'Off',
        dom: container
      });

      const label = container.querySelector('label');
      
      expect(label.textContent).toBe('Off'); // initial false
      
      field.setValue(true);
      expect(label.textContent).toBe('On');
      
      field.setValue(false);
      expect(label.textContent).toBe('Off');
    });
  });

  describe('Validation', () => {
    test('should validate required fields', () => {
      const onValidate = jest.fn();
      const field = BooleanField.create({
        required: true,
        onValidate,
        dom: container
      });

      // False value should be invalid when required
      const validation = field.validate();
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('This field is required');
      expect(onValidate).toHaveBeenCalledWith(validation);

      // True value should be valid
      field.setValue(true);
      const validation2 = field.validate();
      expect(validation2.valid).toBe(true);
      expect(validation2.message).toBe(null);
    });

    test('should use custom validator when provided', () => {
      const mustBeTrueValidator = (value) => {
        if (!value) {
          return { valid: false, message: 'This must be checked' };
        }
        return { valid: true, message: null };
      };

      const field = BooleanField.create({
        validator: mustBeTrueValidator,
        dom: container
      });

      const validation = field.validate();
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('This must be checked');

      field.setValue(true);
      const validation2 = field.validate();
      expect(validation2.valid).toBe(true);
    });

    test('should show validation errors in UI', () => {
      const field = BooleanField.create({
        required: true,
        dom: container
      });

      field.validate();

      const validationEl = container.children[1];
      expect(validationEl.style.display).toBe('block');
      expect(validationEl.textContent).toBe('This field is required');
    });

    test('should hide validation errors when field becomes valid', () => {
      const field = BooleanField.create({
        required: true,
        dom: container
      });

      // Make invalid first
      field.validate();
      let validationEl = container.children[1];
      expect(validationEl.style.display).toBe('block');

      // Make valid
      field.setValue(true);
      validationEl = container.children[1];
      expect(validationEl.style.display).toBe('none');
    });
  });

  describe('Focus and Blur Events', () => {
    test('should handle focus events', () => {
      const onFocus = jest.fn();
      const field = BooleanField.create({
        onFocus,
        dom: container
      });

      const input = container.querySelector('input');
      input.dispatchEvent(new Event('focus'));

      expect(onFocus).toHaveBeenCalled();
    });

    test('should handle blur events', () => {
      const onBlur = jest.fn();
      const field = BooleanField.create({
        onBlur,
        dom: container
      });

      const input = container.querySelector('input');
      input.dispatchEvent(new Event('blur'));

      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    test('should enable/disable field', () => {
      const field = BooleanField.create({
        dom: container
      });

      const input = container.querySelector('input');
      const mainContainer = container.firstChild;
      
      expect(input.disabled).toBe(false);
      expect(mainContainer.style.opacity).toBe('');

      field.setDisabled(true);
      expect(input.disabled).toBe(true);
      expect(mainContainer.style.opacity).toBe('0.5');

      field.setDisabled(false);
      expect(input.disabled).toBe(false);
      expect(mainContainer.style.opacity).toBe('1');
    });

    test('should handle readonly state', () => {
      const field = BooleanField.create({
        dom: container
      });

      const input = container.querySelector('input');
      const label = container.querySelector('label');
      
      field.setReadonly(true);
      expect(label.style.cursor).toBe('not-allowed');

      field.setReadonly(false);
      expect(label.style.cursor).toBe('pointer');
    });

    test('should focus and blur programmatically', () => {
      const field = BooleanField.create({
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
      const field = BooleanField.create({
        required: true,
        dom: container
      });

      expect(field.isValid()).toBe(false); // false is invalid when required
      expect(field.getValidationMessage()).toBe('This field is required');

      field.setValue(true);
      expect(field.isValid()).toBe(true);
      expect(field.getValidationMessage()).toBe(null);
    });
  });

  describe('Lifecycle Management', () => {
    test('should clean up event listeners on destroy', () => {
      const field = BooleanField.create({
        dom: container
      });

      const input = container.querySelector('input');
      const removeEventListenerSpy = jest.spyOn(input, 'removeEventListener');

      field.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('blur', expect.any(Function));
    });

    test('should remove DOM elements on destroy', () => {
      const field = BooleanField.create({
        dom: container
      });

      expect(container.children.length).toBe(2);

      field.destroy();

      expect(container.children.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null and undefined values', () => {
      const field = BooleanField.create({
        dom: container
      });

      field.setValue(null);
      expect(field.getValue()).toBe(false);

      field.setValue(undefined);
      expect(field.getValue()).toBe(false);
    });

    test('should handle truthy and falsy values correctly', () => {
      const field = BooleanField.create({
        dom: container
      });

      // Truthy values
      field.setValue('hello');
      expect(field.getValue()).toBe(true);

      field.setValue(1);
      expect(field.getValue()).toBe(true);

      field.setValue([]);
      expect(field.getValue()).toBe(true);

      // Falsy values
      field.setValue(0);
      expect(field.getValue()).toBe(false);

      field.setValue('');
      expect(field.getValue()).toBe(false);

      field.setValue(false);
      expect(field.getValue()).toBe(false);
    });

    test('should handle rapid sequential changes', () => {
      const onChange = jest.fn();
      const field = BooleanField.create({
        onChange,
        dom: container
      });

      // Rapid changes
      field.setValue(true);
      field.setValue(false);
      field.setValue(true);

      expect(onChange).toHaveBeenCalledTimes(3);
      expect(field.getValue()).toBe(true);
    });

    test('should prevent interaction when disabled', () => {
      const onChange = jest.fn();
      const field = BooleanField.create({
        disabled: true,
        onChange,
        dom: container
      });

      const input = container.querySelector('input');
      const label = container.querySelector('label');

      // Try to interact - should not work
      input.click();
      label.click();

      expect(onChange).not.toHaveBeenCalled();
      expect(field.getValue()).toBe(false);
    });

    test('should handle complex label scenarios', () => {
      const field = BooleanField.create({
        trueLabel: 'Complex Label with 🚀 Emoji',
        falseLabel: 'Another Label with <special> chars',
        dom: container
      });

      const label = container.querySelector('label');
      
      expect(label.textContent).toBe('Another Label with <special> chars');
      
      field.setValue(true);
      expect(label.textContent).toBe('Complex Label with 🚀 Emoji');
    });

    test('should maintain state consistency across style changes', () => {
      // Note: This tests the conceptual consistency, not actual style switching
      const field1 = BooleanField.create({
        style: 'checkbox',
        value: true,
        dom: container
      });

      expect(field1.getValue()).toBe(true);
      field1.destroy();

      // Clear container
      container.innerHTML = '';

      const field2 = BooleanField.create({
        style: 'toggle',
        value: true,
        dom: container
      });

      expect(field2.getValue()).toBe(true);
    });
  });
});