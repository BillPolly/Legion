/**
 * Verification test that ALL formats work with expansion/collapse and editing
 */

import { BaseFormatHandler } from '../src/components/hierarchy-editor/handlers/BaseFormatHandler.js';
import { JsonHandler } from '../src/components/hierarchy-editor/handlers/JsonHandler.js';
import { XmlHandler } from '../src/components/hierarchy-editor/handlers/XmlHandler.js';
import { YamlHandler } from '../src/components/hierarchy-editor/handlers/YamlHandler.js';
import { MarkdownHandler } from '../src/components/hierarchy-editor/handlers/MarkdownHandler.js';
import { HierarchyRenderer } from '../src/components/hierarchy-editor/renderer/HierarchyRenderer.js';
import { ExpansionStateManager } from '../src/components/hierarchy-editor/state/ExpansionStateManager.js';

// Register handlers
BaseFormatHandler.register('json', JsonHandler);
BaseFormatHandler.register('xml', XmlHandler);
BaseFormatHandler.register('yaml', YamlHandler);
BaseFormatHandler.register('markdown', MarkdownHandler);

describe('All Formats Work Identically', () => {
  let container;
  let renderer;
  let expansionState;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    expansionState = new ExpansionStateManager({ defaultExpanded: true });
    renderer = new HierarchyRenderer({ expansionState, enableEditing: true });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('JSON - expansion/collapse and editing works', () => {
    const handler = new JsonHandler();
    const json = `{
      "name": "Test",
      "nested": {"value": "editable"}
    }`;
    
    const node = handler.parse(json);
    const element = renderer.render(node, { formatHandler: handler });
    container.appendChild(element);
    
    // Has expansion controls
    const controls = container.querySelectorAll('.expand-control');
    expect(controls.length).toBeGreaterThan(0);
    
    // Can collapse
    const firstControl = controls[0];
    expect(firstControl.textContent).toBe('▼');
    firstControl.click();
    expect(firstControl.textContent).toBe('▶');
    
    // Has editable values
    const editables = container.querySelectorAll('.node-value[data-editable="true"]');
    expect(editables.length).toBeGreaterThan(0);
  });

  test('XML - expansion/collapse and editing works', () => {
    const handler = new XmlHandler();
    const xml = `<root>
      <item>
        <name>Test</name>
        <value>123</value>
      </item>
    </root>`;
    
    const node = handler.parse(xml);
    const element = renderer.render(node, { formatHandler: handler });
    container.appendChild(element);
    
    // Has expansion controls
    const controls = container.querySelectorAll('.expand-control');
    expect(controls.length).toBeGreaterThan(0);
    
    // Can collapse
    const firstControl = controls[0];
    expect(firstControl.textContent).toBe('▼');
    firstControl.click();
    expect(firstControl.textContent).toBe('▶');
    
    // Has editable values (including text nodes)
    const editables = container.querySelectorAll('.node-value[data-editable="true"]');
    expect(editables.length).toBeGreaterThan(0);
  });

  test('YAML - expansion/collapse and editing works', () => {
    const handler = new YamlHandler();
    const yaml = `
name: Test
nested:
  value: editable
  items:
    - one
    - two`;
    
    const node = handler.parse(yaml);
    const element = renderer.render(node, { formatHandler: handler });
    container.appendChild(element);
    
    // Has expansion controls
    const controls = container.querySelectorAll('.expand-control');
    expect(controls.length).toBeGreaterThan(0);
    
    // Can collapse
    const firstControl = controls[0];
    expect(firstControl.textContent).toBe('▼');
    firstControl.click();
    expect(firstControl.textContent).toBe('▶');
    
    // Has editable values
    const editables = container.querySelectorAll('.node-value[data-editable="true"]');
    expect(editables.length).toBeGreaterThan(0);
    
    // Array indices are shown correctly
    const arrayIndices = container.querySelectorAll('.array-index');
    expect(arrayIndices.length).toBe(2); // two array items
  });

  test('Markdown - expansion/collapse and editing works', () => {
    const handler = new MarkdownHandler();
    const markdown = `# Title

Content here

## Section

Section content`;
    
    const node = handler.parse(markdown);
    const element = renderer.render(node, { formatHandler: handler });
    container.appendChild(element);
    
    // Has expansion controls for nested structure
    const controls = container.querySelectorAll('.expand-control');
    expect(controls.length).toBeGreaterThan(0);
    
    // Can collapse
    const firstControl = controls[0];
    expect(firstControl.textContent).toBe('▼');
    firstControl.click();
    expect(firstControl.textContent).toBe('▶');
    
    // Has headings rendered
    const headings = container.querySelectorAll('.markdown-heading');
    expect(headings.length).toBe(2);
  });

  test('All handlers have getEditableFields method', () => {
    const handlers = [
      new JsonHandler(),
      new XmlHandler(),
      new YamlHandler(),
      new MarkdownHandler()
    ];
    
    handlers.forEach(handler => {
      const editableFields = handler.getEditableFields();
      expect(editableFields).toBeDefined();
      expect(editableFields.keyEditable).toBeDefined();
      expect(editableFields.valueEditable).toBeDefined();
      expect(editableFields.typeChangeable).toBeDefined();
      expect(editableFields.structureEditable).toBeDefined();
    });
  });
});