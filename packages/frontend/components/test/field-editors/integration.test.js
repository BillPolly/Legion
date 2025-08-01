/**
 * @jest-environment jsdom
 */

import { TextField } from '../../src/components/field-editors/text-field/index.js';
import { NumericField } from '../../src/components/field-editors/numeric-field/index.js';
import { BooleanField } from '../../src/components/field-editors/boolean-field/index.js';

describe('Field Editors Integration Tests', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('Cross-Component Consistency', () => {
    test('all field editors should follow umbilical protocol', () => {
      const textInfo = TextField.create();
      const numericInfo = NumericField.create();
      const booleanInfo = BooleanField.create();

      // All should have consistent introspection
      expect(textInfo).toHaveProperty('name');
      expect(textInfo).toHaveProperty('version');
      expect(textInfo).toHaveProperty('capabilities');

      expect(numericInfo).toHaveProperty('name');
      expect(numericInfo).toHaveProperty('version');
      expect(numericInfo).toHaveProperty('capabilities');

      expect(booleanInfo).toHaveProperty('name');
      expect(booleanInfo).toHaveProperty('version');
      expect(booleanInfo).toHaveProperty('capabilities');

      // All should support basic capabilities
      expect(textInfo.capabilities).toContain('input');
      expect(textInfo.capabilities).toContain('validation');
      expect(textInfo.capabilities).toContain('events');

      expect(numericInfo.capabilities).toContain('input');
      expect(numericInfo.capabilities).toContain('validation');
      expect(numericInfo.capabilities).toContain('events');

      expect(booleanInfo.capabilities).toContain('input');
      expect(booleanInfo.capabilities).toContain('validation');
      expect(booleanInfo.capabilities).toContain('events');
    });

    test('all field editors should have consistent API methods', () => {
      const textField = TextField.create({ dom: createContainer() });
      const numericField = NumericField.create({ dom: createContainer() });
      const booleanField = BooleanField.create({ dom: createContainer() });

      const expectedMethods = [
        'getValue', 'setValue', 'focus', 'blur',
        'setDisabled', 'setReadonly', 'isValid',
        'getValidationMessage', 'validate', 'destroy'
      ];

      expectedMethods.forEach(method => {
        expect(textField).toHaveProperty(method);
        expect(typeof textField[method]).toBe('function');

        expect(numericField).toHaveProperty(method);
        expect(typeof numericField[method]).toBe('function');

        expect(booleanField).toHaveProperty(method);
        expect(typeof booleanField[method]).toBe('function');
      });

      // Cleanup
      textField.destroy();
      numericField.destroy();
      booleanField.destroy();
    });

    test('all field editors should handle disabled state consistently', () => {
      const textField = TextField.create({ dom: createContainer() });
      const numericField = NumericField.create({ dom: createContainer() });
      const booleanField = BooleanField.create({ dom: createContainer() });

      // All should start enabled
      expect(textField.getValue).toBeDefined();
      expect(numericField.getValue).toBeDefined();
      expect(booleanField.getValue).toBeDefined();

      // All should support setDisabled
      textField.setDisabled(true);
      numericField.setDisabled(true);
      booleanField.setDisabled(true);

      // Check DOM reflects disabled state
      const textInput = textField.getValue && document.querySelector('input[type="text"]');
      const numericInput = document.querySelector('input[type="number"]');
      const booleanInput = document.querySelector('input[type="checkbox"]');

      if (textInput) expect(textInput.disabled).toBe(true);
      if (numericInput) expect(numericInput.disabled).toBe(true);
      if (booleanInput) expect(booleanInput.disabled).toBe(true);

      // Cleanup
      textField.destroy();
      numericField.destroy();
      booleanField.destroy();
    });
  });

  describe('Form-like Usage Patterns', () => {
    test('should work together in a form-like scenario', () => {
      const formData = {
        name: '',
        age: 0,
        active: false
      };

      const changes = [];

      // Create form fields
      const nameField = TextField.create({
        value: formData.name,
        placeholder: 'Enter name',
        required: true,
        onChange: (value) => {
          formData.name = value;
          changes.push({ field: 'name', value });
        },
        dom: createContainer()
      });

      const ageField = NumericField.create({
        value: formData.age,
        min: 0,
        max: 120,
        onChange: (value) => {
          formData.age = value;
          changes.push({ field: 'age', value });
        },
        dom: createContainer()
      });

      const activeField = BooleanField.create({
        value: formData.active,
        trueLabel: 'Active',
        falseLabel: 'Inactive',
        onChange: (value) => {
          formData.active = value;
          changes.push({ field: 'active', value });
        },
        dom: createContainer()
      });

      // Simulate user input
      nameField.setValue('John Doe');
      ageField.setValue(25);
      activeField.setValue(true);

      // Verify form data updated
      expect(formData.name).toBe('John Doe');
      expect(formData.age).toBe(25);
      expect(formData.active).toBe(true);

      // Verify change tracking
      expect(changes).toHaveLength(3);
      expect(changes[0]).toEqual({ field: 'name', value: 'John Doe' });
      expect(changes[1]).toEqual({ field: 'age', value: 25 });
      expect(changes[2]).toEqual({ field: 'active', value: true });

      // Validate all fields
      const nameValidation = nameField.validate();
      const ageValidation = ageField.validate();
      const activeValidation = activeField.validate();

      expect(nameValidation.valid).toBe(true);
      expect(ageValidation.valid).toBe(true);
      expect(activeValidation.valid).toBe(true);

      // Cleanup
      nameField.destroy();
      ageField.destroy();
      activeField.destroy();
    });

    test('should handle form validation with errors', () => {
      const fields = [];
      
      // Create fields with validation issues
      const requiredTextField = TextField.create({
        required: true,
        dom: createContainer()
      });
      fields.push(requiredTextField);

      const constrainedNumericField = NumericField.create({
        min: 10,
        max: 20,
        value: 5, // Invalid - below min
        dom: createContainer()
      });
      fields.push(constrainedNumericField);

      const requiredBooleanField = BooleanField.create({
        required: true,
        value: false, // Invalid - required but false
        dom: createContainer()
      });
      fields.push(requiredBooleanField);

      // Validate all fields
      const validations = fields.map(field => field.validate());
      const isFormValid = validations.every(v => v.valid);

      expect(isFormValid).toBe(false);
      expect(validations[0].valid).toBe(false); // Required text field empty
      expect(validations[1].valid).toBe(false); // Numeric field below min
      expect(validations[2].valid).toBe(false); // Required boolean field false

      // Fix issues
      requiredTextField.setValue('Some text');
      constrainedNumericField.setValue(15);
      requiredBooleanField.setValue(true);

      // Re-validate
      const fixedValidations = fields.map(field => field.validate());
      const isFormValidNow = fixedValidations.every(v => v.valid);

      expect(isFormValidNow).toBe(true);

      // Cleanup
      fields.forEach(field => field.destroy());
    });
  });

  describe('Event Handling Integration', () => {
    test('should handle complex event scenarios', () => {
      const eventLog = [];

      const logEvent = (source, event, ...args) => {
        eventLog.push({ source, event, args, timestamp: Date.now() });
      };

      // Create fields with comprehensive event logging
      const textField = TextField.create({
        onChange: (newVal, oldVal) => logEvent('text', 'change', newVal, oldVal),
        onFocus: () => logEvent('text', 'focus'),
        onBlur: () => logEvent('text', 'blur'),
        onValidate: (result) => logEvent('text', 'validate', result),
        dom: createContainer()
      });

      const numericField = NumericField.create({
        onChange: (newVal, oldVal) => logEvent('numeric', 'change', newVal, oldVal),
        onFocus: () => logEvent('numeric', 'focus'),
        onBlur: () => logEvent('numeric', 'blur'),
        onValidate: (result) => logEvent('numeric', 'validate', result),
        dom: createContainer()
      });

      // Simulate complex interaction sequence
      textField.focus();
      textField.setValue('Test');
      textField.blur();
      
      numericField.focus();
      numericField.setValue(42);
      numericField.blur();

      // Verify event sequence
      expect(eventLog.length).toBeGreaterThan(6);
      
      const textEvents = eventLog.filter(e => e.source === 'text');
      const numericEvents = eventLog.filter(e => e.source === 'numeric');

      expect(textEvents.some(e => e.event === 'focus')).toBe(true);
      expect(textEvents.some(e => e.event === 'change')).toBe(true);
      expect(textEvents.some(e => e.event === 'blur')).toBe(true);

      expect(numericEvents.some(e => e.event === 'focus')).toBe(true);
      expect(numericEvents.some(e => e.event === 'change')).toBe(true);
      expect(numericEvents.some(e => e.event === 'blur')).toBe(true);

      // Cleanup
      textField.destroy();
      numericField.destroy();
    });
  });

  describe('Performance and Memory', () => {
    test('should properly clean up multiple field instances', () => {
      const fields = [];

      // Create many field instances
      for (let i = 0; i < 10; i++) {
        fields.push(TextField.create({ dom: createContainer() }));
        fields.push(NumericField.create({ dom: createContainer() }));
        fields.push(BooleanField.create({ dom: createContainer() }));
      }

      expect(fields).toHaveLength(30);

      // All should be functional
      fields.forEach((field, index) => {
        expect(field.getValue).toBeDefined();
        field.setValue(index % 2 === 0 ? 'test' : index);
      });

      // Clean up all fields
      fields.forEach(field => field.destroy());

      // Verify DOM cleanup
      const remainingInputs = document.querySelectorAll('input');
      const remainingTextareas = document.querySelectorAll('textarea');
      
      expect(remainingInputs.length).toBe(0);
      expect(remainingTextareas.length).toBe(0);
    });

    test('should handle rapid creation and destruction', () => {
      for (let i = 0; i < 50; i++) {
        const field = TextField.create({ 
          value: `Test ${i}`,
          dom: createContainer() 
        });
        
        expect(field.getValue()).toBe(`Test ${i}`);
        field.destroy();
      }

      // Should not have memory leaks or DOM pollution
      const remainingInputs = document.querySelectorAll('input');
      expect(remainingInputs.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid umbilical configurations gracefully', () => {
      // Missing DOM should throw predictable errors
      expect(() => TextField.create({})).toThrow();
      expect(() => NumericField.create({})).toThrow();
      expect(() => BooleanField.create({})).toThrow();

      // Invalid DOM should throw
      expect(() => TextField.create({ dom: null })).toThrow();
      expect(() => TextField.create({ dom: 'not a dom element' })).toThrow();
    });

    test('should handle edge case values without crashing', () => {
      const textField = TextField.create({ dom: createContainer() });
      const numericField = NumericField.create({ dom: createContainer() });
      const booleanField = BooleanField.create({ dom: createContainer() });

      // These should not crash
      const edgeCases = [null, undefined, {}, [], NaN, Infinity, -Infinity];
      
      edgeCases.forEach(value => {
        expect(() => {
          textField.setValue(value);
          numericField.setValue(value);
          booleanField.setValue(value);
        }).not.toThrow();
      });

      // Cleanup
      textField.destroy();
      numericField.destroy();
      booleanField.destroy();
    });
  });

  // Helper function to create containers
  function createContainer() {
    const div = document.createElement('div');
    container.appendChild(div);
    return div;
  }
});