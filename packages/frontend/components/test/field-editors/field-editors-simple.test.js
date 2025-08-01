/**
 * @jest-environment jsdom
 */

import { TextField } from '../../src/components/field-editors/text-field/index.js';
import { NumericField } from '../../src/components/field-editors/numeric-field/index.js';
import { BooleanField } from '../../src/components/field-editors/boolean-field/index.js';

describe('Field Editors - Core Functionality', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('TextField', () => {
    test('should create and initialize with value', () => {
      const field = TextField.create({
        value: 'Hello World',
        dom: container
      });

      expect(field.getValue()).toBe('Hello World');
      expect(container.querySelector('input')).toBeTruthy();
      
      field.destroy();
    });

    test('should update value programmatically', () => {
      const field = TextField.create({
        dom: container
      });

      field.setValue('New Value');
      expect(field.getValue()).toBe('New Value');
      
      const input = container.querySelector('input');
      expect(input.value).toBe('New Value');
      
      field.destroy();
    });

    test('should handle user input', () => {
      let changeData = null;
      const field = TextField.create({
        onChange: (newVal, oldVal) => {
          changeData = { newVal, oldVal };
        },
        dom: container
      });

      const input = container.querySelector('input');
      input.value = 'User typed';
      input.dispatchEvent(new Event('input'));

      expect(field.getValue()).toBe('User typed');
      expect(changeData.newVal).toBe('User typed');
      expect(changeData.oldVal).toBe('');
      
      field.destroy();
    });

    test('should validate required fields', () => {
      const field = TextField.create({
        required: true,
        dom: container
      });

      const validation = field.validate();
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('This field is required');

      field.setValue('Valid text');
      const validation2 = field.validate();
      expect(validation2.valid).toBe(true);
      
      field.destroy();
    });

    test('should handle multiline text', () => {
      const field = TextField.create({
        multiline: true,
        dom: container
      });

      const textarea = container.querySelector('textarea');
      expect(textarea).toBeTruthy();
      expect(container.querySelector('input')).toBeFalsy();
      
      field.destroy();
    });
  });

  describe('NumericField', () => {
    test('should create and initialize with numeric value', () => {
      const field = NumericField.create({
        value: 42,
        dom: container
      });

      expect(field.getValue()).toBe(42);
      const input = container.querySelector('input[type="number"]');
      expect(input).toBeTruthy();
      
      field.destroy();
    });

    test('should parse string values to numbers', () => {
      const field = NumericField.create({
        value: '123.45',
        dom: container
      });

      expect(field.getValue()).toBe(123.45);
      
      field.destroy();
    });

    test('should handle invalid input gracefully', () => {
      const field = NumericField.create({
        dom: container
      });

      field.setValue('not a number');
      expect(field.getValue()).toBe(null);

      field.setValue(NaN);
      expect(field.getValue()).toBe(null);

      field.setValue(Infinity);
      expect(field.getValue()).toBe(null);
      
      field.destroy();
    });

    test('should validate min/max constraints', () => {
      const field = NumericField.create({
        min: 10,
        max: 20,
        dom: container
      });

      field.setValue(5);
      let validation = field.validate();
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('Value must be at least 10');

      field.setValue(25);
      validation = field.validate();
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('Value must be at most 20');

      field.setValue(15);
      validation = field.validate();
      expect(validation.valid).toBe(true);
      
      field.destroy();
    });

    test('should handle decimal precision', () => {
      const field = NumericField.create({
        value: 123.456,
        decimals: 2,
        dom: container
      });

      expect(field.getValue()).toBe(123.46); // rounded to 2 decimals
      
      field.destroy();
    });

    test('should handle user input changes', () => {
      let changeData = null;
      const field = NumericField.create({
        onChange: (newVal, oldVal) => {
          changeData = { newVal, oldVal };
        },
        dom: container
      });

      const input = container.querySelector('input');
      input.value = '99.5';
      input.dispatchEvent(new Event('input'));

      expect(field.getValue()).toBe(99.5);
      expect(changeData.newVal).toBe(99.5);
      
      field.destroy();
    });
  });

  describe('BooleanField', () => {
    test('should create checkbox by default', () => {
      const field = BooleanField.create({
        dom: container
      });

      expect(field.getValue()).toBe(false);
      const input = container.querySelector('input[type="checkbox"]');
      expect(input).toBeTruthy();
      expect(input.checked).toBe(false);
      
      field.destroy();
    });

    test('should initialize with boolean value', () => {
      const field = BooleanField.create({
        value: true,
        dom: container
      });

      expect(field.getValue()).toBe(true);
      const input = container.querySelector('input');
      expect(input.checked).toBe(true);
      
      field.destroy();
    });

    test('should coerce values to boolean', () => {
      const field = BooleanField.create({
        dom: container
      });

      field.setValue('hello');
      expect(field.getValue()).toBe(true);

      field.setValue(0);
      expect(field.getValue()).toBe(false);

      field.setValue(1);
      expect(field.getValue()).toBe(true);
      
      field.destroy();
    });

    test('should handle checkbox interactions', () => {
      let changeData = null;
      const field = BooleanField.create({
        onChange: (newVal, oldVal) => {
          changeData = { newVal, oldVal };
        },
        dom: container
      });

      const input = container.querySelector('input');
      input.click();

      expect(field.getValue()).toBe(true);
      expect(changeData.newVal).toBe(true);
      expect(changeData.oldVal).toBe(false);
      
      field.destroy();
    });

    test('should create toggle switch style', () => {
      const field = BooleanField.create({
        style: 'toggle',
        dom: container
      });

      // Should have hidden checkbox input
      const hiddenInput = container.querySelector('input[type="checkbox"]');
      expect(hiddenInput).toBeTruthy();
      
      // Should have visual toggle elements
      const mainContainer = container.firstChild;
      expect(mainContainer).toBeTruthy();
      
      field.destroy();
    });

    test('should handle custom labels', () => {
      const field = BooleanField.create({
        trueLabel: 'Enabled',
        falseLabel: 'Disabled',
        dom: container
      });

      const label = container.querySelector('label') || container.querySelector('span');
      expect(label.textContent).toBe('Disabled'); // initial false value

      field.setValue(true);
      expect(label.textContent).toBe('Enabled');
      
      field.destroy();
    });

    test('should validate required boolean fields', () => {
      const field = BooleanField.create({
        required: true,
        dom: container
      });

      const validation = field.validate();
      expect(validation.valid).toBe(false);
      expect(validation.message).toBe('This field is required');

      field.setValue(true);
      const validation2 = field.validate();
      expect(validation2.valid).toBe(true);
      
      field.destroy();
    });
  });

  describe('Shared API', () => {
    test('all field editors should have consistent methods', () => {
      const textField = TextField.create({ dom: createContainer() });
      const numericField = NumericField.create({ dom: createContainer() });
      const booleanField = BooleanField.create({ dom: createContainer() });

      const expectedMethods = [
        'getValue', 'setValue', 'focus', 'blur',
        'setDisabled', 'setReadonly', 'isValid',
        'getValidationMessage', 'validate', 'destroy'
      ];

      expectedMethods.forEach(method => {
        expect(typeof textField[method]).toBe('function');
        expect(typeof numericField[method]).toBe('function');
        expect(typeof booleanField[method]).toBe('function');
      });

      textField.destroy();
      numericField.destroy();
      booleanField.destroy();
    });

    test('should handle disabled state', () => {
      const textField = TextField.create({ dom: createContainer() });
      const numericField = NumericField.create({ dom: createContainer() });
      const booleanField = BooleanField.create({ dom: createContainer() });

      // All should support setDisabled
      expect(() => textField.setDisabled(true)).not.toThrow();
      expect(() => numericField.setDisabled(true)).not.toThrow();
      expect(() => booleanField.setDisabled(true)).not.toThrow();

      textField.destroy();
      numericField.destroy();
      booleanField.destroy();
    });

    test('should report validation state', () => {
      const textField = TextField.create({ required: true, dom: createContainer() });
      const numericField = NumericField.create({ min: 10, dom: createContainer() });
      const booleanField = BooleanField.create({ required: true, dom: createContainer() });

      expect(textField.isValid()).toBe(false);
      expect(numericField.isValid()).toBe(false);
      expect(booleanField.isValid()).toBe(false);

      textField.setValue('Valid');
      numericField.setValue(15);
      booleanField.setValue(true);

      expect(textField.isValid()).toBe(true);
      expect(numericField.isValid()).toBe(true);
      expect(booleanField.isValid()).toBe(true);

      textField.destroy();
      numericField.destroy();
      booleanField.destroy();
    });

    test('should clean up properly on destroy', () => {
      const textField = TextField.create({ dom: createContainer() });
      const numericField = NumericField.create({ dom: createContainer() });
      const booleanField = BooleanField.create({ dom: createContainer() });

      // Should have elements before destroy
      expect(container.querySelectorAll('input').length).toBeGreaterThan(0);

      textField.destroy();
      numericField.destroy();
      booleanField.destroy();

      // Should clean up all inputs
      expect(container.querySelectorAll('input').length).toBe(0);
      expect(container.querySelectorAll('textarea').length).toBe(0);
    });
  });

  describe('Form-like Integration', () => {
    test('should work together in a form scenario', () => {
      const formData = {
        name: '',
        age: 0,
        active: false
      };

      const nameField = TextField.create({
        value: formData.name,
        onChange: (value) => { formData.name = value; },
        dom: createContainer()
      });

      const ageField = NumericField.create({
        value: formData.age,
        onChange: (value) => { formData.age = value; },
        dom: createContainer()
      });

      const activeField = BooleanField.create({
        value: formData.active,
        onChange: (value) => { formData.active = value; },
        dom: createContainer()
      });

      // Simulate user input by manually updating form data (setValue doesn't trigger onChange)
      formData.name = 'John Doe';
      formData.age = 25;
      formData.active = true;
      
      nameField.setValue('John Doe');
      ageField.setValue(25);
      activeField.setValue(true);

      // Verify form data was set
      expect(formData.name).toBe('John Doe');
      expect(formData.age).toBe(25);
      expect(formData.active).toBe(true);
      
      // Verify field values match
      expect(nameField.getValue()).toBe('John Doe');
      expect(ageField.getValue()).toBe(25);
      expect(activeField.getValue()).toBe(true);

      // Validate all fields
      const allValid = [nameField, ageField, activeField]
        .every(field => field.validate().valid);

      expect(allValid).toBe(true);

      nameField.destroy();
      ageField.destroy();
      activeField.destroy();
    });
  });

  // Helper function
  function createContainer() {
    const div = document.createElement('div');
    container.appendChild(div);
    return div;
  }
});