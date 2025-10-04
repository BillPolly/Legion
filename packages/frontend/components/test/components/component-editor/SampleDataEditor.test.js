/**
 * SampleDataEditor Tests - Phase 6.3
 *
 * Tests for SampleDataEditor inline data editing
 * Tests rendering data fields, getting sample data, and change events
 */

import { SampleDataEditor } from '../../../src/components/component-editor/src/preview/SampleDataEditor.js';

describe('SampleDataEditor', () => {
  let container;
  let dataModel;
  let editor;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'sample-data-container';
    document.body.appendChild(container);

    dataModel = {
      entityName: 'user',
      schema: {
        properties: {
          name: { type: 'string', description: 'User name' },
          age: { type: 'number', description: 'User age' },
          active: { type: 'boolean', description: 'Is active' },
          birthdate: { type: 'date', description: 'Birth date' }
        }
      },
      sampleData: {
        name: 'John Doe',
        age: 30,
        active: true,
        birthdate: '1993-01-15'
      }
    };
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Constructor', () => {
    test('should create SampleDataEditor with container and dataModel', () => {
      editor = new SampleDataEditor(container, dataModel);

      expect(editor).toBeInstanceOf(SampleDataEditor);
      expect(editor.container).toBe(container);
      expect(editor.dataModel).toBe(dataModel);
    });

    test('should automatically render on construction', () => {
      editor = new SampleDataEditor(container, dataModel);

      expect(container.querySelector('.sample-data-editor')).toBeTruthy();
    });
  });

  describe('render()', () => {
    beforeEach(() => {
      editor = new SampleDataEditor(container, dataModel);
    });

    test('should render sample data editor container', () => {
      const editorRoot = container.querySelector('.sample-data-editor');
      expect(editorRoot).toBeTruthy();
    });

    test('should render header', () => {
      const header = container.querySelector('h4');
      expect(header.textContent).toBe('Sample Data');
    });

    test('should render field for each property in schema', () => {
      const fields = container.querySelectorAll('.sample-field');
      expect(fields.length).toBe(4); // name, age, active, birthdate
    });

    test('should render field labels from schema', () => {
      const labels = container.querySelectorAll('.sample-field label');

      expect(labels[0].textContent).toBe('name');
      expect(labels[1].textContent).toBe('age');
      expect(labels[2].textContent).toBe('active');
      expect(labels[3].textContent).toBe('birthdate');
    });

    test('should render input with correct type for string', () => {
      const nameInput = container.querySelector('input[name="name"]');
      expect(nameInput.type).toBe('text');
    });

    test('should render input with correct type for number', () => {
      const ageInput = container.querySelector('input[name="age"]');
      expect(ageInput.type).toBe('number');
    });

    test('should render input with correct type for boolean', () => {
      const activeInput = container.querySelector('input[name="active"]');
      expect(activeInput.type).toBe('checkbox');
    });

    test('should render input with correct type for date', () => {
      const birthdateInput = container.querySelector('input[name="birthdate"]');
      expect(birthdateInput.type).toBe('date');
    });

    test('should populate inputs with sample data values', () => {
      const nameInput = container.querySelector('input[name="name"]');
      const ageInput = container.querySelector('input[name="age"]');
      const activeInput = container.querySelector('input[name="active"]');
      const birthdateInput = container.querySelector('input[name="birthdate"]');

      expect(nameInput.value).toBe('John Doe');
      expect(ageInput.value).toBe('30');
      expect(activeInput.checked).toBe(true);
      expect(birthdateInput.value).toBe('1993-01-15');
    });

    test('should set placeholder from schema description', () => {
      const nameInput = container.querySelector('input[name="name"]');
      expect(nameInput.placeholder).toBe('User name');
    });

    test('should handle missing sample data gracefully', () => {
      const dataModelNoSample = {
        entityName: 'test',
        schema: {
          properties: {
            field: { type: 'string' }
          }
        },
        sampleData: {}
      };

      editor = new SampleDataEditor(container, dataModelNoSample);

      const input = container.querySelector('input[name="field"]');
      expect(input.value).toBe('');
    });

    test('should handle schema with no properties', () => {
      const emptySchema = {
        entityName: 'empty',
        schema: {
          properties: {}
        },
        sampleData: {}
      };

      editor = new SampleDataEditor(container, emptySchema);

      const fields = container.querySelectorAll('.sample-field');
      expect(fields.length).toBe(0);
    });
  });

  describe('getInputType()', () => {
    beforeEach(() => {
      editor = new SampleDataEditor(container, dataModel);
    });

    test('should map string type to text input', () => {
      expect(editor.getInputType('string')).toBe('text');
    });

    test('should map number type to number input', () => {
      expect(editor.getInputType('number')).toBe('number');
    });

    test('should map boolean type to checkbox input', () => {
      expect(editor.getInputType('boolean')).toBe('checkbox');
    });

    test('should map date type to date input', () => {
      expect(editor.getInputType('date')).toBe('date');
    });

    test('should default to text for unknown types', () => {
      expect(editor.getInputType('unknown')).toBe('text');
      expect(editor.getInputType('object')).toBe('text');
      expect(editor.getInputType(undefined)).toBe('text');
    });
  });

  describe('getSampleData()', () => {
    beforeEach(() => {
      editor = new SampleDataEditor(container, dataModel);
    });

    test('should get current sample data from inputs', () => {
      const data = editor.getSampleData();

      expect(data).toEqual({
        name: 'John Doe',
        age: '30',
        active: true,
        birthdate: '1993-01-15'
      });
    });

    test('should reflect changes in inputs', () => {
      const nameInput = container.querySelector('input[name="name"]');
      nameInput.value = 'Jane Smith';

      const data = editor.getSampleData();

      expect(data.name).toBe('Jane Smith');
    });

    test('should get checkbox state for boolean fields', () => {
      const activeInput = container.querySelector('input[name="active"]');
      activeInput.checked = false;

      const data = editor.getSampleData();

      expect(data.active).toBe(false);
    });

    test('should convert number input values to strings', () => {
      const ageInput = container.querySelector('input[name="age"]');
      ageInput.value = '25';

      const data = editor.getSampleData();

      expect(data.age).toBe('25');
    });

    test('should handle empty inputs', () => {
      const nameInput = container.querySelector('input[name="name"]');
      nameInput.value = '';

      const data = editor.getSampleData();

      expect(data.name).toBe('');
    });
  });

  describe('onDataChange()', () => {
    beforeEach(() => {
      editor = new SampleDataEditor(container, dataModel);
    });

    test('should attach change handler to container', () => {
      let callbackCalled = false;
      editor.onDataChange(() => { callbackCalled = true; });

      const nameInput = container.querySelector('input[name="name"]');
      nameInput.value = 'Changed';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(callbackCalled).toBe(true);
    });

    test('should pass current sample data to callback', () => {
      let receivedData = null;
      editor.onDataChange((data) => { receivedData = data; });

      const nameInput = container.querySelector('input[name="name"]');
      nameInput.value = 'Updated Name';
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(receivedData).toBeDefined();
      expect(receivedData.name).toBe('Updated Name');
    });

    test('should handle multiple input changes', () => {
      let changeCount = 0;
      editor.onDataChange(() => { changeCount++; });

      const nameInput = container.querySelector('input[name="name"]');
      const ageInput = container.querySelector('input[name="age"]');

      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      ageInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(changeCount).toBe(2);
    });

    test('should work with checkbox inputs', () => {
      let receivedData = null;
      editor.onDataChange((data) => { receivedData = data; });

      const activeInput = container.querySelector('input[name="active"]');
      activeInput.checked = false;
      activeInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(receivedData.active).toBe(false);
    });
  });

  describe('Complex Data Models', () => {
    test('should handle schema with many fields', () => {
      const complexModel = {
        entityName: 'complex',
        schema: {
          properties: {
            field1: { type: 'string' },
            field2: { type: 'number' },
            field3: { type: 'boolean' },
            field4: { type: 'string' },
            field5: { type: 'number' },
            field6: { type: 'date' }
          }
        },
        sampleData: {
          field1: 'value1',
          field2: 10,
          field3: true,
          field4: 'value4',
          field5: 20,
          field6: '2024-01-01'
        }
      };

      editor = new SampleDataEditor(container, complexModel);

      const fields = container.querySelectorAll('.sample-field');
      expect(fields.length).toBe(6);
    });

    test('should handle nested schema structure', () => {
      const nestedModel = {
        entityName: 'nested',
        schema: {
          properties: {
            simple: { type: 'string', description: 'Simple field' }
          }
        },
        sampleData: {
          simple: 'test'
        }
      };

      editor = new SampleDataEditor(container, nestedModel);

      const input = container.querySelector('input[name="simple"]');
      expect(input).toBeTruthy();
      expect(input.value).toBe('test');
    });
  });

  describe('Re-rendering', () => {
    test('should support manual re-render', () => {
      editor = new SampleDataEditor(container, dataModel);

      const firstRender = container.querySelector('.sample-data-editor');
      expect(firstRender).toBeTruthy();

      // Update data model
      dataModel.sampleData.name = 'Changed Name';

      // Re-render
      editor.render();

      const nameInput = container.querySelector('input[name="name"]');
      expect(nameInput.value).toBe('Changed Name');
    });
  });
});
