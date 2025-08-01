/**
 * Comprehensive DOM verification tests for hierarchy editor
 * Every test verifies actual DOM state changes
 */

import { jest } from '@jest/globals';
import { HierarchyRenderer } from '../src/components/hierarchy-editor/renderer/HierarchyRenderer.js';
import { ExpansionStateManager } from '../src/components/hierarchy-editor/state/ExpansionStateManager.js';
import { BaseFormatHandler } from '../src/components/hierarchy-editor/handlers/BaseFormatHandler.js';
import { JsonHandler } from '../src/components/hierarchy-editor/handlers/JsonHandler.js';
import { XmlHandler } from '../src/components/hierarchy-editor/handlers/XmlHandler.js';
import { YamlHandler } from '../src/components/hierarchy-editor/handlers/YamlHandler.js';
import { MarkdownHandler } from '../src/components/hierarchy-editor/handlers/MarkdownHandler.js';

// Register handlers
BaseFormatHandler.register('json', JsonHandler);
BaseFormatHandler.register('xml', XmlHandler);
BaseFormatHandler.register('yaml', YamlHandler);
BaseFormatHandler.register('markdown', MarkdownHandler);

describe('Hierarchy Editor - Comprehensive DOM Verification', () => {
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

  describe('Expansion/Collapse DOM Verification', () => {
    test('should show expansion arrow and respond to clicks with DOM changes', () => {
      const handler = new JsonHandler();
      const json = `{
        "parent": {
          "child1": "value1",
          "child2": "value2"
        }
      }`;
      
      const node = handler.parse(json);
      const element = renderer.render(node, { formatHandler: handler });
      container.appendChild(element);
      
      // Verify initial DOM state - expanded
      const parentKeyElement = Array.from(container.querySelectorAll('.node-key'))
        .find(el => el.textContent.includes('parent'));
      expect(parentKeyElement).toBeTruthy();
      
      // Find the parent's expand control
      const parentNode = parentKeyElement.closest('.hierarchy-node');
      const expandControl = parentNode.querySelector('.expand-control');
      expect(expandControl).toBeTruthy();
      expect(expandControl.textContent).toBe('▼'); // Expanded arrow
      expect(expandControl.getAttribute('data-expanded')).toBe('true');
      
      // Verify children are visible in DOM
      const allKeys = Array.from(container.querySelectorAll('.node-key'))
        .map(el => el.textContent.replace(': ', ''));
      expect(allKeys).toContain('parent');
      expect(allKeys).toContain('child1');
      expect(allKeys).toContain('child2');
      
      // Count visible nodes
      const visibleNodes = container.querySelectorAll('.hierarchy-node');
      expect(visibleNodes.length).toBe(3); // parent + 2 children
      
      // Click to collapse
      expandControl.click();
      
      // Verify arrow changed
      expect(expandControl.textContent).toBe('▶'); // Collapsed arrow
      expect(expandControl.getAttribute('data-expanded')).toBe('false');
      
      // Re-render to verify state persistence
      container.innerHTML = '';
      const newElement = renderer.render(node, { formatHandler: handler });
      container.appendChild(newElement);
      
      // Verify children are NOT in DOM anymore
      const newKeys = Array.from(container.querySelectorAll('.node-key'))
        .map(el => el.textContent.replace(': ', ''));
      expect(newKeys).toContain('parent');
      expect(newKeys).not.toContain('child1');
      expect(newKeys).not.toContain('child2');
      
      // Verify collapsed summary appears
      const collapsedSummary = container.querySelector('.collapsed-summary');
      expect(collapsedSummary).toBeTruthy();
      expect(collapsedSummary.textContent).toBe(' // 2 properties');
      
      // Verify node count decreased
      const collapsedNodes = container.querySelectorAll('.hierarchy-node');
      expect(collapsedNodes.length).toBe(1); // Only parent visible
    });

    test('should handle nested expansion states with proper DOM updates', () => {
      const handler = new JsonHandler();
      const json = `{
        "level1": {
          "level2": {
            "level3": {
              "deepValue": "test"
            }
          }
        }
      }`;
      
      const node = handler.parse(json);
      const element = renderer.render(node, { formatHandler: handler });
      container.appendChild(element);
      
      // Verify all levels are initially visible
      let depthElements = container.querySelectorAll('[data-depth]');
      const depths = Array.from(depthElements).map(el => 
        parseInt(el.getAttribute('data-depth'))
      );
      expect(depths).toContain(0); // level1
      expect(depths).toContain(1); // level2
      expect(depths).toContain(2); // level3
      expect(depths).toContain(3); // deepValue
      
      // Find and collapse level2
      const level2Key = Array.from(container.querySelectorAll('.node-key'))
        .find(el => el.textContent.includes('level2'));
      const level2Node = level2Key.closest('.hierarchy-node');
      const level2Control = level2Node.querySelector('.expand-control');
      
      level2Control.click();
      
      // Re-render
      container.innerHTML = '';
      const newElement = renderer.render(node, { formatHandler: handler });
      container.appendChild(newElement);
      
      // Verify level3 and deepValue are gone from DOM
      const visibleKeys = Array.from(container.querySelectorAll('.node-key'))
        .map(el => el.textContent.replace(': ', ''));
      expect(visibleKeys).toContain('level1');
      expect(visibleKeys).toContain('level2');
      expect(visibleKeys).not.toContain('level3');
      expect(visibleKeys).not.toContain('deepValue');
      
      // Verify DOM structure
      const level2Summary = container.querySelector('.collapsed-summary');
      expect(level2Summary).toBeTruthy();
      expect(level2Summary.textContent).toBe(' // 1 property');
    });

    test('should expand/collapse arrays with proper DOM updates', () => {
      const handler = new JsonHandler();
      const json = `{
        "items": [
          {"id": 1, "name": "First"},
          {"id": 2, "name": "Second"},
          {"id": 3, "name": "Third"}
        ]
      }`;
      
      const node = handler.parse(json);
      const element = renderer.render(node, { formatHandler: handler });
      container.appendChild(element);
      
      // Verify array indices are shown
      const arrayIndices = container.querySelectorAll('.array-index');
      expect(arrayIndices.length).toBe(3);
      expect(arrayIndices[0].textContent).toBe('[0]');
      expect(arrayIndices[1].textContent).toBe('[1]');
      expect(arrayIndices[2].textContent).toBe('[2]');
      
      // Verify array items are expanded
      const nameKeys = Array.from(container.querySelectorAll('.node-key'))
        .filter(el => el.textContent.includes('name'));
      expect(nameKeys.length).toBe(3);
      
      // Collapse the array
      const itemsKey = Array.from(container.querySelectorAll('.node-key'))
        .find(el => el.textContent.includes('items'));
      const itemsNode = itemsKey.closest('.hierarchy-node');
      const itemsControl = itemsNode.querySelector('.expand-control');
      
      itemsControl.click();
      
      // Re-render
      container.innerHTML = '';
      const newElement2 = renderer.render(node, { formatHandler: handler });
      container.appendChild(newElement2);
      
      // Verify array items are gone
      const newArrayIndices = container.querySelectorAll('.array-index');
      expect(newArrayIndices.length).toBe(0);
      
      // Verify summary shows item count
      const arraySummary = container.querySelector('.collapsed-summary');
      expect(arraySummary).toBeTruthy();
      expect(arraySummary.textContent).toBe(' // 3 items');
    });
  });

  describe('Inline Editing DOM Verification', () => {
    test('should create input element on value click and update DOM', (done) => {
      const handler = new JsonHandler();
      const json = `{"testKey": "originalValue"}`;
      const node = handler.parse(json);
      
      let editEventFired = false;
      renderer.onEdit = (data) => {
        editEventFired = true;
        expect(data.oldValue).toBe('originalValue');
        expect(data.newValue).toBe('newValue');
      };
      
      const element = renderer.render(node, { formatHandler: handler });
      container.appendChild(element);
      
      // Find the value element
      const valueElement = container.querySelector('.node-value');
      expect(valueElement).toBeTruthy();
      expect(valueElement.textContent).toBe('"originalValue"');
      expect(valueElement.classList.contains('string-value')).toBe(true);
      
      // Verify it's marked as editable
      expect(valueElement.getAttribute('data-editable')).toBe('true');
      
      // Click to edit
      valueElement.click();
      
      // Verify input element was created
      const input = container.querySelector('.edit-input');
      expect(input).toBeTruthy();
      expect(input.tagName).toBe('INPUT');
      expect(input.value).toBe('originalValue');
      expect(input.classList.contains('value-edit')).toBe(true);
      
      // Verify original element is hidden
      expect(valueElement.style.display).toBe('none');
      
      // Change value
      input.value = 'newValue';
      
      // Simulate Enter key
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      input.dispatchEvent(enterEvent);
      
      // Verify DOM updates
      setTimeout(() => {
        // Input should be removed
        expect(container.querySelector('.edit-input')).toBeFalsy();
        
        // Original element should be visible again
        expect(valueElement.style.display).toBe('');
        
        // Edit event should have fired
        expect(editEventFired).toBe(true);
        
        done();
      }, 10);
    });

    test('should create input element on key click and update DOM', (done) => {
      const handler = new JsonHandler();
      const json = `{"editableKey": "value"}`;
      const node = handler.parse(json);
      
      let keyEditFired = false;
      renderer.onEdit = (data) => {
        keyEditFired = true;
        expect(data.type).toBe('key');
        expect(data.oldValue).toBe('editableKey');
        expect(data.newValue).toBe('newKey');
      };
      
      const element = renderer.render(node, { formatHandler: handler });
      container.appendChild(element);
      
      // Find key element
      const keyElement = container.querySelector('.node-key');
      expect(keyElement).toBeTruthy();
      expect(keyElement.textContent).toBe('editableKey: ');
      
      // Click to edit
      keyElement.click();
      
      // Verify input was created
      const input = container.querySelector('.edit-input.key-edit');
      expect(input).toBeTruthy();
      expect(input.value).toBe('editableKey');
      
      // Verify key element is hidden
      expect(keyElement.style.display).toBe('none');
      
      // Change key
      input.value = 'newKey';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      
      setTimeout(() => {
        expect(container.querySelector('.edit-input')).toBeFalsy();
        expect(keyElement.style.display).toBe('');
        expect(keyEditFired).toBe(true);
        done();
      }, 10);
    });

    test('should cancel edit on Escape key and restore DOM', () => {
      const handler = new JsonHandler();
      const json = `{"test": 123}`;
      const node = handler.parse(json);
      
      const element = renderer.render(node, { formatHandler: handler });
      container.appendChild(element);
      
      const valueElement = container.querySelector('.node-value');
      const originalText = valueElement.textContent;
      
      // Start editing
      valueElement.click();
      
      const input = container.querySelector('.edit-input');
      expect(input).toBeTruthy();
      
      // Change value but then escape
      input.value = '999';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      
      // Verify input removed and original restored
      expect(container.querySelector('.edit-input')).toBeFalsy();
      expect(valueElement.style.display).toBe('');
      expect(valueElement.textContent).toBe(originalText); // Original value
    });
  });

  describe('Multi-Format DOM Verification', () => {
    test('should render XML with attributes in DOM', () => {
      const handler = new XmlHandler();
      const xml = `<person name="John" age="30">
        <address city="New York" />
      </person>`;
      
      const node = handler.parse(xml);
      const element = renderer.render(node, { formatHandler: handler });
      container.appendChild(element);
      
      // Verify XML-specific DOM elements
      const xmlTags = container.querySelectorAll('.xml-tag');
      expect(xmlTags.length).toBeGreaterThan(0);
      
      // Verify attributes are rendered
      const attrElements = container.querySelectorAll('.xml-attribute');
      expect(attrElements.length).toBe(3); // name, age, city
      
      const attrKeys = Array.from(container.querySelectorAll('.attr-key'))
        .map(el => el.textContent);
      expect(attrKeys).toContain('name');
      expect(attrKeys).toContain('age');
      expect(attrKeys).toContain('city');
      
      const attrValues = Array.from(container.querySelectorAll('.attr-value'))
        .map(el => el.textContent);
      expect(attrValues).toContain('"John"');
      expect(attrValues).toContain('"30"');
      expect(attrValues).toContain('"New York"');
    });

    test('should render YAML with proper structure in DOM', () => {
      const handler = new YamlHandler();
      const yaml = `
name: Test
items:
  - first
  - second
nested:
  key: value`;
      
      const node = handler.parse(yaml);
      const element = renderer.render(node, { formatHandler: handler });
      container.appendChild(element);
      
      // Verify YAML structure is rendered
      const keys = Array.from(container.querySelectorAll('.node-key'))
        .map(el => el.textContent.replace(': ', ''));
      expect(keys).toContain('name');
      expect(keys).toContain('items');
      expect(keys).toContain('nested');
      expect(keys).toContain('key');
      
      // Verify array items
      const arrayIndices = container.querySelectorAll('.array-index');
      expect(arrayIndices.length).toBe(2); // two items in the array
    });

    test('should render Markdown headings with proper hierarchy in DOM', () => {
      const handler = new MarkdownHandler();
      const markdown = `# Main Title

Content under main

## Subsection

Subsection content`;
      
      const node = handler.parse(markdown);
      const element = renderer.render(node, { formatHandler: handler });
      container.appendChild(element);
      
      // Verify Markdown-specific elements
      const headings = container.querySelectorAll('.markdown-heading');
      expect(headings.length).toBe(2);
      
      // Verify heading levels
      const h1 = container.querySelector('h1.markdown-heading');
      expect(h1).toBeTruthy();
      expect(h1.textContent).toBe('Main Title');
      
      const h2 = container.querySelector('h2.markdown-heading');
      expect(h2).toBeTruthy();
      expect(h2.textContent).toBe('Subsection');
      
      // Verify content blocks
      const contentBlocks = container.querySelectorAll('.markdown-content');
      expect(contentBlocks.length).toBe(2);
    });
  });

  describe('State Management DOM Verification', () => {
    test('should persist expansion state across multiple re-renders', () => {
      const handler = new JsonHandler();
      const json = `{
        "keep1": {"a": 1},
        "collapse1": {"b": 2},
        "keep2": {"c": 3},
        "collapse2": {"d": 4}
      }`;
      
      const node = handler.parse(json);
      const element = renderer.render(node, { formatHandler: handler });
      container.appendChild(element);
      
      // Collapse specific nodes
      ['collapse1', 'collapse2'].forEach(keyName => {
        const keyEl = Array.from(container.querySelectorAll('.node-key'))
          .find(el => el.textContent.includes(keyName));
        const control = keyEl.closest('.hierarchy-node').querySelector('.expand-control');
        control.click();
      });
      
      // Verify state
      expect(expansionState.isExpanded('keep1')).toBe(true);
      expect(expansionState.isExpanded('collapse1')).toBe(false);
      expect(expansionState.isExpanded('keep2')).toBe(true);
      expect(expansionState.isExpanded('collapse2')).toBe(false);
      
      // Re-render 5 times to ensure state persists
      for (let i = 0; i < 5; i++) {
        container.innerHTML = '';
        const freshElement = renderer.render(node, { formatHandler: handler });
        container.appendChild(freshElement);
        
        // Verify DOM matches expected state
        const visibleKeys = Array.from(container.querySelectorAll('.node-key'))
          .map(el => el.textContent.replace(': ', ''));
        
        // These should be visible
        expect(visibleKeys).toContain('keep1');
        expect(visibleKeys).toContain('a');
        expect(visibleKeys).toContain('keep2');
        expect(visibleKeys).toContain('c');
        
        // These should be visible (parent nodes)
        expect(visibleKeys).toContain('collapse1');
        expect(visibleKeys).toContain('collapse2');
        
        // These should NOT be visible (collapsed children)
        expect(visibleKeys).not.toContain('b');
        expect(visibleKeys).not.toContain('d');
        
        // Verify summaries exist for collapsed nodes
        const summaries = container.querySelectorAll('.collapsed-summary');
        expect(summaries.length).toBe(2);
      }
    });

    test('should handle expand all and collapse all with DOM verification', () => {
      const handler = new JsonHandler();
      const json = `{
        "section1": {
          "subsection1": {"value": 1}
        },
        "section2": {
          "subsection2": {"value": 2}
        }
      }`;
      
      const node = handler.parse(json);
      
      // Start with all collapsed
      expansionState.collapseAll();
      const element = renderer.render(node, { formatHandler: handler });
      container.appendChild(element);
      
      // Verify only top-level is visible
      let visibleKeys = Array.from(container.querySelectorAll('.node-key'))
        .map(el => el.textContent.replace(': ', ''));
      expect(visibleKeys.length).toBe(2);
      expect(visibleKeys).toEqual(['section1', 'section2']);
      
      // Verify collapsed summaries
      let summaries = container.querySelectorAll('.collapsed-summary');
      expect(summaries.length).toBe(2);
      
      // Expand all
      expansionState.expandAll(node);
      container.innerHTML = '';
      const expandedElement = renderer.render(node, { formatHandler: handler });
      container.appendChild(expandedElement);
      
      // Verify all nodes are visible
      visibleKeys = Array.from(container.querySelectorAll('.node-key'))
        .map(el => el.textContent.replace(': ', ''));
      expect(visibleKeys).toContain('section1');
      expect(visibleKeys).toContain('subsection1');
      expect(visibleKeys).toContain('value');
      expect(visibleKeys).toContain('section2');
      expect(visibleKeys).toContain('subsection2');
      
      // Verify no collapsed summaries
      summaries = container.querySelectorAll('.collapsed-summary');
      expect(summaries.length).toBe(0);
      
      // Verify all expand controls show expanded state
      const controls = container.querySelectorAll('.expand-control');
      controls.forEach(control => {
        expect(control.textContent).toBe('▼');
        expect(control.getAttribute('data-expanded')).toBe('true');
      });
    });
  });

  describe('Edge Cases DOM Verification', () => {
    test('should handle empty objects and arrays in DOM', () => {
      const handler = new JsonHandler();
      const json = `{
        "emptyObject": {},
        "emptyArray": [],
        "nullValue": null
      }`;
      
      const node = handler.parse(json);
      const element = renderer.render(node, { formatHandler: handler });
      container.appendChild(element);
      
      // Verify empty object rendering
      const emptyObjText = container.querySelector('.empty-object');
      expect(emptyObjText).toBeTruthy();
      expect(emptyObjText.textContent).toBe('{}');
      
      // Verify empty array rendering
      const emptyArrText = container.querySelector('.empty-array');
      expect(emptyArrText).toBeTruthy();
      expect(emptyArrText.textContent).toBe('[]');
      
      // Verify null value
      const nullValue = container.querySelector('.null-value');
      expect(nullValue).toBeTruthy();
      expect(nullValue.textContent).toBe('null');
    });

    test('should handle deeply nested structures in DOM', () => {
      const handler = new JsonHandler();
      const json = `{
        "l1": {
          "l2": {
            "l3": {
              "l4": {
                "l5": "deep"
              }
            }
          }
        }
      }`;
      
      const node = handler.parse(json);
      const element = renderer.render(node, { formatHandler: handler });
      container.appendChild(element);
      
      // Verify depth attributes
      const depths = Array.from(container.querySelectorAll('[data-depth]'))
        .map(el => parseInt(el.getAttribute('data-depth')));
      
      expect(Math.max(...depths)).toBe(4); // 0-indexed, so 4 means 5 levels
      
      // Verify nested structure
      const l5Key = Array.from(container.querySelectorAll('.node-key'))
        .find(el => el.textContent.includes('l5'));
      expect(l5Key).toBeTruthy();
      
      // Walk up the DOM tree and verify nesting
      let current = l5Key.closest('.hierarchy-node');
      let nestingLevel = 0;
      while (current) {
        const parentNode = current.parentElement?.closest('.hierarchy-node');
        if (parentNode && parentNode !== current) {
          current = parentNode;
          nestingLevel++;
        } else {
          break;
        }
      }
      expect(nestingLevel).toBe(4); // Should be nested 4 levels deep
    });

    test('should handle rapid expansion state changes in DOM', () => {
      const handler = new JsonHandler();
      const json = `{"toggle": {"child": "value"}}`;
      const node = handler.parse(json);
      
      const element = renderer.render(node, { formatHandler: handler });
      container.appendChild(element);
      
      const toggleKey = Array.from(container.querySelectorAll('.node-key'))
        .find(el => el.textContent.includes('toggle'));
      const control = toggleKey.closest('.hierarchy-node').querySelector('.expand-control');
      
      // Rapid toggling
      for (let i = 0; i < 10; i++) {
        control.click();
      }
      
      // After even number of clicks, should be in original state
      expect(control.textContent).toBe('▼');
      expect(control.getAttribute('data-expanded')).toBe('true');
      
      // One more click to collapse
      control.click();
      expect(control.textContent).toBe('▶');
      expect(control.getAttribute('data-expanded')).toBe('false');
      
      // Verify DOM is in correct state
      container.innerHTML = '';
      const finalElement = renderer.render(node, { formatHandler: handler });
      container.appendChild(finalElement);
      
      const visibleKeys = Array.from(container.querySelectorAll('.node-key'))
        .map(el => el.textContent.replace(': ', ''));
      expect(visibleKeys).toContain('toggle');
      expect(visibleKeys).not.toContain('child');
      expect(container.querySelector('.collapsed-summary')).toBeTruthy();
    });
  });
});